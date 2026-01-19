import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../../lib/trpc";

export type BranchSwitchAction = "create-subchat" | "send-message";

export interface PendingBranchSwitch {
  currentBranch: string;
  targetBranch: string;
  action: BranchSwitchAction;
  /** Stored data to use after branch switch (e.g., message parts) */
  payload?: unknown;
}

export interface UseBranchSwitchConfirmationOptions {
  /** Project path for branch operations */
  projectPath: string | null | undefined;
  /** Chat's branch (target branch to switch to) */
  chatBranch: string | null | undefined;
  /** Whether this is worktree mode (if true, no branch switch needed) */
  isWorktreeMode: boolean;
}

export function useBranchSwitchConfirmation(
  options: UseBranchSwitchConfirmationOptions,
) {
  const { projectPath, chatBranch, isWorktreeMode } = options;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] =
    useState<PendingBranchSwitch | null>(null);

  const trpcUtils = trpc.useUtils();

  // Query current branch
  const { data: branchesData } = trpc.changes.getBranches.useQuery(
    { worktreePath: projectPath || "" },
    { enabled: !!projectPath, staleTime: 0 },
  );

  // Mutation for branch checkout
  const checkoutMutation = trpc.changes.checkoutBranch.useMutation({
    onError: (error) => {
      toast.error(error.message || "Failed to switch branch");
    },
    onSuccess: () => {
      trpcUtils.changes.getBranches.invalidate();
    },
  });

  /**
   * Check if branch switch is needed. Returns true if switch is required.
   * If switch is needed, opens the dialog and stores pending action.
   */
  const checkBranchSwitch = useCallback(
    async (action: BranchSwitchAction, payload?: unknown): Promise<boolean> => {
      // No switch needed in worktree mode
      if (isWorktreeMode) return false;

      // No switch needed if no chat branch configured
      if (!chatBranch || !projectPath) return false;

      // Fetch fresh branch data
      let currentBranch = branchesData?.currentBranch;
      try {
        const fresh = await trpcUtils.changes.getBranches.fetch({
          worktreePath: projectPath,
        });
        currentBranch = fresh.currentBranch;
      } catch {}

      // Check if switch is needed
      if (currentBranch && chatBranch !== currentBranch) {
        setPendingSwitch({
          currentBranch,
          targetBranch: chatBranch,
          action,
          payload,
        });
        setDialogOpen(true);
        return true; // Switch needed, dialog shown
      }

      return false; // No switch needed
    },
    [isWorktreeMode, chatBranch, projectPath, branchesData, trpcUtils],
  );

  /**
   * Confirm and perform the branch switch.
   * Returns the payload that was stored, or undefined if switch failed.
   */
  const confirmSwitch = useCallback(async (): Promise<{
    success: boolean;
    payload?: unknown;
  }> => {
    if (!pendingSwitch || !projectPath) {
      return { success: false };
    }

    try {
      await checkoutMutation.mutateAsync({
        projectPath,
        branch: pendingSwitch.targetBranch,
      });

      const payload = pendingSwitch.payload;
      setDialogOpen(false);
      setPendingSwitch(null);

      return { success: true, payload };
    } catch {
      return { success: false };
    }
  }, [pendingSwitch, projectPath, checkoutMutation]);

  /**
   * Cancel the pending branch switch
   */
  const cancelSwitch = useCallback(() => {
    if (!checkoutMutation.isPending) {
      setDialogOpen(false);
      setPendingSwitch(null);
    }
  }, [checkoutMutation.isPending]);

  return {
    dialogOpen,
    setDialogOpen,
    pendingSwitch,
    isPending: checkoutMutation.isPending,
    checkBranchSwitch,
    confirmSwitch,
    cancelSwitch,
  };
}
