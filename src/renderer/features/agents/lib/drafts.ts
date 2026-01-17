import { useState, useEffect } from "react"

// Constants
export const DRAFTS_STORAGE_KEY = "agent-drafts-global"
export const DRAFT_ID_PREFIX = "draft-"
export const DRAFTS_CHANGE_EVENT = "drafts-changed"

// Types
export interface DraftContent {
  text: string
  updatedAt: number
}

export interface DraftProject {
  id: string
  name: string
  path: string
  gitOwner?: string | null
  gitRepo?: string | null
  gitProvider?: string | null
}

export interface NewChatDraft {
  id: string
  text: string
  updatedAt: number
  project?: DraftProject
  isVisible?: boolean // Only show in sidebar when user navigates away from the form
}

// SubChatDraft uses key format: "chatId:subChatId"
export type SubChatDraft = DraftContent

// Raw drafts from localStorage (mixed format)
type GlobalDraftsRaw = Record<string, DraftContent | NewChatDraft>

// Emit custom event when drafts change (for same-tab sync)
export function emitDraftsChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(DRAFTS_CHANGE_EVENT))
}

// Load all drafts from localStorage
export function loadGlobalDrafts(): GlobalDraftsRaw {
  if (typeof window === "undefined") return {}
  try {
    const stored = localStorage.getItem(DRAFTS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Save all drafts to localStorage
export function saveGlobalDrafts(drafts: GlobalDraftsRaw): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts))
    emitDraftsChanged()
  } catch {
    // Ignore localStorage errors
  }
}

// Generate a new draft ID
export function generateDraftId(): string {
  return `${DRAFT_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Check if a key is a new chat draft (starts with draft-)
export function isNewChatDraftKey(key: string): boolean {
  return key.startsWith(DRAFT_ID_PREFIX)
}

// Check if a key is a sub-chat draft (contains :)
export function isSubChatDraftKey(key: string): boolean {
  return key.includes(":")
}

// Get new chat drafts as sorted array (only visible ones)
export function getNewChatDrafts(): NewChatDraft[] {
  const globalDrafts = loadGlobalDrafts()
  return Object.entries(globalDrafts)
    .filter(([key]) => isNewChatDraftKey(key))
    .map(([id, data]) => ({
      id,
      text: (data as NewChatDraft).text || "",
      updatedAt: data.updatedAt || 0,
      project: (data as NewChatDraft).project,
      isVisible: (data as NewChatDraft).isVisible,
    }))
    .filter((draft) => draft.isVisible === true)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// Save a new chat draft
export function saveNewChatDraft(
  draftId: string,
  text: string,
  project?: DraftProject
): void {
  const globalDrafts = loadGlobalDrafts()
  if (text.trim()) {
    globalDrafts[draftId] = {
      text,
      updatedAt: Date.now(),
      ...(project && { project }),
    }
  } else {
    delete globalDrafts[draftId]
  }
  saveGlobalDrafts(globalDrafts)
}

// Delete a new chat draft
export function deleteNewChatDraft(draftId: string): void {
  const globalDrafts = loadGlobalDrafts()
  delete globalDrafts[draftId]
  saveGlobalDrafts(globalDrafts)
}

// Mark a draft as visible (called when user navigates away from the form)
export function markDraftVisible(draftId: string): void {
  const globalDrafts = loadGlobalDrafts()
  if (globalDrafts[draftId]) {
    ;(globalDrafts[draftId] as NewChatDraft).isVisible = true
    saveGlobalDrafts(globalDrafts)
  }
}

// Get sub-chat draft key
export function getSubChatDraftKey(chatId: string, subChatId: string): string {
  return `${chatId}:${subChatId}`
}

// Get sub-chat draft text
export function getSubChatDraft(chatId: string, subChatId: string): string | null {
  const globalDrafts = loadGlobalDrafts()
  const key = getSubChatDraftKey(chatId, subChatId)
  const draft = globalDrafts[key] as DraftContent | undefined
  return draft?.text || null
}

// Save sub-chat draft
export function saveSubChatDraft(
  chatId: string,
  subChatId: string,
  text: string
): void {
  const globalDrafts = loadGlobalDrafts()
  const key = getSubChatDraftKey(chatId, subChatId)
  if (text.trim()) {
    globalDrafts[key] = { text, updatedAt: Date.now() }
  } else {
    delete globalDrafts[key]
  }
  saveGlobalDrafts(globalDrafts)
}

// Clear sub-chat draft
export function clearSubChatDraft(chatId: string, subChatId: string): void {
  const globalDrafts = loadGlobalDrafts()
  const key = getSubChatDraftKey(chatId, subChatId)
  delete globalDrafts[key]
  saveGlobalDrafts(globalDrafts)
}

// Build drafts cache from localStorage (for sidebar display)
export function buildDraftsCache(): Record<string, string> {
  const globalDrafts = loadGlobalDrafts()
  const cache: Record<string, string> = {}
  for (const [key, value] of Object.entries(globalDrafts)) {
    if ((value as DraftContent)?.text) {
      cache[key] = (value as DraftContent).text
    }
  }
  return cache
}

/**
 * Hook to get new chat drafts with automatic updates
 * Uses custom events for same-tab sync and storage events for cross-tab sync
 */
export function useNewChatDrafts(): NewChatDraft[] {
  const [drafts, setDrafts] = useState<NewChatDraft[]>(() => getNewChatDrafts())

  useEffect(() => {
    const handleChange = () => {
      const newDrafts = getNewChatDrafts()
      setDrafts(newDrafts)
    }

    // Listen for custom event (same-tab changes)
    window.addEventListener(DRAFTS_CHANGE_EVENT, handleChange)
    // Listen for storage event (cross-tab changes)
    window.addEventListener("storage", handleChange)

    return () => {
      window.removeEventListener(DRAFTS_CHANGE_EVENT, handleChange)
      window.removeEventListener("storage", handleChange)
    }
  }, [])

  return drafts
}

/**
 * Hook to get sub-chat drafts cache with automatic updates
 * Returns a Record<key, text> for quick lookups
 */
export function useSubChatDraftsCache(): Record<string, string> {
  const [draftsCache, setDraftsCache] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {}
    return buildDraftsCache()
  })

  useEffect(() => {
    const handleChange = () => {
      const newCache = buildDraftsCache()
      setDraftsCache(newCache)
    }

    // Listen for custom event (same-tab changes)
    window.addEventListener(DRAFTS_CHANGE_EVENT, handleChange)
    // Listen for storage event (cross-tab changes)
    window.addEventListener("storage", handleChange)

    return () => {
      window.removeEventListener(DRAFTS_CHANGE_EVENT, handleChange)
      window.removeEventListener("storage", handleChange)
    }
  }, [])

  return draftsCache
}

/**
 * Hook to get a specific sub-chat draft
 */
export function useSubChatDraft(
  parentChatId: string | null,
  subChatId: string
): string | null {
  const draftsCache = useSubChatDraftsCache()

  if (!parentChatId) return null
  const key = getSubChatDraftKey(parentChatId, subChatId)
  return draftsCache[key] || null
}

