/**
 * Provider abstraction layer
 *
 * This module provides a unified interface for different AI providers (Claude, Codex, etc.)
 * allowing the app to support multiple backends with the same UI.
 */

// Types
export type {
  ProviderId,
  ProviderModel,
  ProviderConfig,
  ImageAttachment,
  ChatSessionOptions,
  AuthStatus,
  ProviderStatus,
  AIProvider,
} from "./types";

// Registry
export { ProviderRegistry, providerRegistry } from "./registry";

// Providers
export { ClaudeProvider, type ClaudeSessionOptions } from "./claude-provider";
export { CodexProvider, type CodexSessionOptions } from "./codex-provider";
