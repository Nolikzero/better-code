import os from "node:os";

export const isWindows = process.platform === "win32";
export const isMac = process.platform === "darwin";
export const isLinux = process.platform === "linux";

/**
 * Returns the default shell for the current platform.
 * Windows: COMSPEC or powershell.exe
 * macOS: SHELL or /bin/zsh
 * Linux: SHELL or /bin/sh
 */
export function getDefaultShell(): string {
  if (isWindows) {
    return process.env.COMSPEC || "powershell.exe";
  }
  if (process.env.SHELL) {
    return process.env.SHELL;
  }
  return isMac ? "/bin/zsh" : "/bin/sh";
}

/**
 * Returns shell arguments to execute a command string.
 * Windows cmd.exe: ["/c", command]
 * Windows PowerShell: ["-NoProfile", "-Command", command]
 * Unix: ["-ilc", command]
 */
export function getShellCommandArgs(shell: string, command: string): string[] {
  if (isWindows) {
    const shellLower = shell.toLowerCase();
    if (shellLower.includes("powershell") || shellLower.includes("pwsh")) {
      return ["-NoProfile", "-Command", command];
    }
    return ["/c", command];
  }
  return ["-ilc", command];
}

/**
 * Returns shell arguments for spawning a login shell that outputs env vars.
 * Windows: null (use process.env directly)
 * Unix: ["-lc", "env"]
 */
export function getShellLoginEnvArgs(): string[] | null {
  if (isWindows) {
    return null;
  }
  return ["-lc", "env"];
}

/**
 * Returns the PATH separator for the current platform.
 */
export function getPathSeparator(): string {
  return isWindows ? ";" : ":";
}

/**
 * Returns a fallback PATH string for the current platform.
 */
export function getDefaultFallbackPath(): string {
  if (isWindows) {
    return process.env.PATH || "";
  }

  const home = os.homedir();
  const paths = [
    `${home}/.local/bin`,
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];

  if (isMac) {
    paths.unshift("/opt/homebrew/bin");
  }

  return paths.join(":");
}

/**
 * Converts process.env to a clean Record<string, string>.
 */
export function getProcessEnvAsRecord(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  return env;
}
