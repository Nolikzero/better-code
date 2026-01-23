import { useAtomValue } from "jotai";
import { type RefObject, useEffect, useMemo } from "react";
import { resolvedKeybindingsAtom } from "../../../lib/keybindings";
import { matchesBinding } from "../../../lib/keybindings/matcher";

/**
 * Hook to toggle focus when the toggle-focus keybinding is pressed.
 * - If focused → blur
 * - If not focused → focus
 *
 * Reads key combo from the centralized keybindings registry.
 */
export function useToggleFocusOnCmdEsc(
  editorRef: RefObject<{ focus: () => void; blur: () => void } | null>,
) {
  const resolved = useAtomValue(resolvedKeybindingsAtom);
  const binding = useMemo(
    () => resolved.find((b) => b.id === "agents.toggle-focus"),
    [resolved],
  );

  useEffect(() => {
    if (!binding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!matchesBinding(e, binding.binding)) return;

      e.preventDefault();
      e.stopPropagation();

      const editor = editorRef.current;
      if (!editor) return;

      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        (activeElement?.hasAttribute("contenteditable") &&
          activeElement.getAttribute("contenteditable") !== "false");

      if (isInputFocused) {
        editor.blur();
      } else {
        editor.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [editorRef, binding]);
}
