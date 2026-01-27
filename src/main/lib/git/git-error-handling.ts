/**
 * Git error types, patterns, and categorization utilities.
 */

/**
 * Error thrown by execFile when the command fails.
 * `code` can be a number (exit code) or string (spawn error like "ENOENT").
 */
export interface ExecFileException extends Error {
  code?: number | string;
  killed?: boolean;
  signal?: NodeJS.Signals;
  cmd?: string;
  stdout?: string;
  stderr?: string;
}

export function isExecFileException(error: unknown): error is ExecFileException {
  return (
    error instanceof Error &&
    ("code" in error || "signal" in error || "killed" in error)
  );
}

/**
 * Git exit codes for ls-remote --exit-code:
 * - 0: Refs found (branch exists)
 * - 2: No matching refs (branch doesn't exist)
 * - 128: Fatal error (auth, network, invalid repo, etc.)
 */
export const GIT_EXIT_CODES = {
  SUCCESS: 0,
  NO_MATCHING_REFS: 2,
  FATAL_ERROR: 128,
} as const;

/**
 * Patterns for categorizing git fatal errors (exit code 128).
 * These are checked against lowercase error messages/stderr.
 */
export const GIT_ERROR_PATTERNS = {
  network: [
    "could not resolve host",
    "unable to access",
    "connection refused",
    "network is unreachable",
    "timed out",
    "ssl",
    "could not read from remote",
  ],
  auth: [
    "authentication",
    "permission denied",
    "403",
    "401",
    // SSH-specific auth failures
    "permission denied (publickey)",
    "host key verification failed",
  ],
  remoteNotConfigured: [
    "does not appear to be a git repository",
    "no such remote",
    "repository not found",
    "remote origin not found",
  ],
} as const;

export type BranchExistsResult =
  | { status: "exists" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function categorizeGitError(errorMessage: string): BranchExistsResult {
  const lowerMessage = errorMessage.toLowerCase();

  if (GIT_ERROR_PATTERNS.network.some((p) => lowerMessage.includes(p))) {
    return {
      status: "error",
      message: "Cannot connect to remote. Check your network connection.",
    };
  }

  if (GIT_ERROR_PATTERNS.auth.some((p) => lowerMessage.includes(p))) {
    return {
      status: "error",
      message: "Authentication failed. Check your Git credentials.",
    };
  }

  if (
    GIT_ERROR_PATTERNS.remoteNotConfigured.some((p) => lowerMessage.includes(p))
  ) {
    return {
      status: "error",
      message:
        "Remote 'origin' is not configured or the repository was not found.",
    };
  }

  return {
    status: "error",
    message: `Failed to verify branch: ${errorMessage}`,
  };
}

/**
 * Sanitizes git error messages for user display.
 * Strips "fatal:" prefixes, excessive newlines, and other git plumbing text.
 */
export function sanitizeGitError(message: string): string {
  return message
    .replace(/^fatal:\s*/i, "")
    .replace(/^error:\s*/i, "")
    .replace(/\n+/g, " ")
    .trim();
}

export function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
