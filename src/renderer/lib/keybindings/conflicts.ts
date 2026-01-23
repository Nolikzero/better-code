import { getActiveCombo } from "./matcher";
import type {
  KeybindingContext,
  KeyCombo,
  PlatformKeybinding,
  ResolvedKeybinding,
} from "./types";

export interface ConflictResult {
  conflictingId: string;
  conflictingLabel: string;
}

/**
 * Check if two KeyCombos are equivalent.
 */
function combosEqual(a: KeyCombo, b: KeyCombo): boolean {
  return (
    a.key.toLowerCase() === b.key.toLowerCase() &&
    (a.meta ?? false) === (b.meta ?? false) &&
    (a.ctrl ?? false) === (b.ctrl ?? false) &&
    (a.alt ?? false) === (b.alt ?? false) &&
    (a.shift ?? false) === (b.shift ?? false)
  );
}

/**
 * Check if two sets of contexts can overlap (i.e., both could be active simultaneously).
 */
function contextsOverlap(
  a: KeybindingContext[],
  b: KeybindingContext[],
): boolean {
  // "global" overlaps with everything
  if (a.includes("global") || b.includes("global")) return true;

  // Check for direct overlap
  return a.some((ctx) => b.includes(ctx));
}

/**
 * Check if two platform bindings have any overlapping combos on the current platform.
 */
function bindingsOverlap(
  a: PlatformKeybinding,
  b: PlatformKeybinding,
): boolean {
  const aCombos = getActiveCombo(a);
  const bCombos = getActiveCombo(b);

  for (const ac of aCombos) {
    for (const bc of bCombos) {
      if (combosEqual(ac, bc)) return true;
    }
  }

  return false;
}

/**
 * Detect conflicts between a new binding and all existing bindings.
 * Only reports conflicts where contexts overlap (two bindings with non-overlapping
 * contexts using the same key combo are fine).
 */
export function detectConflicts(
  newBinding: PlatformKeybinding,
  targetId: string,
  allBindings: ResolvedKeybinding[],
  targetContexts: KeybindingContext[],
): ConflictResult[] {
  const conflicts: ConflictResult[] = [];

  for (const existing of allBindings) {
    if (existing.id === targetId) continue;
    if (!bindingsOverlap(newBinding, existing.binding)) continue;
    if (!contextsOverlap(targetContexts, existing.contexts)) continue;

    conflicts.push({
      conflictingId: existing.id,
      conflictingLabel: existing.label,
    });
  }

  return conflicts;
}
