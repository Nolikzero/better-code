"use client";

import { useEffect, useState } from "react";

export interface UseScrollTrackingOptions {
  scrollRef: React.RefObject<HTMLElement | null>;
  isOverlayMode: boolean;
}

export interface UseScrollTrackingReturn {
  isAtBottom: boolean;
}

/**
 * Hook to track scroll position and determine if user is at bottom of chat.
 * Used to auto-expand input when at bottom (non-overlay mode only).
 *
 * @param options.scrollRef - Ref to the scrollable element
 * @param options.isOverlayMode - Whether in overlay mode (disables tracking)
 * @returns isAtBottom - True if scroll position is within 100px of bottom
 */
export function useScrollTracking(
  options: UseScrollTrackingOptions,
): UseScrollTrackingReturn {
  const { scrollRef, isOverlayMode } = options;
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Track scroll position to auto-expand input when at bottom (non-overlay mode only)
  useEffect(() => {
    if (isOverlayMode) return; // Only for non-overlay mode
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      // Consider "at bottom" if within 100px of the bottom
      const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(nearBottom);
    };

    // Check initial position
    handleScroll();

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [isOverlayMode, scrollRef]);

  return { isAtBottom };
}
