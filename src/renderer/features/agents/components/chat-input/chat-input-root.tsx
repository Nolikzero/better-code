"use client";

import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  PromptInput,
  PromptInputContextItems,
} from "../../../../components/ui/prompt-input";
import { cn } from "../../../../lib/utils";
import type { AgentsMentionsEditorHandle } from "../../mentions";
import { ChatInputContext } from "./chat-input-context";

export interface ChatInputRootProps {
  children: ReactNode;
  className?: string;
  maxHeight?: number;
  onSubmit: () => void;

  // Attachments (for contextItems rendering)
  contextItems?: ReactNode;

  // Drag/drop
  onAddAttachments: (files: File[]) => void;
  filterDroppedFiles?: (files: File[]) => File[];

  // Refs
  editorRef: RefObject<AgentsMentionsEditorHandle | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;

  // State
  hasContent: boolean;
  isStreaming?: boolean;
  isSubmitting?: boolean;
  isUploading?: boolean;
  isOverlayMode?: boolean;
  disabled?: boolean;

  // Callbacks
  onFocusChange?: (focused: boolean) => void;
}

export function ChatInputRoot({
  children,
  className,
  maxHeight = 200,
  onSubmit,
  contextItems,
  onAddAttachments,
  filterDroppedFiles,
  editorRef,
  fileInputRef,
  hasContent,
  isStreaming = false,
  isSubmitting = false,
  isUploading = false,
  isOverlayMode = false,
  disabled = false,
  onFocusChange,
}: ChatInputRootProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    onFocusChange?.(isFocused);
  }, [isFocused, onFocusChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      // Check for file mention data (dragged from project tree)
      // Try custom MIME type first, then text/plain with prefix for Electron compatibility
      let mentionData = e.dataTransfer.getData("application/x-file-mention");
      if (!mentionData) {
        const textData = e.dataTransfer.getData("text/plain");
        if (textData?.startsWith("__FILE_MENTION__")) {
          mentionData = textData.slice("__FILE_MENTION__".length);
        }
      }

      if (mentionData) {
        try {
          const mention = JSON.parse(mentionData);
          editorRef.current?.appendMention(mention);
          // Focus after adding mention
          requestAnimationFrame(() => {
            editorRef.current?.focus();
          });
          return;
        } catch {
          // If parsing fails, fall through to file handling
        }
      }

      // Handle dropped files
      let droppedFiles = Array.from(e.dataTransfer.files);
      if (filterDroppedFiles) {
        droppedFiles = filterDroppedFiles(droppedFiles);
      }
      onAddAttachments(droppedFiles);
      // Focus after state update - use double rAF to wait for React render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          editorRef.current?.focus();
        });
      });
    },
    [onAddAttachments, editorRef, filterDroppedFiles],
  );

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (
        e.target === e.currentTarget ||
        !(e.target as HTMLElement).closest("button, [contenteditable]")
      ) {
        editorRef.current?.focus();
      }
    },
    [editorRef],
  );

  const contextValue = {
    isDragOver,
    isFocused,
    setIsFocused,
    isStreaming,
    isSubmitting,
    isUploading,
    disabled,
    editorRef,
    fileInputRef,
    hasContent,
    maxHeight,
  };

  return (
    <ChatInputContext.Provider value={contextValue}>
      <div
        className="relative w-full"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="relative w-full cursor-text"
          onClick={handleContainerClick}
        >
          <PromptInput
            className={cn(
              "border border-foreground/10 relative z-10 p-2 rounded-xs transition-[border-color] duration-150",
              isDragOver && "border-dashed border-primary/50",
              isFocused && !isDragOver && "border-dashed border-foreground/30",
              isOverlayMode && "bg-background/50 focus-within:bg-background",
              className,
            )}
            maxHeight={maxHeight}
            onSubmit={onSubmit}
            contextItems={contextItems}
          >
            <PromptInputContextItems />
            {children}
          </PromptInput>
        </div>
      </div>
    </ChatInputContext.Provider>
  );
}
