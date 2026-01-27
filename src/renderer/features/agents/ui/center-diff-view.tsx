"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ArrowLeft,
  ChevronDown,
  Columns2,
  Eye,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  MoreHorizontal,
  Rows2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  CheckIcon,
  CollapseIcon,
  ExpandIcon,
  IconSpinner,
  PullRequestIcon,
} from "../../../components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import {
  type ActiveChatDiffData,
  agentsFocusedDiffFileAtom,
  centerDiffSelectedFileAtom,
  commitDiffDataAtom,
  diffViewingModeAtom,
  effectiveDiffDataAtom,
  fullDiffDataAtom,
  mainContentActiveTabAtom,
  multiRepoActiveWorktreePathAtom,
  type ProjectDiffData,
  prActionsAtom,
  selectedAgentChatIdAtom,
} from "../atoms";
import { useCommitDiff } from "../hooks/use-commit-diff";
import { useFullDiff } from "../hooks/use-full-diff";
import {
  AgentDiffView,
  type AgentDiffViewRef,
  DiffModeEnum,
  diffViewModeAtom,
} from "./agent-diff-view";
import { PrStatusBar } from "./pr-status-bar";

/**
 * Full-featured diff viewer for the center/main content area.
 * Shows all changed files with action buttons and view controls.
 */
export function CenterDiffView() {
  // Determine if we're showing chat-level or project-level diffs
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom);
  const { isProjectLevel, useProjectFallback, diffData, multiRepoDiffData } =
    useAtomValue(effectiveDiffDataAtom);
  const fallback = isProjectLevel || useProjectFallback;
  const chatPrActions = useAtomValue(prActionsAtom);

  // Diff viewing mode state
  const [viewingMode, setViewingMode] = useAtom(diffViewingModeAtom);
  const commitDiffData = useAtomValue(commitDiffDataAtom);
  const fullDiffData = useAtomValue(fullDiffDataAtom);

  // Only show PR actions for chat-level diffs in uncommitted mode
  const prActions =
    fallback || viewingMode.type !== "uncommitted" ? null : chatPrActions;
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const [centerDiffSelectedFile, setCenterDiffSelectedFile] = useAtom(
    centerDiffSelectedFileAtom,
  );
  const setFocusedDiffFile = useSetAtom(agentsFocusedDiffFileAtom);
  const [diffMode, setDiffMode] = useAtom(diffViewModeAtom);
  const diffViewRef = useRef<AgentDiffViewRef>(null);

  // Track if all diff files are collapsed/expanded for button disabled states
  const [diffCollapseState, setDiffCollapseState] = useState({
    allCollapsed: false,
    allExpanded: true,
  });

  // Multi-repo overrides
  const multiRepoActiveWorktreePath = useAtomValue(
    multiRepoActiveWorktreePathAtom,
  );

  // Extract chatId and worktreePath early for hooks
  const chatId = fallback
    ? ((diffData as ProjectDiffData | null)?.projectId ?? "")
    : ((diffData as ActiveChatDiffData | null)?.chatId ?? "");
  const baseWorktreePath = fallback
    ? ((diffData as ProjectDiffData | null)?.projectPath ?? null)
    : ((diffData as ActiveChatDiffData | null)?.worktreePath ?? null);
  // When a multi-repo file was clicked, use that repo's path instead
  const worktreePath =
    fallback && multiRepoActiveWorktreePath
      ? multiRepoActiveWorktreePath
      : baseWorktreePath;
  const sandboxId = fallback
    ? undefined
    : (diffData as ActiveChatDiffData | null)?.sandboxId;
  const repository = fallback
    ? undefined
    : (diffData as ActiveChatDiffData | null)?.repository;

  // Invoke diff hooks based on viewing mode
  useCommitDiff({
    worktreePath,
    commitHash: viewingMode.type === "commit" ? viewingMode.commitHash : null,
    enabled: viewingMode.type === "commit",
  });

  useFullDiff({
    worktreePath,
    enabled: viewingMode.type === "full",
  });

  // Reset viewing mode when chat changes
  const prevChatIdRef = useRef(selectedChatId);
  useEffect(() => {
    if (prevChatIdRef.current !== selectedChatId) {
      prevChatIdRef.current = selectedChatId;
      setViewingMode({ type: "uncommitted" });
    }
  }, [selectedChatId, setViewingMode]);

  // Find active multi-repo entry when applicable
  const activeMultiRepoEntry = useMemo(() => {
    if (!fallback || !multiRepoActiveWorktreePath || !multiRepoDiffData)
      return null;
    return (
      multiRepoDiffData.repos.find(
        (r) => r.path === multiRepoActiveWorktreePath,
      ) ?? null
    );
  }, [fallback, multiRepoActiveWorktreePath, multiRepoDiffData]);

  // Compute effective data based on viewing mode
  const effectiveData = useMemo(() => {
    switch (viewingMode.type) {
      case "commit":
        if (!commitDiffData) return null;
        return {
          diffStats: commitDiffData.diffStats,
          diffContent: commitDiffData.diffContent,
          parsedFileDiffs: commitDiffData.parsedFileDiffs,
          prefetchedFileContents: commitDiffData.prefetchedFileContents,
          isLoading: commitDiffData.isLoading,
        };
      case "full":
        if (!fullDiffData) return null;
        return {
          diffStats: fullDiffData.diffStats,
          diffContent: fullDiffData.diffContent,
          parsedFileDiffs: fullDiffData.parsedFileDiffs,
          prefetchedFileContents: fullDiffData.prefetchedFileContents,
          isLoading: fullDiffData.isLoading,
        };
      default: {
        // Use multi-repo entry when active, otherwise fall back to diffData
        const source = activeMultiRepoEntry ?? diffData;
        if (!source) return null;
        return {
          diffStats: source.diffStats,
          diffContent: source.diffContent,
          parsedFileDiffs: source.parsedFileDiffs,
          prefetchedFileContents: source.prefetchedFileContents,
          isLoading: source.diffStats.isLoading,
        };
      }
    }
  }, [
    viewingMode,
    diffData,
    commitDiffData,
    fullDiffData,
    activeMultiRepoEntry,
  ]);

  // Set focused file when center diff view opens with a selected file
  // Also re-triggers when viewingMode changes (e.g. switching commits)
  useEffect(() => {
    if (centerDiffSelectedFile) {
      // Reset first to ensure AgentDiffView detects the transition
      setFocusedDiffFile(null);
      // Delay to allow AgentDiffView to mount after loading completes
      const timer = setTimeout(() => {
        setFocusedDiffFile(centerDiffSelectedFile);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [centerDiffSelectedFile, viewingMode, setFocusedDiffFile]);

  // Handle close - switch to chat tab and reset mode
  const handleClose = () => {
    setActiveTab("chat");
    setCenterDiffSelectedFile(null);
    setViewingMode({ type: "uncommitted" });
  };

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Get the mode label for the dropdown
  const modeLabel = useMemo(() => {
    switch (viewingMode.type) {
      case "commit": {
        const msg = viewingMode.message;
        return msg.length > 24 ? `${msg.slice(0, 24)}...` : msg;
      }
      case "full":
        return "All changes";
      default:
        return "Uncommitted";
    }
  }, [viewingMode]);

  // Return loading state when switching to commit/full mode before data loads
  if (!effectiveData && viewingMode.type !== "uncommitted") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <IconSpinner className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  // Return empty state if no diff data in uncommitted mode
  if (!effectiveData) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No changes to display
      </div>
    );
  }

  const {
    diffStats,
    diffContent,
    parsedFileDiffs,
    prefetchedFileContents,
    isLoading,
  } = effectiveData;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-border/50 shrink-0">
        {/* Left: Back button and stats */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-7 w-7 p-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Back to chat (Esc)
            </TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-2">
            {/* Mode selector dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-sm font-medium hover:text-foreground/80 transition-colors">
                  {viewingMode.type === "commit" && (
                    <GitCommitHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {viewingMode.type === "full" && (
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span>{modeLabel}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={4}
                className="w-48"
              >
                <DropdownMenuItem
                  onClick={() => setViewingMode({ type: "uncommitted" })}
                  className="relative pl-6 gap-1.5"
                >
                  {viewingMode.type === "uncommitted" && (
                    <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                  )}
                  <span>Uncommitted</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setViewingMode({ type: "full" })}
                  className="relative pl-6 gap-1.5"
                >
                  {viewingMode.type === "full" && (
                    <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                  )}
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>All changes</span>
                </DropdownMenuItem>
                {viewingMode.type === "commit" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled
                      className="relative pl-6 gap-1.5"
                    >
                      <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      <GitCommitHorizontal className="w-3.5 h-3.5" />
                      <span className="truncate">{modeLabel}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {!isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{diffStats.fileCount} files</span>
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
            {isLoading && (
              <IconSpinner className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* PR Actions */}
          {prActions && (
            <>
              {/* Review button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prActions.onReview}
                    disabled={prActions.isReviewing}
                    className="h-7 px-2 text-xs gap-1.5"
                  >
                    {prActions.isReviewing ? (
                      <IconSpinner className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Review</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Get AI code review
                </TooltipContent>
              </Tooltip>

              {/* Create PR - when no PR exists or PR is closed */}
              {(!prActions.hasPrNumber ||
                (prActions.hasPrNumber && !prActions.isPrOpen)) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={prActions.onCreatePr}
                      disabled={prActions.isCreatingPr}
                      className="h-7 px-2 text-xs gap-1.5"
                    >
                      {prActions.isCreatingPr ? (
                        <IconSpinner className="w-3.5 h-3.5" />
                      ) : (
                        <PullRequestIcon className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Create PR</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    Create Pull Request
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Merge - when PR is open and no changes */}
              {prActions.hasPrNumber &&
                prActions.isPrOpen &&
                !diffStats.hasChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={prActions.onMergePr}
                        disabled={prActions.isMergingPr}
                        className="h-7 px-2 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {prActions.isMergingPr ? (
                          <IconSpinner className="w-3.5 h-3.5" />
                        ) : (
                          <GitMerge className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Merge</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      Merge Pull Request
                    </TooltipContent>
                  </Tooltip>
                )}

              {/* Commit - when PR is open and has changes */}
              {prActions.hasPrNumber &&
                prActions.isPrOpen &&
                diffStats.hasChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        onClick={prActions.onCommitToPr}
                        disabled={prActions.isCommittingToPr}
                        className="h-7 px-2 text-xs gap-1.5"
                      >
                        {prActions.isCommittingToPr ? (
                          <IconSpinner className="w-3.5 h-3.5" />
                        ) : (
                          <GitCommitHorizontal className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Commit</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      Commit to PR
                    </TooltipContent>
                  </Tooltip>
                )}
            </>
          )}

          {/* Separator */}
          <div className="w-px h-4 bg-border mx-1" />

          {/* View mode toggle */}
          <div className="relative bg-muted rounded h-7 p-0.5 flex">
            <div
              className="absolute inset-y-0.5 rounded bg-background shadow transition-all duration-200 ease-in-out"
              style={{
                width: "calc(50% - 2px)",
                left: diffMode === DiffModeEnum.Split ? "2px" : "calc(50%)",
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDiffMode(DiffModeEnum.Split)}
                  className="relative z-[2] px-1.5 h-full flex items-center justify-center transition-colors duration-200 rounded text-muted-foreground"
                >
                  <Columns2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Split view
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDiffMode(DiffModeEnum.Unified)}
                  className="relative z-[2] px-1.5 h-full flex items-center justify-center transition-colors duration-200 rounded text-muted-foreground"
                >
                  <Rows2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Unified view
              </TooltipContent>
            </Tooltip>
          </div>

          {/* More menu with expand/collapse */}
          {diffStats.fileCount > 5 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4} className="w-40">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    {diffMode === DiffModeEnum.Split ? (
                      <Columns2 className="w-3.5 h-3.5" />
                    ) : (
                      <Rows2 className="w-3.5 h-3.5" />
                    )}
                    <span>View</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    sideOffset={6}
                    alignOffset={-4}
                    className="min-w-0"
                  >
                    <DropdownMenuItem
                      onClick={() => setDiffMode(DiffModeEnum.Split)}
                      className="relative pl-6 gap-1.5"
                    >
                      {diffMode === DiffModeEnum.Split && (
                        <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      )}
                      <Columns2 className="w-3.5 h-3.5" />
                      <span>Split</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDiffMode(DiffModeEnum.Unified)}
                      className="relative pl-6 gap-1.5"
                    >
                      {diffMode === DiffModeEnum.Unified && (
                        <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
                          <CheckIcon className="h-3 w-3" />
                        </span>
                      )}
                      <Rows2 className="w-3.5 h-3.5" />
                      <span>Unified</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  onClick={() => diffViewRef.current?.expandAll()}
                  disabled={diffCollapseState.allExpanded}
                  className="gap-2"
                >
                  <ExpandIcon className="w-3.5 h-3.5" />
                  <span>Expand all</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => diffViewRef.current?.collapseAll()}
                  disabled={diffCollapseState.allCollapsed}
                  className="gap-2"
                >
                  <CollapseIcon className="w-3.5 h-3.5" />
                  <span>Collapse all</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* PR Status Bar */}
      {prActions?.prUrl && prActions?.prNumber && (
        <PrStatusBar
          chatId={chatId}
          prUrl={prActions.prUrl}
          prNumber={prActions.prNumber}
        />
      )}

      {/* Diff View */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <IconSpinner className="w-5 h-5 text-muted-foreground" />
          </div>
        ) : (
          <AgentDiffView
            ref={diffViewRef}
            chatId={chatId}
            sandboxId={sandboxId}
            worktreePath={worktreePath || undefined}
            repository={repository}
            initialDiff={diffContent}
            initialParsedFiles={parsedFileDiffs}
            prefetchedFileContents={prefetchedFileContents || {}}
            showFooter={false}
            onCollapsedStateChange={setDiffCollapseState}
          />
        )}
      </div>
    </div>
  );
}
