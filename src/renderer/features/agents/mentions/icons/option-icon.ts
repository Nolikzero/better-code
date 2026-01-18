/**
 * Option icon utilities for mention dropdown
 */

import {
  CustomAgentIcon,
  FilesIcon,
  OriginalMCPIcon,
  SkillIcon,
} from "../../../../components/ui/icons";
import { getFileIconByExtension } from "./file-icons";
import { FolderOpenIcon } from "./folder-icon";

/**
 * Category icon component - returns appropriate icon for category type
 */
function CategoryIcon({
  className,
  categoryId,
}: {
  className?: string;
  categoryId: string;
}) {
  if (categoryId === "files") {
    return FilesIcon({ className });
  }
  if (categoryId === "skills") {
    return SkillIcon({ className });
  }
  if (categoryId === "agents") {
    return CustomAgentIcon({ className });
  }
  if (categoryId === "tools") {
    // Override size to h-3.5 w-3.5 for better visibility
    const sizeClass =
      className?.replace(/h-3\b/, "h-3.5").replace(/w-3\b/, "w-3.5") ||
      className;
    return OriginalMCPIcon({ className: sizeClass });
  }
  return FilesIcon({ className });
}

/**
 * Tool icon component (MCP icon) - slightly larger for visibility
 */
function ToolIcon({ className }: { className?: string }) {
  // Override size to h-3.5 w-3.5 for better visibility
  const sizeClass =
    className?.replace(/h-3\b/, "h-3.5").replace(/w-3\b/, "w-3.5") || className;
  return OriginalMCPIcon({ className: sizeClass });
}

/**
 * Get icon component for a file, folder, skill, agent, tool, or category option
 */
export function getOptionIcon(option: {
  id?: string;
  label: string;
  type?: "file" | "folder" | "skill" | "agent" | "category" | "tool";
}) {
  if (option.type === "category") {
    // Return a wrapper component for categories
    return function CategoryIconWrapper({ className }: { className?: string }) {
      return CategoryIcon({ className, categoryId: option.id || "" });
    };
  }
  if (option.type === "skill") {
    return SkillIcon;
  }
  if (option.type === "agent") {
    return CustomAgentIcon;
  }
  if (option.type === "tool") {
    return ToolIcon;
  }
  if (option.type === "folder") {
    return FolderOpenIcon;
  }
  return getFileIconByExtension(option.label) ?? FilesIcon;
}
