import type { ITerminalOptions, ITheme } from "@xterm/xterm";
import { FONT_TERMINAL } from "@/lib/fonts";
import {
  extractTerminalThemeWithTransparency,
  type TerminalThemeResult,
} from "@/lib/themes/terminal-theme-mapper";

/** Dracula terminal palette used before a full application theme is available. */
export const TERMINAL_THEME_DARK: ITheme = {
  background: "#21222c",
  foreground: "#f8f8f2",
  cursor: "#bd93f9",
  cursorAccent: "#21222c",
  selectionBackground: "#44475a",
  selectionForeground: "#f8f8f2",
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

/** Alucard terminal palette used before a full application theme is available. */
export const TERMINAL_THEME_LIGHT: ITheme = {
  background: "#f7f1d9",
  foreground: "#1f1f1f",
  cursor: "#644ac9",
  cursorAccent: "#f7f1d9",
  selectionBackground: "#cfcfde",
  selectionForeground: "#1f1f1f",
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

/** Get the canonical terminal theme for the current application mode. */
export function getTerminalTheme(isDark: boolean): ITheme {
  return isDark ? TERMINAL_THEME_DARK : TERMINAL_THEME_LIGHT;
}

/**
 * Get terminal theme with transparency info from VS Code theme colors.
 * Returns theme, transparency flag, and container background color.
 */
export function getTerminalThemeWithTransparency(
  themeColors: Record<string, string> | null | undefined,
  isDark: boolean,
  forceTransparent = false,
): TerminalThemeResult {
  if (!themeColors) {
    const theme = { ...getTerminalTheme(isDark) };
    if (forceTransparent) {
      theme.background = "transparent";
    }
    return {
      theme,
      isTransparent: forceTransparent,
      containerBackground: forceTransparent
        ? "transparent"
        : theme.background || (isDark ? "#21222c" : "#f7f1d9"),
    };
  }
  const result = extractTerminalThemeWithTransparency(themeColors);
  if (forceTransparent && !result.isTransparent) {
    result.theme.background = "transparent";
    result.isTransparent = true;
    result.containerBackground = "transparent";
  }
  return result;
}

export const TERMINAL_OPTIONS: ITerminalOptions = {
  cursorBlink: true,
  fontSize: 13,
  lineHeight: 1.4,
  fontFamily: FONT_TERMINAL,
  theme: TERMINAL_THEME_DARK,
  allowProposedApi: true,
  scrollback: 10000,
  macOptionIsMeta: true,
  cursorStyle: "block",
  cursorInactiveStyle: "outline",
  letterSpacing: 0,
};

export const RESIZE_DEBOUNCE_MS = 150;
