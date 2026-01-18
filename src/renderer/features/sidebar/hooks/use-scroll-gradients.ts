import { type RefObject, useCallback, useEffect, useState } from "react";

interface ScrollGradientsResult {
  showTopGradient: boolean;
  showBottomGradient: boolean;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  updateGradients: () => void;
}

/**
 * Hook for managing top/bottom gradient visibility based on scroll position.
 * Shows gradients when content is scrollable and not at the edge.
 */
export function useScrollGradients(
  containerRef: RefObject<HTMLDivElement | null>,
): ScrollGradientsResult {
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(false);

  const updateGradients = useCallback(
    (element?: HTMLDivElement) => {
      const container = element || containerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isScrollable = scrollHeight > clientHeight;

      if (!isScrollable) {
        setShowBottomGradient(false);
        setShowTopGradient(false);
        return;
      }

      const threshold = 5;
      const isAtTop = scrollTop <= threshold;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;

      setShowTopGradient(!isAtTop);
      setShowBottomGradient(!isAtBottom);
    },
    [containerRef],
  );

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      updateGradients(e.currentTarget);
    },
    [updateGradients],
  );

  // Initialize gradients on mount and observe container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateGradients();
    const resizeObserver = new ResizeObserver(() => updateGradients());
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [updateGradients, containerRef]);

  // Update gradients on window resize
  useEffect(() => {
    const handleResize = () => updateGradients();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, [updateGradients]);

  return {
    showTopGradient,
    showBottomGradient,
    handleScroll,
    updateGradients,
  };
}
