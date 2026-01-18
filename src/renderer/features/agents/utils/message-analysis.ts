import type { MessagePart } from "./message-utils";

export interface MessageAnalysis {
  /** Whether the message has a final text response after tools */
  hasFinalText: boolean;
  /** Whether the message contains an ExitPlanMode tool with plan text */
  hasPlan: boolean;
  /** The plan text from ExitPlanMode, if any */
  planText: string;
  /** Parts to show in collapsible steps section */
  stepParts: MessagePart[];
  /** Parts to show as the final response (after steps) */
  finalParts: MessagePart[];
  /** Index of the final text part, -1 if none */
  finalTextIndex: number;
}

export interface AnalyzeOptions {
  /** Whether the chat is currently streaming */
  isStreaming: boolean;
  /** Whether this is the last message in the conversation */
  isLastMessage: boolean;
}

/**
 * Analyzes message parts to determine structure for rendering.
 * Separates parts into steps (tools) and final text response.
 * Detects plan mode via ExitPlanMode tool.
 */
export function analyzeMessageParts(
  parts: MessagePart[],
  options: AnalyzeOptions,
): MessageAnalysis {
  const { isStreaming, isLastMessage } = options;

  // Find the last tool index and last text index
  let lastToolIndex = -1;
  let lastTextIndex = -1;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type?.startsWith("tool-")) {
      lastToolIndex = i;
    }
    if (part.type === "text" && part.text?.trim()) {
      lastTextIndex = i;
    }
  }

  // Final text exists if: there are tools AND the last text comes AFTER the last tool
  // For streaming messages, don't show as final until streaming completes
  const hasToolsAndFinalText =
    lastToolIndex !== -1 && lastTextIndex > lastToolIndex;

  const finalTextIndex = hasToolsAndFinalText ? lastTextIndex : -1;

  // Separate parts into steps (before final) and final text
  // For non-last messages, show final text even while streaming (they're already complete)
  const hasFinalText =
    finalTextIndex !== -1 && (!isStreaming || !isLastMessage);

  // Check if message has a plan (ExitPlanMode tool)
  const exitPlanPart = parts.find((p) => p.type === "tool-ExitPlanMode");
  const planText =
    typeof exitPlanPart?.output?.plan === "string"
      ? exitPlanPart.output.plan
      : "";
  const hasPlan = !!planText;

  // If has plan, treat everything before plan as steps to collapse
  const stepParts = hasFinalText
    ? parts.slice(0, finalTextIndex)
    : hasPlan
      ? parts.filter((p) => p.type !== "tool-ExitPlanMode") // All parts except plan are steps
      : [];

  const finalParts = hasFinalText
    ? parts.slice(finalTextIndex)
    : hasPlan
      ? [] // Plan is rendered separately, no final parts
      : parts;

  return {
    hasFinalText,
    hasPlan,
    planText,
    stepParts,
    finalParts,
    finalTextIndex,
  };
}

export interface CountVisibleStepsOptions {
  nestedToolIds: Set<string>;
  orphanToolCallIds: Set<string>;
  orphanFirstToolCallIds: Set<string>;
}

/**
 * Counts visible step items for the collapsible toggle label.
 * Excludes metadata parts, nested tools, and empty text parts.
 */
export function countVisibleSteps(
  stepParts: MessagePart[],
  options: CountVisibleStepsOptions,
): number {
  const { nestedToolIds, orphanToolCallIds, orphanFirstToolCallIds } = options;

  return stepParts.filter((p) => {
    // Skip metadata parts
    if (p.type === "step-start") return false;
    if (p.type === "tool-TaskOutput") return false;

    // Skip nested tools (rendered inside parent Task)
    if (p.toolCallId && nestedToolIds.has(p.toolCallId)) return false;

    // Skip non-first orphan tools
    if (
      p.toolCallId &&
      orphanToolCallIds.has(p.toolCallId) &&
      !orphanFirstToolCallIds.has(p.toolCallId)
    ) {
      return false;
    }

    // Skip empty text parts
    if (p.type === "text" && !p.text?.trim()) return false;

    return true;
  }).length;
}

/**
 * Finds the ExitPlanMode tool part in message parts.
 */
export function findExitPlanModeTool(
  parts: MessagePart[],
): MessagePart | undefined {
  return parts.find((p) => p.type === "tool-ExitPlanMode");
}
