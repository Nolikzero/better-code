import { z } from "zod";
import type { ProviderChatMessage } from "../types";

const persistedMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  parts: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
      }),
    )
    .default([]),
});

export function parseProviderHistory(value: unknown): ProviderChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    const parsed = persistedMessageSchema.safeParse(candidate);
    if (!parsed.success) return [];
    const content = parsed.data.parts
      .map((part) => part.text ?? "")
      .filter((text) => text.length > 0)
      .join("\n");
    return content.length > 0 ? [{ role: parsed.data.role, content }] : [];
  });
}

function estimatedTokens(message: ProviderChatMessage): number {
  return Math.max(1, Math.ceil(message.content.length / 4));
}

export function trimProviderContext(
  messages: readonly ProviderChatMessage[],
  contextWindow: number,
): ProviderChatMessage[] {
  const inputBudget = Math.max(256, Math.floor(contextWindow * 0.8));
  const selected: ProviderChatMessage[] = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const tokens = estimatedTokens(message);
    if (selected.length > 0 && used + tokens > inputBudget) break;
    selected.push(message);
    used += tokens;
  }

  return selected.reverse();
}
