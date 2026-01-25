import type { GitChangesStatus } from "../../../shared/changes-types";

/**
 * TTL cache for getStatus results to prevent redundant git subprocess calls.
 * Extracted to a separate module to avoid circular imports between status.ts and file-watcher.ts.
 */
const statusCache = new Map<
  string,
  { data: GitChangesStatus; timestamp: number }
>();

export const STATUS_CACHE_TTL = 1000; // 1 second

export function getStatusCache(
  worktreePath: string,
): { data: GitChangesStatus; timestamp: number } | undefined {
  return statusCache.get(worktreePath);
}

export function setStatusCache(
  worktreePath: string,
  data: GitChangesStatus,
): void {
  statusCache.set(worktreePath, { data, timestamp: Date.now() });
}

/**
 * Clear the status cache for a specific worktree path.
 * Called by file-watcher when git status changes are detected.
 */
export function clearStatusCache(worktreePath: string): void {
  statusCache.delete(worktreePath);
}
