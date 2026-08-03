import { type ChildProcess, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { AuthStatus, ProviderConfig, UIMessageChunk } from "@shared/types";
import { probeCliVersion, runCliCommand } from "../cli-runtime";
import type { AIProvider, ChatSessionOptions } from "../types";
import { buildGrokEnv, getGrokBinaryPath, logGrokEnv } from "./env";
import { createGrokTransformer, parseGrokLine } from "./transform";

const activeSessions = new Map<string, ChildProcess>();
const DEFAULT_MODEL = "grok-4.5";

function isAuthFailure(output: string): boolean {
  return /not authenticated|not signed in|not logged in|unauthenticated/i.test(
    output,
  );
}

function getErrorMessage(output: string, fallback: string): string {
  const firstUsefulLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstUsefulLine ?? fallback;
}

export class GrokProvider implements AIProvider {
  readonly id = "grok" as const;
  readonly config: ProviderConfig = {
    id: "grok",
    name: "Grok Build",
    description: "xAI Grok Build 编程智能体",
    models: [
      { id: DEFAULT_MODEL, name: DEFAULT_MODEL, displayName: "Grok 4.5" },
    ],
    authType: "oauth",
    binaryName: "grok",
  };

  async isAvailable(): Promise<boolean> {
    const binary = getGrokBinaryPath();
    return binary !== null && probeCliVersion(binary) !== null;
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const binary = getGrokBinaryPath();
    if (!binary) {
      return { authenticated: false, error: "未找到 Grok Build CLI" };
    }

    const result = runCliCommand(binary, ["models"], {
      environment: buildGrokEnv(),
    });
    const output = `${result.stdout}\n${result.stderr}`.trim();

    if (isAuthFailure(output)) {
      return {
        authenticated: false,
        error:
          "Grok 尚未登录，请运行 grok login；无浏览器环境可运行 grok login --device-code",
      };
    }

    if (result.exitCode === 0 && output.length > 0) {
      return { authenticated: true, method: "oauth" };
    }

    return {
      authenticated: false,
      error: getErrorMessage(output, "Grok 登录状态无法确认"),
    };
  }

  async *chat(
    options: ChatSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown> {
    const binary = getGrokBinaryPath();
    if (!binary) {
      yield { type: "error", errorText: "未找到 Grok Build CLI" };
      yield { type: "finish" };
      return;
    }

    const model = options.model ?? DEFAULT_MODEL;
    const args = [
      "--single",
      options.prompt,
      "--output-format",
      "streaming-json",
      "--cwd",
      options.cwd,
      "--model",
      model,
      "--permission-mode",
      options.mode === "plan" ? "plan" : "default",
    ];
    if (options.sessionId) {
      args.push("--resume", options.sessionId);
    }

    const environment = buildGrokEnv();
    logGrokEnv(environment, "[grok] ");
    const child = spawn(binary.path, args, {
      cwd: options.cwd,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    activeSessions.set(options.subChatId, child);

    let stderr = "";
    let closeCode: number | null = null;
    let spawnError: string | undefined;
    let emittedFinish = false;
    const transformer = createGrokTransformer(model);

    const abortHandler = () => {
      if (!child.killed) child.kill();
    };
    options.abortController.signal.addEventListener("abort", abortHandler, {
      once: true,
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error: Error) => {
      spawnError = error.message;
    });

    const closePromise = new Promise<number | null>((resolve) => {
      child.once("close", (code) => {
        closeCode = code;
        resolve(code);
      });
    });

    try {
      const lines = createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });
      for await (const line of lines) {
        if (options.abortController.signal.aborted) break;
        const event = parseGrokLine(line);
        if (!event) continue;
        for (const chunk of transformer.push(event)) {
          if (chunk.type === "finish") emittedFinish = true;
          yield chunk;
        }
      }

      await closePromise;
      if (!emittedFinish && !options.abortController.signal.aborted) {
        const output = [spawnError, stderr].filter(Boolean).join("\n");
        if (output.length > 0 || closeCode !== 0) {
          const errorText = getErrorMessage(output, "Grok CLI 未返回完整结果");
          yield {
            type: isAuthFailure(output) ? "auth-error" : "error",
            errorText,
          };
        }
        for (const chunk of transformer.finish()) {
          if (chunk.type === "finish") emittedFinish = true;
          yield chunk;
        }
      }
    } catch (error) {
      if (!options.abortController.signal.aborted) {
        const message = error instanceof Error ? error.message : "未知流式错误";
        yield { type: "error", errorText: `Grok 流式响应错误：${message}` };
        for (const chunk of transformer.finish()) yield chunk;
      }
    } finally {
      options.abortController.signal.removeEventListener("abort", abortHandler);
      activeSessions.delete(options.subChatId);
    }
  }

  cancel(subChatId: string): void {
    const child = activeSessions.get(subChatId);
    if (!child) return;
    child.kill();
    activeSessions.delete(subChatId);
  }

  isActive(subChatId: string): boolean {
    return activeSessions.has(subChatId);
  }
}
