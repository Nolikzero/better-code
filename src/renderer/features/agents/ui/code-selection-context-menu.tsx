"use client";

import { MessageSquarePlus } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "../../../components/ui/context-menu";
import type { CodeSnippet } from "../atoms";
import {
  generateSnippetId,
  getLineNumbersFromShikiSelection,
  getSelectionText,
  hasValidSelection,
} from "../lib/selection-utils";

interface CodeSelectionContextMenuProps {
  children: ReactNode;
  filePath: string;
  language: string;
  onAddToChat: (snippet: CodeSnippet) => void;
  /** Optional: use diff selection calculation instead of shiki */
  useDiffSelection?: boolean;
  /** Container ref for line number calculation */
  containerRef?: React.RefObject<HTMLElement>;
}

/**
 * Context menu wrapper for code content that enables "Add to Chat" functionality
 * when text is selected.
 */
export function CodeSelectionContextMenu({
  children,
  filePath,
  language,
  onAddToChat,
  useDiffSelection = false,
  containerRef: externalContainerRef,
}: CodeSelectionContextMenuProps) {
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const [hasSelection, setHasSelection] = useState(false);

  // Track selection state for enabling/disabling menu item
  useEffect(() => {
    const handleSelectionChange = () => {
      setHasSelection(hasValidSelection());
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  // Handle adding selection to chat
  const handleAddToChat = useCallback(() => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = getSelectionText(selection);
    if (!text) return;

    const container = containerRef.current;
    if (!container) return;

    // Get line numbers from selection
    let startLine = 1;
    let endLine = 1;

    if (!useDiffSelection) {
      const lineInfo = getLineNumbersFromShikiSelection(selection, container);
      if (lineInfo) {
        startLine = lineInfo.startLine;
        endLine = lineInfo.endLine;
      }
    }
    // Note: Diff selection handling is done separately in agent-diff-view.tsx

    const snippet: CodeSnippet = {
      id: generateSnippetId(),
      filePath,
      startLine,
      endLine,
      content: text,
      language,
    };

    onAddToChat(snippet);

    // Clear selection after adding
    selection.removeAllRanges();
  }, [filePath, language, onAddToChat, containerRef, useDiffSelection]);

  // Keyboard shortcut: Cmd+Shift+A
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + A
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "a"
      ) {
        if (hasValidSelection()) {
          e.preventDefault();
          handleAddToChat();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleAddToChat]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={internalContainerRef as React.RefObject<HTMLDivElement>}
          className="flex-1 flex flex-col min-h-0"
        >
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem
          onClick={handleAddToChat}
          disabled={!hasSelection}
          className="gap-2"
        >
          <MessageSquarePlus className="size-4" />
          <span>Add to Chat</span>
          <ContextMenuShortcut>
            {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Shift+A
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
