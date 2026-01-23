"use client";

import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { resolvedKeybindingsAtom } from "../../../lib/keybindings";
import { matchesBinding } from "../../../lib/keybindings/matcher";
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
 * - New sub-chat
 * - Close sub-chat (single or bulk)
 * - Navigate between sub-chats
 *
 * Reads key combos from the centralized keybindings registry.
 */
export function useSubChatKeyboard({
  onCreateNew,
  addToUndoStack,
  isMultiSelectMode,
  selectedIds,
  clearSelection,
}: UseSubChatKeyboardOptions): void {
  const resolved = useAtomValue(resolvedKeybindingsAtom);

  const bindings = useMemo(() => {
    const map = new Map(resolved.map((b) => [b.id, b]));
    return {
      newTab: map.get("agents.new-tab"),
      closeTab: map.get("agents.close-tab"),
      prevTab: map.get("agents.prev-tab"),
      nextTab: map.get("agents.next-tab"),
    };
  }, [resolved]);

  // New sub-chat
  useEffect(() => {
    if (!bindings.newTab) return;
    const binding = bindings.newTab;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesBinding(e, binding.binding)) {
        e.preventDefault();
        onCreateNew();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCreateNew, bindings.newTab]);

  // Close active sub-chat (or bulk close if multi-select mode)
  useEffect(() => {
    if (!bindings.closeTab) return;
    const binding = bindings.closeTab;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesBinding(e, binding.binding)) {
        e.preventDefault();

        const store = useAgentSubChatStore.getState();

        // If multi-select mode, bulk close selected sub-chats
        if (isMultiSelectMode && selectedIds.size > 0) {
          const idsToClose = Array.from(selectedIds);
          const remainingOpenIds = store.openSubChatIds.filter(
            (id) => !idsToClose.includes(id),
          );

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

        if (activeId && openIds.length > 1) {
          store.removeFromOpenSubChats(activeId);
          addToUndoStack(activeId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isMultiSelectMode,
    selectedIds,
    clearSelection,
    addToUndoStack,
    bindings.closeTab,
  ]);

  // Navigate between sub-chats (prev/next)
  useEffect(() => {
    if (!bindings.prevTab && !bindings.nextTab) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isPrev =
        bindings.prevTab && matchesBinding(e, bindings.prevTab.binding);
      const isNext =
        bindings.nextTab && matchesBinding(e, bindings.nextTab.binding);

      if (!isPrev && !isNext) return;
      e.preventDefault();

      const store = useAgentSubChatStore.getState();
      const activeId = store.activeSubChatId;
      const openIds = store.openSubChatIds;

      if (openIds.length <= 1) return;

      if (!activeId) {
        store.setActiveSubChat(openIds[0]);
        return;
      }

      const currentIndex = openIds.indexOf(activeId);
      if (currentIndex === -1) {
        store.setActiveSubChat(openIds[0]);
        return;
      }

      let nextIndex: number;
      if (isPrev) {
        nextIndex =
          currentIndex - 1 < 0 ? openIds.length - 1 : currentIndex - 1;
      } else {
        nextIndex = (currentIndex + 1) % openIds.length;
      }

      const nextId = openIds[nextIndex];
      if (nextId) {
        store.setActiveSubChat(nextId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bindings.prevTab, bindings.nextTab]);
}
