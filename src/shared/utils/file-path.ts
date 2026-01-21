/**
 * File path utilities for normalizing and filtering file paths.
 * Used for consistent path handling across main and renderer processes.
 */

// Default workspace root for desktop app
const DEFAULT_REPO_ROOT = "/workspace";

// Prefixes to strip from file paths for display
const SANDBOX_PREFIXES = ["/project/sandbox/", "/project/"];

// Root directory indicators for fallback path stripping
const ROOT_INDICATORS = ["apps", "packages", "src", "lib", "components"];

/**
 * Convert absolute/sandbox path to display-friendly relative path.
 * Removes prefixes like /workspace/, /project/sandbox/, etc.
 *
 * @param filePath - Full file path (may include sandbox prefixes)
 * @param repoRoot - Optional repository root path to strip
 * @returns Display-friendly relative path
 */
export function toDisplayPath(filePath: string, repoRoot?: string): string {
  if (!filePath) return "";

  // Build prefixes to strip
  const prefixes = [`${repoRoot || DEFAULT_REPO_ROOT}/`, ...SANDBOX_PREFIXES];

  for (const prefix of prefixes) {
    if (filePath.startsWith(prefix)) {
      return filePath.slice(prefix.length);
    }
  }

  // Heuristic: find common root directories
  if (filePath.startsWith("/")) {
    const parts = filePath.split("/");
    const rootIndex = parts.findIndex((p) => ROOT_INDICATORS.includes(p));
    if (rootIndex > 0) {
      return parts.slice(rootIndex).join("/");
    }
  }

  return filePath;
}

/**
 * Check if a file path is a session/internal file that should be excluded from stats.
 * These are app-internal files like plan files, session storage, etc.
 *
 * @param filePath - File path to check
 * @returns True if the file should be excluded from stats
 */
export function isSessionFile(filePath: string): boolean {
  // Exclude files in claude-sessions (plan files stored in app's local storage)
  if (filePath.includes("claude-sessions")) return true;
  // Exclude files in Application Support directory
  if (filePath.includes("Application Support")) return true;
  return false;
}

/**
 * Normalize path for comparison.
 * Handles trailing slashes, multiple slashes, etc.
 *
 * @param filePath - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return "";

  return (
    filePath
      // Remove trailing slash
      .replace(/\/$/, "")
      // Collapse multiple slashes
      .replace(/\/+/g, "/")
      // Remove leading ./ if present
      .replace(/^\.\//, "")
  );
}

/**
 * Extract filename from a path.
 *
 * @param filePath - Full file path
 * @returns Filename (last segment of path)
 */
export function getFileName(filePath: string): string {
  if (!filePath) return "";
  const segments = filePath.split("/");
  return segments[segments.length - 1] || "";
}

/**
 * Extract directory from a path.
 *
 * @param filePath - Full file path
 * @returns Directory path (everything except last segment)
 */
export function getDirectory(filePath: string): string {
  if (!filePath) return "";
  const segments = filePath.split("/");
  segments.pop();
  return segments.join("/");
}
