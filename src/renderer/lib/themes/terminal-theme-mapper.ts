/**
 * Terminal theme mapper for VS Code themes
 *
 * Extracts terminal colors from VS Code theme and converts to xterm.js ITheme format
 */

import type { ITheme } from "@xterm/xterm";
import { isLightColor } from "./vscode-to-css-mapping";

/**
 * Mapping from VS Code terminal color keys to xterm.js ITheme keys
 */
const TERMINAL_COLOR_MAP: Partial<Record<keyof ITheme, string[]>> = {
  background: ["terminal.background", "editor.background"],
  foreground: ["terminal.foreground", "editor.foreground", "foreground"],
  cursor: [
    "terminalCursor.foreground",
    "terminal.foreground",
    "editor.foreground",
  ],
  cursorAccent: [
    "terminalCursor.background",
    "terminal.background",
    "editor.background",
  ],
  selectionBackground: [
    "terminal.selectionBackground",
    "editor.selectionBackground",
  ],
  selectionForeground: ["terminal.selectionForeground"],
  selectionInactiveBackground: [
    "terminal.inactiveSelectionBackground",
    "editor.inactiveSelectionBackground",
  ],

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
};

/**
 * Default dark terminal ANSI colors (fallback)
 */
const DEFAULT_DARK_ANSI: Partial<ITheme> = {
  black: "#21222c",
  red: "#ff5555",
  green: "#50fa7b",
  yellow: "#f1fa8c",
  blue: "#8be9fd",
  magenta: "#ff79c6",
  cyan: "#8be9fd",
  white: "#f8f8f2",
  brightBlack: "#6272a4",
  brightRed: "#ff6e6e",
  brightGreen: "#69ff94",
  brightYellow: "#ffffa5",
  brightBlue: "#d6acff",
  brightMagenta: "#ff92df",
  brightCyan: "#a4ffff",
  brightWhite: "#ffffff",
};

/**
 * Default light terminal ANSI colors (fallback)
 */
const DEFAULT_LIGHT_ANSI: Partial<ITheme> = {
  black: "#1f1f1f",
  red: "#cb3a2a",
  green: "#14710a",
  yellow: "#846e15",
  blue: "#036a96",
  magenta: "#a3144d",
  cyan: "#036a96",
  white: "#fffbeb",
  brightBlack: "#6c664b",
  brightRed: "#e14938",
  brightGreen: "#238416",
  brightYellow: "#9a821d",
  brightBlue: "#087fab",
  brightMagenta: "#b52360",
  brightCyan: "#087fab",
  brightWhite: "#fffdf5",
};

/**
 * Extract a color from VS Code theme colors using priority keys
 */
function getColorFromTheme(
  colors: Record<string, string>,
  priorityKeys: string[],
): string | undefined {
  for (const key of priorityKeys) {
    if (colors[key]) {
      return colors[key];
    }
  }
  return undefined;
}

/**
 * Convert VS Code theme colors to xterm.js ITheme
 */
export function extractTerminalTheme(
  themeColors: Record<string, string>,
): ITheme {
  const theme: Partial<ITheme> = {};

  // Extract each terminal color (excluding extendedAnsi which is a string[])
  for (const [xtermKey, vsCodeKeys] of Object.entries(TERMINAL_COLOR_MAP)) {
    if (!vsCodeKeys) continue;
    const color = getColorFromTheme(themeColors, vsCodeKeys);
    if (color) {
      Object.assign(theme, { [xtermKey]: color });
    }
  }

  // Determine if this is a light or dark theme based on background
  const bgColor =
    theme.background || themeColors["editor.background"] || "#000000";
  const isLight = isLightColor(bgColor);

  // Apply default ANSI colors for any missing colors
  const defaultAnsi = isLight ? DEFAULT_LIGHT_ANSI : DEFAULT_DARK_ANSI;

  // Ensure all required colors are present
  const finalTheme: ITheme = {
    background: theme.background || (isLight ? "#f7f1d9" : "#21222c"),
    foreground: theme.foreground || (isLight ? "#1f1f1f" : "#f8f8f2"),
    cursor:
      theme.cursor || theme.foreground || (isLight ? "#644ac9" : "#bd93f9"),
    cursorAccent:
      theme.cursorAccent ||
      theme.background ||
      (isLight ? "#f7f1d9" : "#21222c"),
    selectionBackground:
      theme.selectionBackground || (isLight ? "#cfcfde" : "#44475a"),
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
  };

  return finalTheme;
}

/**
 * Check if a hex color has a transparent alpha channel (8-char hex with alpha < 0xFF)
 */
export function hasTransparentAlpha(hex: string): boolean {
  if (!hex) return false;
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 8) return false;
  return parseInt(clean.slice(6, 8), 16) < 255;
}

/**
 * Result of extracting a terminal theme with transparency info
 */
export interface TerminalThemeResult {
  theme: ITheme;
  isTransparent: boolean;
  containerBackground: string;
}

/**
 * Extract terminal theme with transparency awareness.
 * When the terminal background has alpha < 1, sets xterm background to transparent
 * and returns metadata for the container to handle the glass effect.
 */
export function extractTerminalThemeWithTransparency(
  themeColors: Record<string, string>,
): TerminalThemeResult {
  const theme = extractTerminalTheme(themeColors);
  const rawBg =
    themeColors["terminal.background"] || themeColors["editor.background"];
  const isTransparent = hasTransparentAlpha(rawBg || "");

  if (isTransparent) {
    theme.background = "transparent";
  }

  return {
    theme,
    isTransparent,
    containerBackground: isTransparent
      ? "transparent"
      : theme.background || "#21222c",
  };
}

/**
 * Check if a VS Code theme has terminal colors defined
 */
function _hasTerminalColors(themeColors: Record<string, string>): boolean {
  return !!(
    themeColors["terminal.background"] ||
    themeColors["terminal.foreground"] ||
    themeColors["terminal.ansiBlack"]
  );
}
