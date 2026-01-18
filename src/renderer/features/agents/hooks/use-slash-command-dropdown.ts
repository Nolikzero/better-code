import { useCallback, useState } from "react";

interface SlashDropdownState {
  showSlashDropdown: boolean;
  slashSearchText: string;
  slashPosition: { top: number; left: number };
}

interface UseSlashCommandDropdownReturn extends SlashDropdownState {
  /** Open the slash command dropdown with search text and position */
  openSlash: (searchText: string, rect: DOMRect) => void;
  /** Close the slash command dropdown */
  closeSlash: () => void;
}

/**
 * Hook for managing slash command dropdown state and handlers.
 * Extracts common state management logic from active-chat and new-chat-form.
 *
 * Note: handleSlashSelect is NOT included in this hook because:
 * - active-chat has extra commands: "clear" (creates sub-chat), "compact"
 * - Dependencies differ between files (onCreateNewSubChat, handleCompact)
 * - The select handler should remain in the component for context-specific logic
 */
export function useSlashCommandDropdown(): UseSlashCommandDropdownReturn {
  const [showSlashDropdown, setShowSlashDropdown] = useState(false);
  const [slashSearchText, setSlashSearchText] = useState("");
  const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 });

  const openSlash = useCallback((searchText: string, rect: DOMRect) => {
    setSlashSearchText(searchText);
    setSlashPosition({ top: rect.top, left: rect.left });
    setShowSlashDropdown(true);
  }, []);

  const closeSlash = useCallback(() => {
    setShowSlashDropdown(false);
  }, []);

  return {
    // State
    showSlashDropdown,
    slashSearchText,
    slashPosition,
    // Handlers
    openSlash,
    closeSlash,
  };
}
