import type { KeybindingDefinition } from "./types";

export const DEFAULT_KEYBINDINGS: KeybindingDefinition[] = [
  // ===== GENERAL =====
  {
    id: "general.show-shortcuts",
    label: "Show shortcuts",
    category: "general",
    defaultBinding: {
      mac: { key: "?", shift: true },
    },
    contexts: ["global"],
    allowInInput: false,
  },
  {
    id: "general.settings",
    label: "Settings",
    category: "general",
    defaultBinding: {
      mac: { key: ",", meta: true },
      windows: { key: ",", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "general.toggle-sidebar",
    label: "Toggle sidebar",
    category: "general",
    defaultBinding: {
      mac: { key: "\\", meta: true },
      windows: { key: "\\", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "general.toggle-chats-sidebar",
    label: "Toggle chats sidebar",
    category: "general",
    defaultBinding: {
      mac: { key: "\\", meta: true, shift: true },
      windows: { key: "\\", ctrl: true, shift: true },
    },
    contexts: ["global"],
  },

  // ===== WORKSPACES =====
  {
    id: "workspaces.new",
    label: "New workspace",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "n", meta: true },
      windows: { key: "n", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "workspaces.search",
    label: "Search workspaces",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "f", meta: true },
      windows: { key: "f", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "workspaces.archive",
    label: "Archive workspace",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "e", meta: true },
      windows: { key: "e", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "workspaces.undo-archive",
    label: "Undo archive",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "z", meta: true },
      windows: { key: "z", ctrl: true },
    },
    contexts: ["archived"],
  },
  {
    id: "workspaces.quick-open",
    label: "Go to file",
    category: "workspaces",
    defaultBinding: {
      desktop: { key: "p", meta: true },
      web: { key: "p", meta: true, alt: true },
      windows: { key: "p", ctrl: true },
    },
    contexts: ["chat-active"],
  },

  // ===== AGENTS =====
  {
    id: "agents.new-tab",
    label: "New agent tab",
    category: "agents",
    defaultBinding: {
      desktop: { key: "t", meta: true },
      web: { key: "t", meta: true, alt: true },
      windows: { key: "t", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.close-tab",
    label: "Close agent tab",
    category: "agents",
    defaultBinding: {
      desktop: { key: "w", meta: true },
      web: { key: "w", meta: true, alt: true },
      windows: { key: "w", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.prev-tab",
    label: "Previous agent",
    category: "agents",
    defaultBinding: {
      desktop: { key: "[", meta: true },
      web: { key: "[", meta: true, alt: true },
      windows: { key: "[", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.next-tab",
    label: "Next agent",
    category: "agents",
    defaultBinding: {
      desktop: { key: "]", meta: true },
      web: { key: "]", meta: true, alt: true },
      windows: { key: "]", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.stop-generation",
    label: "Stop generation",
    category: "agents",
    defaultBinding: {
      mac: [
        { key: "Escape" },
        { key: "c", ctrl: true },
        { key: "Backspace", meta: true, shift: true },
      ],
      windows: [
        { key: "Escape" },
        { key: "c", ctrl: true },
        { key: "Backspace", ctrl: true, shift: true },
      ],
    },
    contexts: ["streaming"],
    allowInInput: true,
  },
  {
    id: "agents.switch-model",
    label: "Switch model",
    category: "agents",
    defaultBinding: {
      mac: { key: "/", meta: true },
      windows: { key: "/", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.toggle-diff",
    label: "Toggle diff sidebar",
    category: "agents",
    defaultBinding: {
      mac: { key: "d", meta: true },
      windows: { key: "d", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.toggle-terminal",
    label: "Toggle terminal",
    category: "agents",
    defaultBinding: {
      mac: { key: "j", meta: true },
      windows: { key: "j", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.create-pr",
    label: "Create PR",
    category: "agents",
    defaultBinding: {
      desktop: { key: "p", meta: true, shift: true },
      web: { key: "p", meta: true, alt: true, shift: true },
      windows: { key: "p", ctrl: true, shift: true },
    },
    contexts: ["diff-available"],
  },
  {
    id: "agents.restore-workspace",
    label: "Restore archived workspace",
    category: "agents",
    defaultBinding: {
      mac: { key: "e", meta: true, shift: true },
      windows: { key: "e", ctrl: true, shift: true },
    },
    contexts: ["archived"],
  },
  {
    id: "agents.focus-input",
    label: "Focus input",
    category: "agents",
    defaultBinding: {
      mac: { key: "Enter" },
    },
    contexts: ["no-input-focus"],
    allowInInput: false,
  },
  {
    id: "agents.toggle-focus",
    label: "Toggle focus",
    category: "agents",
    defaultBinding: {
      mac: { key: "Escape", meta: true },
      windows: { key: "Escape", ctrl: true },
    },
    contexts: ["global"],
    allowInInput: true,
  },
  {
    id: "agents.approve-plan",
    label: "Approve plan",
    category: "agents",
    defaultBinding: {
      mac: { key: "Enter", meta: true },
      windows: { key: "Enter", ctrl: true },
    },
    contexts: ["plan-pending"],
  },
];
