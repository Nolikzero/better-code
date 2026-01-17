import React, { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { cn } from "../../lib/utils"
import {
  loadingSubChatsAtom,
  agentsSubChatUnseenChangesAtom,
  selectedSubChatIdsAtom,
  isSubChatMultiSelectModeAtom,
  toggleSubChatSelectionAtom,
  selectAllSubChatsAtom,
  clearSubChatSelectionAtom,
  selectedSubChatsCountAtom,
  pendingUserQuestionsAtom,
} from "../../lib/atoms"
import {
  useAgentSubChatStore,
  type SubChatMeta,
} from "../../lib/stores/sub-chat-store"
import { useShallow } from "zustand/react/shallow"
import {
  ArchiveIcon,
  IconDoubleChevronLeft,
  IconSpinner,
  PlanIcon,
  AgentIcon,
  ClockIcon,
  QuestionIcon,
} from "../../components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip"
import { Kbd } from "../../components/ui/kbd"
import { getShortcutKey } from "../../lib/utils/platform"
import { PopoverTrigger } from "../../components/ui/popover"
import { AlignJustify } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../components/ui/context-menu"
import { SearchCombobox } from "../../components/ui/search-combobox"
import { SubChatContextMenu } from "./sub-chat-context-menu"
import { formatTimeAgo } from "../../lib/utils/format-time-ago"
import { pluralize } from "../../lib/utils/pluralize"
import { RenameDialog } from "../../components/rename-dialog"
import { useSubChatDraftsCache, getSubChatDraftKey } from "../agents/lib/drafts"

interface SubChatsSidebarProps {
  onClose?: () => void
  isMobile?: boolean
  onBackToChats?: () => void
  isSidebarOpen?: boolean
  isLoading?: boolean
  agentName?: string
}

export function SubChatsSidebar({
  onClose,
  isMobile = false,
  onBackToChats,
  isSidebarOpen = false,
  isLoading = false,
  agentName,
}: SubChatsSidebarProps) {
  // Use shallow comparison to prevent re-renders when arrays have same content
  const { activeSubChatId, openSubChatIds, pinnedSubChatIds, allSubChats, parentChatId, togglePinSubChat } = useAgentSubChatStore(
    useShallow((state) => ({
      activeSubChatId: state.activeSubChatId,
      openSubChatIds: state.openSubChatIds,
      pinnedSubChatIds: state.pinnedSubChatIds,
      allSubChats: state.allSubChats,
      parentChatId: state.chatId,
      togglePinSubChat: state.togglePinSubChat,
    }))
  )
  const [loadingSubChats] = useAtom(loadingSubChatsAtom)

  const subChatUnseenChanges = useAtomValue(agentsSubChatUnseenChangesAtom)
  const setSubChatUnseenChanges = useSetAtom(agentsSubChatUnseenChangesAtom)
  const pendingQuestions = useAtomValue(pendingUserQuestionsAtom)

  const [searchQuery, setSearchQuery] = useState("")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [focusedChatIndex, setFocusedChatIndex] = useState<number>(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renamingSubChat, setRenamingSubChat] = useState<SubChatMeta | null>(
    null,
  )
  const [renameLoading, setRenameLoading] = useState(false)
  const [showTopGradient, setShowTopGradient] = useState(false)
  const [showBottomGradient, setShowBottomGradient] = useState(false)
  const [hoveredChatIndex, setHoveredChatIndex] = useState<number>(-1)

  // SubChat name tooltip state (for truncated names)
  const [subChatTooltip, setSubChatTooltip] = useState<{
    visible: boolean
    position: { top: number; left: number }
    name: string
  } | null>(null)
  const subChatNameRefs = useRef<Map<string, HTMLSpanElement>>(new Map())
  const subChatTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  // Multi-select state
  const [selectedSubChatIds, setSelectedSubChatIds] = useAtom(
    selectedSubChatIdsAtom,
  )
  const isMultiSelectMode = useAtomValue(isSubChatMultiSelectModeAtom)
  const selectedSubChatsCount = useAtomValue(selectedSubChatsCountAtom)
  const toggleSubChatSelection = useSetAtom(toggleSubChatSelectionAtom)
  const selectAllSubChats = useSetAtom(selectAllSubChatsAtom)
  const clearSubChatSelection = useSetAtom(clearSubChatSelectionAtom)

  // Map open IDs to metadata and sort by updated_at (most recent first)
  const openSubChats = useMemo(() => {
    const chats = openSubChatIds
      .map((id) => allSubChats.find((sc) => sc.id === id))
      .filter((sc): sc is SubChatMeta => !!sc)
      .sort((a, b) => {
        const aT = new Date(a.updated_at || a.created_at || "0").getTime()
        const bT = new Date(b.updated_at || b.created_at || "0").getTime()
        return bT - aT // Most recent first
      })

    return chats
  }, [openSubChatIds, allSubChats])

  // Filter and separate pinned/unpinned sub-chats
  const { pinnedChats, unpinnedChats } = useMemo(() => {
    const filtered = searchQuery.trim()
      ? openSubChats.filter((chat) =>
          chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : openSubChats

    const pinned = filtered.filter((chat) => pinnedSubChatIds.includes(chat.id))
    const unpinned = filtered.filter(
      (chat) => !pinnedSubChatIds.includes(chat.id),
    )

    return { pinnedChats: pinned, unpinnedChats: unpinned }
  }, [searchQuery, openSubChats, pinnedSubChatIds])

  const filteredSubChats = useMemo(() => {
    return [...pinnedChats, ...unpinnedChats]
  }, [pinnedChats, unpinnedChats])

  // Reset focused index when search query changes
  useEffect(() => {
    setFocusedChatIndex(-1)
  }, [searchQuery, filteredSubChats.length])

  // Scroll focused item into view
  useEffect(() => {
    if (focusedChatIndex >= 0 && filteredSubChats.length > 0) {
      const focusedElement = scrollContainerRef.current?.querySelector(
        `[data-subchat-index="${focusedChatIndex}"]`,
      ) as HTMLElement
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        })
      }
    }
  }, [focusedChatIndex, filteredSubChats.length])

  // Unified scroll handler for gradients
  const updateScrollGradients = useCallback((element?: HTMLDivElement) => {
    const container = element || scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isScrollable = scrollHeight > clientHeight

    if (!isScrollable) {
      setShowBottomGradient(false)
      setShowTopGradient(false)
      return
    }

    const threshold = 5
    const isAtTop = scrollTop <= threshold
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold

    setShowTopGradient(!isAtTop)
    setShowBottomGradient(!isAtBottom)
  }, [])

  // Handler for React onScroll event
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      updateScrollGradients(e.currentTarget)
    },
    [updateScrollGradients],
  )

  // Initialize gradients on mount and observe container size changes
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    updateScrollGradients()
    const resizeObserver = new ResizeObserver(() => updateScrollGradients())
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [filteredSubChats, updateScrollGradients])

  // Hotkey: / to focus search input
  useEffect(() => {
    const handleSearchHotkey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const activeEl = document.activeElement
        if (
          activeEl?.tagName === "INPUT" ||
          activeEl?.tagName === "TEXTAREA" ||
          activeEl?.hasAttribute("contenteditable")
        ) {
          return
        }

        e.preventDefault()
        e.stopPropagation()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }

    window.addEventListener("keydown", handleSearchHotkey, { capture: true })
    return () =>
      window.removeEventListener("keydown", handleSearchHotkey, {
        capture: true,
      })
  }, [])

  // Derive which sub-chats are loading
  const loadingChatIds = useMemo(
    () => new Set([...loadingSubChats.keys()]),
    [loadingSubChats],
  )

  const handleSubChatClick = (subChatId: string) => {
    const store = useAgentSubChatStore.getState()
    store.setActiveSubChat(subChatId)

    // Clear unseen indicator for this sub-chat
    setSubChatUnseenChanges((prev: Set<string>) => {
      if (prev.has(subChatId)) {
        const next = new Set(prev)
        next.delete(subChatId)
        return next
      }
      return prev
    })
  }

  const handleArchiveSubChat = useCallback((subChatId: string) => {
    // Archive = remove from open tabs (but keep in allSubChats for history)
    useAgentSubChatStore.getState().removeFromOpenSubChats(subChatId)
  }, [])

  // Handle sub-chat card hover for truncated name tooltip
  const handleSubChatMouseEnter = useCallback(
    (subChatId: string, name: string, cardElement: HTMLElement) => {
      if (subChatTooltipTimerRef.current) {
        clearTimeout(subChatTooltipTimerRef.current)
      }

      const nameEl = subChatNameRefs.current.get(subChatId)
      if (!nameEl) return

      const isTruncated = nameEl.scrollWidth > nameEl.clientWidth
      if (!isTruncated) return

      subChatTooltipTimerRef.current = setTimeout(() => {
        const rect = cardElement.getBoundingClientRect()
        setSubChatTooltip({
          visible: true,
          position: {
            top: rect.top + rect.height / 2,
            left: rect.right + 8,
          },
          name,
        })
      }, 1000)
    },
    [],
  )

  const handleSubChatMouseLeave = useCallback(() => {
    if (subChatTooltipTimerRef.current) {
      clearTimeout(subChatTooltipTimerRef.current)
      subChatTooltipTimerRef.current = null
    }
    setSubChatTooltip(null)
  }, [])

  const handleArchiveAllBelow = useCallback(
    (subChatId: string) => {
      const currentIndex = filteredSubChats.findIndex((c) => c.id === subChatId)
      if (currentIndex === -1 || currentIndex === filteredSubChats.length - 1)
        return

      const state = useAgentSubChatStore.getState()
      const idsToClose = filteredSubChats
        .slice(currentIndex + 1)
        .map((c) => c.id)

      idsToClose.forEach((id) => state.removeFromOpenSubChats(id))
    },
    [filteredSubChats],
  )

  const onCloseOtherChats = useCallback((subChatId: string) => {
    const state = useAgentSubChatStore.getState()
    const idsToClose = state.openSubChatIds.filter((id) => id !== subChatId)
    idsToClose.forEach((id) => state.removeFromOpenSubChats(id))
    state.setActiveSubChat(subChatId)
  }, [])

  const handleRenameClick = useCallback((subChat: SubChatMeta) => {
    setRenamingSubChat(subChat)
    setRenameDialogOpen(true)
  }, [])

  const handleRenameSave = useCallback(
    async (newName: string) => {
      if (!renamingSubChat) return

      useAgentSubChatStore
        .getState()
        .updateSubChatName(renamingSubChat.id, newName)

      setRenameLoading(false)
      setRenamingSubChat(null)
    },
    [renamingSubChat],
  )

  const handleCreateNew = () => {
    const newId = crypto.randomUUID()
    const store = useAgentSubChatStore.getState()

    // Add to allSubChats with placeholder name
    store.addToAllSubChats({
      id: newId,
      name: "New Chat",
      created_at: new Date().toISOString(),
      mode: "agent",
    })

    // Add to open tabs and set as active
    store.addToOpenSubChats(newId)
    store.setActiveSubChat(newId)
  }

  const handleSelectFromHistory = useCallback((subChat: SubChatMeta) => {
    const state = useAgentSubChatStore.getState()
    const isAlreadyOpen = state.openSubChatIds.includes(subChat.id)

    if (!isAlreadyOpen) {
      state.addToOpenSubChats(subChat.id)
    }
    state.setActiveSubChat(subChat.id)

    setIsHistoryOpen(false)
  }, [])

  // Sort sub-chats by most recent first for history
  const sortedSubChats = useMemo(
    () =>
      [...allSubChats].sort((a, b) => {
        const aT = new Date(a.updated_at || a.created_at || "0").getTime()
        const bT = new Date(b.updated_at || b.created_at || "0").getTime()
        return bT - aT
      }),
    [allSubChats],
  )

  // Check if all selected sub-chats are pinned
  const areAllSelectedPinned = useMemo(() => {
    if (selectedSubChatIds.size === 0) return false
    return Array.from(selectedSubChatIds).every((id) =>
      pinnedSubChatIds.includes(id),
    )
  }, [selectedSubChatIds, pinnedSubChatIds])

  // Check if all selected sub-chats are unpinned
  const areAllSelectedUnpinned = useMemo(() => {
    if (selectedSubChatIds.size === 0) return false
    return Array.from(selectedSubChatIds).every(
      (id) => !pinnedSubChatIds.includes(id),
    )
  }, [selectedSubChatIds, pinnedSubChatIds])

  const canShowPinOption = areAllSelectedPinned || areAllSelectedUnpinned

  // Handle bulk pin/unpin/archive
  const handleBulkPin = useCallback(() => {
    const idsToPin = Array.from(selectedSubChatIds)
    if (idsToPin.length > 0) {
      idsToPin.forEach((id) => {
        if (!pinnedSubChatIds.includes(id)) {
          togglePinSubChat(id)
        }
      })
      clearSubChatSelection()
    }
  }, [
    selectedSubChatIds,
    pinnedSubChatIds,
    togglePinSubChat,
    clearSubChatSelection,
  ])

  const handleBulkUnpin = useCallback(() => {
    const idsToUnpin = Array.from(selectedSubChatIds)
    if (idsToUnpin.length > 0) {
      idsToUnpin.forEach((id) => {
        if (pinnedSubChatIds.includes(id)) {
          togglePinSubChat(id)
        }
      })
      clearSubChatSelection()
    }
  }, [
    selectedSubChatIds,
    pinnedSubChatIds,
    togglePinSubChat,
    clearSubChatSelection,
  ])

  const handleBulkArchive = useCallback(() => {
    const idsToArchive = Array.from(selectedSubChatIds)
    if (idsToArchive.length > 0) {
      const state = useAgentSubChatStore.getState()
      idsToArchive.forEach((id) => state.removeFromOpenSubChats(id))
      clearSubChatSelection()
    }
  }, [selectedSubChatIds, clearSubChatSelection])

  // Handle sub-chat item click with shift support
  const handleSubChatItemClick = (
    subChatId: string,
    e?: React.MouseEvent,
    globalIndex?: number,
  ) => {
    if (e?.shiftKey) {
      e.preventDefault()

      const clickedIndex =
        globalIndex ?? filteredSubChats.findIndex((c) => c.id === subChatId)

      if (clickedIndex === -1) return

      let anchorIndex = -1

      if (activeSubChatId) {
        anchorIndex = filteredSubChats.findIndex(
          (c) => c.id === activeSubChatId,
        )
      }

      if (anchorIndex === -1 && selectedSubChatIds.size > 0) {
        for (let i = 0; i < filteredSubChats.length; i++) {
          if (selectedSubChatIds.has(filteredSubChats[i]!.id)) {
            anchorIndex = i
            break
          }
        }
      }

      if (anchorIndex === -1) {
        if (!selectedSubChatIds.has(subChatId)) {
          toggleSubChatSelection(subChatId)
        }
        return
      }

      const startIndex = Math.min(anchorIndex, clickedIndex)
      const endIndex = Math.max(anchorIndex, clickedIndex)

      const newSelection = new Set(selectedSubChatIds)
      for (let i = startIndex; i <= endIndex; i++) {
        const chat = filteredSubChats[i]
        if (chat) {
          newSelection.add(chat.id)
        }
      }
      setSelectedSubChatIds(newSelection)
      return
    }

    handleSubChatClick(subChatId)
  }

  // Clear selection when parent chat changes
  useEffect(() => {
    clearSubChatSelection()
  }, [parentChatId, clearSubChatSelection])

  // Header buttons
  const headerButtons = onClose && (
    <div className="flex items-center gap-1">
      <SearchCombobox
        isOpen={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        items={sortedSubChats}
        onSelect={handleSelectFromHistory}
        placeholder="Search chats..."
        emptyMessage="No results"
        getItemValue={(subChat) =>
          `${subChat.name || "New Chat"} ${subChat.id}`
        }
        renderItem={(subChat) => {
          const timeAgo = formatTimeAgo(
            subChat.updated_at || subChat.created_at,
          )
          return (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm truncate">
                {subChat.name || "New Chat"}
              </span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {timeAgo}
              </span>
            </div>
          )
        }}
        trigger={
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md"
                  disabled={allSubChats.length === 0}
                >
                  <ClockIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Chat history</TooltipContent>
          </Tooltip>
        }
      />
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            tabIndex={-1}
            className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground flex-shrink-0 rounded-md"
            aria-label="Close sidebar"
          >
            <IconDoubleChevronLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Close chats pane</TooltipContent>
      </Tooltip>
    </div>
  )

  // Drafts cache - uses event-based sync instead of polling
  const draftsCache = useSubChatDraftsCache()

  // Get draft for a sub-chat
  const getDraftText = useCallback(
    (subChatId: string): string | null => {
      if (!parentChatId) return null
      const key = getSubChatDraftKey(parentChatId, subChatId)
      return draftsCache[key] || null
    },
    [parentChatId, draftsCache],
  )

  // Render a single sub-chat item
  const renderSubChatItem = (subChat: SubChatMeta, globalIndex: number) => {
    const isSubChatLoading = loadingChatIds.has(subChat.id)
    const isActive = activeSubChatId === subChat.id
    const isPinned = pinnedSubChatIds.includes(subChat.id)
    const isFocused = focusedChatIndex === globalIndex && focusedChatIndex >= 0
    const hasUnseen = subChatUnseenChanges.has(subChat.id)
    const timeAgo = formatTimeAgo(subChat.updated_at || subChat.created_at)
    const mode = subChat.mode || "agent"
    const isChecked = selectedSubChatIds.has(subChat.id)
    const draftText = getDraftText(subChat.id)
    const hasPendingQuestion = pendingQuestions?.subChatId === subChat.id

    return (
      <ContextMenu key={subChat.id}>
        <ContextMenuTrigger asChild>
          <div
            data-subchat-index={globalIndex}
            onClick={(e) => handleSubChatItemClick(subChat.id, e, globalIndex)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                handleSubChatItemClick(subChat.id, undefined, globalIndex)
              }
            }}
            onMouseEnter={(e) => {
              setHoveredChatIndex(globalIndex)
              handleSubChatMouseEnter(
                subChat.id,
                subChat.name || "New Chat",
                e.currentTarget,
              )
            }}
            onMouseLeave={() => {
              setHoveredChatIndex(-1)
              handleSubChatMouseLeave()
            }}
            className={cn(
              "w-full text-left py-1.5 transition-colors duration-150 cursor-pointer group relative",
              "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
              isMultiSelectMode ? "px-3" : "pl-2 pr-2",
              isMultiSelectMode ? "" : "rounded-md",
              isActive
                ? "bg-foreground/5 text-foreground"
                : isChecked
                  ? "bg-foreground/5 text-foreground"
                  : isFocused
                    ? "bg-foreground/5 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <div className="flex items-start gap-2.5">
              {/* Icon/Checkbox container */}
              <div className="pt-0.5 flex-shrink-0 w-4 h-4 flex items-center justify-center relative">
                {/* Mode icon or Question icon */}
                <div
                  className={cn(
                    "transition-[opacity,transform] duration-150 ease-out",
                    isMultiSelectMode
                      ? "opacity-0 scale-95 pointer-events-none"
                      : "opacity-100 scale-100",
                  )}
                >
                  {hasPendingQuestion ? (
                    <QuestionIcon className="w-4 h-4 text-blue-500" />
                  ) : mode === "plan" ? (
                    <PlanIcon className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <AgentIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                {/* Badge - don't show when pending question (icon already indicates status) */}
                {(isSubChatLoading || hasUnseen) && !isMultiSelectMode && !hasPendingQuestion && (
                  <div
                    className={cn(
                      "absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center",
                      isActive
                        ? "bg-[#E8E8E8] dark:bg-[#1B1B1B]"
                        : "bg-[#F4F4F4] group-hover:bg-[#E8E8E8] dark:bg-[#101010] dark:group-hover:bg-[#1B1B1B]",
                    )}
                  >
                    {isSubChatLoading ? (
                      <IconSpinner className="w-2.5 h-2.5 text-muted-foreground" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-[#307BD0]" />
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span
                    ref={(el) => {
                      if (el) subChatNameRefs.current.set(subChat.id, el)
                    }}
                    className="truncate block text-sm leading-tight flex-1"
                  >
                    {subChat.name || "New Chat"}
                  </span>
                  {!isMultiSelectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleArchiveSubChat(subChat.id)
                      }}
                      tabIndex={-1}
                      className="flex-shrink-0 text-muted-foreground hover:text-foreground active:text-foreground transition-[opacity,transform,color] duration-150 ease-out opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto active:scale-[0.97]"
                      aria-label="Archive agent"
                    >
                      <ArchiveIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0 text-[11px] text-muted-foreground/60">
                  {draftText ? (
                    <span className="truncate">
                      <span className="text-blue-500">Draft:</span> {draftText}
                    </span>
                  ) : (
                    <span className="flex-shrink-0">{timeAgo}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        {/* Multi-select context menu */}
        {isMultiSelectMode && selectedSubChatIds.has(subChat.id) ? (
          <ContextMenuContent className="w-48">
            {canShowPinOption && (
              <>
                <ContextMenuItem
                  onClick={
                    areAllSelectedPinned ? handleBulkUnpin : handleBulkPin
                  }
                >
                  {areAllSelectedPinned
                    ? `Unpin ${selectedSubChatIds.size} ${pluralize(selectedSubChatIds.size, "chat")}`
                    : `Pin ${selectedSubChatIds.size} ${pluralize(selectedSubChatIds.size, "chat")}`}
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}
            <ContextMenuItem onClick={handleBulkArchive}>
              Archive {selectedSubChatIds.size}{" "}
              {pluralize(selectedSubChatIds.size, "chat")}
            </ContextMenuItem>
          </ContextMenuContent>
        ) : (
          <SubChatContextMenu
            subChat={subChat}
            isPinned={isPinned}
            onTogglePin={togglePinSubChat}
            onRename={handleRenameClick}
            onArchive={handleArchiveSubChat}
            onArchiveAllBelow={handleArchiveAllBelow}
            onArchiveOthers={onCloseOtherChats}
            isOnlyChat={openSubChats.length === 1}
            currentIndex={globalIndex}
            totalCount={filteredSubChats.length}
          />
        )}
      </ContextMenu>
    )
  }

  return (
    <div
      className="flex flex-col h-full bg-background border-r overflow-hidden relative"
      style={{ borderRightWidth: "0.5px" }}
    >
      {/* Header buttons - absolutely positioned when agents sidebar is open */}
      {isSidebarOpen && (
        <div className="absolute right-2 top-2 z-20">{headerButtons}</div>
      )}

      {/* Header */}
      <div className="p-2 pb-3 flex-shrink-0">
        <div className="space-y-2">
          {/* Top row - different layout based on agents sidebar state */}
          {isSidebarOpen ? (
            <div className="h-6" />
          ) : (
            <div className="flex items-center justify-between gap-1 mb-1">
              {onBackToChats && (
                <Tooltip delayDuration={500}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onBackToChats}
                      tabIndex={-1}
                      className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md"
                      aria-label="Toggle agents sidebar"
                    >
                      <AlignJustify className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open chats sidebar</TooltipContent>
                </Tooltip>
              )}
              <div className="flex-1" />
              {headerButtons}
            </div>
          )}
          {/* Search Input */}
          <div className="relative">
            <Input
              ref={searchInputRef}
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault()
                  searchInputRef.current?.blur()
                  setFocusedChatIndex(-1)
                  return
                }

                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setFocusedChatIndex((prev) => {
                    if (prev === -1) return 0
                    return prev < filteredSubChats.length - 1 ? prev + 1 : prev
                  })
                  return
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setFocusedChatIndex((prev) => {
                    if (prev === -1) return filteredSubChats.length - 1
                    return prev > 0 ? prev - 1 : prev
                  })
                  return
                }

                if (e.key === "Enter") {
                  e.preventDefault()
                  if (focusedChatIndex >= 0) {
                    const focusedChat = filteredSubChats[focusedChatIndex]
                    if (focusedChat) {
                      handleSubChatClick(focusedChat.id)
                      searchInputRef.current?.blur()
                      setFocusedChatIndex(-1)
                    }
                  }
                  return
                }
              }}
              className="h-7 w-full rounded-lg text-sm bg-muted border-0 placeholder:text-muted-foreground/40"
            />
          </div>
          {/* New Chat Button */}
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                onClick={handleCreateNew}
                variant="outline"
                size="sm"
                className="h-7 px-2 w-full hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground rounded-lg"
              >
                <span className="text-sm font-medium">New Chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Create a new chat
              <Kbd>{getShortcutKey("newTab")}</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Scrollable Sub-Chats List */}
      <div className="flex-1 min-h-0 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconSpinner className="w-5 h-5 text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Top gradient */}
            {showTopGradient && (
              <div className="absolute left-0 right-0 top-0 h-8 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
            )}

            {/* Bottom gradient */}
            {showBottomGradient && (
              <div className="absolute left-0 right-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
            )}

            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className={cn(
                "h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
                isMultiSelectMode ? "px-0" : "px-2",
              )}
            >
              {filteredSubChats.length > 0 ? (
                <div
                  className={cn("mb-4", isMultiSelectMode ? "px-0" : "-mx-1")}
                >
                  {/* Pinned section */}
                  {pinnedChats.length > 0 && (
                    <>
                      <div
                        className={cn(
                          "flex items-center h-4 mb-1",
                          isMultiSelectMode ? "pl-3" : "pl-2",
                        )}
                      >
                        <h3 className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          Pinned
                        </h3>
                      </div>
                      <div className="list-none p-0 m-0 mb-3">
                        {pinnedChats.map((subChat) => {
                          const globalIndex = filteredSubChats.findIndex(
                            (c) => c.id === subChat.id,
                          )
                          return renderSubChatItem(subChat, globalIndex)
                        })}
                      </div>
                    </>
                  )}

                  {/* Unpinned section */}
                  {unpinnedChats.length > 0 && (
                    <>
                      <div
                        className={cn(
                          "flex items-center h-4 mb-1",
                          isMultiSelectMode ? "pl-3" : "pl-2",
                        )}
                      >
                        <h3 className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          {pinnedChats.length > 0 ? "Recent" : "Chats"}
                        </h3>
                      </div>
                      <div className="list-none p-0 m-0">
                        {unpinnedChats.map((subChat) => {
                          const globalIndex = filteredSubChats.findIndex(
                            (c) => c.id === subChat.id,
                          )
                          return renderSubChatItem(subChat, globalIndex)
                        })}
                      </div>
                    </>
                  )}
                </div>
              ) : searchQuery.trim() ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
                  <div>
                    <p className="mb-1">No results</p>
                    <p className="text-xs text-muted-foreground/60">
                      Try a different search term
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Multi-select Footer Toolbar */}
      <AnimatePresence mode="wait">
        {isMultiSelectMode && (
          <motion.div
            key="multiselect-footer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0 }}
            className="flex-shrink-0 p-2 bg-background space-y-2"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                {selectedSubChatsCount} selected
              </span>
              <button
                onClick={clearSubChatSelection}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkArchive}
                className="flex-1 h-8 gap-1.5 text-xs rounded-lg"
              >
                <ArchiveIcon className="h-3.5 w-3.5" />
                Archive
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Dialog */}
      <RenameDialog
        isOpen={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false)
          setRenamingSubChat(null)
        }}
        onSave={handleRenameSave}
        currentName={renamingSubChat?.name || ""}
        isLoading={renameLoading}
        title="Rename chat"
        placeholder="Chat name"
      />

      {/* SubChat name tooltip portal */}
      {subChatTooltip?.visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100000] max-w-xs px-2 py-1 text-xs bg-popover border border-border rounded-md shadow-lg dark pointer-events-none"
            style={{
              top: subChatTooltip.position.top,
              left: subChatTooltip.position.left,
              transform: "translateY(-50%)",
            }}
          >
            <div className="text-foreground/90 whitespace-nowrap">
              {subChatTooltip.name}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
