import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

export const CLI_BINARY_SOURCES = [
  "environment-path",
  "known-install",
  "npm-global",
  "node-manager",
  "bundled",
] as const;

export type CliBinarySource = (typeof CLI_BINARY_SOURCES)[number];

export type CliBinaryResult = {
  readonly path: string;
  readonly source: CliBinarySource;
};

export type CliCommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly error?: string;
};

type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export type CliBinarySpec = {
  readonly id: string;
  readonly commandName: string;
  readonly environment?: EnvironmentInput;
  readonly platform?: NodeJS.Platform;
  readonly knownCandidates?: readonly string[];
  readonly bundledCandidates?: readonly string[];
  readonly npmNativeRelativePaths?: readonly string[];
};

const windowsPathSchema = z.object({
  machine: z.string().nullish(),
  user: z.string().nullish(),
});

const WINDOWS_PATH_SCRIPT = [
  "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
  "$result = @{ machine = [Environment]::GetEnvironmentVariable('Path', 'Machine'); user = [Environment]::GetEnvironmentVariable('Path', 'User') }",
  "$result | ConvertTo-Json -Compress",
].join("; ");

function toEnvironmentRecord(input: EnvironmentInput): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

function splitPath(
  value: string | null | undefined,
  platform: NodeJS.Platform,
): string[] {
  if (!value) return [];
  const separator = platform === "win32" ? ";" : ":";
  return value
    .split(separator)
    .map((entry) => entry.trim().replace(/^"|"$/g, ""))
    .filter((entry) => entry.length > 0);
}

export function mergePathEntries(
  machineEntries: readonly string[],
  userEntries: readonly string[],
  processEntries: readonly string[],
  platform: NodeJS.Platform,
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const entry of [...machineEntries, ...userEntries, ...processEntries]) {
    const normalized = path.normalize(entry);
    const key = platform === "win32" ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }

  return merged;
}

export function buildEnvironmentFromPaths(
  processEnvironment: EnvironmentInput,
  machinePath: string | null | undefined,
  userPath: string | null | undefined,
  platform: NodeJS.Platform,
): Record<string, string> {
  const environment = toEnvironmentRecord(processEnvironment);
  const inheritedPath = environment.Path ?? environment.PATH;
  const mergedPath = mergePathEntries(
    splitPath(machinePath, platform),
    splitPath(userPath, platform),
    splitPath(inheritedPath, platform),
    platform,
  ).join(platform === "win32" ? ";" : ":");

  environment.PATH = mergedPath;
  if (platform === "win32") environment.Path = mergedPath;
  if (!environment.HOME) environment.HOME = os.homedir();
  if (!environment.USERPROFILE && platform === "win32") {
    environment.USERPROFILE = os.homedir();
  }
  if (!environment.USER) environment.USER = os.userInfo().username;
  if (!environment.TERM) environment.TERM = "xterm-256color";
  return environment;
}

function readWindowsRegistryPaths(): {
  readonly machinePath: string | null;
  readonly userPath: string | null;
} {
  try {
    const output = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_PATH_SCRIPT],
      { encoding: "utf8", timeout: 5000, windowsHide: true },
    );
    const parsed = windowsPathSchema.parse(JSON.parse(output));
    return {
      machinePath: parsed.machine ?? null,
      userPath: parsed.user ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[cli-runtime] 无法读取 Windows 用户环境 PATH：${message}`);
    return { machinePath: null, userPath: null };
  }
}

function readUnixLoginEnvironment(
  processEnvironment: EnvironmentInput,
): Record<string, string> | null {
  const shell =
    processEnvironment.SHELL ||
    (process.platform === "darwin" ? "/bin/zsh" : "/bin/sh");
  try {
    const output = execFileSync(shell, ["-ilc", "env -0"], {
      encoding: "utf8",
      timeout: 5000,
      env: toEnvironmentRecord(processEnvironment),
    });
    const environment: Record<string, string> = {};
    for (const entry of output.split("\0")) {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) continue;
      environment[entry.slice(0, separatorIndex)] = entry.slice(
        separatorIndex + 1,
      );
    }
    return environment;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[cli-runtime] 无法读取登录 Shell 环境：${message}`);
    return null;
  }
}

export function buildCliEnvironment(
  overrides?: Readonly<Record<string, string>>,
): Record<string, string> {
  let environment: Record<string, string>;

  if (process.platform === "win32") {
    const registryPaths = readWindowsRegistryPaths();
    environment = buildEnvironmentFromPaths(
      process.env,
      registryPaths.machinePath,
      registryPaths.userPath,
      process.platform,
    );
  } else {
    const loginEnvironment = readUnixLoginEnvironment(process.env);
    environment = {
      ...toEnvironmentRecord(process.env),
      ...(loginEnvironment ?? {}),
    };
    const loginPath = loginEnvironment?.PATH;
    if (loginPath) environment.PATH = loginPath;
  }

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value.length === 0) delete environment[key];
      else environment[key] = value;
    }
  }

  return environment;
}

export function isCliBinaryFile(
  filePath: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return false;
    if (platform !== "win32") {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    }
    return [".exe", ".com", ".cmd", ".bat"].includes(
      path.extname(filePath).toLowerCase(),
    );
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
}

function windowsCommandNames(commandName: string): readonly string[] {
  if (path.extname(commandName)) return [commandName];
  return [
    `${commandName}.exe`,
    `${commandName}.com`,
    `${commandName}.cmd`,
    `${commandName}.bat`,
  ];
}

export function findBinaryInPath(
  commandName: string,
  pathEntries: readonly string[],
  platform: NodeJS.Platform = process.platform,
): string | null {
  const names =
    platform === "win32" ? windowsCommandNames(commandName) : [commandName];
  for (const directory of pathEntries) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (isCliBinaryFile(candidate, platform)) return candidate;
    }
  }
  return null;
}

function uniqueExistingCandidate(
  candidates: readonly string[],
  platform: NodeJS.Platform,
): string | null {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const normalized = path.normalize(candidate);
    const key = platform === "win32" ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isCliBinaryFile(normalized, platform)) return normalized;
  }
  return null;
}

function getNpmNodeModulesRoots(
  environment: EnvironmentInput,
  pathEntries: readonly string[],
  platform: NodeJS.Platform,
): string[] {
  const roots: string[] = [];
  if (platform === "win32") {
    if (environment.APPDATA)
      roots.push(path.join(environment.APPDATA, "npm", "node_modules"));
    for (const directory of pathEntries) {
      if (path.basename(directory).toLowerCase() === "npm") {
        roots.push(path.join(directory, "node_modules"));
      }
    }
  }
  if (environment.NPM_CONFIG_PREFIX) {
    roots.push(path.join(environment.NPM_CONFIG_PREFIX, "lib", "node_modules"));
    roots.push(path.join(environment.NPM_CONFIG_PREFIX, "node_modules"));
  }
  return mergePathEntries(roots, [], [], platform);
}

function resolveNpmNativeBinary(
  relativePaths: readonly string[],
  environment: EnvironmentInput,
  pathEntries: readonly string[],
  platform: NodeJS.Platform,
): string | null {
  const candidates = getNpmNodeModulesRoots(
    environment,
    pathEntries,
    platform,
  ).flatMap((root) =>
    relativePaths.map((relativePath) => path.join(root, relativePath)),
  );
  return uniqueExistingCandidate(candidates, platform);
}

export function resolveCliBinary(spec: CliBinarySpec): CliBinaryResult | null {
  const platform = spec.platform ?? process.platform;
  const environment = spec.environment ?? buildCliEnvironment();
  const pathValue = environment.Path ?? environment.PATH;
  const pathEntries = splitPath(pathValue, platform);
  const npmNativeResult = resolveNpmNativeBinary(
    spec.npmNativeRelativePaths ?? [],
    environment,
    pathEntries,
    platform,
  );

  if (npmNativeResult) return { path: npmNativeResult, source: "npm-global" };

  const pathResult = findBinaryInPath(spec.commandName, pathEntries, platform);
  if (pathResult) return { path: pathResult, source: "environment-path" };

  const knownResult = uniqueExistingCandidate(
    spec.knownCandidates ?? [],
    platform,
  );
  if (knownResult) return { path: knownResult, source: "known-install" };

  const bundledResult = uniqueExistingCandidate(
    spec.bundledCandidates ?? [],
    platform,
  );
  if (bundledResult) return { path: bundledResult, source: "bundled" };

  return null;
}

export function probeCliVersion(
  binary: CliBinaryResult,
  args: readonly string[] = ["--version"],
  environment: EnvironmentInput = buildCliEnvironment(),
): string | null {
  const extension = path.extname(binary.path).toLowerCase();
  if (process.platform === "win32" && [".cmd", ".bat"].includes(extension)) {
    return null;
  }

  try {
    return execFileSync(binary.path, args, {
      encoding: "utf8",
      env: toEnvironmentRecord(environment),
      timeout: 5000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}

export function runCliCommand(
  binary: CliBinaryResult,
  args: readonly string[],
  options?: {
    readonly environment?: EnvironmentInput;
    readonly cwd?: string;
    readonly timeoutMs?: number;
  },
): CliCommandResult {
  const extension = path.extname(binary.path).toLowerCase();
  if (process.platform === "win32" && [".cmd", ".bat"].includes(extension)) {
    throw new Error(`无法直接安全启动 Windows 命令脚本：${binary.path}`);
  }

  const result = spawnSync(binary.path, [...args], {
    encoding: "utf8",
    env: toEnvironmentRecord(options?.environment ?? buildCliEnvironment()),
    cwd: options?.cwd,
    timeout: options?.timeoutMs ?? 10_000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status,
    ...(result.error ? { error: result.error.message } : {}),
  };
}
