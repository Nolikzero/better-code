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

// Provider-specific configuration (MCP for Claude, sandbox for Codex)
export interface ProviderSpecificConfig {
  mcpServers?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  skills?: string[];
}
