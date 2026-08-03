import { describe, expect, test } from "bun:test";
import { createGrokTransformer, parseGrokLine } from "./transform";
import { grokEventSchema } from "./types";

describe("parseGrokLine", () => {
  test("解析有效 NDJSON 事件", () => {
    expect(parseGrokLine('{"type":"text","text":"你好"}')).toEqual({
      type: "text",
      text: "你好",
    });
  });

  test("忽略无效 JSON 与不完整事件", () => {
    expect(parseGrokLine("not-json")).toBeNull();
    expect(parseGrokLine('{"text":"missing type"}')).toBeNull();
  });
});

describe("createGrokTransformer", () => {
  test("将文本事件转换为完整文本生命周期", () => {
    const transformer = createGrokTransformer("grok-4.5");
    const first = transformer.push(
      grokEventSchema.parse({ type: "text", text: "你" }),
    );
    const second = transformer.push(
      grokEventSchema.parse({ type: "text", text: "好" }),
    );
    const end = transformer.push(grokEventSchema.parse({ type: "end" }));

    expect(first).toEqual([
      { type: "text-start", id: expect.any(String) },
      { type: "text-delta", id: expect.any(String), delta: "你" },
    ]);
    expect(second).toEqual([
      { type: "text-delta", id: expect.any(String), delta: "好" },
    ]);
    expect(end).toEqual([
      { type: "text-end", id: expect.any(String) },
      {
        type: "message-metadata",
        messageMetadata: { model: "grok-4.5" },
      },
      { type: "finish", messageMetadata: { model: "grok-4.5" } },
    ]);
  });

  test("将 thought 映射为 reasoning-delta", () => {
    const transformer = createGrokTransformer("grok-4.5");
    expect(
      transformer.push(
        grokEventSchema.parse({ type: "thought", thought: "正在分析" }),
      ),
    ).toEqual([
      {
        type: "reasoning-delta",
        id: expect.any(String),
        delta: "正在分析",
      },
    ]);
  });

  test("在结束事件中映射会话和用量元数据", () => {
    const transformer = createGrokTransformer("grok-4.5");
    const chunks = transformer.push(
      grokEventSchema.parse({
        type: "end",
        sessionId: "session-123",
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          reasoning_tokens: 3,
          cache_read_input_tokens: 4,
          total_tokens: 33,
          total_cost_usd: 0.12,
        },
      }),
    );

    expect(chunks).toEqual([
      {
        type: "message-metadata",
        messageMetadata: {
          sessionId: "session-123",
          model: "grok-4.5",
          inputTokens: 10,
          outputTokens: 20,
          reasoningTokens: 3,
          cachedInputTokens: 4,
          totalTokens: 33,
          totalCostUsd: 0.12,
        },
      },
      {
        type: "finish",
        messageMetadata: {
          sessionId: "session-123",
          model: "grok-4.5",
          inputTokens: 10,
          outputTokens: 20,
          reasoningTokens: 3,
          cachedInputTokens: 4,
          totalTokens: 33,
          totalCostUsd: 0.12,
        },
      },
    ]);
  });

  test("将认证错误映射为 auth-error 并只结束一次", () => {
    const transformer = createGrokTransformer("grok-4.5");
    const chunks = transformer.push(
      grokEventSchema.parse({
        type: "error",
        error: "You are not authenticated.",
      }),
    );

    expect(chunks).toEqual([
      { type: "auth-error", errorText: "You are not authenticated." },
      { type: "finish" },
    ]);
    expect(transformer.finish()).toEqual([]);
  });

  test("普通错误映射为 error，未知事件安全忽略", () => {
    const transformer = createGrokTransformer("grok-4.5");
    expect(
      transformer.push(grokEventSchema.parse({ type: "future-event" })),
    ).toEqual([]);
    expect(
      transformer.push(
        grokEventSchema.parse({ type: "error", message: "请求失败" }),
      ),
    ).toEqual([{ type: "error", errorText: "请求失败" }, { type: "finish" }]);
  });
});
