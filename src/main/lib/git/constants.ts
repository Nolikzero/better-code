/**
 * Shared constants for git operations.
 */

/** Git pathspec patterns to exclude noisy files from diffs and numstats. */
export const DIFF_EXCLUDES = [
  ":!*.lock",
  ":!*-lock.*",
  ":!package-lock.json",
  ":!pnpm-lock.yaml",
  ":!yarn.lock",
  ":!.DS_Store",
  ":!**/.DS_Store",
] as const;

/** Common default branch name candidates, in priority order. */
export const DEFAULT_BRANCH_CANDIDATES = [
  "main",
  "master",
  "develop",
  "trunk",
] as const;

/**
 * Check if a file should be excluded from diffs.
 * Used to filter untracked files before intent-to-add.
 */
export function isExcludedFile(filename: string): boolean {
  const basename = filename.split("/").pop() ?? filename;
  return (
    basename === ".DS_Store" ||
    filename.endsWith(".lock") ||
    filename.includes("-lock.") ||
    filename === "package-lock.json" ||
    filename === "pnpm-lock.yaml" ||
    filename === "yarn.lock"
  );
}
