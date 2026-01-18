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

// Codex-specific types (re-export for convenience)
export type {
  SandboxMode,
  ApprovalPolicy,
  ReasoningEffort,
} from "./types";

// Registry
export { ProviderRegistry, providerRegistry } from "./registry";

// Claude provider
export { ClaudeProvider, type ClaudeSessionOptions } from "./claude";
export type {
  UIMessageChunk,
  MessageMetadata,
  MCPServer,
  MCPServerStatus,
} from "./claude/types";

// Codex provider
export { CodexProvider, type CodexSessionOptions } from "./codex";
