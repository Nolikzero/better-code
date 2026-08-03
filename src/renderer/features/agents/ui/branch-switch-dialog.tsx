import { memo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import type { PendingBranchSwitch } from "../hooks/use-branch-switch-confirmation";

interface BranchSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingSwitch: PendingBranchSwitch | null;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BranchSwitchDialog = memo(function BranchSwitchDialog({
  open,
  onOpenChange,
  pendingSwitch,
  isPending,
  onConfirm,
  onCancel,
}: BranchSwitchDialogProps) {
  const actionText =
    pendingSwitch?.action === "send-message" ? "继续此对话" : "正在新建对话";

  const buttonText =
    pendingSwitch?.action === "send-message" ? "切换并发送" : "切换并创建";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isPending) {
          onOpenChange(isOpen);
          if (!isOpen) onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>切换分支？</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="px-5 pb-5">
          {actionText} 需要将分支从{" "}
          <span className="font-medium text-foreground">
            {pendingSwitch?.currentBranch}
          </span>{" "}
          切换到{" "}
          <span className="font-medium text-foreground">
            {pendingSwitch?.targetBranch}
          </span>
          。
          <br />
          <br />
          切换前请确保已提交或暂存所有更改。
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={onCancel}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending} autoFocus>
            {isPending ? "正在切换…" : buttonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
