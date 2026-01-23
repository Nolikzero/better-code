"use client";

import type { Chat } from "@ai-sdk/react";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { resolvedKeybindingsAtom } from "../../../lib/keybindings";
import { matchesBinding } from "../../../lib/keybindings/matcher";
import { agentChatStore } from "../stores/agent-chat-store";

export interface UseKeyboardShortcutsOptions {
  // Cmd+/ - Open model selector
  onOpenModelSelector: (shouldOpen: boolean, isDropdownOpen: boolean) => void;

  // ESC/Ctrl+C/Cmd+Shift+Backspace - Stop stream
  isStreaming: boolean;
  subChatId: string;
  stop: Chat<any>["stop"];

  // Cmd+D - Toggle diff sidebar
  isDiffSidebarOpen: boolean;
  hasDiffChanges: boolean;
  onToggleDiffSidebar: (open: boolean) => void;

  // Cmd+Shift+P (desktop) / Opt+Cmd+Shift+P (web) - Create PR
  isCreatingPr: boolean;
  onCreatePr: () => void;

  // Cmd+Shift+E - Restore archived workspace
  isArchived: boolean;
  isRestoring: boolean;
  onRestoreWorkspace: () => void;
}

/**
 * Hook to manage keyboard shortcuts in the chat interface.
 * Reads key combos from the centralized keybindings registry.
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const {
    onOpenModelSelector,
    isStreaming,
    subChatId,
    stop,
    isDiffSidebarOpen,
    hasDiffChanges,
    onToggleDiffSidebar,
    isCreatingPr,
    onCreatePr,
    isArchived,
    isRestoring,
    onRestoreWorkspace,
  } = options;

  const resolved = useAtomValue(resolvedKeybindingsAtom);

  const bindings = useMemo(() => {
    const map = new Map(resolved.map((b) => [b.id, b]));
    return {
      switchModel: map.get("agents.switch-model"),
      stopGeneration: map.get("agents.stop-generation"),
      toggleDiff: map.get("agents.toggle-diff"),
      createPr: map.get("agents.create-pr"),
      restoreWorkspace: map.get("agents.restore-workspace"),
    };
  }, [resolved]);

  // Cmd+/ - Open model selector
  useEffect(() => {
    if (!bindings.switchModel) return;
    const binding = bindings.switchModel;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesBinding(e, binding.binding)) {
        e.preventDefault();
        e.stopPropagation();
        onOpenModelSelector(true, true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onOpenModelSelector, bindings.switchModel]);

  // ESC, Ctrl+C and Cmd+Shift+Backspace - Stop stream
  useEffect(() => {
    if (!bindings.stopGeneration) return;
    const binding = bindings.stopGeneration;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!isStreaming) return;

      let shouldStop = false;

      // Check if event matches any of the stop-generation combos
      if (matchesBinding(e, binding.binding)) {
        // Special handling for Escape: don't stop if inside overlay
        if (
          e.key === "Escape" &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          const target = e.target as HTMLElement;
          const isInsideOverlay = target.closest(
            '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-state="open"]',
          );
          if (isInsideOverlay) return;
          shouldStop = true;
        }
        // Special handling for Ctrl+C: don't stop if there's a text selection
        else if (e.ctrlKey && !e.metaKey && e.code === "KeyC") {
          const selection = window.getSelection();
          const hasSelection = selection && selection.toString().length > 0;
          if (hasSelection) return;
          shouldStop = true;
        } else {
          shouldStop = true;
        }
      }

      if (shouldStop) {
        e.preventDefault();
        agentChatStore.setManuallyAborted(subChatId, true);
        await stop();
        await fetch(`/api/agents/chat?id=${encodeURIComponent(subChatId)}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming, stop, subChatId, bindings.stopGeneration]);

  // Cmd+D - Toggle diff sidebar
  useEffect(() => {
    if (!bindings.toggleDiff) return;
    const binding = bindings.toggleDiff;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesBinding(e, binding.binding)) {
        e.preventDefault();
        e.stopPropagation();

        if (isDiffSidebarOpen) {
          onToggleDiffSidebar(false);
        } else if (hasDiffChanges) {
          onToggleDiffSidebar(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    hasDiffChanges,
    isDiffSidebarOpen,
    onToggleDiffSidebar,
    bindings.toggleDiff,
  ]);

  // Cmd+Shift+P (Desktop) / Opt+Cmd+Shift+P (Web) - Create PR
  useEffect(() => {
    if (!bindings.createPr) return;
    const binding = bindings.createPr;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesBinding(e, binding.binding)) {
        e.preventDefault();
        e.stopPropagation();

        if (hasDiffChanges && !isCreatingPr) {
          onCreatePr();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hasDiffChanges, isCreatingPr, onCreatePr, bindings.createPr]);

  // Cmd+Shift+E - Restore archived workspace
  useEffect(() => {
    if (!bindings.restoreWorkspace) return;
    const binding = bindings.restoreWorkspace;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesBinding(e, binding.binding)) {
        if (isArchived && !isRestoring) {
          e.preventDefault();
          e.stopPropagation();
          onRestoreWorkspace();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isArchived, isRestoring, onRestoreWorkspace, bindings.restoreWorkspace]);
}
