"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { GitBranch } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  activeChatDiffDataAtom,
  centerDiffSelectedFileAtom,
  changesSectionCollapsedAtom,
  diffViewingModeAtom,
  expandedCommitHashesAtom,
  mainContentActiveTabAtom,
  prActionsAtom,
  projectDiffDataAtom,
  refreshDiffTriggerAtom,
  selectedAgentChatIdAtom,
  toggleCommitExpandedAtom,
} from "../../agents/atoms";
import { ChangesFileList } from "./changes-file-list";
import { CommitSection } from "./commit-section";
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
  const setRefreshTrigger = useSetAtom(refreshDiffTriggerAtom);
  const setViewingMode = useSetAtom(diffViewingModeAtom);
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const setCenterDiffSelectedFile = useSetAtom(centerDiffSelectedFileAtom);

  // Commit history state
  const expandedCommitHashes = useAtomValue(expandedCommitHashesAtom);
  const toggleCommitExpanded = useSetAtom(toggleCommitExpandedAtom);

  // Callback to refresh diff data after git operations
  const handleRefresh = useCallback(() => {
    // Increment the refresh trigger to notify diff management hooks
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

  // Memoized callback to prevent unnecessary re-renders in ChangesFileList
  const handleToggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, [setIsCollapsed]);

  // Get commits from diff data (declared early for use in callbacks)
  const commits = diffData?.commits ?? [];

  // Handle commit file click - open center diff view with commit's diff, scrolled to file
  const handleCommitFileClick = useCallback(
    (filePath: string, commitHash: string) => {
      const commit = commits.find((c) => c.hash === commitHash);
      setViewingMode({
        type: "commit",
        commitHash,
        message: commit?.message || commitHash.slice(0, 7),
      });
      setCenterDiffSelectedFile(filePath);
      setActiveTab("changes");
    },
    [commits, setViewingMode, setCenterDiffSelectedFile, setActiveTab],
  );

  // Handle clicking a commit hash to view the full commit diff
  const handleViewCommitDiff = useCallback(
    (commitHash: string, message: string) => {
      setViewingMode({ type: "commit", commitHash, message });
      setCenterDiffSelectedFile(null);
      setActiveTab("changes");
    },
    [setViewingMode, setCenterDiffSelectedFile, setActiveTab],
  );

  // Handle "View all changes" button
  const handleViewAllChanges = useCallback(() => {
    setViewingMode({ type: "full" });
    setCenterDiffSelectedFile(null);
    setActiveTab("changes");
  }, [setViewingMode, setCenterDiffSelectedFile, setActiveTab]);

  // Extract path based on whether it's chat-level or project-level
  const workingPath = isProjectLevel
    ? (diffData as typeof projectDiffData)?.projectPath
    : (diffData as typeof chatDiffData)?.worktreePath;

  // Check if there's anything to show (uncommitted changes OR commits)
  const hasUncommittedChanges = diffData?.diffStats.hasChanges ?? false;
  const hasCommits = commits.length > 0;
  const hasAnythingToShow = hasUncommittedChanges || hasCommits;

  // Memoized set for faster lookup
  const expandedHashesSet = useMemo(
    () => new Set(expandedCommitHashes),
    [expandedCommitHashes],
  );

  // Render empty state if no diff data, no path, or nothing to show
  if (!diffData || !workingPath || !hasAnythingToShow) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-3 rounded-full bg-background/10 p-3">
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
      {/* Uncommitted Changes Section - constrained when commits exist */}
      {hasUncommittedChanges && (
        <div
          className={`flex flex-col min-h-0 overflow-y-auto ${hasCommits ? "max-h-[60%] shrink-0" : "flex-1"}`}
        >
          {/* Git Actions Toolbar - show when expanded */}
          {!isCollapsed && (
            <GitActionsToolbar
              chatId={id}
              worktreePath={workingPath}
              hasChanges={diffStats.hasChanges}
              onRefresh={handleRefresh}
            />
          )}

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
      )}

      {/* Commit History Section - scrolls independently */}
      {hasCommits && (
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
          {/* Header with "View all" button */}
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/30">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Commits ({commits.length})
            </span>
            <button
              onClick={handleViewAllChanges}
              className="text-[11px] text-primary/80 hover:text-primary transition-colors"
            >
              View all
            </button>
          </div>
          {commits.map((commit) => (
            <CommitSection
              key={commit.hash}
              commit={commit}
              worktreePath={workingPath}
              isExpanded={expandedHashesSet.has(commit.hash)}
              onToggleExpand={() => toggleCommitExpanded(commit.hash)}
              onFileClick={handleCommitFileClick}
              onViewCommitDiff={handleViewCommitDiff}
            />
          ))}
        </div>
      )}
    </div>
  );
}
