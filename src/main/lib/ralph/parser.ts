/**
 * Ralph response parsing utilities
 *
 * Parses AI responses for progress blocks, commit information,
 * and other structured data used by Ralph automation.
 */

export interface ParsedProgress {
  storyId: string | null;
  summary: string;
  filesChanged: string[];
  learnings: string[];
}

export interface ParsedCommit {
  hash: string;
  message: string;
  storyId: string | null;
}

/**
 * Parse a progress report block from AI response text
 *
 * Expected format:
 * ```
 * ## Progress Report - US-001
 *
 * **What was implemented:**
 * - Item 1
 * - Item 2
 *
 * **Files changed:**
 * - file1.ts
 * - file2.ts
 *
 * **Learnings for future iterations:**
 * - Learning 1
 * - Learning 2
 * ```
 */
export function parseProgressBlock(text: string): ParsedProgress | null {
  // Match progress report header with optional story ID
  const headerMatch = text.match(
    /##\s*Progress Report(?:\s*[-–—]\s*([A-Z]+-\d+))?/i,
  );
  if (!headerMatch) {
    return null;
  }

  const storyId = headerMatch[1] || null;

  // Extract "What was implemented" section
  const implementedMatch = text.match(
    /\*\*What was implemented[:*]*\*?\*?\n((?:[-*]\s*.+\n?)+)/i,
  );
  const summary = implementedMatch
    ? implementedMatch[1]
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
        .join("; ")
    : "";

  // Extract "Files changed" section
  const filesMatch = text.match(
    /\*\*Files changed[:*]*\*?\*?\n((?:[-*]\s*.+\n?)+)/i,
  );
  const filesChanged = filesMatch
    ? filesMatch[1]
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
    : [];

  // Extract "Learnings" section
  const learningsMatch = text.match(
    /\*\*Learnings[^:]*[:*]*\*?\*?\n((?:[-*]\s*.+\n?)+)/i,
  );
  const learnings = learningsMatch
    ? learningsMatch[1]
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
    : [];

  return {
    storyId,
    summary,
    filesChanged,
    learnings,
  };
}

/**
 * Parse git commit output from Bash tool execution
 *
 * Looks for patterns like:
 * - `[main abc1234] feat: [US-001] - Story title`
 * - `[abc1234] feat: [US-001] - Story title`
 * - `create mode 100644 ...` followed by commit hash
 *
 * Also handles git log output format:
 * - `abc1234 feat: [US-001] - Story title`
 */
export function parseCommitOutput(toolOutput: string): ParsedCommit | null {
  // Pattern 1: Git commit output format [branch hash] message
  const commitMatch = toolOutput.match(
    /\[(?:[^\]]+\s+)?([a-f0-9]{7,40})\]\s+(.*)/i,
  );
  if (commitMatch) {
    const hash = commitMatch[1];
    const message = commitMatch[2].trim();
    const storyId = extractStoryId(message);
    return { hash, message, storyId };
  }

  // Pattern 2: Git log short format: hash message
  const logMatch = toolOutput.match(/^([a-f0-9]{7,40})\s+(feat:\s*\[.+)/im);
  if (logMatch) {
    const hash = logMatch[1];
    const message = logMatch[2].trim();
    const storyId = extractStoryId(message);
    return { hash, message, storyId };
  }

  // Pattern 3: Look for "Successfully committed" or similar with hash
  const successMatch = toolOutput.match(
    /commit(?:ted)?[:\s]+([a-f0-9]{7,40})/i,
  );
  if (successMatch) {
    const hash = successMatch[1];
    // Try to find the commit message nearby
    const messageMatch = toolOutput.match(/feat:\s*\[[^\]]+\][^\n]*/i);
    const message = messageMatch ? messageMatch[0].trim() : "";
    const storyId = extractStoryId(message);
    return { hash, message, storyId };
  }

  return null;
}

/**
 * Extract story ID from a commit message
 * Expected format: "feat: [US-001] - Story Title"
 */
function extractStoryId(message: string): string | null {
  const match = message.match(/feat:\s*\[([^\]]+)\]/i);
  return match ? match[1] : null;
}

/**
 * Check if Bash tool output contains a git commit operation
 */
export function isGitCommitOutput(toolOutput: string): boolean {
  return (
    /\[(?:[^\]]+\s+)?[a-f0-9]{7,40}\]/.test(toolOutput) ||
    /commit(?:ted)?[:\s]+[a-f0-9]{7,40}/i.test(toolOutput) ||
    /create mode \d+\s+/.test(toolOutput)
  );
}
