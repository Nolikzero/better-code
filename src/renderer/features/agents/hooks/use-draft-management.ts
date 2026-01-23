"use client";

import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { chatInputHeightAtom } from "../atoms";
import { getSubChatDraft, saveSubChatDraft } from "../lib/drafts";
import type { AgentsMentionsEditorHandle } from "../mentions";

export interface UseDraftManagementOptions {
  subChatId: string;
  parentChatId: string;
  editorRef: React.RefObject<AgentsMentionsEditorHandle | null>;
  inputContainerRef: React.RefObject<HTMLDivElement | null>;
  currentDraftTextRef: React.MutableRefObject<string>;
  currentChatIdRef: React.MutableRefObject<string | null>;
  currentSubChatIdRef: React.MutableRefObject<string | null>;
}

/**
 * Hook to manage draft persistence and input height tracking:
 * - Tracks input container height for overlay positioning (ResizeObserver)
 * - Saves draft on component unmount (workspace switches)
 * - Saves/restores drafts when switching between sub-chats
 * - Manages draft refs to handle race conditions
 */
export function useDraftManagement(options: UseDraftManagementOptions) {
  const {
    subChatId,
    parentChatId,
    editorRef,
    inputContainerRef,
    currentDraftTextRef,
    currentChatIdRef,
    currentSubChatIdRef,
  } = options;

  const setInputHeight = useSetAtom(chatInputHeightAtom);

  // Track input height for overlay positioning (when File/Changes tabs overlay the chat)
  useEffect(() => {
    if (!inputContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 120;
      setInputHeight(height);
    });
    observer.observe(inputContainerRef.current);
    return () => observer.disconnect();
  }, [inputContainerRef, setInputHeight]);

  // Save draft on unmount (when switching workspaces)
  // Read directly from editor first (handles hotkey switch where blur didn't fire),
  // fall back to ref if editor is already gone
  useEffect(() => {
    return () => {
      const editorValue = editorRef.current?.getValue();
      const refValue = currentDraftTextRef.current;
      const draft = editorValue || refValue;
      const chatId = currentChatIdRef.current;
      const subChatIdValue = currentSubChatIdRef.current;

      if (!chatId || !subChatIdValue || !draft?.trim()) return;

      saveSubChatDraft(chatId, subChatIdValue, draft);
    };
  }, [editorRef, currentDraftTextRef, currentChatIdRef, currentSubChatIdRef]);

  // Restore draft when subChatId changes (switching between sub-chats)
  const prevSubChatIdForDraftRef = useRef<string | null>(null);
  useEffect(() => {
    // Save draft from previous sub-chat before switching (within same workspace)
    if (
      prevSubChatIdForDraftRef.current &&
      prevSubChatIdForDraftRef.current !== subChatId
    ) {
      const prevChatId = currentChatIdRef.current;
      const prevSubChatId = prevSubChatIdForDraftRef.current;
      const prevDraft = editorRef.current?.getValue() || "";

      if (prevDraft.trim() && prevChatId) {
        saveSubChatDraft(prevChatId, prevSubChatId, prevDraft);
      }
    }

    // Restore draft for new sub-chat - read directly from localStorage
    const savedDraft = parentChatId
      ? getSubChatDraft(parentChatId, subChatId)
      : null;

    if (savedDraft) {
      editorRef.current?.setValue(savedDraft);
      currentDraftTextRef.current = savedDraft;
    } else if (
      prevSubChatIdForDraftRef.current &&
      prevSubChatIdForDraftRef.current !== subChatId
    ) {
      editorRef.current?.clear();
      currentDraftTextRef.current = "";
    }

    prevSubChatIdForDraftRef.current = subChatId;
  }, [
    subChatId,
    parentChatId,
    editorRef,
    currentDraftTextRef,
    currentChatIdRef,
  ]);
}
