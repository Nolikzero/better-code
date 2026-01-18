/**
 * VS Code theme colors to CSS variables mapping
 *
 * This module handles the conversion of VS Code theme colors to the app's CSS variables.
 * Uses a simplified mapping that extracts the essential colors for UI theming.
 */

/**
 * Mapping from VS Code theme color keys to CSS variable names
 * Priority order: first matching key wins
 */
const VSCODE_TO_CSS_MAP: Record<string, string[]> = {
  // Background colors
  "--background": ["editor.background", "editorPane.background"],
  "--foreground": ["editor.foreground", "foreground"],

  // Primary colors (buttons, links, accents)
  "--primary": [
    "button.background",
    "focusBorder",
    "textLink.foreground",
    "activityBarBadge.background",
  ],
  "--primary-foreground": ["button.foreground", "activityBarBadge.foreground"],

  // Card/Panel colors
  "--card": ["sideBar.background", "panel.background", "editor.background"],
  "--card-foreground": ["sideBar.foreground", "foreground"],

  // Popover/Dropdown colors
  "--popover": [
    "dropdown.background",
    "menu.background",
    "editorWidget.background",
    "editor.background",
  ],
  "--popover-foreground": [
    "dropdown.foreground",
    "menu.foreground",
    "editorWidget.foreground",
    "foreground",
  ],

  // Secondary colors (muted button backgrounds)
  "--secondary": [
    "button.secondaryBackground",
    "tab.inactiveBackground",
    "sideBar.background",
  ],
  "--secondary-foreground": [
    "button.secondaryForeground",
    "sideBar.foreground",
    "foreground",
  ],

  // Muted colors
  "--muted": [
    "tab.inactiveBackground",
    "editorGroupHeader.tabsBackground",
    "sideBar.background",
  ],
  "--muted-foreground": [
    "tab.inactiveForeground",
    "descriptionForeground",
    "editorLineNumber.foreground",
  ],

  // Accent colors (hover states, selections)
  "--accent": [
    "list.hoverBackground",
    "list.activeSelectionBackground",
    "editor.selectionBackground",
  ],

  // Text selection background
  "--selection": ["editor.selectionBackground", "selection.background"],
  "--accent-foreground": [
    "list.activeSelectionForeground",
    "list.hoverForeground",
    "foreground",
  ],

  // Border colors - includes fallbacks for themes with very transparent borders
  "--border": [
    "panel.border",
    "sideBar.border",
    "editorGroup.border",
    "input.border",
    "editorIndentGuide.activeBackground1",
    "tree.indentGuidesStroke",
    "editorRuler.foreground",
    "contrastBorder",
  ],

  // Input border color (used for input/select/textarea borders)
  "--input": [
    "input.border",
    "panel.border",
    "sideBar.border",
    "contrastBorder",
  ],

  // Input background color (used for chat input, search, etc.)
  "--input-background": [
    "input.background",
    "editorWidget.background",
    "dropdown.background",
  ],

  // Ring/Focus colors
  "--ring": ["focusBorder", "button.background"],

  // Destructive colors
  "--destructive": [
    "errorForeground",
    "editorError.foreground",
    "inputValidation.errorBorder",
  ],
  "--destructive-foreground": [
    "editorError.background",
    "inputValidation.errorBackground",
  ],

  // Timeline/Content background (used for sidebars, dialogs)
  // sideBar.background has priority for consistent sidebar color
  "--tl-background": [
    "sideBar.background",
    "panel.background",
    "editor.background",
  ],
};

/**
 * Convert HEX color to HSL values string (without hsl() wrapper)
 * Returns format: "H S% L%" for use in CSS variables
 * Note: Alpha is NOT included - Tailwind handles opacity via modifiers like /50
 *
 * @param hex - Hex color (3, 6, or 8 characters, with or without #)
 * @param backgroundHex - Optional background to blend with for transparent colors
 * @param preserveAlpha - If true, output alpha as "H S% L% / A%" instead of blending
 */
function hexToHSL(
  hex: string,
  backgroundHex?: string,
  preserveAlpha?: boolean,
): string {
  // Remove # if present
  hex = hex.replace(/^#/, "");

  // Handle shorthand hex (e.g., #fff)
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  let r: number;
  let g: number;
  let b: number;
  let outputAlpha: number | null = null;

  // Handle 8-char hex with alpha
  if (hex.length === 8) {
    const alpha = Number.parseInt(hex.slice(6, 8), 16) / 255;
    const fgR = Number.parseInt(hex.slice(0, 2), 16);
    const fgG = Number.parseInt(hex.slice(2, 4), 16);
    const fgB = Number.parseInt(hex.slice(4, 6), 16);

    if (preserveAlpha && alpha < 1) {
      // Preserve alpha in output (for selection backgrounds, etc.)
      r = fgR / 255;
      g = fgG / 255;
      b = fgB / 255;
      outputAlpha = alpha;
    } else if (backgroundHex && alpha < 1) {
      // Blend with background for solid color output
      const bg = backgroundHex.replace(/^#/, "");
      const bgR = Number.parseInt(bg.slice(0, 2), 16);
      const bgG = Number.parseInt(bg.slice(2, 4), 16);
      const bgB = Number.parseInt(bg.slice(4, 6), 16);

      // Alpha compositing: result = fg * alpha + bg * (1 - alpha)
      r = (fgR * alpha + bgR * (1 - alpha)) / 255;
      g = (fgG * alpha + bgG * (1 - alpha)) / 255;
      b = (fgB * alpha + bgB * (1 - alpha)) / 255;
    } else {
      // No background provided, just use the color as-is (ignore alpha)
      r = fgR / 255;
      g = fgG / 255;
      b = fgB / 255;
    }
  } else {
    r = Number.parseInt(hex.slice(0, 2), 16) / 255;
    g = Number.parseInt(hex.slice(2, 4), 16) / 255;
    b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  }

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;

  // Output with alpha if preserving
  if (outputAlpha !== null) {
    return `${hsl} / ${Math.round(outputAlpha * 100)}%`;
  }

  return hsl;
}

/**
 * Determine if a color is "light" (should use dark text) or "dark" (should use light text)
 */
export function isLightColor(hex: string): boolean {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  // Calculate perceived brightness using ITU-R BT.709 coefficients
  const brightness = r * 0.2126 + g * 0.7152 + b * 0.0722;
  return brightness > 128;
}

/**
 * Extract a color from VS Code theme colors using priority keys
 */
function getColorFromTheme(
  colors: Record<string, string>,
  priorityKeys: string[],
): string | null {
  for (const key of priorityKeys) {
    if (colors[key]) {
      return colors[key];
    }
  }
  return null;
}

// CSS variables that should preserve alpha instead of blending
// These are important for vibrancy/transparency themes
const PRESERVE_ALPHA_VARS = new Set([
  "--selection",
  "--background",
  "--card",
  "--popover",
  "--secondary",
  "--muted",
  "--accent",
  "--tl-background",
  "--input-background",
]);

/**
 * Generate CSS variable values from VS Code theme colors
 * Transparent colors are blended with the background for accurate appearance
 * Exception: selection colors preserve alpha for proper overlay effect
 */
export function generateCSSVariables(
  themeColors: Record<string, string>,
): Record<string, string> {
  const cssVariables: Record<string, string> = {};

  // Get background color for blending transparent colors
  const backgroundColor =
    themeColors["editor.background"] ||
    themeColors["editorPane.background"] ||
    "#000000";

  for (const [cssVar, priorityKeys] of Object.entries(VSCODE_TO_CSS_MAP)) {
    const color = getColorFromTheme(themeColors, priorityKeys);
    if (color) {
      const preserveAlpha = PRESERVE_ALPHA_VARS.has(cssVar);
      cssVariables[cssVar] = hexToHSL(color, backgroundColor, preserveAlpha);
    }
  }

  return cssVariables;
}

/**
 * Apply CSS variables to the document root
 */
export function applyCSSVariables(
  variables: Record<string, string>,
  element: HTMLElement = document.documentElement,
): void {
  for (const [name, value] of Object.entries(variables)) {
    element.style.setProperty(name, value);
  }
}

/**
 * Remove custom CSS variables from the document root (reset to defaults)
 */
export function removeCSSVariables(
  element: HTMLElement = document.documentElement,
): void {
  for (const cssVar of Object.keys(VSCODE_TO_CSS_MAP)) {
    element.style.removeProperty(cssVar);
  }
}

/**
 * Get the theme type (light/dark) from VS Code theme colors
 */
export function getThemeTypeFromColors(
  colors: Record<string, string>,
): "light" | "dark" {
  const bgColor =
    colors["editor.background"] || colors["editorPane.background"] || "#000000";
  return isLightColor(bgColor) ? "light" : "dark";
}
