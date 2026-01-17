/**
 * Themes module exports
 * 
 * This module provides full VS Code theme support for the application.
 */

// Theme provider
export {
  VSCodeThemeProvider,
  useVSCodeTheme,
  useTerminalTheme,
  useShikiTheme,
} from "./theme-provider"

// Builtin themes
export {
  BUILTIN_THEMES,
  getBuiltinThemeById,
  getBuiltinThemesByType,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_DARK_THEME_ID,
} from "./builtin-themes"

// Cursor themes (with full tokenColors)
export { CURSOR_DARK, CURSOR_LIGHT, CURSOR_MIDNIGHT } from "./cursor-themes"

// CSS variable mapping
export {
  generateCSSVariables,
  applyCSSVariables,
  removeCSSVariables,
  hexToHSL,
  isLightColor,
  getThemeTypeFromColors,
} from "./vscode-to-css-mapping"

// Terminal theme mapping
export { extractTerminalTheme, hasTerminalColors } from "./terminal-theme-mapper"

// Shiki theme loader
export {
  getHighlighter,
  loadFullTheme,
  ensureThemeLoaded,
  highlightCode,
  getLoadedThemes,
} from "./shiki-theme-loader"
