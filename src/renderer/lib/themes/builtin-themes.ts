/** Dracula / Alucard application themes derived from .tmp/dracula-theme. */
import type { VSCodeFullTheme } from "../atoms";

export const DRACULA_THEME_ID = "dracula";
export const ALUCARD_THEME_ID = "alucard";

const DRACULA: VSCodeFullTheme = {
  id: DRACULA_THEME_ID,
  name: "Dark（Dracula）",
  type: "dark",
  source: "builtin",
  semanticHighlighting: true,
  colors: {
    "editor.background": "#282a36",
    "editor.foreground": "#f8f8f2",
    foreground: "#f8f8f2",
    "sideBar.background": "#21222c",
    "sideBar.foreground": "#f8f8f2",
    "sideBar.border": "#44475a",
    "activityBar.background": "#21222c",
    "activityBar.foreground": "#f8f8f2",
    "activityBarBadge.background": "#bd93f9",
    "activityBarBadge.foreground": "#282a36",
    "panel.background": "#21222c",
    "panel.border": "#44475a",
    "tab.activeBackground": "#282a36",
    "tab.activeForeground": "#f8f8f2",
    "tab.inactiveBackground": "#21222c",
    "tab.inactiveForeground": "#6272a4",
    "editorGroupHeader.tabsBackground": "#21222c",
    "editorGroup.border": "#44475a",
    "dropdown.background": "#343746",
    "dropdown.foreground": "#f8f8f2",
    "menu.background": "#343746",
    "menu.foreground": "#f8f8f2",
    "editorWidget.background": "#343746",
    "editorWidget.foreground": "#f8f8f2",
    "input.background": "#21222c",
    "input.border": "#44475a",
    "input.foreground": "#f8f8f2",
    "input.placeholderForeground": "#6272a4",
    focusBorder: "#bd93f9",
    "textLink.foreground": "#8be9fd",
    "textLink.activeForeground": "#bd93f9",
    "list.activeSelectionBackground": "#44475a",
    "list.activeSelectionForeground": "#f8f8f2",
    "list.hoverBackground": "#343746",
    "list.hoverForeground": "#f8f8f2",
    "editor.selectionBackground": "#44475a",
    "editor.inactiveSelectionBackground": "#44475a99",
    "editorLineNumber.foreground": "#6272a4",
    descriptionForeground: "#8c91b8",
    errorForeground: "#ff5555",
    "editorError.foreground": "#ff5555",
    "button.background": "#bd93f9",
    "button.foreground": "#282a36",
    "button.hoverBackground": "#caa9fa",
    "button.secondaryBackground": "#44475a",
    "button.secondaryForeground": "#f8f8f2",
    "terminal.background": "#21222c",
    "terminal.foreground": "#f8f8f2",
    "terminalCursor.foreground": "#bd93f9",
    "terminalCursor.background": "#21222c",
    "terminal.selectionBackground": "#44475a",
    "terminal.ansiBlack": "#21222c",
    "terminal.ansiRed": "#ff5555",
    "terminal.ansiGreen": "#50fa7b",
    "terminal.ansiYellow": "#f1fa8c",
    "terminal.ansiBlue": "#8be9fd",
    "terminal.ansiMagenta": "#ff79c6",
    "terminal.ansiCyan": "#8be9fd",
    "terminal.ansiWhite": "#f8f8f2",
    "terminal.ansiBrightBlack": "#6272a4",
    "terminal.ansiBrightRed": "#ff6e6e",
    "terminal.ansiBrightGreen": "#69ff94",
    "terminal.ansiBrightYellow": "#ffffa5",
    "terminal.ansiBrightBlue": "#d6acff",
    "terminal.ansiBrightMagenta": "#ff92df",
    "terminal.ansiBrightCyan": "#a4ffff",
    "terminal.ansiBrightWhite": "#ffffff",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#6272a4", fontStyle: "italic" },
    },
    {
      scope: ["string", "constant.other.symbol"],
      settings: { foreground: "#f1fa8c" },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "#bd93f9" },
    },
    {
      scope: ["keyword", "storage", "storage.type"],
      settings: { foreground: "#ff79c6" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#50fa7b" },
    },
    {
      scope: ["variable", "variable.other.readwrite"],
      settings: { foreground: "#f8f8f2" },
    },
    {
      scope: ["variable.parameter", "meta.function.parameters"],
      settings: { foreground: "#ffb86c", fontStyle: "italic" },
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type"],
      settings: { foreground: "#8be9fd", fontStyle: "italic" },
    },
    { scope: ["entity.name.tag"], settings: { foreground: "#ff79c6" } },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#50fa7b" },
    },
    {
      scope: ["punctuation", "meta.brace"],
      settings: { foreground: "#f8f8f2" },
    },
    {
      scope: ["invalid", "invalid.illegal"],
      settings: { foreground: "#ff5555" },
    },
  ],
};

const ALUCARD: VSCodeFullTheme = {
  id: ALUCARD_THEME_ID,
  name: "Light（Alucard）",
  type: "light",
  source: "builtin",
  semanticHighlighting: true,
  colors: {
    "editor.background": "#fffbeb",
    "editor.foreground": "#1f1f1f",
    foreground: "#1f1f1f",
    "sideBar.background": "#f7f1d9",
    "sideBar.foreground": "#1f1f1f",
    "sideBar.border": "#d8d1b4",
    "activityBar.background": "#f7f1d9",
    "activityBar.foreground": "#1f1f1f",
    "activityBarBadge.background": "#644ac9",
    "activityBarBadge.foreground": "#ffffff",
    "panel.background": "#f7f1d9",
    "panel.border": "#d8d1b4",
    "tab.activeBackground": "#fffbeb",
    "tab.activeForeground": "#1f1f1f",
    "tab.inactiveBackground": "#f7f1d9",
    "tab.inactiveForeground": "#6c664b",
    "editorGroupHeader.tabsBackground": "#f7f1d9",
    "editorGroup.border": "#d8d1b4",
    "dropdown.background": "#fffdf5",
    "dropdown.foreground": "#1f1f1f",
    "menu.background": "#fffdf5",
    "menu.foreground": "#1f1f1f",
    "editorWidget.background": "#fffdf5",
    "editorWidget.foreground": "#1f1f1f",
    "input.background": "#fffdf5",
    "input.border": "#c8bea0",
    "input.foreground": "#1f1f1f",
    "input.placeholderForeground": "#6c664b",
    focusBorder: "#644ac9",
    "textLink.foreground": "#036a96",
    "textLink.activeForeground": "#644ac9",
    "list.activeSelectionBackground": "#cfcfde",
    "list.activeSelectionForeground": "#1f1f1f",
    "list.hoverBackground": "#ebe6d1",
    "list.hoverForeground": "#1f1f1f",
    "editor.selectionBackground": "#cfcfde",
    "editor.inactiveSelectionBackground": "#cfcfde99",
    "editorLineNumber.foreground": "#6c664b",
    descriptionForeground: "#6c664b",
    errorForeground: "#cb3a2a",
    "editorError.foreground": "#cb3a2a",
    "button.background": "#644ac9",
    "button.foreground": "#ffffff",
    "button.hoverBackground": "#5239b6",
    "button.secondaryBackground": "#e7e0c4",
    "button.secondaryForeground": "#1f1f1f",
    "terminal.background": "#f7f1d9",
    "terminal.foreground": "#1f1f1f",
    "terminalCursor.foreground": "#644ac9",
    "terminalCursor.background": "#f7f1d9",
    "terminal.selectionBackground": "#cfcfde",
    "terminal.ansiBlack": "#1f1f1f",
    "terminal.ansiRed": "#cb3a2a",
    "terminal.ansiGreen": "#14710a",
    "terminal.ansiYellow": "#846e15",
    "terminal.ansiBlue": "#036a96",
    "terminal.ansiMagenta": "#a3144d",
    "terminal.ansiCyan": "#036a96",
    "terminal.ansiWhite": "#fffbeb",
    "terminal.ansiBrightBlack": "#6c664b",
    "terminal.ansiBrightRed": "#e14938",
    "terminal.ansiBrightGreen": "#238416",
    "terminal.ansiBrightYellow": "#9a821d",
    "terminal.ansiBrightBlue": "#087fab",
    "terminal.ansiBrightMagenta": "#b52360",
    "terminal.ansiBrightCyan": "#087fab",
    "terminal.ansiBrightWhite": "#fffdf5",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#6c664b", fontStyle: "italic" },
    },
    {
      scope: ["string", "constant.other.symbol"],
      settings: { foreground: "#846e15" },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "#644ac9" },
    },
    {
      scope: ["keyword", "storage", "storage.type"],
      settings: { foreground: "#a3144d" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#14710a" },
    },
    {
      scope: ["variable", "variable.other.readwrite"],
      settings: { foreground: "#1f1f1f" },
    },
    {
      scope: ["variable.parameter", "meta.function.parameters"],
      settings: { foreground: "#a34d14", fontStyle: "italic" },
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type"],
      settings: { foreground: "#036a96", fontStyle: "italic" },
    },
    { scope: ["entity.name.tag"], settings: { foreground: "#a3144d" } },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#14710a" },
    },
    {
      scope: ["punctuation", "meta.brace"],
      settings: { foreground: "#1f1f1f" },
    },
    {
      scope: ["invalid", "invalid.illegal"],
      settings: { foreground: "#cb3a2a" },
    },
  ],
};

export const BUILTIN_THEMES: VSCodeFullTheme[] = [ALUCARD, DRACULA];

const LEGACY_LIGHT_THEME_IDS = new Set([
  "default-light",
  "cursor-light",
  "claude-light",
  "vitesse-light",
  "min-light",
]);

const LEGACY_DARK_THEME_IDS = new Set([
  "default-dark",
  "cursor-dark",
  "cursor-midnight",
  "liquid-glass-dark",
  "claude-dark",
  "vesper-dark",
  "vitesse-dark",
  "min-dark",
]);

export function resolveBuiltinThemeId(
  id: string,
  fallbackType: "light" | "dark",
): string {
  if (id === ALUCARD_THEME_ID || LEGACY_LIGHT_THEME_IDS.has(id)) {
    return ALUCARD_THEME_ID;
  }
  if (id === DRACULA_THEME_ID || LEGACY_DARK_THEME_IDS.has(id)) {
    return DRACULA_THEME_ID;
  }
  return fallbackType === "light" ? ALUCARD_THEME_ID : DRACULA_THEME_ID;
}

export function getBuiltinThemeById(id: string): VSCodeFullTheme | undefined {
  return BUILTIN_THEMES.find((theme) => theme.id === id);
}
