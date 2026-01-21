"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ArrowLeft,
  Columns2,
  Eye,
  GitCommitHorizontal,
  GitMerge,
  MoreHorizontal,
  Rows2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  activeChatDiffDataAtom,
  agentsFocusedDiffFileAtom,
  centerDiffSelectedFileAtom,
  mainContentActiveTabAtom,
  prActionsAtom,
  projectDiffDataAtom,
  selectedAgentChatIdAtom,
} from "../atoms";
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
  const chatDiffData = useAtomValue(activeChatDiffDataAtom);
  const projectDiffData = useAtomValue(projectDiffDataAtom);
  const chatPrActions = useAtomValue(prActionsAtom);

  // Use chat diff data when chat is selected, otherwise use project diff data
  const isProjectLevel = !selectedChatId;
  const diffData = isProjectLevel ? projectDiffData : chatDiffData;

  // Only show PR actions for chat-level diffs
  const prActions = isProjectLevel ? null : chatPrActions;
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

  // Set focused file when center diff view opens with a selected file
  useEffect(() => {
    if (centerDiffSelectedFile) {
      // Small delay to ensure AgentDiffView is mounted
      const timer = setTimeout(() => {
        setFocusedDiffFile(centerDiffSelectedFile);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [centerDiffSelectedFile, setFocusedDiffFile]);

  // Handle close - switch to chat tab
  const handleClose = () => {
    setActiveTab("chat");
    setCenterDiffSelectedFile(null);
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

  // Return null if no diff data
  if (!diffData) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No changes to display
      </div>
    );
  }

  // Extract common diff properties
  const diffStats = diffData.diffStats;
  const diffContent = diffData.diffContent;
  const parsedFileDiffs = diffData.parsedFileDiffs;
  const prefetchedFileContents = diffData.prefetchedFileContents;

  // For chat-level diffs, use chatId and worktreePath
  // For project-level diffs, use projectId and projectPath
  const chatId = isProjectLevel
    ? ((diffData as typeof projectDiffData)?.projectId ?? "")
    : ((diffData as typeof chatDiffData)?.chatId ?? "");
  const worktreePath = isProjectLevel
    ? ((diffData as typeof projectDiffData)?.projectPath ?? null)
    : ((diffData as typeof chatDiffData)?.worktreePath ?? null);
  const sandboxId = isProjectLevel
    ? undefined
    : (diffData as typeof chatDiffData)?.sandboxId;
  const repository = isProjectLevel
    ? undefined
    : (diffData as typeof chatDiffData)?.repository;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
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
            <span className="text-sm font-medium">Changes</span>
            {!diffStats.isLoading && (
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
        <AgentDiffView
          ref={diffViewRef}
          chatId={chatId}
          sandboxId={sandboxId}
          worktreePath={worktreePath || undefined}
          repository={repository}
          initialDiff={diffContent}
          initialParsedFiles={parsedFileDiffs}
          prefetchedFileContents={prefetchedFileContents}
          showFooter={false}
          onCollapsedStateChange={setDiffCollapseState}
        />
      </div>
    </div>
  );
}
