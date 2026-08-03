import type { ApiProviderProtocol } from "@shared/types";

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export function buildChatUrl(
  baseUrl: string,
  protocol: ApiProviderProtocol,
): string {
  const normalized = trimTrailingSlashes(baseUrl.trim());
  if (protocol === "openai-compatible") {
    if (normalized.endsWith("/chat/completions")) return normalized;
    return normalized.endsWith("/v1")
      ? `${normalized}/chat/completions`
      : `${normalized}/v1/chat/completions`;
  }

  if (normalized.endsWith("/messages")) return normalized;
  return normalized.endsWith("/v1")
    ? `${normalized}/messages`
    : `${normalized}/v1/messages`;
}

export function buildModelsUrl(baseUrl: string): string {
  const normalized = trimTrailingSlashes(baseUrl.trim())
    .replace(/\/chat\/completions$/, "")
    .replace(/\/messages$/, "");
  return normalized.endsWith("/v1")
    ? `${normalized}/models`
    : `${normalized}/v1/models`;
}
