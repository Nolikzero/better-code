// Provider identification
export type ProviderId = string;

export const API_PROVIDER_PROTOCOLS = [
  "openai-compatible",
  "anthropic-compatible",
] as const;
export type ApiProviderProtocol = (typeof API_PROVIDER_PROTOCOLS)[number];

// Agent mode - determines how the AI operates
export type AgentMode = "plan" | "agent" | "ralph";

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

export type WebSearchMode = "disabled" | "cached" | "live";

// Model definition
export interface ProviderModel {
  id: string;
  name: string;
  displayName: string;
}

// Provider configuration
export interface ProviderConfig {
  readonly id: ProviderId;
  readonly name: string;
  readonly description: string;
  readonly models: ProviderModel[];
  readonly authType: "oauth" | "api-key" | "both";
  readonly binaryName?: string;
}

export type ApiProviderSettings = {
  readonly id: ProviderId;
  readonly name: string;
  readonly protocol: ApiProviderProtocol;
  readonly baseUrl: string;
  readonly models: ProviderModel[];
  readonly contextWindow: number;
  readonly enabled: boolean;
  readonly hasApiKey: boolean;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
};

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
