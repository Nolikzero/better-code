import os from "node:os";
import path from "node:path";
import { app } from "electron";
import {
  buildCliEnvironment,
  type CliBinaryResult,
  resolveCliBinary,
} from "../cli-runtime";

export type ClaudeBinaryResult = CliBinaryResult;

const STRIPPED_ENV_KEYS = [
  "OPENAI_API_KEY",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
] as const;

function getBundledClaudeBinaryPath(): string {
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
    process.platform === "win32" ? "claude.exe" : "claude",
  );
}

function getKnownClaudePaths(): string[] {
  const home = os.homedir();
  const binaryName = process.platform === "win32" ? "claude.exe" : "claude";
  const candidates = [
    path.join(home, ".claude", "bin", binaryName),
    path.join(home, ".local", "bin", binaryName),
  ];
  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/claude", "/usr/local/bin/claude");
  } else if (process.platform === "linux") {
    candidates.push("/usr/local/bin/claude");
  }
  return candidates;
}

export function getClaudeBinaryPath(): ClaudeBinaryResult | null {
  const environment = buildCliEnvironment();
  const result = resolveCliBinary({
    id: "claude",
    commandName: "claude",
    environment,
    knownCandidates: getKnownClaudePaths(),
    bundledCandidates: [getBundledClaudeBinaryPath()],
    npmNativeRelativePaths:
      process.platform === "win32"
        ? [path.join("@anthropic-ai", "claude-code", "bin", "claude.exe")]
        : [],
  });
  if (result) {
    console.log(
      `[claude-binary] 使用真实 CLI：${result.path} (${result.source})`,
    );
  }
  return result;
}

export function buildClaudeEnv(options?: {
  readonly ghToken?: string;
  readonly customEnv?: Readonly<Record<string, string>>;
}): Record<string, string> {
  const environment = buildCliEnvironment();
  for (const key of STRIPPED_ENV_KEYS) delete environment[key];
  if (options?.ghToken) environment.GH_TOKEN = options.ghToken;
  if (options?.customEnv) {
    for (const [key, value] of Object.entries(options.customEnv)) {
      if (value.length === 0) delete environment[key];
      else environment[key] = value;
    }
  }
  environment.CLAUDE_CODE_ENTRYPOINT = "sdk-ts";
  return environment;
}

export function logClaudeEnv(
  env: Readonly<Record<string, string>>,
  prefix = "",
): void {
  console.log(`${prefix}[claude-env] HOME: ${env.HOME}`);
  console.log(`${prefix}[claude-env] USER: ${env.USER}`);
  console.log(`${prefix}[claude-env] PATH: ${env.PATH}`);
  console.log(
    `${prefix}[claude-env] ANTHROPIC_API_KEY: ${env.ANTHROPIC_API_KEY ? "已设置" : "未设置"}`,
  );
}
