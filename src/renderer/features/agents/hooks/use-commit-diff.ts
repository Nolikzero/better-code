"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { parseUnifiedDiff } from "../../../../shared/utils";
import { trpcClient } from "../../../lib/trpc";
import { commitDiffDataAtom, refreshDiffTriggerAtom } from "../atoms";

interface UseCommitDiffOptions {
  worktreePath: string | null;
  commitHash: string | null;
  enabled: boolean;
}

/**
 * Hook to fetch and parse the diff for a single commit.
 * Only activates when enabled=true and commitHash is provided.
 */
export function useCommitDiff({
  worktreePath,
  commitHash,
  enabled,
}: UseCommitDiffOptions) {
  const setCommitDiffData = useSetAtom(commitDiffDataAtom);
  const abortRef = useRef(false);

  // Subscribe to refresh trigger from external components (discard changes, etc.)
  const refreshDiffTrigger = useAtomValue(refreshDiffTriggerAtom);
  const isInitialMountRef = useRef(true);

  const fetchCommitDiff = useCallback(async () => {
    if (!commitHash || !worktreePath) return;

    abortRef.current = false;

    setCommitDiffData({
      commitHash,
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
      const result = await trpcClient.changes.getCommitDiff.query({
        worktreePath,
        commitHash,
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

        setCommitDiffData({
          commitHash,
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
                setCommitDiffData((prev) =>
                  prev && prev.commitHash === commitHash
                    ? { ...prev, prefetchedFileContents: contents }
                    : prev,
                );
              })
              .catch(() => {});
          }
        }
      } else {
        setCommitDiffData({
          commitHash,
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
      console.warn("[useCommitDiff] Failed to fetch commit diff:", err);
      setCommitDiffData({
        commitHash,
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
  }, [commitHash, worktreePath, setCommitDiffData]);

  useEffect(() => {
    if (enabled && commitHash) {
      fetchCommitDiff();
    }

    return () => {
      abortRef.current = true;
    };
  }, [enabled, commitHash, fetchCommitDiff]);

  // Refetch when refresh trigger is incremented (e.g., after discard changes)
  useEffect(() => {
    // Skip the initial mount - the effect above handles that
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (enabled && commitHash) {
      fetchCommitDiff();
    }
  }, [refreshDiffTrigger, enabled, commitHash, fetchCommitDiff]);
}
