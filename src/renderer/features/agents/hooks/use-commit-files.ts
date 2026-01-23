"use client";

import { useAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { trpcClient } from "../../../lib/trpc";
import { commitFilesAtomFamily } from "../atoms";

/**
 * Hook for lazy-loading commit files when a commit section is expanded.
 * Uses a cache to avoid refetching files for the same commit.
 *
 * @param worktreePath - Path to the worktree/repo
 * @param commitHash - Full commit hash to fetch files for
 * @param isExpanded - Whether the commit section is currently expanded
 */
export function useCommitFiles(
  worktreePath: string | null,
  commitHash: string,
  isExpanded: boolean,
) {
  const [state, setState] = useAtom(commitFilesAtomFamily(commitHash));
  const isFetchingRef = useRef(false);

  const fetchFiles = useCallback(async () => {
    // Skip if no worktree path, already fetched, already loading, or ref guard
    if (
      !worktreePath ||
      state.hasFetched ||
      state.isLoading ||
      isFetchingRef.current
    ) {
      return;
    }

    isFetchingRef.current = true;
    setState({ ...state, isLoading: true });

    try {
      const files = await trpcClient.changes.getCommitFiles.query({
        worktreePath,
        commitHash,
      });

      setState({
        files,
        isLoading: false,
        hasFetched: true,
        error: undefined,
      });
    } catch (error) {
      setState({
        files: [],
        isLoading: false,
        hasFetched: true,
        error: error instanceof Error ? error.message : "Failed to load files",
      });
    } finally {
      isFetchingRef.current = false;
    }
  }, [worktreePath, commitHash, state, setState]);

  // Auto-fetch when expanded and not yet fetched
  useEffect(() => {
    if (isExpanded && !state.hasFetched && !state.isLoading) {
      fetchFiles();
    }
  }, [isExpanded, state.hasFetched, state.isLoading, fetchFiles]);

  return {
    files: Array.isArray(state.files) ? state.files : [],
    isLoading: state.isLoading,
    error: state.error,
    fetchFiles,
  };
}
