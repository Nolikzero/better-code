/**
 * Centralized types for diff statistics and file change tracking.
 * Used by both main process and renderer across the application.
 */

/**
 * Core statistics interface for additions/deletions.
 * Base type used by all diff-related types.
 */
export interface DiffStats {
  additions: number;
  deletions: number;
}

/**
 * Extended statistics with file count.
 * Used when tracking changes across multiple files.
 */
export interface FileStats extends DiffStats {
  fileCount: number;
}

/**
 * UI-oriented diff stats with loading and state indicators.
 * Used by React components that display diff information.
 */
export interface DiffStatsUI extends FileStats {
  isLoading: boolean;
  hasChanges: boolean;
}

/**
 * Per-file change tracking for tool-based file modifications.
 * Tracks files changed by Edit/Write tool calls in chat messages.
 */
export interface FileChange extends DiffStats {
  /** Full file path (may include sandbox/workspace prefixes) */
  filePath: string;
  /** Display-friendly relative path (prefixes removed) */
  displayPath: string;
}

/**
 * Parsed file from unified diff output.
 * Represents a single file's changes within a git diff.
 */
export interface ParsedDiffFile extends DiffStats {
  /** Unique key for React rendering (typically oldPath->newPath) */
  key: string;
  /** Original file path (before rename/move) */
  oldPath: string;
  /** New file path (after rename/move, or same as oldPath) */
  newPath: string;
  /** Raw unified diff text for this file */
  diffText: string;
  /** Whether this is a binary file (no text diff available) */
  isBinary: boolean;
  /** Whether the diff format is valid and parseable */
  isValid: boolean;
}
