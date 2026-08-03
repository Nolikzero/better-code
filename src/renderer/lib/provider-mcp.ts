import type { ProviderId } from "@shared/types";

export interface ProviderMcpHelp {
  readonly location: string;
  readonly description: string;
  readonly docsUrl?: string;
}

export const PROVIDER_MCP_HELP: Record<ProviderId, ProviderMcpHelp> = {
  claude: {
    location: "~/.claude.json 或项目根目录的 .mcp.json",
    description: "在 Claude Code 配置文件中添加 MCP 服务器。",
    docsUrl: "https://docs.anthropic.com/en/docs/claude-code/mcp",
  },
  codex: {
    location: "~/.codex/config.toml",
    description: "在 Codex 配置文件中添加 MCP 服务器。",
    docsUrl: "https://github.com/openai/codex#mcp-servers",
  },
  opencode: {
    location: "opencode mcp add",
    description:
      "通过 OpenCode CLI 添加 MCP 服务器；可使用 opencode mcp list 查看状态。",
  },
  grok: {
    location: "grok mcp add",
    description:
      "通过 Grok Build CLI 添加 MCP 服务器；可使用 grok mcp list 查看状态。",
  },
};

const API_PROVIDER_MCP_HELP = {
  location: "不适用",
  description: "接口服务商仅提供模型 API，不从本地 CLI 读取 MCP 配置。",
} as const satisfies ProviderMcpHelp;

export function getProviderMcpHelp(providerId: ProviderId): ProviderMcpHelp {
  return PROVIDER_MCP_HELP[providerId] ?? API_PROVIDER_MCP_HELP;
}
