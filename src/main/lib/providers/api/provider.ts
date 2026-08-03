import type {
  ApiProviderSettings,
  AuthStatus,
  ProviderConfig,
  UIMessageChunk,
} from "@shared/types";
import ky, { HTTPError } from "ky";
import { z } from "zod";
import type {
  AIProvider,
  ChatSessionOptions,
  ProviderChatMessage,
} from "../types";
import { trimProviderContext } from "./context";
import type { ApiProviderRecord } from "./store";
import { buildChatUrl, buildModelsUrl } from "./urls";

const openAiChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().optional() }).optional(),
      }),
    )
    .optional(),
});
const openAiResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string().nullable() }),
    }),
  ),
});
const anthropicChunkSchema = z.object({
  type: z.string(),
  delta: z.object({ text: z.string().optional() }).optional(),
});
const anthropicResponseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});
const modelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string() })).optional(),
});

export type ApiProviderModelTestResult = {
  readonly modelId: string;
  readonly models: readonly string[];
  readonly latencyMs: number;
  readonly verified: boolean;
};

export class ApiProviderRequestError extends Error {
  readonly name = "ApiProviderRequestError";
}

function providerConfig(settings: ApiProviderSettings): ProviderConfig {
  return {
    id: settings.id,
    name: settings.name,
    description:
      settings.protocol === "openai-compatible"
        ? "OpenAI 兼容接口"
        : "Anthropic 兼容接口",
    models: settings.models,
    authType: "api-key",
  };
}

function requestHeaders(record: ApiProviderRecord): Record<string, string> {
  return record.protocol === "anthropic-compatible"
    ? { "anthropic-version": "2023-06-01", "x-api-key": record.apiKey }
    : { Authorization: `Bearer ${record.apiKey}` };
}

function statusMessage(status: number): string {
  if (status === 401 || status === 403) return "鉴权失败，请检查 API Key";
  if (status === 404) return "接口地址不存在，请检查 Base URL 和接口格式";
  if (status === 429) return "请求过于频繁或额度不足，请稍后重试";
  return `服务商请求失败（HTTP ${status}）`;
}

async function* readSse(
  response: Response,
): AsyncGenerator<string, void, unknown> {
  if (!response.body) throw new ApiProviderRequestError("服务商未返回响应内容");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data.length > 0) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function messagesForRequest(
  options: ChatSessionOptions,
  contextWindow: number,
): ProviderChatMessage[] {
  const history = options.history ?? [];
  const lastMessage = history.at(-1);
  const alreadyContainsCurrentPrompt =
    lastMessage?.role === "user" && lastMessage.content === options.prompt;
  const messages = alreadyContainsCurrentPrompt
    ? history
    : [...history, { role: "user" as const, content: options.prompt }];
  return trimProviderContext(messages, contextWindow);
}

function extractStreamText(value: unknown, openAi: boolean): string {
  if (openAi) {
    const parsed = openAiChunkSchema.safeParse(value);
    return parsed.success
      ? (parsed.data.choices?.[0]?.delta?.content ?? "")
      : "";
  }
  const parsed = anthropicChunkSchema.safeParse(value);
  return parsed.success && parsed.data.type === "content_block_delta"
    ? (parsed.data.delta?.text ?? "")
    : "";
}

function extractResponseText(value: unknown, openAi: boolean): string | null {
  if (openAi) {
    const parsed = openAiResponseSchema.safeParse(value);
    return parsed.success
      ? (parsed.data.choices[0]?.message.content ?? "")
      : null;
  }
  const parsed = anthropicResponseSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data.content
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export class ApiProvider implements AIProvider {
  readonly id: string;
  readonly config: ProviderConfig;
  private readonly activeSessions = new Map<string, AbortController>();

  constructor(private readonly record: ApiProviderRecord) {
    this.id = record.id;
    this.config = providerConfig(record);
  }

  async isAvailable(): Promise<boolean> {
    return this.record.baseUrl.length > 0 && this.record.apiKey.length > 0;
  }

  async getAuthStatus(): Promise<AuthStatus> {
    return this.record.apiKey.length > 0
      ? { authenticated: true, method: "api-key" }
      : { authenticated: false, error: "尚未配置 API Key" };
  }

  async testConnection(): Promise<readonly string[]> {
    try {
      const response = await ky.get(buildModelsUrl(this.record.baseUrl), {
        headers: requestHeaders(this.record),
        retry: 0,
        timeout: 15_000,
      });
      const json: unknown = await response.json();
      const parsed = modelsResponseSchema.safeParse(json);
      return parsed.success
        ? (parsed.data.data ?? []).map((model) => model.id)
        : [];
    } catch (error) {
      if (error instanceof HTTPError) {
        throw new ApiProviderRequestError(
          statusMessage(error.response.status),
          { cause: error },
        );
      }
      if (error instanceof Error) {
        throw new ApiProviderRequestError(`连接失败：${error.message}`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  async testModel(modelId: string): Promise<ApiProviderModelTestResult> {
    const startedAt = performance.now();
    const models = await this.testConnection();
    const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
    const verified = models.length > 0;
    if (verified && !models.includes(modelId)) {
      throw new ApiProviderRequestError(
        `端点可达，但返回的模型列表中没有“${modelId}”`,
      );
    }
    return { modelId, models, latencyMs, verified };
  }

  async *chat(
    options: ChatSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown> {
    const model = options.model ?? this.record.models[0]?.id;
    if (!model) {
      yield {
        type: "error",
        errorText: "当前服务商没有可用模型，请先在设置中填写模型列表",
      };
      yield { type: "finish" };
      return;
    }

    const controller = options.abortController;
    this.activeSessions.set(options.subChatId, controller);
    const textId = `api-text-${crypto.randomUUID()}`;
    let started = false;
    let finished = false;

    const textChunks = (text: string): UIMessageChunk[] => {
      if (text.length === 0) return [];
      const chunks: UIMessageChunk[] = [];
      if (!started) {
        started = true;
        chunks.push({ type: "text-start", id: textId });
      }
      chunks.push({ type: "text-delta", id: textId, delta: text });
      return chunks;
    };
    const finishChunks = (): UIMessageChunk[] => {
      if (finished) return [];
      finished = true;
      const chunks: UIMessageChunk[] = [];
      if (started) chunks.push({ type: "text-end", id: textId });
      chunks.push({ type: "finish", messageMetadata: { model } });
      return chunks;
    };

    try {
      const openAi = this.record.protocol === "openai-compatible";
      const messages = messagesForRequest(options, this.record.contextWindow);
      const response = await ky.post(
        buildChatUrl(this.record.baseUrl, this.record.protocol),
        {
          headers: requestHeaders(this.record),
          json: openAi
            ? {
                model,
                stream: true,
                messages: [
                  ...(options.systemPrompt
                    ? [{ role: "system", content: options.systemPrompt }]
                    : []),
                  ...messages,
                ],
              }
            : {
                model,
                stream: true,
                max_tokens: Math.max(
                  256,
                  Math.min(8192, Math.floor(this.record.contextWindow * 0.1)),
                ),
                ...(options.systemPrompt
                  ? { system: options.systemPrompt }
                  : {}),
                messages,
              },
          retry: 0,
          timeout: false,
          signal: controller.signal,
        },
      );

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        for await (const data of readSse(response)) {
          if (data === "[DONE]") break;
          const json = parseJson(data);
          if (json === null) continue;
          for (const chunk of textChunks(extractStreamText(json, openAi)))
            yield chunk;
        }
      } else {
        const json: unknown = await response.json();
        const text = extractResponseText(json, openAi);
        if (text === null) {
          throw new ApiProviderRequestError("服务商返回了无法识别的响应格式");
        }
        for (const chunk of textChunks(text)) yield chunk;
      }
      for (const chunk of finishChunks()) yield chunk;
    } catch (error) {
      if (controller.signal.aborted) {
        for (const chunk of finishChunks()) yield chunk;
      } else if (error instanceof HTTPError) {
        yield {
          type:
            error.response.status === 401 || error.response.status === 403
              ? "auth-error"
              : "error",
          errorText: statusMessage(error.response.status),
        };
        for (const chunk of finishChunks()) yield chunk;
      } else if (error instanceof Error) {
        yield { type: "error", errorText: `服务商请求失败：${error.message}` };
        for (const chunk of finishChunks()) yield chunk;
      } else {
        throw error;
      }
    } finally {
      this.activeSessions.delete(options.subChatId);
    }
  }

  cancel(subChatId: string): void {
    this.activeSessions.get(subChatId)?.abort();
    this.activeSessions.delete(subChatId);
  }

  isActive(subChatId: string): boolean {
    return this.activeSessions.has(subChatId);
  }
}
