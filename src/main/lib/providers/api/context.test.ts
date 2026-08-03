import { describe, expect, test } from "bun:test";
import { parseProviderHistory, trimProviderContext } from "./context";

describe("API 服务商上下文", () => {
  test("从持久化消息中提取用户与助手文本", () => {
    expect(
      parseProviderHistory([
        { role: "user", parts: [{ type: "text", text: "问题" }] },
        {
          role: "assistant",
          parts: [
            { type: "text", text: "回答一" },
            { type: "text", text: "回答二" },
          ],
        },
        { role: "system", parts: [{ type: "text", text: "忽略" }] },
      ]),
    ).toEqual([
      { role: "user", content: "问题" },
      { role: "assistant", content: "回答一\n回答二" },
    ]);
  });

  test("无效历史消息返回空数组", () => {
    expect(parseProviderHistory({ role: "user" })).toEqual([]);
  });

  test("超出上下文预算时优先保留最近消息", () => {
    const messages = [
      { role: "user" as const, content: "a".repeat(4000) },
      { role: "assistant" as const, content: "b".repeat(4000) },
      { role: "user" as const, content: "最近问题" },
    ];

    expect(trimProviderContext(messages, 1024)).toEqual([
      { role: "user", content: "最近问题" },
    ]);
  });

  test("即使单条消息超过预算也会保留最新消息", () => {
    const latest = { role: "user" as const, content: "x".repeat(10_000) };
    expect(trimProviderContext([latest], 1024)).toEqual([latest]);
  });
});
