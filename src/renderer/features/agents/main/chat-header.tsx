"use client";

import type { ProviderId } from "@shared/types";
import { TerminalSquare } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  IconCloseSidebarRight,
  IconOpenSidebarRight,
  IconTextUndo,
} from "../../../components/ui/icons";
import { Kbd } from "../../../components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { cn } from "../../../lib/utils";
import { PreviewSetupHoverCard } from "../components/preview-setup-hover-card";
import type { DiffStats } from "../hooks/use-diff-management";
import { AgentsHeaderControls } from "../ui/agents-header-controls";
import { McpServersIndicator } from "../ui/mcp-servers-indicator";
import { MobileChatHeader } from "../ui/mobile-chat-header";
import { ProviderIndicator } from "../ui/provider-indicator";
import { CHAT_LAYOUT } from "../ui/user-message";
import { WorkspaceContextBadge } from "../ui/workspace-context-badge";

export interface ChatHeaderProps {
  chatId: string;
  subChatId?: string;
  isMobileFullscreen: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  hasAnyUnseenChanges: boolean;
  onCreateNewSubChat: () => void;
  onBackToChats?: () => void;
  // Preview controls
  canOpenPreview: boolean;
  isPreviewSidebarOpen: boolean;
  onOpenPreview: () => void;
  sandboxId?: string;
  // Diff controls
  canOpenDiff: boolean;
  isDiffSidebarOpen: boolean;
  diffStats: DiffStats;
  onOpenDiff: () => void;
  // Terminal controls
  canOpenTerminal: boolean;
  isTerminalSidebarOpen: boolean;
  onOpenTerminal: () => void;
  worktreePath: string | null;
  branch?: string | null;
  baseBranch?: string | null;
  // Chats sidebar (right) controls
  isChatsSidebarOpen: boolean;
  onToggleChatsSidebar: () => void;
  // Archive controls
  isArchived: boolean;
  onRestoreWorkspace: () => void;
  isRestoring: boolean;
  // MCP & Provider
  originalProjectPath?: string;
  effectiveProvider?: ProviderId;
}

export function ChatHeader({
  chatId,
  subChatId,
  isMobileFullscreen,
  isSidebarOpen,
  onToggleSidebar,
  hasAnyUnseenChanges,
  onCreateNewSubChat,
  onBackToChats,
  canOpenPreview,
  isPreviewSidebarOpen,
  onOpenPreview,
  sandboxId,
  canOpenDiff,
  diffStats,
  onOpenDiff,
  canOpenTerminal,
  isTerminalSidebarOpen,
  onOpenTerminal,
  worktreePath,
  branch,
  baseBranch,
  isChatsSidebarOpen,
  onToggleChatsSidebar,
  isArchived,
  onRestoreWorkspace,
  isRestoring,
  originalProjectPath,
  effectiveProvider,
}: ChatHeaderProps) {
  return (
    <div
      className={cn(
        "relative z-20 pointer-events-none",
        `shrink-0 ${CHAT_LAYOUT.headerPaddingSidebarClosed}`,
      )}
    >
      {/* Gradient background */}
      <div className="absolute inset-0" />
      <div className="pointer-events-auto flex items-center justify-between relative">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {/* Mobile header - simplified with chat name as trigger */}
          {isMobileFullscreen ? (
            <MobileChatHeader
              chatId={chatId}
              onCreateNew={onCreateNewSubChat}
              onBackToChats={onBackToChats}
              onOpenPreview={onOpenPreview}
              canOpenPreview={canOpenPreview}
              onOpenDiff={onOpenDiff}
              canOpenDiff={canOpenDiff}
              diffStats={diffStats}
              onOpenTerminal={onOpenTerminal}
              canOpenTerminal={canOpenTerminal}
              isArchived={isArchived}
              onRestore={onRestoreWorkspace}
            />
          ) : (
            <>
              {/* Header controls - desktop only */}
              <AgentsHeaderControls
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={onToggleSidebar}
                hasUnseenChanges={hasAnyUnseenChanges}
              />
              {/* Workspace context badge */}
              <WorkspaceContextBadge
                branch={branch}
                baseBranch={baseBranch}
                worktreePath={worktreePath}
              />
              {/* MCP Servers indicator */}
              <McpServersIndicator
                projectPath={originalProjectPath}
                providerId={effectiveProvider}
              />
              {/* Provider indicator */}
              <ProviderIndicator chatId={chatId} subChatId={subChatId} />
            </>
          )}
        </div>
        {/* Open Preview Button - shows when preview is closed (desktop only) */}
        {!isMobileFullscreen &&
          !isPreviewSidebarOpen &&
          sandboxId &&
          (canOpenPreview ? (
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenPreview}
                  className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground shrink-0 rounded-md ml-2"
                  aria-label="Open preview"
                >
                  <IconOpenSidebarRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open preview</TooltipContent>
            </Tooltip>
          ) : (
            <PreviewSetupHoverCard>
              <span className="inline-flex ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                  className="h-6 w-6 p-0 text-muted-foreground shrink-0 rounded-md cursor-not-allowed pointer-events-none"
                  aria-label="Preview not available"
                >
                  <IconOpenSidebarRight className="h-4 w-4" />
                </Button>
              </span>
            </PreviewSetupHoverCard>
          ))}
        {/* Terminal Button - shows when terminal is closed and worktree exists (desktop only) */}
        {!isMobileFullscreen && !isTerminalSidebarOpen && worktreePath && (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenTerminal}
                className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground shrink-0 rounded-md ml-2"
                aria-label="Open terminal"
              >
                <TerminalSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open terminal
              <Kbd>⌘J</Kbd>
            </TooltipContent>
          </Tooltip>
        )}
        {/* Chats Sidebar Toggle Button - shows on desktop only */}
        {!isMobileFullscreen && (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleChatsSidebar}
                className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground shrink-0 rounded-md ml-2"
                aria-label={isChatsSidebarOpen ? "Close chats" : "Open chats"}
              >
                {isChatsSidebarOpen ? (
                  <IconCloseSidebarRight className="h-4 w-4" />
                ) : (
                  <IconOpenSidebarRight className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isChatsSidebarOpen ? "Close chats" : "Open chats"}
              <Kbd>⌘⇧\</Kbd>
            </TooltipContent>
          </Tooltip>
        )}
        {/* Restore Button - shows when viewing archived workspace (desktop only) */}
        {!isMobileFullscreen && isArchived && (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={onRestoreWorkspace}
                disabled={isRestoring}
                className="h-6 px-2 gap-1.5 hover:bg-foreground/10 transition-colors text-foreground shrink-0 rounded-md ml-2 flex items-center"
                aria-label="Restore workspace"
              >
                <IconTextUndo className="h-4 w-4" />
                <span className="text-xs">Restore</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Restore workspace
              <Kbd>⇧⌘E</Kbd>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
