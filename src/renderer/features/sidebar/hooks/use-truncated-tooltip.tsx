import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipState {
  visible: boolean;
  position: { top: number; left: number };
  name: string;
}

interface TruncatedTooltipResult {
  tooltip: TooltipState | null;
  nameRefs: React.MutableRefObject<Map<string, HTMLSpanElement>>;
  handleMouseEnter: (id: string, name: string, element: HTMLElement) => void;
  handleMouseLeave: () => void;
  TooltipPortal: React.FC;
}

/**
 * Hook for managing tooltips that appear when text is truncated.
 * Shows tooltip after a delay only if the text is actually truncated.
 */
export function useTruncatedTooltip(delay = 1000): TruncatedTooltipResult {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const nameRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(
    (id: string, name: string, cardElement: HTMLElement) => {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const nameEl = nameRefs.current.get(id);
      if (!nameEl) return;

      // Check if name is truncated
      const isTruncated = nameEl.scrollWidth > nameEl.clientWidth;
      if (!isTruncated) return;

      // Show tooltip after delay
      timerRef.current = setTimeout(() => {
        const rect = cardElement.getBoundingClientRect();
        setTooltip({
          visible: true,
          position: {
            top: rect.top + rect.height / 2,
            left: rect.right + 8,
          },
          name,
        });
      }, delay);
    },
    [delay],
  );

  const handleMouseLeave = useCallback(() => {
    // Clear timer if hovering ends before delay
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTooltip(null);
  }, []);

  const TooltipPortal: React.FC = useCallback(() => {
    if (!tooltip?.visible || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <div
        className="fixed z-[100000] max-w-xs px-2 py-1 text-xs bg-popover border border-border rounded-md shadow-lg dark pointer-events-none"
        style={{
          top: tooltip.position.top,
          left: tooltip.position.left,
          transform: "translateY(-50%)",
        }}
      >
        <div className="text-foreground/90 whitespace-nowrap">
          {tooltip.name}
        </div>
      </div>,
      document.body,
    );
  }, [tooltip]);

  return {
    tooltip,
    nameRefs,
    handleMouseEnter,
    handleMouseLeave,
    TooltipPortal,
  };
}
