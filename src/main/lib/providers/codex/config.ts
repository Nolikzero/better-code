import type { CodexOptions } from "@openai/codex-sdk";

export function buildCodexConfig(
  systemPrompt: string | undefined,
): CodexOptions["config"] {
  if (!systemPrompt) return undefined;
  return { developer_instructions: systemPrompt };
}
