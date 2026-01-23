import type { ProviderSpecificConfig } from "@shared/types";
import { TRPCError } from "@trpc/server";
import { execSync } from "child_process";
import { app } from "electron";
import * as fs from "fs/promises";
import os from "os";
import path from "path";
import type {
  AIProvider,
  AuthStatus,
  ChatSessionOptions,
  ProviderConfig,
} from "../types";
import { buildClaudeEnv, getClaudeBinaryPath, logClaudeEnv } from "./env";
import { logRawClaudeMessage } from "./raw-logger";
import { createTransformer } from "./transform";
import type { UIMessageChunk } from "./types";

/**
 * Read Claude Code CLI OAuth token from macOS Keychain
 */
function getCliOAuthToken(): string | null {
  if (process.platform !== "darwin") {
    return null;
  }

  try {
    const output = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();

    if (!output) return null;

    const credentials = JSON.parse(output);
    const accessToken = credentials?.claudeAiOauth?.accessToken;

    if (accessToken?.startsWith("sk-ant-oat01-")) {
      console.log("[claude] Found CLI OAuth token in keychain");
      return accessToken;
    }

    return null;
  } catch (error) {
    console.log(
      "[claude] No CLI credentials found in keychain:",
      (error as Error).message,
    );
    return null;
  }
}

// Dynamic import for ESM module
const getClaudeQuery = async () => {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  return sdk.query;
};

// Active sessions for cancellation
const activeSessions = new Map<string, AbortController>();

export class ClaudeProvider implements AIProvider {
  readonly id = "claude" as const;
  readonly config: ProviderConfig = {
    id: "claude",
    name: "Claude Code",
    description: "Anthropic's Claude AI with coding capabilities",
    models: [
      { id: "opus", name: "claude-opus-4-5-20251101", displayName: "Opus 4.5" },
      {
        id: "sonnet",
        name: "claude-sonnet-4-5-20251101",
        displayName: "Sonnet 4.5",
      },
      {
        id: "haiku",
        name: "claude-haiku-4-5-20251101",
        displayName: "Haiku 4.5",
      },
    ],
    authType: "oauth",
    binaryName: "claude",
  };

  async isAvailable(): Promise<boolean> {
    const result = getClaudeBinaryPath();
    return result !== null;
  }

  async getAuthStatus(): Promise<AuthStatus> {
    if (process.env.ANTHROPIC_API_KEY) {
      return { authenticated: true, method: "api-key" };
    }

    const oauthToken = getCliOAuthToken();
    if (oauthToken) {
      return { authenticated: true, method: "oauth" };
    }

    return { authenticated: false };
  }

  async getProviderConfig(
    projectPath: string,
  ): Promise<ProviderSpecificConfig | null> {
    const claudeJsonPath = path.join(os.homedir(), ".claude.json");

    try {
      const exists = await fs
        .stat(claudeJsonPath)
        .then(() => true)
        .catch(() => false);
      if (!exists) return null;

      const config = JSON.parse(await fs.readFile(claudeJsonPath, "utf-8"));
      const projectConfig = config.projects?.[projectPath];

      if (!projectConfig?.mcpServers) {
        // Log available project paths for debugging
        const projectPaths = Object.keys(config.projects || {}).filter(
          (k) => config.projects[k]?.mcpServers,
        );
        console.log(
          `[claude] No MCP servers for ${projectPath}. Config has MCP for: ${projectPaths.join(", ") || "(none)"}`,
        );
        return null;
      }

      console.log(
        `[claude] MCP servers found for ${projectPath}: ${Object.keys(projectConfig.mcpServers).join(", ")}`,
      );
      return { mcpServers: projectConfig.mcpServers };
    } catch (error) {
      console.error("[claude] Failed to read MCP config:", error);
      return null;
    }
  }

  async *chat(
    options: ChatSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown> {
    const abortController = options.abortController;
    activeSessions.set(options.subChatId, abortController);

    const subId = options.subChatId.slice(-8);
    const stderrLines: string[] = [];

    try {
      // 1. Get Claude SDK
      let claudeQuery;
      try {
        claudeQuery = await getClaudeQuery();
      } catch (sdkError) {
        const errorMessage =
          sdkError instanceof Error ? sdkError.message : String(sdkError);
        console.error("[claude] Failed to load SDK:", errorMessage);
        yield {
          type: "error",
          errorText: `Failed to load Claude SDK: ${errorMessage}`,
        };
        yield { type: "finish" };
        return;
      }

      const transform = createTransformer();

      // 2. Build environment
      const claudeEnv = buildClaudeEnv();

      // 3. Create isolated config directory per subChat
      const isolatedConfigDir = path.join(
        app.getPath("userData"),
        "claude-sessions",
        options.subChatId,
      );

      await this.setupConfigDir(isolatedConfigDir);

      // 4. Load MCP servers from config if not already provided
      let mcpServersForSdk = options.mcpServers;
      if (!mcpServersForSdk) {
        const lookupPath = options.projectPath || options.cwd;
        const providerConfig = await this.getProviderConfig(lookupPath);
        if (providerConfig?.mcpServers) {
          mcpServersForSdk = providerConfig.mcpServers;
        }
      }

      // 5. Get CLI OAuth token
      const cliOAuthToken = getCliOAuthToken();

      // 6. Build final env
      const finalEnv = {
        ...claudeEnv,
        CLAUDE_CONFIG_DIR: isolatedConfigDir,
        ...(cliOAuthToken && {
          CLAUDE_CODE_OAUTH_TOKEN: cliOAuthToken,
        }),
      };

      if (process.env.NODE_ENV !== "production") {
        logClaudeEnv(finalEnv, `[${options.subChatId}] `);
      }

      // 7. Get binary path
      const binaryResult = getClaudeBinaryPath();
      if (!binaryResult) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Claude Code binary not found. Install via https://claude.ai/install.sh or run 'bun run claude:download'",
        });
      }
      console.log(
        `[claude] Using ${binaryResult.source} binary: ${binaryResult.path}`,
      );

      // 8. Build prompt (with image support)
      let prompt: string | AsyncIterable<any> = options.prompt;

      if (options.images && options.images.length > 0) {
        const messageContent: any[] = [
          ...options.images.map((img) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: img.mediaType,
              data: img.base64Data,
            },
          })),
        ];

        if (options.prompt.trim()) {
          messageContent.push({
            type: "text" as const,
            text: options.prompt,
          });
        }

        async function* createPromptWithImages() {
          yield {
            type: "user" as const,
            message: {
              role: "user" as const,
              content: messageContent,
            },
            parent_tool_use_id: null,
          };
        }

        prompt = createPromptWithImages();
      }

      // 9. Build query options
      console.log(
        `[SD] Query options - cwd: ${options.cwd}, projectPath: ${options.projectPath || "(not set)"}, mcpServers: ${mcpServersForSdk ? Object.keys(mcpServersForSdk).join(", ") : "(none)"}`,
      );

      const queryOptions = {
        prompt,
        options: {
          abortController,
          cwd: options.cwd,
          systemPrompt: {
            type: "preset" as const,
            preset: "claude_code" as const,
          },
          ...(options.agents &&
            Object.keys(options.agents).length > 0 && {
              agents: options.agents as any,
            }),
          ...(mcpServersForSdk && { mcpServers: mcpServersForSdk }),
          ...(options.addDirs &&
            options.addDirs.length > 0 && { addDirs: options.addDirs }),
          env: finalEnv,
          permissionMode:
            options.mode === "plan"
              ? ("plan" as const)
              : ("bypassPermissions" as const),
          ...(options.mode !== "plan" && {
            allowDangerouslySkipPermissions: true,
          }),
          includePartialMessages: true,
          settingSources: ["project" as const, "user" as const],
          canUseTool: async (
            toolName: string,
            toolInput: Record<string, unknown>,
            opts: { toolUseID: string },
          ) => {
            if (toolName === "AskUserQuestion" && options.onAskUserQuestion) {
              const response = await options.onAskUserQuestion(
                opts.toolUseID,
                (toolInput as any).questions,
              );
              if (!response.approved) {
                return {
                  behavior: "deny" as const,
                  message: response.message || "Skipped",
                };
              }
              return {
                behavior: "allow" as const,
                updatedInput: response.updatedInput as
                  | Record<string, unknown>
                  | undefined,
              };
            }
            return {
              behavior: "allow" as const,
              updatedInput: toolInput as Record<string, unknown>,
            };
          },
          stderr: (data: string) => {
            stderrLines.push(data);
            options.onStderr?.(data);
          },
          pathToClaudeCodeExecutable: binaryResult.path,
          ...(options.sessionId && {
            resume: options.sessionId,
            continue: true,
          }),
          ...(options.model && { model: options.model }),
          ...(options.maxThinkingTokens && {
            maxThinkingTokens: options.maxThinkingTokens,
          }),
        },
      };

      // 10. Run SDK query
      let stream;
      try {
        stream = claudeQuery(queryOptions as any);
      } catch (queryError) {
        const errorMessage =
          queryError instanceof Error ? queryError.message : String(queryError);
        console.error("[claude] Failed to create SDK query:", errorMessage);
        yield {
          type: "error",
          errorText: `Failed to start Claude query: ${errorMessage}`,
        };
        yield { type: "finish" };
        return;
      }

      // 11. Stream and transform
      let messageCount = 0;
      // Track tool inputs for file-changed notifications
      const toolInputs = new Map<string, { toolName: string; input: any }>();

      for await (const msg of stream) {
        if (abortController.signal.aborted) break;
        messageCount++;

        // Log raw message
        logRawClaudeMessage(options.chatId, msg);

        // Check for error messages from SDK
        const msgAny = msg as any;
        if (msgAny.type === "error" || msgAny.error) {
          console.log(
            `[SD] M:ERROR_MSG sub=${subId}`,
            JSON.stringify(msgAny, null, 2),
          );

          const sdkError =
            msgAny.error || msgAny.message || "Unknown SDK error";

          // Categorize SDK errors
          if (
            sdkError === "authentication_failed" ||
            sdkError.includes("authentication")
          ) {
            yield {
              type: "auth-error",
              errorText:
                "Authentication failed - not logged into Claude Code CLI",
            } as UIMessageChunk;
          } else if (
            sdkError === "rate_limit_exceeded" ||
            sdkError.includes("rate")
          ) {
            yield {
              type: "error",
              errorText: "Rate limit exceeded",
              debugInfo: {
                category: "RATE_LIMIT_SDK",
                sdkError,
                sessionId: msgAny.session_id,
              },
            } as UIMessageChunk;
          } else if (
            sdkError === "overloaded" ||
            sdkError.includes("overload")
          ) {
            yield {
              type: "error",
              errorText: "Claude is overloaded, try again later",
              debugInfo: { category: "OVERLOADED_SDK", sdkError },
            } as UIMessageChunk;
          } else {
            yield {
              type: "error",
              errorText: `Claude SDK error: ${sdkError}`,
              debugInfo: {
                category: "SDK_ERROR",
                sdkError,
                sessionId: msgAny.session_id,
              },
            } as UIMessageChunk;
          }

          yield { type: "finish" } as UIMessageChunk;
          return;
        }

        // Track sessionId
        if (msgAny.session_id) {
          yield {
            type: "message-metadata",
            messageMetadata: { sessionId: msgAny.session_id },
          } as UIMessageChunk;
        }

        // Log system messages
        if (msgAny.type === "system") {
          console.log(
            `[SD] SYSTEM message: subtype=${msgAny.subtype}`,
            JSON.stringify(
              {
                cwd: msgAny.cwd,
                mcp_servers: msgAny.mcp_servers,
                tools: msgAny.tools,
                plugins: msgAny.plugins,
                permissionMode: msgAny.permissionMode,
              },
              null,
              2,
            ),
          );
        }

        // Transform and yield chunks
        for (const chunk of transform(msg)) {
          // Track tool inputs for file-changed notifications
          if (chunk.type === "tool-input-available") {
            toolInputs.set(chunk.toolCallId, {
              toolName: chunk.toolName,
              input: chunk.input,
            });
          }

          // Notify about file changes for Write/Edit tools
          if (chunk.type === "tool-output-available" && options.onFileChanged) {
            const toolInfo = toolInputs.get(chunk.toolCallId);
            if (
              toolInfo &&
              (toolInfo.toolName === "Write" || toolInfo.toolName === "Edit")
            ) {
              const filePath = toolInfo.input?.file_path;
              if (filePath) {
                options.onFileChanged(
                  filePath,
                  `tool-${toolInfo.toolName}`,
                  options.subChatId,
                );
              }
            }
          }

          yield chunk;
        }
      }

      // 12. Check for empty response
      if (messageCount === 0 && !abortController.signal.aborted) {
        yield {
          type: "error",
          errorText: "No response received from Claude",
        } as UIMessageChunk;
      }
    } catch (error) {
      // Categorize streaming errors
      const err = error as Error;
      const stderrOutput = stderrLines.join("\n");

      let errorContext = "Claude streaming error";
      if (err.message?.includes("exited with code")) {
        errorContext = "Claude Code process crashed";
      } else if (err.message?.includes("ENOENT")) {
        errorContext = "Required executable not found in PATH";
      } else if (
        err.message?.includes("authentication") ||
        err.message?.includes("401")
      ) {
        yield {
          type: "auth-error",
          errorText: "Authentication failed - check your API key",
        } as UIMessageChunk;
        yield { type: "finish" } as UIMessageChunk;
        return;
      } else if (
        err.message?.includes("invalid_api_key") ||
        stderrOutput?.includes("invalid_api_key")
      ) {
        yield {
          type: "auth-error",
          errorText: "Invalid API key",
        } as UIMessageChunk;
        yield { type: "finish" } as UIMessageChunk;
        return;
      } else if (
        err.message?.includes("rate_limit") ||
        err.message?.includes("429")
      ) {
        errorContext = "Rate limit exceeded";
      } else if (
        err.message?.includes("network") ||
        err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("fetch failed")
      ) {
        errorContext = "Network error - check your connection";
      }

      if (!abortController.signal.aborted) {
        yield {
          type: "error",
          errorText: stderrOutput
            ? `${errorContext}: ${err.message}\n\nProcess output:\n${stderrOutput}`
            : `${errorContext}: ${err.message}`,
          debugInfo: {
            context: errorContext,
            cwd: options.cwd,
            mode: options.mode,
            stderr: stderrOutput || "(no stderr captured)",
          },
        } as UIMessageChunk;
      }
    } finally {
      activeSessions.delete(options.subChatId);
    }

    yield { type: "finish" } as UIMessageChunk;
  }

  cancel(subChatId: string): void {
    const controller = activeSessions.get(subChatId);
    if (controller) {
      controller.abort();
      activeSessions.delete(subChatId);
    }
  }

  isActive(subChatId: string): boolean {
    return activeSessions.has(subChatId);
  }

  /**
   * Setup isolated config directory with symlinks to skills/agents
   */
  private async setupConfigDir(configDir: string): Promise<void> {
    try {
      await fs.mkdir(configDir, { recursive: true });

      const homeClaudeDir = path.join(os.homedir(), ".claude");
      const skillsSource = path.join(homeClaudeDir, "skills");
      const skillsTarget = path.join(configDir, "skills");
      const agentsSource = path.join(homeClaudeDir, "agents");
      const agentsTarget = path.join(configDir, "agents");

      // Symlink skills
      try {
        const skillsSourceExists = await fs
          .stat(skillsSource)
          .then(() => true)
          .catch(() => false);
        const skillsTargetExists = await fs
          .lstat(skillsTarget)
          .then(() => true)
          .catch(() => false);
        if (skillsSourceExists && !skillsTargetExists) {
          await fs.symlink(skillsSource, skillsTarget, "dir");
          console.log(
            `[claude] Symlinked skills: ${skillsTarget} -> ${skillsSource}`,
          );
        }
      } catch {
        // Ignore symlink errors
      }

      // Symlink agents
      try {
        const agentsSourceExists = await fs
          .stat(agentsSource)
          .then(() => true)
          .catch(() => false);
        const agentsTargetExists = await fs
          .lstat(agentsTarget)
          .then(() => true)
          .catch(() => false);
        if (agentsSourceExists && !agentsTargetExists) {
          await fs.symlink(agentsSource, agentsTarget, "dir");
          console.log(
            `[claude] Symlinked agents: ${agentsTarget} -> ${agentsSource}`,
          );
        }
      } catch {
        // Ignore symlink errors
      }
    } catch (mkdirErr) {
      console.error("[claude] Failed to setup isolated config dir:", mkdirErr);
    }
  }
}
