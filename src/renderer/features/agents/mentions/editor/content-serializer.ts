import type { FileMentionOption } from "../types";
import { createMentionNode } from "./mention-node";
import { resolveMention } from "./mention-resolver";

/**
 * Append text to element (no styling in input, ultrathink only in sent messages)
 */
function appendText(root: HTMLElement, text: string) {
  if (text) {
    root.appendChild(document.createTextNode(text));
  }
}

/**
 * Serialize DOM to text with @[id] tokens
 * Converts contentEditable content to serialized format for storage/transmission
 */
export function serializeContent(root: HTMLElement): string {
  let result = "";
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
      node = walker.nextNode();
      continue;
    }
    const el = node as HTMLElement;
    // Handle <br> elements as newlines
    if (el.tagName === "BR") {
      result += "\n";
      node = walker.nextNode();
      continue;
    }
    // Handle <div> elements (some browsers wrap lines in divs)
    if (el.tagName === "DIV" && el !== root) {
      // Add newline before div content (if not at start)
      if (result.length > 0 && !result.endsWith("\n")) {
        result += "\n";
      }
      node = walker.nextNode();
      continue;
    }
    // Handle ultrathink styled nodes
    if (el.hasAttribute("data-ultrathink")) {
      result += el.textContent || "";
      // Skip subtree
      const next: Node | null = el.nextSibling;
      if (next) {
        walker.currentNode = next;
        node = next;
        continue;
      }
      let parent: Node | null = el.parentNode;
      while (parent && !parent.nextSibling) parent = parent.parentNode;
      if (parent?.nextSibling) {
        walker.currentNode = parent.nextSibling;
        node = parent.nextSibling;
      } else {
        node = null;
      }
      continue;
    }
    if (el.hasAttribute("data-mention-id")) {
      const id = el.getAttribute("data-mention-id") || "";
      result += `@[${id}]`;
      // Skip subtree
      const next: Node | null = el.nextSibling;
      if (next) {
        walker.currentNode = next;
        node = next;
        continue;
      }
      let parent: Node | null = el.parentNode;
      while (parent && !parent.nextSibling) parent = parent.parentNode;
      if (parent?.nextSibling) {
        walker.currentNode = parent.nextSibling;
        node = parent.nextSibling;
      } else {
        node = null;
      }
      continue;
    }
    node = walker.nextNode();
  }
  return result;
}

/**
 * Build DOM from serialized text
 * Reconstructs contentEditable content from serialized format
 */
export function buildContentFromSerialized(
  root: HTMLElement,
  serialized: string,
  customResolveMention?: (id: string) => FileMentionOption | null,
) {
  // Clear safely
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }

  const regex = /@\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(serialized)) !== null) {
    // Text before mention
    if (match.index > lastIndex) {
      appendText(root, serialized.slice(lastIndex, match.index));
    }
    const id = match[1];
    // Try custom resolver first, then fall back to default
    let option: FileMentionOption | null = null;
    if (customResolveMention) {
      option = customResolveMention(id);
    }
    if (!option) {
      option = resolveMention(id);
    }

    if (option) {
      root.appendChild(createMentionNode(option));
      root.appendChild(document.createTextNode(" "));
    } else {
      // Fallback: just show the id
      root.appendChild(document.createTextNode(`@[${id}]`));
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < serialized.length) {
    appendText(root, serialized.slice(lastIndex));
  }
}
