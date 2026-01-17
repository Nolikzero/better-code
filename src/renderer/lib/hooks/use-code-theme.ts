import { useAtomValue } from "jotai"
import { useTheme } from "next-themes"
import {
  vscodeCodeThemeLightAtom,
  vscodeCodeThemeDarkAtom,
  fullThemeDataAtom,
} from "../atoms"

/**
 * Hook to get the current code theme based on UI theme
 * Returns the appropriate theme ID for light or dark mode
 * 
 * Priority:
 * 1. Full VS Code theme (if selected)
 * 2. Fallback to legacy code-only theme atoms
 */
export function useCodeTheme(): string {
  const { resolvedTheme } = useTheme()
  const lightTheme = useAtomValue(vscodeCodeThemeLightAtom)
  const darkTheme = useAtomValue(vscodeCodeThemeDarkAtom)
  const fullTheme = useAtomValue(fullThemeDataAtom)

  // If a full VS Code theme is selected, use its ID for syntax highlighting
  if (fullTheme) {
    return fullTheme.id
  }

  // Fallback to legacy code-only theme selection
  return resolvedTheme === "light" ? lightTheme : darkTheme
}
