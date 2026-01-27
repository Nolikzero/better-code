/**
 * TTL cache for getWorktreeDiff results to prevent redundant git subprocess calls.
 * Keyed by `${worktreePath}:${optionsKey}` to distinguish different diff modes.
 */
import { TtlCache } from "../cache/ttl-cache";

interface DiffCacheEntry {
  diff: string;
  truncated?: boolean;
}

export const DIFF_CACHE_TTL = 1500; // 1.5 seconds

const diffCache = new TtlCache<DiffCacheEntry>(DIFF_CACHE_TTL);

function makeCacheKey(
  worktreePath: string,
  options?: {
    uncommittedOnly?: boolean;
    fullDiff?: boolean;
    skipUntracked?: boolean;
  },
): string {
  const flags = [
    options?.uncommittedOnly ? "u" : "",
    options?.fullDiff ? "f" : "",
    options?.skipUntracked ? "s" : "",
  ].join("");
  return `${worktreePath}:${flags}`;
}

export function getDiffCache(
  worktreePath: string,
  options?: {
    uncommittedOnly?: boolean;
    fullDiff?: boolean;
    skipUntracked?: boolean;
  },
): DiffCacheEntry | null {
  return diffCache.get(makeCacheKey(worktreePath, options));
}

export function setDiffCache(
  worktreePath: string,
  options:
    | { uncommittedOnly?: boolean; fullDiff?: boolean; skipUntracked?: boolean }
    | undefined,
  diff: string,
  truncated?: boolean,
): void {
  diffCache.set(makeCacheKey(worktreePath, options), { diff, truncated });
}

/**
 * Clear all diff cache entries for a specific worktree path.
 * Called by file-watcher when git status changes are detected.
 */
export function clearDiffCache(worktreePath: string): void {
  diffCache.deleteByPrefix(`${worktreePath}:`);
}
