import { forwardRef } from "react";
import { cn } from "../../../lib/utils";

export interface SidebarScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  isMultiSelectMode?: boolean;
  showTopGradient?: boolean;
  showBottomGradient?: boolean;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  gradientColorClass?: string;
}

/**
 * Scroll container with optional top/bottom gradient overlays.
 * Used for scrollable sidebar lists.
 */
export const SidebarScrollContainer = forwardRef<
  HTMLDivElement,
  SidebarScrollContainerProps
>(function SidebarScrollContainer(
  {
    children,
    className,
    isMultiSelectMode = false,
    showTopGradient = false,
    showBottomGradient = false,
    onScroll,
    gradientColorClass = "from-background",
  },
  ref,
) {
  return (
    <div className="flex-1 min-h-0 relative">
      {/* Top gradient */}
      {showTopGradient && (
        <div
          className={cn(
            "absolute left-0 right-0 top-0 h-8 bg-gradient-to-b to-transparent pointer-events-none z-10",
            gradientColorClass,
          )}
        />
      )}

      {/* Bottom gradient */}
      {showBottomGradient && (
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0 h-8 bg-gradient-to-t to-transparent pointer-events-none z-10",
            gradientColorClass,
          )}
        />
      )}

      <div
        ref={ref}
        onScroll={onScroll}
        className={cn(
          "h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
          isMultiSelectMode ? "px-0" : "px-2",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
});
