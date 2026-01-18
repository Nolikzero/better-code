import { atom } from "jotai";

// ============================================
// MULTI-SELECT ATOMS - Chats
// ============================================

export const selectedAgentChatIdsAtom = atom<Set<string>>(new Set<string>());

export const isAgentMultiSelectModeAtom = atom((get) => {
  return get(selectedAgentChatIdsAtom).size > 0;
});

export const selectedAgentChatsCountAtom = atom((get) => {
  return get(selectedAgentChatIdsAtom).size;
});

export const toggleAgentChatSelectionAtom = atom(
  null,
  (get, set, chatId: string) => {
    const currentSet = get(selectedAgentChatIdsAtom);
    const newSet = new Set(currentSet);
    if (newSet.has(chatId)) {
      newSet.delete(chatId);
    } else {
      newSet.add(chatId);
    }
    set(selectedAgentChatIdsAtom, newSet);
  },
);

export const selectAllAgentChatsAtom = atom(
  null,
  (_get, set, chatIds: string[]) => {
    set(selectedAgentChatIdsAtom, new Set(chatIds));
  },
);

export const clearAgentChatSelectionAtom = atom(null, (_get, set) => {
  set(selectedAgentChatIdsAtom, new Set());
});

// ============================================
// MULTI-SELECT ATOMS - Sub-Chats
// ============================================

export const selectedSubChatIdsAtom = atom<Set<string>>(new Set<string>());

export const isSubChatMultiSelectModeAtom = atom((get) => {
  return get(selectedSubChatIdsAtom).size > 0;
});

export const selectedSubChatsCountAtom = atom((get) => {
  return get(selectedSubChatIdsAtom).size;
});

export const toggleSubChatSelectionAtom = atom(
  null,
  (get, set, subChatId: string) => {
    const currentSet = get(selectedSubChatIdsAtom);
    const newSet = new Set(currentSet);
    if (newSet.has(subChatId)) {
      newSet.delete(subChatId);
    } else {
      newSet.add(subChatId);
    }
    set(selectedSubChatIdsAtom, newSet);
  },
);

export const selectAllSubChatsAtom = atom(
  null,
  (_get, set, subChatIds: string[]) => {
    set(selectedSubChatIdsAtom, new Set(subChatIds));
  },
);

export const clearSubChatSelectionAtom = atom(null, (_get, set) => {
  set(selectedSubChatIdsAtom, new Set());
});
