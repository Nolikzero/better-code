import type {
  ApprovalPolicy,
  ProviderId,
  ReasoningEffort,
  SandboxMode,
} from "../types";

// Provider model definitions
export const PROVIDER_MODELS: Record<
  ProviderId,
  { id: string; name: string; displayName: string }[]
> = {
  claude: [
    { id: "opus", name: "opus", displayName: "Opus 4.5" },
    { id: "sonnet", name: "sonnet", displayName: "Sonnet 4.5" },
    { id: "haiku", name: "haiku", displayName: "Haiku 4.5" },
  ],
  codex: [
    {
      id: "gpt-5.2-codex",
      name: "gpt-5.2-codex",
      displayName: "GPT-5.2 Codex",
    },
    {
      id: "gpt-5.1-codex-max",
      name: "gpt-5.1-codex-max",
      displayName: "GPT-5.1 Codex Max",
    },
    {
      id: "gpt-5.1-codex-mini",
      name: "gpt-5.1-codex-mini",
      displayName: "GPT-5.1 Codex Mini",
    },
    { id: "gpt-5.2", name: "gpt-5.2", displayName: "GPT-5.2" },
  ],
};

// Provider display info
export const PROVIDER_INFO: Record<
  ProviderId,
  { name: string; description: string }
> = {
  claude: {
    name: "Claude Code",
    description: "Anthropic's Claude AI assistant for coding",
  },
  codex: {
    name: "OpenAI Codex",
    description: "OpenAI's Codex CLI for coding assistance",
  },
};

// Sandbox mode options (Codex)
export const SANDBOX_MODES: {
  id: SandboxMode;
  name: string;
  description: string;
}[] = [
  {
    id: "read-only",
    name: "Read Only",
    description: "Can read files but cannot make any modifications",
  },
  {
    id: "workspace-write",
    name: "Workspace Write",
    description: "Can modify files within the project directory",
  },
  {
    id: "danger-full-access",
    name: "Full Access",
    description: "Unrestricted system access (use with caution)",
  },
];

// Approval policy options (Codex)
export const APPROVAL_POLICIES: {
  id: ApprovalPolicy;
  name: string;
  description: string;
}[] = [
  {
    id: "never",
    name: "Never (Fully Autonomous)",
    description: "Execute all commands without asking",
  },
  {
    id: "on-request",
    name: "On Request",
    description: "Ask when explicitly requested or for risky commands",
  },
  {
    id: "untrusted",
    name: "Untrusted",
    description: "Auto-approve safe commands, ask for state-changing ones",
  },
  {
    id: "on-failure",
    name: "On Failure",
    description: "Run autonomously until a command fails",
  },
];

// Reasoning effort options (Codex)
export const REASONING_EFFORTS: {
  id: ReasoningEffort;
  name: string;
  description: string;
}[] = [
  { id: "none", name: "None", description: "No additional reasoning" },
  { id: "minimal", name: "Minimal", description: "Very light reasoning" },
  { id: "low", name: "Low", description: "Light reasoning, fast responses" },
  {
    id: "medium",
    name: "Medium",
    description: "Balanced reasoning depth and speed",
  },
  {
    id: "high",
    name: "High",
    description: "Deeper reasoning for complex tasks",
  },
  {
    id: "xhigh",
    name: "Maximum",
    description: "Maximum reasoning depth (slowest)",
  },
];
