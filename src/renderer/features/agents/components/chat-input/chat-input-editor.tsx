"use client";

import { useCallback } from "react";
import { cn } from "../../../../lib/utils";
import { AgentsMentionsEditor } from "../../mentions";
import { useChatInputContext } from "./chat-input-context";

export interface ChatInputEditorProps {
  // Mention triggers
  onTrigger: (payload: { searchText: string; rect: DOMRect }) => void;
  onCloseTrigger: () => void;

  // Slash command triggers
  onSlashTrigger?: (payload: { searchText: string; rect: DOMRect }) => void;
  onCloseSlashTrigger?: () => void;

  // Content
  onContentChange: (hasContent: boolean) => void;
  onSubmit: () => void;

  // Mode switching
  onShiftTab?: () => void;

  // History navigation
  onArrowUp?: () => boolean;
  onArrowDown?: () => boolean;

  // Clipboard
  onPaste?: (e: React.ClipboardEvent) => void;

  // Focus (custom blur handler for active-chat draft saving)
  onBlur?: () => void;

  // Styling
  placeholder?: string;
  className?: string;
  isMobile?: boolean;
}

/**
 * Wraps AgentsMentionsEditor with context-aware focus handling.
 */
export function ChatInputEditor({
  onTrigger,
  onCloseTrigger,
  onSlashTrigger,
  onCloseSlashTrigger,
  onContentChange,
  onSubmit,
  onShiftTab,
  onArrowUp,
  onArrowDown,
  onPaste,
  onBlur,
  placeholder = "Plan, @ for context, / for commands",
  className,
  isMobile = false,
}: ChatInputEditorProps) {
  const { editorRef, setIsFocused, maxHeight, disabled } =
    useChatInputContext();

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, [setIsFocused]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [setIsFocused, onBlur]);

  return (
    <div className="relative">
      <AgentsMentionsEditor
        ref={editorRef}
        onTrigger={onTrigger}
        onCloseTrigger={onCloseTrigger}
        onSlashTrigger={onSlashTrigger}
        onCloseSlashTrigger={onCloseSlashTrigger}
        onContentChange={onContentChange}
        onSubmit={onSubmit}
        onShiftTab={onShiftTab}
        onArrowUp={onArrowUp}
        onArrowDown={onArrowDown}
        placeholder={placeholder}
        className={cn(
          "bg-transparent overflow-y-auto p-1",
          maxHeight === 200 && "max-h-[200px]",
          maxHeight === 240 && "max-h-[240px]",
          isMobile ? "min-h-[56px]" : "min-h-[44px]",
          className,
        )}
        onPaste={onPaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
      />
    </div>
  );
}
