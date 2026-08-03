import { describe, expect, test } from "bun:test";
import type { ApiProviderProtocol, UIMessageChunk } from "@shared/types";
import type { ChatSessionOptions } from "../types";
import { ApiProvider } from "./provider";
import type { ApiProviderRecord } from "./store";

type CapturedRequest = {
  authorization?: string;
  apiKey?: string;
  anthropicVersion?: string;
  body?: unknown;
};

function createRecord(
  baseUrl: string,
  protocol: ApiProviderProtocol,
  apiKey = "test-secret-key",
): ApiProviderRecord {
  return {
    id: "api:11111111-1111-4111-8111-111111111111",
    name: "测试服务商",
    protocol,
    baseUrl,
    apiKey,
    models: [
      { id: "test-model", name: "test-model", displayName: "test-model" },
    ],
    contextWindow: 4096,
    enabled: true,
    hasApiKey: true,
    createdAt: null,
    updatedAt: null,
  };
}

function createOptions(controller = new AbortController()): ChatSessionOptions {
  return {
    subChatId: "sub-chat-1",
    chatId: "chat-1",
    prompt: "当前问题",
    cwd: "C:/workspace",
    mode: "agent",
    model: "test-model",
    systemPrompt: "系统提示",
    history: [
      { role: "user", content: "历史问题" },
      { role: "assistant", content: "历史回答" },
    ],
    abortController: controller,
  };
}

async function collectChunks(
  provider: ApiProvider,
  options: ChatSessionOptions,
) {
  const chunks: UIMessageChunk[] = [];
  for await (const chunk of provider.chat(options)) chunks.push(chunk);
  return chunks;
}

function textDeltas(chunks: readonly UIMessageChunk[]): string[] {
  return chunks.flatMap((chunk) =>
    chunk.type === "text-delta" ? [chunk.delta] : [],
  );
}

describe("API 服务商真实 HTTP 请求", () => {
  test("OpenAI 兼容请求携带历史、Bearer Key 并解析 SSE", async () => {
    const captured: CapturedRequest = {};
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        captured.authorization =
          request.headers.get("authorization") ?? undefined;
        captured.body = await request.json();
        return new Response(
          'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n' +
            'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n' +
            "data: [DONE]\n\n",
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    });

    try {
      const provider = new ApiProvider(
        createRecord(server.url.origin, "openai-compatible"),
      );
      const chunks = await collectChunks(provider, createOptions());
      expect(captured.authorization).toBe("Bearer test-secret-key");
      expect(captured.body).toEqual({
        model: "test-model",
        stream: true,
        messages: [
          { role: "system", content: "系统提示" },
          { role: "user", content: "历史问题" },
          { role: "assistant", content: "历史回答" },
          { role: "user", content: "当前问题" },
        ],
      });
      expect(textDeltas(chunks)).toEqual(["你好", "世界"]);
      expect(chunks.at(-1)?.type).toBe("finish");
    } finally {
      server.stop(true);
    }
  });

  test("历史已包含当前问题时不会重复发送用户消息", async () => {
    const captured: CapturedRequest = {};
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        captured.body = await request.json();
        return new Response(
          'data: {"choices":[{"delta":{"content":"完成"}}]}\n\n' +
            "data: [DONE]\n\n",
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    });

    try {
      const provider = new ApiProvider(
        createRecord(server.url.origin, "openai-compatible"),
      );
      const options = createOptions();
      const history = options.history ?? [];
      await collectChunks(provider, {
        ...options,
        history: [...history, { role: "user", content: options.prompt }],
      });
      expect(captured.body).toEqual({
        model: "test-model",
        stream: true,
        messages: [
          { role: "system", content: "系统提示" },
          { role: "user", content: "历史问题" },
          { role: "assistant", content: "历史回答" },
          { role: "user", content: "当前问题" },
        ],
      });
    } finally {
      server.stop(true);
    }
  });

  test("Anthropic 兼容请求使用 x-api-key 并解析 SSE", async () => {
    const captured: CapturedRequest = {};
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        captured.apiKey = request.headers.get("x-api-key") ?? undefined;
        captured.anthropicVersion =
          request.headers.get("anthropic-version") ?? undefined;
        captured.body = await request.json();
        return new Response(
          'data: {"type":"content_block_delta","delta":{"text":"完成"}}\n\n',
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    });

    try {
      const provider = new ApiProvider(
        createRecord(server.url.origin, "anthropic-compatible"),
      );
      const chunks = await collectChunks(provider, createOptions());
      expect(captured.apiKey).toBe("test-secret-key");
      expect(captured.anthropicVersion).toBe("2023-06-01");
      expect(captured.body).toMatchObject({
        model: "test-model",
        stream: true,
        system: "系统提示",
        messages: [
          { role: "user", content: "历史问题" },
          { role: "assistant", content: "历史回答" },
          { role: "user", content: "当前问题" },
        ],
      });
      expect(textDeltas(chunks)).toEqual(["完成"]);
    } finally {
      server.stop(true);
    }
  });

  test("测试连接读取模型列表且不会在错误中泄露 Key", async () => {
    let shouldFail = false;
    const server = Bun.serve({
      port: 0,
      fetch() {
        if (shouldFail) return new Response("denied", { status: 401 });
        return Response.json({ data: [{ id: "model-a" }, { id: "model-b" }] });
      },
    });

    try {
      const record = createRecord(server.url.origin, "openai-compatible");
      const provider = new ApiProvider(record);
      expect(await provider.testConnection()).toEqual(["model-a", "model-b"]);
      expect(await provider.testModel("model-a")).toMatchObject({
        modelId: "model-a",
        models: ["model-a", "model-b"],
        verified: true,
      });
      await expect(provider.testModel("model-c")).rejects.toThrow(
        "返回的模型列表中没有",
      );
      shouldFail = true;
      const chunks = await collectChunks(provider, createOptions());
      const errorText = chunks.flatMap((chunk) =>
        chunk.type === "auth-error" || chunk.type === "error"
          ? [chunk.errorText]
          : [],
      );
      expect(errorText.join(" ")).toContain("鉴权失败");
      expect(errorText.join(" ")).not.toContain(record.apiKey);
    } finally {
      server.stop(true);
    }
  });

  test("取消请求会结束流并清理活动会话", async () => {
    const server = Bun.serve({
      port: 0,
      async fetch() {
        await Bun.sleep(100);
        return Response.json({
          choices: [{ message: { content: "迟到响应" } }],
        });
      },
    });

    try {
      const controller = new AbortController();
      controller.abort();
      const provider = new ApiProvider(
        createRecord(server.url.origin, "openai-compatible"),
      );
      const chunks = await collectChunks(provider, createOptions(controller));
      expect(chunks).toEqual([
        {
          type: "finish",
          messageMetadata: { model: "test-model" },
        },
      ]);
      expect(provider.isActive("sub-chat-1")).toBe(false);
    } finally {
      server.stop(true);
    }
  });
});
