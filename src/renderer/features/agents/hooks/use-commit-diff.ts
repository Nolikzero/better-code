"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { trpcClient } from "../../../lib/trpc";
import { commitDiffDataAtom, refreshDiffTriggerAtom } from "../atoms";
import {
  EMPTY_DIFF_STATS,
  LOADING_DIFF_STATS,
  buildPrefetchList,
  parseDiffAndStats,
  prefetchFileContents,
} from "./use-diff-fetch-core";

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
      diffStats: LOADING_DIFF_STATS,
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
        const { diffStats, parsedFileDiffs } = parseDiffAndStats(rawDiff);

        setCommitDiffData({
          commitHash,
          diffContent: rawDiff,
          parsedFileDiffs,
          diffStats,
          prefetchedFileContents: {},
          isLoading: false,
        });

        // Prefetch file contents for instant diff rendering
        if (worktreePath) {
          const filesToFetch = buildPrefetchList(parsedFileDiffs);
          if (filesToFetch.length > 0) {
            prefetchFileContents(worktreePath, filesToFetch)
              .then((contents) => {
                if (abortRef.current) return;
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
          diffStats: EMPTY_DIFF_STATS,
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
        diffStats: EMPTY_DIFF_STATS,
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
