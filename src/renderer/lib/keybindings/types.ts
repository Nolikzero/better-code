export type KeybindingCategory = "general" | "workspaces" | "agents";

export type KeybindingContext =
  | "global"
  | "chat-active"
  | "streaming"
  | "plan-pending"
  | "diff-available"
  | "archived"
  | "no-input-focus";

export interface KeyCombo {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export interface PlatformKeybinding {
  mac?: KeyCombo | KeyCombo[];
  windows?: KeyCombo | KeyCombo[];
  desktop?: KeyCombo | KeyCombo[];
  web?: KeyCombo | KeyCombo[];
}

export interface KeybindingDefinition {
  id: string;
  label: string;
  description?: string;
  category: KeybindingCategory;
  defaultBinding: PlatformKeybinding;
  contexts: KeybindingContext[];
  allowInInput?: boolean;
}

export interface ResolvedKeybinding extends KeybindingDefinition {
  binding: PlatformKeybinding;
  isCustomized: boolean;
}

export type KeybindingOverrides = Record<string, PlatformKeybinding>;
