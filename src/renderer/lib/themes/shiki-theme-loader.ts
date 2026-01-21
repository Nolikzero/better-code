import { createHighlighterCore, type HighlighterCore } from "@shikijs/core";
import { createOnigurumaEngine } from "@shikijs/engine-oniguruma";
import langBash from "@shikijs/langs/bash";
import langCss from "@shikijs/langs/css";
import langGo from "@shikijs/langs/go";
import langHtml from "@shikijs/langs/html";
import langJavascript from "@shikijs/langs/javascript";
import langJson from "@shikijs/langs/json";
import langJsx from "@shikijs/langs/jsx";
import langMarkdown from "@shikijs/langs/markdown";
import langPython from "@shikijs/langs/python";
import langRust from "@shikijs/langs/rust";
import langTsx from "@shikijs/langs/tsx";
// Static imports for languages - only these will be bundled
import langTypescript from "@shikijs/langs/typescript";
// Static imports for themes - only these will be bundled
import themeGithubDark from "@shikijs/themes/github-dark";
import themeGithubLight from "@shikijs/themes/github-light";
import themeMinDark from "@shikijs/themes/min-dark";
import themeMinLight from "@shikijs/themes/min-light";
import themeVesper from "@shikijs/themes/vesper";
import themeVitesseDark from "@shikijs/themes/vitesse-dark";
import themeVitesseLight from "@shikijs/themes/vitesse-light";
import type { VSCodeFullTheme } from "../atoms";
import { isBuiltinTheme } from "../vscode-themes";
import { getBuiltinThemeById } from "./builtin-themes";

/**
 * Shared Shiki highlighter instance
 * Initialized with default themes, can load additional themes dynamically
 */
let highlighterPromise: Promise<HighlighterCore> | null = null;

/**
 * Languages supported by the highlighter - static imports for tree-shaking
 */
const SUPPORTED_LANGUAGES = [
  langTypescript,
  langJavascript,
  langTsx,
  langJsx,
  langHtml,
  langCss,
  langJson,
  langPython,
  langGo,
  langRust,
  langBash,
  langMarkdown,
];

/**
 * Default themes to load initially - static imports for tree-shaking
 */
const DEFAULT_THEMES = [
  themeGithubDark,
  themeGithubLight,
  themeVitesseDark,
  themeVitesseLight,
  themeMinDark,
  themeMinLight,
  themeVesper,
];

/**
 * Theme names that are bundled by default
 */
const DEFAULT_THEME_NAMES = [
  "github-dark",
  "github-light",
  "vitesse-dark",
  "vitesse-light",
  "min-dark",
  "min-light",
  "vesper",
];

/**
 * Map our custom theme IDs to Shiki bundled themes for syntax highlighting
 * Only themes WITHOUT tokenColors need mapping - themes with tokenColors use their own
 */
const THEME_TO_SHIKI_MAP: Record<string, string> = {
  // Default themes use GitHub themes (no tokenColors)
  "default-dark": "github-dark",
  "default-light": "github-light",
  // Claude themes use GitHub themes (no tokenColors)
  "claude-dark": "github-dark",
  "claude-light": "github-light",
  // Vesper maps to shiki's vesper theme
  "vesper-dark": "vesper",
  // Vitesse themes map directly
  "vitesse-dark": "vitesse-dark",
  "vitesse-light": "vitesse-light",
  // Min themes map directly
  "min-dark": "min-dark",
  "min-light": "min-light",
  // Cursor themes have their own tokenColors - use them directly via loadFullTheme
  // (not in this map, so they'll use their own tokenColors)
};

/**
 * Get or create the Shiki highlighter instance
 */
async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: DEFAULT_THEMES,
      langs: SUPPORTED_LANGUAGES,
      engine: createOnigurumaEngine(
        () => import("@shikijs/engine-oniguruma/wasm-inlined"),
      ),
    });
  }
  return highlighterPromise;
}

// Cache for full themes (from the new full theme system)
const fullThemesCache = new Map<string, any>();

/**
 * Load a full VS Code theme into Shiki
 * This handles themes from the new full theme system (BUILTIN_THEMES, imported, discovered)
 */
async function loadFullTheme(theme: VSCodeFullTheme): Promise<void> {
  // Skip if already loaded
  if (fullThemesCache.has(theme.id)) {
    return;
  }

  const highlighter = await getHighlighter();

  try {
    // Create a Shiki-compatible theme object
    const shikiTheme = {
      name: theme.id,
      type: theme.type,
      colors: theme.colors,
      tokenColors: theme.tokenColors || [],
    };

    await highlighter.loadTheme(shikiTheme);
    fullThemesCache.set(theme.id, shikiTheme);
  } catch (error) {
    console.error(`Failed to load full theme ${theme.id}:`, error);
    // Don't throw - allow fallback to default theme
  }
}

/**
 * Check if a theme is a Shiki bundled theme (not our custom builtin themes)
 */
function isShikiBundledTheme(themeId: string): boolean {
  // These are the Shiki bundled themes that we load
  return DEFAULT_THEME_NAMES.includes(themeId);
}

/**
 * Get the theme to use for syntax highlighting
 * Returns the theme ID (either bundled or custom loaded)
 */
function getShikiThemeForHighlighting(themeId: string): string {
  // If there's a direct mapping to a bundled theme, use it
  if (themeId in THEME_TO_SHIKI_MAP) {
    console.log(
      "[getShikiThemeForHighlighting] Using mapped theme:",
      THEME_TO_SHIKI_MAP[themeId],
    );
    return THEME_TO_SHIKI_MAP[themeId];
  }

  // If it's already a shiki bundled theme, use it directly
  if (isShikiBundledTheme(themeId)) {
    console.log("[getShikiThemeForHighlighting] Using bundled theme:", themeId);
    return themeId;
  }

  // If the theme is loaded in our cache, check if it has valid tokenColors
  // A proper syntax highlighting theme needs at least ~10 tokenColor rules
  const MIN_TOKEN_COLORS_FOR_HIGHLIGHTING = 10;
  if (fullThemesCache.has(themeId)) {
    const cachedTheme = fullThemesCache.get(themeId);
    const tokenColorsCount = cachedTheme?.tokenColors?.length ?? 0;
    console.log("[getShikiThemeForHighlighting] Found in cache:", {
      themeId,
      hasTokenColors: !!cachedTheme?.tokenColors,
      tokenColorsLength: tokenColorsCount,
      themeType: cachedTheme?.type,
    });
    // Only use the cached theme if it has enough tokenColors for syntax highlighting
    if (tokenColorsCount >= MIN_TOKEN_COLORS_FOR_HIGHLIGHTING) {
      return themeId;
    }
    // Theme is loaded but has insufficient tokenColors - fall back based on theme type
    const themeType = cachedTheme?.type;
    const fallback = themeType === "light" ? "github-light" : "github-dark";
    console.log(
      "[getShikiThemeForHighlighting] Insufficient tokenColors (" +
        tokenColorsCount +
        "), falling back to:",
      fallback,
    );
    return fallback;
  }

  // Check the theme type and use appropriate default
  const builtinTheme = getBuiltinThemeById(themeId);
  if (builtinTheme) {
    const builtinTokenColorsCount = builtinTheme.tokenColors?.length ?? 0;
    // If the theme has enough tokenColors, load it and use it
    if (builtinTokenColorsCount >= MIN_TOKEN_COLORS_FOR_HIGHLIGHTING) {
      console.log(
        "[getShikiThemeForHighlighting] Using builtin theme with tokenColors:",
        themeId,
        builtinTokenColorsCount,
      );
      return themeId; // Will be loaded by ensureThemeLoaded
    }
    const fallback =
      builtinTheme.type === "light" ? "github-light" : "github-dark";
    console.log(
      "[getShikiThemeForHighlighting] Builtin insufficient tokenColors (" +
        builtinTokenColorsCount +
        "), falling back to:",
      fallback,
    );
    return fallback;
  }

  // Default to github-dark
  console.log(
    "[getShikiThemeForHighlighting] No theme found, defaulting to github-dark",
  );
  return "github-dark";
}

/**
 * Ensure a theme is loaded (built-in or bundled)
 * This should be called before using a theme for highlighting
 */
async function ensureThemeLoaded(themeId: string): Promise<void> {
  // Check if it's a Shiki bundled theme (always available)
  if (isShikiBundledTheme(themeId)) {
    return;
  }

  // Check if already loaded in our cache
  if (fullThemesCache.has(themeId)) {
    return;
  }

  // Check if it's one of our builtin full themes
  const builtinFullTheme = getBuiltinThemeById(themeId);
  if (builtinFullTheme) {
    await loadFullTheme(builtinFullTheme);
    return;
  }

  // Check if it's a legacy builtin theme (from vscode-themes.ts)
  if (isBuiltinTheme(themeId)) {
    // These should also be Shiki bundled, but just in case
    return;
  }

  // Theme not found - this is an error case
  console.warn(`Theme ${themeId} not found, falling back to github-dark`);
}

/**
 * Check if a theme is available (loaded or can be loaded)
 */
function _isThemeAvailable(themeId: string): boolean {
  return (
    isShikiBundledTheme(themeId) ||
    fullThemesCache.has(themeId) ||
    !!getBuiltinThemeById(themeId) ||
    isBuiltinTheme(themeId)
  );
}

/**
 * Highlight code with a specific theme
 * Uses custom themes with tokenColors when available, otherwise maps to bundled themes
 */
export async function highlightCode(
  code: string,
  language: string,
  themeId: string,
): Promise<string> {
  const highlighter = await getHighlighter();

  // Ensure the theme is loaded (if it's a custom theme with tokenColors)
  await ensureThemeLoaded(themeId);

  // Get the theme to use for highlighting
  const shikiTheme = getShikiThemeForHighlighting(themeId);

  // Check if theme has tokenColors
  const cachedTheme = fullThemesCache.get(themeId);
  console.log("[shiki-theme-loader] highlightCode:", {
    themeId,
    shikiTheme,
    language,
    cachedThemeHasTokenColors: cachedTheme?.tokenColors?.length ?? 0,
    loadedThemes: highlighter.getLoadedThemes(),
  });

  const loadedLangs = highlighter.getLoadedLanguages();
  const lang = loadedLangs.includes(language) ? language : "plaintext";

  const html = highlighter.codeToHtml(code, {
    lang,
    theme: shikiTheme,
  });

  // Extract just the code content from shiki's output (remove wrapper)
  const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
  return match ? match[1] : code;
}

/**
 * Highlight code with native Shiki line structure for CSS-based line numbers.
 * Returns the full <pre><code> structure with each line wrapped in a span.line element.
 * Use CSS counters to display line numbers.
 */
export async function highlightCodeWithLineNumbers(
  code: string,
  language: string,
  themeId: string,
): Promise<string> {
  const highlighter = await getHighlighter();

  // Ensure the theme is loaded (if it's a custom theme with tokenColors)
  await ensureThemeLoaded(themeId);

  // Get the theme to use for highlighting
  const shikiTheme = getShikiThemeForHighlighting(themeId);

  const loadedLangs = highlighter.getLoadedLanguages();
  const lang = loadedLangs.includes(language) ? language : "plaintext";

  // Return full HTML with pre/code structure - each line gets a span.line element
  const html = highlighter.codeToHtml(code, {
    lang,
    theme: shikiTheme,
  });

  return html;
}

/**
 * Get all loaded theme IDs
 */
async function _getLoadedThemes(): Promise<string[]> {
  const highlighter = await getHighlighter();
  return highlighter.getLoadedThemes();
}
