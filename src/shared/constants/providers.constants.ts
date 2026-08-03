import type {
  ApprovalPolicy,
  ProviderId,
  ReasoningEffort,
  SandboxMode,
} from "../types";

// Provider model definitions
// Note: OpenCode models are fetched dynamically from the server
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
      id: "gpt-5.3-codex",
      name: "gpt-5.3-codex",
      displayName: "GPT-5.3 Codex",
    },
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
  // OpenCode models are dynamic - fetched from server at runtime
  opencode: [],
  grok: [{ id: "grok-4.5", name: "grok-4.5", displayName: "Grok 4.5" }],
};

// Provider display info
export const PROVIDER_INFO: Record<
  ProviderId,
  { name: string; description: string }
> = {
  claude: {
    name: "Claude Code",
    description: "Anthropic 推出的 AI 编程助手",
  },
  codex: {
    name: "OpenAI Codex",
    description: "OpenAI 推出的 Codex CLI 编程助手",
  },
  opencode: {
    name: "OpenCode",
    description: "支持 Anthropic、OpenAI、Google 等多家模型的 AI 编程助手",
  },
  grok: {
    name: "Grok Build",
    description: "xAI 推出的 Grok Build 编程智能体",
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
    name: "只读",
    description: "可以读取文件，但不能进行任何修改",
  },
  {
    id: "workspace-write",
    name: "工作区写入",
    description: "可以修改项目目录内的文件",
  },
  {
    id: "danger-full-access",
    name: "完全访问",
    description: "不受限制地访问系统（请谨慎使用）",
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
    name: "从不询问（完全自主）",
    description: "执行所有命令时均不询问",
  },
  {
    id: "on-request",
    name: "按需询问",
    description: "明确要求时或遇到高风险命令时询问",
  },
  {
    id: "untrusted",
    name: "不受信任",
    description: "自动批准安全命令，涉及状态变更时询问",
  },
  {
    id: "on-failure",
    name: "失败时询问",
    description: "保持自主运行，直到命令执行失败",
  },
];

// Reasoning effort options (Codex)
export const REASONING_EFFORTS: {
  id: ReasoningEffort;
  name: string;
  description: string;
}[] = [
  { id: "none", name: "无", description: "不进行额外推理" },
  { id: "minimal", name: "极简", description: "进行极少量推理" },
  { id: "low", name: "低", description: "轻量推理，响应更快" },
  {
    id: "medium",
    name: "中",
    description: "平衡推理深度与响应速度",
  },
  {
    id: "high",
    name: "高",
    description: "针对复杂任务进行更深入的推理",
  },
  {
    id: "xhigh",
    name: "最高",
    description: "使用最深推理（响应最慢）",
  },
];
