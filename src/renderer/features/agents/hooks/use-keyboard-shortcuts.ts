"use client";

import type { Chat } from "@ai-sdk/react";
import { useEffect } from "react";
import { isDesktopApp } from "../../../lib/utils/platform";
import { agentChatStore } from "../stores/agent-chat-store";

export interface UseKeyboardShortcutsOptions {
  // Cmd+/ - Open model selector
  shouldOpenModelSelector: boolean;
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
 * Hook to manage all keyboard shortcuts in the chat interface.
 * Consolidates 5 separate useEffect hooks into one hook with multiple listeners.
 *
 * Shortcuts managed:
 * - Cmd+/ - Open model selector (Claude submenu)
 * - ESC/Ctrl+C/Cmd+Shift+Backspace - Stop streaming
 * - Cmd+D - Toggle diff sidebar
 * - Cmd+Shift+P (Desktop) / Opt+Cmd+Shift+P (Web) - Create PR
 * - Cmd+Shift+E - Restore archived workspace
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

  // Cmd+/ - Open model selector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        e.stopPropagation();
        onOpenModelSelector(true, true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onOpenModelSelector]);

  // ESC, Ctrl+C and Cmd+Shift+Backspace - Stop stream
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      let shouldStop = false;

      // Check for Escape key without modifiers (works even from input fields, like terminal Ctrl+C)
      // Ignore if Cmd/Ctrl is pressed (reserved for Cmd+Esc to focus input)
      if (
        e.key === "Escape" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        isStreaming
      ) {
        const target = e.target as HTMLElement;

        // Allow ESC to propagate if it originated from a modal/dialog/dropdown
        const isInsideOverlay = target.closest(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-state="open"]',
        );

        if (!isInsideOverlay) {
          shouldStop = true;
        }
      }

      // Check for Ctrl+C (only Ctrl, not Cmd on Mac)
      if (e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        if (!isStreaming) return;

        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().length > 0;

        // If there's a text selection, let browser handle copy
        if (hasSelection) return;

        shouldStop = true;
      }

      // Check for Cmd+Shift+Backspace (Mac) or Ctrl+Shift+Backspace (Windows/Linux)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key === "Backspace" &&
        isStreaming
      ) {
        shouldStop = true;
      }

      if (shouldStop) {
        e.preventDefault();
        // Mark as manually aborted to prevent completion sound
        agentChatStore.setManuallyAborted(subChatId, true);
        await stop();
        // Call DELETE endpoint to cancel server-side stream
        await fetch(`/api/agents/chat?id=${encodeURIComponent(subChatId)}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming, stop, subChatId]);

  // Cmd+D - Toggle diff sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Meta) + D (without Alt/Shift)
      if (
        e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        e.code === "KeyD"
      ) {
        e.preventDefault();
        e.stopPropagation();

        // Toggle: close if open, open if has changes
        if (isDiffSidebarOpen) {
          onToggleDiffSidebar(false);
        } else if (hasDiffChanges) {
          onToggleDiffSidebar(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hasDiffChanges, isDiffSidebarOpen, onToggleDiffSidebar]);

  // Cmd+Shift+P (Desktop) / Opt+Cmd+Shift+P (Web) - Create PR
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp();

      // Desktop: Cmd+Shift+P (without Alt)
      const isDesktopShortcut =
        isDesktop &&
        e.metaKey &&
        e.shiftKey &&
        e.code === "KeyP" &&
        !e.altKey &&
        !e.ctrlKey;
      // Web: Opt+Cmd+Shift+P (with Alt and Shift)
      const isWebShortcut =
        e.altKey && e.metaKey && e.shiftKey && e.code === "KeyP";

      if (isDesktopShortcut || isWebShortcut) {
        e.preventDefault();
        e.stopPropagation();

        // Only create PR if there are changes and not already creating
        if (hasDiffChanges && !isCreatingPr) {
          onCreatePr();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hasDiffChanges, isCreatingPr, onCreatePr]);

  // Cmd+Shift+E - Restore archived workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey &&
        e.shiftKey &&
        !e.altKey &&
        !e.ctrlKey &&
        e.code === "KeyE"
      ) {
        if (isArchived && !isRestoring) {
          e.preventDefault();
          e.stopPropagation();
          onRestoreWorkspace();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isArchived, isRestoring, onRestoreWorkspace]);
}
