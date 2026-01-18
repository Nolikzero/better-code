"use client";

import { type RefObject, createContext, useContext } from "react";
import type { AgentsMentionsEditorHandle } from "../../mentions";

export interface ImageAttachment {
  id: string;
  filename: string;
  url: string;
  isLoading?: boolean;
}

export interface FileAttachment {
  id: string;
  filename: string;
  url: string;
  size?: number;
  isLoading?: boolean;
}

interface ChatInputContextValue {
  // State
  isDragOver: boolean;
  isFocused: boolean;
  setIsFocused: (value: boolean) => void;
  isStreaming: boolean;
  isSubmitting: boolean;
  isUploading: boolean;
  disabled: boolean;

  // Refs
  editorRef: RefObject<AgentsMentionsEditorHandle | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;

  // Flags
  hasContent: boolean;
  maxHeight: number;
}

const ChatInputContext = createContext<ChatInputContextValue | null>(null);

export function useChatInputContext() {
  const context = useContext(ChatInputContext);
  if (!context) {
    throw new Error(
      "useChatInputContext must be used within a ChatInputProvider",
    );
  }
  return context;
}

export { ChatInputContext };
