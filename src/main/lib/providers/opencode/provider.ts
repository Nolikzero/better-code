import type {
  FilePartInput,
  GlobalEvent,
  TextPartInput,
} from "@opencode-ai/sdk";
import type {
  ProviderConfig,
  ProviderModel,
  UIMessageChunk,
} from "@shared/types";
import { registerPendingOpenCodeQuestion } from "../../trpc/routers/chat";
import type { AIProvider, AuthStatus, ChatSessionOptions } from "../types";
import {
  abortSession,
  createSession,
  fetchModels,
  getCachedModels,
  getClient,
  getAuthStatus as getClientAuthStatus,
  getSession,
  parseModelId,
} from "./client";
import { getOpenCodeBinaryPath } from "./env";
import { getServerInstance } from "./server";
import { createOpenCodeTransformer } from "./transform";

// Cache for dynamic models
let cachedModels: ProviderModel[] = [];
let modelsCacheTime = 0;
const MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Active sessions for cancellation
const activeSessions = new Map<
  string,
  { abortController: AbortController; sessionId?: string }
>();

/**
 * OpenCode Provider
 *
 * Integrates with OpenCode server for multi-provider AI chat.
 * Unlike Claude/Codex which use static model lists, OpenCode
 * fetches models dynamically from the running server.
 */
export class OpenCodeProvider implements AIProvider {
  readonly id = "opencode" as const;

  // Base config - models populated dynamically
  private _config: ProviderConfig = {
    id: "opencode",
    name: "OpenCode",
    description:
      "Multi-provider AI coding agent (Anthropic, OpenAI, Google, etc.)",
    models: [], // Dynamic - populated from server
    authType: "both",
    binaryName: "opencode",
  };

  /**
   * Get config with current cached models
   */
  get config(): ProviderConfig {
    const now = Date.now();
    if (cachedModels.length > 0 && now - modelsCacheTime < MODELS_CACHE_TTL) {
      return { ...this._config, models: cachedModels };
    }
    // Return with whatever models we have (may be empty on first access)
    return { ...this._config, models: getCachedModels() };
  }

  /**
   * Initialize provider - start server and fetch models
   */
  async initialize(): Promise<void> {
    console.log("[opencode] Initializing provider...");

    try {
      // Ensure server is running
      const server = getServerInstance();
      await server.ensureRunning();

      // Pre-fetch models to populate cache
      await this.refreshModels();

      console.log("[opencode] Provider initialized successfully");
    } catch (error) {
      console.error("[opencode] Initialization failed:", error);
      // Don't throw - provider will be marked as unavailable
    }
  }

  /**
   * Shutdown provider - stop server if we started it
   */
  async shutdown(): Promise<void> {
    console.log("[opencode] Shutting down provider...");

    // Cancel all active sessions
    for (const [_subChatId, session] of activeSessions) {
      session.abortController.abort();
      if (session.sessionId) {
        await abortSession(session.sessionId).catch(() => {});
      }
    }
    activeSessions.clear();

    // Shutdown server
    const server = getServerInstance();
    await server.shutdown();

    console.log("[opencode] Provider shutdown complete");
  }

  /**
   * Check if OpenCode binary is available
   */
  async isAvailable(): Promise<boolean> {
    const result = getOpenCodeBinaryPath();
    return result !== null;
  }

  /**
   * Get authentication status
   * Returns authenticated if ANY underlying provider is connected
   */
  async getAuthStatus(): Promise<AuthStatus> {
    try {
      const server = getServerInstance();
      if (server.getState().status !== "running") {
        // Server not running - check if binary exists
        const hasBinary = await this.isAvailable();
        if (!hasBinary) {
          return {
            authenticated: false,
            error: "OpenCode not installed",
          };
        }
        return {
          authenticated: false,
          error: "Server not running",
        };
      }

      const authStatuses = await getClientAuthStatus();
      const connectedProviders = Object.entries(authStatuses)
        .filter(([_, connected]) => connected)
        .map(([id]) => id);

      if (connectedProviders.length > 0) {
        console.log(
          `[opencode] Connected providers: ${connectedProviders.join(", ")}`,
        );
        return {
          authenticated: true,
          method: "api-key",
        };
      }

      return {
        authenticated: false,
        error: "No providers connected. Configure API keys in OpenCode.",
      };
    } catch (error) {
      return {
        authenticated: false,
        error: `Auth check failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Refresh models from server
   */
  async refreshModels(): Promise<ProviderModel[]> {
    try {
      cachedModels = await fetchModels(true);
      modelsCacheTime = Date.now();
      console.log(`[opencode] Refreshed ${cachedModels.length} models`);
      return cachedModels;
    } catch (error) {
      console.error("[opencode] Failed to refresh models:", error);
      return cachedModels;
    }
  }

  /**
   * Main chat method - streaming via SSE
   */
  async *chat(
    options: ChatSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown> {
    const abortController = options.abortController;
    const session = {
      abortController,
      sessionId: undefined as string | undefined,
    };
    activeSessions.set(options.subChatId, session);

    try {
      // Ensure server is running
      const server = getServerInstance();
      await server.ensureRunning();

      // Create transformer with persisted state from previous turns
      const initialDiffKeys = options.emittedDiffKeys
        ? new Set(options.emittedDiffKeys)
        : new Set<string>();
      const transformer = createOpenCodeTransformer({
        emittedDiffKeys: initialDiffKeys,
      });

      // Get or create session
      let sessionId = options.sessionId;

      if (sessionId) {
        // Verify session exists
        const existingSession = await getSession(sessionId, options.cwd);
        if (!existingSession) {
          console.log(
            `[opencode] Session ${sessionId} not found, creating new one`,
          );
          sessionId = undefined;
        }
      }

      if (!sessionId) {
        const newSession = await createSession(
          `BetterCode-${options.subChatId}`,
          options.cwd,
        );
        if (!newSession) {
          yield {
            type: "error",
            errorText: "Failed to create OpenCode session",
          };
          yield { type: "finish" };
          return;
        }
        sessionId = newSession.id;
        console.log(`[opencode] Created new session: ${sessionId}`);
      }

      session.sessionId = sessionId;

      // Parse model
      const modelInfo = options.model ? parseModelId(options.model) : undefined;

      // Build message parts with proper SDK types
      const parts: Array<TextPartInput | FilePartInput> = [];

      // Add images if present - convert to data URLs
      if (options.images && options.images.length > 0) {
        for (const img of options.images) {
          // Convert base64 to data URL format
          const dataUrl = `data:${img.mediaType};base64,${img.base64Data}`;
          parts.push({
            type: "file",
            mime: img.mediaType,
            url: dataUrl,
          } as FilePartInput);
        }
      }

      // Add text prompt
      parts.push({
        type: "text",
        text: options.prompt,
      } as TextPartInput);

      // Subscribe to global events first
      const client = getClient();
      const eventStream = await client.global.event();

      // Use promptAsync for non-blocking send
      client.session
        .promptAsync({
          path: { id: sessionId },
          query: { directory: options.cwd },
          body: {
            parts,
            ...(options.mode === "plan" && { agent: "plan" }),
            ...(modelInfo && {
              model: {
                providerID: modelInfo.providerID,
                modelID: modelInfo.modelID,
              },
            }),
          },
        })
        .catch((error) => {
          if (!abortController.signal.aborted) {
            console.error("[opencode] Prompt request failed:", error);
          }
        });

      // Process SSE event stream using the SDK's async generator
      try {
        for await (const event of eventStream.stream) {
          if (abortController.signal.aborted) break;

          // Event is GlobalEvent which has { directory, payload }
          const globalEvent = event as GlobalEvent;
          const payload = globalEvent.payload;

          // Filter events for our session
          if ("properties" in payload) {
            const props = payload.properties as Record<string, unknown>;
            if (props.sessionID && props.sessionID !== sessionId) {
              continue;
            }
          }

          // Skip noisy file watcher events (git lock files, internal git dirs)
          if (payload.type === "file.watcher.updated") {
            const props = (payload as { properties?: Record<string, unknown> })
              .properties;
            const filePath = props?.file as string | undefined;
            if (
              filePath &&
              (filePath.endsWith(".lock") ||
                filePath.includes("/.git/objects/") ||
                filePath.includes("/.git/logs/"))
            ) {
              continue;
            }
          }

          // console.log(
          //   `[opencode] Event: ${payload.type}`,
          //   JSON.stringify(payload).slice(0, 200),
          // );

          // if (payload.type === "session.diff") {
          //     console.log(
          //     `[opencode] Session Diff Payload: `,
          //     JSON.stringify(payload),
          //   );
          // }

          // Transform and yield chunks
          for (const chunk of transformer.transform(payload)) {
            // Register pending OpenCode questions for response routing
            if (chunk.type === "ask-user-question") {
              registerPendingOpenCodeQuestion(
                chunk.toolUseId,
                chunk.toolUseId, // For OpenCode, the toolUseId IS the question ID
                chunk.questions,
                options.cwd, // Pass directory for API calls
              );
            }

            yield chunk;

            // Check for finish
            if (chunk.type === "finish") {
              return;
            }
          }
        }
      } catch (streamError) {
        if (!abortController.signal.aborted) {
          console.error("[opencode] Stream error:", streamError);
          yield {
            type: "error",
            errorText: `Stream error: ${(streamError as Error).message}`,
          };
        }
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        const err = error as Error;
        console.error("[opencode] Chat error:", err);
        yield {
          type: "error",
          errorText: `OpenCode error: ${err.message}`,
        };
        yield { type: "finish" };
      }
    } finally {
      activeSessions.delete(options.subChatId);
    }
  }

  /**
   * Cancel an active session
   */
  cancel(subChatId: string): void {
    const session = activeSessions.get(subChatId);
    if (session) {
      session.abortController.abort();
      // Also abort on server side
      if (session.sessionId) {
        abortSession(session.sessionId).catch((error) => {
          console.error("[opencode] Failed to abort session:", error);
        });
      }
      activeSessions.delete(subChatId);
    }
  }

  /**
   * Check if a session is active
   */
  isActive(subChatId: string): boolean {
    return activeSessions.has(subChatId);
  }
}
