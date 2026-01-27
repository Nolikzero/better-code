/**
 * Shared utilities for diff fetch hooks.
 * Extracts the common parse → stats → prefetch pipeline
 * used by useDiffManagement, useProjectDiffManagement, etc.
 */
import type { DiffStatsUI, ParsedDiffFile } from "../../../../shared/utils";
import { parseUnifiedDiff } from "../../../../shared/utils";
import { trpcClient } from "../../../lib/trpc";

// Re-export for hooks that need raw parsing without stats
export { parseUnifiedDiff };

const MAX_PREFETCH_FILES = 20;

export interface DiffParseResult {
  diffStats: DiffStatsUI;
  parsedFileDiffs: ParsedDiffFile[];
}

export interface DiffParseAndPrefetchResult extends DiffParseResult {
  prefetchedFileContents: Record<string, string>;
}

/**
 * Parse a raw diff string into file diffs and aggregate stats.
 */
export function parseDiffAndStats(rawDiff: string): DiffParseResult {
  const parsedFileDiffs = parseUnifiedDiff(rawDiff);

  let additions = 0;
  let deletions = 0;
  for (const file of parsedFileDiffs) {
    additions += file.additions;
    deletions += file.deletions;
  }

  return {
    diffStats: {
      fileCount: parsedFileDiffs.length,
      additions,
      deletions,
      isLoading: false,
      hasChanges: additions > 0 || deletions > 0,
    },
    parsedFileDiffs,
  };
}

export const EMPTY_DIFF_STATS: DiffStatsUI = {
  fileCount: 0,
  additions: 0,
  deletions: 0,
  isLoading: false,
  hasChanges: false,
};

export const LOADING_DIFF_STATS: DiffStatsUI = {
  fileCount: 0,
  additions: 0,
  deletions: 0,
  isLoading: true,
  hasChanges: false,
};

/**
 * Build the list of files to prefetch from parsed diffs.
 * Filters out /dev/null entries and limits to MAX_PREFETCH_FILES.
 */
export function buildPrefetchList(
  parsedFiles: ParsedDiffFile[],
): Array<{ key: string; filePath: string }> {
  return parsedFiles
    .slice(0, MAX_PREFETCH_FILES)
    .map((file) => {
      const filePath =
        file.newPath && file.newPath !== "/dev/null"
          ? file.newPath
          : file.oldPath;
      if (!filePath || filePath === "/dev/null") return null;
      return { key: file.key, filePath };
    })
    .filter((f): f is { key: string; filePath: string } => f !== null);
}

/**
 * Prefetch file contents for a list of files via batch IPC call.
 * Returns a record of key → content for successfully read files.
 */
export async function prefetchFileContents(
  worktreePath: string,
  filesToFetch: Array<{ key: string; filePath: string }>,
): Promise<Record<string, string>> {
  if (filesToFetch.length === 0) return {};

  const results = await trpcClient.changes.readMultipleWorkingFiles.query({
    worktreePath,
    files: filesToFetch,
  });

  const contents: Record<string, string> = {};
  for (const [key, result] of Object.entries(results)) {
    if (result.ok) {
      contents[key] = result.content;
    }
  }
  return contents;
}
