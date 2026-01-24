/**
 * Hotkeys manager for Agents
 * Centralized keyboard shortcut handling using the keybindings registry
 */

import { useAtomValue } from "jotai";
import * as React from "react";
import { useCallback, useMemo } from "react";
import type { SettingsTab } from "../../../lib/atoms";
import { resolvedKeybindingsAtom } from "../../../lib/keybindings";
import { matchesBinding } from "../../../lib/keybindings/matcher";
import { type AgentActionContext, executeAgentAction } from "./agents-actions";

// ============================================================================
// TYPES
// ============================================================================

export interface AgentsHotkeysManagerConfig {
  setSelectedChatId?: (id: string | null) => void;
  setSidebarOpen?: (open: boolean | ((prev: boolean) => boolean)) => void;
  setChatsSidebarOpen?: (open: boolean | ((prev: boolean) => boolean)) => void;
  setSettingsDialogOpen?: (open: boolean) => void;
  setSettingsActiveTab?: (tab: SettingsTab) => void;
  setShortcutsDialogOpen?: (open: boolean) => void;
  setQuickOpenDialogOpen?: (open: boolean) => void;
  selectedChatId?: string | null;
}

export interface UseAgentsHotkeysOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

// Mapping from keybinding ID to action ID
const BINDING_TO_ACTION: Record<string, string> = {
  "general.show-shortcuts": "open-shortcuts",
  "general.settings": "open-settings",
  "general.toggle-sidebar": "toggle-sidebar",
  "general.toggle-chats-sidebar": "toggle-chats-sidebar",
  "workspaces.new": "create-new-agent",
};

// ============================================================================
// HOTKEYS MANAGER HOOK
// ============================================================================

export function useAgentsHotkeys(
  config: AgentsHotkeysManagerConfig,
  options: UseAgentsHotkeysOptions = {},
) {
  const { enabled = true } = options;
  const resolvedKeybindings = useAtomValue(resolvedKeybindingsAtom);

  const createActionContext = useCallback(
    (): AgentActionContext => ({
      setSelectedChatId: config.setSelectedChatId,
      setSidebarOpen: config.setSidebarOpen,
      setChatsSidebarOpen: config.setChatsSidebarOpen,
      setSettingsDialogOpen: config.setSettingsDialogOpen,
      setSettingsActiveTab: config.setSettingsActiveTab,
      setShortcutsDialogOpen: config.setShortcutsDialogOpen,
      selectedChatId: config.selectedChatId,
    }),
    [
      config.setSelectedChatId,
      config.setSidebarOpen,
      config.setChatsSidebarOpen,
      config.setSettingsDialogOpen,
      config.setSettingsActiveTab,
      config.setShortcutsDialogOpen,
      config.selectedChatId,
    ],
  );

  const handleHotkeyAction = useCallback(
    async (actionId: string) => {
      const context = createActionContext();
      await executeAgentAction(actionId, context, "hotkey");
    },
    [createActionContext],
  );

  // Listen for Cmd+N via IPC from main process (menu accelerator)
  React.useEffect(() => {
    if (!enabled) return;
    if (!window.desktopApi?.onShortcutNewAgent) return;

    const cleanup = window.desktopApi.onShortcutNewAgent(() => {
      handleHotkeyAction("create-new-agent");
    });

    return cleanup;
  }, [enabled, handleHotkeyAction]);

  // Bindings that map to actions
  const actionBindings = useMemo(() => {
    return Object.entries(BINDING_TO_ACTION)
      .map(([bindingId, actionId]) => {
        const binding = resolvedKeybindings.find((b) => b.id === bindingId);
        return binding ? { binding, actionId } : null;
      })
      .filter(Boolean) as Array<{
      binding: (typeof resolvedKeybindings)[number];
      actionId: string;
    }>;
  }, [resolvedKeybindings]);

  // Quick open binding
  const quickOpenBinding = useMemo(
    () => resolvedKeybindings.find((b) => b.id === "workspaces.quick-open"),
    [resolvedKeybindings],
  );

  // Unified keydown handler for all action-based hotkeys
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        !!target.closest('[contenteditable="true"]');

      // Quick open (Cmd+P)
      if (quickOpenBinding && config.setQuickOpenDialogOpen) {
        if (matchesBinding(e, quickOpenBinding.binding)) {
          e.preventDefault();
          e.stopPropagation();
          config.setQuickOpenDialogOpen(true);
          return;
        }
      }

      // Action-based hotkeys
      for (const { binding, actionId } of actionBindings) {
        if (isInInput && !binding.allowInInput) continue;

        if (matchesBinding(e, binding.binding)) {
          e.preventDefault();
          e.stopPropagation();
          handleHotkeyAction(actionId);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    enabled,
    actionBindings,
    quickOpenBinding,
    handleHotkeyAction,
    config.setQuickOpenDialogOpen,
  ]);

  return {
    executeAction: handleHotkeyAction,
    createActionContext,
  };
}
