"use client";

import { useEffect } from "react";
import { isDesktopApp } from "../../../lib/utils/platform";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

export interface UseSubChatKeyboardOptions {
  onCreateNew: () => Promise<void>;
  addToUndoStack: (subChatId: string) => void;
  isMultiSelectMode: boolean;
  selectedIds: Set<string>;
  clearSelection: () => void;
}

/**
 * Hook to handle sub-chat keyboard shortcuts:
 * - Cmd+T / Opt+Cmd+T - New sub-chat
 * - Cmd+W / Opt+Cmd+W - Close sub-chat (single or bulk)
 * - Cmd+[ / Cmd+] - Navigate between sub-chats
 */
export function useSubChatKeyboard({
  onCreateNew,
  addToUndoStack,
  isMultiSelectMode,
  selectedIds,
  clearSelection,
}: UseSubChatKeyboardOptions): void {
  // Keyboard shortcut: New sub-chat
  // Web: Opt+Cmd+T (browser uses Cmd+T for new tab)
  // Desktop: Cmd+T
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp();

      // Desktop: Cmd+T (without Alt)
      if (isDesktop && e.metaKey && e.code === "KeyT" && !e.altKey) {
        e.preventDefault();
        onCreateNew();
        return;
      }

      // Web: Opt+Cmd+T (with Alt)
      if (e.altKey && e.metaKey && e.code === "KeyT") {
        e.preventDefault();
        onCreateNew();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCreateNew]);

  // Keyboard shortcut: Close active sub-chat (or bulk close if multi-select mode)
  // Web: Opt+Cmd+W (browser uses Cmd+W to close tab)
  // Desktop: Cmd+W
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp();

      // Desktop: Cmd+W (without Alt)
      const isDesktopShortcut =
        isDesktop &&
        e.metaKey &&
        e.code === "KeyW" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey;
      // Web: Opt+Cmd+W (with Alt)
      const isWebShortcut = e.altKey && e.metaKey && e.code === "KeyW";

      if (isDesktopShortcut || isWebShortcut) {
        e.preventDefault();

        const store = useAgentSubChatStore.getState();

        // If multi-select mode, bulk close selected sub-chats
        if (isMultiSelectMode && selectedIds.size > 0) {
          const idsToClose = Array.from(selectedIds);
          const remainingOpenIds = store.openSubChatIds.filter(
            (id) => !idsToClose.includes(id),
          );

          // Don't close all tabs via hotkey - user should use sidebar dialog for last tab
          if (remainingOpenIds.length > 0) {
            idsToClose.forEach((id) => {
              store.removeFromOpenSubChats(id);
              addToUndoStack(id);
            });
          }
          clearSelection();
          return;
        }

        // Otherwise close active sub-chat
        const activeId = store.activeSubChatId;
        const openIds = store.openSubChatIds;

        // Only close if we have more than one tab open and there's an active tab
        // removeFromOpenSubChats automatically switches to the last remaining tab
        if (activeId && openIds.length > 1) {
          store.removeFromOpenSubChats(activeId);
          addToUndoStack(activeId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMultiSelectMode, selectedIds, clearSelection, addToUndoStack]);

  // Keyboard shortcut: Navigate between sub-chats
  // Web: Opt+Cmd+[ and Opt+Cmd+] (browser uses Cmd+[ for back)
  // Desktop: Cmd+[ and Cmd+]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp();

      // Check for previous sub-chat shortcut ([ key)
      const isPrevDesktop =
        isDesktop &&
        e.metaKey &&
        e.code === "BracketLeft" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey;
      const isPrevWeb = e.altKey && e.metaKey && e.code === "BracketLeft";

      if (isPrevDesktop || isPrevWeb) {
        e.preventDefault();

        const store = useAgentSubChatStore.getState();
        const activeId = store.activeSubChatId;
        const openIds = store.openSubChatIds;

        // Only navigate if we have multiple tabs
        if (openIds.length <= 1) return;

        // If no active tab, select first one
        if (!activeId) {
          store.setActiveSubChat(openIds[0]);
          return;
        }

        // Find current index
        const currentIndex = openIds.indexOf(activeId);

        if (currentIndex === -1) {
          // Current tab not found, select first
          store.setActiveSubChat(openIds[0]);
          return;
        }

        // Navigate to previous tab (cycle to end if at start)
        const nextIndex =
          currentIndex - 1 < 0 ? openIds.length - 1 : currentIndex - 1;
        const nextId = openIds[nextIndex];

        if (nextId) {
          store.setActiveSubChat(nextId);
        }
      }

      // Check for next sub-chat shortcut (] key)
      const isNextDesktop =
        isDesktop &&
        e.metaKey &&
        e.code === "BracketRight" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey;
      const isNextWeb = e.altKey && e.metaKey && e.code === "BracketRight";

      if (isNextDesktop || isNextWeb) {
        e.preventDefault();

        const store = useAgentSubChatStore.getState();
        const activeId = store.activeSubChatId;
        const openIds = store.openSubChatIds;

        // Only navigate if we have multiple tabs
        if (openIds.length <= 1) return;

        // If no active tab, select first one
        if (!activeId) {
          store.setActiveSubChat(openIds[0]);
          return;
        }

        // Find current index
        const currentIndex = openIds.indexOf(activeId);

        if (currentIndex === -1) {
          // Current tab not found, select first
          store.setActiveSubChat(openIds[0]);
          return;
        }

        // Navigate to next tab (cycle to start if at end)
        const nextIndex = (currentIndex + 1) % openIds.length;
        const nextId = openIds[nextIndex];

        if (nextId) {
          store.setActiveSubChat(nextId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
