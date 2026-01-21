"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { trpcClient } from "../../../lib/trpc";
import {
  commitMessageAtom,
  deselectAllDiffFilesAtom,
  gitActionsLoadingAtom,
  hasStashAtom,
  selectedDiffFilesAtom,
} from "../atoms";

export interface UseGitActionsOptions {
  chatId: string;
  worktreePath: string | null;
  onSuccess?: () => void; // Called after successful git operations to refresh diff
}

export interface UseGitActionsReturn {
  // State
  selectedFiles: Set<string>;
  commitMessage: string;
  setCommitMessage: (message: string) => void;
  hasStash: boolean;
  isCommitting: boolean;
  isStashing: boolean;
  isUnstashing: boolean;
  isPushing: boolean;
  isAnyLoading: boolean;

  // Actions
  handleCommit: () => Promise<void>;
  handleStash: () => Promise<void>;
  handleUnstash: () => Promise<void>;
  handlePush: () => Promise<void>;

  // Helpers
  refreshStashStatus: () => Promise<void>;
}

export function useGitActions({
  chatId: _chatId,
  worktreePath,
  onSuccess,
}: UseGitActionsOptions): UseGitActionsReturn {
  // State atoms
  const selectedFiles = useAtomValue(selectedDiffFilesAtom);
  const deselectAll = useSetAtom(deselectAllDiffFilesAtom);
  const [commitMessage, setCommitMessage] = useAtom(commitMessageAtom);
  const [loadingState, setLoadingState] = useAtom(gitActionsLoadingAtom);
  const [hasStash, setHasStash] = useAtom(hasStashAtom);

  const isAnyLoading =
    loadingState.isCommitting ||
    loadingState.isStashing ||
    loadingState.isUnstashing ||
    loadingState.isPushing;

  // Refresh stash status
  const refreshStashStatus = useCallback(async () => {
    if (!worktreePath) return;
    try {
      const result = await trpcClient.changes.hasStash.query({ worktreePath });
      setHasStash(result.hasStash);
    } catch {
      // Silently fail - stash status is not critical
    }
  }, [worktreePath, setHasStash]);

  // Check stash status on mount and when worktreePath changes
  useEffect(() => {
    refreshStashStatus();
  }, [refreshStashStatus]);

  // Commit handler
  const handleCommit = useCallback(async () => {
    if (!worktreePath) {
      toast.error("No worktree path available", { position: "top-center" });
      return;
    }

    if (!commitMessage.trim()) {
      toast.error("Please enter a commit message", { position: "top-center" });
      return;
    }

    setLoadingState((prev) => ({ ...prev, isCommitting: true }));

    try {
      if (selectedFiles.size > 0) {
        // Commit only selected files
        await trpcClient.changes.commitSelected.mutate({
          worktreePath,
          files: Array.from(selectedFiles),
          message: commitMessage.trim(),
        });
        toast.success(`Committed ${selectedFiles.size} file(s)`, {
          position: "top-center",
        });
      } else {
        // Stage all and commit
        await trpcClient.changes.stageAll.mutate({ worktreePath });
        await trpcClient.changes.commit.mutate({
          worktreePath,
          message: commitMessage.trim(),
        });
        toast.success("Committed all changes", { position: "top-center" });
      }

      // Clear state after successful commit
      setCommitMessage("");
      deselectAll();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to commit", {
        position: "top-center",
      });
    } finally {
      setLoadingState((prev) => ({ ...prev, isCommitting: false }));
    }
  }, [
    worktreePath,
    commitMessage,
    selectedFiles,
    setCommitMessage,
    deselectAll,
    setLoadingState,
    onSuccess,
  ]);

  // Stash handler
  const handleStash = useCallback(async () => {
    if (!worktreePath) {
      toast.error("No worktree path available", { position: "top-center" });
      return;
    }

    setLoadingState((prev) => ({ ...prev, isStashing: true }));

    try {
      await trpcClient.changes.stash.mutate({
        worktreePath,
        message: commitMessage.trim() || undefined,
      });
      toast.success("Changes stashed", { position: "top-center" });

      // Clear state after successful stash
      setCommitMessage("");
      deselectAll();
      await refreshStashStatus();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to stash changes",
        { position: "top-center" },
      );
    } finally {
      setLoadingState((prev) => ({ ...prev, isStashing: false }));
    }
  }, [
    worktreePath,
    commitMessage,
    setCommitMessage,
    deselectAll,
    setLoadingState,
    refreshStashStatus,
    onSuccess,
  ]);

  // Unstash (pop) handler
  const handleUnstash = useCallback(async () => {
    if (!worktreePath) {
      toast.error("No worktree path available", { position: "top-center" });
      return;
    }

    setLoadingState((prev) => ({ ...prev, isUnstashing: true }));

    try {
      await trpcClient.changes.stashPop.mutate({ worktreePath });
      toast.success("Stash applied", { position: "top-center" });

      await refreshStashStatus();
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply stash",
        { position: "top-center" },
      );
    } finally {
      setLoadingState((prev) => ({ ...prev, isUnstashing: false }));
    }
  }, [worktreePath, setLoadingState, refreshStashStatus, onSuccess]);

  // Push handler
  const handlePush = useCallback(async () => {
    if (!worktreePath) {
      toast.error("No worktree path available", { position: "top-center" });
      return;
    }

    setLoadingState((prev) => ({ ...prev, isPushing: true }));

    try {
      await trpcClient.changes.push.mutate({
        worktreePath,
        setUpstream: true,
      });
      toast.success("Pushed to remote", { position: "top-center" });
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to push", {
        position: "top-center",
      });
    } finally {
      setLoadingState((prev) => ({ ...prev, isPushing: false }));
    }
  }, [worktreePath, setLoadingState, onSuccess]);

  return {
    // State
    selectedFiles,
    commitMessage,
    setCommitMessage,
    hasStash,
    isCommitting: loadingState.isCommitting,
    isStashing: loadingState.isStashing,
    isUnstashing: loadingState.isUnstashing,
    isPushing: loadingState.isPushing,
    isAnyLoading,

    // Actions
    handleCommit,
    handleStash,
    handleUnstash,
    handlePush,

    // Helpers
    refreshStashStatus,
  };
}
