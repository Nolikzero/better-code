/**
 * Terminal theme mapper for VS Code themes
 * 
 * Extracts terminal colors from VS Code theme and converts to xterm.js ITheme format
 */

import type { ITheme } from "xterm"
import { isLightColor } from "./vscode-to-css-mapping"

/**
 * Mapping from VS Code terminal color keys to xterm.js ITheme keys
 */
const TERMINAL_COLOR_MAP: Partial<Record<keyof ITheme, string[]>> = {
  background: ["terminal.background", "editor.background"],
  foreground: ["terminal.foreground", "editor.foreground", "foreground"],
  cursor: ["terminalCursor.foreground", "terminal.foreground", "editor.foreground"],
  cursorAccent: ["terminalCursor.background", "terminal.background", "editor.background"],
  selectionBackground: ["terminal.selectionBackground", "editor.selectionBackground"],
  selectionForeground: ["terminal.selectionForeground"],
  selectionInactiveBackground: ["terminal.inactiveSelectionBackground", "editor.inactiveSelectionBackground"],
  
  // Standard ANSI colors
  black: ["terminal.ansiBlack"],
  red: ["terminal.ansiRed"],
  green: ["terminal.ansiGreen"],
  yellow: ["terminal.ansiYellow"],
  blue: ["terminal.ansiBlue"],
  magenta: ["terminal.ansiMagenta"],
  cyan: ["terminal.ansiCyan"],
  white: ["terminal.ansiWhite"],
  
  // Bright ANSI colors
  brightBlack: ["terminal.ansiBrightBlack"],
  brightRed: ["terminal.ansiBrightRed"],
  brightGreen: ["terminal.ansiBrightGreen"],
  brightYellow: ["terminal.ansiBrightYellow"],
  brightBlue: ["terminal.ansiBrightBlue"],
  brightMagenta: ["terminal.ansiBrightMagenta"],
  brightCyan: ["terminal.ansiBrightCyan"],
  brightWhite: ["terminal.ansiBrightWhite"],
  // extendedAnsi is not mapped from VS Code themes
}

/**
 * Default dark terminal ANSI colors (fallback)
 */
const DEFAULT_DARK_ANSI: Partial<ITheme> = {
  black: "#18181b",
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  magenta: "#a855f7",
  cyan: "#06b6d4",
  white: "#f4f4f5",
  brightBlack: "#71717a",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#c084fc",
  brightCyan: "#22d3ee",
  brightWhite: "#fafafa",
}

/**
 * Default light terminal ANSI colors (fallback)
 */
const DEFAULT_LIGHT_ANSI: Partial<ITheme> = {
  black: "#18181b",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#f4f4f5",
  brightBlack: "#52525b",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#fafafa",
}

/**
 * Extract a color from VS Code theme colors using priority keys
 */
function getColorFromTheme(
  colors: Record<string, string>,
  priorityKeys: string[],
): string | undefined {
  for (const key of priorityKeys) {
    if (colors[key]) {
      return colors[key]
    }
  }
  return undefined
}

/**
 * Convert VS Code theme colors to xterm.js ITheme
 */
export function extractTerminalTheme(
  themeColors: Record<string, string>,
): ITheme {
  const theme: Partial<ITheme> = {}
  
  // Extract each terminal color (excluding extendedAnsi which is a string[])
  for (const [xtermKey, vsCodeKeys] of Object.entries(TERMINAL_COLOR_MAP)) {
    if (!vsCodeKeys) continue
    const color = getColorFromTheme(themeColors, vsCodeKeys)
    if (color) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(theme as any)[xtermKey] = color
    }
  }
  
  // Determine if this is a light or dark theme based on background
  const bgColor = theme.background || themeColors["editor.background"] || "#000000"
  const isLight = isLightColor(bgColor)
  
  // Apply default ANSI colors for any missing colors
  const defaultAnsi = isLight ? DEFAULT_LIGHT_ANSI : DEFAULT_DARK_ANSI
  
  // Ensure all required colors are present
  const finalTheme: ITheme = {
    background: theme.background || (isLight ? "#fafafa" : "#121212"),
    foreground: theme.foreground || (isLight ? "#0a0a0a" : "#f4f4f5"),
    cursor: theme.cursor || theme.foreground || (isLight ? "#0a0a0a" : "#f4f4f5"),
    cursorAccent: theme.cursorAccent || theme.background || (isLight ? "#fafafa" : "#121212"),
    selectionBackground: theme.selectionBackground || (isLight ? "#d4d4d8" : "#3f3f46"),
    selectionForeground: theme.selectionForeground,
    
    // ANSI colors with fallbacks
    black: theme.black || defaultAnsi.black,
    red: theme.red || defaultAnsi.red,
    green: theme.green || defaultAnsi.green,
    yellow: theme.yellow || defaultAnsi.yellow,
    blue: theme.blue || defaultAnsi.blue,
    magenta: theme.magenta || defaultAnsi.magenta,
    cyan: theme.cyan || defaultAnsi.cyan,
    white: theme.white || defaultAnsi.white,
    brightBlack: theme.brightBlack || defaultAnsi.brightBlack,
    brightRed: theme.brightRed || defaultAnsi.brightRed,
    brightGreen: theme.brightGreen || defaultAnsi.brightGreen,
    brightYellow: theme.brightYellow || defaultAnsi.brightYellow,
    brightBlue: theme.brightBlue || defaultAnsi.brightBlue,
    brightMagenta: theme.brightMagenta || defaultAnsi.brightMagenta,
    brightCyan: theme.brightCyan || defaultAnsi.brightCyan,
    brightWhite: theme.brightWhite || defaultAnsi.brightWhite,
  }
  
  return finalTheme
}

/**
 * Check if a VS Code theme has terminal colors defined
 */
export function hasTerminalColors(themeColors: Record<string, string>): boolean {
  return !!(
    themeColors["terminal.background"] ||
    themeColors["terminal.foreground"] ||
    themeColors["terminal.ansiBlack"]
  )
}
