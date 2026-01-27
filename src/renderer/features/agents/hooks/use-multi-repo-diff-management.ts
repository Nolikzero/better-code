"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import type { DiffStatsUI } from "../../../../shared/utils";
import { trpc, trpcClient } from "../../../lib/trpc";
import {
  type MultiRepoDiffData,
  type MultiRepoDiffEntry,
  fetchSingleRepoDiffAtom,
  multiRepoDiffDataAtom,
  refreshDiffTriggerAtom,
} from "../atoms";
import { parseUnifiedDiff } from "./use-diff-fetch-core";

export interface UseMultiRepoDiffManagementOptions {
  projectId: string | null;
  projectPath: string | null;
  enabled?: boolean;
}

const STATS_THROTTLE_MS = 5000;

export function useMultiRepoDiffManagement({
  projectId,
  projectPath,
  enabled = true,
}: UseMultiRepoDiffManagementOptions) {
  const [multiRepoDiffData, setMultiRepoDiffData] = useAtom(multiRepoDiffDataAtom);
  const setFetchSingleRepoDiff = useSetAtom(fetchSingleRepoDiffAtom);
  const refreshDiffTrigger = useAtomValue(refreshDiffTriggerAtom);
  const isInitialMountRef = useRef(true);
  const multiRepoDiffDataRef = useRef<MultiRepoDiffData | null>(null);
  multiRepoDiffDataRef.current = multiRepoDiffData;

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const pendingRefetchRef = useRef(false);
  const fetchRef = useRef<(() => Promise<void>) | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const fetchSingleRepoDiffRef = useRef<((relativePath: string) => Promise<void>) | null>(null);

  // Detect repos query
  const { data: repoDetection } = trpc.projects.detectRepos.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && enabled, staleTime: 5 * 60 * 1000 },
  );

  const isMultiRepo = repoDetection?.isMultiRepo ?? false;

  // Subscribe to git status changes via a single watcher on the project root.
  useEffect(() => {
    if (!enabled || !isMultiRepo || !projectPath) return;

    const sub = trpcClient.changes.watchGitStatus.subscribe(
      {
        worktreePath: projectPath,
        subscriberId: `multi-repo-watcher-${projectId}`,
      },
      {
        onData: () => {
          fetchRef.current?.();
        },
      },
    );

    return () => {
      sub.unsubscribe();
    };
  }, [enabled, isMultiRepo, projectPath, projectId]);

  // Build known repos list from detection data
  const buildKnownRepos = useCallback(() => {
    if (!repoDetection || !projectPath) return undefined;
    return [
      ...(repoDetection.isRootRepo
        ? [
            {
              name: projectPath.split("/").pop() || projectPath,
              path: projectPath,
              relativePath: ".",
            },
          ]
        : []),
      ...repoDetection.subRepos,
    ];
  }, [repoDetection, projectPath]);

  // Fetch lightweight stats only (numstat) — used for counters in collapsed headers
  const fetchMultiRepoStats = useCallback(async () => {
    if (!projectId || !projectPath || !enabled || !isMultiRepo) {
      setMultiRepoDiffData(null);
      return;
    }

    const now = Date.now();
    if (now - lastFetchTimeRef.current < STATS_THROTTLE_MS) {
      pendingRefetchRef.current = true;
      return;
    }

    if (isFetchingRef.current) {
      pendingRefetchRef.current = true;
      return;
    }
    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      const knownRepos = buildKnownRepos();

      const result = await trpcClient.projects.getMultiRepoStats.query({
        projectId,
        knownRepos,
      });

      if (!enabledRef.current || projectIdRef.current !== projectId) return;

      const repos = result?.repos;
      if (!repos) {
        setMultiRepoDiffData(null);
        return;
      }

      const entries: MultiRepoDiffEntry[] = [];

      for (const repo of repos) {
        const hasChanges =
          repo.fileCount > 0 || repo.additions > 0 || repo.deletions > 0;
        if (!hasChanges) continue;

        const diffStats: DiffStatsUI = {
          fileCount: repo.fileCount,
          additions: repo.additions,
          deletions: repo.deletions,
          isLoading: false,
          hasChanges: true,
        };

        entries.push({
          name: repo.name,
          path: repo.path,
          relativePath: repo.relativePath,
          diffStats,
          diffContent: null,
          parsedFileDiffs: null,
          prefetchedFileContents: {},
        });
      }

      // Compute expanded repos before the setter to avoid reading a
      // variable mutated inside an async Jotai setter callback.
      const prevData = multiRepoDiffDataRef.current;
      const prevRepos = prevData?.projectId === projectId ? prevData?.repos : [];
      const prevRepoMap = new Map(
        prevRepos?.map((r) => [r.relativePath, r]) ?? [],
      );

      const expandedRelativePaths = entries
        .filter((e) => prevRepoMap.get(e.relativePath)?.parsedFileDiffs)
        .map((e) => e.relativePath);

      setMultiRepoDiffData((prev) => {
        // Only merge with previous data from the same project to avoid
        // stale repos bleeding across project switches
        const pRepos = prev?.projectId === projectId ? prev?.repos : [];
        const pRepoMap = new Map(
          pRepos?.map((r) => [r.relativePath, r]) ?? [],
        );

        const merged = entries.map((entry) => {
          const existing = pRepoMap.get(entry.relativePath);
          if (existing?.parsedFileDiffs) {
            // Keep full diff data for now, update stats
            return { ...existing, diffStats: entry.diffStats };
          }
          return entry;
        });

        return {
          projectId,
          projectPath,
          isMultiRepo: true,
          isRootRepo: repoDetection?.isRootRepo ?? false,
          repos: merged,
        };
      });

      // Refresh full diffs for expanded repos in background
      for (const rp of expandedRelativePaths) {
        fetchSingleRepoDiffRef.current?.(rp);
      }
    } catch (error) {
      console.error("[multi-repo-diff] Failed to fetch stats:", error);
    } finally {
      isFetchingRef.current = false;
      if (pendingRefetchRef.current && enabledRef.current) {
        pendingRefetchRef.current = false;
        const expectedProjectId = projectId;
        setTimeout(() => {
          if (!enabledRef.current || projectIdRef.current !== expectedProjectId) return;
          lastFetchTimeRef.current = 0;
          fetchMultiRepoStats();
        }, 100);
      } else {
        pendingRefetchRef.current = false;
      }
    }
  }, [
    projectId,
    projectPath,
    enabled,
    isMultiRepo,
    repoDetection,
    buildKnownRepos,
    setMultiRepoDiffData,
  ]);

  fetchRef.current = fetchMultiRepoStats;

  // Fetch full diff for a single repo (called when user expands a repo)
  const fetchSingleRepoDiff = useCallback(
    async (relativePath: string) => {
      // Find the repo entry to get its path/name
      const knownRepos = buildKnownRepos();
      const repoInfo = knownRepos?.find((r) => r.relativePath === relativePath);
      if (!repoInfo) return;

      try {
        const result = await trpcClient.projects.getSingleRepoDiff.query({
          repoPath: repoInfo.path,
          repoName: repoInfo.name,
          relativePath: repoInfo.relativePath,
        });

        if (!enabledRef.current) return;

        const rawDiff = result?.diff;
        const parsedFileDiffs = rawDiff?.trim()
          ? parseUnifiedDiff(rawDiff)
          : null;

        // Merge into existing atom data
        setMultiRepoDiffData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            repos: prev.repos.map((r) =>
              r.relativePath === relativePath
                ? { ...r, diffContent: rawDiff ?? null, parsedFileDiffs }
                : r,
            ),
          };
        });
      } catch (error) {
        console.error(
          `[multi-repo-diff] Failed to fetch diff for ${relativePath}:`,
          error,
        );
      }
    },
    [buildKnownRepos, setMultiRepoDiffData],
  );

  fetchSingleRepoDiffRef.current = fetchSingleRepoDiff;

  // Expose fetchSingleRepoDiff via atom so sidebar can call it.
  // Wrap with () => fn because Jotai treats a function arg as an updater.
  useEffect(() => {
    setFetchSingleRepoDiff(() => fetchSingleRepoDiff);
    return () => {
      setFetchSingleRepoDiff(() => null);
    };
  }, [fetchSingleRepoDiff, setFetchSingleRepoDiff]);

  // Fetch on mount / project change
  useEffect(() => {
    // Reset fetch state on project change to avoid stale locks
    isFetchingRef.current = false;
    pendingRefetchRef.current = false;
    lastFetchTimeRef.current = 0;

    if (enabled && projectId && projectPath && isMultiRepo) {
      fetchMultiRepoStats();
    } else {
      setMultiRepoDiffData(null);
    }
    // Clear stale data when project changes
    return () => {
      setMultiRepoDiffData(null);
    };
  }, [
    projectId,
    projectPath,
    enabled,
    isMultiRepo,
    fetchMultiRepoStats,
    setMultiRepoDiffData,
  ]);

  // Refetch on refresh trigger
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (enabled && projectId && projectPath && isMultiRepo) {
      lastFetchTimeRef.current = 0;
      fetchMultiRepoStats();
    }
  }, [
    refreshDiffTrigger,
    enabled,
    projectId,
    projectPath,
    isMultiRepo,
    fetchMultiRepoStats,
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      setMultiRepoDiffData(null);
    };
  }, [setMultiRepoDiffData]);

  return { isMultiRepo, fetchMultiRepoStats, fetchSingleRepoDiff };
}
