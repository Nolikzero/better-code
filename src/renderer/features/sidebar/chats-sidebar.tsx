"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { FolderGit2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  ArchiveIcon,
  QuestionCircleIcon,
  SettingsIcon,
  TrashIcon,
} from "../../components/ui/icons";
import { Input } from "../../components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import {
  agentsHelpPopoverOpenAtom,
  agentsSettingsDialogActiveTabAtom,
  agentsSettingsDialogOpenAtom,
  clearAgentChatSelectionAtom,
  defaultProviderIdAtom,
  isAgentMultiSelectModeAtom,
  selectAllAgentChatsAtom,
  selectedAgentChatIdsAtom,
  selectedAgentChatsCountAtom,
  toggleAgentChatSelectionAtom,
} from "../../lib/atoms";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import { isDesktopApp } from "../../lib/utils/platform";
import {
  activeChatDiffDataAtom,
  agentsUnseenChangesAtom,
  archivePopoverOpenAtom,
  expandedChatIdsAtom,
  justCreatedIdsAtom,
  loadingSubChatsAtom,
  mainContentActiveTabAtom,
  prActionsAtom,
  previousAgentChatIdAtom,
  selectedAgentChatIdAtom,
  selectedDraftIdAtom,
  selectedProjectAtom,
  type UndoItem,
  undoStackAtom,
} from "../agents/atoms";
import { AgentsHelpPopover } from "../agents/components/agents-help-popover";
import { deleteNewChatDraft, useNewChatDrafts } from "../agents/lib/drafts";
import {
  OPEN_SUB_CHATS_CHANGE_EVENT,
  useAgentSubChatStore,
} from "../agents/stores/sub-chat-store";
import { ArchivePopover } from "../agents/ui/archive-popover";
import { BranchSwitchDialog } from "../agents/ui/branch-switch-dialog";
import {
  ChatTreeItem,
  SidebarListSection,
  type SubChatMeta,
} from "./components";
import { useScrollGradients, useTruncatedTooltip } from "./hooks";

interface ChatsSidebarProps {
  onToggleSidebar?: () => void;
  isMobileFullscreen?: boolean;
  onChatSelect?: () => void;
}

export function ChatsSidebar({
  isMobileFullscreen = false,
  onChatSelect,
}: ChatsSidebarProps) {
  const [selectedChatId, setSelectedChatId] = useAtom(selectedAgentChatIdAtom);
  const previousChatId = useAtomValue(previousAgentChatIdAtom);
  const [selectedDraftId, setSelectedDraftId] = useAtom(selectedDraftIdAtom);
  const [loadingSubChats] = useAtom(loadingSubChatsAtom);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedChatIndex, setFocusedChatIndex] = useState<number>(-1);
  const [hoveredChatIndex] = useState<number>(-1);

  // Multi-select state
  const [selectedChatIds, setSelectedChatIds] = useAtom(
    selectedAgentChatIdsAtom,
  );
  const isMultiSelectMode = useAtomValue(isAgentMultiSelectModeAtom);
  const selectedChatsCount = useAtomValue(selectedAgentChatsCountAtom);
  const toggleChatSelection = useSetAtom(toggleAgentChatSelectionAtom);
  const selectAllChats = useSetAtom(selectAllAgentChatsAtom);
  const clearChatSelection = useSetAtom(clearAgentChatSelectionAtom);

  // Diff-related state clearing on project switch
  const setActiveChatDiffData = useSetAtom(activeChatDiffDataAtom);
  const setActiveTab = useSetAtom(mainContentActiveTabAtom);
  const setPrActions = useSetAtom(prActionsAtom);

  // Scroll gradient via shared hook
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    showTopGradient,
    showBottomGradient,
    handleScroll: handleAgentsScroll,
  } = useScrollGradients(scrollContainerRef);

  // Multiple drafts state
  const drafts = useNewChatDrafts();

  // Read unseen changes from global atoms
  const unseenChanges = useAtomValue(agentsUnseenChangesAtom);
  const archivePopoverOpen = useAtomValue(archivePopoverOpenAtom);
  const justCreatedIds = useAtomValue(justCreatedIdsAtom);
  const defaultProviderId = useAtomValue(defaultProviderIdAtom);

  const [helpPopoverOpen, setHelpPopoverOpen] = useAtom(
    agentsHelpPopoverOpenAtom,
  );
  const [blockHelpTooltip, setBlockHelpTooltip] = useState(false);
  const [blockArchiveTooltip, setBlockArchiveTooltip] = useState(false);
  const prevHelpPopoverOpen = useRef(false);
  const prevArchivePopoverOpen = useRef(false);

  // Track initial mount to skip footer animation on load
  const hasFooterAnimated = useRef(false);

  // Pinned chats (stored in localStorage per project)
  const [pinnedChatIds, setPinnedChatIds] = useState<Set<string>>(new Set());
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Agent name tooltip via shared hook
  const { TooltipPortal: AgentTooltipPortal } = useTruncatedTooltip();

  const setSettingsDialogOpen = useSetAtom(agentsSettingsDialogOpenAtom);
  const setSettingsActiveTab = useSetAtom(agentsSettingsDialogActiveTabAtom);

  // Desktop: use selectedProject instead of teams
  const [selectedProject] = useAtom(selectedProjectAtom);

  // Branch switch state for creating sub-chats
  const [branchSwitchDialogOpen, setBranchSwitchDialogOpen] = useState(false);
  const [pendingBranchSwitch, setPendingBranchSwitch] = useState<{
    currentBranch: string;
    targetBranch: string;
    action: "create-subchat" | "send-message";
    payload?: { chatId: string };
  } | null>(null);

  // Expanded chat IDs for tree view
  const [expandedChatIds, setExpandedChatIds] = useAtom(expandedChatIdsAtom);

  // Fetch chats with sub-chats for selected project
  const { data: chatsWithSubChats } = trpc.chats.listWithSubChats.useQuery(
    { projectId: selectedProject?.id ?? "" },
    { enabled: !!selectedProject?.id },
  );

  const agentChats = chatsWithSubChats;

  // Track open sub-chat changes for reactivity
  const [openSubChatsVersion, setOpenSubChatsVersion] = useState(0);
  useEffect(() => {
    const handleChange = () => setOpenSubChatsVersion((v) => v + 1);
    window.addEventListener(OPEN_SUB_CHATS_CHANGE_EVENT, handleChange);
    return () =>
      window.removeEventListener(OPEN_SUB_CHATS_CHANGE_EVENT, handleChange);
  }, []);

  // Store previous value to avoid unnecessary React Query refetches
  const prevOpenSubChatIdsRef = useRef<string[]>([]);

  // Collect all open sub-chat IDs from localStorage for all workspaces
  const allOpenSubChatIds = useMemo(() => {
    void openSubChatsVersion;
    if (!agentChats) return prevOpenSubChatIdsRef.current;

    const allIds: string[] = [];
    for (const chat of agentChats) {
      try {
        const stored = localStorage.getItem(`agent-open-sub-chats-${chat.id}`);
        if (stored) {
          const ids = JSON.parse(stored) as string[];
          allIds.push(...ids);
        }
      } catch {
        // Skip invalid JSON
      }
    }

    const prev = prevOpenSubChatIdsRef.current;
    const sorted = [...allIds].sort();
    const prevSorted = [...prev].sort();
    if (
      sorted.length === prevSorted.length &&
      sorted.every((id, i) => id === prevSorted[i])
    ) {
      return prev;
    }

    prevOpenSubChatIdsRef.current = allIds;
    return allIds;
  }, [agentChats, openSubChatsVersion]);

  // File changes stats and pending plan approvals via real-time subscription
  const [fileStatsData, setFileStatsData] = useState<
    | Array<{
        chatId: string;
        additions: number;
        deletions: number;
        fileCount: number;
      }>
    | undefined
  >(undefined);
  const [pendingPlanApprovalsData, setPendingPlanApprovalsData] = useState<
    Array<{ subChatId: string; chatId: string }> | undefined
  >(undefined);

  trpc.chats.watchChatStats.useSubscription(
    { openSubChatIds: allOpenSubChatIds },
    {
      enabled: allOpenSubChatIds.length > 0,
      onData: (data) => {
        setFileStatsData(data.fileStats);
        setPendingPlanApprovalsData(data.planApprovals);
      },
    },
  );

  // Fetch all projects for git info
  const { data: projects } = trpc.projects.list.useQuery();

  // Create map for quick project lookup by id
  const projectsMap = useMemo(() => {
    if (!projects) return new Map();
    return new Map(projects.map((p) => [p.id, p]));
  }, [projects]);

  // Fetch all archived chats (to get count)
  const { data: archivedChats } = trpc.chats.listArchived.useQuery({});
  const archivedChatsCount = archivedChats?.length ?? 0;

  // Get utils outside of callbacks
  const utils = trpc.useUtils();

  // Block tooltips temporarily after popover closes
  useEffect(() => {
    if (prevHelpPopoverOpen.current && !helpPopoverOpen) {
      helpButtonRef.current?.blur();
      setBlockHelpTooltip(true);
      const timer = setTimeout(() => setBlockHelpTooltip(false), 300);
      prevHelpPopoverOpen.current = helpPopoverOpen;
      return () => clearTimeout(timer);
    }
    prevHelpPopoverOpen.current = helpPopoverOpen;
  }, [helpPopoverOpen]);

  useEffect(() => {
    if (prevArchivePopoverOpen.current && !archivePopoverOpen) {
      archiveButtonRef.current?.blur();
      setBlockArchiveTooltip(true);
      const timer = setTimeout(() => setBlockArchiveTooltip(false), 300);
      prevArchivePopoverOpen.current = archivePopoverOpen;
      return () => clearTimeout(timer);
    }
    prevArchivePopoverOpen.current = archivePopoverOpen;
  }, [archivePopoverOpen]);

  // Unified undo stack for workspaces and sub-chats
  const [undoStack, setUndoStack] = useAtom(undoStackAtom);

  // Restore chat mutation (for undo)
  const restoreChatMutation = trpc.chats.restore.useMutation({
    onSuccess: (_, variables) => {
      utils.chats.list.invalidate();
      utils.chats.listWithSubChats.invalidate();
      utils.chats.listArchived.invalidate();
      setSelectedChatId(variables.id);
    },
  });

  // Remove workspace item from stack by chatId
  const removeWorkspaceFromStack = useCallback(
    (chatId: string) => {
      setUndoStack((prev) => {
        const index = prev.findIndex(
          (item) => item.type === "workspace" && item.chatId === chatId,
        );
        if (index !== -1) {
          clearTimeout(prev[index].timeoutId);
          return [...prev.slice(0, index), ...prev.slice(index + 1)];
        }
        return prev;
      });
    },
    [setUndoStack],
  );

  // Archive chat mutation
  const archiveChatMutation = trpc.chats.archive.useMutation({
    onSuccess: (_, variables) => {
      utils.chats.list.invalidate();
      utils.chats.listWithSubChats.invalidate();
      utils.chats.listArchived.invalidate();

      if (selectedChatId === variables.id) {
        const isPreviousAvailable =
          previousChatId &&
          agentChats?.some(
            (c) => c.id === previousChatId && c.id !== variables.id,
          );

        if (isPreviousAvailable) {
          setSelectedChatId(previousChatId);
        } else {
          setSelectedChatId(null);
        }
      }

      const timeoutId = setTimeout(() => {
        removeWorkspaceFromStack(variables.id);
      }, 10000);

      setUndoStack((prev) => [
        ...prev,
        {
          type: "workspace",
          chatId: variables.id,
          timeoutId,
        },
      ]);
    },
  });

  // Cmd+Z to undo archive
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && undoStack.length > 0) {
        e.preventDefault();
        const lastItem = undoStack[undoStack.length - 1];
        if (!lastItem) return;

        clearTimeout(lastItem.timeoutId);
        setUndoStack((prev) => prev.slice(0, -1));

        if (lastItem.type === "workspace") {
          restoreChatMutation.mutate({ id: lastItem.chatId });
        } else if (lastItem.type === "subchat") {
          const store = useAgentSubChatStore.getState();
          store.addToOpenSubChats(lastItem.subChatId);
          store.setActiveSubChat(lastItem.subChatId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoStack, setUndoStack, restoreChatMutation]);

  // Batch archive mutation
  const archiveChatsBatchMutation = trpc.chats.archiveBatch.useMutation({
    onSuccess: (_, variables) => {
      utils.chats.list.invalidate();
      utils.chats.listWithSubChats.invalidate();
      utils.chats.listArchived.invalidate();

      const newItems: UndoItem[] = variables.chatIds.map((chatId) => {
        const timeoutId = setTimeout(() => {
          removeWorkspaceFromStack(chatId);
        }, 10000);
        return { type: "workspace" as const, chatId, timeoutId };
      });
      setUndoStack((prev) => [...prev, ...newItems]);
    },
  });

  // Reset selected chat and clear diff state when project changes
  const prevProjectIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevProjectIdRef.current === undefined) {
      prevProjectIdRef.current = selectedProject?.id ?? null;
      return;
    }
    // Check if project actually changed
    const projectChanged =
      prevProjectIdRef.current !== null &&
      prevProjectIdRef.current !== selectedProject?.id;

    if (projectChanged) {
      // Clear selected chat if one was selected
      if (selectedChatId) {
        setSelectedChatId(null);
      }
      // Clear diff-related state to prevent stale data from old project
      setActiveTab("chat");
      setActiveChatDiffData(null);
      setPrActions(null);
    }
    prevProjectIdRef.current = selectedProject?.id ?? null;
  }, [
    selectedProject?.id,
    selectedChatId,
    setSelectedChatId,
    setActiveTab,
    setActiveChatDiffData,
    setPrActions,
  ]);

  // Load pinned IDs from localStorage when project changes
  useEffect(() => {
    if (!selectedProject?.id) {
      setPinnedChatIds(new Set());
      return;
    }
    try {
      const stored = localStorage.getItem(
        `agent-pinned-chats-${selectedProject.id}`,
      );
      setPinnedChatIds(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch {
      setPinnedChatIds(new Set());
    }
  }, [selectedProject?.id]);

  // Save pinned IDs to localStorage when they change
  const prevPinnedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedProject?.id) return;
    if (
      (pinnedChatIds !== prevPinnedRef.current && pinnedChatIds.size > 0) ||
      prevPinnedRef.current.size > 0
    ) {
      localStorage.setItem(
        `agent-pinned-chats-${selectedProject.id}`,
        JSON.stringify([...pinnedChatIds]),
      );
    }
    prevPinnedRef.current = pinnedChatIds;
  }, [pinnedChatIds, selectedProject?.id]);

  // Filter and separate pinned/unpinned agents
  const { pinnedAgents, unpinnedAgents, filteredChats } = useMemo(() => {
    if (!agentChats)
      return { pinnedAgents: [], unpinnedAgents: [], filteredChats: [] };

    const filtered = searchQuery.trim()
      ? agentChats.filter((chat) =>
          (chat.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : agentChats;

    const pinned = filtered.filter((chat) => pinnedChatIds.has(chat.id));
    const unpinned = filtered.filter((chat) => !pinnedChatIds.has(chat.id));

    return {
      pinnedAgents: pinned,
      unpinnedAgents: unpinned,
      filteredChats: [...pinned, ...unpinned],
    };
  }, [searchQuery, agentChats, pinnedChatIds]);

  // Handle bulk archive of selected chats
  const handleBulkArchive = useCallback(() => {
    const chatIdsToArchive = Array.from(selectedChatIds);
    if (chatIdsToArchive.length === 0) return;

    const isArchivingActiveChat =
      selectedChatId && chatIdsToArchive.includes(selectedChatId);

    archiveChatsBatchMutation.mutate(
      { chatIds: chatIdsToArchive },
      {
        onSuccess: () => {
          if (isArchivingActiveChat) {
            const remainingChats = filteredChats.filter(
              (c) => !chatIdsToArchive.includes(c.id),
            );
            const isPreviousAvailable =
              previousChatId &&
              remainingChats.some((c) => c.id === previousChatId);

            if (isPreviousAvailable) {
              setSelectedChatId(previousChatId);
            } else {
              setSelectedChatId(null);
            }
          }
          clearChatSelection();
        },
      },
    );
  }, [
    selectedChatIds,
    selectedChatId,
    previousChatId,
    filteredChats,
    archiveChatsBatchMutation,
    setSelectedChatId,
    clearChatSelection,
  ]);

  // Delete a draft from localStorage
  const handleDeleteDraft = useCallback(
    (draftId: string) => {
      deleteNewChatDraft(draftId);
      if (selectedDraftId === draftId) {
        setSelectedDraftId(null);
      }
    },
    [selectedDraftId, setSelectedDraftId],
  );

  // Reset focused index when search query changes
  useEffect(() => {
    setFocusedChatIndex(-1);
  }, [searchQuery, filteredChats.length]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedChatIndex >= 0 && filteredChats.length > 0) {
      const focusedElement = scrollContainerRef.current?.querySelector(
        `[data-chat-index="${focusedChatIndex}"]`,
      ) as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [focusedChatIndex, filteredChats.length]);

  // Derive which chats have loading sub-chats
  const loadingChatIds = useMemo(
    () => new Set([...loadingSubChats.values()]),
    [loadingSubChats],
  );

  // Convert file stats from DB to a Map
  const workspaceFileStats = useMemo(() => {
    const statsMap = new Map<
      string,
      { fileCount: number; additions: number; deletions: number }
    >();
    if (fileStatsData) {
      for (const stat of fileStatsData) {
        statsMap.set(stat.chatId, {
          fileCount: stat.fileCount,
          additions: stat.additions,
          deletions: stat.deletions,
        });
      }
    }
    return statsMap;
  }, [fileStatsData]);

  // Aggregate pending plan approvals by workspace
  const workspacePendingPlans = useMemo(() => {
    const chatIdsWithPendingPlans = new Set<string>();
    if (pendingPlanApprovalsData) {
      for (const { chatId } of pendingPlanApprovalsData) {
        chatIdsWithPendingPlans.add(chatId);
      }
    }
    return chatIdsWithPendingPlans;
  }, [pendingPlanApprovalsData]);

  // Toggle expand/collapse for a chat in tree view
  const handleToggleExpand = useCallback(
    (chatId: string) => {
      setExpandedChatIds((prev) => {
        if (prev.includes(chatId)) {
          return prev.filter((id) => id !== chatId);
        }
        return [...prev, chatId];
      });
    },
    [setExpandedChatIds],
  );

  // Auto-expand chat when selected
  useEffect(() => {
    if (selectedChatId && !expandedChatIds.includes(selectedChatId)) {
      setExpandedChatIds((prev) => [...prev, selectedChatId]);
    }
  }, [selectedChatId, expandedChatIds, setExpandedChatIds]);

  // Handle sub-chat selection in tree view
  const handleSubChatSelect = useCallback(
    (chatId: string, subChatId: string) => {
      setSelectedChatId(chatId);
      const store = useAgentSubChatStore.getState();
      store.setChatId(chatId);
      store.addToOpenSubChats(subChatId);
      store.setActiveSubChat(subChatId);
      if (isMobileFullscreen && onChatSelect) {
        onChatSelect();
      }
    },
    [setSelectedChatId, isMobileFullscreen, onChatSelect],
  );

  // Create new sub-chat for a workspace
  const createSubChatMutation = trpc.chats.createSubChat.useMutation({
    onSuccess: (newSubChat, variables) => {
      utils.chats.listWithSubChats.invalidate();
      setSelectedChatId(variables.chatId);
      const store = useAgentSubChatStore.getState();
      store.setChatId(variables.chatId);
      store.addToOpenSubChats(newSubChat.id);
      store.setActiveSubChat(newSubChat.id);
    },
  });

  // Mutation for checking out branch before creating sub-chat
  const checkoutBranchMutation = trpc.changes.checkoutBranch.useMutation({
    onError: (error) => {
      toast.error(error.message || "Failed to switch branch");
    },
    onSuccess: () => {
      utils.changes.getBranches.invalidate();
    },
  });

  const handleCreateSubChat = useCallback(
    async (chatId: string) => {
      const chatData = chatsWithSubChats?.find((c) => c.id === chatId);
      const projectPath = selectedProject?.path;
      const worktreePath = chatData?.worktreePath;

      const isWorktreeMode =
        worktreePath && projectPath && worktreePath !== projectPath;
      const isLocalMode = !isWorktreeMode && projectPath;

      const chatBranch = chatData?.branch;

      if (isLocalMode && chatBranch && projectPath) {
        let currentBranch: string | undefined;
        try {
          const freshBranches = await utils.changes.getBranches.fetch({
            worktreePath: projectPath,
          });
          currentBranch = freshBranches.currentBranch;
        } catch {
          // Fall back
        }

        if (currentBranch && chatBranch !== currentBranch) {
          setPendingBranchSwitch({
            currentBranch,
            targetBranch: chatBranch,
            action: "create-subchat",
            payload: { chatId },
          });
          setBranchSwitchDialogOpen(true);
          return;
        }
      }

      createSubChatMutation.mutate({
        chatId,
        mode: "agent",
        providerId: defaultProviderId,
      });
    },
    [
      createSubChatMutation,
      chatsWithSubChats,
      selectedProject?.path,
      utils.changes.getBranches,
      defaultProviderId,
    ],
  );

  // Handler for confirming branch switch and creating sub-chat
  const handleConfirmBranchSwitch = useCallback(async () => {
    if (
      !pendingBranchSwitch ||
      !selectedProject?.path ||
      !pendingBranchSwitch.payload?.chatId
    )
      return;

    try {
      await checkoutBranchMutation.mutateAsync({
        projectPath: selectedProject.path,
        branch: pendingBranchSwitch.targetBranch,
      });

      createSubChatMutation.mutate({
        chatId: pendingBranchSwitch.payload.chatId,
        mode: "agent",
        providerId: defaultProviderId,
      });
    } catch {
      // Error already handled
    } finally {
      setBranchSwitchDialogOpen(false);
      setPendingBranchSwitch(null);
    }
  }, [
    pendingBranchSwitch,
    selectedProject?.path,
    checkoutBranchMutation,
    createSubChatMutation,
    defaultProviderId,
  ]);

  // Delete sub-chat mutation
  const deleteSubChatMutation = trpc.chats.deleteSubChat.useMutation({
    onSuccess: () => {
      utils.chats.listWithSubChats.invalidate();
      toast.success("Chat deleted");
    },
    onError: () => {
      toast.error("Failed to delete chat");
    },
  });

  // Handle delete sub-chat
  const handleDeleteSubChat = useCallback(
    (subChatId: string) => {
      const store = useAgentSubChatStore.getState();
      const activeId = store.activeSubChatId;

      store.removeFromOpenSubChats(subChatId);
      deleteSubChatMutation.mutate({ id: subChatId });

      if (activeId === subChatId) {
        const openIds = store.openSubChatIds.filter((id) => id !== subChatId);
        if (openIds.length > 0) {
          store.setActiveSubChat(openIds[0]!);
        }
      }
    },
    [deleteSubChatMutation],
  );

  const handleChatClick = (
    chatId: string,
    e?: React.MouseEvent,
    globalIndex?: number,
  ) => {
    // Shift+click for range selection
    if (e?.shiftKey) {
      e.preventDefault();

      const clickedIndex =
        globalIndex ?? filteredChats.findIndex((c) => c.id === chatId);

      if (clickedIndex === -1) return;

      let anchorIndex = -1;

      if (selectedChatId) {
        anchorIndex = filteredChats.findIndex((c) => c.id === selectedChatId);
      }

      if (anchorIndex === -1 && selectedChatIds.size > 0) {
        for (let i = 0; i < filteredChats.length; i++) {
          if (selectedChatIds.has(filteredChats[i]!.id)) {
            anchorIndex = i;
            break;
          }
        }
      }

      if (anchorIndex === -1) {
        if (!selectedChatIds.has(chatId)) {
          toggleChatSelection(chatId);
        }
        return;
      }

      const startIndex = Math.min(anchorIndex, clickedIndex);
      const endIndex = Math.max(anchorIndex, clickedIndex);

      const newSelection = new Set(selectedChatIds);
      for (let i = startIndex; i <= endIndex; i++) {
        const chat = filteredChats[i];
        if (chat) {
          newSelection.add(chat.id);
        }
      }
      setSelectedChatIds(newSelection);
      return;
    }

    setSelectedChatId(chatId);
    if (isMobileFullscreen && onChatSelect) {
      onChatSelect();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  };

  // Direct listener for Cmd+F to focus search input
  useEffect(() => {
    const handleSearchHotkey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.code === "KeyF" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleSearchHotkey, true);

    return () => {
      window.removeEventListener("keydown", handleSearchHotkey, true);
    };
  }, []);

  // Multi-select hotkeys
  useHotkeys("x", () => {
    if (!filteredChats || filteredChats.length === 0) return;

    const targetIndex =
      hoveredChatIndex >= 0
        ? hoveredChatIndex
        : focusedChatIndex >= 0
          ? focusedChatIndex
          : -1;

    if (targetIndex >= 0 && targetIndex < filteredChats.length) {
      const chatId = filteredChats[targetIndex]!.id;
      toggleChatSelection(chatId);
    }
  }, [filteredChats, hoveredChatIndex, focusedChatIndex, toggleChatSelection]);

  // Cmd+A / Ctrl+A to select all chats
  useHotkeys(
    "mod+a",
    (e) => {
      if (isMultiSelectMode && filteredChats && filteredChats.length > 0) {
        e.preventDefault();
        selectAllChats(filteredChats.map((c) => c.id));
      }
    },
    [filteredChats, selectAllChats, isMultiSelectMode],
  );

  // Escape to clear selection
  useHotkeys("escape", () => {
    if (isMultiSelectMode) {
      clearChatSelection();
      setFocusedChatIndex(-1);
    }
  }, [isMultiSelectMode, clearChatSelection]);

  // Cmd+E to archive current workspace
  useEffect(() => {
    const handleArchiveHotkey = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp();

      const isDesktopShortcut =
        isDesktop &&
        e.metaKey &&
        e.code === "KeyE" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey;
      const isWebShortcut = e.altKey && e.metaKey && e.code === "KeyE";

      if (isDesktopShortcut || isWebShortcut) {
        e.preventDefault();

        if (isMultiSelectMode && selectedChatIds.size > 0) {
          if (!archiveChatsBatchMutation.isPending) {
            handleBulkArchive();
          }
          return;
        }

        if (selectedChatId && !archiveChatMutation.isPending) {
          archiveChatMutation.mutate({ id: selectedChatId });
        }
      }
    };

    window.addEventListener("keydown", handleArchiveHotkey);
    return () => window.removeEventListener("keydown", handleArchiveHotkey);
  }, [
    selectedChatId,
    archiveChatMutation,
    isMultiSelectMode,
    selectedChatIds,
    archiveChatsBatchMutation,
    handleBulkArchive,
  ]);

  // Clear selection when project changes
  useEffect(() => {
    clearChatSelection();
  }, [selectedProject?.id, clearChatSelection]);

  return (
    <>
      <div
        className={cn(
          "group/sidebar flex flex-col gap-0 overflow-hidden select-none h-full",
        )}
      >
        {/* Search */}
        <div className="px-2 pt-3 pb-3 shrink-0">
          <div className="space-y-2">
            <div className="relative">
              <Input
                ref={searchInputRef}
                placeholder="Search workspaces..."
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
                      return prev < filteredChats.length - 1 ? prev + 1 : prev;
                    });
                    return;
                  }

                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setFocusedChatIndex((prev) => {
                      if (prev === -1) return filteredChats.length - 1;
                      return prev > 0 ? prev - 1 : prev;
                    });
                    return;
                  }

                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (focusedChatIndex >= 0) {
                      const focusedChat = filteredChats[focusedChatIndex];
                      if (focusedChat) {
                        handleChatClick(focusedChat.id);
                        searchInputRef.current?.blur();
                        setFocusedChatIndex(-1);
                      }
                    }
                    return;
                  }
                }}
                className={cn(
                  "w-full rounded-lg text-sm border border-input placeholder:text-muted-foreground/40",
                  isMobileFullscreen ? "h-10" : "h-7",
                )}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Agents List */}
        <div className="flex-1 min-h-0 relative">
          <div
            ref={scrollContainerRef}
            onScroll={handleAgentsScroll}
            className={cn(
              "h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
              isMultiSelectMode ? "px-0" : "px-2",
            )}
          >
            {/* Drafts Section */}
            {drafts.length > 0 && !searchQuery && (
              <div className={cn("mb-4", isMultiSelectMode ? "px-0" : "-mx-1")}>
                <div
                  className={cn(
                    "flex items-center h-4 mb-1",
                    isMultiSelectMode ? "pl-3" : "pl-2",
                  )}
                >
                  <h3 className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    Drafts
                  </h3>
                </div>
                <div className="list-none p-0 m-0">
                  {drafts.map((draft) => {
                    const isSelected =
                      selectedDraftId === draft.id && !selectedChatId;
                    return (
                      <div
                        key={draft.id}
                        onClick={() => {
                          setSelectedChatId(null);
                          setSelectedDraftId(draft.id);
                          if (isMobileFullscreen && onChatSelect) {
                            onChatSelect();
                          }
                        }}
                        className={cn(
                          "w-full text-left py-1.5 cursor-pointer group relative mt-2",
                          "transition-colors duration-150",
                          "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
                          isMultiSelectMode ? "px-3" : "pl-2 pr-2",
                          !isMultiSelectMode && "rounded-md",
                          isSelected
                            ? "bg-foreground/5 text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="pt-0.5">
                            <div className="relative shrink-0 w-4 h-4">
                              {draft.project?.gitOwner &&
                              draft.project?.gitProvider === "github" ? (
                                <img
                                  src={`https://github.com/${draft.project.gitOwner}.png?size=64`}
                                  alt={draft.project.gitOwner}
                                  className="h-4 w-4 rounded-xs shrink-0"
                                />
                              ) : (
                                <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="truncate block text-sm leading-tight flex-1">
                                {draft.text.slice(0, 50)}
                                {draft.text.length > 50 ? "..." : ""}
                              </span>
                              {!isMultiSelectMode && !isMobileFullscreen && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDraft(draft.id);
                                  }}
                                  tabIndex={-1}
                                  className="shrink-0 text-muted-foreground hover:text-foreground active:text-foreground transition-[opacity,transform,color] duration-150 ease-out opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto active:scale-[0.97]"
                                  aria-label="Delete draft"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground/60 truncate">
                                <span className="text-blue-500">Draft</span>
                                {draft.project?.gitRepo
                                  ? ` • ${draft.project.gitRepo}`
                                  : draft.project?.name
                                    ? ` • ${draft.project.name}`
                                    : ""}
                              </span>
                              <span className="text-[11px] text-muted-foreground/60 shrink-0">
                                {formatTime(
                                  new Date(draft.updatedAt).toISOString(),
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chats Section - Tree View */}
            {filteredChats.length > 0 ? (
              <div className={cn("mb-4", isMultiSelectMode ? "px-0" : "-mx-1")}>
                {/* Pinned section */}
                {pinnedAgents.length > 0 && (
                  <SidebarListSection
                    title="Pinned workspaces"
                    isMultiSelectMode={isMultiSelectMode}
                    className="mb-3"
                  >
                    {pinnedAgents.map((chat) => {
                      const isLoading = loadingChatIds.has(chat.id);
                      const isSelected = selectedChatId === chat.id;
                      const hasPendingPlan = workspacePendingPlans.has(chat.id);
                      const project = projectsMap.get(chat.projectId);
                      const activeSubChat =
                        useAgentSubChatStore.getState().activeSubChatId;
                      const subChats =
                        (chat as typeof chat & { subChats?: SubChatMeta[] })
                          .subChats || [];
                      const stats = workspaceFileStats.get(chat.id);

                      return (
                        <ChatTreeItem
                          key={chat.id}
                          id={chat.id}
                          name={chat.name}
                          branch={chat.branch}
                          isExpanded={expandedChatIds.includes(chat.id)}
                          isSelected={isSelected}
                          isLoading={isLoading}
                          hasUnseenChanges={unseenChanges.has(chat.id)}
                          hasPendingPlan={hasPendingPlan}
                          isJustCreated={justCreatedIds.has(chat.id)}
                          subChats={subChats}
                          activeSubChatId={activeSubChat}
                          loadingSubChatIds={
                            new Set([...loadingSubChats.keys()])
                          }
                          gitOwner={project?.gitOwner}
                          gitProvider={project?.gitProvider}
                          fileAdditions={stats?.additions}
                          fileDeletions={stats?.deletions}
                          fileCount={stats?.fileCount}
                          onToggleExpand={() => handleToggleExpand(chat.id)}
                          onSelect={() => handleChatClick(chat.id)}
                          onSelectSubChat={(subChatId) =>
                            handleSubChatSelect(chat.id, subChatId)
                          }
                          onArchive={() =>
                            archiveChatMutation.mutate({ id: chat.id })
                          }
                          onCreateSubChat={() => handleCreateSubChat(chat.id)}
                          onDeleteSubChat={handleDeleteSubChat}
                        />
                      );
                    })}
                  </SidebarListSection>
                )}

                {/* Unpinned section */}
                {unpinnedAgents.length > 0 && (
                  <SidebarListSection
                    title={
                      pinnedAgents.length > 0
                        ? "Recent workspaces"
                        : "Workspaces"
                    }
                    isMultiSelectMode={isMultiSelectMode}
                  >
                    {unpinnedAgents.map((chat) => {
                      const isLoading = loadingChatIds.has(chat.id);
                      const isSelected = selectedChatId === chat.id;
                      const hasPendingPlan = workspacePendingPlans.has(chat.id);
                      const project = projectsMap.get(chat.projectId);
                      const activeSubChat =
                        useAgentSubChatStore.getState().activeSubChatId;
                      const subChats =
                        (chat as typeof chat & { subChats?: SubChatMeta[] })
                          .subChats || [];
                      const stats = workspaceFileStats.get(chat.id);

                      return (
                        <ChatTreeItem
                          key={chat.id}
                          id={chat.id}
                          name={chat.name}
                          branch={chat.branch}
                          isExpanded={expandedChatIds.includes(chat.id)}
                          isSelected={isSelected}
                          isLoading={isLoading}
                          hasUnseenChanges={unseenChanges.has(chat.id)}
                          hasPendingPlan={hasPendingPlan}
                          isJustCreated={justCreatedIds.has(chat.id)}
                          subChats={subChats}
                          activeSubChatId={activeSubChat}
                          loadingSubChatIds={
                            new Set([...loadingSubChats.keys()])
                          }
                          gitOwner={project?.gitOwner}
                          gitProvider={project?.gitProvider}
                          fileAdditions={stats?.additions}
                          fileDeletions={stats?.deletions}
                          fileCount={stats?.fileCount}
                          onToggleExpand={() => handleToggleExpand(chat.id)}
                          onSelect={() => handleChatClick(chat.id)}
                          onSelectSubChat={(subChatId) =>
                            handleSubChatSelect(chat.id, subChatId)
                          }
                          onArchive={() =>
                            archiveChatMutation.mutate({ id: chat.id })
                          }
                          onCreateSubChat={() => handleCreateSubChat(chat.id)}
                          onDeleteSubChat={handleDeleteSubChat}
                        />
                      );
                    })}
                  </SidebarListSection>
                )}
              </div>
            ) : null}
          </div>

          {/* Top gradient fade */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-b from-tl-background via-tl-background/50 to-transparent transition-opacity duration-200",
              showTopGradient ? "opacity-100" : "opacity-0",
            )}
          />

          {/* Bottom gradient fade */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-12 pointer-events-none bg-gradient-to-t from-tl-background via-tl-background/50 to-transparent transition-opacity duration-200",
              showBottomGradient ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        {/* Footer */}
        <AnimatePresence mode="wait">
          {isMultiSelectMode ? (
            <motion.div
              key="multi-select-footer"
              initial={hasFooterAnimated.current ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0 }}
              onAnimationComplete={() => {
                hasFooterAnimated.current = true;
              }}
              className="p-2 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  {selectedChatsCount} selected
                </span>
                <button
                  onClick={clearChatSelection}
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
                  disabled={archiveChatsBatchMutation.isPending}
                  className="flex-1 h-8 gap-1.5 text-xs rounded-lg"
                >
                  <ArchiveIcon className="h-3.5 w-3.5" />
                  {archiveChatsBatchMutation.isPending
                    ? "Archiving..."
                    : "Archive"}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="normal-footer"
              initial={hasFooterAnimated.current ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0 }}
              onAnimationComplete={() => {
                hasFooterAnimated.current = true;
              }}
              className="p-2 pt-2 flex flex-col gap-2"
            >
              <div className="flex items-center">
                <div className="flex items-center gap-1">
                  {/* Settings Button */}
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsActiveTab("profile");
                          setSettingsDialogOpen(true);
                        }}
                        className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                      >
                        <SettingsIcon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Settings</TooltipContent>
                  </Tooltip>

                  <Tooltip
                    delayDuration={500}
                    open={
                      helpPopoverOpen || blockHelpTooltip ? false : undefined
                    }
                  >
                    <TooltipTrigger asChild>
                      <div>
                        <AgentsHelpPopover
                          open={helpPopoverOpen}
                          onOpenChange={setHelpPopoverOpen}
                          isMobile={isMobileFullscreen}
                        >
                          <button
                            ref={helpButtonRef}
                            type="button"
                            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                            suppressHydrationWarning
                          >
                            <QuestionCircleIcon className="h-4 w-4" />
                          </button>
                        </AgentsHelpPopover>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Help</TooltipContent>
                  </Tooltip>

                  {/* Archive Button */}
                  {archivedChatsCount > 0 && (
                    <Tooltip
                      delayDuration={500}
                      open={
                        archivePopoverOpen || blockArchiveTooltip
                          ? false
                          : undefined
                      }
                    >
                      <TooltipTrigger asChild>
                        <div>
                          <ArchivePopover
                            trigger={
                              <button
                                ref={archiveButtonRef}
                                type="button"
                                className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                              >
                                <ArchiveIcon className="h-4 w-4" />
                              </button>
                            }
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Archive</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="flex-1" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Agent name tooltip portal */}
      <AgentTooltipPortal />

      {/* Branch Switch Confirmation Dialog */}
      <BranchSwitchDialog
        open={branchSwitchDialogOpen}
        onOpenChange={(open) => {
          if (!checkoutBranchMutation.isPending) {
            setBranchSwitchDialogOpen(open);
          }
        }}
        pendingSwitch={pendingBranchSwitch}
        isPending={checkoutBranchMutation.isPending}
        onConfirm={handleConfirmBranchSwitch}
        onCancel={() => {
          if (!checkoutBranchMutation.isPending) {
            setBranchSwitchDialogOpen(false);
            setPendingBranchSwitch(null);
          }
        }}
      />
    </>
  );
}
