import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  calculateDiffStats,
  isSessionFile,
  type Message,
  toDisplayPath,
} from "../../../../shared/utils";
import {
  type SubChatFileChange,
  subChatFilesAtom,
  subChatToChatMapAtom,
} from "../atoms";

/**
 * Custom hook to track changed files from Edit/Write tool calls in a sub-chat
 * Extracts file paths and calculates diff stats from message history
 * Only recalculates after streaming ends (not during streaming)
 */
export function useChangedFilesTracking(
  messages: Message[],
  subChatId: string,
  isStreaming = false,
  chatId?: string,
) {
  const setSubChatFiles = useSetAtom(subChatFilesAtom);
  const setSubChatToChatMap = useSetAtom(subChatToChatMapAtom);

  // State to hold the calculated changed files (only updated when streaming ends)
  const [changedFiles, setChangedFiles] = useState<SubChatFileChange[]>([]);
  const wasStreamingRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Calculate changed files from messages
  const calculateChangedFiles = useCallback(() => {
    // Track file states: originalContent (first old_string) and currentContent (latest new_string)
    const fileStates = new Map<
      string,
      {
        originalContent: string | null; // null means file didn't exist before
        currentContent: string;
        displayPath: string;
      }
    >();

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts || []) {
        if (part.type === "tool-Edit" || part.type === "tool-Write") {
          const filePath = part.input?.file_path;
          if (!filePath) continue;

          // Skip session/plan files stored in local app storage
          if (isSessionFile(filePath)) continue;

          const oldString = part.input?.old_string || "";
          const newString = part.input?.new_string || part.input?.content || "";

          const existing = fileStates.get(filePath);
          if (existing) {
            // Update current content only (preserve original)
            existing.currentContent = newString;
          } else {
            // First time seeing this file - record original state
            fileStates.set(filePath, {
              // For Write (new file), original is null; for Edit, it's the old_string
              originalContent: part.type === "tool-Write" ? null : oldString,
              currentContent: newString,
              displayPath: toDisplayPath(filePath),
            });
          }
        }
      }
    }

    // Calculate NET diff from original to current state
    const result: SubChatFileChange[] = [];
    for (const [filePath, state] of fileStates) {
      const originalContent = state.originalContent || "";

      // Skip if file returned to original state (net change = 0)
      if (originalContent === state.currentContent) {
        continue;
      }

      const stats = calculateDiffStats(originalContent, state.currentContent);
      result.push({
        filePath,
        displayPath: state.displayPath,
        additions: stats.additions,
        deletions: stats.deletions,
      });
    }

    return result;
  }, [messages]);

  // Only recalculate when streaming ends (transition from true to false)
  // Also calculate on initial mount if not streaming
  useEffect(() => {
    // Detect streaming end: was streaming, now not streaming
    if (wasStreamingRef.current && !isStreaming) {
      const newChangedFiles = calculateChangedFiles();
      setChangedFiles(newChangedFiles);
      isInitializedRef.current = true;
    }
    // Initialize on mount if we have messages and not streaming
    else if (!isInitializedRef.current && !isStreaming && messages.length > 0) {
      const newChangedFiles = calculateChangedFiles();
      setChangedFiles(newChangedFiles);
      isInitializedRef.current = true;
    }

    wasStreamingRef.current = isStreaming;
  }, [isStreaming, calculateChangedFiles, messages.length]);

  // Update atom when changed files change
  useEffect(() => {
    setSubChatFiles((prev) => {
      const next = new Map(prev);
      next.set(subChatId, changedFiles);
      return next;
    });
  }, [subChatId, changedFiles, setSubChatFiles]);

  // Update subChatId -> chatId mapping for aggregation in workspace sidebar
  useEffect(() => {
    if (chatId) {
      setSubChatToChatMap((prev) => {
        const next = new Map(prev);
        next.set(subChatId, chatId);
        return next;
      });
    }
  }, [subChatId, chatId, setSubChatToChatMap]);

  return { changedFiles };
}
