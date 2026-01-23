import { getActiveCombo } from "./matcher";
import type { KeyCombo, PlatformKeybinding } from "./types";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Convert a KeyCombo to display key names for rendering.
 * Returns an array of key display strings like ["cmd", "N"] or ["ctrl", "shift", "P"].
 */
export function keyComboToDisplayKeys(combo: KeyCombo): string[] {
  const keys: string[] = [];

  if (combo.ctrl) keys.push("ctrl");
  if (combo.alt) keys.push("opt");
  if (combo.shift) keys.push("shift");
  if (combo.meta) keys.push("cmd");

  // Format the main key for display
  const displayKey = formatKeyForDisplay(combo.key);
  keys.push(displayKey);

  return keys;
}

/**
 * Format a key value for display (uppercase letters, symbols, special key names).
 */
function formatKeyForDisplay(key: string): string {
  // Special key display names
  const specialKeys: Record<string, string> = {
    Escape: "Esc",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };

  if (specialKeys[key]) return specialKeys[key];

  // Single letters: uppercase
  if (key.length === 1 && /[a-z]/i.test(key)) {
    return key.toUpperCase();
  }

  return key;
}

/**
 * Get all display key arrays for a binding on the current platform.
 * Returns multiple if the binding has alternate combos (e.g., Esc or Ctrl+C).
 */
export function bindingToDisplayKeys(binding: PlatformKeybinding): string[][] {
  const combos = getActiveCombo(binding);
  return combos.map(keyComboToDisplayKeys);
}

/**
 * Convert a KeyCombo to a human-readable string (e.g., "Cmd+N", "Ctrl+Shift+P").
 */
export function keyComboToString(combo: KeyCombo): string {
  const parts: string[] = [];

  if (combo.ctrl) parts.push(isMac ? "Ctrl" : "Ctrl");
  if (combo.alt) parts.push(isMac ? "Opt" : "Alt");
  if (combo.shift) parts.push("Shift");
  if (combo.meta) parts.push(isMac ? "Cmd" : "Win");

  parts.push(formatKeyForDisplay(combo.key));

  return parts.join("+");
}

/**
 * Get the primary display string for a binding (first combo only).
 */
export function bindingToString(binding: PlatformKeybinding): string {
  const combos = getActiveCombo(binding);
  if (combos.length === 0) return "";
  return keyComboToString(combos[0]);
}
