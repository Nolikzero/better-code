import { FolderGit2, Trash2 } from "lucide-react";
import React from "react";
import { LoadingDot } from "../../../components/ui/icons";
import { cn } from "../../../lib/utils";

interface SubchatInlineItemProps {
  id: string;
  name: string | null;
  mode: "agent" | "plan";
  isActive: boolean;
  isLoading: boolean;
  hasUnseenChanges?: boolean;
  hasPendingPlan?: boolean;
  hasPendingQuestion?: boolean;
  fileAdditions?: number | null;
  fileDeletions?: number | null;
  updatedAt?: Date | null;
  gitOwner?: string | null;
  gitProvider?: string | null;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDelete?: () => void;
}

function formatTimeAgo(date: Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const SubchatInlineItem = React.memo(function SubchatInlineItem({
  name,
  isActive,
  isLoading,
  hasUnseenChanges = false,
  hasPendingPlan = false,
  hasPendingQuestion = false,
  fileAdditions,
  fileDeletions,
  updatedAt,
  gitOwner,
  gitProvider,
  onClick,
  onContextMenu,
  onDelete,
}: SubchatInlineItemProps) {
  const hasFileStats =
    (fileAdditions != null && fileAdditions > 0) ||
    (fileDeletions != null && fileDeletions > 0);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "w-full text-left py-1 px-2 cursor-pointer group relative flex items-start gap-2",
        "transition-colors duration-150 rounded-md",
        "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
        isActive
          ? "bg-foreground/5 text-foreground"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {/* Project icon (GitHub avatar or folder) */}
      <div className="pt-0.5 shrink-0 w-4 h-4 flex items-center justify-center relative">
        {gitOwner && gitProvider === "github" ? (
          <img
            src={`https://github.com/${gitOwner}.png?size=64`}
            alt={gitOwner}
            className="h-4 w-4 rounded-xs shrink-0"
          />
        ) : (
          <FolderGit2
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          />
        )}

        {/* Loading/status badge */}
        {(isLoading ||
          hasUnseenChanges ||
          hasPendingPlan ||
          hasPendingQuestion) && (
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center",
              isActive
                ? "bg-[#E8E8E8] dark:bg-[#1B1B1B]"
                : "bg-[#F4F4F4] group-hover:bg-[#E8E8E8] dark:bg-[#101010] dark:group-hover:bg-[#1B1B1B]",
            )}
          >
            {isLoading ? (
              <LoadingDot
                isLoading={true}
                className="w-2.5 h-2.5 text-muted-foreground"
              />
            ) : hasPendingQuestion ? (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            ) : hasPendingPlan ? (
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            ) : (
              <LoadingDot
                isLoading={false}
                className="w-2.5 h-2.5 text-muted-foreground"
              />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {/* Name */}
        <span className="truncate block text-xs font-medium leading-tight">
          {name || "New Chat"}
        </span>

        {/* Metadata row */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
          {/* Time */}
          {updatedAt && <span>{formatTimeAgo(updatedAt)}</span>}

          {/* File stats */}
          {hasFileStats && (
            <>
              {updatedAt && <span>·</span>}
              <span className="flex items-center gap-0.5">
                {fileAdditions != null && fileAdditions > 0 && (
                  <span className="text-green-600 dark:text-green-500">
                    +{fileAdditions}
                  </span>
                )}
                {fileDeletions != null && fileDeletions > 0 && (
                  <span className="text-red-600 dark:text-red-500">
                    -{fileDeletions}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Delete button - shows on hover */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          )}
          title="Delete chat permanently"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});
