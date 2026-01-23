"use client";

import { useAtom, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { api } from "../../../lib/mock-api";
import {
  type AgentMode,
  addedDirectoriesAtomFamily,
  historyNavAtomFamily,
} from "../atoms";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

export interface UseAgentModeManagementOptions {
  subChatId: string;
  parentChatId: string;
  agentMode: AgentMode;
  setAgentMode: (mode: AgentMode) => void;
  utils: any;
}

export interface UseAgentModeManagementReturn {
  addedDirs: string[];
  setAddedDirs: (dirs: string[]) => void;
}

/**
 * Hook to manage agent mode lifecycle including:
 * - Resetting navigation state when switching sub-chats
 * - Initializing mode and addedDirs from database when switching sub-chats
 * - Persisting mode changes to database with error handling
 * - Optimistic updates with rollback on error
 */
export function useAgentModeManagement(
  options: UseAgentModeManagementOptions,
): UseAgentModeManagementReturn {
  const { subChatId, parentChatId, agentMode, setAgentMode, utils } = options;

  // Atom state
  const historyKey = `chat:${parentChatId}`;
  const setNavState = useSetAtom(historyNavAtomFamily(historyKey));
  const [addedDirs, setAddedDirs] = useAtom(
    addedDirectoriesAtomFamily(subChatId),
  );

  // Reset navigation when switching sub-chats
  useEffect(() => {
    setNavState({ index: -1, savedInput: "" });
  }, [subChatId, setNavState]);

  // Mutation for updating sub-chat mode in database
  const updateSubChatModeMutation = api.agents.updateSubChatMode.useMutation({
    onSuccess: () => {
      // Invalidate to refetch with new mode from DB
      utils.agents.getAgentChat.invalidate({ chatId: parentChatId });
    },
    onError: (error: any, variables: any) => {
      // Don't revert if sub-chat not found in DB - it may not be persisted yet
      // This is expected for new sub-chats that haven't been saved to DB
      if (error.message === "Sub-chat not found") {
        console.warn("Sub-chat not found in DB, keeping local mode state");
        return;
      }

      // Revert local state on error to maintain sync with database
      const subChat = useAgentSubChatStore
        .getState()
        .allSubChats.find((sc) => sc.id === variables.subChatId);
      if (subChat) {
        // Revert to previous mode
        const revertedMode: AgentMode =
          variables.mode === "plan"
            ? "agent"
            : variables.mode === "agent"
              ? "plan"
              : "agent";
        useAgentSubChatStore
          .getState()
          .updateSubChatMode(variables.subChatId, revertedMode);
        // Update ref BEFORE setAgentMode to prevent useEffect from triggering
        lastAgentModeRef.current = revertedMode;
        setAgentMode(revertedMode);
      }
      console.error("Failed to update sub-chat mode:", error.message);
    },
  });

  // Track last initialized sub-chat to prevent re-initialization
  const lastInitializedRef = useRef<string | null>(null);

  // Initialize mode from sub-chat metadata ONLY when switching sub-chats
  useEffect(() => {
    if (subChatId && subChatId !== lastInitializedRef.current) {
      const subChat = useAgentSubChatStore
        .getState()
        .allSubChats.find((sc) => sc.id === subChatId);

      if (subChat?.mode) {
        setAgentMode(subChat.mode as AgentMode);
      }

      // Initialize addedDirs from database (stored as JSON string)
      if ((subChat as any)?.addedDirs) {
        try {
          const dirs = JSON.parse((subChat as any).addedDirs);
          if (Array.isArray(dirs)) {
            setAddedDirs(dirs);
          }
        } catch {
          // Ignore parse errors
        }
      } else {
        setAddedDirs([]);
      }

      lastInitializedRef.current = subChatId;
    }
    // Dependencies: Only subChatId - setAgentMode and setAddedDirs are stable, useAgentSubChatStore is external
  }, [subChatId, setAgentMode, setAddedDirs]);

  // Track last mode to detect actual user changes (not store updates)
  const lastAgentModeRef = useRef<AgentMode>(agentMode);

  // Update mode for current sub-chat when USER changes agentMode
  useEffect(() => {
    // Skip if agentMode didn't actually change
    if (lastAgentModeRef.current === agentMode) {
      return;
    }

    lastAgentModeRef.current = agentMode;

    if (subChatId) {
      // Update local store immediately (optimistic update)
      useAgentSubChatStore.getState().updateSubChatMode(subChatId, agentMode);

      // Save to database with error handling to maintain consistency
      if (!subChatId.startsWith("temp-")) {
        updateSubChatModeMutation.mutate({ subChatId, mode: agentMode });
      }
    }
    // Dependencies: updateSubChatModeMutation.mutate is stable, useAgentSubChatStore is external
  }, [agentMode, subChatId, updateSubChatModeMutation.mutate]);

  return {
    addedDirs,
    setAddedDirs,
  };
}
