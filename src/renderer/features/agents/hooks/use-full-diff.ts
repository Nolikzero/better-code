"use client";

import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { parseUnifiedDiff } from "../../../../shared/utils";
import { trpcClient } from "../../../lib/trpc";
import { fullDiffDataAtom } from "../atoms";

interface UseFullDiffOptions {
  worktreePath: string | null;
  enabled: boolean;
}

/**
 * Hook to fetch and parse the full diff (committed + uncommitted) against base branch.
 * Only activates when enabled=true.
 */
export function useFullDiff({ worktreePath, enabled }: UseFullDiffOptions) {
  const setFullDiffData = useSetAtom(fullDiffDataAtom);
  const abortRef = useRef(false);

  const fetchFullDiff = useCallback(async () => {
    if (!worktreePath) return;

    abortRef.current = false;

    setFullDiffData({
      diffContent: null,
      parsedFileDiffs: null,
      diffStats: {
        fileCount: 0,
        additions: 0,
        deletions: 0,
        isLoading: true,
        hasChanges: false,
      },
      prefetchedFileContents: {},
      isLoading: true,
    });

    try {
      const result = await trpcClient.changes.getFullDiff.query({
        worktreePath,
      });

      if (abortRef.current) return;

      const rawDiff = result.diff;

      if (rawDiff?.trim()) {
        const parsedFiles = parseUnifiedDiff(rawDiff);

        let additions = 0;
        let deletions = 0;
        for (const file of parsedFiles) {
          additions += file.additions;
          deletions += file.deletions;
        }

        setFullDiffData({
          diffContent: rawDiff,
          parsedFileDiffs: parsedFiles,
          diffStats: {
            fileCount: parsedFiles.length,
            additions,
            deletions,
            isLoading: false,
            hasChanges: parsedFiles.length > 0,
          },
          prefetchedFileContents: {},
          isLoading: false,
        });

        // Prefetch file contents for instant diff rendering
        if (worktreePath && parsedFiles.length > 0) {
          const MAX_PREFETCH = 20;
          const filesToFetch = parsedFiles
            .slice(0, MAX_PREFETCH)
            .map((file) => {
              const filePath =
                file.newPath && file.newPath !== "/dev/null"
                  ? file.newPath
                  : file.oldPath;
              if (!filePath || filePath === "/dev/null") return null;
              return { key: file.key, filePath };
            })
            .filter((f): f is { key: string; filePath: string } => f !== null);

          if (filesToFetch.length > 0) {
            trpcClient.changes.readMultipleWorkingFiles
              .query({ worktreePath, files: filesToFetch })
              .then((results) => {
                if (abortRef.current) return;
                const contents: Record<string, string> = {};
                for (const [key, result] of Object.entries(results)) {
                  if (result.ok) {
                    contents[key] = result.content;
                  }
                }
                setFullDiffData((prev) =>
                  prev ? { ...prev, prefetchedFileContents: contents } : prev,
                );
              })
              .catch(() => {});
          }
        }
      } else {
        setFullDiffData({
          diffContent: null,
          parsedFileDiffs: null,
          diffStats: {
            fileCount: 0,
            additions: 0,
            deletions: 0,
            isLoading: false,
            hasChanges: false,
          },
          prefetchedFileContents: {},
          isLoading: false,
        });
      }
    } catch (err) {
      if (abortRef.current) return;
      console.warn("[useFullDiff] Failed to fetch full diff:", err);
      setFullDiffData({
        diffContent: null,
        parsedFileDiffs: null,
        diffStats: {
          fileCount: 0,
          additions: 0,
          deletions: 0,
          isLoading: false,
          hasChanges: false,
        },
        prefetchedFileContents: {},
        isLoading: false,
      });
    }
  }, [worktreePath, setFullDiffData]);

  useEffect(() => {
    if (enabled) {
      fetchFullDiff();
    }

    return () => {
      abortRef.current = true;
    };
  }, [enabled, fetchFullDiff]);
}
