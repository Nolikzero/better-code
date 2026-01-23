"use client";

import { useAtom } from "jotai";
import { FileText, GitBranch } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { cn } from "../../../lib/utils";
import { leftSidebarActiveTabAtom } from "../../agents/atoms";

interface LeftSidebarTabsProps {
  changesCount?: number;
}

export function LeftSidebarTabs({ changesCount = 0 }: LeftSidebarTabsProps) {
  const [activeTab, setActiveTab] = useAtom(leftSidebarActiveTabAtom);

  return (
    <div className="px-2 pb-2">
      <div className="relative h-7 p-0.5 flex">
        {/* Sliding background indicator */}
        <div
          className="absolute inset-y-0.5 rounded shadow transition-all duration-200 ease-in-out"
          style={{
            width: "calc(50% - 2px)",
            left: activeTab === "project" ? "2px" : "calc(50%)",
          }}
        />

        {/* Project tab */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActiveTab("project")}
              className={cn(
                "relative z-[2] flex-1 h-full flex items-center justify-center gap-1.5 transition-colors duration-200 rounded text-xs",
                activeTab === "project"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Project</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            Browse project files
          </TooltipContent>
        </Tooltip>

        {/* Changes tab */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setActiveTab("changes")}
              className={cn(
                "relative z-[2] flex-1 h-full flex items-center justify-center gap-1.5 transition-colors duration-200 rounded text-xs",
                activeTab === "changes"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>Changes</span>
              {changesCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                  {changesCount > 99 ? "99+" : changesCount}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            View uncommitted changes
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
