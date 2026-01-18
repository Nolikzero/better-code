// Types
export type {
  FileMentionOption,
  TriggerPayload,
  SlashTriggerPayload,
  AgentsMentionsEditorHandle,
} from "./types";

// Constants
export {
  MENTION_PREFIXES,
  LARGE_TEXT_THRESHOLD,
  CATEGORY_OPTIONS,
} from "./constants";

// UI Components
export { FolderTree, MentionTooltipContent } from "./components";

// Icon utilities
export {
  getFileIconByExtension,
  createFileIconElement,
  getOptionIcon,
  FolderOpenIcon,
} from "./icons";

// Utils
export {
  formatToolName,
  matchesMultiWordSearch,
  sortFilesByRelevance,
} from "./utils";

// Editor utilities
export {
  resolveMention,
  createMentionNode,
  serializeContent,
  buildContentFromSerialized,
  walkTreeOnce,
} from "./editor";
export type { TreeWalkResult } from "./editor";

// Components
export { AgentsMentionsEditor } from "./agents-mentions-editor";
export { AgentsFileMention } from "./agents-file-mention";

// Render utilities
export {
  useRenderFileMentions,
  RenderFileMentions,
  extractFileMentions,
  hasFileMentions,
} from "./render-file-mentions";
