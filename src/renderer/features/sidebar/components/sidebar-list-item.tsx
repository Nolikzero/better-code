import React, { type RefCallback } from "react";
import { ArchiveIcon } from "../../../components/ui/icons";
import { TypewriterText } from "../../../components/ui/typewriter-text";
import { cn } from "../../../lib/utils";

interface SidebarListItemProps {
  id: string;
  name: string | null;
  icon: React.ReactNode;
  isSelected: boolean;
  isFocused?: boolean;
  isChecked?: boolean;
  isMultiSelectMode?: boolean;
  isMobileFullscreen?: boolean;

  // Metadata displayed below the name
  metadata?: React.ReactNode;

  // Hover action
  onArchive?: () => void;
  archiveLabel?: string;

  // Events
  onClick?: (e: React.MouseEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: () => void;

  // Typewriter
  isJustCreated?: boolean;
  placeholder?: string;

  // Ref for name element (for truncation detection)
  nameRefCallback?: RefCallback<HTMLSpanElement>;

  // Data attributes for keyboard navigation
  dataIndex?: number;
  dataAttribute?: string;
  // Marker attribute (no value, just presence) for CSS targeting
  dataMarkerAttribute?: string;
}

/**
 * Shared list item component for sidebar items.
 * Handles styling, selection states, hover actions, and typewriter text.
 */
export const SidebarListItem = React.memo(function SidebarListItem({
  id,
  name,
  icon,
  isSelected,
  isFocused = false,
  isChecked = false,
  isMultiSelectMode = false,
  isMobileFullscreen = false,
  metadata,
  onArchive,
  archiveLabel = "Archive",
  onClick,
  onTouchEnd,
  onKeyDown,
  onMouseEnter,
  onMouseLeave,
  isJustCreated = false,
  placeholder = "New Chat",
  nameRefCallback,
  dataIndex,
  dataAttribute = "data-chat-index",
  dataMarkerAttribute,
}: SidebarListItemProps) {
  const dataProps: Record<string, number | string | undefined> = {};
  if (dataAttribute && dataIndex !== undefined) {
    dataProps[dataAttribute] = dataIndex;
  }
  if (dataMarkerAttribute) {
    dataProps[dataMarkerAttribute] = "";
  }

  return (
    <div
      {...dataProps}
      onClick={onClick}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "w-full text-left py-1.5 cursor-pointer group relative",
        // Disable transitions on mobile for instant tap response
        !isMobileFullscreen && "transition-colors duration-150",
        "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
        // In multi-select: px-3 compensates for removed container px-2, keeping text aligned
        isMultiSelectMode ? "px-3" : "pl-2 pr-2",
        !isMultiSelectMode && "rounded-md",
        isSelected
          ? "bg-foreground/5 text-foreground"
          : isChecked
            ? "bg-foreground/5 text-foreground"
            : isFocused
              ? "bg-foreground/5 text-foreground"
              : // On mobile, no hover effect to prevent double-tap issue
                isMobileFullscreen
                ? "text-muted-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5">{icon}</div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* Top line: Name + Archive button */}
          <div className="flex items-center gap-1">
            <span
              ref={nameRefCallback}
              className="truncate block text-sm leading-tight flex-1"
            >
              <TypewriterText
                text={name || ""}
                placeholder={placeholder}
                id={id}
                isJustCreated={isJustCreated}
                showPlaceholder={true}
              />
            </span>
            {/* Archive button - shown on group hover via CSS, hidden in multi-select and mobile */}
            {onArchive && !isMultiSelectMode && !isMobileFullscreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                tabIndex={-1}
                className="shrink-0 text-muted-foreground hover:text-foreground active:text-foreground transition-[opacity,transform,color] duration-150 ease-out opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto active:scale-[0.97]"
                aria-label={archiveLabel}
              >
                <ArchiveIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Bottom line: Metadata */}
          {metadata && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 min-w-0">
              {metadata}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
