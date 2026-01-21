"use client";

import { AlignJustify } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Kbd } from "../../../components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";

interface AgentsHeaderControlsProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  hasUnseenChanges?: boolean;
  isSubChatsSidebarOpen?: boolean;
}

export function AgentsHeaderControls({
  isSidebarOpen,
  onToggleSidebar,
  hasUnseenChanges = false,
  isSubChatsSidebarOpen: _isSubChatsSidebarOpen = false,
}: AgentsHeaderControlsProps) {
  // Show open button when left sidebar is closed
  if (isSidebarOpen) return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground shrink-0 rounded-md relative"
            aria-label="Open sidebar"
            style={{
              // @ts-expect-error - WebKit-specific property to allow clicks in drag region
              WebkitAppRegion: "no-drag",
            }}
          >
            <AlignJustify className="h-4 w-4" />
            {/* Unseen changes indicator */}
            {hasUnseenChanges && (
              <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#307BD0] ring-2 ring-background" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Open sidebar
          <Kbd>⌘\</Kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
