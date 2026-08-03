import { describe, expect, test } from "bun:test";
import { buildChatUrl, buildModelsUrl } from "./urls";

describe("API 服务商 URL 构造", () => {
  test("OpenAI 根地址与 /v1 地址会补全 Chat Completions", () => {
    expect(buildChatUrl("https://example.com", "openai-compatible")).toBe(
      "https://example.com/v1/chat/completions",
    );
    expect(buildChatUrl("https://example.com/v1/", "openai-compatible")).toBe(
      "https://example.com/v1/chat/completions",
    );
  });

  test("完整 OpenAI 地址不会重复追加路径", () => {
    expect(
      buildChatUrl(
        "https://example.com/v1/chat/completions/",
        "openai-compatible",
      ),
    ).toBe("https://example.com/v1/chat/completions");
  });

  test("Anthropic 地址会补全 Messages", () => {
    expect(buildChatUrl("https://example.com", "anthropic-compatible")).toBe(
      "https://example.com/v1/messages",
    );
    expect(
      buildChatUrl("https://example.com/v1/messages", "anthropic-compatible"),
    ).toBe("https://example.com/v1/messages");
  });

  test("模型地址可从根地址或聊天地址推导", () => {
    expect(buildModelsUrl("https://example.com")).toBe(
      "https://example.com/v1/models",
    );
    expect(buildModelsUrl("https://example.com/v1/chat/completions")).toBe(
      "https://example.com/v1/models",
    );
    expect(buildModelsUrl("https://example.com/v1/messages")).toBe(
      "https://example.com/v1/models",
    );
  });
});
