"use client";

import { useSetAtom } from "jotai";
import { ChevronUp, ListPlus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import {
  agentsFocusedDiffFileAtom,
  centerDiffSelectedFileAtom,
  diffViewingModeAtom,
  filteredDiffFilesAtom,
  mainContentActiveTabAtom,
  type QueuedMessage,
  type SubChatFileChange,
} from "../atoms";
import { getFileIconByExtension } from "../mentions";

// Animated dots component that cycles through ., .., ...
function AnimatedDots() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block w-[1em] text-left">
      {".".repeat(dotCount)}
    </span>
  );
}

interface SubChatStatusCardProps {
  chatId: string; // Parent chat ID for per-chat diff sidebar state
  isStreaming: boolean;
  isCompacting?: boolean;
  changedFiles: SubChatFileChange[];
  worktreePath?: string | null;
  isOverlayMode?: boolean;
  isInputFocused?: boolean;
  onStop?: () => void;
  // Message queue props
  messageQueue?: QueuedMessage[];
  onRemoveFromQueue?: (messageId: string) => void;
  onClearQueue?: () => void;
}

export const SubChatStatusCard = memo(function SubChatStatusCard({
  isStreaming,
  isOverlayMode = false,
  isInputFocused = false,
  isCompacting,
  changedFiles,
  onStop,
  messageQueue = [],
  onRemoveFromQueue,
  onClearQueue,
}: SubChatStatusCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const setFilteredDiffFiles = useSetAtom(filteredDiffFilesAtom);
  const setCenterDiffSelectedFile = useSetAtom(centerDiffSelectedFileAtom);
  const setFocusedDiffFile = useSetAtom(agentsFocusedDiffFileAtom);
  const setViewingMode = useSetAtom(diffViewingModeAtom);

  // Calculate totals from all changed files
  const totals = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const file of changedFiles) {
      additions += file.additions;
      deletions += file.deletions;
    }
    return { additions, deletions, fileCount: changedFiles.length };
  }, [changedFiles]);

  // Don't show if no changed files, not streaming, and no queued messages
  if (!isStreaming && changedFiles.length === 0 && messageQueue.length === 0) {
    return null;
  }

  const handleReview = () => {
    // Set filter to only show files from this sub-chat
    // Use displayPath (relative path) to match git diff paths
    const filePaths = changedFiles.map((f) => f.displayPath);
    setFilteredDiffFiles(filePaths.length > 0 ? filePaths : null);
    // Show all changes (committed + uncommitted) in center diff view
    setViewingMode({ type: "full" });
    setActiveTab("changes");
  };

  return (
    <div
      className={cn(
        "rounded-t-xl border border-b-0 border-border bg-muted/30 overflow-hidden flex flex-col pb-4 transition-colors duration-150",
        isOverlayMode && "bg-background/30",
        isInputFocused && "bg-background",
      )}
    >
      {/* Expanded file list - renders above header, expands upward */}
      <AnimatePresence initial={false}>
        {isExpanded && changedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="border-b border-border max-h-[200px] overflow-y-auto">
              {changedFiles.map((file) => {
                const FileIcon = getFileIconByExtension(file.displayPath);

                const handleFileClick = () => {
                  // Set filter to only show files from this sub-chat
                  // Use displayPath (relative path) to match git diff paths
                  const filePaths = changedFiles.map((f) => f.displayPath);
                  setFilteredDiffFiles(filePaths.length > 0 ? filePaths : null);
                  // Select and scroll to this specific file
                  setCenterDiffSelectedFile(file.displayPath);
                  setFocusedDiffFile(file.displayPath);
                  // Show all changes (committed + uncommitted) in center diff view
                  setViewingMode({ type: "full" });
                  // Navigate to changes tab
                  setActiveTab("changes");
                };

                const handleKeyDown = (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleFileClick();
                  }
                };

                return (
                  <div
                    key={file.filePath}
                    role="button"
                    tabIndex={0}
                    onClick={handleFileClick}
                    onKeyDown={handleKeyDown}
                    aria-label={`View diff for ${file.displayPath}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors cursor-pointer focus:outline-hidden rounded-xs"
                  >
                    {FileIcon && (
                      <FileIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1 text-foreground">
                      {file.displayPath}
                    </span>
                    <span className="shrink-0 text-green-600 dark:text-green-400">
                      +{file.additions}
                    </span>
                    <span className="shrink-0 text-red-600 dark:text-red-400">
                      -{file.deletions}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queued messages - expands when input is focused */}
      <AnimatePresence initial={false}>
        {isInputFocused && messageQueue.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="border-b border-border">
              <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center justify-between border-b border-border/50">
                <span className="font-medium">Queued Messages</span>
                {onClearQueue && messageQueue.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearQueue();
                    }}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              <div className="max-h-[150px] overflow-y-auto">
                {messageQueue.map((message, index) => (
                  <div
                    key={message.id}
                    className="flex items-start gap-2 px-3 py-1.5 text-xs group hover:bg-muted/50"
                  >
                    <span className="text-muted-foreground shrink-0 mt-0.5 tabular-nums">
                      {index + 1}.
                    </span>
                    <p className="flex-1 text-foreground line-clamp-2 break-words">
                      {message.text || "(Attachment)"}
                    </p>
                    {onRemoveFromQueue && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromQueue(message.id);
                        }}
                        aria-label="Remove from queue"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - always at bottom */}
      <div
        role={changedFiles.length > 0 ? "button" : undefined}
        tabIndex={changedFiles.length > 0 ? 0 : undefined}
        onClick={() => changedFiles.length > 0 && setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (changedFiles.length > 0 && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={changedFiles.length > 0 ? isExpanded : undefined}
        aria-label={
          changedFiles.length > 0
            ? `${isExpanded ? "Collapse" : "Expand"} changed files list`
            : undefined
        }
        className={cn(
          "flex items-center justify-between pr-1 pl-3 h-8",
          changedFiles.length > 0 &&
            "cursor-pointer hover:bg-muted/50 transition-colors duration-150 focus:outline-hidden rounded-xs",
        )}
      >
        <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
          {/* Expand/Collapse chevron - points up when collapsed, down when expanded */}
          {changedFiles.length > 0 && (
            <ChevronUp
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          )}

          {/* Streaming indicator */}
          {isStreaming && changedFiles.length === 0 && (
            <span className="text-xs text-muted-foreground">
              {isCompacting ? "Compacting" : "Generating"}
              <AnimatedDots />
            </span>
          )}

          {/* File count and stats */}
          {changedFiles.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {totals.fileCount} {totals.fileCount === 1 ? "file" : "files"}
              {(totals.additions > 0 || totals.deletions > 0) && (
                <>
                  {" "}
                  <span className="text-green-600 dark:text-green-400">
                    +{totals.additions}
                  </span>{" "}
                  <span className="text-red-600 dark:text-red-400">
                    -{totals.deletions}
                  </span>
                </>
              )}
            </span>
          )}

          {/* Queue indicator - shown when messages are queued */}
          {messageQueue.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {(changedFiles.length > 0 || isStreaming) && (
                <span className="text-border">•</span>
              )}
              <ListPlus className="w-3.5 h-3.5" />
              <span>
                {messageQueue.length} queued
              </span>
            </span>
          )}
        </div>

        {/* Right side: buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isStreaming && onStop && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onStop();
              }}
              className="h-6 px-2 text-xs font-normal rounded-md transition-transform duration-150 active:scale-[0.97]"
            >
              Stop
              <span className="text-muted-foreground/60 ml-1">⌃C</span>
            </Button>
          )}
          {changedFiles.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleReview();
              }}
              className="h-6 px-3 text-xs font-medium rounded-md transition-transform duration-150 active:scale-[0.97]"
            >
              Review
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});
