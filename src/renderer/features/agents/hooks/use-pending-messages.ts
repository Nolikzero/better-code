"use client";

import type { Chat } from "@ai-sdk/react";
import { useAtom } from "jotai";
import { useEffect } from "react";
import {
  pendingFileMentionsAtom,
  pendingPrMessageAtom,
  pendingReviewMessageAtom,
} from "../atoms";
import type { AgentsMentionsEditorHandle } from "../mentions";

export interface UsePendingMessagesOptions {
  isStreaming: boolean;
  sendMessage: Chat<any>["sendMessage"];
  editorRef: React.RefObject<AgentsMentionsEditorHandle | null>;
}

/**
 * Hook to manage pending message injection from external sources:
 * - Watches pendingPrMessageAtom and auto-sends when stream finishes
 * - Watches pendingReviewMessageAtom and auto-sends when stream finishes
 * - Watches pendingFileMentionsAtom and appends mentions to editor
 *
 * These atoms are set by external actions (PR creation, file tree context menu, etc.)
 * and this hook ensures they're processed at the right time.
 */
export function usePendingMessages(options: UsePendingMessagesOptions) {
  const { isStreaming, sendMessage, editorRef } = options;

  // Watch for pending PR message and send it
  const [pendingPrMessage, setPendingPrMessage] = useAtom(pendingPrMessageAtom);

  useEffect(() => {
    if (pendingPrMessage && !isStreaming) {
      // Clear the pending message immediately to prevent double-sending
      setPendingPrMessage(null);

      // Send the message to Claude
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: pendingPrMessage }],
      });
    }
  }, [pendingPrMessage, isStreaming, sendMessage, setPendingPrMessage]);

  // Watch for pending Review message and send it
  const [pendingReviewMessage, setPendingReviewMessage] = useAtom(
    pendingReviewMessageAtom,
  );

  useEffect(() => {
    if (pendingReviewMessage && !isStreaming) {
      // Clear the pending message immediately to prevent double-sending
      setPendingReviewMessage(null);

      // Send the message to Claude
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: pendingReviewMessage }],
      });
    }
  }, [pendingReviewMessage, isStreaming, sendMessage, setPendingReviewMessage]);

  // Watch for pending file mentions (from project tree context menu)
  const [pendingFileMentions, setPendingFileMentions] = useAtom(
    pendingFileMentionsAtom,
  );

  useEffect(() => {
    if (pendingFileMentions.length === 0) return;

    // Focus and append all mentions to editor
    editorRef.current?.focus();
    for (const mention of pendingFileMentions) {
      editorRef.current?.appendMention(mention);
    }

    // Clear the pending mentions
    setPendingFileMentions([]);
  }, [pendingFileMentions, setPendingFileMentions, editorRef]);
}
