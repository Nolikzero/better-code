"use client";

import { File } from "lucide-react";
import { memo } from "react";
import type { ChangedFile } from "../../../../shared/changes-types";
import { getFileIconByExtension } from "../../agents/mentions/icons/file-icons";

interface CommitFileItemProps {
  file: ChangedFile;
  onClick: () => void;
}

const getFileName = (path: string): string => {
  return path.split("/").pop() || path;
};

const getDirectory = (path: string): string => {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  parts.pop();
  return parts.join("/");
};

const getStatusBadge = (
  status: ChangedFile["status"],
): { label: string; className: string } | null => {
  switch (status) {
    case "added":
    case "untracked":
      return {
        label: "A",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "modified":
      return {
        label: "M",
        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };
    case "deleted":
      return {
        label: "D",
        className: "bg-red-500/10 text-red-600 dark:text-red-400",
      };
    case "renamed":
    case "copied":
      return {
        label: "R",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    default:
      return null;
  }
};

/**
 * Simplified file item for commit diffs.
 * No checkbox (commits are historical/read-only).
 * Shows status badge (A/M/D/R) and file stats.
 */
export const CommitFileItem = memo(function CommitFileItem({
  file,
  onClick,
}: CommitFileItemProps) {
  const displayPath = file.path;
  const fileName = getFileName(displayPath);
  const directory = getDirectory(displayPath);
  const statusBadge = getStatusBadge(file.status);
  const FileIcon = getFileIconByExtension(displayPath) || File;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 w-full hover:bg-muted/50 transition-colors text-left"
    >
      {/* File icon */}
      <FileIcon className="w-4 h-4 shrink-0 text-muted-foreground" />

      {/* File name and directory */}
      <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-foreground truncate">
          {fileName}
        </span>
        {directory && (
          <span className="text-[10px] text-muted-foreground truncate">
            {directory}
          </span>
        )}
      </div>

      {/* Status badge */}
      {statusBadge && (
        <span
          className={`text-[10px] font-mono px-1 py-0.5 rounded shrink-0 ${statusBadge.className}`}
        >
          {statusBadge.label}
        </span>
      )}

      {/* Stats */}
      <div className="flex items-center gap-1 text-xs shrink-0">
        {file.additions > 0 && (
          <span className="text-emerald-600 dark:text-emerald-400">
            +{file.additions}
          </span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-600 dark:text-red-400">
            -{file.deletions}
          </span>
        )}
      </div>
    </button>
  );
});
