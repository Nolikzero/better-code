"use client";

import { useAtom } from "jotai";
import {
  Columns2,
  Eye,
  GitCommitHorizontal,
  GitMerge,
  MoreHorizontal,
  Rows2,
} from "lucide-react";
import { useRef, useState } from "react";
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
  IconCloseSidebarRight,
  IconSpinner,
  PullRequestIcon,
} from "../../../components/ui/icons";
import { Kbd } from "../../../components/ui/kbd";
import { ResizableSidebar } from "../../../components/ui/resizable-sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { getShortcutKey } from "../../../lib/utils/platform";
import { agentsDiffSidebarWidthAtom } from "../atoms";
import type { DiffStats, ParsedFileDiff } from "../hooks/use-diff-management";
import {
  AgentDiffView,
  type AgentDiffViewRef,
  DiffModeEnum,
  diffViewModeAtom,
} from "./agent-diff-view";
import { PrStatusBar } from "./pr-status-bar";

export interface DiffSidebarProps {
  chatId: string;
  sandboxId: string | undefined;
  worktreePath: string | null;
  repository: string | undefined;
  // Diff data
  diffStats: DiffStats;
  diffContent: string | null;
  parsedFileDiffs: ParsedFileDiff[] | null;
  prefetchedFileContents: Record<string, string>;
  // Sidebar state
  isOpen: boolean;
  onClose: () => void;
  diffSidebarWidth: number;
  diffSidebarRef: React.RefObject<HTMLDivElement | null>;
  // PR state
  prUrl?: string | null;
  prNumber?: number | null;
  hasPrNumber: boolean;
  isPrOpen: boolean;
  // PR actions
  onCreatePr: () => void;
  onCommitToPr: () => void;
  onMergePr: () => void;
  onReview: () => void;
  // Loading states
  isCreatingPr: boolean;
  isCommittingToPr: boolean;
  isReviewing: boolean;
  isMergingPr: boolean;
  // Diff stats callback
  onStatsChange?: (stats: DiffStats) => void;
}

export function DiffSidebar({
  chatId,
  sandboxId,
  worktreePath,
  repository,
  diffStats,
  diffContent,
  parsedFileDiffs,
  prefetchedFileContents,
  isOpen,
  onClose,
  diffSidebarWidth,
  diffSidebarRef,
  prUrl,
  prNumber,
  hasPrNumber,
  isPrOpen,
  onCreatePr,
  onCommitToPr,
  onMergePr,
  onReview,
  isCreatingPr,
  isCommittingToPr,
  isReviewing,
  isMergingPr,
  onStatsChange,
}: DiffSidebarProps) {
  const [diffMode, setDiffMode] = useAtom(diffViewModeAtom);
  const diffViewRef = useRef<AgentDiffViewRef>(null);

  // Track if all diff files are collapsed/expanded for button disabled states
  const [diffCollapseState, setDiffCollapseState] = useState({
    allCollapsed: false,
    allExpanded: true,
  });

  return (
    <ResizableSidebar
      isOpen={isOpen}
      onClose={onClose}
      widthAtom={agentsDiffSidebarWidthAtom}
      minWidth={350}
      side="right"
      animationDuration={0}
      initialWidth={0}
      exitWidth={0}
      showResizeTooltip={true}
      className="bg-background border-l"
      style={{ borderLeftWidth: "0.5px", overflow: "hidden" }}
    >
      <div
        ref={diffSidebarRef}
        className="flex flex-col h-full min-w-0 overflow-hidden"
      >
        {/* Header with stats, toggle and close button */}
        <div className="flex items-center justify-between pl-3 pr-1.5 h-10 bg-background shrink-0 border-b border-border/50 overflow-hidden">
          {/* Left: Stats - truncates when space is limited */}
          <div className="flex items-center gap-2 min-w-0 shrink overflow-hidden">
            {!diffStats.isLoading && diffStats.hasChanges && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap overflow-hidden">
                <span className="font-mono truncate">
                  {diffStats.fileCount} file
                  {diffStats.fileCount !== 1 ? "s" : ""}
                </span>
                {(diffStats.additions > 0 || diffStats.deletions > 0) && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{diffStats.additions}
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      -{diffStats.deletions}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Right: Review (when space) + Create PR + View toggle + More menu + Close button */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Review button - visible when sidebar is wide enough (>=420px) */}
            {diffStats.hasChanges && diffSidebarWidth >= 420 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={onReview}
                    disabled={isReviewing}
                    className="h-7 px-2.5 text-xs gap-1.5 transition-transform duration-150 active:scale-[0.97] rounded-md"
                  >
                    {isReviewing ? (
                      <IconSpinner className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                    <span>{isReviewing ? "Reviewing..." : "Review"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>
                  <span>Get AI code review</span>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Create PR / Merge / Commit button - dynamic based on PR state */}
            {/*
              Button logic:
              1. No PR exists + has changes → "Create PR"
              2. PR is open/draft + no changes → "Merge"
              3. PR is open/draft + has changes → "Commit" (to push to existing PR)
              4. PR is merged/closed + has changes → "Create PR" (for new PR)
              5. PR is merged/closed + no changes → nothing (just show status in PrStatusBar)
            */}
            {/* Show Create PR when: no PR exists, OR PR is merged/closed with new changes */}
            {diffStats.hasChanges &&
              (!hasPrNumber || (hasPrNumber && !isPrOpen)) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onCreatePr}
                      disabled={isCreatingPr}
                      className="h-7 px-2.5 text-xs gap-1.5 transition-transform duration-150 active:scale-[0.97] rounded-md"
                    >
                      {isCreatingPr ? (
                        <IconSpinner className="w-3.5 h-3.5" />
                      ) : (
                        <PullRequestIcon className="w-3.5 h-3.5" />
                      )}
                      <span className="whitespace-nowrap">
                        {isCreatingPr ? "Creating..." : "Create PR"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>
                    Create a Pull Request
                    <Kbd>{getShortcutKey("preview")}</Kbd>
                  </TooltipContent>
                </Tooltip>
              )}
            {/* Show Merge when PR is open/draft and no new changes */}
            {hasPrNumber && isPrOpen && !diffStats.hasChanges && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onMergePr}
                    disabled={isMergingPr}
                    className="h-7 px-2.5 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-transform duration-150 active:scale-[0.97] rounded-md"
                  >
                    {isMergingPr ? (
                      <IconSpinner className="w-3.5 h-3.5" />
                    ) : (
                      <GitMerge className="w-3.5 h-3.5" />
                    )}
                    <span className="whitespace-nowrap">
                      {isMergingPr ? "Merging..." : "Merge"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>
                  Merge Pull Request (squash)
                </TooltipContent>
              </Tooltip>
            )}
            {/* Show Commit when PR is open/draft but there are new uncommitted changes */}
            {hasPrNumber && isPrOpen && diffStats.hasChanges && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onCommitToPr}
                    disabled={isCommittingToPr}
                    className="h-7 px-2.5 text-xs gap-1.5 transition-transform duration-150 active:scale-[0.97] rounded-md"
                  >
                    {isCommittingToPr ? (
                      <IconSpinner className="w-3.5 h-3.5" />
                    ) : (
                      <GitCommitHorizontal className="w-3.5 h-3.5" />
                    )}
                    <span className="whitespace-nowrap">
                      {isCommittingToPr ? "Committing..." : "Commit"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent sideOffset={8}>
                  Commit changes and push to PR
                </TooltipContent>
              </Tooltip>
            )}
            {/* View toggle - visible when sidebar is wide enough (>=480px) */}
            {diffSidebarWidth >= 480 && (
              <div className="relative rounded-md h-7 p-0.5 flex">
                <div
                  className="absolute inset-y-0.5 rounded shadow transition-all duration-200 ease-in-out"
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
                  <TooltipContent sideOffset={8}>Split view</TooltipContent>
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
                  <TooltipContent sideOffset={8}>Unified view</TooltipContent>
                </Tooltip>
              </div>
            )}
            {/* More menu (three dots) - shown when sidebar is narrow or many files */}
            {(diffSidebarWidth < 480 || diffStats.fileCount > 10) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={4}
                  className="w-40"
                >
                  {/* Review option - shown only when hidden in header (<420px) */}
                  {diffStats.hasChanges && diffSidebarWidth < 420 && (
                    <DropdownMenuItem
                      onClick={onReview}
                      disabled={isReviewing}
                      className="gap-2"
                    >
                      {isReviewing ? (
                        <IconSpinner className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>{isReviewing ? "Reviewing..." : "Review"}</span>
                    </DropdownMenuItem>
                  )}
                  {/* View mode submenu - only show when toggle is hidden in header */}
                  {diffSidebarWidth < 480 && (
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
                  )}
                  {/* Expand/Collapse - shown when many files */}
                  {diffStats.fileCount > 10 && (
                    <>
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
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Close button */}
            <Button
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md shrink-0"
              onClick={onClose}
            >
              <IconCloseSidebarRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
        {/* Diff Content */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
          {/* PR Status Bar - show when PR exists */}
          {prUrl && prNumber && (
            <PrStatusBar chatId={chatId} prUrl={prUrl} prNumber={prNumber} />
          )}
          {/* Diff View */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AgentDiffView
              ref={diffViewRef}
              chatId={chatId}
              sandboxId={sandboxId}
              worktreePath={worktreePath || undefined}
              repository={repository}
              onStatsChange={onStatsChange}
              initialDiff={diffContent}
              initialParsedFiles={parsedFileDiffs}
              prefetchedFileContents={prefetchedFileContents}
              showFooter={true}
              onCollapsedStateChange={setDiffCollapseState}
            />
          </div>
        </div>
      </div>
    </ResizableSidebar>
  );
}
