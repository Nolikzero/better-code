import type { UIMessageChunk } from "../claude/types";

// Provider identification
export type ProviderId = "claude" | "codex";

// Codex-specific types
export type SandboxMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";
export type ApprovalPolicy =
  | "never"
  | "on-request"
  | "untrusted"
  | "on-failure";
export type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

// Model definition
export interface ProviderModel {
  id: string;
  name: string;
  displayName: string;
}

// Provider configuration
export interface ProviderConfig {
  id: ProviderId;
  name: string;
  description: string;
  models: ProviderModel[];
  authType: "oauth" | "api-key" | "both";
  binaryName?: string;
}

// Image attachment for multimodal input
export interface ImageAttachment {
  base64Data: string;
  mediaType: string;
  filename?: string;
}

// Chat session options (provider-agnostic)
export interface ChatSessionOptions {
  subChatId: string;
  chatId: string;
  prompt: string;
  cwd: string;
  projectPath?: string;
  mode: "plan" | "agent";
  sessionId?: string;
  model?: string;
  maxThinkingTokens?: number;
  images?: ImageAttachment[];
  abortController: AbortController;
  // Codex-specific options
  sandboxMode?: SandboxMode;
  approvalPolicy?: ApprovalPolicy;
  reasoningEffort?: ReasoningEffort;
}

// Authentication status
export interface AuthStatus {
  authenticated: boolean;
  method?: "oauth" | "api-key";
  error?: string;
}

// Provider status (runtime)
export interface ProviderStatus {
  config: ProviderConfig;
  available: boolean;
  authStatus: AuthStatus;
}

// Provider interface - must be implemented by all providers
export interface AIProvider {
  readonly id: ProviderId;
  readonly config: ProviderConfig;

  /**
   * Check if provider is available (binary installed, SDK accessible)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get authentication status
   */
  getAuthStatus(): Promise<AuthStatus>;

  /**
   * Start a chat session, returns async generator of UIMessageChunk
   */
  chat(
    options: ChatSessionOptions,
  ): AsyncGenerator<UIMessageChunk, void, unknown>;

  /**
   * Cancel an active session
   */
  cancel(subChatId: string): void;

  /**
   * Check if a session is currently active
   */
  isActive(subChatId: string): boolean;

  /**
   * Respond to a tool approval request (for AskUserQuestion)
   */
  respondToolApproval?(
    toolUseId: string,
    decision: { approved: boolean; message?: string; updatedInput?: unknown },
  ): void;
}
