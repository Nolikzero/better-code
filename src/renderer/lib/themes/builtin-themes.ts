/**
 * Built-in VS Code themes with full color definitions
 *
 * These themes include both UI colors and are compatible with Shiki for syntax highlighting.
 * Each theme has been curated to work well with the app's design system.
 */

import type { VSCodeFullTheme } from "../atoms";
import { CURSOR_DARK, CURSOR_LIGHT, CURSOR_MIDNIGHT } from "./cursor-themes";

/**
 * Default Dark - Linear-style monochrome dark theme
 * Pure grayscale with no accent colors
 */
const DEFAULT_DARK: VSCodeFullTheme = {
  id: "default-dark",
  name: "Default Dark",
  type: "dark",
  source: "builtin",
  colors: {
    "editor.background": "#121212", // 0 0% 7%
    "editor.foreground": "#ededed", // 0 0% 93%
    foreground: "#ededed",
    "sideBar.background": "#0d0d0d", // slightly darker
    "sideBar.foreground": "#ededed",
    "sideBar.border": "#2e2e2e", // 0 0% 18%
    "activityBar.background": "#0d0d0d",
    "activityBar.foreground": "#ededed",
    "panel.background": "#0d0d0d", // match sidebar
    "panel.border": "#2e2e2e",
    "tab.activeBackground": "#121212",
    "tab.inactiveBackground": "#0d0d0d",
    "tab.inactiveForeground": "#8c8c8c", // 0 0% 55%
    "editorGroupHeader.tabsBackground": "#0d0d0d",
    "dropdown.background": "#1c1c1c", // popover 0 0% 11%
    "dropdown.foreground": "#ededed",
    "input.background": "#1c1c1c", // 0 0% 11%
    "input.border": "#2e2e2e",
    "input.foreground": "#ededed",
    focusBorder: "#606060", // subtle gray focus
    "textLink.foreground": "#ededed", // monochrome links
    "textLink.activeForeground": "#ffffff",
    "list.activeSelectionBackground": "#2a2a2a",
    "list.hoverBackground": "#1f1f1f",
    "editor.selectionBackground": "#ffffff25", // white at 15%
    "editorLineNumber.foreground": "#505050",
    descriptionForeground: "#8c8c8c",
    errorForeground: "#ef4444",
    "button.background": "#ededed", // monochrome primary
    "button.foreground": "#121212",
    "button.secondaryBackground": "#2a2a2a",
    "button.secondaryForeground": "#ededed",
    // Terminal colors (keep functional colors)
    "terminal.background": "#0d0d0d",
    "terminal.foreground": "#ededed",
    "terminal.ansiBlack": "#1f1f1f",
    "terminal.ansiRed": "#ef4444",
    "terminal.ansiGreen": "#22c55e",
    "terminal.ansiYellow": "#eab308",
    "terminal.ansiBlue": "#a0a0a0", // gray instead of blue
    "terminal.ansiMagenta": "#a855f7",
    "terminal.ansiCyan": "#808080", // gray instead of cyan
    "terminal.ansiWhite": "#ededed",
    "terminal.ansiBrightBlack": "#71717a",
    "terminal.ansiBrightRed": "#f87171",
    "terminal.ansiBrightGreen": "#4ade80",
    "terminal.ansiBrightYellow": "#facc15",
    "terminal.ansiBrightBlue": "#b0b0b0",
    "terminal.ansiBrightMagenta": "#c084fc",
    "terminal.ansiBrightCyan": "#a0a0a0",
    "terminal.ansiBrightWhite": "#fafafa",
  },
};

/**
 * Default Light - Linear-style monochrome light theme
 * Pure grayscale with no accent colors
 */
const DEFAULT_LIGHT: VSCodeFullTheme = {
  id: "default-light",
  name: "Default Light",
  type: "light",
  source: "builtin",
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#171717", // 0 0% 9%
    foreground: "#171717",
    "sideBar.background": "#fafafa", // 0 0% 98%
    "sideBar.foreground": "#171717",
    "sideBar.border": "#e5e5e5", // 0 0% 90%
    "activityBar.background": "#fafafa",
    "activityBar.foreground": "#171717",
    "panel.background": "#fafafa", // match sidebar
    "panel.border": "#e5e5e5",
    "tab.activeBackground": "#ffffff",
    "tab.inactiveBackground": "#f5f5f5", // 0 0% 96%
    "tab.inactiveForeground": "#737373", // 0 0% 45%
    "editorGroupHeader.tabsBackground": "#f5f5f5",
    "dropdown.background": "#ffffff",
    "dropdown.foreground": "#171717",
    "input.background": "#fafafa", // 0 0% 98%
    "input.border": "#e5e5e5",
    "input.foreground": "#171717",
    focusBorder: "#a0a0a0", // subtle gray focus
    "textLink.foreground": "#171717", // monochrome links
    "textLink.activeForeground": "#000000",
    "list.activeSelectionBackground": "#f0f0f0",
    "list.hoverBackground": "#f5f5f5",
    "editor.selectionBackground": "#17171720", // black at 12%
    "editorLineNumber.foreground": "#a0a0a0",
    descriptionForeground: "#737373",
    errorForeground: "#dc2626",
    "button.background": "#171717", // monochrome primary
    "button.foreground": "#ffffff",
    "button.secondaryBackground": "#f5f5f5",
    "button.secondaryForeground": "#171717",
    // Terminal colors (keep functional colors)
    "terminal.background": "#fafafa",
    "terminal.foreground": "#171717",
    "terminal.ansiBlack": "#171717",
    "terminal.ansiRed": "#dc2626",
    "terminal.ansiGreen": "#16a34a",
    "terminal.ansiYellow": "#ca8a04",
    "terminal.ansiBlue": "#525252", // gray instead of blue
    "terminal.ansiMagenta": "#9333ea",
    "terminal.ansiCyan": "#737373", // gray instead of cyan
    "terminal.ansiWhite": "#f5f5f5",
    "terminal.ansiBrightBlack": "#525252",
    "terminal.ansiBrightRed": "#ef4444",
    "terminal.ansiBrightGreen": "#22c55e",
    "terminal.ansiBrightYellow": "#eab308",
    "terminal.ansiBrightBlue": "#737373",
    "terminal.ansiBrightMagenta": "#a855f7",
    "terminal.ansiBrightCyan": "#a0a0a0",
    "terminal.ansiBrightWhite": "#fafafa",
  },
};

/**
 * Vitesse Dark theme colors
 */
const VITESSE_DARK: VSCodeFullTheme = {
  id: "vitesse-dark",
  name: "Vitesse Dark",
  type: "dark",
  source: "builtin",
  colors: {
    "editor.background": "#121212",
    "editor.foreground": "#dbd7ca",
    foreground: "#dbd7ca",
    "sideBar.background": "#121212",
    "sideBar.foreground": "#dbd7ca",
    "sideBar.border": "#1e1e1e",
    "activityBar.background": "#121212",
    "activityBar.foreground": "#dbd7ca",
    "panel.background": "#121212",
    "panel.border": "#1e1e1e",
    "tab.activeBackground": "#1e1e1e",
    "tab.inactiveBackground": "#121212",
    "tab.inactiveForeground": "#75715e",
    "editorGroupHeader.tabsBackground": "#121212",
    "dropdown.background": "#1e1e1e",
    "dropdown.foreground": "#dbd7ca",
    "input.background": "#1e1e1e",
    "input.border": "#2e2e2e",
    "input.foreground": "#dbd7ca",
    focusBorder: "#4d9375",
    "textLink.foreground": "#4d9375",
    "textLink.activeForeground": "#5eaab5",
    "list.activeSelectionBackground": "#4d937530",
    "list.hoverBackground": "#1e1e1e",
    "editor.selectionBackground": "#4d937540",
    "editorLineNumber.foreground": "#444444",
    descriptionForeground: "#75715e",
    errorForeground: "#cb7676",
    "button.background": "#4d9375",
    "button.foreground": "#121212",
    "button.secondaryBackground": "#2e2e2e",
    "button.secondaryForeground": "#dbd7ca",
    // Terminal colors
    "terminal.background": "#121212",
    "terminal.foreground": "#dbd7ca",
    "terminal.ansiBlack": "#393a34",
    "terminal.ansiRed": "#cb7676",
    "terminal.ansiGreen": "#4d9375",
    "terminal.ansiYellow": "#e6cc77",
    "terminal.ansiBlue": "#6394bf",
    "terminal.ansiMagenta": "#d9739f",
    "terminal.ansiCyan": "#5eaab5",
    "terminal.ansiWhite": "#dbd7ca",
    "terminal.ansiBrightBlack": "#666666",
    "terminal.ansiBrightRed": "#cb7676",
    "terminal.ansiBrightGreen": "#4d9375",
    "terminal.ansiBrightYellow": "#e6cc77",
    "terminal.ansiBrightBlue": "#6394bf",
    "terminal.ansiBrightMagenta": "#d9739f",
    "terminal.ansiBrightCyan": "#5eaab5",
    "terminal.ansiBrightWhite": "#eeeeee",
  },
};

/**
 * Vitesse Light theme colors
 */
const VITESSE_LIGHT: VSCodeFullTheme = {
  id: "vitesse-light",
  name: "Vitesse Light",
  type: "light",
  source: "builtin",
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#393a34",
    foreground: "#393a34",
    "sideBar.background": "#fafafa",
    "sideBar.foreground": "#393a34",
    "sideBar.border": "#eeeeee",
    "activityBar.background": "#fafafa",
    "activityBar.foreground": "#393a34",
    "panel.background": "#fafafa",
    "panel.border": "#eeeeee",
    "tab.activeBackground": "#ffffff",
    "tab.inactiveBackground": "#fafafa",
    "tab.inactiveForeground": "#999999",
    "editorGroupHeader.tabsBackground": "#fafafa",
    "dropdown.background": "#ffffff",
    "dropdown.foreground": "#393a34",
    "input.background": "#f5f5f5", // slightly gray for visibility
    "input.border": "#eeeeee",
    "input.foreground": "#393a34",
    focusBorder: "#1e754f",
    "textLink.foreground": "#1e754f",
    "textLink.activeForeground": "#2993a3",
    "list.activeSelectionBackground": "#eeeeee66",
    "list.hoverBackground": "#f5f5f5",
    "editor.selectionBackground": "#22222215",
    "editorLineNumber.foreground": "#aaaaaa",
    descriptionForeground: "#999999",
    errorForeground: "#ab5959",
    "button.background": "#1e754f",
    "button.foreground": "#ffffff",
    "button.secondaryBackground": "#eeeeee",
    "button.secondaryForeground": "#393a34",
    // Terminal colors
    "terminal.background": "#fafafa", // match sidebar
    "terminal.foreground": "#393a34",
    "terminal.ansiBlack": "#393a34",
    "terminal.ansiRed": "#ab5959",
    "terminal.ansiGreen": "#1e754f",
    "terminal.ansiYellow": "#a65e2b",
    "terminal.ansiBlue": "#296aa3",
    "terminal.ansiMagenta": "#a13865",
    "terminal.ansiCyan": "#2993a3",
    "terminal.ansiWhite": "#b0b0b0",
    "terminal.ansiBrightBlack": "#777777",
    "terminal.ansiBrightRed": "#ab5959",
    "terminal.ansiBrightGreen": "#1e754f",
    "terminal.ansiBrightYellow": "#a65e2b",
    "terminal.ansiBrightBlue": "#296aa3",
    "terminal.ansiBrightMagenta": "#a13865",
    "terminal.ansiBrightCyan": "#2993a3",
    "terminal.ansiBrightWhite": "#393a34",
  },
};

/**
 * Min Dark theme colors (minimal dark theme)
 */
const MIN_DARK: VSCodeFullTheme = {
  id: "min-dark",
  name: "Min Dark",
  type: "dark",
  source: "builtin",
  colors: {
    "editor.background": "#1f1f1f",
    "editor.foreground": "#d4d4d4",
    foreground: "#d4d4d4",
    "sideBar.background": "#181818",
    "sideBar.foreground": "#d4d4d4",
    "sideBar.border": "#252525",
    "activityBar.background": "#181818",
    "activityBar.foreground": "#d4d4d4",
    "panel.background": "#1f1f1f",
    "panel.border": "#252525",
    "tab.activeBackground": "#1f1f1f",
    "tab.inactiveBackground": "#181818",
    "tab.inactiveForeground": "#6e6e6e",
    "editorGroupHeader.tabsBackground": "#181818",
    "dropdown.background": "#252525",
    "dropdown.foreground": "#d4d4d4",
    "input.background": "#181818",
    "input.border": "#3c3c3c",
    "input.foreground": "#d4d4d4",
    focusBorder: "#6ca1ef",
    "textLink.foreground": "#6ca1ef",
    "textLink.activeForeground": "#89b4fa",
    "list.activeSelectionBackground": "#2a2a2a",
    "list.hoverBackground": "#252525",
    "editor.selectionBackground": "#264f78",
    "editorLineNumber.foreground": "#5a5a5a",
    descriptionForeground: "#6e6e6e",
    errorForeground: "#f48771",
    "button.background": "#6ca1ef",
    "button.foreground": "#1f1f1f",
    "button.secondaryBackground": "#3c3c3c",
    "button.secondaryForeground": "#d4d4d4",
    // Terminal colors
    "terminal.background": "#1f1f1f",
    "terminal.foreground": "#d4d4d4",
    "terminal.ansiBlack": "#1f1f1f",
    "terminal.ansiRed": "#f48771",
    "terminal.ansiGreen": "#89d185",
    "terminal.ansiYellow": "#e5c07b",
    "terminal.ansiBlue": "#6ca1ef",
    "terminal.ansiMagenta": "#d38aea",
    "terminal.ansiCyan": "#4ec9b0",
    "terminal.ansiWhite": "#d4d4d4",
    "terminal.ansiBrightBlack": "#6e6e6e",
    "terminal.ansiBrightRed": "#f48771",
    "terminal.ansiBrightGreen": "#89d185",
    "terminal.ansiBrightYellow": "#e5c07b",
    "terminal.ansiBrightBlue": "#6ca1ef",
    "terminal.ansiBrightMagenta": "#d38aea",
    "terminal.ansiBrightCyan": "#4ec9b0",
    "terminal.ansiBrightWhite": "#e5e5e5",
  },
};

/**
 * Vesper Dark theme colors
 * By Rauno Freiberg - https://github.com/raunofreiberg/vesper
 */
const VESPER_DARK: VSCodeFullTheme = {
  id: "vesper-dark",
  name: "Vesper",
  type: "dark",
  source: "builtin",
  colors: {
    "editor.background": "#101010",
    "editorPane.background": "#101010",
    "editor.foreground": "#FFFFFF",
    foreground: "#FFFFFF",
    "sideBar.background": "#101010",
    "sideBar.foreground": "#A0A0A0",
    "sideBar.border": "#232323",
    "activityBar.background": "#101010",
    "activityBar.foreground": "#A0A0A0",
    "activityBarBadge.background": "#FFC799",
    "activityBarBadge.foreground": "#000000",
    "panel.background": "#101010",
    "panel.border": "#232323",
    "tab.activeBackground": "#161616",
    "tab.inactiveBackground": "#101010",
    "tab.inactiveForeground": "#505050",
    "editorGroupHeader.tabsBackground": "#101010",
    "dropdown.background": "#161616",
    "dropdown.foreground": "#FFFFFF",
    "input.background": "#1B1B1B",
    "input.border": "#282828",
    "input.foreground": "#FFFFFF",
    focusBorder: "#FFC799",
    "textLink.foreground": "#FFC799",
    "textLink.activeForeground": "#FFCFA8",
    "list.activeSelectionBackground": "#232323",
    "list.hoverBackground": "#282828",
    "editor.selectionBackground": "#FFFFFF25",
    "editorLineNumber.foreground": "#505050",
    descriptionForeground: "#A0A0A0",
    errorForeground: "#FF8080",
    "button.background": "#FFC799",
    "button.foreground": "#000000",
    "button.secondaryBackground": "#232323",
    "button.secondaryForeground": "#FFFFFF",
    // Terminal colors
    "terminal.background": "#101010",
    "terminal.foreground": "#FFFFFF",
    "terminal.ansiBlack": "#1C1C1C",
    "terminal.ansiRed": "#FF8080",
    "terminal.ansiGreen": "#99FFE4",
    "terminal.ansiYellow": "#FFC799",
    "terminal.ansiBlue": "#A0A0A0",
    "terminal.ansiMagenta": "#FFC799",
    "terminal.ansiCyan": "#99FFE4",
    "terminal.ansiWhite": "#FFFFFF",
    "terminal.ansiBrightBlack": "#505050",
    "terminal.ansiBrightRed": "#FF8080",
    "terminal.ansiBrightGreen": "#99FFE4",
    "terminal.ansiBrightYellow": "#FFC799",
    "terminal.ansiBrightBlue": "#A0A0A0",
    "terminal.ansiBrightMagenta": "#FFC799",
    "terminal.ansiBrightCyan": "#99FFE4",
    "terminal.ansiBrightWhite": "#FFFFFF",
  },
};

/**
 * Min Light theme colors (minimal light theme)
 */
const MIN_LIGHT: VSCodeFullTheme = {
  id: "min-light",
  name: "Min Light",
  type: "light",
  source: "builtin",
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#1f1f1f",
    foreground: "#1f1f1f",
    "sideBar.background": "#f3f3f3",
    "sideBar.foreground": "#1f1f1f",
    "sideBar.border": "#e0e0e0",
    "activityBar.background": "#f3f3f3",
    "activityBar.foreground": "#1f1f1f",
    "panel.background": "#f3f3f3", // match sidebar
    "panel.border": "#e0e0e0",
    "tab.activeBackground": "#ffffff",
    "tab.inactiveBackground": "#f3f3f3",
    "tab.inactiveForeground": "#717171",
    "editorGroupHeader.tabsBackground": "#f3f3f3",
    "dropdown.background": "#ffffff",
    "dropdown.foreground": "#1f1f1f",
    "input.background": "#f3f3f3", // match sidebar for visibility
    "input.border": "#cecece",
    "input.foreground": "#1f1f1f",
    focusBorder: "#0451a5",
    "textLink.foreground": "#0451a5",
    "textLink.activeForeground": "#0066cc",
    "list.activeSelectionBackground": "#e8e8e8",
    "list.hoverBackground": "#f3f3f3",
    "editor.selectionBackground": "#add6ff",
    "editorLineNumber.foreground": "#6e7681",
    descriptionForeground: "#717171",
    errorForeground: "#d32f2f",
    "button.background": "#0451a5",
    "button.foreground": "#ffffff",
    "button.secondaryBackground": "#e0e0e0",
    "button.secondaryForeground": "#1f1f1f",
    // Terminal colors
    "terminal.background": "#f3f3f3", // match sidebar
    "terminal.foreground": "#1f1f1f",
    "terminal.ansiBlack": "#1f1f1f",
    "terminal.ansiRed": "#cd3131",
    "terminal.ansiGreen": "#14ce14",
    "terminal.ansiYellow": "#949800",
    "terminal.ansiBlue": "#0451a5",
    "terminal.ansiMagenta": "#bc05bc",
    "terminal.ansiCyan": "#0598bc",
    "terminal.ansiWhite": "#a5a5a5",
    "terminal.ansiBrightBlack": "#717171",
    "terminal.ansiBrightRed": "#cd3131",
    "terminal.ansiBrightGreen": "#14ce14",
    "terminal.ansiBrightYellow": "#b5ba00",
    "terminal.ansiBrightBlue": "#0451a5",
    "terminal.ansiBrightMagenta": "#bc05bc",
    "terminal.ansiBrightCyan": "#0598bc",
    "terminal.ansiBrightWhite": "#1f1f1f",
  },
};

/**
 * Claude Light theme colors
 * Warm, beige tones with orange accent (Claude's signature color)
 */
const CLAUDE_LIGHT: VSCodeFullTheme = {
  id: "claude-light",
  name: "Claude Light",
  type: "light",
  source: "builtin",
  colors: {
    "editor.background": "#FAF9F5",
    "editorPane.background": "#FAF9F5",
    "editor.foreground": "#4a4538",
    foreground: "#4a4538",
    "sideBar.background": "#FAF9F5",
    "sideBar.foreground": "#4a4538",
    "sideBar.border": "#e5e3de",
    "activityBar.background": "#FAF9F5",
    "activityBar.foreground": "#4a4538",
    "panel.background": "#FAF9F5",
    "panel.border": "#e5e3de",
    "tab.activeBackground": "#FAF9F5",
    "tab.inactiveBackground": "#f5f4f1",
    "tab.inactiveForeground": "#8b8578",
    "editorGroupHeader.tabsBackground": "#f5f4f1",
    "dropdown.background": "#ffffff",
    "dropdown.foreground": "#4a4538",
    "input.background": "#ffffff",
    "input.border": "#d5d3ce",
    "input.foreground": "#4a4538",
    focusBorder: "#D97857",
    "textLink.foreground": "#D97857",
    "textLink.activeForeground": "#C4684A",
    "list.activeSelectionBackground": "#e8e5dd",
    "list.hoverBackground": "#f0ede7",
    "editor.selectionBackground": "#D9785733",
    "editorLineNumber.foreground": "#a5a193",
    descriptionForeground: "#8b8578",
    errorForeground: "#dc2626",
    "button.background": "#D97857",
    "button.foreground": "#ffffff",
    "button.secondaryBackground": "#e8e5dd",
    "button.secondaryForeground": "#4a4538",
    // Terminal colors
    "terminal.background": "#FAF9F5",
    "terminal.foreground": "#4a4538",
    "terminal.ansiBlack": "#4a4538",
    "terminal.ansiRed": "#dc2626",
    "terminal.ansiGreen": "#16a34a",
    "terminal.ansiYellow": "#D97857",
    "terminal.ansiBlue": "#2563eb",
    "terminal.ansiMagenta": "#9333ea",
    "terminal.ansiCyan": "#0891b2",
    "terminal.ansiWhite": "#e5e3de",
    "terminal.ansiBrightBlack": "#8b8578",
    "terminal.ansiBrightRed": "#ef4444",
    "terminal.ansiBrightGreen": "#22c55e",
    "terminal.ansiBrightYellow": "#f59e0b",
    "terminal.ansiBrightBlue": "#3b82f6",
    "terminal.ansiBrightMagenta": "#a855f7",
    "terminal.ansiBrightCyan": "#06b6d4",
    "terminal.ansiBrightWhite": "#FAF9F5",
  },
};

/**
 * Claude Dark theme colors
 * Warm dark tones with orange accent (Claude's signature color)
 */
const CLAUDE_DARK: VSCodeFullTheme = {
  id: "claude-dark",
  name: "Claude Dark",
  type: "dark",
  source: "builtin",
  colors: {
    "editor.background": "#262624",
    "editorPane.background": "#262624",
    "editor.foreground": "#c9c5bc",
    foreground: "#c9c5bc",
    "sideBar.background": "#262624",
    "sideBar.foreground": "#c9c5bc",
    "sideBar.border": "#3a3937",
    "activityBar.background": "#262624",
    "activityBar.foreground": "#c9c5bc",
    "panel.background": "#262624",
    "panel.border": "#3d3a36",
    "tab.activeBackground": "#262624",
    "tab.inactiveBackground": "#262624",
    "tab.inactiveForeground": "#8a857c",
    "editorGroupHeader.tabsBackground": "#232120",
    "dropdown.background": "#383633",
    "dropdown.foreground": "#c9c5bc",
    "input.background": "#232120",
    "input.border": "#4a4742",
    "input.foreground": "#c9c5bc",
    focusBorder: "#D97857",
    "textLink.foreground": "#D97857",
    "textLink.activeForeground": "#E8917A",
    "list.activeSelectionBackground": "#3d3a36",
    "list.hoverBackground": "#353230",
    "editor.selectionBackground": "#D9785744",
    "editorLineNumber.foreground": "#6b6660",
    descriptionForeground: "#8a857c",
    errorForeground: "#ef4444",
    "button.background": "#D97857",
    "button.foreground": "#ffffff",
    "button.secondaryBackground": "#3d3a36",
    "button.secondaryForeground": "#c9c5bc",
    // Terminal colors
    "terminal.background": "#262624",
    "terminal.foreground": "#c9c5bc",
    "terminal.ansiBlack": "#232120",
    "terminal.ansiRed": "#ef4444",
    "terminal.ansiGreen": "#22c55e",
    "terminal.ansiYellow": "#D97857",
    "terminal.ansiBlue": "#3b82f6",
    "terminal.ansiMagenta": "#a855f7",
    "terminal.ansiCyan": "#06b6d4",
    "terminal.ansiWhite": "#c9c5bc",
    "terminal.ansiBrightBlack": "#6b6660",
    "terminal.ansiBrightRed": "#f87171",
    "terminal.ansiBrightGreen": "#4ade80",
    "terminal.ansiBrightYellow": "#fbbf24",
    "terminal.ansiBrightBlue": "#60a5fa",
    "terminal.ansiBrightMagenta": "#c084fc",
    "terminal.ansiBrightCyan": "#22d3ee",
    "terminal.ansiBrightWhite": "#e5e3de",
  },
};

/**
 * Liquid Glass - Transparent theme with macOS vibrancy
 * Uses semi-transparent backgrounds for native blur effect
 * Forces dark appearance regardless of system theme setting
 */
const LIQUID_GLASS_DARK: VSCodeFullTheme = {
  id: "liquid-glass-dark",
  name: "Liquid Glass Dark",
  type: "dark",
  source: "builtin",
  vibrancy: {
    enabled: true,
    type: "under-window",
    visualEffectState: "followWindow",
    forceAppearance: "dark", // Always use dark appearance regardless of system theme
    liquidGlass: {
      cornerRadius: 12,
      tintColor: "#00000001", // subtle dark tint
    },
  },
  colors: {
    // Semi-transparent backgrounds - slightly more opaque for better layering
    "editor.background": "#181818DB", // ~86% opacity (was #12121280)
    "editorPane.background": "#18181890",
    "sideBar.background": "#12121270", // ~44% opacity (was #0d0d0d60)
    "sideBar.foreground": "#ededed",
    "sideBar.border": "#ffffff20", // more visible (was #ffffff15)
    "activityBar.background": "#12121270",
    "activityBar.foreground": "#ededed",
    "panel.background": "#12121270", // more visible (was #0d0d0d60)
    "panel.border": "#ffffff20", // more visible (was #ffffff15)
    "tab.activeBackground": "#1c1c1c90", // more visible (was #1c1c1c80)
    "tab.inactiveBackground": "#0d0d0d50", // more visible (was #0d0d0d40)
    "tab.inactiveForeground": "#a0a0a0", // brighter (was #8c8c8c)
    "editorGroupHeader.tabsBackground": "#12121270",
    "dropdown.background": "#1c1c1ca0", // more opaque (was #1c1c1c90)
    "dropdown.foreground": "#ededed",
    "input.background": "#1c1c1c90", // more opaque (was #1c1c1c80)
    "input.border": "#ffffff30", // more visible (was #ffffff20)
    "input.foreground": "#ededed",
    // Fully opaque foreground colors for readability
    "editor.foreground": "#ededed",
    foreground: "#ededed",
    focusBorder: "#ffffff50", // more visible (was #ffffff40)
    "textLink.foreground": "#ededed",
    "textLink.activeForeground": "#ffffff",
    "list.activeSelectionBackground": "#ffffff30", // more visible (was #ffffff20)
    "list.hoverBackground": "#ffffff20", // more visible (was #ffffff10)
    "editor.selectionBackground": "#ffffff35", // more visible (was #ffffff25)
    "editorLineNumber.foreground": "#606060", // brighter (was #505050)
    descriptionForeground: "#a0a0a0", // brighter (was #8c8c8c)
    errorForeground: "#ef4444",
    "button.background": "#ffffff35", // much more visible (was #ffffff20)
    "button.foreground": "#ededed",
    "button.secondaryBackground": "#ffffff25", // more visible (was #ffffff15)
    "button.secondaryForeground": "#ededed",
    // Terminal colors
    "terminal.background": "#12121270",
    "terminal.foreground": "#ededed",
    "terminal.ansiBlack": "#1f1f1f",
    "terminal.ansiRed": "#ef4444",
    "terminal.ansiGreen": "#22c55e",
    "terminal.ansiYellow": "#eab308",
    "terminal.ansiBlue": "#a0a0a0",
    "terminal.ansiMagenta": "#a855f7",
    "terminal.ansiCyan": "#808080",
    "terminal.ansiWhite": "#ededed",
    "terminal.ansiBrightBlack": "#71717a",
    "terminal.ansiBrightRed": "#f87171",
    "terminal.ansiBrightGreen": "#4ade80",
    "terminal.ansiBrightYellow": "#facc15",
    "terminal.ansiBrightBlue": "#b0b0b0",
    "terminal.ansiBrightMagenta": "#c084fc",
    "terminal.ansiBrightCyan": "#a0a0a0",
    "terminal.ansiBrightWhite": "#fafafa",
  },
};

/**
 * Liquid Glass Light - Transparent light theme with macOS vibrancy
 * Uses semi-transparent white backgrounds for native blur effect
 * White text for a frosted glass appearance
 */
const LIQUID_GLASS_LIGHT: VSCodeFullTheme = {
  id: "liquid-glass-light",
  name: "Liquid Glass Light",
  type: "light",
  source: "builtin",
  vibrancy: {
    enabled: true,
    type: "under-window",
    visualEffectState: "followWindow",
    forceAppearance: "light",
    liquidGlass: {
      cornerRadius: 12,
      tintColor: "#FFFFFF20",
    },
  },
  colors: {
    // Semi-transparent white/light backgrounds
    "editor.background": "#FFFFFFD8",
    "editorPane.background": "#FFFFFF90",
    "sideBar.background": "#FFFFFF70",
    "sideBar.foreground": "#7B8794",
    "sideBar.border": "#00000010",
    "activityBar.background": "#FFFFFF70",
    "activityBar.foreground": "#7B8794",
    "panel.background": "#FFFFFF70",
    "panel.border": "#00000010",
    "tab.activeBackground": "#FFFFFF90",
    "tab.inactiveBackground": "#FFFFFF50",
    "tab.inactiveForeground": "#9CA3AF",
    "editorGroupHeader.tabsBackground": "#FFFFFF70",
    "dropdown.background": "#FFFFFFA0",
    "dropdown.foreground": "#7B8794",
    "input.background": "#FFFFFF90",
    "input.border": "#00000015",
    "input.foreground": "#7B8794",
    // Medium gray foreground colors
    "editor.foreground": "#7B8794",
    foreground: "#7B8794",
    focusBorder: "#9CA3AF80",
    "textLink.foreground": "#8B95A1",
    "textLink.activeForeground": "#9CA3AF",
    "list.activeSelectionBackground": "#00000012",
    "list.hoverBackground": "#00000008",
    "editor.selectionBackground": "#00000012",
    "editorLineNumber.foreground": "#9CA3AF",
    descriptionForeground: "#9CA3AF",
    errorForeground: "#EF4444",
    "button.background": "#00000015",
    "button.foreground": "#7B8794",
    "button.secondaryBackground": "#00000010",
    "button.secondaryForeground": "#8B95A1",
    // Terminal colors (medium gray text theme)
    "terminal.background": "#FFFFFF70",
    "terminal.foreground": "#7B8794",
    "terminal.ansiBlack": "#4B5563",
    "terminal.ansiRed": "#EF4444",
    "terminal.ansiGreen": "#22C55E",
    "terminal.ansiYellow": "#F59E0B",
    "terminal.ansiBlue": "#3B82F6",
    "terminal.ansiMagenta": "#A855F7",
    "terminal.ansiCyan": "#06B6D4",
    "terminal.ansiWhite": "#D1D5DB",
    "terminal.ansiBrightBlack": "#6B7280",
    "terminal.ansiBrightRed": "#F87171",
    "terminal.ansiBrightGreen": "#4ADE80",
    "terminal.ansiBrightYellow": "#FBBF24",
    "terminal.ansiBrightBlue": "#60A5FA",
    "terminal.ansiBrightMagenta": "#C084FC",
    "terminal.ansiBrightCyan": "#22D3EE",
    "terminal.ansiBrightWhite": "#E5E7EB",
  },
};

/**
 * All built-in themes
 */
export const BUILTIN_THEMES: VSCodeFullTheme[] = [
  // Default themes (first)
  DEFAULT_DARK,
  DEFAULT_LIGHT,
  // Cursor themes
  CURSOR_DARK,
  CURSOR_LIGHT,
  CURSOR_MIDNIGHT,
  // Liquid Glass themes (transparent with vibrancy)
  LIQUID_GLASS_DARK,
  LIQUID_GLASS_LIGHT,
  // Dark themes
  CLAUDE_DARK,
  VESPER_DARK,
  VITESSE_DARK,
  MIN_DARK,
  // Light themes
  CLAUDE_LIGHT,
  VITESSE_LIGHT,
  MIN_LIGHT,
];

/**
 * Get theme by ID
 */
export function getBuiltinThemeById(id: string): VSCodeFullTheme | undefined {
  return BUILTIN_THEMES.find((theme) => theme.id === id);
}

/**
 * Get themes by type
 */
function _getBuiltinThemesByType(type: "light" | "dark"): VSCodeFullTheme[] {
  return BUILTIN_THEMES.filter((theme) => theme.type === type);
}

/**
 * Default theme IDs for light/dark modes
 * Uses Liquid Glass themes by default for glassmorphism effect
 */
const _DEFAULT_LIGHT_THEME_ID = "liquid-glass-light";
const _DEFAULT_DARK_THEME_ID = "liquid-glass-dark";
