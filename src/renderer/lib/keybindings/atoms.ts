import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DEFAULT_KEYBINDINGS } from "./defaults";
import type { KeybindingOverrides, ResolvedKeybinding } from "./types";

/**
 * User-customized keybinding overrides stored in localStorage.
 * Keys are binding IDs (e.g., "general.settings"), values are PlatformKeybinding objects.
 */
export const keybindingOverridesAtom = atomWithStorage<KeybindingOverrides>(
  "preferences:keybinding-overrides",
  {},
  undefined,
  { getOnInit: true },
);

/**
 * Resolved keybindings: merges defaults with user overrides.
 * This is the primary atom all consumers should read from.
 */
export const resolvedKeybindingsAtom = atom<ResolvedKeybinding[]>((get) => {
  const overrides = get(keybindingOverridesAtom);

  return DEFAULT_KEYBINDINGS.map((def) => {
    const override = overrides[def.id];
    return {
      ...def,
      binding: override ?? def.defaultBinding,
      isCustomized: !!override,
    };
  });
});

/**
 * The binding ID currently being recorded in the keybindings settings tab.
 * null when not recording.
 */
export const recordingKeybindingIdAtom = atom<string | null>(null);
