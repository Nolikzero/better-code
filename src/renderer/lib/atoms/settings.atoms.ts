import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ============================================
// PREFERENCES - EXTENDED THINKING
// ============================================

// When enabled, Claude will use extended thinking for deeper reasoning (128K tokens)
// Note: Extended thinking disables response streaming
export const extendedThinkingEnabledAtom = atomWithStorage<boolean>(
  "preferences:extended-thinking-enabled",
  false,
  undefined,
  { getOnInit: true },
);

// ============================================
// PREFERENCES - SOUND NOTIFICATIONS
// ============================================

// When enabled, play a sound when agent completes work (if not viewing the chat)
export const soundNotificationsEnabledAtom = atomWithStorage<boolean>(
  "preferences:sound-notifications-enabled",
  true,
  undefined,
  { getOnInit: true },
);

// ============================================
// PREFERENCES - CTRL+TAB TARGET
// ============================================

// When "workspaces" (default), Ctrl+Tab switches between workspaces, and Opt+Ctrl+Tab switches between agents
// When "agents", Ctrl+Tab switches between agents, and Opt+Ctrl+Tab switches between workspaces
export type CtrlTabTarget = "workspaces" | "agents";
export const ctrlTabTargetAtom = atomWithStorage<CtrlTabTarget>(
  "preferences:ctrl-tab-target",
  "workspaces", // Default: Ctrl+Tab switches workspaces, Opt+Ctrl+Tab switches agents
  undefined,
  { getOnInit: true },
);

// ============================================
// PREFERENCES - VS CODE CODE THEMES
// ============================================

// Selected themes for code syntax highlighting (separate for light/dark UI themes)
export const vscodeCodeThemeLightAtom = atomWithStorage<string>(
  "preferences:vscode-code-theme-light",
  "github-light",
  undefined,
  { getOnInit: true },
);

export const vscodeCodeThemeDarkAtom = atomWithStorage<string>(
  "preferences:vscode-code-theme-dark",
  "github-dark",
  undefined,
  { getOnInit: true },
);

// ============================================
// FULL VS CODE THEME ATOMS
// ============================================

/**
 * Liquid Glass options for macOS 26+ (Tahoe)
 */
type LiquidGlassOptions = {
  cornerRadius?: number;
  tintColor?: string; // RGBA hex (e.g., '#44000010')
  opaque?: boolean;
};

/**
 * Vibrancy configuration for transparent themes (macOS only)
 */
export type ThemeVibrancy = {
  enabled: boolean;
  type: "under-window" | "sidebar" | "content" | "fullscreen-ui";
  visualEffectState?: "followWindow" | "active" | "inactive";
  // Liquid glass options (macOS 26+ Tahoe)
  liquidGlass?: LiquidGlassOptions;
  // Force a specific appearance mode regardless of system setting
  forceAppearance?: "dark" | "light";
};

/**
 * Full VS Code theme data type
 * Contains colors for UI, terminal, and tokenColors for syntax highlighting
 */
export type VSCodeFullTheme = {
  id: string;
  name: string;
  type: "light" | "dark";
  colors: Record<string, string>; // UI and terminal colors
  tokenColors?: any[]; // Syntax highlighting rules
  semanticHighlighting?: boolean; // Enable semantic highlighting
  semanticTokenColors?: Record<string, any>; // Semantic token color overrides
  source: "builtin" | "imported" | "discovered";
  path?: string; // File path for imported/discovered themes
  vibrancy?: ThemeVibrancy; // Vibrancy configuration for transparent themes
};

/**
 * Selected full theme ID
 * When null, uses system light/dark mode with the themes specified in systemLightThemeIdAtom/systemDarkThemeIdAtom
 */
export const selectedFullThemeIdAtom = atomWithStorage<string | null>(
  "preferences:selected-full-theme-id",
  null, // Default to null (follow system light/dark mode)
  undefined,
  { getOnInit: true },
);

/**
 * Theme to use when system is in light mode (only used when selectedFullThemeIdAtom is null)
 */
export const systemLightThemeIdAtom = atomWithStorage<string>(
  "preferences:system-light-theme-id",
  "liquid-glass-dark", // Default to Liquid Glass (dark) for both modes
  undefined,
  { getOnInit: true },
);

/**
 * Theme to use when system is in dark mode (only used when selectedFullThemeIdAtom is null)
 */
export const systemDarkThemeIdAtom = atomWithStorage<string>(
  "preferences:system-dark-theme-id",
  "liquid-glass-dark", // Default to Liquid Glass Dark
  undefined,
  { getOnInit: true },
);

/**
 * Cached full theme data for the selected theme
 * This is populated when a theme is selected and used for applying CSS variables
 */
export const fullThemeDataAtom = atom<VSCodeFullTheme | null>(null);

/**
 * All available full themes (built-in + imported + discovered)
 * This is a derived atom that combines all theme sources
 */
const _allFullThemesAtom = atom<VSCodeFullTheme[]>((_get) => {
  // This will be populated by the theme provider
  // For now, return empty - will be set imperatively
  return [];
});
