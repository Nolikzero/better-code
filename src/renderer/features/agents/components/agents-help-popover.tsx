"use client";

import { useSetAtom } from "jotai";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { KeyboardIcon } from "../../../components/ui/icons";
import { agentsShortcutsDialogOpenAtom } from "../../../lib/atoms";

interface AgentsHelpPopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isMobile?: boolean;
}

export function AgentsHelpPopover({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  isMobile = false,
}: AgentsHelpPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const setShortcutsDialogOpen = useSetAtom(agentsShortcutsDialogOpenAtom);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const handleKeyboardShortcutsClick = () => {
    setOpen(false);
    setShortcutsDialogOpen(true);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-36">
        {!isMobile && (
          <DropdownMenuItem
            onClick={handleKeyboardShortcutsClick}
            className="gap-2"
          >
            <KeyboardIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1">Shortcuts</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
