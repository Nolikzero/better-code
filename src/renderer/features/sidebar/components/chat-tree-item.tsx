import { ChevronDown, ChevronRight, GitBranch, Plus } from "lucide-react";
import React, { useCallback, useState } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu";
import { ArchiveIcon } from "../../../components/ui/icons";
import { TypewriterText } from "../../../components/ui/typewriter-text";
import { cn } from "../../../lib/utils";
import type { AgentMode } from "../../agents/atoms";
import { SubChatContextMenu } from "../../agents/ui/sub-chat-context-menu";
import { ChatIcon } from "./chat-icon";
import { SubchatInlineItem } from "./subchat-inline-item";

export interface SubChatMeta {
  id: string;
  chatId: string;
  name: string | null;
  mode: AgentMode;
  createdAt: Date | null;
  updatedAt: Date | null;
  hasPendingPlanApproval: boolean | null;
  fileAdditions: number | null;
  fileDeletions: number | null;
  fileCount: number | null;
}

interface ChatTreeItemProps {
  id: string;
  name: string | null;
  branch?: string | null;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading: boolean;
  hasUnseenChanges?: boolean;
  hasPendingPlan?: boolean;
  isJustCreated?: boolean;
  subChats: SubChatMeta[];
  activeSubChatId?: string | null;
  loadingSubChatIds?: Set<string>;
  unseenSubChatIds?: Set<string>;
  gitOwner?: string | null;
  gitProvider?: string | null;
  // Aggregated file stats at workspace level
  fileAdditions?: number;
  fileDeletions?: number;
  fileCount?: number;

  // Events
  onToggleExpand: () => void;
  onSelect: () => void;
  onSelectSubChat: (subChatId: string) => void;
  onArchive?: () => void;
  onCreateSubChat?: () => void;

  // For context menus
  onContextMenu?: (e: React.MouseEvent) => void;
  onSubChatContextMenu?: (e: React.MouseEvent, subChatId: string) => void;
  onDeleteSubChat?: (subChatId: string) => void;
}

export const ChatTreeItem = React.memo(function ChatTreeItem({
  id,
  name,
  branch,
  isExpanded,
  isSelected,
  isLoading,
  hasUnseenChanges = false,
  hasPendingPlan = false,
  isJustCreated = false,
  subChats,
  activeSubChatId,
  loadingSubChatIds = new Set(),
  unseenSubChatIds = new Set(),
  gitOwner,
  gitProvider,
  fileAdditions,
  fileDeletions,
  onToggleExpand,
  onSelect,
  onSelectSubChat,
  onArchive,
  onCreateSubChat,
  onContextMenu,
  onSubChatContextMenu,
  onDeleteSubChat,
}: ChatTreeItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onSelect();
    },
    [onSelect],
  );

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand();
    },
    [onToggleExpand],
  );

  const handleCreateSubChat = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCreateSubChat?.();
    },
    [onCreateSubChat],
  );

  const hasSubChats = subChats.length > 0;

  return (
    <div className="select-none">
      {/* Chat header row */}
      <div
        onClick={handleClick}
        onContextMenu={onContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "w-full text-left py-1.5 cursor-pointer group relative flex items-start gap-1 mt-2",
          "transition-colors duration-150 rounded-md",
          "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
          "pl-1 pr-2",
          isSelected
            ? "bg-foreground/5 text-foreground"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
        )}
      >
        {/* Expand/collapse chevron */}
        <button
          type="button"
          onClick={handleChevronClick}
          className={cn(
            "p-0.5 shrink-0 transition-colors rounded",
            "hover:bg-foreground/10",
            !hasSubChats && "invisible",
          )}
          tabIndex={-1}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Chat icon */}
        <div className="pt-0.5">
          <ChatIcon
            isSelected={isSelected}
            isLoading={isLoading}
            hasUnseenChanges={hasUnseenChanges}
            hasPendingPlan={hasPendingPlan}
            gitOwner={gitOwner}
            gitProvider={gitProvider}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* Name row */}
          <div className="flex items-center gap-1">
            <span className="truncate block text-sm leading-tight flex-1">
              <TypewriterText
                text={name || ""}
                placeholder="New Workspace"
                id={id}
                isJustCreated={isJustCreated}
                showPlaceholder={true}
              />
            </span>

            {/* Hover actions */}
            {isHovered && !isLoading && (
              <div className="flex items-center gap-0.5 shrink-0">
                {/* New sub-chat button */}
                {onCreateSubChat && (
                  <button
                    type="button"
                    onClick={handleCreateSubChat}
                    tabIndex={-1}
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-foreground/10"
                    title="New chat"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Archive button */}
                {onArchive && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive();
                    }}
                    tabIndex={-1}
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-foreground/10"
                    title="Archive"
                  >
                    <ArchiveIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Branch badge */}
          {branch && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <GitBranch className="h-3 w-3" />
              <span className="truncate">{branch}</span>
            </div>
          )}

          {/* File stats at workspace level */}
          {((fileAdditions ?? 0) > 0 || (fileDeletions ?? 0) > 0) && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              {(fileAdditions ?? 0) > 0 && (
                <span className="text-green-600 dark:text-green-500">
                  +{fileAdditions}
                </span>
              )}
              {(fileDeletions ?? 0) > 0 && (
                <span className="text-red-600 dark:text-red-500">
                  -{fileDeletions}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded sub-chats */}
      {isExpanded && hasSubChats && (
        <div className="ml-5 border-l border-border/30 pl-1 mt-0.5">
          {subChats.map((subChat) => {
            const subChatItem = (
              <SubchatInlineItem
                id={subChat.id}
                name={subChat.name}
                mode={subChat.mode as "agent" | "plan"}
                isActive={activeSubChatId === subChat.id}
                isLoading={loadingSubChatIds.has(subChat.id)}
                hasUnseenChanges={unseenSubChatIds.has(subChat.id)}
                hasPendingPlan={subChat.hasPendingPlanApproval ?? false}
                fileAdditions={subChat.fileAdditions}
                fileDeletions={subChat.fileDeletions}
                updatedAt={subChat.updatedAt}
                gitOwner={gitOwner}
                gitProvider={gitProvider}
                onClick={() => onSelectSubChat(subChat.id)}
                onContextMenu={
                  onSubChatContextMenu
                    ? (e) => onSubChatContextMenu(e, subChat.id)
                    : undefined
                }
                onDelete={
                  onDeleteSubChat
                    ? () => onDeleteSubChat(subChat.id)
                    : undefined
                }
              />
            );

            // Render context menu directly - this avoids recreating render props
            // and allows React.memo to work properly
            if (onDeleteSubChat) {
              return (
                <ContextMenu key={subChat.id}>
                  <ContextMenuTrigger asChild>{subChatItem}</ContextMenuTrigger>
                  <SubChatContextMenu
                    subChat={subChat}
                    isPinned={false}
                    onTogglePin={() => {}}
                    onRename={() => {}}
                    onArchive={() => {}}
                    onArchiveOthers={() => {}}
                    onDelete={onDeleteSubChat}
                    isOnlyChat={subChats.length <= 1}
                  />
                </ContextMenu>
              );
            }

            return (
              <React.Fragment key={subChat.id}>{subChatItem}</React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
});
