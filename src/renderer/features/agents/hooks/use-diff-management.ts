"use client";

import { useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DiffStatsUI,
  type ParsedDiffFile,
  parseUnifiedDiff,
} from "../../../../shared/utils";
import { trpcClient } from "../../../lib/trpc";
import {
  agentsDiffSidebarWidthAtom,
  refreshDiffTriggerAtom,
  subChatFilesAtom,
} from "../atoms";

// Re-export types for backwards compatibility
export type DiffStats = DiffStatsUI;
export type ParsedFileDiff = ParsedDiffFile;

export interface UseDiffManagementOptions {
  chatId: string;
  worktreePath: string | null;
  sandboxId: string | undefined;
  isDiffSidebarOpen: boolean;
}

export interface UseDiffManagementReturn {
  // Diff data
  diffStats: DiffStats;
  diffContent: string | null;
  parsedFileDiffs: ParsedFileDiff[] | null;
  prefetchedFileContents: Record<string, string>;
  // Sidebar width tracking
  diffSidebarWidth: number;
  diffSidebarRef: React.RefObject<HTMLDivElement | null>;
  // Actions
  fetchDiffStats: () => Promise<void>;
  fetchDiffStatsDebounced: () => void;
  // Ref for onFinish callbacks
  fetchDiffStatsRef: React.MutableRefObject<() => void>;
}

const DIFF_THROTTLE_MS = 2000; // Max 1 fetch per 2 seconds

export function useDiffManagement({
  chatId,
  worktreePath,
  sandboxId,
  isDiffSidebarOpen,
}: UseDiffManagementOptions): UseDiffManagementReturn {
  // Diff stats state
  const [diffStats, setDiffStats] = useState<DiffStats>({
    fileCount: 0,
    additions: 0,
    deletions: 0,
    isLoading: true,
    hasChanges: false,
  });

  // Raw diff content to pass to AgentDiffView (avoids double fetch)
  const [diffContent, setDiffContent] = useState<string | null>(null);

  // Pre-parsed file diffs (avoids double parsing in AgentDiffView)
  const [parsedFileDiffs, setParsedFileDiffs] = useState<
    ParsedFileDiff[] | null
  >(null);

  // Prefetched file contents for instant diff view opening
  const [prefetchedFileContents, setPrefetchedFileContents] = useState<
    Record<string, string>
  >({});

  // Track diff sidebar width for responsive header
  const storedDiffSidebarWidth = useAtomValue(agentsDiffSidebarWidthAtom);
  const diffSidebarRef = useRef<HTMLDivElement>(null);
  const [diffSidebarWidth, setDiffSidebarWidth] = useState(
    storedDiffSidebarWidth,
  );

  // Fetch control refs
  const fetchDiffStatsDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingDiffRef = useRef(false);

  // Track changed files across all sub-chats for throttled diff refresh
  const subChatFiles = useAtomValue(subChatFilesAtom);
  // Initialize to Date.now() to prevent double-fetch on mount
  const lastDiffFetchTimeRef = useRef<number>(Date.now());

  // Subscribe to refresh trigger from external components (discard changes, etc.)
  const refreshDiffTrigger = useAtomValue(refreshDiffTriggerAtom);

  // ResizeObserver to track diff sidebar width in real-time
  useEffect(() => {
    if (!isDiffSidebarOpen) {
      return;
    }

    let observer: ResizeObserver | null = null;
    let rafId: number | null = null;

    const checkRef = () => {
      const element = diffSidebarRef.current;
      if (!element) {
        // Retry if ref not ready yet
        rafId = requestAnimationFrame(checkRef);
        return;
      }

      // Set initial width
      setDiffSidebarWidth(element.offsetWidth || storedDiffSidebarWidth);

      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          if (width > 0) {
            setDiffSidebarWidth(width);
          }
        }
      });

      observer.observe(element);
    };

    checkRef();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
    };
  }, [isDiffSidebarOpen, storedDiffSidebarWidth]);

  // Main fetch function
  const fetchDiffStats = useCallback(async () => {
    // Desktop uses worktreePath, web uses sandboxId
    if (!worktreePath && !sandboxId) {
      setDiffStats({
        fileCount: 0,
        additions: 0,
        deletions: 0,
        isLoading: false,
        hasChanges: false,
      });
      setDiffContent(null);
      return;
    }

    // Prevent duplicate parallel fetches
    if (isFetchingDiffRef.current) {
      return;
    }
    isFetchingDiffRef.current = true;

    try {
      let rawDiff: string | null = null;

      // Desktop: use tRPC to get diff from worktree
      if (worktreePath && chatId) {
        const result = await trpcClient.chats.getDiff.query({ chatId });
        rawDiff = result.diff;
      }
      // Web fallback: use sandbox API
      else if (sandboxId) {
        const response = await fetch(`/api/agents/sandbox/${sandboxId}/diff`);
        if (!response.ok) {
          setDiffStats((prev) => ({ ...prev, isLoading: false }));
          return;
        }
        const data = await response.json();
        rawDiff = data.diff || null;
      }

      // Store raw diff for AgentDiffView
      setDiffContent(rawDiff);

      if (rawDiff?.trim()) {
        // Parse diff to get file list and stats
        const parsedFiles = parseUnifiedDiff(rawDiff);

        // Store parsed files to avoid re-parsing in AgentDiffView
        setParsedFileDiffs(parsedFiles);

        let additions = 0;
        let deletions = 0;
        for (const file of parsedFiles) {
          additions += file.additions;
          deletions += file.deletions;
        }

        setDiffStats({
          fileCount: parsedFiles.length,
          additions,
          deletions,
          isLoading: false,
          hasChanges: additions > 0 || deletions > 0,
        });

        // Desktop: prefetch file contents for instant diff view opening
        const MAX_PREFETCH_FILES = 20;
        const filesToPrefetch = parsedFiles.slice(0, MAX_PREFETCH_FILES);

        if (worktreePath && filesToPrefetch.length > 0) {
          // Capture current chatId for race condition check
          const currentChatId = chatId;

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
            // Single batch IPC call instead of multiple individual calls
            trpcClient.changes.readMultipleWorkingFiles
              .query({
                worktreePath,
                files: filesToFetch,
              })
              .then((results) => {
                // Check if we're still on the same chat (prevent race condition)
                if (currentChatId !== chatId) {
                  return;
                }

                const contents: Record<string, string> = {};
                for (const [key, result] of Object.entries(results)) {
                  if (result.ok) {
                    contents[key] = result.content;
                  }
                }
                setPrefetchedFileContents(contents);
              })
              .catch((err) => {
                console.warn("[prefetch] Failed to batch prefetch files:", err);
              });
          }
        }
      } else {
        setDiffStats({
          fileCount: 0,
          additions: 0,
          deletions: 0,
          isLoading: false,
          hasChanges: false,
        });
        setParsedFileDiffs(null);
        setPrefetchedFileContents({});
      }
    } catch {
      setDiffStats((prev) => ({ ...prev, isLoading: false }));
    } finally {
      isFetchingDiffRef.current = false;
    }
  }, [worktreePath, sandboxId, chatId]);

  // Debounced version for calling after stream ends
  const fetchDiffStatsDebounced = useCallback(() => {
    if (fetchDiffStatsDebounceRef.current) {
      clearTimeout(fetchDiffStatsDebounceRef.current);
    }
    fetchDiffStatsDebounceRef.current = setTimeout(() => {
      fetchDiffStats();
    }, 500); // 500ms debounce to avoid spamming if multiple streams end
  }, [fetchDiffStats]);

  // Ref to hold the latest fetchDiffStatsDebounced for use in onFinish callbacks
  const fetchDiffStatsRef = useRef(fetchDiffStatsDebounced);
  useEffect(() => {
    fetchDiffStatsRef.current = fetchDiffStatsDebounced;
  }, [fetchDiffStatsDebounced]);

  // Fetch diff stats on mount and when worktreePath/sandboxId changes
  useEffect(() => {
    fetchDiffStats();
  }, [fetchDiffStats]);

  // Refetch when refresh trigger is incremented (from external components like discard changes)
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    // Skip the initial mount - the effect above handles that
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    // Trigger was incremented, refetch diff
    fetchDiffStats();
  }, [refreshDiffTrigger, fetchDiffStats]);

  // Calculate total file count across all sub-chats for change detection
  const totalSubChatFileCount = useMemo(() => {
    let count = 0;
    subChatFiles.forEach((files) => {
      count += files.length;
    });
    return count;
  }, [subChatFiles]);

  // Throttled refetch when sub-chat files change (agent edits/writes files)
  useEffect(() => {
    // Skip if no files tracked yet (initial state)
    if (totalSubChatFileCount === 0) return;

    const now = Date.now();
    const timeSinceLastFetch = now - lastDiffFetchTimeRef.current;

    if (timeSinceLastFetch >= DIFF_THROTTLE_MS) {
      // Enough time passed, fetch immediately
      lastDiffFetchTimeRef.current = now;
      fetchDiffStats();
    } else {
      // Schedule fetch for when throttle window ends
      const delay = DIFF_THROTTLE_MS - timeSinceLastFetch;
      const timer = setTimeout(() => {
        lastDiffFetchTimeRef.current = Date.now();
        fetchDiffStats();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [totalSubChatFileCount, fetchDiffStats]);

  return {
    diffStats,
    diffContent,
    parsedFileDiffs,
    prefetchedFileContents,
    diffSidebarWidth,
    diffSidebarRef,
    fetchDiffStats,
    fetchDiffStatsDebounced,
    fetchDiffStatsRef,
  };
}
