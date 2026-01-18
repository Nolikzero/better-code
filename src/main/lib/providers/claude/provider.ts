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
      return accessToken;
    }

    return null;
  } catch {
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

// Pending tool approvals
const pendingToolApprovals = new Map<
  string,
  {
    subChatId: string;
    resolve: (decision: {
      approved: boolean;
      message?: string;
      updatedInput?: unknown;
    }) => void;
  }
>();

/**
 * Extended options for Claude provider (includes Claude-specific params)
 */
export interface ClaudeSessionOptions extends ChatSessionOptions {
  /** MCP servers config for the project */
  mcpServers?: Record<string, unknown>;
  /** Agents to register with SDK */
  agents?: Record<string, unknown>;
  /** Callback when tool asks for user input */
  onAskUserQuestion?: (
    toolUseId: string,
    questions: unknown[],
  ) => Promise<{ approved: boolean; message?: string; updatedInput?: unknown }>;
  /** Callback to emit stderr from Claude process */
  onStderr?: (data: string) => void;
  /** Callback when file is changed (for Edit/Write tools) */
  onFileChanged?: (filePath: string, toolType: string) => void;
}

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
    // Check for API key in environment
    if (process.env.ANTHROPIC_API_KEY) {
      return { authenticated: true, method: "api-key" };
    }

    // Check for OAuth token in keychain
    const oauthToken = getCliOAuthToken();
    if (oauthToken) {
      return { authenticated: true, method: "oauth" };
    }

    return { authenticated: false };
  }

  async *chat(
    options: ClaudeSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown> {
    const abortController = options.abortController;
    activeSessions.set(options.subChatId, abortController);

    try {
      // Get Claude SDK
      const claudeQuery = await getClaudeQuery();
      const transform = createTransformer();

      // Build environment
      const claudeEnv = buildClaudeEnv();

      // Create isolated config directory per subChat
      const isolatedConfigDir = path.join(
        app.getPath("userData"),
        "claude-sessions",
        options.subChatId,
      );

      // Ensure isolated config dir exists and symlink skills/agents
      await this.setupConfigDir(isolatedConfigDir);

      // Get CLI OAuth token
      const cliOAuthToken = getCliOAuthToken();

      // Build final env
      const finalEnv = {
        ...claudeEnv,
        CLAUDE_CONFIG_DIR: isolatedConfigDir,
        ...(cliOAuthToken && {
          CLAUDE_CODE_OAUTH_TOKEN: cliOAuthToken,
        }),
      };

      // Log in dev mode
      if (process.env.NODE_ENV !== "production") {
        logClaudeEnv(finalEnv, `[${options.subChatId}] `);
      }

      // Get binary path
      const binaryResult = getClaudeBinaryPath();
      if (!binaryResult) {
        yield {
          type: "error",
          errorText:
            "Claude Code binary not found. Install via https://claude.ai/install.sh",
        };
        yield { type: "finish" };
        return;
      }

      // Build query options
      // Using 'as any' for some options to bypass strict SDK typing
      // since we pass dynamic configs that match the runtime behavior
      const queryOptions = {
        prompt: options.prompt,
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
          ...(options.mcpServers && { mcpServers: options.mcpServers }),
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
                updatedInput: response.updatedInput,
              };
            }
            return { behavior: "allow" as const, updatedInput: toolInput };
          },
          stderr: (data: string) => {
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

      // Run SDK query
      // Cast to any to bypass strict SDK typing - the options are correct at runtime
      const stream = claudeQuery(queryOptions as any);

      // Stream and transform
      for await (const msg of stream) {
        if (abortController.signal.aborted) break;

        // Log raw message
        logRawClaudeMessage(options.chatId, msg);

        // Check for error messages
        const msgAny = msg as any;
        if (msgAny.type === "error" || msgAny.error) {
          const sdkError =
            msgAny.error || msgAny.message || "Unknown SDK error";

          if (
            sdkError === "authentication_failed" ||
            sdkError.includes("authentication")
          ) {
            yield {
              type: "auth-error",
              errorText:
                "Authentication failed - not logged into Claude Code CLI",
            };
          } else {
            yield {
              type: "error",
              errorText: sdkError,
            };
          }
          yield { type: "finish" };
          return;
        }

        // Transform and yield chunks
        for (const chunk of transform(msg)) {
          yield chunk;

          // Notify about file changes
          if (chunk.type === "tool-output-available" && options.onFileChanged) {
            // Check if this was a file operation
            // The tool name is not in output chunk, we'd need to track it
          }
        }
      }
    } catch (error) {
      const err = error as Error;
      yield {
        type: "error",
        errorText: `Claude error: ${err.message}`,
      };
      yield { type: "finish" };
    } finally {
      activeSessions.delete(options.subChatId);
    }
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

  respondToolApproval(
    toolUseId: string,
    decision: { approved: boolean; message?: string; updatedInput?: unknown },
  ): void {
    const pending = pendingToolApprovals.get(toolUseId);
    if (pending) {
      pending.resolve(decision);
      pendingToolApprovals.delete(toolUseId);
    }
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
        }
      } catch {
        // Ignore symlink errors
      }
    } catch {
      // Ignore setup errors
    }
  }
}
