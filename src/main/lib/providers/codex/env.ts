import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { z } from "zod";
import {
  buildCliEnvironment,
  type CliBinaryResult,
  resolveCliBinary,
} from "../cli-runtime";

export type CodexBinaryResult = CliBinaryResult;

const codexAuthSchema = z
  .object({
    OPENAI_API_KEY: z.string().nullish(),
    access_token: z.string().nullish(),
    accessToken: z.string().nullish(),
    token: z.string().nullish(),
    tokens: z
      .object({ access_token: z.string().nullish() })
      .passthrough()
      .optional(),
  })
  .passthrough();

function getBundledCodexBinaryPath(): string {
  const resourcesPath = app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(
        app.getAppPath(),
        "resources",
        "bin",
        `${process.platform}-${process.arch}`,
      );
  return path.join(
    resourcesPath,
    process.platform === "win32" ? "codex.exe" : "codex",
  );
}

function getKnownCodexPaths(): string[] {
  const home = os.homedir();
  const binaryName = process.platform === "win32" ? "codex.exe" : "codex";
  const candidates = [path.join(home, ".local", "bin", binaryName)];
  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/codex", "/usr/local/bin/codex");
  } else if (process.platform === "linux") {
    candidates.push("/usr/local/bin/codex", "/snap/bin/codex");
  }
  return candidates;
}

function getCodexNpmNativeRelativePaths(): string[] {
  if (process.platform !== "win32") return [];
  const platformPackage =
    process.arch === "arm64" ? "codex-win32-arm64" : "codex-win32-x64";
  const target =
    process.arch === "arm64"
      ? "aarch64-pc-windows-msvc"
      : "x86_64-pc-windows-msvc";
  const executable = path.join("vendor", target, "bin", "codex.exe");
  return [
    path.join(
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      platformPackage,
      executable,
    ),
    path.join("@openai", platformPackage, executable),
  ];
}

export function getCodexBinaryPath(): CodexBinaryResult | null {
  const environment = buildCliEnvironment();
  const result = resolveCliBinary({
    id: "codex",
    commandName: "codex",
    environment,
    knownCandidates: getKnownCodexPaths(),
    bundledCandidates: [getBundledCodexBinaryPath()],
    npmNativeRelativePaths: getCodexNpmNativeRelativePaths(),
  });
  if (result) {
    console.log(
      `[codex-binary] 使用真实 CLI：${result.path} (${result.source})`,
    );
  }
  return result;
}

function isApiKey(value: string): boolean {
  return value.startsWith("sk-");
}

function readCodexAuthFiles(): readonly z.infer<typeof codexAuthSchema>[] {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const authFiles = [
    path.join(codexHome, "auth.json"),
    path.join(codexHome, ".credentials.json"),
    path.join(codexHome, "config.json"),
  ];
  const results: z.infer<typeof codexAuthSchema>[] = [];
  for (const authFile of authFiles) {
    try {
      results.push(
        codexAuthSchema.parse(JSON.parse(fs.readFileSync(authFile, "utf8"))),
      );
    } catch (error) {
      if (error instanceof Error) continue;
      throw error;
    }
  }
  return results;
}

export function getCodexApiKey(): string | null {
  if (process.env.OPENAI_API_KEY && isApiKey(process.env.OPENAI_API_KEY)) {
    return process.env.OPENAI_API_KEY;
  }
  for (const auth of readCodexAuthFiles()) {
    if (auth.OPENAI_API_KEY && isApiKey(auth.OPENAI_API_KEY)) {
      return auth.OPENAI_API_KEY;
    }
  }
  return null;
}

export function getCodexOAuthToken(): string | null {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const auth of readCodexAuthFiles()) {
    const token =
      auth.tokens?.access_token ??
      auth.access_token ??
      auth.accessToken ??
      auth.token ??
      auth.OPENAI_API_KEY;
    if (token) return token;
  }
  return null;
}

export function buildCodexEnv(options?: {
  readonly apiKey?: string;
  readonly customEnv?: Readonly<Record<string, string>>;
}): Record<string, string> {
  const environment = buildCliEnvironment();
  if (options?.apiKey) environment.OPENAI_API_KEY = options.apiKey;
  if (options?.customEnv) {
    for (const [key, value] of Object.entries(options.customEnv)) {
      if (value.length === 0) delete environment[key];
      else environment[key] = value;
    }
  }
  return environment;
}

export function logCodexEnv(
  env: Readonly<Record<string, string>>,
  prefix = "",
): void {
  console.log(`${prefix}[codex-env] HOME: ${env.HOME}`);
  console.log(`${prefix}[codex-env] USER: ${env.USER}`);
  console.log(`${prefix}[codex-env] PATH: ${env.PATH}`);
  console.log(
    `${prefix}[codex-env] OPENAI_API_KEY: ${env.OPENAI_API_KEY ? "已设置" : "未设置（使用 CLI OAuth）"}`,
  );
}
