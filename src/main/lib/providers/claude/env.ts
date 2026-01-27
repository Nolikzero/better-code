import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import { app } from "electron";
import {
  getDefaultFallbackPath,
  getDefaultShell,
  getProcessEnvAsRecord,
  isWindows,
} from "../../platform";
import { clearCachedBinary, getCachedBinary, setCachedBinary } from "../binary-cache";

// Cache the shell environment
let cachedShellEnv: Record<string, string> | null = null;

// Cache for resolved binary path
let cachedBinaryResult: ClaudeBinaryResult | null | undefined; // undefined = not checked yet

export interface ClaudeBinaryResult {
  path: string;
  source: "bundled" | "system-path" | "system-install";
}

// Delimiter for parsing env output
const DELIMITER = "_CLAUDE_ENV_DELIMITER_";

// Keys to strip (prevent auth interference)
const STRIPPED_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
];

/**
 * Get path to the bundled Claude binary.
 * Returns the path to the native Claude executable bundled with the app.
 */
function getBundledClaudeBinaryPath(): string {
  const isDev = !app.isPackaged;
  const platform = process.platform;
  const arch = process.arch;

  console.log("[claude-binary] ========== BUNDLED BINARY PATH ==========");
  console.log("[claude-binary] isDev:", isDev);
  console.log("[claude-binary] platform:", platform);
  console.log("[claude-binary] arch:", arch);
  console.log("[claude-binary] appPath:", app.getAppPath());

  // In dev: apps/desktop/resources/bin/{platform}-{arch}/claude
  // In production: {resourcesPath}/bin/claude
  const resourcesPath = isDev
    ? path.join(app.getAppPath(), "resources/bin", `${platform}-${arch}`)
    : path.join(process.resourcesPath, "bin");

  console.log("[claude-binary] resourcesPath:", resourcesPath);

  const binaryName = platform === "win32" ? "claude.exe" : "claude";
  const binaryPath = path.join(resourcesPath, binaryName);

  console.log("[claude-binary] binaryPath:", binaryPath);

  // Check if binary exists
  const exists = fs.existsSync(binaryPath);
  console.log("[claude-binary] exists:", exists);

  if (exists) {
    const stats = fs.statSync(binaryPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    const isExecutable = (stats.mode & fs.constants.X_OK) !== 0;
    console.log("[claude-binary] size:", sizeMB, "MB");
    console.log("[claude-binary] isExecutable:", isExecutable);
  } else {
    console.error("[claude-binary] WARNING: Binary not found at path!");
  }

  console.log("[claude-binary] ===========================================");

  return binaryPath;
}

/**
 * Check if a file exists and is executable
 */
function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get platform-specific system installation paths to check
 */
function getSystemPaths(): string[] {
  const platform = process.platform;
  const home = os.homedir();
  const binaryName = platform === "win32" ? "claude.exe" : "claude";

  if (platform === "darwin") {
    return [
      path.join(home, ".claude", "bin", binaryName),
      path.join(home, ".local", "bin", binaryName),
      "/opt/homebrew/bin/claude",
      "/usr/local/bin/claude",
    ];
  }

  if (platform === "linux") {
    return [
      path.join(home, ".claude", "bin", binaryName),
      path.join(home, ".local", "bin", binaryName),
      "/usr/local/bin/claude",
      "/snap/bin/claude",
    ];
  }

  if (platform === "win32") {
    const userProfile = process.env.USERPROFILE || home;
    return [
      path.join(userProfile, ".local", "bin", binaryName),
      path.join(userProfile, ".claude", "bin", binaryName),
    ];
  }

  return [];
}

/**
 * Find Claude binary in common system installation paths
 */
function findInSystemPaths(): string | null {
  const paths = getSystemPaths();

  for (const p of paths) {
    console.log(`[claude-binary] Checking system path: ${p}`);
    if (isExecutable(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Find Claude binary using PATH lookup (which/where)
 * Uses interactive login shell to get full PATH including nvm/fnm
 */
function findInPath(): string | null {
  const platform = process.platform;
  const binaryName = platform === "win32" ? "claude.exe" : "claude";

  try {
    if (platform === "win32") {
      const result = execSync(`where ${binaryName}`, {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      });
      const firstMatch = result.trim().split("\n")[0];
      if (firstMatch && isExecutable(firstMatch)) {
        return firstMatch;
      }
    } else {
      // Run which inside interactive login shell to get full PATH
      const shell = getDefaultShell();
      const result = execSync(`${shell} -ilc 'which ${binaryName}'`, {
        encoding: "utf8",
        timeout: 5000,
      });
      const foundPath = result.trim();
      if (foundPath && isExecutable(foundPath)) {
        return foundPath;
      }
    }
  } catch {
    // Command failed or binary not found
  }

  return null;
}

/**
 * Get the Claude Code binary path with fallback detection.
 *
 * Resolution order:
 * 1. Bundled binary (shipped with app)
 * 2. Common system installation paths
 * 3. System PATH lookup (which/where)
 *
 * Results are cached for the lifetime of the process.
 *
 * @returns ClaudeBinaryResult with path and source, or null if not found
 */
export function getClaudeBinaryPath(): ClaudeBinaryResult | null {
  if (cachedBinaryResult !== undefined) {
    return cachedBinaryResult;
  }

  // Check disk cache
  const diskCached = getCachedBinary("claude");
  if (diskCached !== undefined) {
    cachedBinaryResult = diskCached as ClaudeBinaryResult | null;
    return cachedBinaryResult;
  }

  // 1. Try bundled binary first
  const bundledPath = getBundledClaudeBinaryPath();
  if (isExecutable(bundledPath)) {
    console.log("[claude-binary] Using bundled binary:", bundledPath);
    cachedBinaryResult = { path: bundledPath, source: "bundled" };
    setCachedBinary("claude", cachedBinaryResult);
    return cachedBinaryResult;
  }

  console.log(
    "[claude-binary] Bundled binary not found, checking system paths...",
  );

  // 2. Try common installation paths
  const systemPath = findInSystemPaths();
  if (systemPath) {
    console.log("[claude-binary] Found in system path:", systemPath);
    cachedBinaryResult = { path: systemPath, source: "system-install" };
    setCachedBinary("claude", cachedBinaryResult);
    return cachedBinaryResult;
  }

  // 3. Try PATH lookup as last resort
  const pathLookup = findInPath();
  if (pathLookup) {
    console.log("[claude-binary] Found in PATH:", pathLookup);
    cachedBinaryResult = { path: pathLookup, source: "system-path" };
    setCachedBinary("claude", cachedBinaryResult);
    return cachedBinaryResult;
  }

  console.error("[claude-binary] Claude Code binary not found anywhere!");
  cachedBinaryResult = null;
  setCachedBinary("claude", null);
  return null;
}

/**
 * Clear cached binary path (useful for testing)
 */
function _clearClaudeBinaryCache(): void {
  cachedBinaryResult = undefined;
  clearCachedBinary("claude");
}

/**
 * Parse environment variables from shell output
 */
function parseEnvOutput(output: string): Record<string, string> {
  const envSection = output.split(DELIMITER)[1];
  if (!envSection) return {};

  const env: Record<string, string> = {};
  for (const line of stripVTControlCharacters(envSection)
    .split("\n")
    .filter(Boolean)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex > 0) {
      const key = line.substring(0, separatorIndex);
      const value = line.substring(separatorIndex + 1);
      env[key] = value;
    }
  }
  return env;
}

/**
 * Load full shell environment using login shell (non-interactive).
 * Uses -lc to avoid TCC folder access prompts from interactive shell configs.
 * Results are cached for the lifetime of the process.
 */
function getClaudeShellEnvironment(): Record<string, string> {
  if (cachedShellEnv !== null) {
    return { ...cachedShellEnv };
  }

  // On Windows, GUI apps inherit the full environment - no login shell needed
  if (isWindows) {
    const env = getProcessEnvAsRecord();
    for (const key of STRIPPED_ENV_KEYS) {
      if (key in env) {
        console.log(`[claude-env] Stripped ${key} from environment`);
        delete env[key];
      }
    }
    console.log(
      `[claude-env] Loaded ${Object.keys(env).length} environment variables (Windows)`,
    );
    cachedShellEnv = env;
    return { ...env };
  }

  const shell = getDefaultShell();
  const command = `echo -n "${DELIMITER}"; env; echo -n "${DELIMITER}"; exit`;

  try {
    const output = execSync(`${shell} -ilc '${command}'`, {
      encoding: "utf8",
      timeout: 5000,
      env: {
        // Prevent Oh My Zsh from blocking with auto-update prompts
        DISABLE_AUTO_UPDATE: "true",
        // Minimal env to bootstrap the shell
        HOME: os.homedir(),
        USER: os.userInfo().username,
        SHELL: shell,
      },
    });

    const env = parseEnvOutput(output);

    // Strip keys that could interfere with Claude's auth resolution
    for (const key of STRIPPED_ENV_KEYS) {
      if (key in env) {
        console.log(`[claude-env] Stripped ${key} from shell environment`);
        delete env[key];
      }
    }

    console.log(
      `[claude-env] Loaded ${Object.keys(env).length} environment variables from shell`,
    );
    cachedShellEnv = env;
    return { ...env };
  } catch (error) {
    console.error("[claude-env] Failed to load shell environment:", error);

    // Fallback: return minimal required env
    const home = os.homedir();
    const fallback: Record<string, string> = {
      HOME: home,
      USER: os.userInfo().username,
      PATH: getDefaultFallbackPath(),
      SHELL: getDefaultShell(),
      TERM: "xterm-256color",
    };

    console.log("[claude-env] Using fallback environment");
    cachedShellEnv = fallback;
    return { ...fallback };
  }
}

/**
 * Build the complete environment for Claude SDK.
 * Merges shell environment, process.env, and custom overrides.
 */
export function buildClaudeEnv(options?: {
  ghToken?: string;
  customEnv?: Record<string, string>;
}): Record<string, string> {
  const env: Record<string, string> = {};

  // 1. Start with shell environment (has HOME, full PATH, etc.)
  try {
    Object.assign(env, getClaudeShellEnvironment());
  } catch (_error) {
    console.error("[claude-env] Shell env failed, using process.env");
  }

  // 2. Overlay current process.env (preserves Electron-set vars)
  // BUT: Don't overwrite PATH from shell env - Electron's PATH is minimal when launched from Finder
  const shellPath = env.PATH;
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  // Restore shell PATH if we had one (it contains nvm, homebrew, etc.)
  if (shellPath) {
    env.PATH = shellPath;
  }

  // 3. Ensure critical vars are present
  if (!env.HOME) env.HOME = os.homedir();
  if (!env.USER) env.USER = os.userInfo().username;
  if (!env.SHELL) env.SHELL = getDefaultShell();
  if (!env.TERM) env.TERM = "xterm-256color";

  // 4. Add custom overrides
  if (options?.ghToken) {
    env.GH_TOKEN = options.ghToken;
  }
  if (options?.customEnv) {
    for (const [key, value] of Object.entries(options.customEnv)) {
      if (value === "") {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
  }

  // 5. Mark as SDK entry
  env.CLAUDE_CODE_ENTRYPOINT = "sdk-ts";

  return env;
}

/**
 * Clear cached shell environment (useful for testing)
 */
function _clearClaudeEnvCache(): void {
  cachedShellEnv = null;
}

/**
 * Debug: Log key environment variables
 */
export function logClaudeEnv(env: Record<string, string>, prefix = ""): void {
  console.log(`${prefix}[claude-env] HOME: ${env.HOME}`);
  console.log(`${prefix}[claude-env] USER: ${env.USER}`);
  console.log(
    `${prefix}[claude-env] PATH includes homebrew: ${env.PATH?.includes("/opt/homebrew")}`,
  );
  console.log(
    `${prefix}[claude-env] PATH includes /usr/local/bin: ${env.PATH?.includes("/usr/local/bin")}`,
  );
  console.log(
    `${prefix}[claude-env] ANTHROPIC_AUTH_TOKEN: ${env.ANTHROPIC_AUTH_TOKEN ? "set" : "not set"}`,
  );
}
