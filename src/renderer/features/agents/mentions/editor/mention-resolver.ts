import { MENTION_PREFIXES } from "../constants";
import type { FileMentionOption } from "../types";
import { formatToolName } from "../utils";

/**
 * Resolve mention from ID string to FileMentionOption
 * Handles file, folder, skill, agent, and tool mention formats
 */
export function resolveMention(id: string): FileMentionOption | null {
  // File or folder mention: file:repo:path or folder:repo:path
  if (
    id.startsWith(MENTION_PREFIXES.FILE) ||
    id.startsWith(MENTION_PREFIXES.FOLDER)
  ) {
    const parts = id.split(":");
    if (parts.length >= 3) {
      const type = parts[0] as "file" | "folder";
      const repo = parts[1];
      const path = parts.slice(2).join(":");
      const name = path.split("/").pop() || path;
      return { id, label: name, path, repository: repo, type };
    }
  }

  // Skill mention: skill:skill-name
  if (id.startsWith(MENTION_PREFIXES.SKILL)) {
    const skillName = id.slice(MENTION_PREFIXES.SKILL.length);
    return {
      id,
      label: skillName,
      path: "",
      repository: "",
      type: "skill",
    };
  }

  // Agent mention: agent:agent-name
  if (id.startsWith(MENTION_PREFIXES.AGENT)) {
    const agentName = id.slice(MENTION_PREFIXES.AGENT.length);
    return {
      id,
      label: agentName,
      path: "",
      repository: "",
      type: "agent",
    };
  }

  // Tool mention: tool:mcp__servername__toolname
  if (id.startsWith(MENTION_PREFIXES.TOOL)) {
    const toolPath = id.slice(MENTION_PREFIXES.TOOL.length);
    // Extract readable name from tool path (e.g., mcp__figma__get_design -> Get design)
    const parts = toolPath.split("__");
    const toolName = parts.length >= 3 ? parts.slice(2).join("__") : toolPath;
    const displayName = formatToolName(toolName);
    return {
      id,
      label: displayName,
      path: toolPath,
      repository: "",
      type: "tool",
    };
  }

  return null;
}
