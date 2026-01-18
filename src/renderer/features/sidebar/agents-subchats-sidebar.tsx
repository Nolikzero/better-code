"use client";

import { formatTimeAgo, pluralize } from "@shared/utils";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../components/ui/context-menu";
import {
  AgentIcon,
  ArchiveIcon,
  ClockIcon,
  IconDoubleChevronRight,
  IconSpinner,
  PlanIcon,
  QuestionIcon,
} from "../../components/ui/icons";
import { Input } from "../../components/ui/input";
import { Kbd } from "../../components/ui/kbd";
import { PopoverTrigger } from "../../components/ui/popover";
import { SearchCombobox } from "../../components/ui/search-combobox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  clearSubChatSelectionAtom,
  isSubChatMultiSelectModeAtom,
  selectAllSubChatsAtom,
  selectedSubChatIdsAtom,
  selectedSubChatsCountAtom,
  selectedTeamIdAtom,
  toggleSubChatSelectionAtom,
} from "../../lib/atoms";
import { api } from "../../lib/mock-api";
import { trpc, trpcClient } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import { getShortcutKey } from "../../lib/utils/platform";
import {
  agentsSubChatUnseenChangesAtom,
  justCreatedIdsAtom,
  loadingSubChatsAtom,
  pendingUserQuestionsAtom,
  previousAgentChatIdAtom,
  selectedAgentChatIdAtom,
  subChatFilesAtom,
  type UndoItem,
  undoStackAtom,
} from "../agents/atoms";
import { AgentsRenameSubChatDialog } from "../agents/components/agents-rename-subchat-dialog";
import {
  getSubChatDraftKey,
  useSubChatDraftsCache,
} from "../agents/lib/drafts";
import {
  type SubChatMeta,
  useAgentSubChatStore,
} from "../agents/stores/sub-chat-store";
import { SubChatContextMenu } from "../agents/ui/sub-chat-context-menu";
import {
  MultiSelectFooter,
  SidebarListItem,
  SidebarListSection,
  SubChatIcon,
} from "./components";
import { useScrollGradients, useTruncatedTooltip } from "./hooks";

interface AgentsSubChatsSidebarProps {
  onClose?: () => void;
  isLoading?: boolean;
  agentName?: string;
}

export function AgentsSubChatsSidebar({
  onClose,
  isLoading = false,
  agentName,
}: AgentsSubChatsSidebarProps) {
  // Use shallow comparison to prevent re-renders when arrays have same content
  const {
    activeSubChatId,
    openSubChatIds,
    pinnedSubChatIds,
    allSubChats,
    parentChatId,
    togglePinSubChat,
  } = useAgentSubChatStore(
    useShallow((state) => ({
      activeSubChatId: state.activeSubChatId,
      openSubChatIds: state.openSubChatIds,
      pinnedSubChatIds: state.pinnedSubChatIds,
      allSubChats: state.allSubChats,
      parentChatId: state.chatId,
      togglePinSubChat: state.togglePinSubChat,
    })),
  );
  const [loadingSubChats] = useAtom(loadingSubChatsAtom);
  const subChatFiles = useAtomValue(subChatFilesAtom);
  const selectedTeamId = useAtomValue(selectedTeamIdAtom);
  const [selectedChatId, setSelectedChatId] = useAtom(selectedAgentChatIdAtom);
  const previousChatId = useAtomValue(previousAgentChatIdAtom);

  // Fetch agent chats for navigation after archive
  const { data: agentChats } = api.agents.getAgentChats.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId },
  );

  const utils = trpc.useUtils();

  // Archive parent chat mutation
  const archiveChatMutation = trpc.chats.archive.useMutation({
    onSuccess: (_, variables) => {
      utils.chats.list.invalidate();
      utils.chats.listArchived.invalidate();

      // Navigate to previous chat or new workspace
      if (selectedChatId === variables.id) {
        const isPreviousAvailable =
          previousChatId && agentChats?.some((c) => c.id === previousChatId);

        if (isPreviousAvailable) {
          setSelectedChatId(previousChatId);
        } else {
          setSelectedChatId(null);
        }
      }
    },
  });
  const subChatUnseenChanges = useAtomValue(agentsSubChatUnseenChangesAtom);
  const setSubChatUnseenChanges = useSetAtom(agentsSubChatUnseenChangesAtom);
  const [justCreatedIds, setJustCreatedIds] = useAtom(justCreatedIdsAtom);
  const pendingQuestions = useAtomValue(pendingUserQuestionsAtom);

  // Pending plan approvals from DB - only for open sub-chats
  // Reduced polling from 5s to 30s for performance (data is not time-critical)
  const { data: pendingPlanApprovalsData } =
    trpc.chats.getPendingPlanApprovals.useQuery(
      { openSubChatIds },
      {
        refetchInterval: 30000,
        enabled: openSubChatIds.length > 0,
        placeholderData: (prev) => prev,
      },
    );
  const pendingPlanApprovals = useMemo(() => {
    const set = new Set<string>();
    if (pendingPlanApprovalsData) {
      for (const { subChatId } of pendingPlanApprovalsData) {
        set.add(subChatId);
      }
    }
    return set;
  }, [pendingPlanApprovalsData]);

  // Unified undo stack for Cmd+Z support
  const setUndoStack = useSetAtom(undoStackAtom);
  const [searchQuery, setSearchQuery] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [focusedChatIndex, setFocusedChatIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingSubChat, setRenamingSubChat] = useState<SubChatMeta | null>(
    null,
  );
  const [renameLoading, setRenameLoading] = useState(false);
  const [hoveredChatIndex, setHoveredChatIndex] = useState<number>(-1);

  // Scroll gradients via shared hook
  const {
    showTopGradient,
    showBottomGradient,
    handleScroll,
    updateGradients: _updateScrollGradients,
  } = useScrollGradients(scrollContainerRef);
  const [archiveAgentDialogOpen, setArchiveAgentDialogOpen] = useState(false);
  const [subChatToArchive, setSubChatToArchive] = useState<SubChatMeta | null>(
    null,
  );

  // SubChat name tooltip via shared hook
  const {
    tooltip: _subChatTooltip,
    nameRefs: subChatNameRefs,
    handleMouseEnter: handleSubChatMouseEnter,
    handleMouseLeave: handleSubChatMouseLeave,
    TooltipPortal: SubChatTooltipPortal,
  } = useTruncatedTooltip();

  // Multi-select state
  const [selectedSubChatIds, setSelectedSubChatIds] = useAtom(
    selectedSubChatIdsAtom,
  );
  const isMultiSelectMode = useAtomValue(isSubChatMultiSelectModeAtom);
  const selectedSubChatsCount = useAtomValue(selectedSubChatsCountAtom);
  const toggleSubChatSelection = useSetAtom(toggleSubChatSelectionAtom);
  const selectAllSubChats = useSetAtom(selectAllSubChatsAtom);
  const clearSubChatSelection = useSetAtom(clearSubChatSelectionAtom);

  // Map open IDs to metadata and sort by updated_at (most recent first)
  const openSubChats = useMemo(() => {
    const chats = openSubChatIds
      .map((id) => allSubChats.find((sc) => sc.id === id))
      .filter((sc): sc is SubChatMeta => !!sc)
      .sort((a, b) => {
        const aT = new Date(a.updated_at || a.created_at || "0").getTime();
        const bT = new Date(b.updated_at || b.created_at || "0").getTime();
        return bT - aT; // Most recent first
      });

    return chats;
  }, [openSubChatIds, allSubChats]);

  // Filter and separate pinned/unpinned sub-chats
  const { pinnedChats, unpinnedChats } = useMemo(() => {
    const filtered = searchQuery.trim()
      ? openSubChats.filter((chat) =>
          chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : openSubChats;

    const pinned = filtered.filter((chat) =>
      pinnedSubChatIds.includes(chat.id),
    );
    const unpinned = filtered.filter(
      (chat) => !pinnedSubChatIds.includes(chat.id),
    );

    return { pinnedChats: pinned, unpinnedChats: unpinned };
  }, [searchQuery, openSubChats, pinnedSubChatIds]);

  const filteredSubChats = useMemo(() => {
    return [...pinnedChats, ...unpinnedChats];
  }, [pinnedChats, unpinnedChats]);

  // Reset focused index when search query changes
  React.useEffect(() => {
    setFocusedChatIndex(-1);
  }, [searchQuery, filteredSubChats.length]);

  // Scroll focused item into view
  React.useEffect(() => {
    if (focusedChatIndex >= 0 && filteredSubChats.length > 0) {
      const focusedElement = scrollContainerRef.current?.querySelector(
        `[data-subchat-index="${focusedChatIndex}"]`,
      ) as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [focusedChatIndex, filteredSubChats.length]);

  // Hotkey: / to focus search input (only when sidebar is visible and input not focused)
  React.useEffect(() => {
    const handleSearchHotkey = (e: KeyboardEvent) => {
      // Only trigger if / is pressed without Cmd/Ctrl/Alt
      // Note: e.key automatically handles keyboard layouts (Shift is not checked, allowing international layouts)
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Don't trigger if already focused on an input/textarea
        const activeEl = document.activeElement;
        if (
          activeEl?.tagName === "INPUT" ||
          activeEl?.tagName === "TEXTAREA" ||
          activeEl?.hasAttribute("contenteditable")
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    // Use capture phase to intercept before other handlers (e.g., prompt input)
    // Cleanup is guaranteed on unmount to prevent memory leaks
    window.addEventListener("keydown", handleSearchHotkey, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleSearchHotkey, {
        capture: true,
      });
    // Empty deps: handler is stable and uses only ref which doesn't need tracking
  }, []);

  // Derive which sub-chats are loading (keys = subChatIds)
  const loadingChatIds = useMemo(
    () => new Set([...loadingSubChats.keys()]),
    [loadingSubChats],
  );

  const handleSubChatClick = (subChatId: string) => {
    const store = useAgentSubChatStore.getState();
    store.setActiveSubChat(subChatId);

    // Clear unseen indicator for this sub-chat
    setSubChatUnseenChanges((prev: Set<string>) => {
      if (prev.has(subChatId)) {
        const next = new Set(prev);
        next.delete(subChatId);
        return next;
      }
      return prev;
    });
  };

  const handleArchiveSubChat = useCallback(
    (subChatId: string) => {
      // If this is the last open subchat, show confirmation dialog
      if (openSubChats.length === 1) {
        const subChat = allSubChats.find((sc) => sc.id === subChatId);
        if (subChat) {
          setSubChatToArchive(subChat);
          setArchiveAgentDialogOpen(true);
        }
        return;
      }
      // Archive = remove from open tabs (but keep in allSubChats for history)
      useAgentSubChatStore.getState().removeFromOpenSubChats(subChatId);

      // Add to unified undo stack for Cmd+Z
      if (parentChatId) {
        const timeoutId = setTimeout(() => {
          setUndoStack((prev) =>
            prev.filter(
              (item) =>
                !(item.type === "subchat" && item.subChatId === subChatId),
            ),
          );
        }, 10000);

        setUndoStack((prev) => [
          ...prev,
          {
            type: "subchat",
            subChatId,
            chatId: parentChatId,
            timeoutId,
          },
        ]);
      }
    },
    [openSubChats.length, allSubChats, parentChatId, setUndoStack],
  );

  const handleConfirmArchiveAgent = useCallback(() => {
    if (parentChatId) {
      // Archive the parent agent chat
      archiveChatMutation.mutate({ id: parentChatId });
    }
    setArchiveAgentDialogOpen(false);
    setSubChatToArchive(null);
  }, [parentChatId, archiveChatMutation]);

  const handleArchiveAllBelow = useCallback(
    (subChatId: string) => {
      const currentIndex = filteredSubChats.findIndex(
        (c) => c.id === subChatId,
      );
      if (currentIndex === -1 || currentIndex === filteredSubChats.length - 1)
        return;

      const state = useAgentSubChatStore.getState();
      const idsToClose = filteredSubChats
        .slice(currentIndex + 1)
        .map((c) => c.id);

      for (const id of idsToClose) {
        state.removeFromOpenSubChats(id);
      }

      // Add each to unified undo stack for Cmd+Z
      if (parentChatId) {
        const newItems: UndoItem[] = idsToClose.map((id) => {
          const timeoutId = setTimeout(() => {
            setUndoStack((prev) =>
              prev.filter(
                (item) => !(item.type === "subchat" && item.subChatId === id),
              ),
            );
          }, 10000);
          return {
            type: "subchat" as const,
            subChatId: id,
            chatId: parentChatId,
            timeoutId,
          };
        });
        setUndoStack((prev) => [...prev, ...newItems]);
      }
    },
    [filteredSubChats, parentChatId, setUndoStack],
  );

  const onCloseOtherChats = useCallback(
    (subChatId: string) => {
      const state = useAgentSubChatStore.getState();
      const idsToClose = state.openSubChatIds.filter((id) => id !== subChatId);
      for (const id of idsToClose) {
        state.removeFromOpenSubChats(id);
      }
      state.setActiveSubChat(subChatId);

      // Add each to unified undo stack for Cmd+Z
      if (parentChatId) {
        const newItems: UndoItem[] = idsToClose.map((id) => {
          const timeoutId = setTimeout(() => {
            setUndoStack((prev) =>
              prev.filter(
                (item) => !(item.type === "subchat" && item.subChatId === id),
              ),
            );
          }, 10000);
          return {
            type: "subchat" as const,
            subChatId: id,
            chatId: parentChatId,
            timeoutId,
          };
        });
        setUndoStack((prev) => [...prev, ...newItems]);
      }
    },
    [parentChatId, setUndoStack],
  );

  const renameMutation = api.agents.renameSubChat.useMutation({
    // Note: store is updated optimistically in handleRenameSave, no need for onSuccess
    onError: (error) => {
      if (error.data?.code === "NOT_FOUND") {
        toast.error("Send a message first before renaming this chat");
      } else {
        toast.error("Failed to rename chat");
      }
    },
  });

  const handleRenameClick = useCallback((subChat: SubChatMeta) => {
    setRenamingSubChat(subChat);
    setRenameDialogOpen(true);
  }, []);

  const handleRenameSave = useCallback(
    async (newName: string) => {
      if (!renamingSubChat) return;

      const subChatId = renamingSubChat.id;
      const oldName = renamingSubChat.name;

      // Optimistically update store
      useAgentSubChatStore.getState().updateSubChatName(subChatId, newName);

      // Remove from justCreatedIds to prevent typewriter animation on manual rename
      setJustCreatedIds((prev) => {
        if (prev.has(subChatId)) {
          const next = new Set(prev);
          next.delete(subChatId);
          return next;
        }
        return prev;
      });

      setRenameLoading(true);

      try {
        await renameMutation.mutateAsync({
          subChatId,
          name: newName,
        });
      } catch {
        // Rollback on error
        useAgentSubChatStore
          .getState()
          .updateSubChatName(subChatId, oldName || "New Chat");
      } finally {
        setRenameLoading(false);
        setRenamingSubChat(null);
      }
    },
    [renamingSubChat, renameMutation, setJustCreatedIds],
  );

  const handleCreateNew = async () => {
    if (!parentChatId) return;

    const store = useAgentSubChatStore.getState();

    // Create sub-chat in DB first to get the real ID
    const newSubChat = await trpcClient.chats.createSubChat.mutate({
      chatId: parentChatId,
      name: "New Chat",
      mode: "agent",
    });
    const newId = newSubChat.id;

    // Track this subchat as just created for typewriter effect
    setJustCreatedIds((prev) => new Set([...prev, newId]));

    // Add to allSubChats with placeholder name
    store.addToAllSubChats({
      id: newId,
      name: "New Chat",
      created_at: new Date().toISOString(),
      mode: "agent",
    });

    // Add to open tabs and set as active
    store.addToOpenSubChats(newId);
    store.setActiveSubChat(newId);
  };

  const handleSelectFromHistory = useCallback((subChat: SubChatMeta) => {
    const state = useAgentSubChatStore.getState();
    const isAlreadyOpen = state.openSubChatIds.includes(subChat.id);

    if (!isAlreadyOpen) {
      state.addToOpenSubChats(subChat.id);
    }
    state.setActiveSubChat(subChat.id);

    setIsHistoryOpen(false);
  }, []);

  // Sort sub-chats by most recent first for history
  const sortedSubChats = useMemo(
    () =>
      [...allSubChats].sort((a, b) => {
        const aT = new Date(a.updated_at || a.created_at || "0").getTime();
        const bT = new Date(b.updated_at || b.created_at || "0").getTime();
        return bT - aT;
      }),
    [allSubChats],
  );

  // Check if all selected sub-chats are pinned
  const areAllSelectedPinned = useMemo(() => {
    if (selectedSubChatIds.size === 0) return false;
    return Array.from(selectedSubChatIds).every((id) =>
      pinnedSubChatIds.includes(id),
    );
  }, [selectedSubChatIds, pinnedSubChatIds]);

  // Check if all selected sub-chats are unpinned
  const areAllSelectedUnpinned = useMemo(() => {
    if (selectedSubChatIds.size === 0) return false;
    return Array.from(selectedSubChatIds).every(
      (id) => !pinnedSubChatIds.includes(id),
    );
  }, [selectedSubChatIds, pinnedSubChatIds]);

  // Show pin option only if all selected have same pin state
  const canShowPinOption = areAllSelectedPinned || areAllSelectedUnpinned;

  // Handle bulk pin of selected sub-chats
  const handleBulkPin = useCallback(() => {
    const idsToPin = Array.from(selectedSubChatIds);
    if (idsToPin.length > 0) {
      idsToPin.forEach((id) => {
        if (!pinnedSubChatIds.includes(id)) {
          togglePinSubChat(id);
        }
      });
      clearSubChatSelection();
    }
  }, [
    selectedSubChatIds,
    pinnedSubChatIds,
    togglePinSubChat,
    clearSubChatSelection,
  ]);

  // Handle bulk unpin of selected sub-chats
  const handleBulkUnpin = useCallback(() => {
    const idsToUnpin = Array.from(selectedSubChatIds);
    if (idsToUnpin.length > 0) {
      idsToUnpin.forEach((id) => {
        if (pinnedSubChatIds.includes(id)) {
          togglePinSubChat(id);
        }
      });
      clearSubChatSelection();
    }
  }, [
    selectedSubChatIds,
    pinnedSubChatIds,
    togglePinSubChat,
    clearSubChatSelection,
  ]);

  // Handle bulk archive of selected sub-chats
  const handleBulkArchive = useCallback(() => {
    const idsToArchive = Array.from(selectedSubChatIds);
    if (idsToArchive.length > 0) {
      // Check if closing all open tabs
      const remainingOpenIds = openSubChatIds.filter(
        (id) => !idsToArchive.includes(id),
      );

      if (remainingOpenIds.length === 0) {
        // Closing all tabs - show archive agent confirmation
        const firstSubChat = allSubChats.find((sc) =>
          idsToArchive.includes(sc.id),
        );
        if (firstSubChat) {
          setSubChatToArchive(firstSubChat);
          setArchiveAgentDialogOpen(true);
          clearSubChatSelection();
        }
      } else {
        // Some tabs remain - just close selected ones
        const state = useAgentSubChatStore.getState();
        for (const id of idsToArchive) {
          state.removeFromOpenSubChats(id);
        }
        clearSubChatSelection();

        // Add each to unified undo stack for Cmd+Z
        if (parentChatId) {
          const newItems: UndoItem[] = idsToArchive.map((id) => {
            const timeoutId = setTimeout(() => {
              setUndoStack((prev) =>
                prev.filter(
                  (item) => !(item.type === "subchat" && item.subChatId === id),
                ),
              );
            }, 10000);
            return {
              type: "subchat" as const,
              subChatId: id,
              chatId: parentChatId,
              timeoutId,
            };
          });
          setUndoStack((prev) => [...prev, ...newItems]);
        }
      }
    }
  }, [
    selectedSubChatIds,
    openSubChatIds,
    allSubChats,
    clearSubChatSelection,
    parentChatId,
    setUndoStack,
  ]);

  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent, subChatId: string) => {
    e.stopPropagation();
    toggleSubChatSelection(subChatId);
  };

  // Handle sub-chat item click with shift support
  const handleSubChatItemClick = (
    subChatId: string,
    e?: React.MouseEvent,
    globalIndex?: number,
  ) => {
    // Shift+click for range selection
    if (e?.shiftKey) {
      e.preventDefault();

      const clickedIndex =
        globalIndex ?? filteredSubChats.findIndex((c) => c.id === subChatId);

      if (clickedIndex === -1) return;

      // Find the anchor: use active sub-chat
      let anchorIndex = -1;

      if (activeSubChatId) {
        anchorIndex = filteredSubChats.findIndex(
          (c) => c.id === activeSubChatId,
        );
      }

      // If no active sub-chat, try to use the first selected item
      if (anchorIndex === -1 && selectedSubChatIds.size > 0) {
        for (let i = 0; i < filteredSubChats.length; i++) {
          if (selectedSubChatIds.has(filteredSubChats[i]!.id)) {
            anchorIndex = i;
            break;
          }
        }
      }

      // If still no anchor, just select the clicked item
      if (anchorIndex === -1) {
        if (!selectedSubChatIds.has(subChatId)) {
          toggleSubChatSelection(subChatId);
        }
        return;
      }

      // Select range from anchor to clicked item
      const startIndex = Math.min(anchorIndex, clickedIndex);
      const endIndex = Math.max(anchorIndex, clickedIndex);

      const newSelection = new Set(selectedSubChatIds);
      for (let i = startIndex; i <= endIndex; i++) {
        const chat = filteredSubChats[i];
        if (chat) {
          newSelection.add(chat.id);
        }
      }
      setSelectedSubChatIds(newSelection);
      return;
    }

    // Normal click - navigate to sub-chat
    handleSubChatClick(subChatId);
  };

  // Multi-select hotkeys
  // X to toggle selection of hovered or focused chat
  useHotkeys("x", () => {
    if (!filteredSubChats || filteredSubChats.length === 0) return;

    // Prefer hovered, then focused
    const targetIndex =
      hoveredChatIndex >= 0
        ? hoveredChatIndex
        : focusedChatIndex >= 0
          ? focusedChatIndex
          : -1;

    if (targetIndex >= 0 && targetIndex < filteredSubChats.length) {
      const subChatId = filteredSubChats[targetIndex]!.id;
      toggleSubChatSelection(subChatId);
    }
  }, [
    filteredSubChats,
    hoveredChatIndex,
    focusedChatIndex,
    toggleSubChatSelection,
  ]);

  // Cmd+A / Ctrl+A to select all sub-chats (only when at least one is already selected)
  useHotkeys(
    "mod+a",
    (e) => {
      if (isMultiSelectMode && filteredSubChats.length > 0) {
        e.preventDefault();
        selectAllSubChats(filteredSubChats.map((c) => c.id));
      }
    },
    [filteredSubChats, selectAllSubChats, isMultiSelectMode],
  );

  // Escape to clear selection (but not when dialogs are open)
  useHotkeys("escape", () => {
    if (archiveAgentDialogOpen || renameDialogOpen) return;
    if (isMultiSelectMode) {
      clearSubChatSelection();
      setFocusedChatIndex(-1);
    }
  }, [
    isMultiSelectMode,
    clearSubChatSelection,
    archiveAgentDialogOpen,
    renameDialogOpen,
  ]);

  // Clear selection when parent chat changes
  useEffect(() => {
    clearSubChatSelection();
  }, [parentChatId, clearSubChatSelection]);

  // Drafts cache - uses event-based sync instead of polling
  const draftsCache = useSubChatDraftsCache();

  // Get draft for a sub-chat
  const getDraftText = useCallback(
    (subChatId: string): string | null => {
      if (!parentChatId) return null;
      const key = getSubChatDraftKey(parentChatId, subChatId);
      return draftsCache[key] || null;
    },
    [parentChatId, draftsCache],
  );

  // History and Close buttons - reusable element
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
          );
          const isLoading = loadingSubChats.has(subChat.id);
          const hasUnseen = subChatUnseenChanges.has(subChat.id);
          const mode = subChat.mode || "agent";
          const hasPendingQuestion = pendingQuestions?.subChatId === subChat.id;

          return (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Icon with badge - question icon has priority */}
              <div className="shrink-0 w-4 h-4 flex items-center justify-center relative">
                {hasPendingQuestion ? (
                  <QuestionIcon className="w-4 h-4 text-blue-500" />
                ) : isLoading ? (
                  <IconSpinner className="w-4 h-4 text-muted-foreground" />
                ) : mode === "plan" ? (
                  <PlanIcon className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <AgentIcon className="w-4 h-4 text-muted-foreground" />
                )}
                {hasUnseen && !isLoading && !hasPendingQuestion && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-popover flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#307BD0]" />
                  </div>
                )}
              </div>
              <span className="text-sm truncate flex-1">
                {subChat.name || "New Chat"}
              </span>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {timeAgo}
              </span>
            </div>
          );
        }}
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={16}
        trigger={
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shrink-0 rounded-md"
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
            className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground shrink-0 rounded-md"
            aria-label="Close sidebar"
          >
            <IconDoubleChevronRight className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Close chats pane</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Header */}
      <div className="p-2 pb-3 shrink-0">
        <div className="space-y-2">
          {/* Top row with header buttons */}
          <div className="flex items-center justify-end gap-1 mb-1">
            {headerButtons}
          </div>
          {/* Search Input */}
          <div className="relative">
            <Input
              ref={searchInputRef}
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  searchInputRef.current?.blur();
                  setFocusedChatIndex(-1);
                  return;
                }

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFocusedChatIndex((prev) => {
                    if (prev === -1) return 0;
                    return prev < filteredSubChats.length - 1 ? prev + 1 : prev;
                  });
                  return;
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFocusedChatIndex((prev) => {
                    if (prev === -1) return filteredSubChats.length - 1;
                    return prev > 0 ? prev - 1 : prev;
                  });
                  return;
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  if (focusedChatIndex >= 0) {
                    const focusedChat = filteredSubChats[focusedChatIndex];
                    if (focusedChat) {
                      handleSubChatClick(focusedChat.id);
                      searchInputRef.current?.blur();
                      setFocusedChatIndex(-1);
                    }
                  }
                  return;
                }
              }}
              className="h-7 w-full rounded-lg text-sm bg-muted border border-input placeholder:text-muted-foreground/40"
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
        {/* Loading state - centered spinner */}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconSpinner className="w-4 h-4 text-muted-foreground" />
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
                    <SidebarListSection
                      title="Pinned Chats"
                      isMultiSelectMode={isMultiSelectMode}
                      className="mb-3"
                    >
                      {pinnedChats.map((subChat, _index) => {
                        const isSubChatLoading = loadingChatIds.has(subChat.id);
                        const isActive = activeSubChatId === subChat.id;
                        const isPinned = pinnedSubChatIds.includes(subChat.id);
                        const globalIndex = filteredSubChats.findIndex(
                          (c) => c.id === subChat.id,
                        );
                        const isFocused =
                          focusedChatIndex === globalIndex &&
                          focusedChatIndex >= 0;
                        const hasUnseen = subChatUnseenChanges.has(subChat.id);
                        const timeAgo = formatTimeAgo(
                          subChat.updated_at || subChat.created_at,
                        );
                        const mode = subChat.mode || "agent";
                        const isChecked = selectedSubChatIds.has(subChat.id);
                        const draftText = getDraftText(subChat.id);
                        const hasPendingQuestion =
                          pendingQuestions?.subChatId === subChat.id;
                        const hasPendingPlan = pendingPlanApprovals.has(
                          subChat.id,
                        );
                        const fileChanges = subChatFiles.get(subChat.id) || [];
                        const stats =
                          fileChanges.length > 0
                            ? fileChanges.reduce(
                                (acc, f) => ({
                                  fileCount: acc.fileCount + 1,
                                  additions: acc.additions + f.additions,
                                  deletions: acc.deletions + f.deletions,
                                }),
                                { fileCount: 0, additions: 0, deletions: 0 },
                              )
                            : null;

                        return (
                          <ContextMenu key={subChat.id}>
                            <ContextMenuTrigger asChild>
                              <SidebarListItem
                                id={subChat.id}
                                name={subChat.name}
                                icon={
                                  <SubChatIcon
                                    mode={mode}
                                    isActive={isActive}
                                    isLoading={isSubChatLoading}
                                    hasUnseenChanges={hasUnseen}
                                    hasPendingPlan={hasPendingPlan}
                                    hasPendingQuestion={hasPendingQuestion}
                                    isMultiSelectMode={isMultiSelectMode}
                                    isChecked={isChecked}
                                    onCheckboxClick={(e) =>
                                      handleCheckboxClick(e, subChat.id)
                                    }
                                  />
                                }
                                isSelected={isActive}
                                isFocused={isFocused}
                                isChecked={isChecked}
                                isMultiSelectMode={isMultiSelectMode}
                                metadata={
                                  draftText ? (
                                    <span className="truncate">
                                      <span className="text-blue-500">
                                        Draft:
                                      </span>{" "}
                                      {draftText}
                                    </span>
                                  ) : (
                                    <>
                                      <span className="shrink-0">
                                        {timeAgo}
                                      </span>
                                      {stats && (
                                        <>
                                          <span className="text-muted-foreground/40">
                                            ·
                                          </span>
                                          <span>
                                            {stats.fileCount}{" "}
                                            {stats.fileCount === 1
                                              ? "file"
                                              : "files"}
                                          </span>
                                          {(stats.additions > 0 ||
                                            stats.deletions > 0) && (
                                            <>
                                              <span className="text-green-600 dark:text-green-400">
                                                +{stats.additions}
                                              </span>
                                              <span className="text-red-600 dark:text-red-400">
                                                -{stats.deletions}
                                              </span>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </>
                                  )
                                }
                                onArchive={() =>
                                  handleArchiveSubChat(subChat.id)
                                }
                                archiveLabel="Archive agent"
                                onClick={(e) =>
                                  handleSubChatItemClick(
                                    subChat.id,
                                    e,
                                    globalIndex,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSubChatItemClick(
                                      subChat.id,
                                      undefined,
                                      globalIndex,
                                    );
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredChatIndex(globalIndex);
                                  handleSubChatMouseEnter(
                                    subChat.id,
                                    subChat.name || "New Chat",
                                    e.currentTarget,
                                  );
                                }}
                                onMouseLeave={() => {
                                  setHoveredChatIndex(-1);
                                  handleSubChatMouseLeave();
                                }}
                                isJustCreated={justCreatedIds.has(subChat.id)}
                                placeholder="New Chat"
                                nameRefCallback={(el) => {
                                  if (el)
                                    subChatNameRefs.current.set(subChat.id, el);
                                }}
                                dataIndex={globalIndex}
                                dataAttribute="data-subchat-index"
                              />
                            </ContextMenuTrigger>
                            {/* Multi-select context menu */}
                            {isMultiSelectMode &&
                            selectedSubChatIds.has(subChat.id) ? (
                              <ContextMenuContent className="w-48">
                                {canShowPinOption && (
                                  <>
                                    <ContextMenuItem
                                      onClick={
                                        areAllSelectedPinned
                                          ? handleBulkUnpin
                                          : handleBulkPin
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
                        );
                      })}
                    </SidebarListSection>
                  )}

                  {/* Unpinned section */}
                  {unpinnedChats.length > 0 && (
                    <SidebarListSection
                      title={pinnedChats.length > 0 ? "Recent chats" : "Chats"}
                      isMultiSelectMode={isMultiSelectMode}
                    >
                      {unpinnedChats.map((subChat, _index) => {
                        const isSubChatLoading = loadingChatIds.has(subChat.id);
                        const isActive = activeSubChatId === subChat.id;
                        const isPinned = pinnedSubChatIds.includes(subChat.id);
                        const globalIndex = filteredSubChats.findIndex(
                          (c) => c.id === subChat.id,
                        );
                        const isFocused =
                          focusedChatIndex === globalIndex &&
                          focusedChatIndex >= 0;
                        const hasUnseen = subChatUnseenChanges.has(subChat.id);
                        const timeAgo = formatTimeAgo(
                          subChat.updated_at || subChat.created_at,
                        );
                        const mode = subChat.mode || "agent";
                        const isChecked = selectedSubChatIds.has(subChat.id);
                        const draftText = getDraftText(subChat.id);
                        const hasPendingQuestion =
                          pendingQuestions?.subChatId === subChat.id;
                        const hasPendingPlan = pendingPlanApprovals.has(
                          subChat.id,
                        );
                        const fileChanges = subChatFiles.get(subChat.id) || [];
                        const stats =
                          fileChanges.length > 0
                            ? fileChanges.reduce(
                                (acc, f) => ({
                                  fileCount: acc.fileCount + 1,
                                  additions: acc.additions + f.additions,
                                  deletions: acc.deletions + f.deletions,
                                }),
                                { fileCount: 0, additions: 0, deletions: 0 },
                              )
                            : null;

                        return (
                          <ContextMenu key={subChat.id}>
                            <ContextMenuTrigger asChild>
                              <SidebarListItem
                                id={subChat.id}
                                name={subChat.name}
                                icon={
                                  <SubChatIcon
                                    mode={mode}
                                    isActive={isActive}
                                    isLoading={isSubChatLoading}
                                    hasUnseenChanges={hasUnseen}
                                    hasPendingPlan={hasPendingPlan}
                                    hasPendingQuestion={hasPendingQuestion}
                                    isMultiSelectMode={isMultiSelectMode}
                                    isChecked={isChecked}
                                    onCheckboxClick={(e) =>
                                      handleCheckboxClick(e, subChat.id)
                                    }
                                  />
                                }
                                isSelected={isActive}
                                isFocused={isFocused}
                                isChecked={isChecked}
                                isMultiSelectMode={isMultiSelectMode}
                                metadata={
                                  draftText ? (
                                    <span className="truncate">
                                      <span className="text-blue-500">
                                        Draft:
                                      </span>{" "}
                                      {draftText}
                                    </span>
                                  ) : (
                                    <>
                                      <span className="shrink-0">
                                        {timeAgo}
                                      </span>
                                      {stats && (
                                        <>
                                          <span className="text-muted-foreground/40">
                                            ·
                                          </span>
                                          <span>
                                            {stats.fileCount}{" "}
                                            {stats.fileCount === 1
                                              ? "file"
                                              : "files"}
                                          </span>
                                          {(stats.additions > 0 ||
                                            stats.deletions > 0) && (
                                            <>
                                              <span className="text-green-600 dark:text-green-400">
                                                +{stats.additions}
                                              </span>
                                              <span className="text-red-600 dark:text-red-400">
                                                -{stats.deletions}
                                              </span>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </>
                                  )
                                }
                                onArchive={() =>
                                  handleArchiveSubChat(subChat.id)
                                }
                                archiveLabel="Archive agent"
                                onClick={(e) =>
                                  handleSubChatItemClick(
                                    subChat.id,
                                    e,
                                    globalIndex,
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSubChatItemClick(
                                      subChat.id,
                                      undefined,
                                      globalIndex,
                                    );
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredChatIndex(globalIndex);
                                  handleSubChatMouseEnter(
                                    subChat.id,
                                    subChat.name || "New Chat",
                                    e.currentTarget,
                                  );
                                }}
                                onMouseLeave={() => {
                                  setHoveredChatIndex(-1);
                                  handleSubChatMouseLeave();
                                }}
                                isJustCreated={justCreatedIds.has(subChat.id)}
                                placeholder="New Chat"
                                nameRefCallback={(el) => {
                                  if (el)
                                    subChatNameRefs.current.set(subChat.id, el);
                                }}
                                dataIndex={globalIndex}
                                dataAttribute="data-subchat-index"
                              />
                            </ContextMenuTrigger>
                            {/* Multi-select context menu */}
                            {isMultiSelectMode &&
                            selectedSubChatIds.has(subChat.id) ? (
                              <ContextMenuContent className="w-48">
                                {canShowPinOption && (
                                  <>
                                    <ContextMenuItem
                                      onClick={
                                        areAllSelectedPinned
                                          ? handleBulkUnpin
                                          : handleBulkPin
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
                        );
                      })}
                    </SidebarListSection>
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
      <MultiSelectFooter
        isVisible={isMultiSelectMode}
        selectedCount={selectedSubChatsCount}
        onCancel={clearSubChatSelection}
        actions={[
          {
            label: "Archive",
            icon: <ArchiveIcon className="h-3.5 w-3.5" />,
            onClick: handleBulkArchive,
          },
        ]}
      />

      {/* Rename Dialog */}
      <AgentsRenameSubChatDialog
        isOpen={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false);
          setRenamingSubChat(null);
        }}
        onSave={handleRenameSave}
        currentName={renamingSubChat?.name || ""}
        isLoading={renameLoading}
      />

      {/* Archive Agent Confirmation Dialog */}
      <AlertDialog
        open={archiveAgentDialogOpen}
        onOpenChange={(open) => {
          setArchiveAgentDialogOpen(open);
          if (!open) {
            setSubChatToArchive(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive agent</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription className="px-5 pb-5">
            Do you want to archive agent{" "}
            <span className="font-medium text-foreground">
              {agentName || subChatToArchive?.name || "this agent"}
            </span>
            ? You can restore it from history later.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchiveAgent} autoFocus>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SubChat name tooltip portal */}
      <SubChatTooltipPortal />
    </div>
  );
}
