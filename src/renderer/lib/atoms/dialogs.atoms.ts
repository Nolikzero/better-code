import { atom } from "jotai";

// ============================================
// SETTINGS DIALOG
// ============================================

export type SettingsTab =
  | "profile"
  | "appearance"
  | "preferences"
  | "provider"
  | "skills"
  | "agents"
  | "mcp"
  | "debug";

export const agentsSettingsDialogActiveTabAtom = atom<SettingsTab>("profile");
export const agentsSettingsDialogOpenAtom = atom<boolean>(false);

// ============================================
// OTHER DIALOGS
// ============================================

// Shortcuts dialog
export const agentsShortcutsDialogOpenAtom = atom<boolean>(false);

// Login modal (shown when Claude Code auth fails)
export const agentsLoginModalOpenAtom = atom<boolean>(false);

// Help popover
export const agentsHelpPopoverOpenAtom = atom<boolean>(false);

// ============================================
// QUICK SWITCH DIALOGS
// ============================================

// Quick switch dialog - Agents
export const agentsQuickSwitchOpenAtom = atom<boolean>(false);
export const agentsQuickSwitchSelectedIndexAtom = atom<number>(0);

// Quick switch dialog - Sub-chats
export const subChatsQuickSwitchOpenAtom = atom<boolean>(false);
export const subChatsQuickSwitchSelectedIndexAtom = atom<number>(0);

// ============================================
// QUICK OPEN (FILE SEARCH)
// ============================================

// Quick open dialog - file search with Cmd+P
export const quickOpenDialogOpenAtom = atom<boolean>(false);
