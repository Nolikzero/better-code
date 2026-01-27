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
import type { OpenCodeBinaryResult } from "./types";

// Cache for resolved binary path
let cachedBinaryResult: OpenCodeBinaryResult | null | undefined;

// Cache the shell environment
let cachedShellEnv: Record<string, string> | null = null;

// Delimiter for parsing env output
const DELIMITER = "_OPENCODE_ENV_DELIMITER_";

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
 * Load full shell environment using login shell.
 * This captures PATH, HOME, and all login shell profile configurations.
 * Uses non-interactive mode to avoid triggering macOS TCC folder access prompts.
 * Results are cached for the lifetime of the process.
 */
export function getOpenCodeShellEnvironment(): Record<string, string> {
  if (cachedShellEnv !== null) {
    return { ...cachedShellEnv };
  }

  // On Windows, GUI apps inherit the full environment - no login shell needed
  if (isWindows) {
    const env = getProcessEnvAsRecord();
    console.log(
      `[opencode-env] Loaded ${Object.keys(env).length} environment variables (Windows)`,
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
    console.log(
      `[opencode-env] Loaded ${Object.keys(env).length} environment variables from shell`,
    );
    cachedShellEnv = env;
    return { ...env };
  } catch (error) {
    console.error("[opencode-env] Failed to load shell environment:", error);

    const home = os.homedir();

    // Build fallback PATH
    let fallbackPath = getDefaultFallbackPath();

    // Add node manager bin paths to fallback
    const nodeManagerPaths = getNodeManagerPaths("").map((p) =>
      path.dirname(p),
    );
    if (nodeManagerPaths.length > 0) {
      const sep = isWindows ? ";" : ":";
      fallbackPath = nodeManagerPaths.join(sep) + sep + fallbackPath;
    }

    const fallback: Record<string, string> = {
      HOME: home,
      USER: os.userInfo().username,
      PATH: fallbackPath,
      SHELL: getDefaultShell(),
      TERM: "xterm-256color",
    };

    console.log("[opencode-env] Using fallback environment");
    cachedShellEnv = fallback;
    return { ...fallback };
  }
}

/**
 * Clear cached shell environment (useful for testing)
 */
export function clearOpenCodeEnvCache(): void {
  cachedShellEnv = null;
}

/**
 * Get path to the bundled OpenCode binary (if we choose to bundle it)
 */
function getBundledOpenCodeBinaryPath(): string {
  const isDev = !app.isPackaged;
  const platform = process.platform;
  const arch = process.arch;

  // In dev: resources/bin/{platform}-{arch}/opencode
  // In production: {resourcesPath}/bin/opencode
  const resourcesPath = isDev
    ? path.join(app.getAppPath(), "resources/bin", `${platform}-${arch}`)
    : path.join(process.resourcesPath, "bin");

  const binaryName = platform === "win32" ? "opencode.exe" : "opencode";
  return path.join(resourcesPath, binaryName);
}

/**
 * Get node version manager bin paths (nvm, fnm, volta)
 * These are where npm global packages like opencode are installed
 */
function getNodeManagerPaths(binaryName: string): string[] {
  const home = os.homedir();
  const paths: string[] = [];

  // nvm paths (~/.nvm/versions/node/*/bin)
  const nvmDir = process.env.NVM_DIR || path.join(home, ".nvm");
  const nvmVersionsDir = path.join(nvmDir, "versions", "node");
  try {
    if (fs.existsSync(nvmVersionsDir)) {
      const versions = fs.readdirSync(nvmVersionsDir);
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      paths.push(
        ...versions.map((v) => path.join(nvmVersionsDir, v, "bin", binaryName)),
      );
    }
  } catch {
    // Ignore errors
  }

  // fnm paths (~/.local/share/fnm/node-versions/*/installation/bin)
  const fnmDir =
    process.env.FNM_DIR ||
    path.join(home, ".local", "share", "fnm", "node-versions");
  try {
    if (fs.existsSync(fnmDir)) {
      const versions = fs.readdirSync(fnmDir);
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      paths.push(
        ...versions.map((v) =>
          path.join(fnmDir, v, "installation", "bin", binaryName),
        ),
      );
    }
  } catch {
    // Ignore errors
  }

  // volta paths (~/.volta/bin)
  const voltaBin = path.join(home, ".volta", "bin", binaryName);
  paths.push(voltaBin);

  return paths;
}

/**
 * Get platform-specific system installation paths to check for OpenCode
 */
function getSystemPaths(): string[] {
  const platform = process.platform;
  const home = os.homedir();
  const binaryName = platform === "win32" ? "opencode.exe" : "opencode";

  if (platform === "darwin") {
    return [
      path.join(home, ".local", "bin", binaryName),
      "/opt/homebrew/bin/opencode",
      "/usr/local/bin/opencode",
      // nvm-installed npm global packages
      ...getNodeManagerPaths(binaryName),
    ];
  }

  if (platform === "linux") {
    return [
      path.join(home, ".local", "bin", binaryName),
      "/usr/local/bin/opencode",
      "/snap/bin/opencode",
      // nvm-installed npm global packages
      ...getNodeManagerPaths(binaryName),
    ];
  }

  if (platform === "win32") {
    const userProfile = process.env.USERPROFILE || home;
    return [
      path.join(userProfile, ".local", "bin", binaryName),
      path.join(userProfile, "AppData", "Roaming", "npm", binaryName),
      // nvm-windows paths
      ...getNodeManagerPaths(binaryName),
    ];
  }

  return [];
}

/**
 * Find OpenCode binary in common system installation paths
 */
function findInSystemPaths(): string | null {
  const paths = getSystemPaths();

  for (const p of paths) {
    console.log(`[opencode-binary] Checking system path: ${p}`);
    if (isExecutable(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Find OpenCode in npm global installation
 * Uses interactive login shell to get full PATH including nvm
 */
function findInNpmGlobal(): string | null {
  const platform = process.platform;
  const binaryName = platform === "win32" ? "opencode.cmd" : "opencode";

  try {
    let npmPrefix: string;
    if (isWindows) {
      npmPrefix = execSync("npm prefix -g", {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
      }).trim();
    } else {
      // Run npm prefix -g inside interactive shell to get nvm-managed npm
      const shell = getDefaultShell();
      npmPrefix = execSync(`${shell} -ilc 'npm prefix -g'`, {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
    }

    // Check bin directory
    const binPath =
      platform === "win32"
        ? path.join(npmPrefix, binaryName)
        : path.join(npmPrefix, "bin", binaryName);

    if (isExecutable(binPath)) {
      console.log(`[opencode-binary] Found in npm global: ${binPath}`);
      return binPath;
    }
  } catch {
    // npm not installed or command failed
  }

  return null;
}

/**
 * Find OpenCode binary using PATH lookup (which/where)
 * Uses interactive login shell to get full PATH including nvm/fnm
 */
function findInPath(): string | null {
  const platform = process.platform;
  const binaryName = platform === "win32" ? "opencode.exe" : "opencode";

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
 * Get the OpenCode CLI binary path with fallback detection.
 *
 * Resolution order:
 * 1. Bundled binary (if shipped with app)
 * 2. Common system installation paths
 * 3. npm global installation
 * 4. System PATH lookup (which/where)
 *
 * Results are cached for the lifetime of the process.
 *
 * @returns OpenCodeBinaryResult with path and source, or null if not found
 */
export function getOpenCodeBinaryPath(): OpenCodeBinaryResult | null {
  if (cachedBinaryResult !== undefined) {
    return cachedBinaryResult;
  }

  // Check disk cache
  const diskCached = getCachedBinary("opencode");
  if (diskCached !== undefined) {
    cachedBinaryResult = diskCached as OpenCodeBinaryResult | null;
    return cachedBinaryResult;
  }

  // 1. Try bundled binary first (if we bundle it)
  const bundledPath = getBundledOpenCodeBinaryPath();
  if (isExecutable(bundledPath)) {
    console.log("[opencode-binary] Using bundled binary:", bundledPath);
    cachedBinaryResult = { path: bundledPath, source: "bundled" };
    setCachedBinary("opencode", cachedBinaryResult);
    return cachedBinaryResult;
  }

  console.log(
    "[opencode-binary] Bundled binary not found, checking system paths...",
  );

  // 2. Try common installation paths
  const systemPath = findInSystemPaths();
  if (systemPath) {
    console.log("[opencode-binary] Found in system path:", systemPath);
    cachedBinaryResult = { path: systemPath, source: "system-install" };
    setCachedBinary("opencode", cachedBinaryResult);
    return cachedBinaryResult;
  }

  // 3. Try npm global installation
  const npmGlobalPath = findInNpmGlobal();
  if (npmGlobalPath) {
    console.log("[opencode-binary] Found in npm global:", npmGlobalPath);
    cachedBinaryResult = { path: npmGlobalPath, source: "npm-global" };
    setCachedBinary("opencode", cachedBinaryResult);
    return cachedBinaryResult;
  }

  // 4. Try PATH lookup as last resort
  const pathLookup = findInPath();
  if (pathLookup) {
    console.log("[opencode-binary] Found in PATH:", pathLookup);
    cachedBinaryResult = { path: pathLookup, source: "system-path" };
    setCachedBinary("opencode", cachedBinaryResult);
    return cachedBinaryResult;
  }

  console.error("[opencode-binary] OpenCode CLI not found!");
  console.error("[opencode-binary] Install via: npm install -g opencode");
  cachedBinaryResult = null;
  setCachedBinary("opencode", null);
  return null;
}

/**
 * Clear cached binary path (useful for testing)
 */
export function clearOpenCodeBinaryCache(): void {
  cachedBinaryResult = undefined;
  clearCachedBinary("opencode");
}

/**
 * Build environment variables for OpenCode server process
 */
export function buildOpenCodeEnv(options?: {
  serverPassword?: string;
  customEnv?: Record<string, string>;
}): Record<string, string> {
  const env: Record<string, string> = {};

  // 1. Start with shell environment (has HOME, full PATH, etc.)
  try {
    Object.assign(env, getOpenCodeShellEnvironment());
  } catch (_error) {
    console.error("[opencode-env] Shell env failed, using process.env");
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

  // Ensure critical vars
  if (!env.HOME) env.HOME = os.homedir();
  if (!env.USER) env.USER = os.userInfo().username;
  if (!env.SHELL) env.SHELL = getDefaultShell();
  if (!env.TERM) env.TERM = "xterm-256color";

  // Set server password if provided (for HTTP basic auth)
  if (options?.serverPassword) {
    env.OPENCODE_SERVER_PASSWORD = options.serverPassword;
  }

  // Add custom overrides
  if (options?.customEnv) {
    for (const [key, value] of Object.entries(options.customEnv)) {
      if (value === "") {
        delete env[key];
      } else {
        env[key] = value;
      }
    }
  }

  return env;
}

/**
 * Debug: Log key OpenCode environment variables
 */
export function logOpenCodeEnv(env: Record<string, string>, prefix = ""): void {
  console.log(`${prefix}[opencode-env] HOME: ${env.HOME}`);
  console.log(`${prefix}[opencode-env] USER: ${env.USER}`);
  console.log(
    `${prefix}[opencode-env] OPENCODE_SERVER_PASSWORD: ${env.OPENCODE_SERVER_PASSWORD ? "set" : "not set"}`,
  );
}
