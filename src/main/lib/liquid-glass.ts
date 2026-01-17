/**
 * Liquid Glass Manager
 *
 * Encapsulates the electron-liquid-glass functionality for macOS 26+ (Tahoe).
 * Falls back gracefully on older macOS versions and other platforms.
 */

import type { BrowserWindow } from "electron"

// Types for electron-liquid-glass
interface GlassOptions {
  cornerRadius?: number
  tintColor?: string // RGBA hex (e.g., '#44000010')
  opaque?: boolean
}

interface LiquidGlassModule {
  addView: (windowHandle: Buffer, options?: GlassOptions) => number
  removeView: (glassId: number) => void
  unstable_setVariant?: (glassId: number, variant: number) => void
  unstable_setScrim?: (glassId: number, scrim: number) => void
  unstable_setSubdued?: (glassId: number, subdued: number) => void
}

// State
let liquidGlassModule: LiquidGlassModule | null = null
let currentGlassId: number | null = null
let isInitialized = false
let initializationError: string | null = null

/**
 * Initialize the liquid glass module
 * Should be called once at app startup
 */
export function initLiquidGlass(): boolean {
  if (isInitialized) return liquidGlassModule !== null

  try {
    // Dynamic import to handle platforms where the module isn't available
    liquidGlassModule = require("electron-liquid-glass")
    isInitialized = true
    console.log("[LiquidGlass] Module loaded successfully")
    return true
  } catch (error) {
    isInitialized = true
    initializationError =
      error instanceof Error ? error.message : "Unknown error"
    console.log(
      "[LiquidGlass] Module not available (expected on non-macOS 26+):",
      initializationError
    )
    return false
  }
}

/**
 * Check if liquid glass is supported on the current platform
 */
export function isLiquidGlassSupported(): boolean {
  if (!isInitialized) {
    initLiquidGlass()
  }
  return liquidGlassModule !== null
}

/**
 * Get initialization error if any
 */
export function getLiquidGlassError(): string | null {
  return initializationError
}

/**
 * Enable liquid glass effect on a window
 * @param window The BrowserWindow to apply the effect to
 * @param options Glass appearance options
 * @returns The glass view ID if successful, null otherwise
 */
export function enableLiquidGlass(
  window: BrowserWindow,
  options?: GlassOptions
): number | null {
  if (!liquidGlassModule) {
    console.log("[LiquidGlass] Cannot enable - module not available")
    return null
  }

  // Remove existing glass view if any
  if (currentGlassId !== null) {
    disableLiquidGlass()
  }

  try {
    const handle = window.getNativeWindowHandle()
    currentGlassId = liquidGlassModule.addView(handle, options)
    console.log("[LiquidGlass] Enabled with ID:", currentGlassId)
    return currentGlassId
  } catch (error) {
    console.error("[LiquidGlass] Failed to enable:", error)
    return null
  }
}

/**
 * Disable liquid glass effect
 */
export function disableLiquidGlass(): void {
  if (!liquidGlassModule || currentGlassId === null) {
    return
  }

  try {
    liquidGlassModule.removeView(currentGlassId)
    console.log("[LiquidGlass] Disabled (was ID:", currentGlassId, ")")
    currentGlassId = null
  } catch (error) {
    console.error("[LiquidGlass] Failed to disable:", error)
  }
}

/**
 * Get current liquid glass state
 */
export function getLiquidGlassState(): {
  supported: boolean
  enabled: boolean
  glassId: number | null
  error: string | null
} {
  return {
    supported: isLiquidGlassSupported(),
    enabled: currentGlassId !== null,
    glassId: currentGlassId,
    error: initializationError,
  }
}

/**
 * Update liquid glass options on the current view
 * Note: To update options, we need to remove and re-add the view
 */
export function updateLiquidGlass(
  window: BrowserWindow,
  options?: GlassOptions
): boolean {
  if (!liquidGlassModule || currentGlassId === null) {
    return false
  }

  // Remove existing and create new with updated options
  disableLiquidGlass()
  return enableLiquidGlass(window, options) !== null
}
