"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommitInfo } from "../../../../shared/changes-types";
import type { DiffStatsUI, ParsedDiffFile } from "../../../../shared/utils";
import { trpc, trpcClient } from "../../../lib/trpc";
import { projectDiffDataAtom, refreshDiffTriggerAtom } from "../atoms";
import {
  buildPrefetchList,
  EMPTY_DIFF_STATS,
  LOADING_DIFF_STATS,
  parseDiffAndStats,
  prefetchFileContents,
} from "./use-diff-fetch-core";

// Re-export types for convenience
export type ProjectDiffStats = DiffStatsUI;
export type ProjectParsedFileDiff = ParsedDiffFile;
export type { CommitInfo };

export interface UseProjectDiffManagementOptions {
  projectId: string | null;
  projectPath: string | null;
  enabled?: boolean;
}

export interface UseProjectDiffManagementReturn {
  // Diff data
  diffStats: ProjectDiffStats;
  diffContent: string | null;
  parsedFileDiffs: ProjectParsedFileDiff[] | null;
  prefetchedFileContents: Record<string, string>;
  commits: CommitInfo[]; // Commit history for current branch vs default
  // Actions
  fetchDiffStats: () => Promise<void>;
}

const DIFF_THROTTLE_MS = 2000; // Max 1 fetch per 2 seconds

export function useProjectDiffManagement({
  projectId,
  projectPath,
  enabled = true,
}: UseProjectDiffManagementOptions): UseProjectDiffManagementReturn {
  const setProjectDiffData = useSetAtom(projectDiffDataAtom);

  // Subscribe to refresh trigger from external components (commit, discard changes, etc.)
  const refreshDiffTrigger = useAtomValue(refreshDiffTriggerAtom);
  const isInitialMountRef = useRef(true);

  // Diff stats state
  const [diffStats, setDiffStats] =
    useState<ProjectDiffStats>(LOADING_DIFF_STATS);

  // Commit history state
  const [commits, setCommits] = useState<CommitInfo[]>([]);

  // Raw diff content
  const [diffContent, setDiffContent] = useState<string | null>(null);

  // Pre-parsed file diffs
  const [parsedFileDiffs, setParsedFileDiffs] = useState<
    ProjectParsedFileDiff[] | null
  >(null);

  // Prefetched file contents for instant diff view opening
  const [prefetchedFileContents, setPrefetchedFileContents] = useState<
    Record<string, string>
  >({});

  // Fetch control refs
  const isFetchingDiffRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const pendingRefetchRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Ref to hold fetchDiffStats for subscription callback (avoids stale closure)
  const fetchDiffStatsRef = useRef<(() => Promise<void>) | null>(null);

  // Subscribe to git status changes for real-time updates
  const gitWatcherSubscriberId = `project-git-watcher-${projectId}`;
  trpc.changes.watchGitStatus.useSubscription(
    {
      worktreePath: projectPath ?? "",
      subscriberId: gitWatcherSubscriberId,
    },
    {
      enabled: !!projectPath && enabled,
      onData: (_data) => {
        // Reset throttle so git watcher events always trigger an immediate fetch
        lastFetchTimeRef.current = 0;
        fetchDiffStatsRef.current?.();
      },
      onError: (error) => {
        console.error("[useProjectDiffManagement] Git watch error:", error);
      },
    },
  );

  // Main fetch function
  const fetchDiffStats = useCallback(async () => {
    if (!projectId || !projectPath || !enabled) {
      setDiffStats(EMPTY_DIFF_STATS);
      setDiffContent(null);
      setParsedFileDiffs(null);
      setProjectDiffData(null);
      return;
    }

    // Throttle fetches - but queue if throttled
    const now = Date.now();
    if (now - lastFetchTimeRef.current < DIFF_THROTTLE_MS) {
      pendingRefetchRef.current = true;
      return;
    }

    // Prevent duplicate parallel fetches - queue if already fetching
    if (isFetchingDiffRef.current) {
      pendingRefetchRef.current = true;
      return;
    }
    isFetchingDiffRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      // Fetch commit history FIRST so that the subsequent diff call
      // sees any commit that already happened (avoids showing committed
      // changes as uncommitted due to race condition)
      let fetchedCommits: CommitInfo[] = [];
      try {
        const { commits } = await trpcClient.changes.getCommits.query({
          worktreePath: projectPath,
        });
        fetchedCommits = commits;
        setCommits(fetchedCommits);
      } catch (err) {
        console.warn("[project-diff] Failed to fetch commits:", err);
        setCommits([]);
      }

      const result = await trpcClient.projects.getDiff.query({ projectId });

      // Abort if disabled while fetch was in flight
      if (!enabledRef.current) {
        return;
      }

      const rawDiff = result.diff;

      // Store raw diff
      setDiffContent(rawDiff);

      if (rawDiff?.trim()) {
        const { diffStats: newDiffStats, parsedFileDiffs: parsedFiles } =
          parseDiffAndStats(rawDiff);

        setParsedFileDiffs(parsedFiles);
        setDiffStats(newDiffStats);

        const currentProjectId = projectId;
        const filesToFetch = buildPrefetchList(parsedFiles);

        const updateAtom = (contents: Record<string, string>) => {
          setProjectDiffData({
            projectId: currentProjectId,
            projectPath,
            diffStats: newDiffStats,
            diffContent: rawDiff,
            parsedFileDiffs: parsedFiles,
            prefetchedFileContents: contents,
            commits: fetchedCommits,
          });
        };

        if (filesToFetch.length > 0) {
          prefetchFileContents(projectPath, filesToFetch)
            .then((contents) => {
              if (currentProjectId !== projectId) return;
              setPrefetchedFileContents(contents);
              updateAtom(contents);
            })
            .catch((err) => {
              console.warn(
                "[project-diff] Failed to batch prefetch files:",
                err,
              );
              updateAtom({});
            });
        } else {
          updateAtom({});
        }
      } else {
        setDiffStats(EMPTY_DIFF_STATS);
        setParsedFileDiffs(null);
        setPrefetchedFileContents({});
        setProjectDiffData({
          projectId,
          projectPath,
          diffStats: EMPTY_DIFF_STATS,
          diffContent: null,
          parsedFileDiffs: null,
          prefetchedFileContents: {},
          commits: fetchedCommits,
        });
      }
    } catch (error) {
      console.error("[project-diff] Failed to fetch diff:", error);
      setDiffStats((prev) => ({ ...prev, isLoading: false }));
    } finally {
      isFetchingDiffRef.current = false;
      // Process pending refetch if queued during fetch or throttle
      if (pendingRefetchRef.current && enabledRef.current) {
        pendingRefetchRef.current = false;
        setTimeout(() => {
          if (!enabledRef.current) return;
          lastFetchTimeRef.current = 0;
          fetchDiffStats();
        }, 100);
      } else {
        pendingRefetchRef.current = false;
      }
    }
  }, [projectId, projectPath, enabled, setProjectDiffData]);

  // Keep ref updated for subscription callback
  fetchDiffStatsRef.current = fetchDiffStats;

  // Fetch diff stats on mount and when project changes
  useEffect(() => {
    if (enabled && projectId && projectPath) {
      // Reset throttle on project change
      lastFetchTimeRef.current = 0;
      fetchDiffStats();
    } else {
      // Clear state and pending fetches when disabled or no project
      pendingRefetchRef.current = false;
      setDiffStats(EMPTY_DIFF_STATS);
      setDiffContent(null);
      setParsedFileDiffs(null);
      setPrefetchedFileContents({});
      setProjectDiffData(null);
    }
  }, [projectId, projectPath, enabled, fetchDiffStats, setProjectDiffData]);

  // Refetch when refresh trigger is incremented (e.g., after commit)
  useEffect(() => {
    // Skip the initial mount to avoid double-fetch
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (enabled && projectId && projectPath) {
      // Reset throttle and refetch
      lastFetchTimeRef.current = 0;
      fetchDiffStats();
    }
  }, [refreshDiffTrigger, enabled, projectId, projectPath, fetchDiffStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setProjectDiffData(null);
    };
  }, [setProjectDiffData]);

  return {
    diffStats,
    diffContent,
    parsedFileDiffs,
    prefetchedFileContents,
    commits,
    fetchDiffStats,
  };
}
