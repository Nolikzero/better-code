"use client";

import { memo, type ReactNode } from "react";
import { Button } from "../../../../components/ui/button";
import { AttachIcon } from "../../../../components/ui/icons";
import { PromptInputActions } from "../../../../components/ui/prompt-input";
import { useChatInputContext } from "./chat-input-context";

export interface ChatInputActionsProps {
  /** Left side content (mode toggle, model selector) */
  leftContent?: ReactNode;

  /** Right side content before attach button (context indicator, etc.) */
  rightContent?: ReactNode;

  /** Right side content after attach button (send button, implement plan, etc.) */
  actionButton: ReactNode;

  /** File accept types for the hidden file input */
  acceptedFileTypes?: string;

  /** Called when files are selected */
  onAddAttachments: (files: File[]) => void;

  /** Maximum number of images */
  maxImages?: number;

  /** Maximum number of files (non-images) */
  maxFiles?: number;

  /** Current image count */
  imageCount?: number;

  /** Current file count */
  fileCount?: number;
}

/**
 * Action bar for the chat input with mode toggle, model selector,
 * attach button, and send/stop button.
 */
export const ChatInputActions = memo(function ChatInputActions({
  leftContent,
  rightContent,
  actionButton,
  acceptedFileTypes = "image/jpeg,image/png",
  onAddAttachments,
  maxImages = 5,
  maxFiles = 10,
  imageCount = 0,
  fileCount = 0,
}: ChatInputActionsProps) {
  const { fileInputRef, isStreaming } = useChatInputContext();

  const isAttachDisabled =
    isStreaming || (imageCount >= maxImages && fileCount >= maxFiles);

  return (
    <PromptInputActions className="w-full">
      <div className="flex items-center gap-0.5 flex-1 min-w-0">
        {leftContent}
      </div>

      <div className="flex items-center gap-0.5 ml-auto shrink-0">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept={acceptedFileTypes}
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            onAddAttachments(files);
            e.target.value = ""; // Reset to allow same file selection
          }}
        />

        {rightContent}

        {/* Attachment button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-xs outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAttachDisabled}
        >
          <AttachIcon className="h-4 w-4" />
        </Button>

        {/* Send/Stop button or custom action */}
        <div className="ml-1">{actionButton}</div>
      </div>
    </PromptInputActions>
  );
});
