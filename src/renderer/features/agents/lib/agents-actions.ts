/**
 * Centralized action system for Agents
 * Actions can be triggered via hotkeys or UI buttons
 */

import type { SettingsTab } from "../../../lib/atoms";

// ============================================================================
// TYPES
// ============================================================================

export type AgentActionSource = "hotkey" | "ui_button" | "context-menu";

type AgentActionCategory = "general" | "navigation" | "chat" | "view";

export interface AgentActionContext {
  // Navigation
  setSelectedChatId?: (id: string | null) => void;

  // UI states
  setSidebarOpen?: (open: boolean | ((prev: boolean) => boolean)) => void;
  setChatsSidebarOpen?: (open: boolean | ((prev: boolean) => boolean)) => void;
  setSettingsDialogOpen?: (open: boolean) => void;
  setSettingsActiveTab?: (tab: SettingsTab) => void;
  setShortcutsDialogOpen?: (open: boolean) => void;

  // Data
  selectedChatId?: string | null;
}

export interface AgentActionResult {
  success: boolean;
  error?: string;
}

type AgentActionHandler = (
  context: AgentActionContext,
  source: AgentActionSource,
) => Promise<AgentActionResult> | AgentActionResult;

export interface AgentActionDefinition {
  id: string;
  label: string;
  description?: string;
  category: AgentActionCategory;
  handler: AgentActionHandler;
  isAvailable?: (context: AgentActionContext) => boolean;
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

const openShortcutsAction: AgentActionDefinition = {
  id: "open-shortcuts",
  label: "键盘快捷键",
  description: "显示所有键盘快捷键",
  category: "general",
  handler: async (context) => {
    context.setShortcutsDialogOpen?.(true);
    return { success: true };
  },
};

const createNewAgentAction: AgentActionDefinition = {
  id: "create-new-agent",
  label: "新建工作区",
  description: "创建新工作区",
  category: "general",
  handler: async (context) => {
    if (context.setSelectedChatId) {
      context.setSelectedChatId(null);
    }
    return { success: true };
  },
};

const openSettingsAction: AgentActionDefinition = {
  id: "open-settings",
  label: "设置",
  description: "打开设置对话框",
  category: "general",
  handler: async (context) => {
    context.setSettingsActiveTab?.("provider");
    context.setSettingsDialogOpen?.(true);
    return { success: true };
  },
};

const toggleSidebarAction: AgentActionDefinition = {
  id: "toggle-sidebar",
  label: "切换侧栏",
  description: "显示或隐藏左侧边栏",
  category: "view",
  handler: async (context) => {
    context.setSidebarOpen?.((prev) => !prev);
    return { success: true };
  },
};

const toggleChatsSidebarAction: AgentActionDefinition = {
  id: "toggle-chats-sidebar",
  label: "切换对话侧栏",
  description: "显示或隐藏右侧对话边栏",
  category: "view",
  handler: async (context) => {
    context.setChatsSidebarOpen?.((prev) => !prev);
    return { success: true };
  },
};

// ============================================================================
// ACTION REGISTRY
// ============================================================================

export const AGENT_ACTIONS: Record<string, AgentActionDefinition> = {
  "open-shortcuts": openShortcutsAction,
  "create-new-agent": createNewAgentAction,
  "open-settings": openSettingsAction,
  "toggle-sidebar": toggleSidebarAction,
  "toggle-chats-sidebar": toggleChatsSidebarAction,
};

export async function executeAgentAction(
  actionId: string,
  context: AgentActionContext,
  source: AgentActionSource,
): Promise<AgentActionResult> {
  const action = AGENT_ACTIONS[actionId];

  if (!action) {
    return { success: false, error: `Action ${actionId} not found` };
  }

  if (action.isAvailable && !action.isAvailable(context)) {
    return { success: false, error: `Action ${actionId} not available` };
  }

  try {
    return await action.handler(context, source);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}
