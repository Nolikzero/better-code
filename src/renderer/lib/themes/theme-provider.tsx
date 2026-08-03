"use client";

/**
 * VS Code Theme Provider
 *
 * Provides full VS Code theme support for the application:
 * - Applies CSS variables for UI theming
 * - Provides terminal theme for xterm.js
 * - Integrates with Shiki for syntax highlighting
 */

import type { ITheme } from "@xterm/xterm";
import { useAtom } from "jotai";
import { useTheme } from "next-themes";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  fullThemeDataAtom,
  selectedFullThemeIdAtom,
  systemDarkThemeIdAtom,
  systemLightThemeIdAtom,
  type VSCodeFullTheme,
} from "../atoms";
import { trpc } from "../trpc";
import {
  ALUCARD_THEME_ID,
  BUILTIN_THEMES,
  DRACULA_THEME_ID,
  getBuiltinThemeById,
  resolveBuiltinThemeId,
} from "./builtin-themes";
import { extractTerminalTheme } from "./terminal-theme-mapper";
import {
  applyCSSVariables,
  generateCSSVariables,
  getThemeTypeFromColors,
  removeCSSVariables,
} from "./vscode-to-css-mapping";

/**
 * Theme context value
 */
interface ThemeContextValue {
  // Current theme
  currentTheme: VSCodeFullTheme | null;
  currentThemeId: string | null;

  // Theme type (light/dark)
  isDark: boolean;

  // Terminal theme for xterm.js
  terminalTheme: ITheme;

  // All available themes
  allThemes: VSCodeFullTheme[];

  // Theme actions
  setThemeById: (id: string | null) => void;

  // Shiki theme name (for syntax highlighting)
  shikiThemeName: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Hook to access the theme context
 */
function useVSCodeTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useVSCodeTheme must be used within a VSCodeThemeProvider");
  }
  return context;
}

/**
 * Default terminal themes (fallback when no VS Code theme is selected)
 */
const DEFAULT_TERMINAL_THEME_DARK: ITheme = {
  background: "#21222c",
  foreground: "#f8f8f2",
  cursor: "#bd93f9",
  cursorAccent: "#21222c",
  selectionBackground: "#44475a",
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

const DEFAULT_TERMINAL_THEME_LIGHT: ITheme = {
  background: "#f7f1d9",
  foreground: "#1f1f1f",
  cursor: "#644ac9",
  cursorAccent: "#f7f1d9",
  selectionBackground: "#cfcfde",
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

interface VSCodeThemeProviderProps {
  children: ReactNode;
}

/**
 * VS Code Theme Provider Component
 */
export function VSCodeThemeProvider({ children }: VSCodeThemeProviderProps) {
  const { resolvedTheme, setTheme: setNextTheme } = useTheme();

  // Atoms
  const [selectedThemeId, setSelectedThemeId] = useAtom(
    selectedFullThemeIdAtom,
  );
  const [fullThemeData, setFullThemeData] = useAtom(fullThemeDataAtom);
  const [systemLightThemeId, setSystemLightThemeId] = useAtom(
    systemLightThemeIdAtom,
  );
  const [systemDarkThemeId, setSystemDarkThemeId] = useAtom(
    systemDarkThemeIdAtom,
  );

  // Use builtin themes only
  const allThemes = BUILTIN_THEMES;

  // Determine if we're in dark mode (from next-themes or theme type)
  const isDark = useMemo(() => {
    if (fullThemeData) {
      return fullThemeData.type === "dark";
    }
    return resolvedTheme === "dark";
  }, [fullThemeData, resolvedTheme]);

  const resolvedSystemLightThemeId = ALUCARD_THEME_ID;
  const resolvedSystemDarkThemeId = DRACULA_THEME_ID;
  const selectedFallbackType = resolvedTheme === "light" ? "light" : "dark";
  const resolvedSelectedThemeId =
    selectedThemeId === null
      ? null
      : resolveBuiltinThemeId(selectedThemeId, selectedFallbackType);

  // Persist one-time aliases so installations carrying former theme IDs recover
  // without flashing an unthemed renderer or keeping stale selections.
  useEffect(() => {
    if (systemLightThemeId !== resolvedSystemLightThemeId) {
      setSystemLightThemeId(ALUCARD_THEME_ID);
    }
    if (systemDarkThemeId !== resolvedSystemDarkThemeId) {
      setSystemDarkThemeId(DRACULA_THEME_ID);
    }
    if (
      selectedThemeId !== null &&
      selectedThemeId !== resolvedSelectedThemeId
    ) {
      setSelectedThemeId(resolvedSelectedThemeId);
    }
  }, [
    resolvedSelectedThemeId,
    resolvedSystemDarkThemeId,
    resolvedSystemLightThemeId,
    selectedThemeId,
    setSelectedThemeId,
    setSystemDarkThemeId,
    setSystemLightThemeId,
    systemDarkThemeId,
    systemLightThemeId,
  ]);

  // Find the current theme by ID, including the fixed system pair.
  const currentTheme = useMemo(() => {
    const themeId =
      resolvedSelectedThemeId ??
      (resolvedTheme === "dark"
        ? resolvedSystemDarkThemeId
        : resolvedSystemLightThemeId);
    return getBuiltinThemeById(themeId) ?? null;
  }, [
    resolvedSelectedThemeId,
    resolvedSystemDarkThemeId,
    resolvedSystemLightThemeId,
    resolvedTheme,
  ]);

  // Update fullThemeData when theme changes
  useEffect(() => {
    if (currentTheme) {
      setFullThemeData(currentTheme);
    } else {
      setFullThemeData(null);
    }
  }, [currentTheme, setFullThemeData]);

  // Track vibrancy state
  const vibrancyActiveRef = useRef(false);
  const liquidGlassActiveRef = useRef(false);
  const currentVibrancyThemeRef = useRef<string | null>(null);
  const setVibrancy = trpc.window.setVibrancy.useMutation();
  const setLiquidGlass = trpc.window.setLiquidGlass.useMutation();

  // Apply CSS variables when theme changes
  useEffect(() => {
    if (fullThemeData?.colors) {
      // Generate and apply CSS variables
      const cssVars = generateCSSVariables(fullThemeData.colors);
      applyCSSVariables(cssVars);

      // For system mode, let next-themes handle the class
      if (selectedThemeId === null) {
        setNextTheme("system");
      } else {
        // Sync next-themes with the theme type
        const themeType = getThemeTypeFromColors(fullThemeData.colors);
        if (themeType === "dark") {
          document.documentElement.classList.add("dark");
          document.documentElement.classList.remove("light");
        } else {
          document.documentElement.classList.remove("dark");
          document.documentElement.classList.add("light");
        }
        setNextTheme(themeType);
      }
    } else {
      // Remove custom CSS variables when no theme is selected
      removeCSSVariables();
    }

    return () => {
      // Cleanup on unmount
      removeCSSVariables();
    };
  }, [fullThemeData, selectedThemeId, setNextTheme]);

  // Handle vibrancy/liquid glass for transparent themes (macOS)
  useEffect(() => {
    const platform = window.desktopApi?.platform;

    // Liquid Glass uses a transparent renderer root. It is native macOS-only:
    // applying that class on Windows/Linux exposes the native window backdrop
    // and creates unusable see-through layers.
    if (platform !== "darwin") {
      document.documentElement.classList.remove("vibrancy-active");
      document.documentElement.classList.remove("vibrancy-fallback");
      vibrancyActiveRef.current = false;
      liquidGlassActiveRef.current = false;
      currentVibrancyThemeRef.current = null;
      return;
    }

    const hasVibrancy = fullThemeData?.vibrancy?.enabled === true;
    const vibrancyThemeId = hasVibrancy ? fullThemeData?.id : null;

    // Check if vibrancy state actually needs to change
    const vibrancyChanged = vibrancyThemeId !== currentVibrancyThemeRef.current;

    if (hasVibrancy && vibrancyChanged) {
      // Enable or update vibrancy/liquid glass
      if (platform === "darwin") {
        const forceAppearance = fullThemeData.vibrancy?.forceAppearance;
        setLiquidGlass.mutate(
          {
            enabled: true,
            options: fullThemeData.vibrancy?.liquidGlass,
            forceAppearance,
          },
          {
            onSuccess: (result) => {
              if (result.fallback || !result.success) {
                // Liquid glass not supported, fall back to legacy vibrancy
                console.log(
                  "[Theme] Liquid glass not available, using legacy vibrancy",
                );
                setVibrancy.mutate({
                  type: fullThemeData.vibrancy?.type ?? "under-window",
                  visualEffectState: fullThemeData.vibrancy?.visualEffectState,
                  forceAppearance,
                });
                liquidGlassActiveRef.current = false;
              } else {
                liquidGlassActiveRef.current = true;
                console.log("[Theme] Liquid glass enabled");
              }
            },
          },
        );
      }

      vibrancyActiveRef.current = true;
      currentVibrancyThemeRef.current = vibrancyThemeId;
      // Add class for CSS transparency styles
      document.documentElement.classList.add("vibrancy-active");
    } else if (!hasVibrancy && vibrancyActiveRef.current) {
      // Disable vibrancy/liquid glass
      if (liquidGlassActiveRef.current) {
        setLiquidGlass.mutate({ enabled: false });
        liquidGlassActiveRef.current = false;
      }
      setVibrancy.mutate({ type: null });
      vibrancyActiveRef.current = false;
      currentVibrancyThemeRef.current = null;
      document.documentElement.classList.remove("vibrancy-active");
      document.documentElement.classList.remove("vibrancy-fallback");
    }
    // Only depend on fullThemeData - mutation objects are stable
  }, [fullThemeData]);

  // Get terminal theme
  const terminalTheme = useMemo((): ITheme => {
    if (fullThemeData?.colors) {
      return extractTerminalTheme(fullThemeData.colors);
    }
    // Fallback to default themes
    return isDark ? DEFAULT_TERMINAL_THEME_DARK : DEFAULT_TERMINAL_THEME_LIGHT;
  }, [fullThemeData, isDark]);

  // Get Shiki theme name for syntax highlighting
  const shikiThemeName = useMemo(() => {
    if (fullThemeData) {
      // For builtin themes, use the ID directly (Shiki supports these)
      if (fullThemeData.source === "builtin") {
        return fullThemeData.id;
      }
      // For imported/discovered themes, we'd need to load them into Shiki
      // For now, fall back to a compatible theme
      return fullThemeData.type === "dark" ? "github-dark" : "github-light";
    }
    // Default based on system theme
    return isDark ? "github-dark" : "github-light";
  }, [fullThemeData, isDark]);

  // Theme actions
  const setThemeById = useCallback(
    (id: string | null) => {
      setSelectedThemeId(id);
    },
    [setSelectedThemeId],
  );

  const contextValue = useMemo(
    (): ThemeContextValue => ({
      currentTheme: fullThemeData,
      currentThemeId: selectedThemeId,
      isDark,
      terminalTheme,
      allThemes,
      setThemeById,
      shikiThemeName,
    }),
    [
      fullThemeData,
      selectedThemeId,
      isDark,
      terminalTheme,
      allThemes,
      setThemeById,
      shikiThemeName,
    ],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to get just the terminal theme (for performance)
 */
function _useTerminalTheme(): ITheme {
  const { terminalTheme } = useVSCodeTheme();
  return terminalTheme;
}

/**
 * Hook to get just the Shiki theme name
 */
function _useShikiTheme(): string {
  const { shikiThemeName } = useVSCodeTheme();
  return shikiThemeName;
}
