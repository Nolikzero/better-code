import { createFileIconElement } from "../icons";
import type { FileMentionOption } from "../types";

/**
 * Create styled mention chip DOM element (matching canvas style)
 * Used by contentEditable editor to insert mention chips
 */
export function createMentionNode(option: FileMentionOption): HTMLSpanElement {
  const span = document.createElement("span");
  span.setAttribute("contenteditable", "false");
  span.setAttribute("data-mention-id", option.id);
  span.setAttribute("data-mention-type", option.type || "file");
  span.className =
    "inline-flex items-center gap-1 px-[6px] py-[1px] rounded-sm text-sm align-middle bg-black/[0.04] dark:bg-white/[0.08] text-foreground/80 [&.mention-selected]:bg-primary/70 [&.mention-selected]:text-primary-foreground";

  // Create icon element (pass type for folder icon)
  const iconElement = createFileIconElement(option.label, option.type);
  span.appendChild(iconElement);

  const label = document.createElement("span");
  label.textContent = option.label;

  span.appendChild(label);
  return span;
}
