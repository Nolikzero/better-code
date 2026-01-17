"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "../../../lib/utils"

/**
 * Hybrid traffic lights component for macOS desktop app
 * - Shows native macOS traffic lights when hovered
 * - Shows custom muted circles when NOT hovered (for visual indication)
 * Note: isDesktop prop should be passed from parent after mount to avoid hydration mismatch
 */
export function TrafficLights({
  isHovered = true,
  isFullscreen = null,
  isDesktop = false,
  className = "",
  onHoverChange,
}: {
  isHovered?: boolean
  isFullscreen?: boolean | null
  isDesktop?: boolean
  className?: string
  onHoverChange?: (hovered: boolean) => void
}) {
  const prevHoveredRef = useRef(isHovered)

  // Toggle native traffic light visibility based on hover state
  useEffect(() => {
    if (!isDesktop || isFullscreen) return
    if (typeof window === "undefined" || !window.desktopApi?.setTrafficLightVisibility) return

    // Only update if hover state changed
    if (prevHoveredRef.current !== isHovered) {
      prevHoveredRef.current = isHovered
      window.desktopApi.setTrafficLightVisibility(isHovered)
    }
  }, [isHovered, isDesktop, isFullscreen])

  // NOTE: Removed mount effect that hides native lights
  // Native lights are shown by default (main process), and AgentsLayout controls visibility
  // This prevents the "flash of hidden lights" during loading state

  // Only show in desktop app, hide in fullscreen (native traffic lights always show in fullscreen)
  // isFullscreen === true means fullscreen, null or false means not fullscreen
  if (!isDesktop || isFullscreen === true) return null

  // When hovered, native lights are visible - render invisible placeholder to maintain layout
  if (isHovered) {
    return (
      <div
        className={cn("relative", className)}
        style={{
          // @ts-expect-error - WebKit-specific property
          WebkitAppRegion: "no-drag",
        }}
        data-sidebar-content
      >
        <div className="flex items-center gap-2" data-sidebar-content>
          <div className="w-3 h-3" />
          <div className="w-3 h-3" />
          <div className="w-3 h-3" />
        </div>
      </div>
    )
  }

  // When NOT hovered, native lights are hidden - show custom muted circles
  return (
    <div
      className={cn("relative", className)}
      style={{
        // @ts-expect-error - WebKit-specific property
        WebkitAppRegion: "no-drag",
      }}
      data-sidebar-content
    >
      {/* Muted traffic lights - just circles with border */}
      <div className="flex items-center gap-2" data-sidebar-content>
        <div
          className="w-3 h-3 rounded-full border border-foreground/20 bg-transparent"
          aria-hidden="true"
        />
        <div
          className="w-3 h-3 rounded-full border border-foreground/20 bg-transparent"
          aria-hidden="true"
        />
        <div
          className="w-3 h-3 rounded-full border border-foreground/20 bg-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

/**
 * Spacer component for macOS traffic light buttons (close/minimize/maximize)
 * Only renders in Electron desktop app to provide space for the buttons
 * Animates height smoothly when appearing/disappearing (e.g. fullscreen transitions)
 * 
 * isFullscreen can be:
 * - null: not initialized yet (no animation, assume not fullscreen)
 * - boolean: initialized (animate only on real changes)
 */
export function TrafficLightSpacer({
  isFullscreen = null,
  isDesktop = false,
  className = "",
}: {
  isFullscreen?: boolean | null
  isDesktop?: boolean
  className?: string
}) {
  const prevFullscreenRef = useRef(isFullscreen)
  const [shouldAnimate, setShouldAnimate] = useState(false)

  useEffect(() => {
    // Enable animation only after first real fullscreen change (not initial load)
    // Both previous and current must be non-null (initialized) and different
    if (
      isFullscreen !== null &&
      prevFullscreenRef.current !== null &&
      prevFullscreenRef.current !== isFullscreen
    ) {
      setShouldAnimate(true)
    }
    prevFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  // Show spacer when desktop and not fullscreen
  // If isFullscreen is null (not initialized), assume not fullscreen
  const shouldShow = isDesktop && isFullscreen !== true

  return (
    <div
      className={cn(
        "w-full shrink-0 overflow-hidden",
        shouldAnimate && "transition-[height] duration-200 ease-out",
        className,
      )}
      style={{ height: shouldShow ? 32 : 0 }}
    />
  )
}

/**
 * Wrapper to make child elements non-draggable within a draggable region
 */
export function NoDrag({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        // @ts-expect-error - WebKit-specific property
        WebkitAppRegion: "no-drag",
      }}
    >
      {children}
    </div>
  )
}
