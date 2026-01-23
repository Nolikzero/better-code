import { useAtomValue } from "jotai";
import { type RefObject, useEffect, useMemo } from "react";
import { resolvedKeybindingsAtom } from "../../../lib/keybindings";
import { matchesBinding } from "../../../lib/keybindings/matcher";

/**
 * Hook to focus an input element when the focus-input keybinding is pressed
 * and no other input is currently focused.
 *
 * Reads key combo from the centralized keybindings registry.
 */
export function useFocusInputOnEnter(
  editorRef: RefObject<{ focus: () => void } | null>,
) {
  const resolved = useAtomValue(resolvedKeybindingsAtom);
  const binding = useMemo(
    () => resolved.find((b) => b.id === "agents.focus-input"),
    [resolved],
  );

  useEffect(() => {
    if (!binding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!matchesBinding(e, binding.binding)) return;

      // Don't handle if inside a dialog/modal/overlay
      const target = e.target as HTMLElement;
      const isInsideOverlay = target.closest(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-state="open"]',
      );
      if (isInsideOverlay) return;

      // Check if user is already in an input/textarea/contenteditable
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.closest('[contenteditable="true"]');

      if (isInputFocused) return;

      e.preventDefault();
      editorRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorRef, binding]);
}
