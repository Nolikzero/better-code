"use client";

import { useAtomValue } from "jotai";
import { Archive, ArrowUp, GitCommitHorizontal, Package } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { IconSpinner } from "../../../components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { isMacOS } from "../../../lib/utils/platform";
import { selectedDiffFilesAtom } from "../../agents/atoms";
import { useGitActions } from "../../agents/hooks/use-git-actions";

interface GitActionsToolbarProps {
  chatId: string;
  worktreePath: string | null;
  hasChanges: boolean;
  onRefresh?: () => void;
}

export function GitActionsToolbar({
  chatId,
  worktreePath,
  hasChanges,
  onRefresh,
}: GitActionsToolbarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const selectedFiles = useAtomValue(selectedDiffFilesAtom);

  const {
    commitMessage,
    setCommitMessage,
    hasStash,
    isCommitting,
    isStashing,
    isUnstashing,
    isPushing,
    isAnyLoading,
    handleCommit,
    handleStash,
    handleUnstash,
    handlePush,
  } = useGitActions({
    chatId,
    worktreePath,
    onSuccess: onRefresh,
  });

  // Handle textarea resize
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCommitMessage(e.target.value);
      // Auto-resize textarea
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    },
    [setCommitMessage],
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl + Enter to commit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (hasChanges && commitMessage.trim()) {
          handleCommit();
        }
      }
    },
    [hasChanges, commitMessage, handleCommit],
  );

  const selectedCount = selectedFiles.size;
  const commitLabel =
    selectedCount > 0 ? `提交（${selectedCount}）` : "全部提交";

  const isDisabled = !worktreePath || isAnyLoading;

  return (
    <div className="flex flex-col gap-2 px-3 py-2 border-b border-border/50">
      {/* Commit message input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={commitMessage}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="提交信息…"
          disabled={isDisabled}
          rows={1}
          className={`w-full px-2 py-1.5 text-xs border rounded-md resize-none overflow-hidden focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isFocused ? "border-primary/50" : "border-border/50"
          }`}
          style={{ minHeight: "32px", maxHeight: "120px" }}
        />
        {/* Keyboard hint */}
        {isFocused && commitMessage.trim() && (
          <div className="absolute right-2 bottom-1.5 text-[10px] text-muted-foreground">
            <kbd className="px-1 py-0.5 rounded text-[9px]">
              {isMacOS() ? "⌘" : "Ctrl"}+Enter
            </kbd>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Commit button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={handleCommit}
              disabled={isDisabled || !hasChanges || !commitMessage.trim()}
              className="h-7 px-2 text-xs gap-1.5 flex-1"
            >
              {isCommitting ? (
                <IconSpinner className="w-3.5 h-3.5" />
              ) : (
                <GitCommitHorizontal className="w-3.5 h-3.5" />
              )}
              <span className="truncate">{commitLabel}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            {selectedCount > 0
              ? `提交选中的 ${selectedCount} 个文件`
              : "提交全部更改"}
          </TooltipContent>
        </Tooltip>

        {/* Stash button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStash}
              disabled={isDisabled || !hasChanges}
              className="h-7 w-7 p-0"
            >
              {isStashing ? (
                <IconSpinner className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            暂存更改
          </TooltipContent>
        </Tooltip>

        {/* Pop (Unstash) button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnstash}
              disabled={isDisabled || !hasStash}
              className="h-7 w-7 p-0"
            >
              {isUnstashing ? (
                <IconSpinner className="w-3.5 h-3.5" />
              ) : (
                <Package className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            {hasStash ? "应用暂存" : "没有可用的暂存"}
          </TooltipContent>
        </Tooltip>

        {/* Push button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePush}
              disabled={isDisabled}
              className="h-7 w-7 p-0"
            >
              {isPushing ? (
                <IconSpinner className="w-3.5 h-3.5" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            推送到远程仓库
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
