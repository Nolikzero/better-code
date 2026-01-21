"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  Check,
  ChevronDown,
  ChevronRight,
  File,
  Minus,
  RotateCcw,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { trpc } from "@/lib/trpc";
import {
  agentsFocusedDiffFileAtom,
  centerDiffSelectedFileAtom,
  deselectAllDiffFilesAtom,
  hoveredDiffFileAtom,
  mainContentActiveTabAtom,
  refreshDiffTriggerAtom,
  selectAllDiffFilesAtom,
  selectedDiffFilesAtom,
  toggleDiffFileSelectionAtom,
} from "../../agents/atoms";
import type {
  DiffStats,
  ParsedFileDiff,
} from "../../agents/hooks/use-diff-management";
import { getFileIconByExtension } from "../../agents/mentions/icons/file-icons";
import { PrStatusBar } from "../../agents/ui/pr-status-bar";

interface PrActionsState {
  prUrl: string | null;
  prNumber: number | null;
  hasPrNumber: boolean;
  isPrOpen: boolean;
  isCreatingPr: boolean;
  isCommittingToPr: boolean;
  isMergingPr: boolean;
  isReviewing: boolean;
  onCreatePr: () => void;
  onCommitToPr: () => void;
  onMergePr: () => void;
  onReview: () => void;
}

interface ChangesFileListProps {
  chatId: string;
  worktreePath: string;
  diffStats: DiffStats;
  parsedFileDiffs: ParsedFileDiff[] | null;
  prActions: PrActionsState | null;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

// Helper functions moved outside component to avoid recreation
const getFileStatus = (oldPath: string, newPath: string): string | null => {
  if (!oldPath || oldPath === "/dev/null") return "new";
  if (!newPath || newPath === "/dev/null") return "deleted";
  if (oldPath !== newPath) return "renamed";
  return null;
};

const getDisplayPath = (oldPath: string, newPath: string): string => {
  if (newPath && newPath !== "/dev/null") return newPath;
  return oldPath || "";
};

const getFileName = (path: string): string => {
  return path.split("/").pop() || path;
};

const getDirectory = (path: string): string => {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  parts.pop();
  return parts.join("/");
};

/**
 * Memoized file item component to prevent re-renders when parent re-renders.
 */
interface FileItemProps {
  file: ParsedFileDiff;
  isHovered: boolean;
  isSelected: boolean;
  onFileHover: (path: string) => void;
  onFileLeave: () => void;
  onFileClick: (path: string) => void;
  onCheckboxClick: (e: React.MouseEvent, path: string) => void;
  onDiscardChanges: (path: string, status: string | null) => void;
  registerRef: (path: string, el: HTMLDivElement | null) => void;
}

const FileItem = memo(function FileItem({
  file,
  isHovered,
  isSelected,
  onFileHover,
  onFileLeave,
  onFileClick,
  onCheckboxClick,
  onDiscardChanges,
  registerRef,
}: FileItemProps) {
  const displayPath = getDisplayPath(file.oldPath, file.newPath);
  const fileName = getFileName(displayPath);
  const directory = getDirectory(displayPath);
  const status = getFileStatus(file.oldPath, file.newPath);
  const FileIcon = getFileIconByExtension(displayPath) || File;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={(el) => registerRef(displayPath, el)}
          onMouseEnter={() => onFileHover(displayPath)}
          onMouseLeave={onFileLeave}
          className={`flex items-center gap-2 px-3 py-1.5 w-full transition-colors ${
            isHovered ? "bg-accent/50" : "hover:bg-muted/50"
          }`}
        >
          {/* Checkbox */}
          <button
            onClick={(e) => onCheckboxClick(e, displayPath)}
            className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
              isSelected
                ? "border-primary bg-primary"
                : "border-border/50 hover:border-primary/50"
            }`}
            aria-label={isSelected ? "Deselect file" : "Select file"}
          >
            {isSelected && (
              <Check className="w-3 h-3 text-primary-foreground" />
            )}
          </button>

          {/* Clickable area for opening diff */}
          <button
            onClick={() => onFileClick(displayPath)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left focus:outline-none"
          >
            {/* File icon */}
            <FileIcon
              className={`w-4 h-4 shrink-0 ${
                isHovered ? "text-foreground" : "text-muted-foreground"
              }`}
            />

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
            {status && (
              <span
                className={`text-[10px] px-1 py-0.5 rounded shrink-0 ${
                  status === "new"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : status === "deleted"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {status}
              </span>
            )}

            {/* Stats */}
            {!file.isBinary && (
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
            )}
            {file.isBinary && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                binary
              </span>
            )}
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => onDiscardChanges(displayPath, status)}
          className="text-destructive focus:text-destructive"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {status === "new" ? "Delete File" : "Discard Changes"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

/**
 * Simplified file list for the left sidebar.
 * Shows only file names with stats, no inline diff content.
 * Clicking a file opens the center diff view.
 * Hover syncs with the center diff view (highlights + scrolls).
 */
export const ChangesFileList = memo(function ChangesFileList({
  chatId,
  worktreePath,
  diffStats,
  parsedFileDiffs,
  prActions,
  isCollapsed,
  onToggleCollapsed,
}: ChangesFileListProps) {
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const setCenterDiffSelectedFile = useSetAtom(centerDiffSelectedFileAtom);
  const setFocusedDiffFile = useSetAtom(agentsFocusedDiffFileAtom);
  const [hoveredFile, setHoveredFile] = useAtom(hoveredDiffFileAtom);
  const activeTab = useAtomValue(mainContentActiveTabAtom);
  const isCenterDiffOpen = activeTab === "changes";

  // Selection state
  const selectedFiles = useAtomValue(selectedDiffFilesAtom);
  const toggleSelection = useSetAtom(toggleDiffFileSelectionAtom);
  const selectAll = useSetAtom(selectAllDiffFilesAtom);
  const deselectAll = useSetAtom(deselectAllDiffFilesAtom);

  // Refresh trigger to update diff data after git operations
  const setRefreshTrigger = useSetAtom(refreshDiffTriggerAtom);

  // Git mutations for discard changes
  const discardChangesMutation = trpc.changes.discardChanges.useMutation({
    onSuccess: () => {
      // Trigger diff refresh
      setRefreshTrigger((prev) => prev + 1);
    },
  });

  const deleteUntrackedMutation = trpc.changes.deleteUntracked.useMutation({
    onSuccess: () => {
      // Trigger diff refresh
      setRefreshTrigger((prev) => prev + 1);
    },
  });

  // Use refs to store mutations, avoiding dependencies on unstable tRPC mutation objects
  const discardChangesMutationRef = useRef(discardChangesMutation);
  discardChangesMutationRef.current = discardChangesMutation;

  const deleteUntrackedMutationRef = useRef(deleteUntrackedMutation);
  deleteUntrackedMutationRef.current = deleteUntrackedMutation;

  // Handle discard changes for a file
  const handleDiscardChanges = useCallback(
    async (filePath: string, status: string | null) => {
      if (status === "new") {
        // New/untracked files need to be deleted
        await deleteUntrackedMutationRef.current.mutateAsync({
          worktreePath,
          filePath,
        });
      } else {
        // Modified/deleted files can be checked out
        await discardChangesMutationRef.current.mutateAsync({
          worktreePath,
          filePath,
        });
      }
    },
    [worktreePath],
  );

  // Ref for scroll container and file items
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Get all file paths for select all functionality
  const allFilePaths = useMemo(() => {
    if (!parsedFileDiffs) return [];
    return parsedFileDiffs.map((file) => {
      if (file.newPath && file.newPath !== "/dev/null") return file.newPath;
      return file.oldPath || "";
    });
  }, [parsedFileDiffs]);

  // Calculate selection state for header checkbox
  const selectionState = useMemo(() => {
    if (selectedFiles.size === 0) return "none";
    if (selectedFiles.size === allFilePaths.length) return "all";
    return "some";
  }, [selectedFiles.size, allFilePaths.length]);

  // Handle header checkbox click
  const handleSelectAllClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectionState === "all") {
        deselectAll();
      } else {
        selectAll(allFilePaths);
      }
    },
    [selectionState, deselectAll, selectAll, allFilePaths],
  );

  // Handle individual file checkbox click
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, filePath: string) => {
      e.stopPropagation();
      toggleSelection(filePath);
    },
    [toggleSelection],
  );

  // Auto-scroll sidebar when hovered file changes (from center diff hover)
  useEffect(() => {
    if (!hoveredFile || !isCenterDiffOpen || isCollapsed) return;

    // Try to find the file item with exact match or suffix match
    let fileItem = fileItemRefs.current.get(hoveredFile);
    if (!fileItem) {
      // Try suffix match
      for (const [path, el] of fileItemRefs.current.entries()) {
        if (path.endsWith(hoveredFile) || hoveredFile.endsWith(path)) {
          fileItem = el;
          break;
        }
      }
    }

    const container = scrollContainerRef.current;

    if (fileItem && container) {
      // Check if item is outside visible area
      const containerRect = container.getBoundingClientRect();
      const itemRect = fileItem.getBoundingClientRect();

      const isAbove = itemRect.top < containerRect.top;
      const isBelow = itemRect.bottom > containerRect.bottom;

      if (isAbove || isBelow) {
        fileItem.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [hoveredFile, isCenterDiffOpen, isCollapsed]);

  // Handler for clicking a file
  const handleFileClick = useCallback(
    (filePath: string) => {
      // Switch to changes tab
      setActiveTab("changes");
      // Set the selected file for highlighting
      setCenterDiffSelectedFile(filePath);
      // Trigger scroll to file
      setFocusedDiffFile(filePath);
    },
    [setActiveTab, setCenterDiffSelectedFile, setFocusedDiffFile],
  );

  // Handler for hovering a file - sync highlight with center diff (no scroll)
  const handleFileHover = useCallback(
    (filePath: string) => {
      setHoveredFile(filePath);
    },
    [setHoveredFile],
  );

  // Handler for mouse leave
  const handleFileLeave = useCallback(() => {
    setHoveredFile(null);
  }, [setHoveredFile]);

  // Memoized callback for registering file refs
  const registerFileRef = useCallback(
    (path: string, el: HTMLDivElement | null) => {
      if (el) {
        fileItemRefs.current.set(path, el);
      } else {
        fileItemRefs.current.delete(path);
      }
    },
    [],
  );

  // Check if a file path matches the hovered file
  const isFileHovered = useCallback(
    (displayPath: string): boolean => {
      if (!hoveredFile) return false;
      return (
        displayPath === hoveredFile ||
        displayPath.endsWith(hoveredFile) ||
        hoveredFile.endsWith(displayPath)
      );
    },
    [hoveredFile],
  );

  return (
    <div className="flex flex-col min-h-0 flex-1 border-t border-border/50">
      {/* Collapsible Header */}
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors w-full">
        {/* Select all checkbox - only show when expanded and has files */}
        {!isCollapsed && parsedFileDiffs && parsedFileDiffs.length > 0 && (
          <button
            onClick={handleSelectAllClick}
            className="w-4 h-4 shrink-0 rounded border border-border/50 flex items-center justify-center hover:border-primary/50 transition-colors"
            aria-label={
              selectionState === "all" ? "Deselect all" : "Select all"
            }
          >
            {selectionState === "all" && (
              <Check className="w-3 h-3 text-primary" />
            )}
            {selectionState === "some" && (
              <Minus className="w-3 h-3 text-primary" />
            )}
          </button>
        )}
        <button
          onClick={onToggleCollapsed}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground">Changes</span>
          {/* Stats badge */}
          {!diffStats.isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
              <span className="font-mono">{diffStats.fileCount}</span>
              {(diffStats.additions > 0 || diffStats.deletions > 0) && (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{diffStats.additions}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    -{diffStats.deletions}
                  </span>
                </>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Content when expanded */}
      {!isCollapsed && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* PR Status Bar */}
          {prActions?.prUrl && prActions?.prNumber && (
            <PrStatusBar
              chatId={chatId}
              prUrl={prActions.prUrl}
              prNumber={prActions.prNumber}
            />
          )}

          {/* File list */}
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            {parsedFileDiffs && parsedFileDiffs.length > 0 ? (
              <div className="py-1">
                {parsedFileDiffs.map((file) => {
                  const displayPath = getDisplayPath(
                    file.oldPath,
                    file.newPath,
                  );
                  return (
                    <FileItem
                      key={file.key}
                      file={file}
                      isHovered={isFileHovered(displayPath)}
                      isSelected={selectedFiles.has(displayPath)}
                      onFileHover={handleFileHover}
                      onFileLeave={handleFileLeave}
                      onFileClick={handleFileClick}
                      onCheckboxClick={handleCheckboxClick}
                      onDiscardChanges={handleDiscardChanges}
                      registerRef={registerFileRef}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                No changes detected
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
