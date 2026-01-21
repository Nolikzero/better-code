/**
 * Unified diff parser utilities.
 * Parses git diff output into per-file blocks with statistics.
 */

import type { FileStats, ParsedDiffFile } from "../types/diff-stats.types";

/**
 * Validate if a diff hunk has valid structure.
 * This is a lenient validator - only rejects clearly malformed diffs.
 */
export function validateDiffHunk(diffText: string): {
  valid: boolean;
  reason?: string;
} {
  if (!diffText || diffText.trim().length === 0) {
    return { valid: false, reason: "empty diff" };
  }

  const lines = diffText.split("\n");
  const hunkHeaderRegex = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/;

  // Find the --- and +++ lines
  const minusLineIdx = lines.findIndex((l) => l.startsWith("--- "));
  const plusLineIdx = lines.findIndex((l) => l.startsWith("+++ "));

  // Must have both header lines
  if (minusLineIdx === -1 || plusLineIdx === -1) {
    return { valid: false, reason: "missing header lines" };
  }

  // +++ must come after ---
  if (plusLineIdx <= minusLineIdx) {
    return { valid: false, reason: "header order wrong" };
  }

  // Check for special cases that don't have hunks
  if (
    diffText.includes("new mode") ||
    diffText.includes("old mode") ||
    diffText.includes("rename from") ||
    diffText.includes("rename to") ||
    diffText.includes("Binary files")
  ) {
    return { valid: true };
  }

  // Must have at least one hunk header after +++ line
  let hasHunk = false;
  for (let i = plusLineIdx + 1; i < lines.length; i++) {
    if (hunkHeaderRegex.test(lines[i]!)) {
      hasHunk = true;
      break;
    }
  }

  if (!hasHunk) {
    return { valid: false, reason: "no hunk headers found" };
  }

  // Trust the diff format - the DiffView library will handle parsing
  return { valid: true };
}

/**
 * Parse unified diff text into per-file blocks with statistics.
 * Counts additions/deletions only inside hunk content (after @@).
 */
export function parseUnifiedDiff(diffText: string): ParsedDiffFile[] {
  const normalized = diffText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const blocks: string[] = [];
  let current: string[] = [];

  const pushCurrent = () => {
    const text = current.join("\n").trim();
    if (
      text &&
      (text.startsWith("diff --git ") ||
        text.startsWith("--- ") ||
        text.startsWith("+++ ") ||
        text.startsWith("Binary files ") ||
        text.includes("\n+++ ") ||
        text.includes("\nBinary files "))
    ) {
      blocks.push(text);
    }
    current = [];
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ") && current.length > 0) {
      pushCurrent();
    }
    current.push(line);
  }
  pushCurrent();

  return blocks.map((blockText, index) => {
    const blockLines = blockText.split("\n");
    let oldPath = "";
    let newPath = "";
    let isBinary = false;
    let additions = 0;
    let deletions = 0;
    let insideHunk = false;

    for (const line of blockLines) {
      if (line.startsWith("Binary files ") && line.endsWith(" differ")) {
        isBinary = true;
      }

      if (line.startsWith("--- ")) {
        const raw = line.slice(4).trim();
        oldPath = raw.startsWith("a/") ? raw.slice(2) : raw;
        insideHunk = false;
        continue;
      }

      if (line.startsWith("+++ ")) {
        const raw = line.slice(4).trim();
        newPath = raw.startsWith("b/") ? raw.slice(2) : raw;
        insideHunk = false;
        continue;
      }

      // Hunk header marks the start of actual diff content
      if (line.startsWith("@@")) {
        insideHunk = true;
        continue;
      }

      // Metadata lines reset hunk state
      if (
        line.startsWith("diff --git") ||
        line.startsWith("index ") ||
        line.startsWith("new file mode") ||
        line.startsWith("deleted file mode") ||
        line.startsWith("old mode") ||
        line.startsWith("new mode")
      ) {
        insideHunk = false;
        continue;
      }

      // Only count additions/deletions inside hunks
      if (insideHunk) {
        if (line.startsWith("+")) {
          additions += 1;
        } else if (line.startsWith("-")) {
          deletions += 1;
        }
      }
    }

    const key = oldPath || newPath ? `${oldPath}->${newPath}` : `file-${index}`;
    const validation = isBinary ? { valid: true } : validateDiffHunk(blockText);
    const isValid = validation.valid;

    return {
      key,
      oldPath,
      newPath,
      diffText: blockText,
      isBinary,
      additions,
      deletions,
      isValid,
    };
  });
}

/**
 * Aggregate statistics from parsed diff files.
 */
export function aggregateDiffStats(files: ParsedDiffFile[]): FileStats {
  let additions = 0;
  let deletions = 0;

  for (const file of files) {
    additions += file.additions;
    deletions += file.deletions;
  }

  return {
    additions,
    deletions,
    fileCount: files.length,
  };
}
