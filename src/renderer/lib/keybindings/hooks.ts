import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { resolvedKeybindingsAtom } from "./atoms";
import { matchesBinding } from "./matcher";

export interface UseKeybindingListenerOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Hook that listens for a specific keybinding ID and fires a callback.
 * Reads the current binding from the resolved registry so customizations are respected.
 * Uses a ref for the handler to avoid re-registering the listener on handler changes.
 */
export function useKeybindingListener(
  bindingId: string,
  handler: (e: KeyboardEvent) => void,
  options: UseKeybindingListenerOptions = {},
): void {
  const { enabled = true, preventDefault = true } = options;
  const resolved = useAtomValue(resolvedKeybindingsAtom);

  const binding = resolved.find((b) => b.id === bindingId);

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !binding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if input is focused and binding doesn't allow it
      if (!binding.allowInInput) {
        const target = e.target as HTMLElement;
        const isInInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          !!target.closest('[contenteditable="true"]');

        if (isInInput) return;
      }

      if (matchesBinding(e, binding.binding)) {
        if (preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        handlerRef.current(e);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, binding, preventDefault]);
}

/**
 * Hook that returns the resolved binding for a given ID.
 * Useful when you need to read the current key combo without adding a listener.
 */
export function useKeybinding(bindingId: string) {
  const resolved = useAtomValue(resolvedKeybindingsAtom);
  return resolved.find((b) => b.id === bindingId) ?? null;
}
