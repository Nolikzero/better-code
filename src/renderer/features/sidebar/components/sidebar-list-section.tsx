import { cn } from "../../../lib/utils";

export interface SidebarListSectionProps {
  title: string;
  children: React.ReactNode;
  isMultiSelectMode?: boolean;
  className?: string;
}

/**
 * Section component for grouping sidebar list items with a header.
 * Used for "Pinned", "Recent", etc. sections.
 */
export function SidebarListSection({
  title,
  children,
  isMultiSelectMode = false,
  className,
}: SidebarListSectionProps) {
  return (
    <div className={className}>
      <div
        className={cn(
          "flex items-center h-4 mb-1",
          isMultiSelectMode ? "pl-3" : "pl-2",
        )}
      >
        <h3 className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {title}
        </h3>
      </div>
      <div className="list-none p-0 m-0">{children}</div>
    </div>
  );
}
