import TOML from "@iarna/toml";
import { type ChildProcess, spawn } from "child_process";
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
  getCodexBinaryPath,
  getCodexOAuthToken,
  logCodexEnv,
} from "./env";
import { createCodexTransformer } from "./transform";

// Active sessions for cancellation
const activeSessions = new Map<
  string,
  { abortController: AbortController; process?: ChildProcess }
>();

/**
 * Extended options for Codex provider
 */
export interface CodexSessionOptions extends ChatSessionOptions {
  /** Callback to emit stderr from Codex process */
  onStderr?: (data: string) => void;
}

export class CodexProvider implements AIProvider {
  readonly id = "codex" as const;
  readonly config: ProviderConfig = {
    id: "codex",
    name: "OpenAI Codex",
    description: "OpenAI's Codex CLI for code generation",
    models: [
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

  async isAvailable(): Promise<boolean> {
    const result = getCodexBinaryPath();
    return result !== null;
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
   *
   * Codex MCP config structure in TOML:
   * ```toml
   * [mcp_servers.context7]
   * command = "npx"
   * args = ["-y", "@upstash/context7-mcp@1.0.25"]
   * ```
   *
   * Note: Unlike Claude, Codex MCP config is global (not per-project)
   */
  async getProviderConfig(
    _projectPath: string,
  ): Promise<ProviderSpecificConfig | null> {
    try {
      const configPath = path.join(os.homedir(), ".codex", "config.toml");

      // Check if config file exists
      const exists = await fs
        .stat(configPath)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        console.log("[codex] No config.toml found at", configPath);
        return null;
      }

      // Read and parse TOML config
      const content = await fs.readFile(configPath, "utf-8");
      const config = TOML.parse(content) as {
        mcp_servers?: Record<
          string,
          { command: string; args?: string[]; env?: Record<string, string> }
        >;
      };

      // Extract MCP servers if present
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

  async *chat(
    options: CodexSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown> {
    const abortController = options.abortController;
    const session = {
      abortController,
      process: undefined as ChildProcess | undefined,
    };
    activeSessions.set(options.subChatId, session);

    try {
      // Get Codex binary path
      const binaryResult = getCodexBinaryPath();
      if (!binaryResult) {
        yield {
          type: "error",
          errorText:
            "Codex CLI not found. Install via: npm install -g @openai/codex",
        };
        yield { type: "finish" };
        return;
      }

      console.log(
        `[codex] Using ${binaryResult.source} binary: ${binaryResult.path}`,
      );

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

      // Build environment
      const env = buildCodexEnv({ apiKey });

      // Log in dev mode
      if (process.env.NODE_ENV !== "production") {
        logCodexEnv(env, `[${options.subChatId}] `);
      }

      // Build CLI arguments
      const args = this.buildCliArgs(options);
      console.log(`[codex] Running: ${binaryResult.path} ${args.join(" ")}`);

      // Spawn Codex process
      const codexProcess = spawn(binaryResult.path, args, {
        cwd: options.cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      session.process = codexProcess;

      // Handle abort
      abortController.signal.addEventListener("abort", () => {
        if (codexProcess && !codexProcess.killed) {
          codexProcess.kill("SIGTERM");
        }
      });

      // Emit synthetic session-init with MCP config
      // Codex CLI doesn't emit session-init like Claude SDK does, so we synthesize it
      const mcpConfig = await this.getProviderConfig(options.cwd);
      if (
        mcpConfig?.mcpServers &&
        Object.keys(mcpConfig.mcpServers).length > 0
      ) {
        const mcpServers = Object.entries(mcpConfig.mcpServers).map(
          ([name]) => ({
            name,
            // Status will update as tools are discovered during streaming
            // Codex MCP tools appear as mcp__servername__toolname in events
            status: "connected" as const,
          }),
        );

        yield {
          type: "session-init",
          tools: [], // Will be populated as tools are discovered
          mcpServers,
          plugins: [],
          skills: [],
        };

        console.log(
          `[codex] Emitted synthetic session-init with ${mcpServers.length} MCP servers`,
        );
      }

      // Create transformer
      const transform = createCodexTransformer();

      // Buffer for incomplete JSON lines
      let buffer = "";

      // Process stdout as JSON events
      const processStream = async function* (
        stream: NodeJS.ReadableStream,
      ): AsyncGenerator<any> {
        for await (const chunk of stream) {
          buffer += chunk.toString();

          // Split by newlines and process complete JSON objects
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const event = JSON.parse(trimmed);
              yield event;
            } catch {
              // Not JSON, might be plain text output
              console.log(`[codex] Non-JSON output: ${trimmed}`);
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim());
            yield event;
          } catch {
            console.log(`[codex] Final non-JSON output: ${buffer}`);
          }
        }
      };

      // Collect stderr
      const stderrLines: string[] = [];
      codexProcess.stderr?.on("data", (data) => {
        const text = data.toString();
        stderrLines.push(text);
        options.onStderr?.(text);
        console.error("[codex stderr]", text);
      });

      // Process events and transform to UIMessageChunk
      try {
        for await (const event of processStream(codexProcess.stdout!)) {
          if (abortController.signal.aborted) break;

          console.log(
            `[codex] Event: ${event.type}`,
            JSON.stringify(event).slice(0, 200),
          );

          // Transform and yield chunks
          for (const chunk of transform(event)) {
            yield chunk;
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
      }

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        codexProcess.on("close", (code) => {
          console.log(`[codex] Process exited with code ${code}`);
          if (code !== 0 && !abortController.signal.aborted) {
            // Process exited with error, but we may have already emitted the error
            console.error(`[codex] Non-zero exit code: ${code}`);
          }
          resolve();
        });
      });
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
      session.abortController.abort();
      if (session.process && !session.process.killed) {
        session.process.kill("SIGTERM");
      }
      activeSessions.delete(subChatId);
    }
  }

  isActive(subChatId: string): boolean {
    return activeSessions.has(subChatId);
  }

  /**
   * Build CLI arguments for Codex command
   *
   * Uses `codex exec` for non-interactive execution with JSON output.
   * For continuing conversations, uses `codex exec resume <SESSION_ID> <PROMPT>`.
   *
   * IMPORTANT: The `resume` subcommand has LIMITED flags compared to `exec`:
   * - exec: supports --sandbox, --ask-for-approval, --model, --full-auto, --json
   * - exec resume: only supports --model, --full-auto, --json (NO sandbox/approval flags!)
   *
   * See: codex exec --help, codex exec resume --help
   */
  private buildCliArgs(options: ChatSessionOptions): string[] {
    const args: string[] = [];

    // Use exec subcommand for non-interactive JSON output
    args.push("exec");

    // Check if this is a resume (continuing existing session)
    const isResume = !!options.sessionId;

    if (isResume) {
      // Resume subcommand to continue the conversation
      args.push("resume");
      args.push(options.sessionId!);
    }

    // Add model if specified
    if (options.model) {
      args.push("--model", options.model);
    }

    // Sandbox flag is ONLY available for new sessions, not resume!
    if (!isResume) {
      // Sandbox mode configuration (-s, --sandbox)
      // Options: read-only, workspace-write, danger-full-access
      if (options.sandboxMode) {
        args.push("--sandbox", options.sandboxMode);
      } else if (options.mode === "plan") {
        // Plan mode: read-only sandbox prevents file modifications
        args.push("--sandbox", "read-only");
      } else {
        // Agent mode: workspace-write allows modifications within cwd
        args.push("--sandbox", "workspace-write");
      }
    }

    // Approval policy handling for codex exec:
    // - --full-auto: equivalent to approval=on-request + sandbox=workspace-write
    // - --dangerously-bypass-approvals-and-sandbox: skip ALL approvals (dangerous!)
    // - For other policies, we use --full-auto as the closest safe option
    //
    // Note: --ask-for-approval (-a) is only available in interactive mode, not exec mode
    if (
      options.approvalPolicy === "never" &&
      options.sandboxMode === "danger-full-access"
    ) {
      // Only use dangerous bypass when user explicitly wants no approvals AND full access
      args.push("--dangerously-bypass-approvals-and-sandbox");
    } else if (options.mode === "agent") {
      // For agent mode, use --full-auto for automatic execution with safe defaults
      args.push("--full-auto");
    }

    // Reasoning effort via --config (works for both new and resume sessions)
    // Options: low, medium, high
    if (options.reasoningEffort) {
      args.push(
        "--config",
        `model_reasoning_effort="${options.reasoningEffort}"`,
      );
    }

    // Output as JSON events for streaming
    args.push("--json");

    // Add prompt as positional argument at the end
    // New session: codex exec [OPTIONS] [PROMPT]
    // Resume: codex exec resume <SESSION_ID> [OPTIONS] [PROMPT]
    args.push(options.prompt);

    return args;
  }
}
