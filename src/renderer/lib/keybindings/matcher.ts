import { normalizeEventKey } from "./normalize";
import type { KeyCombo, PlatformKeybinding } from "./types";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

function isDesktop(): boolean {
  return typeof window !== "undefined" && !!window.desktopApi;
}

/**
 * Build a PlatformKeybinding that stores a combo under the correct key
 * for the current platform. This ensures overrides are resolved correctly
 * by `getActiveCombo` without relying on the mac→windows fallback swap.
 */
export function comboForCurrentPlatform(combo: KeyCombo): PlatformKeybinding {
  if (isDesktop()) return { desktop: combo };
  if (isMac) return { mac: combo };
  return { windows: combo };
}

/**
 * Get the active key combos for the current platform from a PlatformKeybinding.
 * Resolution order: desktop/web override > platform-specific > mac with Cmd↔Ctrl swap.
 */
export function getActiveCombo(binding: PlatformKeybinding): KeyCombo[] {
  const desktop = isDesktop();

  // Desktop/Web override takes priority
  if (desktop && binding.desktop) {
    return Array.isArray(binding.desktop) ? binding.desktop : [binding.desktop];
  }
  if (!desktop && binding.web) {
    return Array.isArray(binding.web) ? binding.web : [binding.web];
  }

  // Platform-specific
  if (isMac && binding.mac) {
    return Array.isArray(binding.mac) ? binding.mac : [binding.mac];
  }
  if (!isMac && binding.windows) {
    return Array.isArray(binding.windows) ? binding.windows : [binding.windows];
  }

  // Fallback: use mac binding, swap meta→ctrl for non-mac
  if (binding.mac) {
    const macCombos = Array.isArray(binding.mac) ? binding.mac : [binding.mac];
    if (!isMac) {
      return macCombos.map((combo) => ({
        ...combo,
        meta: false,
        ctrl: combo.meta || combo.ctrl,
      }));
    }
    return macCombos;
  }

  return [];
}

/**
 * Check if a KeyboardEvent matches a KeyCombo.
 */
export function matchesKeyCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  const needsMeta = combo.meta ?? false;
  const needsCtrl = combo.ctrl ?? false;
  const needsAlt = combo.alt ?? false;
  let needsShift = combo.shift ?? false;

  // "?" requires shift implicitly
  if (combo.key === "?" && !needsShift) {
    needsShift = true;
  }

  if (needsMeta !== e.metaKey) return false;
  if (needsCtrl !== e.ctrlKey) return false;
  if (needsAlt !== e.altKey) return false;
  if (needsShift !== e.shiftKey) return false;

  const eventKey = normalizeEventKey(e);
  const comboKey = combo.key.toLowerCase();

  if (eventKey === comboKey) return true;

  // Handle special cases for event.key matching
  if (comboKey === "?" && e.key === "?") return true;
  if (comboKey === "escape" && e.key === "Escape") return true;
  if (comboKey === "enter" && e.key === "Enter") return true;
  if (comboKey === "tab" && e.key === "Tab") return true;
  if (comboKey === "backspace" && e.key === "Backspace") return true;

  return false;
}

/**
 * Check if a KeyboardEvent matches any combo in a PlatformKeybinding.
 */
export function matchesBinding(
  e: KeyboardEvent,
  binding: PlatformKeybinding,
): boolean {
  const combos = getActiveCombo(binding);
  return combos.some((combo) => matchesKeyCombo(e, combo));
}
