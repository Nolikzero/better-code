/**
 * OpenCode Provider
 *
 * Multi-provider AI integration via OpenCode server.
 * Supports dynamic model fetching from multiple AI backends
 * (Anthropic, OpenAI, Google, etc.)
 */

export {
  fetchModels,
  fetchProviders,
  getAuthStatus,
  getClient,
  invalidateModelsCache,
  setProviderAuth,
} from "./client";
export { buildOpenCodeEnv, getOpenCodeBinaryPath } from "./env";
export { OpenCodeProvider } from "./provider";
export { getServerInstance, OpenCodeServer } from "./server";
export { createOpenCodeTransformer } from "./transform";
export type {
  OpenCodeBinaryResult,
  ServerState,
  ServerStatus,
} from "./types";
