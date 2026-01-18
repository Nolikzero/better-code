/**
 * Combined tree walk result - computes everything in ONE pass instead of 3
 */
export interface TreeWalkResult {
  serialized: string;
  textBeforeCursor: string;
  atPosition: { node: Node; offset: number } | null;
  atIndex: number;
  // Slash command trigger info
  slashPosition: { node: Node; offset: number } | null;
  slashIndex: number;
}

/**
 * Single O(n) tree walk that computes all needed data for trigger detection
 * Handles @ and / trigger detection, cursor position tracking, and content serialization
 */
export function walkTreeOnce(
  root: HTMLElement,
  range: Range | null,
): TreeWalkResult {
  let serialized = "";
  let textBeforeCursor = "";
  let reachedCursor = false;
  let atPosition: { node: Node; offset: number } | null = null;
  let atIndex = -1;
  let slashPosition: { node: Node; offset: number } | null = null;
  let slashIndex = -1;

  // Handle case where cursor is in root element (not in a text node)
  // This happens when the editor is empty or cursor is at element boundary
  let cursorInRoot = false;
  let cursorRootOffset = 0;
  if (range && range.endContainer === root) {
    cursorInRoot = true;
    cursorRootOffset = range.endOffset;
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node: Node | null = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";

      // Check if cursor is in this node (direct case)
      const cursorInThisNode =
        range && !reachedCursor && node === range.endContainer;

      // Handle cursor in root element - cursor is positioned between children
      // cursorRootOffset indicates the child index where cursor is
      let cursorAtRootBoundary = false;
      if (cursorInRoot && !reachedCursor && node.parentNode === root) {
        const children = Array.from(root.childNodes);
        const nodeIndex = children.indexOf(node as ChildNode);
        // If cursor is after this node, include full text
        // If cursor is at this node's position, we've passed the cursor
        if (nodeIndex >= cursorRootOffset) {
          cursorAtRootBoundary = true;
        }
      }

      if (cursorInThisNode) {
        const cursorOffset = range!.endOffset;
        textBeforeCursor += text.slice(0, cursorOffset);
        reachedCursor = true;

        // Find @ in text before cursor for this node
        const textBeforeInNode = text.slice(0, cursorOffset);
        const localAtIdx = textBeforeInNode.lastIndexOf("@");
        if (localAtIdx !== -1) {
          const globalAtIdx = serialized.length + localAtIdx;

          // Check character before @ - must be start of text, whitespace, or newline (not part of email/word)
          const textUpToAt = serialized + textBeforeInNode.slice(0, localAtIdx);
          const charBefore =
            globalAtIdx > 0 ? textUpToAt.charAt(globalAtIdx - 1) : null;
          const isStandaloneAt = charBefore === null || /\s/.test(charBefore);

          // Check if this @ is the most recent one AND is standalone
          if (isStandaloneAt && globalAtIdx > atIndex) {
            const afterAt = textBeforeCursor.slice(
              textBeforeCursor.lastIndexOf("@") + 1,
            );
            // Close on newline or double-space (not single space - allow multi-word search)
            const hasNewline = afterAt.includes("\n");
            const hasDoubleSpace = afterAt.includes("  ");
            if (!hasNewline && !hasDoubleSpace) {
              atIndex = globalAtIdx;
              atPosition = { node, offset: localAtIdx };
            }
          }
        }

        // Find / at start of line (for slash commands)
        // Check all occurrences of / in this node
        for (let i = 0; i < textBeforeInNode.length; i++) {
          if (textBeforeInNode[i] === "/") {
            const globalSlashIdx = serialized.length + i;
            // / is valid only at start of text OR after newline
            const charBefore =
              globalSlashIdx === 0
                ? null
                : (serialized + textBeforeInNode.slice(0, i)).charAt(
                    globalSlashIdx - 1,
                  );
            if (charBefore === null || charBefore === "\n") {
              // Check no space between / and cursor
              const afterSlash = textBeforeCursor.slice(globalSlashIdx + 1);
              if (!afterSlash.includes(" ") && !afterSlash.includes("\n")) {
                slashIndex = globalSlashIdx;
                slashPosition = { node, offset: i };
              }
            }
          }
        }
      } else if (cursorAtRootBoundary) {
        // Cursor is in root element, at or past this node's position
        // Mark as reached and don't include this text in textBeforeCursor
        reachedCursor = true;
      } else if (!reachedCursor) {
        textBeforeCursor += text;
        // Track @ positions as we go (only if standalone - not part of email/word)
        const localAtIdx = text.lastIndexOf("@");
        if (localAtIdx !== -1) {
          const globalAtIdx = serialized.length + localAtIdx;
          // Check character before @ - must be start of text, whitespace, or newline
          const textUpToAt = serialized + text.slice(0, localAtIdx);
          const charBefore =
            globalAtIdx > 0 ? textUpToAt.charAt(globalAtIdx - 1) : null;
          const isStandaloneAt = charBefore === null || /\s/.test(charBefore);

          if (isStandaloneAt) {
            atIndex = globalAtIdx;
            atPosition = { node, offset: localAtIdx };
          }
        }
      }

      serialized += text;
      node = walker.nextNode();
      continue;
    }

    // Element node - check for ultrathink or mention
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // Handle ultrathink styled nodes
      if (el.hasAttribute("data-ultrathink")) {
        const text = el.textContent || "";
        serialized += text;
        if (!reachedCursor) {
          textBeforeCursor += text;
        }

        // Skip ultrathink subtree
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
          continue;
        }
        node = null;
        continue;
      }

      if (el.hasAttribute("data-mention-id")) {
        const id = el.getAttribute("data-mention-id") || "";
        const mentionToken = `@[${id}]`;
        serialized += mentionToken;
        if (!reachedCursor) {
          textBeforeCursor += mentionToken;
        }

        // Skip mention subtree
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
          continue;
        }
        node = null;
        continue;
      }
    }

    node = walker.nextNode();
  }

  // Validate @ trigger - close on newline or double-space (allow single spaces for multi-word search)
  if (atIndex !== -1) {
    const afterAt = textBeforeCursor.slice(atIndex + 1);
    const hasNewline = afterAt.includes("\n");
    const hasDoubleSpace = afterAt.includes("  ");
    if (hasNewline || hasDoubleSpace) {
      atIndex = -1;
      atPosition = null;
    }
  }

  // Validate / trigger - check if space/newline after it
  if (slashIndex !== -1) {
    const afterSlash = textBeforeCursor.slice(slashIndex + 1);
    if (afterSlash.includes(" ") || afterSlash.includes("\n")) {
      slashIndex = -1;
      slashPosition = null;
    }
  }

  return {
    serialized,
    textBeforeCursor,
    atPosition,
    atIndex,
    slashPosition,
    slashIndex,
  };
}
