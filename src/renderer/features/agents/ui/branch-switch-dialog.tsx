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

export function BranchSwitchDialog({
  open,
  onOpenChange,
  pendingSwitch,
  isPending,
  onConfirm,
  onCancel,
}: BranchSwitchDialogProps) {
  const actionText =
    pendingSwitch?.action === "send-message"
      ? "Continuing this conversation"
      : "Creating a new chat";

  const buttonText =
    pendingSwitch?.action === "send-message"
      ? "Switch & Send"
      : "Switch & Create";

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
          <AlertDialogTitle>Switch branch?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="px-5 pb-5">
          {actionText} requires switching from{" "}
          <span className="font-medium text-foreground">
            {pendingSwitch?.currentBranch}
          </span>{" "}
          to{" "}
          <span className="font-medium text-foreground">
            {pendingSwitch?.targetBranch}
          </span>
          .
          <br />
          <br />
          Make sure you have committed or stashed any changes before switching.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending} autoFocus>
            {isPending ? "Switching..." : buttonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
