/**
 * Centralized diff statistics calculation utilities.
 * Used by both main process (computed-stats.ts) and renderer (use-changed-files-tracking.ts).
 */

import type { DiffStats, FileStats } from "../types/diff-stats.types";
import { isSessionFile } from "./file-path";

// Re-export types for backwards compatibility
export type { DiffStats, FileStats };

/**
 * Calculate diff statistics between two text strings.
 * Uses frequency-based comparison to handle duplicate lines correctly.
 *
 * @param oldStr - Original content (empty string for new files)
 * @param newStr - New content (empty string for deleted files)
 * @returns Object with additions and deletions counts
 */
export function calculateDiffStats(oldStr: string, newStr: string): DiffStats {
  if (oldStr === newStr) return { additions: 0, deletions: 0 };

  const oldLines = oldStr ? oldStr.split("\n") : [];
  const newLines = newStr ? newStr.split("\n") : [];

  // New file - all lines are additions
  if (oldLines.length === 0 || !oldStr) {
    return { additions: newLines.length, deletions: 0 };
  }

  // Deleted file - all lines are deletions
  if (newLines.length === 0 || !newStr) {
    return { additions: 0, deletions: oldLines.length };
  }

  // Use frequency maps to handle duplicate lines correctly
  const oldFreq = new Map<string, number>();
  const newFreq = new Map<string, number>();

  for (const line of oldLines) {
    oldFreq.set(line, (oldFreq.get(line) || 0) + 1);
  }
  for (const line of newLines) {
    newFreq.set(line, (newFreq.get(line) || 0) + 1);
  }

  let additions = 0;
  let deletions = 0;

  // Count additions: lines that appear more in new than old
  for (const [line, newCount] of newFreq) {
    const oldCount = oldFreq.get(line) || 0;
    if (newCount > oldCount) {
      additions += newCount - oldCount;
    }
  }

  // Count deletions: lines that appear more in old than new
  for (const [line, oldCount] of oldFreq) {
    const newCount = newFreq.get(line) || 0;
    if (oldCount > newCount) {
      deletions += oldCount - newCount;
    }
  }

  return { additions, deletions };
}

/**
 * Message part type from tool calls
 */
export interface MessagePart {
  type: string;
  input?: {
    file_path?: string;
    old_string?: string;
    new_string?: string;
    content?: string;
  };
  text?: string;
}

/**
 * Message type for processing
 */
export interface Message {
  role: string;
  parts?: MessagePart[];
}

/**
 * Compute file change statistics from messages.
 * Extracts file edit/write operations and calculates line additions/deletions.
 *
 * @param messages - Array of chat messages to process
 * @returns FileStats with additions, deletions, and fileCount
 */
export function computeFileStatsFromMessages(messages: Message[]): FileStats {
  // Track file states to calculate final diff
  const fileStates = new Map<
    string,
    { originalContent: string | null; currentContent: string }
  >();

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts || []) {
      if (part.type === "tool-Edit" || part.type === "tool-Write") {
        const filePath = part.input?.file_path;
        if (!filePath) continue;
        // Skip session files
        if (isSessionFile(filePath)) continue;

        const oldString = part.input?.old_string || "";
        const newString = part.input?.new_string || part.input?.content || "";

        const existing = fileStates.get(filePath);
        if (existing) {
          existing.currentContent = newString;
        } else {
          fileStates.set(filePath, {
            originalContent: part.type === "tool-Write" ? null : oldString,
            currentContent: newString,
          });
        }
      }
    }
  }

  // Calculate stats using frequency-based comparison
  let additions = 0;
  let deletions = 0;
  let fileCount = 0;

  for (const [, state] of fileStates) {
    const original = state.originalContent || "";
    if (original === state.currentContent) continue;

    const stats = calculateDiffStats(original, state.currentContent);
    additions += stats.additions;
    deletions += stats.deletions;
    fileCount += 1;
  }

  return { additions, deletions, fileCount };
}
