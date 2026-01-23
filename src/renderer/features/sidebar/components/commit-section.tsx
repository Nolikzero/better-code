"use client";

import { ChevronDown, ChevronRight, GitCommit, Loader2 } from "lucide-react";
import { memo } from "react";
import type { CommitInfo } from "../../../../shared/changes-types";
import { useCommitFiles } from "../../agents/hooks/use-commit-files";
import { CommitFileItem } from "./commit-file-item";

interface CommitSectionProps {
  commit: CommitInfo;
  worktreePath: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onFileClick: (filePath: string, commitHash: string) => void;
  onViewCommitDiff?: (commitHash: string, message: string) => void;
}

/**
 * Collapsible section for a single commit.
 * Lazy-loads file list when expanded.
 */
export const CommitSection = memo(function CommitSection({
  commit,
  worktreePath,
  isExpanded,
  onToggleExpand,
  onFileClick,
  onViewCommitDiff,
}: CommitSectionProps) {
  const { files, isLoading, error } = useCommitFiles(
    worktreePath,
    commit.hash,
    isExpanded,
  );

  // Format date for display
  const formatDate = (date: Date): string => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "today";
    } else if (diffDays === 1) {
      return "yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div className="border-t border-border/50">
      {/* Collapsible Header */}
      <button
        onClick={onToggleExpand}
        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors w-full text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <GitCommit className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {commit.message}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onViewCommitDiff?.(commit.hash, commit.message);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onViewCommitDiff?.(commit.hash, commit.message);
            }
          }}
          className="text-[10px] text-primary/70 hover:text-primary font-mono shrink-0 hover:underline cursor-pointer"
          title="View commit diff"
        >
          {commit.shortHash}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatDate(commit.date)}
        </span>
      </button>

      {/* Files when expanded */}
      {isExpanded && (
        <div className="pl-4 border-l-2 border-border/30 ml-3">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading files...
            </div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
          ) : files.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No files in this commit
            </div>
          ) : (
            <div className="py-1">
              {files.map((file) => (
                <CommitFileItem
                  key={file.path}
                  file={file}
                  onClick={() => onFileClick(file.path, commit.hash)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
