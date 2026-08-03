import type { KeybindingDefinition } from "./types";

export const DEFAULT_KEYBINDINGS: KeybindingDefinition[] = [
  // ===== GENERAL =====
  {
    id: "general.show-shortcuts",
    label: "显示快捷键",
    category: "general",
    defaultBinding: {
      mac: { key: "?", shift: true },
    },
    contexts: ["global"],
    allowInInput: false,
  },
  {
    id: "general.settings",
    label: "设置",
    category: "general",
    defaultBinding: {
      mac: { key: ",", meta: true },
      windows: { key: ",", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "general.toggle-sidebar",
    label: "切换侧栏",
    category: "general",
    defaultBinding: {
      mac: { key: "\\", meta: true },
      windows: { key: "\\", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "general.toggle-chats-sidebar",
    label: "切换对话侧栏",
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
    label: "新建工作区",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "n", meta: true },
      windows: { key: "n", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "workspaces.search",
    label: "搜索工作区",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "f", meta: true },
      windows: { key: "f", ctrl: true },
    },
    contexts: ["global"],
  },
  {
    id: "workspaces.archive",
    label: "归档工作区",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "e", meta: true },
      windows: { key: "e", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "workspaces.undo-archive",
    label: "撤销归档",
    category: "workspaces",
    defaultBinding: {
      mac: { key: "z", meta: true },
      windows: { key: "z", ctrl: true },
    },
    contexts: ["archived"],
  },
  {
    id: "workspaces.quick-open",
    label: "转到文件",
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
    label: "新建智能体标签页",
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
    label: "关闭智能体标签页",
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
    label: "上一个智能体",
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
    label: "下一个智能体",
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
    label: "停止生成",
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
    label: "切换模型",
    category: "agents",
    defaultBinding: {
      mac: { key: "/", meta: true },
      windows: { key: "/", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.toggle-diff",
    label: "切换差异侧栏",
    category: "agents",
    defaultBinding: {
      mac: { key: "d", meta: true },
      windows: { key: "d", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.toggle-terminal",
    label: "切换终端",
    category: "agents",
    defaultBinding: {
      mac: { key: "j", meta: true },
      windows: { key: "j", ctrl: true },
    },
    contexts: ["chat-active"],
  },
  {
    id: "agents.create-pr",
    label: "创建 PR",
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
    label: "恢复已归档工作区",
    category: "agents",
    defaultBinding: {
      mac: { key: "e", meta: true, shift: true },
      windows: { key: "e", ctrl: true, shift: true },
    },
    contexts: ["archived"],
  },
  {
    id: "agents.focus-input",
    label: "聚焦输入框",
    category: "agents",
    defaultBinding: {
      mac: { key: "Enter" },
    },
    contexts: ["no-input-focus"],
    allowInInput: false,
  },
  {
    id: "agents.toggle-focus",
    label: "切换焦点模式",
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
    label: "批准规划",
    category: "agents",
    defaultBinding: {
      mac: { key: "Enter", meta: true },
      windows: { key: "Enter", ctrl: true },
    },
    contexts: ["plan-pending"],
  },
];
