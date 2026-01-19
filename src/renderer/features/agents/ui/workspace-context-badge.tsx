"use client";

import { GitBranch } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "../../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { cn } from "../../../lib/utils";

interface WorkspaceContextBadgeProps {
  branch?: string | null;
  baseBranch?: string | null;
  worktreePath?: string | null;
  className?: string;
}

/**
 * Workspace Context Badge
 *
 * Shows the current git branch for the chat workspace.
 * Displays a tooltip with full context (branch, base branch, worktree path).
 */
export const WorkspaceContextBadge = memo(function WorkspaceContextBadge({
  branch,
  baseBranch,
  worktreePath,
  className,
}: WorkspaceContextBadgeProps) {
  // Extract just the worktree folder name (last segment after .worktrees/)
  const displayWorktreePath = useMemo(() => {
    if (!worktreePath) return null;
    const worktreesIndex = worktreePath.indexOf(".worktrees/");
    if (worktreesIndex !== -1) {
      return worktreePath.slice(worktreesIndex);
    }
    // Fallback: show the last two path segments
    const parts = worktreePath.split("/").filter(Boolean);
    return parts[parts.length - 1] || worktreePath;
  }, [worktreePath]);

  // Don't render if no branch info
  if (!branch) {
    return null;
  }

  // Truncate long branch names for display
  const displayBranch =
    branch.length > 20 ? `${branch.slice(0, 17)}...` : branch;

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md",
            className,
          )}
          aria-label={`Git branch: ${branch}`}
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{displayBranch}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[300px]">
        <div className="space-y-1">
          <div className="font-medium flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            {branch}
          </div>
          {baseBranch && baseBranch !== branch && (
            <div className="text-xs text-muted-foreground">
              Base: {baseBranch}
            </div>
          )}
          {displayWorktreePath && (
            <div className="text-xs text-muted-foreground font-mono truncate">
              {displayWorktreePath}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
