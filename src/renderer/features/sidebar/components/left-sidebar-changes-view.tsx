"use client";

import { useAtom, useAtomValue } from "jotai";
import { GitBranch } from "lucide-react";
import { useCallback } from "react";
import {
  activeChatDiffDataAtom,
  changesSectionCollapsedAtom,
  prActionsAtom,
  projectDiffDataAtom,
  selectedAgentChatIdAtom,
} from "../../agents/atoms";
import { ChangesFileList } from "./changes-file-list";
import { GitActionsToolbar } from "./git-actions-toolbar";

/**
 * Left sidebar changes view - simplified to show only a file list.
 * Clicking a file opens the center diff view.
 * Now includes a git actions toolbar for commit, stash, push operations.
 * Supports both chat-level (worktree) and project-level changes.
 */
export function LeftSidebarChangesView() {
  // Determine if we're showing chat-level or project-level changes
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom);
  const chatDiffData = useAtomValue(activeChatDiffDataAtom);
  const projectDiffData = useAtomValue(projectDiffDataAtom);

  // Use chat diff data when chat is selected, otherwise use project diff data
  const isProjectLevel = !selectedChatId;
  const diffData = isProjectLevel ? projectDiffData : chatDiffData;

  // Only show PR actions for chat-level changes
  const chatPrActions = useAtomValue(prActionsAtom);
  const prActions = isProjectLevel ? null : chatPrActions;

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

  // Extract path based on whether it's chat-level or project-level
  const workingPath = isProjectLevel
    ? (diffData as typeof projectDiffData)?.projectPath
    : (diffData as typeof chatDiffData)?.worktreePath;

  // Render empty state if no diff data, no path, or no changes
  if (!diffData || !workingPath || !diffData.diffStats.hasChanges) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-3 rounded-full bg-muted p-3">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No changes</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Modified files will appear here
        </p>
      </div>
    );
  }

  // Get the ID (chatId for chat-level, projectId for project-level)
  const id = isProjectLevel
    ? (diffData as typeof projectDiffData)!.projectId
    : (diffData as typeof chatDiffData)!.chatId;
  const { diffStats, parsedFileDiffs } = diffData;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Git Actions Toolbar - only show when expanded and for chat-level changes */}
      {!isCollapsed && !isProjectLevel && (
        <GitActionsToolbar
          chatId={id}
          worktreePath={workingPath}
          hasChanges={diffStats.hasChanges}
          onRefresh={handleRefresh}
        />
      )}

      {/* File List */}
      <ChangesFileList
        chatId={id}
        worktreePath={workingPath}
        diffStats={diffStats}
        parsedFileDiffs={parsedFileDiffs}
        prActions={prActions}
        isCollapsed={isCollapsed}
        onToggleCollapsed={handleToggleCollapsed}
      />
    </div>
  );
}
