/**
 * Slash command types for agent chat
 */

type SlashCommandCategory = "builtin" | "repository";

interface SlashCommand {
  id: string;
  name: string; // Display name without slash, e.g. "clear", "help"
  description: string;
  category: SlashCommandCategory;
  // For repository commands - the prompt content from .md file
  prompt?: string;
  // For repository commands - path to the .md file
  path?: string;
  // For repository commands - the repository name
  repository?: string;
}

export interface SlashCommandOption extends SlashCommand {
  // Full command string for display, e.g. "/clear"
  command: string;
}

// Builtin command action handlers
export type BuiltinCommandAction =
  | { type: "clear" }
  | { type: "plan" }
  | { type: "agent" }
  | { type: "ralph" }
  | { type: "compact" }
  | { type: "add-dir" }
  // Prompt-based commands (send to agent)
  | { type: "review" }
  | { type: "pr-comments" }
  | { type: "release-notes" }
  | { type: "security-review" };
