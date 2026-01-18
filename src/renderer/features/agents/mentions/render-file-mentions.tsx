"use client";

import { useMemo } from "react";
import {
  CustomAgentIcon,
  FilesIcon,
  OriginalMCPIcon,
  SkillIcon,
} from "../../../components/ui/icons";
import { MENTION_PREFIXES } from "./constants";
import { FolderOpenIcon, getFileIconByExtension } from "./icons";

interface ParsedMention {
  id: string;
  label: string;
  path: string;
  repository: string;
  type: "file" | "folder" | "skill" | "agent" | "tool";
}

/**
 * Parse file/folder/skill/agent/tool mention ID into its components
 * Format: file:owner/repo:path/to/file.tsx or folder:owner/repo:path/to/folder or skill:skill-name or agent:agent-name or tool:mcp__server__toolname
 */
function parseMention(id: string): ParsedMention | null {
  const isFile = id.startsWith(MENTION_PREFIXES.FILE);
  const isFolder = id.startsWith(MENTION_PREFIXES.FOLDER);
  const isSkill = id.startsWith(MENTION_PREFIXES.SKILL);
  const isAgent = id.startsWith(MENTION_PREFIXES.AGENT);
  const isTool = id.startsWith(MENTION_PREFIXES.TOOL);

  if (!isFile && !isFolder && !isSkill && !isAgent && !isTool) return null;

  // Handle skill mentions (simpler format: skill:name)
  if (isSkill) {
    const skillName = id.slice(MENTION_PREFIXES.SKILL.length);
    return {
      id,
      label: skillName,
      path: "",
      repository: "",
      type: "skill",
    };
  }

  // Handle agent mentions (simpler format: agent:name)
  if (isAgent) {
    const agentName = id.slice(MENTION_PREFIXES.AGENT.length);
    return {
      id,
      label: agentName,
      path: "",
      repository: "",
      type: "agent",
    };
  }

  // Handle tool mentions (format: tool:mcp__servername__toolname)
  if (isTool) {
    const toolPath = id.slice(MENTION_PREFIXES.TOOL.length);
    // Extract readable name from tool path (e.g., mcp__figma__get_design -> Get design)
    const parts = toolPath.split("__");
    const toolName = parts.length >= 3 ? parts.slice(2).join("__") : toolPath;
    const displayName = toolName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    return {
      id,
      label: displayName,
      path: toolPath,
      repository: "",
      type: "tool",
    };
  }

  const parts = id.split(":");
  if (parts.length < 3) return null;

  const type = parts[0] as "file" | "folder";
  const repository = parts[1];
  const path = parts.slice(2).join(":"); // Handle paths with colons
  const name = path.split("/").pop() || path;

  return {
    id,
    label: name,
    path,
    repository,
    type,
  };
}

/**
 * Component to render a single file/folder/skill/agent/tool mention chip (matching canvas style)
 */
function MentionChip({ mention }: { mention: ParsedMention }) {
  const Icon =
    mention.type === "skill"
      ? SkillIcon
      : mention.type === "agent"
        ? CustomAgentIcon
        : mention.type === "tool"
          ? OriginalMCPIcon
          : mention.type === "folder"
            ? FolderOpenIcon
            : getFileIconByExtension(mention.label) ?? FilesIcon;

  const title =
    mention.type === "skill"
      ? `Skill: ${mention.label}`
      : mention.type === "agent"
        ? `Agent: ${mention.label}`
        : mention.type === "tool"
          ? `MCP Tool: ${mention.path}`
          : `${mention.repository}:${mention.path}`;

  return (
    <span
      className="inline-flex items-center gap-1 px-[6px] rounded-sm text-sm align-middle bg-black/[0.04] dark:bg-white/[0.08] text-foreground/80 select-none"
      title={title}
    >
      <Icon
        className={
          mention.type === "tool"
            ? "h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
            : "h-3 w-3 text-muted-foreground flex-shrink-0"
        }
      />
      <span>{mention.label}</span>
    </span>
  );
}

/**
 * Render text with ultrathink highlighting
 */
function renderTextWithUltrathink(text: string): React.ReactNode {
  const parts = text.split(/(ultrathink)/gi);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part.toLowerCase() === "ultrathink") {
      return (
        <span key={index} className="chroma-text chroma-text-animate">
          {part}
        </span>
      );
    }
    return part;
  });
}

/**
 * Hook to render text with file/folder mentions and ultrathink highlighting
 * Returns array of React nodes with mentions rendered as chips
 */
function useRenderFileMentions(text: string): React.ReactNode[] {
  return useMemo(() => {
    const nodes: React.ReactNode[] = [];
    const regex = /@\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
      // Add text before mention (with ultrathink highlighting)
      if (match.index > lastIndex) {
        nodes.push(
          <span key={`text-${key++}`}>
            {renderTextWithUltrathink(text.slice(lastIndex, match.index))}
          </span>,
        );
      }

      const id = match[1];
      const mention = parseMention(id);

      if (mention) {
        nodes.push(<MentionChip key={`mention-${key++}`} mention={mention} />);
      } else {
        // Fallback: show as plain text if not a valid mention
        nodes.push(<span key={`unknown-${key++}`}>{match[0]}</span>);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text (with ultrathink highlighting)
    if (lastIndex < text.length) {
      nodes.push(
        <span key={`text-end-${key}`}>
          {renderTextWithUltrathink(text.slice(lastIndex))}
        </span>,
      );
    }

    return nodes;
  }, [text]);
}

/**
 * Component to render text with file mentions
 */
export function RenderFileMentions({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes = useRenderFileMentions(text);
  return <span className={className}>{nodes}</span>;
}

/**
 * Extract all file/folder mentions from text
 * Returns array of parsed mentions
 */
function extractFileMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const regex = /@\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const mention = parseMention(match[1]);
    if (mention) {
      mentions.push(mention);
    }
  }

  return mentions;
}

/**
 * Check if text contains any file, folder, skill, agent, or tool mentions
 */
function hasFileMentions(text: string): boolean {
  return /@\[(file|folder|skill|agent|tool):[^\]]+\]/.test(text);
}
