import type { GitChangesStatus } from "../../../shared/changes-types";
import { TtlCache } from "../cache/ttl-cache";

/**
 * TTL cache for getStatus results to prevent redundant git subprocess calls.
 * Extracted to a separate module to avoid circular imports between status.ts and file-watcher.ts.
 */
export const STATUS_CACHE_TTL = 1000; // 1 second

const statusCache = new TtlCache<GitChangesStatus>(STATUS_CACHE_TTL);

export function getStatusCache(worktreePath: string): GitChangesStatus | null {
  return statusCache.get(worktreePath);
}

export function setStatusCache(
  worktreePath: string,
  data: GitChangesStatus,
): void {
  statusCache.set(worktreePath, data);
}

/**
 * Clear the status cache for a specific worktree path.
 * Called by file-watcher when git status changes are detected.
 */
export function clearStatusCache(worktreePath: string): void {
  statusCache.delete(worktreePath);
}
