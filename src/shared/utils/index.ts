// Types from centralized types module
export type {
  DiffStats,
  DiffStatsUI,
  FileChange,
  FileStats,
  ParsedDiffFile,
} from "../types/diff-stats.types";
// Unified diff parsing
export {
  aggregateDiffStats,
  parseUnifiedDiff,
  validateDiffHunk,
} from "./diff-parser";
// Text comparison utilities
export {
  calculateDiffStats,
  computeFileStatsFromMessages,
  type Message,
  type MessagePart,
} from "./diff-stats";
// File path utilities
export {
  getDirectory,
  getFileName,
  isSessionFile,
  normalizePath,
  toDisplayPath,
} from "./file-path";
export { formatTimeAgo } from "./format-time-ago";
export { pluralize } from "./pluralize";
