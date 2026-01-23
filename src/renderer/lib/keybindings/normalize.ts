/**
 * Shared key normalization for KeyboardEvents.
 * Used by both matcher (for comparison) and recorder (for capture).
 */

const CODE_MAP: Record<string, string> = {
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Tab: "Tab",
  Escape: "Escape",
  Enter: "Enter",
  Backspace: "Backspace",
  Space: " ",
  Semicolon: ";",
  Quote: "'",
  Minus: "-",
  Equal: "=",
};

/**
 * Normalize the key from a KeyboardEvent to a canonical string.
 * Uses `e.code` for letter/digit keys (layout-independent), falls back to `e.key`.
 */
export function normalizeEventKey(e: KeyboardEvent): string {
  // Use code for letter keys to be layout-independent
  if (e.code.startsWith("Key")) return e.code.slice(3).toLowerCase();
  if (e.code.startsWith("Digit")) return e.code.slice(5);

  if (CODE_MAP[e.code]) return CODE_MAP[e.code];

  // Special keys preserve their name
  if (e.key.length > 1) return e.key;

  return e.key.toLowerCase();
}
