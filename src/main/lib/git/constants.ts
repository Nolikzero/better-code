/**
 * Shared constants for git operations.
 */

/** Git pathspec patterns to exclude lock files from diffs and numstats. */
export const LOCK_FILE_EXCLUDES = [
  ":!*.lock",
  ":!*-lock.*",
  ":!package-lock.json",
  ":!pnpm-lock.yaml",
  ":!yarn.lock",
] as const;

/** Common default branch name candidates, in priority order. */
export const DEFAULT_BRANCH_CANDIDATES = [
  "main",
  "master",
  "develop",
  "trunk",
] as const;

/**
 * Check if a filename matches a lock file pattern.
 * Used to filter untracked files before intent-to-add.
 */
export function isLockFile(filename: string): boolean {
  return (
    filename.endsWith(".lock") ||
    filename.includes("-lock.") ||
    filename === "package-lock.json" ||
    filename === "pnpm-lock.yaml" ||
    filename === "yarn.lock"
  );
}
