import TOML from "@iarna/toml";
import {
  type ApprovalMode,
  Codex,
  type Input as CodexInput,
  type WebSearchMode as CodexWebSearchMode,
  type ModelReasoningEffort,
  type Thread,
  type ThreadOptions,
  type TurnOptions,
} from "@openai/codex-sdk";
import type { ImageAttachment } from "@shared/types";
import { execSync } from "child_process";
import { structuredPatch } from "diff";
import { readFileSync } from "fs";
import * as fs from "fs/promises";
import os from "os";
import path from "path";
import type { UIMessageChunk } from "../claude/types";
import type {
  AIProvider,
  AuthStatus,
  ChatSessionOptions,
  ProviderConfig,
  ProviderSpecificConfig,
} from "../types";
import {
  buildCodexEnv,
  getCodexApiKey,
  getCodexBinaryPath,
  getCodexOAuthToken,
  logCodexEnv,
} from "./env";
import { createCodexTransformer } from "./transform";

// Active sessions for cancellation
const activeSessions = new Map<
  string,
  { abortController: AbortController; thread?: Thread }
>();

// Singleton Codex client
let codexClient: Codex | null = null;

/**
 * Prepare images for Codex SDK by writing base64 data to temp files.
 * SDK expects file paths, not base64 data.
 */
async function prepareImages(
  images: ImageAttachment[],
): Promise<{ paths: string[]; cleanup: () => Promise<void> }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-images-"));
  const paths: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = img.mediaType.split("/")[1] || "png";
    const filePath = path.join(tempDir, `image-${i}.${ext}`);
    await fs.writeFile(filePath, Buffer.from(img.base64Data, "base64"));
    paths.push(filePath);
  }

  return {
    paths,
    cleanup: async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

/**
 * Extended options for Codex provider
 */
export interface CodexSessionOptions extends ChatSessionOptions {
  /** Callback to emit stderr from Codex process */
  onStderr?: (data: string) => void;
}

/**
 * Generate structuredPatch for a file change by reading content from the worktree.
 * Returns format expected by AgentEditTool: Array<{ lines: string[] }>
 */
function generateFileChangePatch(
  cwd: string,
  filePath: string,
  kind: string,
): Array<{ lines: string[] }> {
  try {
    // filePath from Codex SDK may be absolute or relative to cwd
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(cwd, filePath);
    // For git commands, use path relative to cwd
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(cwd, filePath)
      : filePath;
    let before = "";
    let after = "";

    if (kind === "add") {
      after = readFileSync(fullPath, "utf-8");
    } else if (kind === "delete") {
      before = execSync(`git show HEAD:${relativePath}`, {
        cwd,
        encoding: "utf-8",
      });
    } else {
      // "update" - get both versions
      try {
        before = execSync(`git show HEAD:${relativePath}`, {
          cwd,
          encoding: "utf-8",
        });
      } catch {
        /* file might be new/untracked */
      }
      after = readFileSync(fullPath, "utf-8");
    }

    const patch = structuredPatch(
      relativePath,
      relativePath,
      before,
      after,
      "",
      "",
      { context: 3 },
    );
    return patch.hunks.map((hunk) => ({ lines: hunk.lines }));
  } catch (error) {
    console.error(`[codex] Failed to generate patch for ${filePath}:`, error);
    return [];
  }
}

export class CodexProvider implements AIProvider {
  readonly id = "codex" as const;
  readonly config: ProviderConfig = {
    id: "codex",
    name: "OpenAI Codex",
    description: "OpenAI's Codex CLI for code generation",
    models: [
      {
        id: "gpt-5.3-codex",
        name: "gpt-5.3-codex",
        displayName: "GPT-5.3 Codex",
      },
      {
        id: "gpt-5.2-codex",
        name: "gpt-5.2-codex",
        displayName: "GPT-5.2 Codex",
      },
      {
        id: "gpt-5.1-codex-max",
        name: "gpt-5.1-codex-max",
        displayName: "GPT-5.1 Codex Max",
      },
      {
        id: "gpt-5.1-codex-mini",
        name: "gpt-5.1-codex-mini",
        displayName: "GPT-5.1 Codex Mini",
      },
      { id: "gpt-5.2", name: "gpt-5.2", displayName: "GPT-5.2" },
    ],
    authType: "api-key",
    binaryName: "codex",
  };

  /**
   * Get the Codex SDK client singleton
   */
  private getClient(): Codex {
    if (!codexClient) {
      // Only get actual API key (not OAuth tokens)
      // OAuth auth is handled by the binary reading from ~/.codex/auth.json
      const apiKey = getCodexApiKey();
      const env = buildCodexEnv({ apiKey: apiKey || undefined });
      const binaryResult = getCodexBinaryPath();

      codexClient = new Codex({
        apiKey: apiKey || undefined,
        env,
        codexPathOverride: binaryResult?.path || undefined,
      });

      if (binaryResult) {
        console.log(
          `[codex] Using binary from ${binaryResult.source}: ${binaryResult.path}`,
        );
      }
      if (apiKey) {
        console.log("[codex] Using API key authentication");
      } else {
        console.log(
          "[codex] Using OAuth authentication (binary reads from ~/.codex/auth.json)",
        );
      }
    }
    return codexClient;
  }

  async isAvailable(): Promise<boolean> {
    // SDK handles binary resolution internally
    // Just check if we can instantiate the client
    try {
      this.getClient();
      return true;
    } catch {
      return false;
    }
  }

  async getAuthStatus(): Promise<AuthStatus> {
    // Check for API key in environment
    if (process.env.OPENAI_API_KEY) {
      return { authenticated: true, method: "api-key" };
    }

    // Check for OAuth token
    const token = getCodexOAuthToken();
    if (token) {
      return { authenticated: true, method: "api-key" };
    }

    return { authenticated: false };
  }

  /**
   * Get provider-specific configuration (MCP servers from ~/.codex/config.toml)
   */
  async getProviderConfig(
    _projectPath: string,
  ): Promise<ProviderSpecificConfig | null> {
    try {
      const configPath = path.join(os.homedir(), ".codex", "config.toml");

      const exists = await fs
        .stat(configPath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        console.log("[codex] No config.toml found at", configPath);
        return null;
      }

      const content = await fs.readFile(configPath, "utf-8");
      const config = TOML.parse(content) as {
        mcp_servers?: Record<
          string,
          { command: string; args?: string[]; env?: Record<string, string> }
        >;
      };

      const mcpServers = config.mcp_servers || {};

      if (Object.keys(mcpServers).length > 0) {
        console.log(
          `[codex] Found MCP servers: ${Object.keys(mcpServers).join(", ")}`,
        );
      }

      return { mcpServers };
    } catch (error) {
      console.error("[codex] Error reading config.toml:", error);
      return null;
    }
  }

  /**
   * Map our approval policy to SDK's ApprovalMode type
   */
  private mapApprovalPolicy(
    options: ChatSessionOptions,
  ): ApprovalMode | undefined {
    if (options.approvalPolicy) {
      return options.approvalPolicy as ApprovalMode;
    }
    // For agent mode with full access, use "never"
    if (
      options.mode === "agent" &&
      options.sandboxMode === "danger-full-access"
    ) {
      return "never";
    }
    // Default: let SDK decide
    return undefined;
  }

  /**
   * Map our reasoning effort to SDK's ModelReasoningEffort type
   */
  private mapReasoningEffort(
    effort: string | undefined,
  ): ModelReasoningEffort | undefined {
    if (!effort) return undefined;
    // SDK supports: "minimal" | "low" | "medium" | "high" | "xhigh"
    const validEfforts = ["minimal", "low", "medium", "high", "xhigh"];
    if (validEfforts.includes(effort)) {
      return effort as ModelReasoningEffort;
    }
    return undefined;
  }

  async *chat(
    options: CodexSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown> {
    const abortController = options.abortController;
    const session = {
      abortController,
      thread: undefined as Thread | undefined,
    };
    activeSessions.set(options.subChatId, session);

    try {
      // Reject /compact - not supported by Codex SDK
      if (options.prompt.trim() === "/compact") {
        yield {
          type: "error",
          errorText:
            "Context compaction is not supported by the Codex provider.",
        } as UIMessageChunk;
        yield { type: "finish" } as UIMessageChunk;
        return;
      }

      // Get API key
      const apiKey = getCodexOAuthToken();
      if (!apiKey) {
        yield {
          type: "auth-error",
          errorText:
            "OpenAI API key not found. Set OPENAI_API_KEY environment variable or run 'codex auth'",
        };
        yield { type: "finish" };
        return;
      }

      // Log in dev mode
      if (process.env.NODE_ENV !== "production") {
        const env = buildCodexEnv({ apiKey });
        logCodexEnv(env, `[${options.subChatId}] `);
      }

      // Get SDK client
      const client = this.getClient();

      // Check if we're in plan mode - this affects sandbox, approval, and reasoning settings
      const isPlanMode = options.mode === "plan";

      // Build thread options with plan mode specific settings
      const threadOptions: ThreadOptions = {
        model: options.model,
        workingDirectory: options.cwd,
        // Plan mode uses read-only sandbox, agent mode uses workspace-write
        sandboxMode: isPlanMode ? "read-only" : "workspace-write",
        // Plan mode uses on-request approval, agent mode uses configured policy
        approvalPolicy: isPlanMode ? "never" : this.mapApprovalPolicy(options),
        // Plan mode uses high reasoning effort for thorough analysis
        modelReasoningEffort: isPlanMode
          ? "high"
          : this.mapReasoningEffort(options.reasoningEffort),
        additionalDirectories: options.addDirs,
        skipGitRepoCheck: true, // Allow non-git directories
        // SDK enhancement options
        ...(options.networkAccessEnabled !== undefined && {
          networkAccessEnabled: options.networkAccessEnabled,
        }),
        ...(options.webSearchMode && {
          webSearchMode: options.webSearchMode as CodexWebSearchMode,
        }),
      };

      console.log("[codex] Thread options:", JSON.stringify(threadOptions));

      // Create or resume thread
      let thread: Thread;
      if (options.sessionId) {
        console.log(`[codex] Resuming thread: ${options.sessionId}`);
        thread = client.resumeThread(options.sessionId, threadOptions);
      } else {
        console.log("[codex] Starting new thread");
        thread = client.startThread(threadOptions);
      }

      session.thread = thread;

      // Emit synthetic session-init with MCP config
      const mcpConfig = await this.getProviderConfig(options.cwd);
      if (
        mcpConfig?.mcpServers &&
        Object.keys(mcpConfig.mcpServers).length > 0
      ) {
        const mcpServers = Object.entries(mcpConfig.mcpServers).map(
          ([name]) => ({
            name,
            status: "connected" as const,
          }),
        );

        yield {
          type: "session-init",
          tools: [],
          mcpServers,
          plugins: [],
          skills: [],
        };

        console.log(
          `[codex] Emitted synthetic session-init with ${mcpServers.length} MCP servers`,
        );
      }

      // Build turn options
      const turnOptions: TurnOptions = {
        signal: abortController.signal,
        ...(options.outputSchema && { outputSchema: options.outputSchema }),
      };

      // Prepare input (handle images if provided)
      let sdkInput: CodexInput = options.prompt;
      let imageCleanup: (() => Promise<void>) | undefined;

      if (options.images && options.images.length > 0) {
        console.log(`[codex] Preparing ${options.images.length} images...`);
        const { paths, cleanup } = await prepareImages(options.images);
        imageCleanup = cleanup;
        sdkInput = [
          ...paths.map((p) => ({ type: "local_image" as const, path: p })),
          { type: "text" as const, text: options.prompt },
        ];
        console.log(
          `[codex] Images written to temp files: ${paths.join(", ")}`,
        );
      }

      // Run streaming turn
      console.log(`[codex] Running prompt: ${options.prompt.slice(0, 100)}...`);
      const { events } = await thread.runStreamed(sdkInput, turnOptions);

      // Create transformer
      const transform = createCodexTransformer();

      // Track file change tool calls for structuredPatch generation
      const fileChangeTools = new Map<
        string,
        { filePath: string; kind: string }
      >();

      // Process events and transform to UIMessageChunk
      try {
        for await (const event of events) {
          if (abortController.signal.aborted) {
            console.log("[codex] Aborted, stopping event processing");
            break;
          }

          console.log(
            `[codex] Event: ${event.type}`,
            JSON.stringify(event).slice(0, 200),
          );

          // Transform and yield chunks, enriching file changes with diff data
          for (const chunk of transform(event)) {
            if (
              chunk.type === "tool-input-available" &&
              (chunk as any).input?.kind
            ) {
              // Track file change tool calls
              fileChangeTools.set(chunk.toolCallId, {
                filePath: (chunk as any).input.file_path,
                kind: (chunk as any).input.kind,
              });
              yield chunk;
            } else if (
              chunk.type === "tool-output-available" &&
              fileChangeTools.has(chunk.toolCallId)
            ) {
              // Enrich file change output with structuredPatch
              const { filePath, kind } = fileChangeTools.get(chunk.toolCallId)!;
              const patches = generateFileChangePatch(
                options.cwd,
                filePath,
                kind,
              );
              yield {
                ...chunk,
                output:
                  patches.length > 0
                    ? { ...(chunk.output as any), structuredPatch: patches }
                    : chunk.output,
              };
              fileChangeTools.delete(chunk.toolCallId);
            } else {
              yield chunk;
            }
          }
        }
      } catch (error) {
        const err = error as Error;
        if (!abortController.signal.aborted) {
          yield {
            type: "error",
            errorText: `Codex streaming error: ${err.message}`,
          };
        }
      } finally {
        // Cleanup temp images
        if (imageCleanup) {
          console.log("[codex] Cleaning up temp images...");
          await imageCleanup();
        }
      }
    } catch (error) {
      const err = error as Error;
      yield {
        type: "error",
        errorText: `Codex error: ${err.message}`,
      };
      yield { type: "finish" };
    } finally {
      activeSessions.delete(options.subChatId);
    }
  }

  cancel(subChatId: string): void {
    const session = activeSessions.get(subChatId);
    if (session) {
      console.log(`[codex] Cancelling session: ${subChatId}`);
      session.abortController.abort();
      activeSessions.delete(subChatId);
    }
  }

  isActive(subChatId: string): boolean {
    return activeSessions.has(subChatId);
  }
}
