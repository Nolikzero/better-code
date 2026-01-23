// Re-export shared types for backward compatibility
export type {
  AuthStatus,
  ProviderConfig,
  ProviderId,
  ProviderSpecificConfig,
  ProviderStatus,
} from "@shared/types";

// Re-export message types

// Import types needed for local interfaces
import type {
  AgentMode,
  ApprovalPolicy,
  AuthStatus,
  ImageAttachment,
  ProviderConfig,
  ProviderId,
  ProviderSpecificConfig,
  ReasoningEffort,
  SandboxMode,
  UIMessageChunk,
  WebSearchMode,
} from "@shared/types";

// Chat session options (provider-agnostic, main-process specific due to AbortController)
export interface ChatSessionOptions {
  subChatId: string;
  chatId: string;
  prompt: string;
  cwd: string;
  projectPath?: string;
  mode: AgentMode;
  sessionId?: string;
  model?: string;
  maxThinkingTokens?: number;
  images?: ImageAttachment[];
  abortController: AbortController;
  // Additional working directories (for /add-dir command)
  addDirs?: string[];
  // Callbacks (router → provider communication)
  onAskUserQuestion?: (
    toolUseId: string,
    questions: unknown[],
  ) => Promise<{
    approved: boolean;
    message?: string;
    updatedInput?: unknown;
  }>;
  onFileChanged?: (
    filePath: string,
    toolType: string,
    subChatId: string,
  ) => void;
  onStderr?: (data: string) => void;
  // Claude-specific options (ignored by other providers)
  mcpServers?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  // Codex-specific options
  sandboxMode?: SandboxMode;
  approvalPolicy?: ApprovalPolicy;
  reasoningEffort?: ReasoningEffort;
  // Codex SDK enhancement options
  outputSchema?: Record<string, unknown>;
  networkAccessEnabled?: boolean;
  webSearchMode?: WebSearchMode;
  // OpenCode-specific: persisted diff keys for deduplication across turns
  emittedDiffKeys?: string[];
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
