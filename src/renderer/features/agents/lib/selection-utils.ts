/**
 * Utilities for handling text selection in File View and Diff View
 * Used for the "Add selected text to chat" feature
 */

/**
 * Get the trimmed selection text from a Selection object
 */
export function getSelectionText(selection: Selection | null): string {
  if (!selection) return "";
  return selection.toString().trim();
}

/**
 * Check if there is a valid non-empty text selection
 */
export function hasValidSelection(): boolean {
  const selection = window.getSelection();
  if (!selection) return false;
  const text = selection.toString().trim();
  return text.length > 0;
}

/**
 * Get line numbers from a Shiki-rendered selection (CenterFileView)
 *
 * Shiki renders code with span.line elements, one per line.
 * CSS counters are used for line numbers, so we count by finding
 * which .line elements contain the selection.
 */
export function getLineNumbersFromShikiSelection(
  selection: Selection,
  containerEl: HTMLElement,
): { startLine: number; endLine: number } | null {
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);

  // Find all .line elements in the container
  const lineElements = containerEl.querySelectorAll(".line");
  if (lineElements.length === 0) return null;

  let startLine = -1;
  let endLine = -1;

  // Find which lines contain the selection
  for (let i = 0; i < lineElements.length; i++) {
    const lineEl = lineElements[i];

    // Check if this line intersects with the selection range
    if (range.intersectsNode(lineEl)) {
      if (startLine === -1) {
        startLine = i + 1; // 1-indexed
      }
      endLine = i + 1;
    }
  }

  if (startLine === -1 || endLine === -1) {
    // Fallback: try to find line from closest ancestor
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    const startLineEl = findClosestLineElement(startContainer, containerEl);
    const endLineEl = findClosestLineElement(endContainer, containerEl);

    if (startLineEl && endLineEl) {
      const lineArray = Array.from(lineElements);
      startLine = lineArray.indexOf(startLineEl) + 1;
      endLine = lineArray.indexOf(endLineEl) + 1;
    }
  }

  if (startLine === -1 || endLine === -1) {
    return { startLine: 1, endLine: 1 }; // Fallback
  }

  return { startLine, endLine };
}

/**
 * Find the closest .line ancestor element
 */
function findClosestLineElement(
  node: Node,
  container: HTMLElement,
): Element | null {
  let current: Node | null = node;

  while (current && current !== container) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      if (el.classList.contains("line")) {
        return el;
      }
    }
    current = current.parentNode;
  }

  return null;
}

/**
 * Get line numbers from a @pierre/diffs selection (AgentDiffView)
 *
 * The diff library creates its own DOM structure with line numbers.
 * We need to find the line numbers from the diff line elements.
 */
export function getLineNumbersFromDiffSelection(
  selection: Selection,
  containerEl: HTMLElement,
): { startLine: number; endLine: number; filePath: string | null } | null {
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);

  // Find the file path from closest data-diff-file-path attribute
  let filePath: string | null = null;
  const startContainer = range.startContainer;
  let current: Node | null = startContainer;

  while (current && current !== containerEl) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as Element;
      const path = el.getAttribute("data-diff-file-path");
      if (path) {
        filePath = path;
        break;
      }
    }
    current = current.parentNode;
  }

  // For diffs, line numbers are more complex because of added/removed lines
  // Try to find line number elements (varies by diff library structure)
  // The @pierre/diffs library uses specific class names for line numbers

  // Look for line number elements in the selection area
  const lineNumbers: number[] = [];

  // Find elements with line numbers (typically in gutter or line prefix)
  const diffLines = Array.from(
    containerEl.querySelectorAll(
      "[data-line-number], .diff-line-num, .line-num",
    ),
  );

  for (const lineEl of diffLines) {
    if (range.intersectsNode(lineEl)) {
      const lineNum =
        lineEl.getAttribute("data-line-number") || lineEl.textContent;
      if (lineNum) {
        const num = Number.parseInt(lineNum, 10);
        if (!Number.isNaN(num)) {
          lineNumbers.push(num);
        }
      }
    }
  }

  if (lineNumbers.length > 0) {
    return {
      startLine: Math.min(...lineNumbers),
      endLine: Math.max(...lineNumbers),
      filePath,
    };
  }

  // Fallback: return 1-1 with file path if we found it
  return {
    startLine: 1,
    endLine: 1,
    filePath,
  };
}

/**
 * Generate a unique ID for a code snippet
 */
export function generateSnippetId(): string {
  return `snippet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
