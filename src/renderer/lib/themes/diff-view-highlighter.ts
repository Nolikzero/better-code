/**
 * Diff View Theme Integration for @pierre/diffs
 *
 * This module provides theme mapping between our custom theme IDs
 * and @pierre/diffs bundled themes. The @pierre/diffs library handles
 * syntax highlighting internally using Shiki.
 */

import { preloadHighlighter } from "@pierre/diffs";

// Shiki themes supported by @pierre/diffs
const SUPPORTED_THEMES = [
  "github-dark",
  "github",
  "vitesse-dark",
  "vitesse-light",
  "min-dark",
  "min-light",
  "vesper",
];

// Common languages to preload for better performance
const COMMON_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "json",
  "css",
  "html",
  "markdown",
  "tsx",
  "jsx",
  "yaml",
  "bash",
  "shell",
];

/**
 * Map our custom theme IDs to @pierre/diffs bundled themes
 */
const THEME_TO_PIERRE_MAP: Record<string, string> = {
  "default-dark": "github-dark",
  "default-light": "github",
  "claude-dark": "github-dark",
  "claude-light": "github",
  "vesper-dark": "vesper",
  "vitesse-dark": "vitesse-dark",
  "vitesse-light": "vitesse-light",
  "min-dark": "min-dark",
  "min-light": "min-light",
};

/**
 * Get the @pierre/diffs theme for a given theme ID
 */
function _getPierreTheme(themeId: string, isDark: boolean): string {
  if (themeId in THEME_TO_PIERRE_MAP) {
    return THEME_TO_PIERRE_MAP[themeId];
  }
  return isDark ? "github-dark" : "github";
}

// Track if preloading has been initiated
let preloadingInitiated = false;

/**
 * Preload the diff highlighter resources on app start
 * This prevents the delay when opening the diff view for the first time
 */
export function preloadDiffHighlighter(): void {
  if (preloadingInitiated) return;
  preloadingInitiated = true;

  // Preload common themes and languages for @pierre/diffs
  preloadHighlighter({
    themes: SUPPORTED_THEMES as Parameters<
      typeof preloadHighlighter
    >[0]["themes"],
    langs: COMMON_LANGUAGES as Parameters<
      typeof preloadHighlighter
    >[0]["langs"],
  }).catch((err) => {
    console.warn("[preloadDiffHighlighter] Failed to preload:", err);
  });
}

// Legacy exports for backward compatibility (no-ops)
function _setDiffViewTheme(_themeId: string): void {
  // No-op: @pierre/diffs handles themes via props
}

async function _getDiffHighlighter(): Promise<null> {
  // No-op: @pierre/diffs handles highlighting internally
  return null;
}

// Type for backward compatibility
export type DiffHighlighter = null;
