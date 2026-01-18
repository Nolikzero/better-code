import type { FileMentionOption } from "./types";

/**
 * Constants for the mentions system
 */

/**
 * Prefixes for different mention types in serialized format
 * e.g., file:owner/repo:path/to/file.tsx
 */
export const MENTION_PREFIXES = {
  FILE: "file:",
  FOLDER: "folder:",
  SKILL: "skill:",
  AGENT: "agent:",
  TOOL: "tool:", // MCP tools
} as const;

/**
 * Threshold for skipping expensive trigger detection (characters)
 * When content exceeds this, @ and / trigger detection is disabled
 */
export const LARGE_TEXT_THRESHOLD = 50000;

/**
 * Category navigation options (shown on root view of mention dropdown)
 */
export const CATEGORY_OPTIONS: FileMentionOption[] = [
  {
    id: "files",
    label: "Files & Folders",
    type: "category",
    path: "",
    repository: "",
  },
  { id: "skills", label: "Skills", type: "category", path: "", repository: "" },
  { id: "agents", label: "Agents", type: "category", path: "", repository: "" },
  {
    id: "tools",
    label: "MCP Tools",
    type: "category",
    path: "",
    repository: "",
  },
];
