import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ============================================
// DESKTOP/FULLSCREEN STATE ATOMS
// ============================================

// Whether app is running in Electron desktop environment
export const isDesktopAtom = atom<boolean>(false);

// Fullscreen state - null means not initialized yet
// null = not yet loaded, false = not fullscreen, true = fullscreen
export const isFullscreenAtom = atom<boolean | null>(null);

// ============================================
// UPDATE ATOMS
// ============================================

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export type UpdateState = {
  status: UpdateStatus;
  version?: string;
  progress?: number; // 0-100
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
};

export const updateStateAtom = atom<UpdateState>({ status: "idle" });

// Track if app was just updated (to show "What's New" banner)
// This is set to true when app launches with a new version, reset when user dismisses
export const justUpdatedAtom = atom<boolean>(false);

// Store the version that triggered the "just updated" state
export const justUpdatedVersionAtom = atom<string | null>(null);

// Legacy atom for backwards compatibility (deprecated)
export type UpdateInfo = {
  version: string;
  downloadUrl: string;
  releaseNotes?: string;
};

export const updateInfoAtom = atom<UpdateInfo | null>(null);

// ============================================
// ONBOARDING ATOMS
// ============================================

// Whether user has completed onboarding (provider selection)
// Reset on logout
export const onboardingCompletedAtom = atomWithStorage<boolean>(
  "onboarding:completed",
  false,
  undefined,
  { getOnInit: true },
);

// ============================================
// TEAM ATOMS
// ============================================

export const selectedTeamIdAtom = atomWithStorage<string | null>(
  "agents:selectedTeamId",
  null,
  undefined,
  { getOnInit: true },
);

export const createTeamDialogOpenAtom = atom<boolean>(false);
