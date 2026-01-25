"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CommitInfo } from "../../../../shared/changes-types";
import {
  type DiffStatsUI,
  type ParsedDiffFile,
  parseUnifiedDiff,
} from "../../../../shared/utils";
import { trpcClient } from "../../../lib/trpc";
import { projectDiffDataAtom, refreshDiffTriggerAtom } from "../atoms";

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
  const [diffStats, setDiffStats] = useState<ProjectDiffStats>({
    fileCount: 0,
    additions: 0,
    deletions: 0,
    isLoading: true,
    hasChanges: false,
  });

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

  // Main fetch function
  const fetchDiffStats = useCallback(async () => {
    if (!projectId || !projectPath || !enabled) {
      setDiffStats({
        fileCount: 0,
        additions: 0,
        deletions: 0,
        isLoading: false,
        hasChanges: false,
      });
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
      const rawDiff = result.diff;

      // Store raw diff
      setDiffContent(rawDiff);

      if (rawDiff?.trim()) {
        // Parse diff to get file list and stats
        const parsedFiles = parseUnifiedDiff(rawDiff);

        // Store parsed files
        setParsedFileDiffs(parsedFiles);

        let additions = 0;
        let deletions = 0;
        for (const file of parsedFiles) {
          additions += file.additions;
          deletions += file.deletions;
        }

        const newDiffStats: ProjectDiffStats = {
          fileCount: parsedFiles.length,
          additions,
          deletions,
          isLoading: false,
          hasChanges: additions > 0 || deletions > 0,
        };
        setDiffStats(newDiffStats);

        // Prefetch file contents for instant diff view opening
        const MAX_PREFETCH_FILES = 20;
        const filesToPrefetch = parsedFiles.slice(0, MAX_PREFETCH_FILES);

        if (filesToPrefetch.length > 0) {
          // Capture current projectId for race condition check
          const currentProjectId = projectId;

          // Build list of files to fetch (filter out /dev/null)
          const filesToFetch = filesToPrefetch
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
            // Single batch IPC call
            trpcClient.changes.readMultipleWorkingFiles
              .query({
                worktreePath: projectPath,
                files: filesToFetch,
              })
              .then((results) => {
                // Check if we're still on the same project
                if (currentProjectId !== projectId) {
                  return;
                }

                const contents: Record<string, string> = {};
                for (const [key, result] of Object.entries(results)) {
                  if (result.ok) {
                    contents[key] = result.content;
                  }
                }
                setPrefetchedFileContents(contents);

                // Update global atom with complete data
                setProjectDiffData({
                  projectId: currentProjectId,
                  projectPath,
                  diffStats: newDiffStats,
                  diffContent: rawDiff,
                  parsedFileDiffs: parsedFiles,
                  prefetchedFileContents: contents,
                  commits: fetchedCommits,
                });
              })
              .catch((err) => {
                console.warn(
                  "[project-diff] Failed to batch prefetch files:",
                  err,
                );
                // Still update atom without prefetched contents
                setProjectDiffData({
                  projectId: currentProjectId,
                  projectPath,
                  diffStats: newDiffStats,
                  diffContent: rawDiff,
                  parsedFileDiffs: parsedFiles,
                  prefetchedFileContents: {},
                  commits: fetchedCommits,
                });
              });
          } else {
            // No files to prefetch, update atom immediately
            setProjectDiffData({
              projectId,
              projectPath,
              diffStats: newDiffStats,
              diffContent: rawDiff,
              parsedFileDiffs: parsedFiles,
              prefetchedFileContents: {},
              commits: fetchedCommits,
            });
          }
        } else {
          // Update atom with empty prefetched contents
          setProjectDiffData({
            projectId,
            projectPath,
            diffStats: newDiffStats,
            diffContent: rawDiff,
            parsedFileDiffs: parsedFiles,
            prefetchedFileContents: {},
            commits: fetchedCommits,
          });
        }
      } else {
        const emptyStats: ProjectDiffStats = {
          fileCount: 0,
          additions: 0,
          deletions: 0,
          isLoading: false,
          hasChanges: false,
        };
        setDiffStats(emptyStats);
        setParsedFileDiffs(null);
        setPrefetchedFileContents({});
        setProjectDiffData({
          projectId,
          projectPath,
          diffStats: emptyStats,
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
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        // Reset throttle and schedule refetch
        setTimeout(() => {
          lastFetchTimeRef.current = 0;
          fetchDiffStats();
        }, 100);
      }
    }
  }, [projectId, projectPath, enabled, setProjectDiffData]);

  // Fetch diff stats on mount and when project changes
  useEffect(() => {
    if (enabled && projectId && projectPath) {
      // Reset throttle on project change
      lastFetchTimeRef.current = 0;
      fetchDiffStats();
    } else {
      // Clear state when disabled or no project
      setDiffStats({
        fileCount: 0,
        additions: 0,
        deletions: 0,
        isLoading: false,
        hasChanges: false,
      });
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
