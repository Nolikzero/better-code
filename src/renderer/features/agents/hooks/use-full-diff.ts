"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { trpcClient } from "../../../lib/trpc";
import { fullDiffDataAtom, refreshDiffTriggerAtom } from "../atoms";
import {
  EMPTY_DIFF_STATS,
  LOADING_DIFF_STATS,
  buildPrefetchList,
  parseDiffAndStats,
  prefetchFileContents,
} from "./use-diff-fetch-core";

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

  // Subscribe to refresh trigger from external components (discard changes, etc.)
  const refreshDiffTrigger = useAtomValue(refreshDiffTriggerAtom);
  const isInitialMountRef = useRef(true);

  const fetchFullDiff = useCallback(async () => {
    if (!worktreePath) return;

    abortRef.current = false;

    setFullDiffData({
      diffContent: null,
      parsedFileDiffs: null,
      diffStats: LOADING_DIFF_STATS,
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
        const { diffStats, parsedFileDiffs } = parseDiffAndStats(rawDiff);

        setFullDiffData({
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
          diffStats: EMPTY_DIFF_STATS,
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
        diffStats: EMPTY_DIFF_STATS,
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

  // Refetch when refresh trigger is incremented (e.g., after discard changes)
  useEffect(() => {
    // Skip the initial mount - the effect above handles that
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (enabled) {
      fetchFullDiff();
    }
  }, [refreshDiffTrigger, enabled, fetchFullDiff]);
}
