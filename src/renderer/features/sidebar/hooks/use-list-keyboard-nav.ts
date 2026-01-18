import { type RefObject, useCallback, useEffect, useState } from "react";

interface ListKeyboardNavResult {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  resetFocus: () => void;
}

interface UseListKeyboardNavOptions<T> {
  items: T[];
  onSelect: (item: T, index: number) => void;
  onCancel?: () => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  itemSelector?: string;
}

/**
 * Hook for keyboard navigation in lists.
 * Handles arrow up/down, enter to select, escape to cancel.
 */
export function useListKeyboardNav<T>({
  items,
  onSelect,
  onCancel,
  scrollContainerRef,
  itemSelector = "[data-chat-index]",
}: UseListKeyboardNavOptions<T>): ListKeyboardNavResult {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Reset focus when items change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [items.length]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && items.length > 0 && scrollContainerRef?.current) {
      const focusedElement = scrollContainerRef.current.querySelector(
        `${itemSelector}="${focusedIndex}"]`,
      ) as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [focusedIndex, items.length, scrollContainerRef, itemSelector]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setFocusedIndex(-1);
        onCancel?.();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev === -1) return 0;
          return prev < items.length - 1 ? prev + 1 : prev;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev === -1) return items.length - 1;
          return prev > 0 ? prev - 1 : prev;
        });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          const item = items[focusedIndex];
          if (item) {
            onSelect(item, focusedIndex);
            setFocusedIndex(-1);
          }
        }
        return;
      }
    },
    [items, focusedIndex, onSelect, onCancel],
  );

  const resetFocus = useCallback(() => {
    setFocusedIndex(-1);
  }, []);

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    resetFocus,
  };
}
