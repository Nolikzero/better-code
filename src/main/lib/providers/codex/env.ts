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
import { getCachedBinary, setCachedBinary } from "../binary-cache";

// Cache for resolved binary path
let cachedBinaryResult: CodexBinaryResult | null | undefined;

// Cache the shell environment
let cachedShellEnv: Record<string, string> | null = null;

// Delimiter for parsing env output
const DELIMITER = "_CODEX_ENV_DELIMITER_";

export interface CodexBinaryResult {
  path: string;
  source: "bundled" | "system-path" | "system-install" | "npm-global";
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
 * Get node version manager bin paths (nvm, fnm, volta)
 * These are where npm global packages like codex are installed
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
  } catch {}

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
  } catch {}

  // volta paths (~/.volta/bin)
  const voltaBin = path.join(home, ".volta", "bin", binaryName);
  paths.push(voltaBin);

  return paths;
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
function getCodexShellEnvironment(): Record<string, string> {
  if (cachedShellEnv !== null) {
    return { ...cachedShellEnv };
  }

  // On Windows, GUI apps inherit the full environment - no login shell needed
  if (isWindows) {
    const env = getProcessEnvAsRecord();
    console.log(
      `[codex-env] Loaded ${Object.keys(env).length} environment variables (Windows)`,
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
      `[codex-env] Loaded ${Object.keys(env).length} environment variables from shell`,
    );
    cachedShellEnv = env;
    return { ...env };
  } catch (error) {
    console.error("[codex-env] Failed to load shell environment:", error);

    const home = os.homedir();
    const fallback: Record<string, string> = {
      HOME: home,
      USER: os.userInfo().username,
      PATH: getDefaultFallbackPath(),
      SHELL: getDefaultShell(),
      TERM: "xterm-256color",
    };

    console.log("[codex-env] Using fallback environment");
    cachedShellEnv = fallback;
    return { ...fallback };
  }
}

/**
 * Get path to the bundled Codex binary (if we choose to bundle it)
 */
function getBundledCodexBinaryPath(): string {
  const isDev = !app.isPackaged;
  const platform = process.platform;
  const arch = process.arch;

  // In dev: resources/bin/{platform}-{arch}/codex
  // In production: {resourcesPath}/bin/codex
  const resourcesPath = isDev
    ? path.join(app.getAppPath(), "resources/bin", `${platform}-${arch}`)
    : path.join(process.resourcesPath, "bin");

  const binaryName = platform === "win32" ? "codex.exe" : "codex";
  return path.join(resourcesPath, binaryName);
}

/**
 * Get platform-specific system installation paths to check for Codex
 */
function getSystemPaths(): string[] {
  const platform = process.platform;
  const home = os.homedir();
  const binaryName = platform === "win32" ? "codex.exe" : "codex";

  if (platform === "darwin") {
    return [
      path.join(home, ".local", "bin", binaryName),
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
      // nvm-installed npm global packages
      ...getNodeManagerPaths(binaryName),
    ];
  }

  if (platform === "linux") {
    return [
      path.join(home, ".local", "bin", binaryName),
      "/usr/local/bin/codex",
      "/snap/bin/codex",
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
 * Find Codex binary in common system installation paths
 */
function findInSystemPaths(): string | null {
  const paths = getSystemPaths();

  for (const p of paths) {
    console.log(`[codex-binary] Checking system path: ${p}`);
    if (isExecutable(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Find Codex in npm global installation
 * Uses interactive login shell to get full PATH including nvm
 */
function findInNpmGlobal(): string | null {
  const platform = process.platform;
  const binaryName = platform === "win32" ? "codex.cmd" : "codex";

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
      console.log(`[codex-binary] Found in npm global: ${binPath}`);
      return binPath;
    }
  } catch {
    // npm not installed or command failed
  }

  return null;
}

/**
 * Find Codex binary using PATH lookup (which/where)
 * Uses interactive login shell to get full PATH including nvm/fnm
 */
function findInPath(): string | null {
  const platform = process.platform;
  const binaryName = platform === "win32" ? "codex.exe" : "codex";

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
 * Get the OpenAI Codex CLI binary path with fallback detection.
 *
 * Resolution order:
 * 1. Bundled binary (if shipped with app)
 * 2. Common system installation paths
 * 3. npm global installation
 * 4. System PATH lookup (which/where)
 *
 * Results are cached for the lifetime of the process.
 *
 * @returns CodexBinaryResult with path and source, or null if not found
 */
export function getCodexBinaryPath(): CodexBinaryResult | null {
  if (cachedBinaryResult !== undefined) {
    return cachedBinaryResult;
  }

  // Check disk cache
  const diskCached = getCachedBinary("codex");
  if (diskCached !== undefined) {
    cachedBinaryResult = diskCached as CodexBinaryResult | null;
    return cachedBinaryResult;
  }

  // 1. Try bundled binary first (if we bundle it)
  const bundledPath = getBundledCodexBinaryPath();
  if (isExecutable(bundledPath)) {
    console.log("[codex-binary] Using bundled binary:", bundledPath);
    cachedBinaryResult = { path: bundledPath, source: "bundled" };
    setCachedBinary("codex", cachedBinaryResult);
    return cachedBinaryResult;
  }

  console.log(
    "[codex-binary] Bundled binary not found, checking system paths...",
  );

  // 2. Try common installation paths
  const systemPath = findInSystemPaths();
  if (systemPath) {
    console.log("[codex-binary] Found in system path:", systemPath);
    cachedBinaryResult = { path: systemPath, source: "system-install" };
    setCachedBinary("codex", cachedBinaryResult);
    return cachedBinaryResult;
  }

  // 3. Try npm global installation
  const npmGlobalPath = findInNpmGlobal();
  if (npmGlobalPath) {
    console.log("[codex-binary] Found in npm global:", npmGlobalPath);
    cachedBinaryResult = { path: npmGlobalPath, source: "npm-global" };
    setCachedBinary("codex", cachedBinaryResult);
    return cachedBinaryResult;
  }

  // 4. Try PATH lookup as last resort
  const pathLookup = findInPath();
  if (pathLookup) {
    console.log("[codex-binary] Found in PATH:", pathLookup);
    cachedBinaryResult = { path: pathLookup, source: "system-path" };
    setCachedBinary("codex", cachedBinaryResult);
    return cachedBinaryResult;
  }

  console.error("[codex-binary] OpenAI Codex CLI not found!");
  console.error("[codex-binary] Install via: npm install -g @openai/codex");
  cachedBinaryResult = null;
  setCachedBinary("codex", null);
  return null;
}

/**
 * Check if a string is an OpenAI API key (not an OAuth token)
 */
function isApiKey(value: string): boolean {
  return value.startsWith("sk-");
}

/**
 * Get only the API key (not OAuth tokens).
 * Returns null if user is authenticated via OAuth (the binary will handle auth).
 *
 * Use this when passing credentials to the SDK - OAuth tokens should NOT be
 * passed as OPENAI_API_KEY because the binary handles OAuth auth internally
 * by reading from ~/.codex/auth.json.
 */
export function getCodexApiKey(): string | null {
  // 1. Check environment variable first
  if (process.env.OPENAI_API_KEY && isApiKey(process.env.OPENAI_API_KEY)) {
    console.log("[codex] Found API key in environment");
    return process.env.OPENAI_API_KEY;
  }

  // 2. Try reading from Codex auth.json file
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const authPath = path.join(codexHome, "auth.json");

  try {
    if (fs.existsSync(authPath)) {
      const content = fs.readFileSync(authPath, "utf-8");
      const auth = JSON.parse(content);

      // Only return if it's a real API key
      const apiKey = auth?.OPENAI_API_KEY;
      if (apiKey && isApiKey(apiKey)) {
        console.log("[codex] Found API key in auth.json");
        return apiKey;
      }
    }
  } catch {
    // File not found or parse error
  }

  // No API key found - user likely authenticated via OAuth
  // The binary will handle OAuth auth by reading from ~/.codex/auth.json
  console.log("[codex] No API key found, binary will use OAuth from auth.json");
  return null;
}

/**
 * Check if user has any valid Codex authentication (API key or OAuth token).
 * Used for auth status checks.
 *
 * Codex CLI credential storage:
 * 1. OPENAI_API_KEY environment variable
 * 2. macOS Keychain (service: "openai-codex")
 * 3. ~/.codex/auth.json (file-based storage)
 * 4. ~/.codex/.credentials.json (alternate file location)
 */
export function getCodexOAuthToken(): string | null {
  // 1. Check environment variable first
  if (process.env.OPENAI_API_KEY) {
    console.log("[codex] Found OPENAI_API_KEY in environment");
    return process.env.OPENAI_API_KEY;
  }

  // 2. Try reading from macOS Keychain
  // Codex CLI uses "openai-codex" as the service name
  if (process.platform === "darwin") {
    const keychainServices = ["openai-codex", "codex", "Codex-credentials"];

    for (const service of keychainServices) {
      try {
        const output = execSync(
          `security find-generic-password -s "${service}" -w`,
          { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
        ).trim();

        if (output) {
          // Try parsing as JSON first (might contain structured credentials)
          try {
            const credentials = JSON.parse(output);
            const token =
              credentials?.access_token ||
              credentials?.accessToken ||
              credentials?.api_key;
            if (token) {
              console.log(`[codex] Found OAuth token in keychain (${service})`);
              return token;
            }
          } catch {
            // Not JSON - might be plain API key or token
            if (output.startsWith("sk-") || output.length > 20) {
              console.log(`[codex] Found API key in keychain (${service})`);
              return output;
            }
          }
        }
      } catch {
        // Keychain entry not found for this service, try next
      }
    }
  }

  // 3. Try reading from Codex auth.json file (primary file-based storage)
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const authPaths = [
    path.join(codexHome, "auth.json"),
    path.join(codexHome, ".credentials.json"),
    path.join(codexHome, "config.json"), // Legacy fallback
  ];

  for (const authPath of authPaths) {
    try {
      if (fs.existsSync(authPath)) {
        const content = fs.readFileSync(authPath, "utf-8");
        const auth = JSON.parse(content);

        // Check for API key (but it might be null in auth.json)
        const apiKey = auth?.OPENAI_API_KEY;
        if (apiKey && isApiKey(apiKey)) {
          console.log(`[codex] Found API key in ${path.basename(authPath)}`);
          return apiKey;
        }

        // Check for OAuth tokens (from ChatGPT login)
        const oauthToken =
          auth?.tokens?.access_token ||
          auth?.access_token ||
          auth?.accessToken ||
          auth?.token;

        if (oauthToken) {
          console.log(
            `[codex] Found OAuth token in ${path.basename(authPath)}`,
          );
          return oauthToken;
        }
      }
    } catch {
      // File not found or parse error, try next
    }
  }

  console.log(
    "[codex] No credentials found. Run 'codex login' or set OPENAI_API_KEY",
  );
  return null;
}

/**
 * Build environment variables for Codex SDK subprocess
 */
export function buildCodexEnv(options?: {
  apiKey?: string;
  customEnv?: Record<string, string>;
}): Record<string, string> {
  const env: Record<string, string> = {};

  // 1. Start with shell environment (has HOME, full PATH, etc.)
  try {
    Object.assign(env, getCodexShellEnvironment());
  } catch (_error) {
    console.error("[codex-env] Shell env failed, using process.env");
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

  // Set API key if provided
  if (options?.apiKey) {
    env.OPENAI_API_KEY = options.apiKey;
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
 * Debug: Log key Codex environment variables
 */
export function logCodexEnv(env: Record<string, string>, prefix = ""): void {
  console.log(`${prefix}[codex-env] HOME: ${env.HOME}`);
  console.log(`${prefix}[codex-env] USER: ${env.USER}`);
  console.log(
    `${prefix}[codex-env] OPENAI_API_KEY: ${env.OPENAI_API_KEY ? "set" : "not set"}`,
  );
}
