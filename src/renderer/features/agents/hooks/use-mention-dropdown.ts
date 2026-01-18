import { useCallback, useState } from "react";
import type { FileMentionOption } from "../mentions/types";

interface MentionDropdownState {
  showMentionDropdown: boolean;
  mentionSearchText: string;
  mentionPosition: { top: number; left: number };
  showingFilesList: boolean;
  showingSkillsList: boolean;
  showingAgentsList: boolean;
  showingToolsList: boolean;
}

interface UseMentionDropdownReturn extends MentionDropdownState {
  /** Open the mention dropdown with search text and position */
  openMention: (searchText: string, rect: DOMRect) => void;
  /** Close the mention dropdown and reset subpage state */
  closeMention: () => void;
  /** Navigate to a category subpage within the dropdown */
  navigateToCategory: (
    category: "files" | "skills" | "agents" | "tools",
  ) => void;
  /** Handle mention selection - either navigates to category or calls insertMention callback */
  handleMentionSelect: (
    mention: FileMentionOption,
    insertMention: (mention: FileMentionOption) => void,
  ) => void;
}

/**
 * Hook for managing mention dropdown state and handlers.
 * Extracts common state management logic from active-chat and new-chat-form.
 */
export function useMentionDropdown(): UseMentionDropdownReturn {
  // Main dropdown state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearchText, setMentionSearchText] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

  // Subpage navigation state
  const [showingFilesList, setShowingFilesList] = useState(false);
  const [showingSkillsList, setShowingSkillsList] = useState(false);
  const [showingAgentsList, setShowingAgentsList] = useState(false);
  const [showingToolsList, setShowingToolsList] = useState(false);

  const resetSubpageState = useCallback(() => {
    setShowingFilesList(false);
    setShowingSkillsList(false);
    setShowingAgentsList(false);
    setShowingToolsList(false);
  }, []);

  const openMention = useCallback(
    (searchText: string, rect: DOMRect) => {
      setMentionSearchText(searchText);
      setMentionPosition({ top: rect.top, left: rect.left });
      resetSubpageState();
      setShowMentionDropdown(true);
    },
    [resetSubpageState],
  );

  const closeMention = useCallback(() => {
    setShowMentionDropdown(false);
    resetSubpageState();
  }, [resetSubpageState]);

  const navigateToCategory = useCallback(
    (category: "files" | "skills" | "agents" | "tools") => {
      switch (category) {
        case "files":
          setShowingFilesList(true);
          break;
        case "skills":
          setShowingSkillsList(true);
          break;
        case "agents":
          setShowingAgentsList(true);
          break;
        case "tools":
          setShowingToolsList(true);
          break;
      }
    },
    [],
  );

  const handleMentionSelect = useCallback(
    (
      mention: FileMentionOption,
      insertMention: (mention: FileMentionOption) => void,
    ) => {
      // Category navigation - enter subpage instead of inserting mention
      if (mention.type === "category") {
        if (mention.id === "files") {
          setShowingFilesList(true);
          return;
        }
        if (mention.id === "skills") {
          setShowingSkillsList(true);
          return;
        }
        if (mention.id === "agents") {
          setShowingAgentsList(true);
          return;
        }
        if (mention.id === "tools") {
          setShowingToolsList(true);
          return;
        }
      }

      // Otherwise: insert mention as normal
      insertMention(mention);
      setShowMentionDropdown(false);
      // Reset subpage state
      setShowingFilesList(false);
      setShowingSkillsList(false);
      setShowingAgentsList(false);
      setShowingToolsList(false);
    },
    [],
  );

  return {
    // State
    showMentionDropdown,
    mentionSearchText,
    mentionPosition,
    showingFilesList,
    showingSkillsList,
    showingAgentsList,
    showingToolsList,
    // Handlers
    openMention,
    closeMention,
    navigateToCategory,
    handleMentionSelect,
  };
}
