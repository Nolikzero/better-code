import { useAtom } from "jotai";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type ScrollPositionData,
  agentsScrollPositionsAtom,
  scrollPositionsCacheStore,
} from "../atoms";

export interface UseChatScrollOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  subChatId: string;
  messages: Array<{ id?: string; role: string }>;
  status: string;
}

export interface UseChatScrollReturn {
  shouldAutoScroll: boolean;
  scrollToBottom: () => void;
}

/**
 * Manages scroll behavior for chat containers including:
 * - Auto-scroll during streaming
 * - Position persistence across tab switches
 * - Smart scroll to response start when streaming finishes
 * - Scroll position restoration with content-ready detection
 */
export function useChatScroll({
  containerRef,
  subChatId,
  messages,
  status,
}: UseChatScrollOptions): UseChatScrollReturn {
  // Auto-scroll state
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const shouldAutoScrollRef = useRef(true);
  const lastScrollUpdateRef = useRef(0);

  // Scroll position persistence (atom for localStorage, cache for sync access)
  const [scrollPositions, setScrollPositions] = useAtom(
    agentsScrollPositionsAtom,
  );

  // Skip auto-scroll immediately after restore (state update is async, so use ref)
  const justRestoredRef = useRef(false);

  // Track current scroll position in ref (for saving on cleanup - container ref may point to new container)
  const currentScrollTopRef = useRef(0);
  // Track current scrollHeight for validation
  const currentScrollHeightRef = useRef(0);
  // Track current status for save cleanup (to know if we were streaming when leaving)
  const currentStatusRef = useRef<string>("ready");
  // Track last assistant message ID for smart scroll restoration
  const lastAssistantMsgIdRef = useRef<string | undefined>(undefined);
  // Ref to track if scroll has been restored for this sub-chat
  const scrollRestoredRef = useRef(false);

  // Track previous subChatId to skip auto-scroll on tab switch
  const prevSubChatIdForAutoScrollRef = useRef<string | null>(null);

  // Track previous status for streaming-finished detection
  const prevStatusRef = useRef(status);

  // Check if user is at bottom of chat
  const isAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const threshold = 50; // pixels from bottom
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      threshold
    );
  }, [containerRef]);

  // Handle scroll events to detect user scrolling (throttled)
  // Updates shouldAutoScroll and tracks position in ref for cleanup
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Always track current position (for cleanup to use)
    currentScrollTopRef.current = container.scrollTop;
    currentScrollHeightRef.current = container.scrollHeight;

    // Throttle state updates to reduce re-renders
    const now = Date.now();
    if (now - lastScrollUpdateRef.current > 100) {
      lastScrollUpdateRef.current = now;
      const newIsAtBottom = isAtBottom();
      setShouldAutoScroll(newIsAtBottom);
      shouldAutoScrollRef.current = newIsAtBottom;
    }
  }, [containerRef, isAtBottom]);

  // Scroll to bottom utility
  const scrollToBottom = useCallback(() => {
    shouldAutoScrollRef.current = true;
    const container = containerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [containerRef]);

  // Stream-finished scroll: scroll to plan/response start when streaming finishes
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    const nowFinished = status !== "streaming" && status !== "submitted";
    const streamingJustFinished = wasStreaming && nowFinished;

    prevStatusRef.current = status;

    // When streaming finishes and user was following along (auto-scroll enabled),
    // scroll to the start of the response/plan instead of staying at bottom
    if (streamingJustFinished && shouldAutoScrollRef.current) {
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;

        // Find the last assistant message element
        const allAssistantEls = container.querySelectorAll(
          "[data-assistant-message-id]",
        );
        const lastAssistantElement =
          allAssistantEls[allAssistantEls.length - 1];
        if (!lastAssistantElement) return;

        // Check if it has a collapsed steps section OR a plan section
        const hasCollapsedSection = lastAssistantElement.querySelector(
          "[data-collapsible-steps]",
        );
        const hasPlanSection = lastAssistantElement.querySelector(
          "[data-plan-section]",
        );

        if (hasCollapsedSection || hasPlanSection) {
          // Scroll to the start of this response
          const rect = lastAssistantElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const scrollPos =
            container.scrollTop + (rect.top - containerRect.top) - 120; // 120px padding
          container.scrollTop = Math.max(0, scrollPos);
          currentScrollTopRef.current = container.scrollTop;
          shouldAutoScrollRef.current = false;
          setShouldAutoScroll(false);
        }
      });
    }
  }, [status, containerRef]);

  // Keep refs updated for scroll save cleanup to use
  useEffect(() => {
    currentStatusRef.current = status;
    // Find last assistant message ID
    const lastAssistantMsg = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    lastAssistantMsgIdRef.current = lastAssistantMsg?.id;
  }, [status, messages]);

  // Save scroll position when LEAVING this tab (useLayoutEffect for synchronous save before unmount)
  useLayoutEffect(() => {
    const currentSubChatId = subChatId;
    const currentMessageCount = messages.length;

    return () => {
      // Save position synchronously before unmount
      const container = containerRef.current;
      if (container) {
        const wasStreaming =
          currentStatusRef.current === "streaming" ||
          currentStatusRef.current === "submitted";
        const scrollData: ScrollPositionData = {
          scrollTop: currentScrollTopRef.current,
          scrollHeight:
            currentScrollHeightRef.current || container.scrollHeight,
          messageCount: currentMessageCount,
          wasStreaming,
          lastAssistantMsgId: lastAssistantMsgIdRef.current,
        };
        // Save to SYNCHRONOUS cache first (for immediate reads on next tab switch)
        scrollPositionsCacheStore.set(currentSubChatId, scrollData);
        // Also save to atom for localStorage persistence
        setScrollPositions((prev) => ({
          ...prev,
          [currentSubChatId]: scrollData,
        }));
      }
    };
  }, [subChatId, messages.length, setScrollPositions, containerRef]);

  // Restore scroll position on mount with content-ready detection
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset tracking refs on sub-chat change
    scrollRestoredRef.current = false;

    // Read saved position data - FIRST from synchronous cache, then fallback to atom
    // The cache is updated synchronously in cleanup, while atom updates are async
    const cachedData = scrollPositionsCacheStore.get(subChatId);
    const atomData = scrollPositions[subChatId];
    const savedData = cachedData ?? atomData;

    // Function to attempt scroll restoration
    const restoreScroll = (_source: string): boolean => {
      if (scrollRestoredRef.current) return true;

      const currentContainer = containerRef.current;
      if (!currentContainer) return false;

      if (savedData !== undefined) {
        // Validate: only restore if we have similar content
        // If message count matches and scrollHeight is sufficient, restore position
        const canRestore =
          currentContainer.scrollHeight >= savedData.scrollTop &&
          (messages.length === savedData.messageCount ||
            currentContainer.scrollHeight >= savedData.scrollHeight * 0.8); // Allow 20% variance

        if (canRestore) {
          currentContainer.scrollTop = savedData.scrollTop;
          currentScrollTopRef.current = savedData.scrollTop;
          currentScrollHeightRef.current = currentContainer.scrollHeight;
          scrollRestoredRef.current = true;
          justRestoredRef.current = true;

          // Calculate if user WAS at bottom when they LEFT (using saved data, not current DOM)
          // This is critical because content may have grown while away
          const clientHeight = currentContainer.clientHeight;
          const wasAtBottomWhenLeft =
            savedData.scrollTop + clientHeight >= savedData.scrollHeight - 50; // 50px threshold

          const atBottomNow = isAtBottom();
          setShouldAutoScroll(atBottomNow);
          shouldAutoScrollRef.current = atBottomNow;

          const contentGrew =
            currentContainer.scrollHeight > savedData.scrollHeight;
          const newMessagesAdded = messages.length > savedData.messageCount;
          const streamingFinished =
            savedData.wasStreaming &&
            status !== "streaming" &&
            status !== "submitted";

          // SMART SCROLL: If was at bottom, streaming finished, and new content arrived
          if (
            wasAtBottomWhenLeft &&
            streamingFinished &&
            (contentGrew || newMessagesAdded)
          ) {
            requestAnimationFrame(() => {
              // Find the last assistant message element
              const allAssistantEls = currentContainer.querySelectorAll(
                "[data-assistant-message-id]",
              );
              const lastAssistantElement =
                allAssistantEls[allAssistantEls.length - 1];

              // Check if it has a collapsed steps section OR a plan section
              // These indicate there's substantial content worth scrolling to the start
              const hasCollapsedSection = lastAssistantElement?.querySelector(
                "[data-collapsible-steps]",
              );
              const hasPlanSection = lastAssistantElement?.querySelector(
                "[data-plan-section]",
              );

              if (hasCollapsedSection || hasPlanSection) {
                // Has collapsed section or plan - scroll to start of this response
                const rect = lastAssistantElement.getBoundingClientRect();
                const containerRect = currentContainer.getBoundingClientRect();
                const scrollPos =
                  currentContainer.scrollTop +
                  (rect.top - containerRect.top) -
                  120; // 120px padding to clear user message shadow
                currentContainer.scrollTop = Math.max(0, scrollPos);
                currentScrollTopRef.current = currentContainer.scrollTop;
                shouldAutoScrollRef.current = false;
                setShouldAutoScroll(false);
              } else {
                // No collapsed section and no plan - just scroll to bottom
                currentContainer.scrollTop = currentContainer.scrollHeight;
                currentScrollTopRef.current = currentContainer.scrollHeight;
                shouldAutoScrollRef.current = false;
                setShouldAutoScroll(false);
              }
            });
            return true;
          }

          // If still streaming and was at bottom, scroll to actual bottom (follow the stream)
          if (
            wasAtBottomWhenLeft &&
            contentGrew &&
            (status === "streaming" || status === "submitted")
          ) {
            requestAnimationFrame(() => {
              currentContainer.scrollTop = currentContainer.scrollHeight;
              currentScrollTopRef.current = currentContainer.scrollHeight;
              shouldAutoScrollRef.current = true;
              setShouldAutoScroll(true);
            });
          }
          return true;
        }
      } else if (
        currentContainer.scrollHeight > currentContainer.clientHeight
      ) {
        // First time opening this sub-chat with content - scroll to bottom
        currentContainer.scrollTop = currentContainer.scrollHeight;
        currentScrollTopRef.current = currentContainer.scrollHeight;
        scrollRestoredRef.current = true;
        setShouldAutoScroll(true);
        shouldAutoScrollRef.current = true;
        return true;
      } else if (messages.length === 0) {
        // Empty chat - mark as restored (nothing to scroll)
        scrollRestoredRef.current = true;
        setShouldAutoScroll(true);
        shouldAutoScrollRef.current = true;
        return true;
      }

      return false;
    };

    // Try immediate restoration
    if (restoreScroll("immediate")) return;

    // If not restored, use ResizeObserver to wait for content to render
    let attempts = 0;
    const maxAttempts = 15; // More attempts for slow renders

    const resizeObserver = new ResizeObserver(() => {
      attempts++;
      if (
        restoreScroll(`ResizeObserver(${attempts})`) ||
        attempts >= maxAttempts
      ) {
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(container);

    // Also try with rAF chain as fallback
    const tryWithRAF = (count: number) => {
      if (scrollRestoredRef.current || count >= 5) return;

      requestAnimationFrame(() => {
        if (restoreScroll(`rAF(${count})`)) return;
        tryWithRAF(count + 1);
      });
    };

    requestAnimationFrame(() => tryWithRAF(0));

    return () => {
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subChatId]); // Only trigger on sub-chat change, not on messages change

  // Attach scroll listener (separate effect)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, handleScroll]);

  // Auto scroll to bottom when messages change (only if user is at bottom)
  // Skip on tab switch and right after restore
  useEffect(() => {
    const isTabSwitch =
      prevSubChatIdForAutoScrollRef.current !== null &&
      prevSubChatIdForAutoScrollRef.current !== subChatId;
    prevSubChatIdForAutoScrollRef.current = subChatId;

    if (isTabSwitch) return;

    // Skip if we just restored scroll position (prevents interference with restoration)
    if (justRestoredRef.current) {
      justRestoredRef.current = false;
      return;
    }

    // Skip if scroll restoration is still in progress (ResizeObserver may still be working)
    if (!scrollRestoredRef.current) return;

    // Only auto-scroll during active streaming when user is at bottom
    if (shouldAutoScrollRef.current && status === "streaming") {
      const container = containerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [messages, status, subChatId, containerRef]); // Note: shouldAutoScroll intentionally not in deps - we only want to scroll on message/status changes, not when user scrolls to bottom

  return {
    shouldAutoScroll,
    scrollToBottom,
  };
}
