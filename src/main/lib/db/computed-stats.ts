/**
 * Helper functions for computing statistics from messages.
 * These are used to update computed columns in sub_chats table
 * when messages are saved, avoiding expensive JSON parsing on queries.
 */

export interface FileStats {
  additions: number;
  deletions: number;
  fileCount: number;
}

interface MessagePart {
  type: string;
  input?: {
    file_path?: string;
    old_string?: string;
    new_string?: string;
    content?: string;
  };
  text?: string;
}

interface Message {
  role: string;
  parts?: MessagePart[];
}

/**
 * Compute file change statistics from messages.
 * Extracts file edit/write operations and calculates line additions/deletions.
 */
export function computeFileStats(messages: Message[]): FileStats {
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
        if (
          filePath.includes("claude-sessions") ||
          filePath.includes("Application Support")
        )
          continue;

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

  // Calculate stats
  let additions = 0;
  let deletions = 0;
  let fileCount = 0;

  for (const [, state] of fileStates) {
    const original = state.originalContent || "";
    if (original === state.currentContent) continue;

    const oldLines = original ? original.split("\n").length : 0;
    const newLines = state.currentContent
      ? state.currentContent.split("\n").length
      : 0;

    if (!original) {
      // New file
      additions += newLines;
    } else {
      additions += newLines;
      deletions += oldLines;
    }
    fileCount += 1;
  }

  return { additions, deletions, fileCount };
}

/**
 * Check if messages contain a pending plan approval.
 * A plan is pending if there's an ExitPlanMode tool call without
 * a subsequent "Implement plan" user message.
 * Logic matches active-chat.tsx hasUnapprovedPlan.
 */
export function computeHasPendingPlan(messages: Message[]): boolean {
  // Traverse messages from end to find unapproved ExitPlanMode
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;

    // If user message says "Implement plan" (exact match), plan is already approved
    if (msg.role === "user") {
      const textPart = msg.parts?.find((p) => p.type === "text");
      const text = textPart?.text || "";
      if (text.trim().toLowerCase() === "implement plan") {
        return false; // Plan was approved
      }
    }

    // If assistant message with ExitPlanMode, we found an unapproved plan
    if (msg.role === "assistant" && msg.parts) {
      const exitPlanPart = msg.parts.find(
        (p) => p.type === "tool-ExitPlanMode",
      );
      if (exitPlanPart) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Compute all stats at once (for efficiency when saving messages).
 */
export function computeAllStats(messages: Message[]): {
  fileStats: FileStats;
  hasPendingPlanApproval: boolean;
} {
  return {
    fileStats: computeFileStats(messages),
    hasPendingPlanApproval: computeHasPendingPlan(messages),
  };
}
