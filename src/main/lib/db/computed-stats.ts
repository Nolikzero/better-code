/**
 * Helper functions for computing statistics from messages.
 * These are used to update computed columns in sub_chats table
 * when messages are saved, avoiding expensive JSON parsing on queries.
 */

import {
  computeFileStatsFromMessages,
  type FileStats,
  type Message,
} from "../../../shared/utils/diff-stats";

// Re-export for backwards compatibility
export type { FileStats };

/**
 * Check if messages contain a pending plan approval.
 * A plan is pending if there's an ExitPlanMode tool call without
 * a subsequent "Implement plan" user message.
 * Logic matches active-chat.tsx hasUnapprovedPlan.
 */
function computeHasPendingPlan(messages: Message[]): boolean {
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
    fileStats: computeFileStatsFromMessages(messages),
    hasPendingPlanApproval: computeHasPendingPlan(messages),
  };
}
