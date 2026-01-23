import { normalizeEventKey } from "./normalize";
import type { KeyCombo } from "./types";

/**
 * Capture a KeyCombo from a KeyboardEvent.
 * Returns null if only modifier keys are pressed (waiting for a non-modifier key).
 */
export function captureKeyCombo(e: KeyboardEvent): KeyCombo | null {
  // Ignore standalone modifier presses
  if (
    ["Control", "Meta", "Alt", "Shift"].includes(e.key) ||
    [
      "ControlLeft",
      "ControlRight",
      "MetaLeft",
      "MetaRight",
      "AltLeft",
      "AltRight",
      "ShiftLeft",
      "ShiftRight",
    ].includes(e.code)
  ) {
    return null;
  }

  return {
    key: normalizeEventKey(e),
    meta: e.metaKey || undefined,
    ctrl: e.ctrlKey || undefined,
    alt: e.altKey || undefined,
    shift: e.shiftKey || undefined,
  };
}
