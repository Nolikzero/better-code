// Re-export shared types for backward compatibility
export type {
  ProviderId,
  SandboxMode,
  ApprovalPolicy,
  ReasoningEffort,
  ProviderModel,
  ProviderConfig,
  ImageAttachment,
  AuthStatus,
  ProviderStatus,
  ProviderSpecificConfig,
} from "@shared/types";

// Re-export message types
export type {
  UIMessageChunk,
  MCPServer,
  MCPServerStatus,
  MessageMetadata,
} from "@shared/types";

// Import types needed for local interfaces
import type {
  ApprovalPolicy,
  AuthStatus,
  ImageAttachment,
  ProviderConfig,
  ProviderId,
  ProviderSpecificConfig,
  ReasoningEffort,
  SandboxMode,
} from "@shared/types";
import type { UIMessageChunk } from "@shared/types";

// Chat session options (provider-agnostic, main-process specific due to AbortController)
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

// Provider interface - must be implemented by all providers
export interface AIProvider {
  readonly id: ProviderId;
  readonly config: ProviderConfig;

  // ===== Lifecycle methods (optional) =====

  /**
   * Initialize the provider (called once during startup)
   */
  initialize?(): Promise<void>;

  /**
   * Shutdown the provider (called during app quit)
   */
  shutdown?(): Promise<void>;

  // ===== Status methods =====

  /**
   * Check if provider is available (binary installed, SDK accessible)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get authentication status
   */
  getAuthStatus(): Promise<AuthStatus>;

  /**
   * Get provider-specific configuration for a project (optional)
   * Used for MCP servers, agents, etc.
   */
  getProviderConfig?(
    projectPath: string,
  ): Promise<ProviderSpecificConfig | null>;

  // ===== Chat operations =====

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
