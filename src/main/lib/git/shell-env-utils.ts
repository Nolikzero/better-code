/**
 * Shared shell environment utilities for git operations.
 */
import { getShellEnvironment } from "./shell-env";

/**
 * Build an environment record for git subprocess calls.
 * Inherits process.env and patches PATH from the user's shell environment.
 */
export async function getGitEnv(): Promise<Record<string, string>> {
  const shellEnv = await getShellEnvironment();
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }

  const pathKey = process.platform === "win32" ? "Path" : "PATH";
  if (shellEnv[pathKey]) {
    result[pathKey] = shellEnv[pathKey];
  }

  return result;
}
