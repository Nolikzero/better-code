import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { clearCachedBinary } from "../binary-cache";
import {
  buildCliEnvironment,
  type CliBinaryResult,
  resolveCliBinary,
} from "../cli-runtime";

export type OpenCodeBinaryResult = CliBinaryResult;

function getBundledOpenCodeBinaryPath(): string {
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
    process.platform === "win32" ? "opencode.exe" : "opencode",
  );
}

function getKnownOpenCodePaths(): string[] {
  const home = os.homedir();
  const binaryName = process.platform === "win32" ? "opencode.exe" : "opencode";
  const candidates = [
    path.join(home, ".opencode", "bin", binaryName),
    path.join(home, ".local", "bin", binaryName),
  ];
  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/opencode", "/usr/local/bin/opencode");
  } else if (process.platform === "linux") {
    candidates.push("/usr/local/bin/opencode");
  }
  return candidates;
}

function getOpenCodeNpmNativeRelativePaths(): string[] {
  if (process.platform !== "win32") return [];
  const platformPackage =
    process.arch === "arm64"
      ? "opencode-windows-arm64"
      : "opencode-windows-x64";
  const packages = [platformPackage];
  if (process.arch !== "arm64") packages.push("opencode-windows-x64-baseline");

  return [
    path.join("opencode-ai", "bin", "opencode.exe"),
    ...packages.flatMap((packageName) => [
      path.join(
        "opencode-ai",
        "node_modules",
        packageName,
        "bin",
        "opencode.exe",
      ),
      path.join(packageName, "bin", "opencode.exe"),
    ]),
  ];
}

export function getOpenCodeShellEnvironment(): Record<string, string> {
  return buildCliEnvironment();
}

export function clearOpenCodeEnvCache(): void {
  // 兼容旧调用：真实用户环境每次都重新读取，因此不再维护负缓存。
}

export function getOpenCodeBinaryPath(): OpenCodeBinaryResult | null {
  const environment = buildCliEnvironment();
  const result = resolveCliBinary({
    id: "opencode",
    commandName: "opencode",
    environment,
    knownCandidates: getKnownOpenCodePaths(),
    bundledCandidates: [getBundledOpenCodeBinaryPath()],
    npmNativeRelativePaths: getOpenCodeNpmNativeRelativePaths(),
  });

  if (result) {
    console.log(
      `[opencode-binary] 使用真实 CLI：${result.path} (${result.source})`,
    );
  } else {
    console.error(
      "[opencode-binary] 未找到 OpenCode CLI，请运行 npm install -g opencode-ai",
    );
  }
  return result;
}

export function clearOpenCodeBinaryCache(): void {
  clearCachedBinary("opencode");
}

export function buildOpenCodeEnv(options?: {
  readonly serverPassword?: string;
  readonly customEnv?: Readonly<Record<string, string>>;
}): Record<string, string> {
  const environment = buildCliEnvironment();
  if (options?.serverPassword) {
    environment.OPENCODE_SERVER_PASSWORD = options.serverPassword;
  }
  if (options?.customEnv) {
    for (const [key, value] of Object.entries(options.customEnv)) {
      if (value.length === 0) delete environment[key];
      else environment[key] = value;
    }
  }
  return environment;
}

export function logOpenCodeEnv(
  environment: Readonly<Record<string, string>>,
  prefix = "",
): void {
  console.log(`${prefix}[opencode-env] HOME: ${environment.HOME}`);
  console.log(`${prefix}[opencode-env] USER: ${environment.USER}`);
  console.log(`${prefix}[opencode-env] PATH: ${environment.PATH}`);
  console.log(
    `${prefix}[opencode-env] OPENCODE_SERVER_PASSWORD: ${environment.OPENCODE_SERVER_PASSWORD ? "已设置" : "未设置"}`,
  );
}
