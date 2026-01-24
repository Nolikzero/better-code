import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils";

export interface SidebarListSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  isMultiSelectMode?: boolean;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  showBorder?: boolean;
  className?: string;
}

/**
 * Section component for grouping sidebar list items with a compact header.
 * Supports collapsible content, item count, inline actions, and border separators.
 */
export function SidebarListSection({
  title,
  count,
  children,
  isMultiSelectMode = false,
  isCollapsed = false,
  onToggleCollapsed,
  actionLabel,
  onAction,
  showBorder = false,
  className,
}: SidebarListSectionProps) {
  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      {/* Section header */}
      <div
        className={cn(
          "flex items-center justify-between py-1.5",
          showBorder && "border-t border-border/30",
          isMultiSelectMode ? "px-3" : "px-3",
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex items-center gap-1 cursor-pointer"
          tabIndex={-1}
        >
          {onToggleCollapsed &&
            (isCollapsed ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            ))}
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            {title}
            {count !== undefined && ` (${count})`}
          </span>
        </button>
        {actionLabel && onAction && !isCollapsed && (
          <button
            type="button"
            onClick={onAction}
            className="text-[11px] text-primary/80 hover:text-primary transition-colors"
            tabIndex={-1}
          >
            {actionLabel}
          </button>
        )}
      </div>
      {/* Collapsible content */}
      {!isCollapsed && <div className="list-none p-0 m-0">{children}</div>}
    </div>
  );
}
