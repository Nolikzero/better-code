"use client";

import { AgentFileItem } from "../../ui/agent-file-item";
import { AgentImageItem } from "../../ui/agent-image-item";
import type { FileAttachment, ImageAttachment } from "./chat-input-context";

export interface ChatInputAttachmentsProps {
  images: ImageAttachment[];
  files?: FileAttachment[];
  onRemoveImage: (id: string) => void;
  onRemoveFile?: (id: string) => void;
}

/**
 * Renders image and file attachments for the chat input.
 * Used as contextItems in ChatInputRoot.
 */
export function ChatInputAttachments({
  images,
  files = [],
  onRemoveImage,
  onRemoveFile,
}: ChatInputAttachmentsProps) {
  if (images.length === 0 && files.length === 0) {
    return null;
  }

  // Build allImages array for gallery navigation
  const allImages = images
    .filter((img) => img.url && !img.isLoading)
    .map((img) => ({
      id: img.id,
      filename: img.filename,
      url: img.url,
    }));

  return (
    <div className="flex flex-wrap gap-[6px]">
      {images.map((img, idx) => (
        <AgentImageItem
          key={img.id}
          id={img.id}
          filename={img.filename}
          url={img.url}
          isLoading={img.isLoading}
          onRemove={() => onRemoveImage(img.id)}
          allImages={allImages}
          imageIndex={idx}
        />
      ))}
      {files.map((f) => (
        <AgentFileItem
          key={f.id}
          id={f.id}
          filename={f.filename}
          url={f.url}
          size={f.size}
          isLoading={f.isLoading}
          onRemove={onRemoveFile ? () => onRemoveFile(f.id) : undefined}
        />
      ))}
    </div>
  );
}
