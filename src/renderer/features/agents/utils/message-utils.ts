import { stripEmojis } from "../../../components/chat-markdown-renderer";

/**
 * Tool types that are grouped together when appearing consecutively.
 * When 3+ of these tools appear in a row, they're collapsed into an "exploring-group".
 */
export const EXPLORING_TOOLS = new Set([
  "tool-Read",
  "tool-Grep",
  "tool-Glob",
  "tool-WebSearch",
  "tool-WebFetch",
]);

/**
 * Extracts text content from a message by filtering for text parts.
 */
export function getMessageTextContent(msg: {
  parts?: Array<{ type: string; text?: string }>;
}): string {
  return (
    msg.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n") || ""
  );
}

/**
 * Copies message text content to clipboard (with emojis stripped).
 */
export function copyMessageContent(msg: {
  parts?: Array<{ type: string; text?: string }>;
}): void {
  const textContent = getMessageTextContent(msg);
  if (textContent) {
    navigator.clipboard.writeText(stripEmojis(textContent));
  }
}

export interface MessagePart {
  type: string;
  toolCallId?: string;
  text?: string;
  [key: string]: any;
}

export interface ExploringGroup {
  type: "exploring-group";
  parts: MessagePart[];
}

/**
 * Groups consecutive exploring tools (Read, Grep, Glob, WebSearch, WebFetch)
 * into exploring-group items when 3+ appear in sequence.
 * Nested tools (those with toolCallId in nestedToolIds) are not grouped.
 */
export function groupExploringTools(
  parts: MessagePart[],
  nestedToolIds: Set<string>,
): Array<MessagePart | ExploringGroup> {
  const result: Array<MessagePart | ExploringGroup> = [];
  let currentGroup: MessagePart[] = [];

  for (const part of parts) {
    // Skip nested tools - they shouldn't be grouped, they render inside parent
    const isNested = part.toolCallId && nestedToolIds.has(part.toolCallId);

    if (EXPLORING_TOOLS.has(part.type) && !isNested) {
      currentGroup.push(part);
    } else {
      // Flush group if 3+
      if (currentGroup.length >= 3) {
        result.push({ type: "exploring-group", parts: currentGroup });
      } else {
        result.push(...currentGroup);
      }
      currentGroup = [];
      result.push(part);
    }
  }
  // Flush remaining
  if (currentGroup.length >= 3) {
    result.push({ type: "exploring-group", parts: currentGroup });
  } else {
    result.push(...currentGroup);
  }
  return result;
}
