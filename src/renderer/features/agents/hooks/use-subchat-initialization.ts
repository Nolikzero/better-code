"use client";

import { useEffect } from "react";
import type { ProviderId } from "../../../lib/atoms";
import {
  type SubChatMeta,
  useAgentSubChatStore,
} from "../stores/sub-chat-store";

export interface UseSubChatInitializationOptions {
  chatId: string;
  agentChat: any; // From tRPC query
  agentSubChats: any[]; // From tRPC query
}

/**
 * Hook to initialize sub-chat store from database when chat loads.
 * Handles race conditions, validates open tabs, and manages active sub-chat selection.
 *
 * This is a complex initialization effect that:
 * - Detects when chatId changes and updates store
 * - Guards against race conditions where store has fresher data than DB
 * - Merges DB sub-chats with local sub-chats
 * - Creates placeholders for open tabs not yet in DB
 * - Validates and fixes activeSubChatId state
 */
export function useSubChatInitialization(
  options: UseSubChatInitializationOptions,
) {
  const { chatId, agentChat, agentSubChats } = options;

  useEffect(() => {
    if (!agentChat) return;

    const store = useAgentSubChatStore.getState();

    // Only initialize if chatId changed
    if (store.chatId !== chatId) {
      store.setChatId(chatId);
    }

    // Re-get fresh state after setChatId may have loaded from localStorage
    const freshState = useAgentSubChatStore.getState();

    // Guard: Check if store has "fresh" data from creation that DB doesn't know about yet.
    // This prevents the race condition where new-chat-form.tsx sets fresh subchat data,
    // but this effect runs with stale cached agentSubChats and overwrites it.
    const storeHasFreshData = freshState.allSubChats.some(
      (sc) => !agentSubChats.find((dbSc) => dbSc.id === sc.id),
    );
    if (storeHasFreshData && freshState.allSubChats.length > 0) {
      // Store has newer data than DB query - preserve it and just validate open tabs
      const validOpenIds = freshState.openSubChatIds.filter((id) =>
        freshState.allSubChats.some((sc) => sc.id === id),
      );
      if (validOpenIds.length === 0 && freshState.allSubChats.length > 0) {
        freshState.addToOpenSubChats(freshState.allSubChats[0].id);
        freshState.setActiveSubChat(freshState.allSubChats[0].id);
      } else if (validOpenIds.length > 0) {
        const currentActive = freshState.activeSubChatId;
        if (!currentActive || !validOpenIds.includes(currentActive)) {
          freshState.setActiveSubChat(validOpenIds[0]);
        }
      }
      return;
    }

    // Get sub-chats from DB (like Canvas - no isPersistedInDb flag)
    // Build a map of existing local sub-chats to preserve their created_at if DB doesn't have it
    const existingSubChatsMap = new Map(
      freshState.allSubChats.map((sc) => [sc.id, sc]),
    );

    const dbSubChats: SubChatMeta[] = agentSubChats.map((sc) => {
      const existingLocal = existingSubChatsMap.get(sc.id);
      const createdAt =
        typeof sc.created_at === "string"
          ? sc.created_at
          : sc.created_at?.toISOString();
      const updatedAt =
        typeof sc.updated_at === "string"
          ? sc.updated_at
          : sc.updated_at?.toISOString();
      return {
        id: sc.id,
        name: sc.name || "New Chat",
        // Prefer DB timestamp, fall back to local timestamp, then current time
        created_at:
          createdAt ?? existingLocal?.created_at ?? new Date().toISOString(),
        updated_at: updatedAt ?? existingLocal?.updated_at,
        mode:
          (sc.mode as "plan" | "agent" | "ralph" | undefined) ||
          existingLocal?.mode ||
          "agent",
        providerId:
          (sc.providerId as ProviderId | undefined) ||
          existingLocal?.providerId,
      };
    });
    const dbSubChatIds = new Set(dbSubChats.map((sc) => sc.id));

    // Start with DB sub-chats
    const allSubChats: SubChatMeta[] = [...dbSubChats];

    // For each open tab ID that's NOT in DB, add placeholder (like Canvas)
    // This prevents losing tabs during race conditions
    const currentOpenIds = freshState.openSubChatIds;
    currentOpenIds.forEach((id) => {
      if (!dbSubChatIds.has(id)) {
        allSubChats.push({
          id,
          name: "New Chat",
          created_at: new Date().toISOString(),
        });
      }
    });

    freshState.setAllSubChats(allSubChats);

    // All open tabs are now valid (we created placeholders for non-DB ones)
    const validOpenIds = currentOpenIds;

    if (validOpenIds.length === 0 && allSubChats.length > 0) {
      // No valid open tabs, open the first sub-chat
      freshState.addToOpenSubChats(allSubChats[0].id);
      freshState.setActiveSubChat(allSubChats[0].id);
    } else if (validOpenIds.length > 0) {
      // Validate active tab is in open tabs
      const currentActive = freshState.activeSubChatId;
      if (!currentActive || !validOpenIds.includes(currentActive)) {
        freshState.setActiveSubChat(validOpenIds[0]);
      }
    }
  }, [agentChat, chatId, agentSubChats]);
}
