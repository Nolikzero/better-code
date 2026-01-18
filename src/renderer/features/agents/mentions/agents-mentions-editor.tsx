"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "../../../lib/utils";
import { LARGE_TEXT_THRESHOLD } from "./constants";
import {
  buildContentFromSerialized,
  createMentionNode,
  resolveMention,
  serializeContent,
  walkTreeOnce,
} from "./editor";
import type {
  AgentsMentionsEditorHandle,
  FileMentionOption,
  TriggerPayload,
} from "./types";

// Re-export types and constants for backward compatibility

type AgentsMentionsEditorProps = {
  // UNCONTROLLED: no value/onChange - use ref methods instead
  initialValue?: string; // optional initial content
  onTrigger: (payload: TriggerPayload) => void;
  onCloseTrigger: () => void;
  onSlashTrigger?: (payload: TriggerPayload) => void; // Slash command trigger
  onCloseSlashTrigger?: () => void; // Close slash command dropdown
  onContentChange?: (hasContent: boolean) => void; // lightweight callback for send button state
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
  disabled?: boolean;
  onPaste?: (e: React.ClipboardEvent) => void;
  onShiftTab?: () => void; // callback for Shift+Tab (e.g., mode switching)
  onFocus?: () => void;
  onBlur?: () => void;
};

// Memoized to prevent re-renders when parent re-renders
export const AgentsMentionsEditor = memo(
  forwardRef<AgentsMentionsEditorHandle, AgentsMentionsEditorProps>(
    function AgentsMentionsEditor(
      {
        initialValue,
        onTrigger,
        onCloseTrigger,
        onSlashTrigger,
        onCloseSlashTrigger,
        onContentChange,
        placeholder,
        className,
        onSubmit,
        disabled,
        onPaste,
        onShiftTab,
        onFocus,
        onBlur,
      },
      ref,
    ) {
      const editorRef = useRef<HTMLDivElement>(null);
      const triggerActive = useRef(false);
      const triggerStartIndex = useRef<number | null>(null);
      // Slash command trigger state
      const slashTriggerActive = useRef(false);
      const slashTriggerStartIndex = useRef<number | null>(null);
      // Track if editor has content for placeholder (updated via DOM, no React state)
      const [hasContent, setHasContent] = useState(false);

      // Initialize editor with initialValue on mount
      useEffect(() => {
        if (editorRef.current && initialValue) {
          buildContentFromSerialized(
            editorRef.current,
            initialValue,
            resolveMention,
          );
          setHasContent(!!initialValue);
        }
      }, []); // Only on mount

      // Handle selection changes to highlight mention chips
      useEffect(() => {
        const handleSelectionChange = () => {
          if (!editorRef.current) return;

          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) {
            // Clear all highlights when no selection
            const mentions =
              editorRef.current.querySelectorAll("[data-mention-id]");
            mentions.forEach((mention) => {
              const mentionEl = mention as HTMLElement;
              mentionEl.classList.remove("mention-selected");
            });
            return;
          }

          const range = selection.getRangeAt(0);

          // Check if selection is within our editor
          const commonAncestor = range.commonAncestorContainer;
          const isInEditor = editorRef.current.contains(
            commonAncestor.nodeType === Node.ELEMENT_NODE
              ? commonAncestor
              : commonAncestor.parentElement,
          );

          if (!isInEditor) return;

          // Get all mention chips
          const mentions =
            editorRef.current.querySelectorAll("[data-mention-id]");

          mentions.forEach((mention) => {
            const mentionEl = mention as HTMLElement;

            // Check if mention is within selection range
            if (range.intersectsNode(mentionEl)) {
              mentionEl.classList.add("mention-selected");
            } else {
              mentionEl.classList.remove("mention-selected");
            }
          });
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () => {
          document.removeEventListener(
            "selectionchange",
            handleSelectionChange,
          );
        };
      }, []);

      // Trigger detection timeout ref for cleanup
      const triggerDetectionTimeout = useRef<ReturnType<
        typeof setTimeout
      > | null>(null);

      // Handle input - UNCONTROLLED: no onChange, just @ and / trigger detection
      const handleInput = useCallback(() => {
        if (!editorRef.current) return;

        // Update placeholder visibility and notify parent IMMEDIATELY (cheap operation)
        // Use textContent without trim() so placeholder hides even with just spaces
        const content = editorRef.current.textContent || "";
        const newHasContent = !!content;
        setHasContent(newHasContent);
        onContentChange?.(newHasContent);

        // Skip expensive trigger detection for very large text
        // This prevents UI freeze when pasting large content
        if (content.length > LARGE_TEXT_THRESHOLD) {
          // Close any open triggers since we can't detect them
          if (triggerActive.current) {
            triggerActive.current = false;
            triggerStartIndex.current = null;
            onCloseTrigger();
          }
          if (slashTriggerActive.current) {
            slashTriggerActive.current = false;
            slashTriggerStartIndex.current = null;
            onCloseSlashTrigger?.();
          }
          return;
        }

        // Clear previous timeout
        if (triggerDetectionTimeout.current) {
          clearTimeout(triggerDetectionTimeout.current);
        }

        // For short content, run trigger detection immediately
        // For longer content, debounce to avoid performance issues
        const runTriggerDetection = () => {
          if (!editorRef.current) return;

          // Get selection for cursor position
          const sel = window.getSelection();
          const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;

          // Handle non-collapsed selection (close triggers)
          if (range && !range.collapsed) {
            if (triggerActive.current) {
              triggerActive.current = false;
              triggerStartIndex.current = null;
              onCloseTrigger();
            }
            if (slashTriggerActive.current) {
              slashTriggerActive.current = false;
              slashTriggerStartIndex.current = null;
              onCloseSlashTrigger?.();
            }
            return;
          }

          // Single tree walk for @ and / trigger detection
          const {
            textBeforeCursor,
            atPosition,
            atIndex,
            slashPosition,
            slashIndex,
          } = walkTreeOnce(editorRef.current, range);

          // Handle @ trigger (takes priority over /)
          if (atIndex !== -1 && atPosition) {
            triggerActive.current = true;
            triggerStartIndex.current = atIndex;

            // Close slash trigger if active
            if (slashTriggerActive.current) {
              slashTriggerActive.current = false;
              slashTriggerStartIndex.current = null;
              onCloseSlashTrigger?.();
            }

            const afterAt = textBeforeCursor.slice(atIndex + 1);

            // Get position for dropdown
            if (atPosition.node.nodeType === Node.TEXT_NODE) {
              const tempRange = document.createRange();
              tempRange.setStart(atPosition.node, atPosition.offset);
              tempRange.setEnd(atPosition.node, atPosition.offset + 1);
              const rect = tempRange.getBoundingClientRect();
              onTrigger({ searchText: afterAt, rect });
              return;
            }
          }

          // Close @ trigger if no @ found
          if (triggerActive.current) {
            triggerActive.current = false;
            triggerStartIndex.current = null;
            onCloseTrigger();
          }

          // Handle / trigger (only if @ trigger is not active)
          if (slashIndex !== -1 && slashPosition && onSlashTrigger) {
            slashTriggerActive.current = true;
            slashTriggerStartIndex.current = slashIndex;

            const afterSlash = textBeforeCursor.slice(slashIndex + 1);

            // Get position for dropdown
            if (slashPosition.node.nodeType === Node.TEXT_NODE) {
              const tempRange = document.createRange();
              tempRange.setStart(slashPosition.node, slashPosition.offset);
              tempRange.setEnd(slashPosition.node, slashPosition.offset + 1);
              const rect = tempRange.getBoundingClientRect();
              onSlashTrigger({ searchText: afterSlash, rect });
              return;
            }
          }

          // Close / trigger if no / found
          if (slashTriggerActive.current) {
            slashTriggerActive.current = false;
            slashTriggerStartIndex.current = null;
            onCloseSlashTrigger?.();
          }
        };

        // Run immediately for short content, debounce for longer
        if (content.length < 1000) {
          runTriggerDetection();
        } else {
          triggerDetectionTimeout.current = setTimeout(runTriggerDetection, 16);
        }
      }, [
        onContentChange,
        onTrigger,
        onCloseTrigger,
        onSlashTrigger,
        onCloseSlashTrigger,
      ]);

      // Cleanup timeout on unmount
      useEffect(() => {
        return () => {
          if (triggerDetectionTimeout.current) {
            clearTimeout(triggerDetectionTimeout.current);
          }
        };
      }, []);

      // Handle keydown
      const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
          if (e.key === "Enter" && !e.shiftKey) {
            if (triggerActive.current || slashTriggerActive.current) {
              // Let dropdown handle Enter
              return;
            }
            e.preventDefault();
            onSubmit?.();
          }
          if (e.key === "Escape") {
            // Close mention dropdown
            if (triggerActive.current) {
              e.preventDefault();
              triggerActive.current = false;
              triggerStartIndex.current = null;
              onCloseTrigger();
              return;
            }
            // Close command dropdown
            if (slashTriggerActive.current) {
              e.preventDefault();
              slashTriggerActive.current = false;
              slashTriggerStartIndex.current = null;
              onCloseSlashTrigger?.();
              return;
            }
            // If no dropdown is open, blur the editor (but don't prevent default
            // to allow other handlers like multi-select clear to run)
            editorRef.current?.blur();
          }
          if (e.key === "Tab" && e.shiftKey) {
            e.preventDefault();
            onShiftTab?.();
          }
        },
        [onSubmit, onCloseTrigger, onCloseSlashTrigger, onShiftTab],
      );

      // Expose methods via ref (UNCONTROLLED pattern)
      useImperativeHandle(
        ref,
        () => ({
          focus: () => {
            const editor = editorRef.current;
            if (!editor) return;

            editor.focus();

            // Always ensure cursor is visible at end
            const sel = window.getSelection();
            if (sel && sel.rangeCount === 0) {
              sel.selectAllChildren(editor);
              sel.collapseToEnd();
            }
          },

          blur: () => {
            const editor = editorRef.current;
            if (!editor) return;
            editor.blur();
          },

          // Get serialized value with @[id] tokens
          getValue: () => {
            if (!editorRef.current) return "";
            return serializeContent(editorRef.current);
          },

          // Set content from serialized string
          setValue: (value: string) => {
            if (!editorRef.current) return;
            buildContentFromSerialized(
              editorRef.current,
              value,
              resolveMention,
            );
            const newHasContent = !!value;
            setHasContent(newHasContent);
            onContentChange?.(newHasContent);

            // Position cursor at the end of content
            if (newHasContent) {
              const sel = window.getSelection();
              if (sel) {
                sel.selectAllChildren(editorRef.current);
                sel.collapseToEnd();
              }
            }
          },

          // Clear editor content
          clear: () => {
            if (!editorRef.current) return;
            editorRef.current.innerHTML = "";
            setHasContent(false);
            onContentChange?.(false);
            triggerActive.current = false;
            triggerStartIndex.current = null;
            slashTriggerActive.current = false;
            slashTriggerStartIndex.current = null;
          },

          // Clear slash command text after selection (removes /command from input)
          clearSlashCommand: () => {
            if (!editorRef.current || slashTriggerStartIndex.current === null)
              return;

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) {
              // Fallback: clear entire editor if we can't find the range
              editorRef.current.innerHTML = "";
              setHasContent(false);
              onContentChange?.(false);
              slashTriggerActive.current = false;
              slashTriggerStartIndex.current = null;
              onCloseSlashTrigger?.();
              return;
            }

            const range = sel.getRangeAt(0);
            const node = range.startContainer;

            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent || "";
              // Find local position of / within this text node
              let localSlashPosition: number | null = null;
              let serializedCharCount = 0;

              const walker = document.createTreeWalker(
                editorRef.current,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
              );
              let walkNode: Node | null = walker.nextNode();

              while (walkNode) {
                if (walkNode === node) {
                  localSlashPosition =
                    slashTriggerStartIndex.current! - serializedCharCount;
                  break;
                }

                if (walkNode.nodeType === Node.TEXT_NODE) {
                  serializedCharCount += (walkNode.textContent || "").length;
                } else if (walkNode.nodeType === Node.ELEMENT_NODE) {
                  const el = walkNode as HTMLElement;
                  if (el.hasAttribute("data-mention-id")) {
                    const id = el.getAttribute("data-mention-id") || "";
                    serializedCharCount += `@[${id}]`.length;
                    const next: Node | null = el.nextSibling;
                    if (next) {
                      walker.currentNode = next;
                      walkNode = next;
                      continue;
                    }
                  }
                }
                walkNode = walker.nextNode();
              }

              // Only proceed if we found the slash position
              if (localSlashPosition === null || localSlashPosition < 0) {
                // Node not found in tree walk - just close the trigger without modifying text
                slashTriggerActive.current = false;
                slashTriggerStartIndex.current = null;
                onCloseSlashTrigger?.();
                return;
              }

              // Remove from / to cursor
              const beforeSlash = text.slice(0, localSlashPosition);
              const afterCursor = text.slice(range.startOffset);
              node.textContent = beforeSlash + afterCursor;

              // Move cursor to where / was
              const newRange = document.createRange();
              newRange.setStart(node, localSlashPosition);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);

              // Update hasContent
              const newContent = editorRef.current.textContent;
              setHasContent(!!newContent);
              onContentChange?.(!!newContent);
            }

            // Close trigger
            slashTriggerActive.current = false;
            slashTriggerStartIndex.current = null;
            onCloseSlashTrigger?.();
          },

          insertMention: (option: FileMentionOption) => {
            if (!editorRef.current) return;

            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;

            const range = sel.getRangeAt(0);
            const node = range.startContainer;

            // Remove @ and search text
            if (
              node.nodeType === Node.TEXT_NODE &&
              triggerStartIndex.current !== null
            ) {
              const text = node.textContent || "";

              // Find local position of @ within THIS text node
              let localAtPosition = 0;
              let serializedCharCount = 0;

              const walker = document.createTreeWalker(
                editorRef.current,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
              );
              let walkNode: Node | null = walker.nextNode();

              while (walkNode) {
                if (walkNode === node) {
                  localAtPosition =
                    triggerStartIndex.current - serializedCharCount;
                  break;
                }

                if (walkNode.nodeType === Node.TEXT_NODE) {
                  serializedCharCount += (walkNode.textContent || "").length;
                } else if (walkNode.nodeType === Node.ELEMENT_NODE) {
                  const el = walkNode as HTMLElement;
                  if (el.hasAttribute("data-mention-id")) {
                    const id = el.getAttribute("data-mention-id") || "";
                    serializedCharCount += `@[${id}]`.length;
                    const next: Node | null = el.nextSibling;
                    if (next) {
                      walker.currentNode = next;
                      walkNode = next;
                      continue;
                    }
                  }
                }
                walkNode = walker.nextNode();
              }

              const beforeAt = text.slice(0, localAtPosition);
              const afterCursor = text.slice(range.startOffset);
              node.textContent = beforeAt + afterCursor;

              // Insert mention node
              const mentionNode = createMentionNode(option);
              const newRange = document.createRange();
              newRange.setStart(node, localAtPosition);
              newRange.collapse(true);
              newRange.insertNode(mentionNode);

              // Add space after and move cursor
              const space = document.createTextNode(" ");
              mentionNode.after(space);
              newRange.setStartAfter(space);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);

              // Update hasContent
              setHasContent(true);
            }

            // Close trigger
            triggerActive.current = false;
            triggerStartIndex.current = null;
            onCloseTrigger();
          },
        }),
        [onCloseTrigger, onCloseSlashTrigger, onContentChange],
      );

      return (
        <div className="relative">
          {!hasContent && placeholder && (
            <div className="pointer-events-none absolute left-1 top-1 text-sm text-muted-foreground/60 whitespace-pre-wrap">
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            spellCheck={false}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            onFocus={onFocus}
            onBlur={onBlur}
            className={cn(
              "min-h-[24px] outline-hidden whitespace-pre-wrap break-words text-sm relative",
              disabled && "opacity-50 cursor-not-allowed",
              className,
            )}
          />
        </div>
      );
    },
  ),
);
