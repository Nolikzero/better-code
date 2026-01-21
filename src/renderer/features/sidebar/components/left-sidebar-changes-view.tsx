"use client";

import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import {
  activeChatDiffDataAtom,
  changesSectionCollapsedAtom,
  prActionsAtom,
} from "../../agents/atoms";
import { ChangesFileList } from "./changes-file-list";
import { GitActionsToolbar } from "./git-actions-toolbar";

/**
 * Left sidebar changes view - simplified to show only a file list.
 * Clicking a file opens the center diff view.
 * Now includes a git actions toolbar for commit, stash, push operations.
 */
export function LeftSidebarChangesView() {
  // Use the global atom that's updated by active-chat.tsx via git watcher
  // This ensures real-time updates when files change
  const diffData = useAtomValue(activeChatDiffDataAtom);
  const prActions = useAtomValue(prActionsAtom);
  const [isCollapsed, setIsCollapsed] = useAtom(changesSectionCollapsedAtom);

  // Callback to refresh diff data after git operations
  // This is passed to the toolbar but the actual refresh happens via
  // the activeChatDiffDataAtom which is updated by the parent component
  const handleRefresh = useCallback(() => {
    // The parent component (active-chat.tsx) will automatically refresh
    // the diff data when the worktree state changes
    // This is a placeholder for potential future direct refresh logic
  }, []);

  // Memoized callback to prevent unnecessary re-renders in ChangesFileList
  const handleToggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Render spacer if no diff data, no worktree, or no changes
  if (!diffData || !diffData.worktreePath || !diffData.diffStats.hasChanges) {
    return <div className="flex-1" />;
  }

  const { chatId, worktreePath, diffStats, parsedFileDiffs } = diffData;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Git Actions Toolbar - only show when expanded */}
      {!isCollapsed && (
        <GitActionsToolbar
          chatId={chatId}
          worktreePath={worktreePath}
          hasChanges={diffStats.hasChanges}
          onRefresh={handleRefresh}
        />
      )}

      {/* File List */}
      <ChangesFileList
        chatId={chatId}
        worktreePath={worktreePath}
        diffStats={diffStats}
        parsedFileDiffs={parsedFileDiffs}
        prActions={prActions}
        isCollapsed={isCollapsed}
        onToggleCollapsed={handleToggleCollapsed}
      />
    </div>
  );
}
