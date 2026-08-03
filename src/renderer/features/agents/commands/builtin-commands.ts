import type { BuiltinCommandAction, SlashCommandOption } from "./types";

/**
 * Prompt texts for prompt-based slash commands
 */
export const COMMAND_PROMPTS: Partial<
  Record<BuiltinCommandAction["type"], string>
> = {
  review:
    "Please review the code in the current context and provide feedback on code quality, potential bugs, and improvements.",
  "pr-comments":
    "Generate detailed PR review comments for the changes in the current context.",
  "release-notes":
    "Generate release notes summarizing the changes in this codebase.",
  "security-review":
    "Perform a security audit of the code in the current context. Identify vulnerabilities, security risks, and suggest fixes.",
};

/**
 * Check if a command is a prompt-based command
 */
function _isPromptCommand(
  type: BuiltinCommandAction["type"],
): type is "review" | "pr-comments" | "release-notes" | "security-review" {
  return type in COMMAND_PROMPTS;
}

/**
 * Built-in slash commands that are handled client-side
 */
const BUILTIN_SLASH_COMMANDS: SlashCommandOption[] = [
  {
    id: "builtin:clear",
    name: "clear",
    command: "/clear",
    description: "开始新对话（创建新的子对话）",
    category: "builtin",
  },
  {
    id: "builtin:plan",
    name: "plan",
    command: "/plan",
    description: "切换到规划模式（修改前先创建规划）",
    category: "builtin",
  },
  {
    id: "builtin:agent",
    name: "agent",
    command: "/agent",
    description: "切换到智能体模式（直接应用更改）",
    category: "builtin",
  },
  {
    id: "builtin:ralph",
    name: "ralph",
    command: "/ralph",
    description: "切换到 Ralph 模式（由 PRD 驱动的自主开发）",
    category: "builtin",
  },
  {
    id: "builtin:compact",
    name: "compact",
    command: "/compact",
    description: "压缩对话上下文以减少 Token 使用量",
    category: "builtin",
  },
  {
    id: "builtin:add-dir",
    name: "add-dir",
    command: "/add-dir",
    description: "向上下文添加其他工作目录",
    category: "builtin",
  },
  {
    id: "builtin:goal",
    name: "goal",
    command: "/goal",
    description: "管理当前目标（创建、完成、受阻或清除）",
    category: "builtin",
  },
  // Prompt-based commands
  {
    id: "builtin:review",
    name: "review",
    command: "/review",
    description: "让智能体审查代码",
    category: "builtin",
  },
  {
    id: "builtin:pr-comments",
    name: "pr-comments",
    command: "/pr-comments",
    description: "让智能体生成 PR 审查意见",
    category: "builtin",
  },
  {
    id: "builtin:release-notes",
    name: "release-notes",
    command: "/release-notes",
    description: "让智能体生成发布说明",
    category: "builtin",
  },
  {
    id: "builtin:security-review",
    name: "security-review",
    command: "/security-review",
    description: "让智能体执行安全审计",
    category: "builtin",
  },
];

/**
 * Filter builtin commands by search text
 */
export function filterBuiltinCommands(
  searchText: string,
): SlashCommandOption[] {
  if (!searchText) return BUILTIN_SLASH_COMMANDS;

  const query = searchText.toLowerCase();
  return BUILTIN_SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query),
  );
}
