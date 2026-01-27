"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderGit2,
  GitBranch,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type ActiveChatDiffData,
  centerDiffSelectedFileAtom,
  changesSectionCollapsedAtom,
  collapsedSubReposAtom,
  diffViewingModeAtom,
  effectiveDiffDataAtom,
  expandedCommitHashesAtom,
  fetchSingleRepoDiffAtom,
  type MultiRepoDiffEntry,
  mainContentActiveTabAtom,
  multiRepoActiveWorktreePathAtom,
  type ProjectDiffData,
  prActionsAtom,
  refreshDiffTriggerAtom,
  toggleCommitExpandedAtom,
} from "../../agents/atoms";
import { ChangesFileList } from "./changes-file-list";
import { CommitSection } from "./commit-section";
import { GitActionsToolbar } from "./git-actions-toolbar";

/**
 * Left sidebar changes view - shows file changes.
 * Supports single-repo, multi-repo (grouped by repository), and chat-level views.
 */
export function LeftSidebarChangesView() {
  const { showMultiRepo } = useAtomValue(effectiveDiffDataAtom);

  if (showMultiRepo) {
    return <MultiRepoChangesView />;
  }

  return <SingleRepoChangesView />;
}

/**
 * Multi-repo grouped changes view.
 * Each repository with changes gets a collapsible section.
 */
function MultiRepoChangesView() {
  const { multiRepoDiffData } = useAtomValue(effectiveDiffDataAtom);
  const [collapsedRepos, setCollapsedRepos] = useAtom(collapsedSubReposAtom);
  const setRefreshTrigger = useSetAtom(refreshDiffTriggerAtom);
  const setMultiRepoActiveWorktreePath = useSetAtom(
    multiRepoActiveWorktreePathAtom,
  );
  const fetchSingleRepoDiff = useAtomValue(fetchSingleRepoDiffAtom);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

  const toggleRepoCollapsed = useCallback(
    (relativePath: string, repo: MultiRepoDiffEntry) => {
      const wasCollapsed = collapsedRepos[relativePath] !== false;
      setCollapsedRepos((prev) => ({
        ...prev,
        [relativePath]: !wasCollapsed,
      }));
      // Lazy load: fetch full diff when expanding and data not yet loaded
      if (wasCollapsed && !repo.parsedFileDiffs && fetchSingleRepoDiff) {
        fetchSingleRepoDiff(relativePath);
      }
    },
    [collapsedRepos, setCollapsedRepos, fetchSingleRepoDiff],
  );

  const allCollapsed = multiRepoDiffData
    ? multiRepoDiffData.repos.every(
        (r) => collapsedRepos[r.relativePath] !== false,
      )
    : true;

  const handleToggleAll = useCallback(() => {
    if (!multiRepoDiffData) return;
    const newState: Record<string, boolean> = {};
    for (const repo of multiRepoDiffData.repos) {
      newState[repo.relativePath] = !allCollapsed;
    }
    setCollapsedRepos((prev) => ({ ...prev, ...newState }));
  }, [allCollapsed, multiRepoDiffData, setCollapsedRepos]);

  if (!multiRepoDiffData || multiRepoDiffData.repos.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Repositories ({multiRepoDiffData.repos.length})
        </span>
        <button
          onClick={handleToggleAll}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={allCollapsed ? "Expand all" : "Collapse all"}
        >
          {allCollapsed ? (
            <ChevronsUpDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronsDownUp className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {multiRepoDiffData.repos.map((repo) => (
        <MultiRepoSection
          key={repo.relativePath}
          repo={repo}
          isCollapsed={collapsedRepos[repo.relativePath] !== false}
          onToggleCollapsed={() => toggleRepoCollapsed(repo.relativePath, repo)}
          onRefresh={handleRefresh}
          onSetActiveRepoPath={() => setMultiRepoActiveWorktreePath(repo.path)}
          onRequestDiff={(rp) => fetchSingleRepoDiff?.(rp)}
        />
      ))}
    </div>
  );
}

/**
 * A single repository section within the multi-repo view.
 */
function MultiRepoSection({
  repo,
  isCollapsed,
  onToggleCollapsed,
  onRefresh,
  onSetActiveRepoPath,
  onRequestDiff,
}: {
  repo: MultiRepoDiffEntry;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onRefresh: () => void;
  onSetActiveRepoPath: () => void;
  onRequestDiff: (relativePath: string) => void;
}) {
  const { diffStats, parsedFileDiffs, name, path: repoPath } = repo;

  // Auto-fetch full diff when expanded but data not loaded
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (!isCollapsed && !parsedFileDiffs && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      onRequestDiff(repo.relativePath);
    }
    if (isCollapsed) {
      hasFetchedRef.current = false;
    }
  }, [isCollapsed, parsedFileDiffs, repo.relativePath, onRequestDiff]);

  return (
    <div className="border-b border-border/30">
      {/* Repo header */}
      <button
        onClick={onToggleCollapsed}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-accent/50 transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground truncate">
          {name}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
          {diffStats.fileCount} {diffStats.fileCount === 1 ? "file" : "files"}
        </span>
        <span className="text-[10px] shrink-0">
          {diffStats.additions > 0 && (
            <span className="text-green-500">+{diffStats.additions}</span>
          )}
          {diffStats.additions > 0 && diffStats.deletions > 0 && (
            <span className="text-muted-foreground mx-0.5">/</span>
          )}
          {diffStats.deletions > 0 && (
            <span className="text-red-500">-{diffStats.deletions}</span>
          )}
        </span>
      </button>

      {/* Expanded content */}
      {!isCollapsed && (
        <div className="flex flex-col">
          <GitActionsToolbar
            chatId={repo.relativePath}
            worktreePath={repoPath}
            hasChanges={diffStats.hasChanges}
            onRefresh={onRefresh}
          />
          {parsedFileDiffs ? (
            <ChangesFileList
              chatId={repo.relativePath}
              worktreePath={repoPath}
              diffStats={diffStats}
              parsedFileDiffs={parsedFileDiffs}
              prActions={null}
              isCollapsed={false}
              onToggleCollapsed={() => {}}
              onBeforeFileClick={onSetActiveRepoPath}
            />
          ) : (
            <div className="flex items-center justify-center py-3">
              <span className="text-xs text-muted-foreground">
                Loading files...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Single-repo changes view (original behavior).
 */
function SingleRepoChangesView() {
  const { isProjectLevel, useProjectFallback, diffData } = useAtomValue(
    effectiveDiffDataAtom,
  );
  const fallback = isProjectLevel || useProjectFallback;

  const chatPrActions = useAtomValue(prActionsAtom);
  const prActions = fallback ? null : chatPrActions;

  const [isCollapsed, setIsCollapsed] = useAtom(changesSectionCollapsedAtom);
  const setRefreshTrigger = useSetAtom(refreshDiffTriggerAtom);
  const setViewingMode = useSetAtom(diffViewingModeAtom);
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const setCenterDiffSelectedFile = useSetAtom(centerDiffSelectedFileAtom);

  const expandedCommitHashes = useAtomValue(expandedCommitHashesAtom);
  const toggleCommitExpanded = useSetAtom(toggleCommitExpandedAtom);

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, [setRefreshTrigger]);

  const handleToggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, [setIsCollapsed]);

  const commits = diffData?.commits ?? [];

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

  const handleViewCommitDiff = useCallback(
    (commitHash: string, message: string) => {
      setViewingMode({ type: "commit", commitHash, message });
      setCenterDiffSelectedFile(null);
      setActiveTab("changes");
    },
    [setViewingMode, setCenterDiffSelectedFile, setActiveTab],
  );

  const handleViewAllChanges = useCallback(() => {
    setViewingMode({ type: "full" });
    setCenterDiffSelectedFile(null);
    setActiveTab("changes");
  }, [setViewingMode, setCenterDiffSelectedFile, setActiveTab]);

  const workingPath = fallback
    ? (diffData as ProjectDiffData | null)?.projectPath
    : (diffData as ActiveChatDiffData | null)?.worktreePath;

  const hasUncommittedChanges = diffData?.diffStats.hasChanges ?? false;
  const hasCommits = commits.length > 0;
  const hasAnythingToShow = hasUncommittedChanges || hasCommits;

  const expandedHashesSet = useMemo(
    () => new Set(expandedCommitHashes),
    [expandedCommitHashes],
  );

  if (!diffData || !workingPath || !hasAnythingToShow) {
    return <EmptyState />;
  }

  const id = fallback
    ? (diffData as ProjectDiffData).projectId
    : (diffData as ActiveChatDiffData).chatId;
  const { diffStats, parsedFileDiffs } = diffData;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {hasUncommittedChanges && (
        <div
          className={`flex flex-col min-h-0 overflow-y-auto ${hasCommits ? "max-h-[60%] shrink-0" : "flex-1"}`}
        >
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

      {hasCommits && (
        <div className="flex flex-col min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/30">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Commits ({commits.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (expandedHashesSet.size > 0) {
                    // Collapse all
                    for (const hash of expandedHashesSet) {
                      toggleCommitExpanded(hash);
                    }
                  } else {
                    // Expand all
                    for (const commit of commits) {
                      if (!expandedHashesSet.has(commit.hash)) {
                        toggleCommitExpanded(commit.hash);
                      }
                    }
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={
                  expandedHashesSet.size > 0 ? "Collapse all" : "Expand all"
                }
              >
                {expandedHashesSet.size > 0 ? (
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={handleViewAllChanges}
                className="text-[11px] text-primary/80 hover:text-primary transition-colors"
              >
                View all
              </button>
            </div>
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

function EmptyState() {
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
