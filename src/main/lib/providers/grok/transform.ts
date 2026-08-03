import type { MessageMetadata, UIMessageChunk } from "@shared/types";
import { type GrokEvent, grokEventSchema } from "./types";

export function parseGrokLine(line: string): GrokEvent | null {
  try {
    const value: unknown = JSON.parse(line);
    const parsed = grokEventSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type UsageKey =
  | "input_tokens"
  | "output_tokens"
  | "reasoning_tokens"
  | "cache_read_input_tokens"
  | "total_tokens"
  | "total_cost_usd";

function getUsageValue(event: GrokEvent, key: UsageKey): number | undefined {
  return event.usage?.[key] ?? event[key];
}

function buildMetadata(event: GrokEvent, model: string): MessageMetadata {
  return {
    sessionId: event.sessionId,
    model,
    inputTokens: getUsageValue(event, "input_tokens"),
    outputTokens: getUsageValue(event, "output_tokens"),
    reasoningTokens: getUsageValue(event, "reasoning_tokens"),
    cachedInputTokens: getUsageValue(event, "cache_read_input_tokens"),
    totalTokens: getUsageValue(event, "total_tokens"),
    totalCostUsd: getUsageValue(event, "total_cost_usd"),
  };
}

export type GrokTransformer = {
  push: (event: GrokEvent) => UIMessageChunk[];
  finish: () => UIMessageChunk[];
};

export function createGrokTransformer(model: string): GrokTransformer {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const textId = `grok-text-${suffix}`;
  const reasoningId = `grok-reasoning-${suffix}`;
  let textStarted = false;
  let finished = false;

  function endText(): UIMessageChunk[] {
    if (!textStarted) return [];
    textStarted = false;
    return [{ type: "text-end", id: textId }];
  }

  function finish(event?: GrokEvent): UIMessageChunk[] {
    if (finished) return [];
    finished = true;
    const chunks: UIMessageChunk[] = [...endText()];
    if (event) {
      const metadata = buildMetadata(event, model);
      chunks.push({ type: "message-metadata", messageMetadata: metadata });
      chunks.push({ type: "finish", messageMetadata: metadata });
    } else {
      chunks.push({ type: "finish" });
    }
    return chunks;
  }

  function push(event: GrokEvent): UIMessageChunk[] {
    if (finished) return [];

    switch (event.type) {
      case "text": {
        const text = event.text ?? "";
        if (text.length === 0) return [];
        const chunks: UIMessageChunk[] = [];
        if (!textStarted) {
          textStarted = true;
          chunks.push({ type: "text-start", id: textId });
        }
        chunks.push({ type: "text-delta", id: textId, delta: text });
        return chunks;
      }
      case "thought": {
        const thought = event.thought ?? "";
        return thought.length > 0
          ? [{ type: "reasoning-delta", id: reasoningId, delta: thought }]
          : [];
      }
      case "end":
        return finish(event);
      case "error": {
        const errorText =
          event.error ?? event.message ?? event.text ?? "Grok CLI 返回未知错误";
        const chunks: UIMessageChunk[] = [...endText()];
        if (
          /not signed in|not authenticated|not logged in|unauthenticated/i.test(
            errorText,
          )
        ) {
          chunks.push({ type: "auth-error", errorText });
        } else {
          chunks.push({ type: "error", errorText });
        }
        chunks.push(...finish());
        return chunks;
      }
      default:
        return [];
    }
  }

  return { push, finish: () => finish() };
}
