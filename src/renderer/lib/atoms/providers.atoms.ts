import type {
  ApprovalPolicy,
  ProviderId,
  ReasoningEffort,
  SandboxMode,
} from "@shared/types";
import { atomWithStorage } from "jotai/utils";

// Re-export types from shared for convenience
export type {
  ProviderId,
  SandboxMode,
  ApprovalPolicy,
  ReasoningEffort,
} from "@shared/types";

// Re-export constants from shared
export {
  PROVIDER_MODELS,
  PROVIDER_INFO,
  SANDBOX_MODES,
  APPROVAL_POLICIES,
  REASONING_EFFORTS,
} from "@shared/constants";

// ============================================
// PROVIDER CONFIG TYPE (UI-specific)
// ============================================

// Provider configuration (for display in UI, includes runtime availability)
export type ProviderConfigUI = {
  id: ProviderId;
  name: string;
  description: string;
  available: boolean;
  authStatus: {
    authenticated: boolean;
    method?: "oauth" | "api-key";
  };
};

// ============================================
// PROVIDER SELECTION ATOMS
// ============================================

// Global default provider (persisted to localStorage)
export const defaultProviderIdAtom = atomWithStorage<ProviderId>(
  "preferences:default-provider",
  "claude", // Default to Claude
  undefined,
  { getOnInit: true },
);

// Per-chat provider overrides (chatId -> providerId)
// When a chat has an override, it uses that provider instead of the default
export const chatProviderOverridesAtom = atomWithStorage<
  Record<string, ProviderId>
>("agents:chatProviderOverrides", {}, undefined, { getOnInit: true });

// Model selection per provider (providerId -> modelId)
// Each provider has its own last selected model
export const lastSelectedModelByProviderAtom = atomWithStorage<
  Record<ProviderId, string>
>(
  "agents:lastSelectedModelByProvider",
  {
    claude: "sonnet",
    codex: "gpt-5.2-codex",
  },
  undefined,
  { getOnInit: true },
);

// ============================================
// CODEX-SPECIFIC SETTINGS
// ============================================

export const codexSandboxModeAtom = atomWithStorage<SandboxMode>(
  "codex:sandbox-mode",
  "workspace-write", // Default: safe workspace modifications
  undefined,
  { getOnInit: true },
);

export const codexApprovalPolicyAtom = atomWithStorage<ApprovalPolicy>(
  "codex:approval-policy",
  "untrusted", // Default: auto-approve safe commands
  undefined,
  { getOnInit: true },
);

export const codexReasoningEffortAtom = atomWithStorage<ReasoningEffort>(
  "codex:reasoning-effort",
  "medium", // Default: balanced
  undefined,
  { getOnInit: true },
);
