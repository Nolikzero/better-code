/**
 * VS Code built-in themes available in Shiki
 * These themes are bundled with Shiki and can be used directly
 */

interface VSCodeTheme {
  id: string;
  name: string;
  type: "light" | "dark";
  description?: string;
  source: "builtin" | "vscode-extensions" | "imported";
}

/**
 * Built-in VS Code themes available in Shiki
 * These are the themes that come pre-bundled with Shiki
 */
const VSCODE_BUILTIN_THEMES: VSCodeTheme[] = [
  {
    id: "dark-plus",
    name: "Dark+（默认深色）",
    type: "dark",
    source: "builtin",
  },
  {
    id: "light-plus",
    name: "Light+（默认浅色）",
    type: "light",
    source: "builtin",
  },
  { id: "min-dark", name: "Min 深色", type: "dark", source: "builtin" },
  { id: "min-light", name: "Min 浅色", type: "light", source: "builtin" },
  { id: "slack-dark", name: "Slack 深色", type: "dark", source: "builtin" },
  { id: "slack-ochin", name: "Slack Ochin", type: "light", source: "builtin" },
  { id: "vitesse-dark", name: "Vitesse 深色", type: "dark", source: "builtin" },
  {
    id: "vitesse-light",
    name: "Vitesse 浅色",
    type: "light",
    source: "builtin",
  },
  {
    id: "material-theme-darker",
    name: "Material 主题·更深",
    type: "dark",
    source: "builtin",
  },
  {
    id: "material-theme-default",
    name: "Material 主题·默认",
    type: "dark",
    source: "builtin",
  },
  {
    id: "material-theme-lighter",
    name: "Material 主题·更浅",
    type: "light",
    source: "builtin",
  },
  {
    id: "material-theme-ocean",
    name: "Material 主题·海洋",
    type: "dark",
    source: "builtin",
  },
  {
    id: "material-theme-palenight",
    name: "Material 主题·Palenight",
    type: "dark",
    source: "builtin",
  },
  { id: "poimandres", name: "Poimandres", type: "dark", source: "builtin" },
];

/**
 * Get all themes filtered by type
 */
function _getThemesByType(type: "light" | "dark"): VSCodeTheme[] {
  return VSCODE_BUILTIN_THEMES.filter((theme) => theme.type === type);
}

/**
 * Get theme by ID
 */
function _getThemeById(id: string): VSCodeTheme | undefined {
  return VSCODE_BUILTIN_THEMES.find((theme) => theme.id === id);
}

/**
 * Check if theme ID is a built-in theme
 */
export function isBuiltinTheme(themeId: string): boolean {
  return VSCODE_BUILTIN_THEMES.some((theme) => theme.id === themeId);
}
