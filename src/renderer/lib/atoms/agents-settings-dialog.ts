// Stub atoms for agents settings dialog
import { atom } from "jotai"

export const agentsSettingsDialogOpenAtom = atom(false)
export const agentsSettingsDialogActiveTabAtom = atom<string | null>(null)
