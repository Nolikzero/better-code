"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, FolderGit2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button as ButtonCustom } from "../../components/ui/button";
import {
  agentsHelpPopoverOpenAtom,
  agentsSettingsDialogActiveTabAtom,
  agentsSettingsDialogOpenAtom,
  agentsShortcutsDialogOpenAtom,
  clearAgentChatSelectionAtom,
  createTeamDialogOpenAtom,
  isAgentMultiSelectModeAtom,
  isDesktopAtom,
  isFullscreenAtom,
  selectAllAgentChatsAtom,
  selectedAgentChatIdsAtom,
  selectedAgentChatsCountAtom,
  toggleAgentChatSelectionAtom,
} from "../../lib/atoms";
import { cn } from "../../lib/utils";
import { ArchivePopover } from "../agents/ui/archive-popover";

// import { useRouter } from "next/navigation" // Desktop doesn't use next/navigation
// import { useCombinedAuth } from "@/lib/hooks/use-combined-auth"
const useCombinedAuth = () => ({ userId: null, isLoaded: true });
// import { AuthDialog } from "@/components/auth/auth-dialog"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AuthDialog = (_props: any) => null;

import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  ArchiveIcon,
  IconDoubleChevronLeft,
  KeyboardIcon,
  ProfileIcon,
  QuestionCircleIcon,
  SettingsIcon,
  TrashIcon,
} from "../../components/ui/icons";
import { Input } from "../../components/ui/input";
import { Kbd } from "../../components/ui/kbd";
import { Logo } from "../../components/ui/logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { trpc } from "../../lib/trpc";
import { isDesktopApp } from "../../lib/utils/platform";
import {
  agentsDebugModeAtom,
  agentsUnseenChangesAtom,
  archivePopoverOpenAtom,
  expandedChatIdsAtom,
  justCreatedIdsAtom,
  loadingSubChatsAtom,
  previousAgentChatIdAtom,
  selectedAgentChatIdAtom,
  selectedDraftIdAtom,
  selectedProjectAtom,
  type UndoItem,
  undoStackAtom,
} from "../agents/atoms";
import { AgentsHelpPopover } from "../agents/components/agents-help-popover";
// Desktop: archive is handled inline, not via hook
// import { DiscordIcon } from "@/components/icons"
import { AgentsRenameSubChatDialog } from "../agents/components/agents-rename-subchat-dialog";
import {
  TrafficLightSpacer,
  TrafficLights,
} from "../agents/components/traffic-light-spacer";
import { deleteNewChatDraft, useNewChatDrafts } from "../agents/lib/drafts";
import {
  OPEN_SUB_CHATS_CHANGE_EVENT,
  useAgentSubChatStore,
} from "../agents/stores/sub-chat-store";
import { BranchSwitchDialog } from "../agents/ui/branch-switch-dialog";
import { SubChatContextMenu } from "../agents/ui/sub-chat-context-menu";
import {
  ChatTreeItem,
  ProjectSelectorHeader,
  SidebarListSection,
  type SubChatMeta,
} from "./components";
import { useScrollGradients, useTruncatedTooltip } from "./hooks";
import { useHaptic } from "./hooks/use-haptic";

interface AgentsSidebarProps {
  userId?: string | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clerkUser?: any;
  desktopUser?: {
    id: string;
    email: string;
    name?: string | null;
    imageUrl?: string | null;
    username?: string | null;
  } | null;
  onSignOut?: () => void;
  onToggleSidebar?: () => void;
  isMobileFullscreen?: boolean;
  onChatSelect?: () => void;
}

export function AgentsSidebar({
  userId = "demo-user-id",
  desktopUser = {
    id: "demo-user-id",
    email: "demo@example.com",
    name: "Demo User",
  },
  onSignOut = () => {},
  onToggleSidebar,
  isMobileFullscreen = false,
  onChatSelect,
}: AgentsSidebarProps) {
  const [selectedChatId, setSelectedChatId] = useAtom(selectedAgentChatIdAtom);
  const previousChatId = useAtomValue(previousAgentChatIdAtom);
  const [selectedDraftId, setSelectedDraftId] = useAtom(selectedDraftIdAtom);
  const [loadingSubChats] = useAtom(loadingSubChatsAtom);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedChatIndex, setFocusedChatIndex] = useState<number>(-1); // -1 means no focus
  const [hoveredChatIndex] = useState<number>(-1); // Track hovered chat for X hotkey

  // Global desktop/fullscreen state from atoms (initialized in AgentsLayout)
  const isDesktop = useAtomValue(isDesktopAtom);
  const isFullscreen = useAtomValue(isFullscreenAtom);

  // Multi-select state
  const [selectedChatIds, setSelectedChatIds] = useAtom(
    selectedAgentChatIdsAtom,
  );
  const isMultiSelectMode = useAtomValue(isAgentMultiSelectModeAtom);
  const selectedChatsCount = useAtomValue(selectedAgentChatsCountAtom);
  const toggleChatSelection = useSetAtom(toggleAgentChatSelectionAtom);
  const selectAllChats = useSetAtom(selectAllAgentChatsAtom);
  const clearChatSelection = useSetAtom(clearAgentChatSelectionAtom);

  // Scroll gradient via shared hook
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    showTopGradient,
    showBottomGradient,
    handleScroll: handleAgentsScroll,
  } = useScrollGradients(scrollContainerRef);

  // Multiple drafts state - uses event-based sync instead of polling
  const drafts = useNewChatDrafts();

  // Read unseen changes from global atoms
  const unseenChanges = useAtomValue(agentsUnseenChangesAtom);
  const archivePopoverOpen = useAtomValue(archivePopoverOpenAtom);
  const justCreatedIds = useAtomValue(justCreatedIdsAtom);

  const [helpPopoverOpen, setHelpPopoverOpen] = useAtom(
    agentsHelpPopoverOpenAtom,
  );
  const setShortcutsDialogOpen = useSetAtom(agentsShortcutsDialogOpenAtom);
  const [blockHelpTooltip, setBlockHelpTooltip] = useState(false);
  const [blockArchiveTooltip, setBlockArchiveTooltip] = useState(false);
  const prevHelpPopoverOpen = useRef(false);
  const prevArchivePopoverOpen = useRef(false);

  // Haptic feedback
  const { trigger: triggerHaptic } = useHaptic();

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingChat, setRenamingChat] = useState<{
    id: string;
    name: string | null;
  } | null>(null);
  const [renameLoading, setRenameLoading] = useState(false);

  // Track initial mount to skip footer animation on load
  const hasFooterAnimated = useRef(false);

  // Pinned chats (stored in localStorage per project)
  const [pinnedChatIds, setPinnedChatIds] = useState<Set<string>>(new Set());
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const archiveButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Agent name tooltip via shared hook
  const { tooltip: _agentTooltip, TooltipPortal: AgentTooltipPortal } =
    useTruncatedTooltip();

  const setSettingsDialogOpen = useSetAtom(agentsSettingsDialogOpenAtom);
  const setSettingsActiveTab = useSetAtom(agentsSettingsDialogActiveTabAtom);
  const { isLoaded: _isAuthLoaded } = useCombinedAuth();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const _setCreateTeamDialogOpen = useSetAtom(createTeamDialogOpenAtom);

  // Debug mode for testing first-time user experience
  const _debugMode = useAtomValue(agentsDebugModeAtom);

  // Desktop: use selectedProject instead of teams
  const [selectedProject] = useAtom(selectedProjectAtom);

  // Branch switch state for creating sub-chats (needs local state since chatId varies)
  const [branchSwitchDialogOpen, setBranchSwitchDialogOpen] = useState(false);
  const [pendingBranchSwitch, setPendingBranchSwitch] = useState<{
    currentBranch: string;
    targetBranch: string;
    action: "create-subchat" | "send-message";
    payload?: { chatId: string };
  } | null>(null);

  // Expanded chat IDs for tree view
  const [expandedChatIds, setExpandedChatIds] = useAtom(expandedChatIdsAtom);

  // Fetch chats with sub-chats for selected project (tree view)
  const { data: chatsWithSubChats } = trpc.chats.listWithSubChats.useQuery(
    { projectId: selectedProject?.id ?? "" },
    { enabled: !!selectedProject?.id },
  );

  // Fallback to flat list for backwards compatibility
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
    // openSubChatsVersion is used to trigger recalculation when sub-chats change
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

    // Compare with previous - if content is same, return old reference
    // This prevents React Query from refetching when array content hasn't changed
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

  // File changes stats from DB - only for open sub-chats
  // Reduced polling from 5s to 30s for performance (data is not time-critical)
  const { data: fileStatsData } = trpc.chats.getFileStats.useQuery(
    { openSubChatIds: allOpenSubChatIds },
    {
      refetchInterval: 30000,
      enabled: allOpenSubChatIds.length > 0,
      placeholderData: (prev) => prev,
    },
  );

  // Pending plan approvals from DB - only for open sub-chats
  // Reduced polling from 5s to 30s for performance (data is not time-critical)
  const { data: pendingPlanApprovalsData } =
    trpc.chats.getPendingPlanApprovals.useQuery(
      { openSubChatIds: allOpenSubChatIds },
      {
        refetchInterval: 30000,
        enabled: allOpenSubChatIds.length > 0,
        placeholderData: (prev) => prev,
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

  // Get utils outside of callbacks - hooks must be called at top level
  const utils = trpc.useUtils();

  // Block tooltips temporarily after popover closes and remove focus
  useEffect(() => {
    // Only trigger when transitioning from open (true) to closed (false)
    if (prevHelpPopoverOpen.current && !helpPopoverOpen) {
      // Help popover just closed, remove focus and block tooltip for 300ms
      helpButtonRef.current?.blur();
      setBlockHelpTooltip(true);
      const timer = setTimeout(() => setBlockHelpTooltip(false), 300);
      prevHelpPopoverOpen.current = helpPopoverOpen;
      return () => clearTimeout(timer);
    }
    prevHelpPopoverOpen.current = helpPopoverOpen;
  }, [helpPopoverOpen]);

  useEffect(() => {
    // Only trigger when transitioning from open (true) to closed (false)
    if (prevArchivePopoverOpen.current && !archivePopoverOpen) {
      // Archive popover just closed, remove focus and block tooltip for 300ms
      archiveButtonRef.current?.blur();
      setBlockArchiveTooltip(true);
      const timer = setTimeout(() => setBlockArchiveTooltip(false), 300);
      prevArchivePopoverOpen.current = archivePopoverOpen;
      return () => clearTimeout(timer);
    }
    prevArchivePopoverOpen.current = archivePopoverOpen;
  }, [archivePopoverOpen]);

  // Unified undo stack for workspaces and sub-chats (Jotai atom)
  const [undoStack, setUndoStack] = useAtom(undoStackAtom);

  // Restore chat mutation (for undo)
  const restoreChatMutation = trpc.chats.restore.useMutation({
    onSuccess: (_, variables) => {
      utils.chats.list.invalidate();
      utils.chats.listWithSubChats.invalidate();
      utils.chats.listArchived.invalidate();
      // Select the restored chat
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

      // If archiving the currently selected chat, navigate to previous or new workspace
      if (selectedChatId === variables.id) {
        // Check if previous chat is available (exists and not being archived)
        const isPreviousAvailable =
          previousChatId &&
          agentChats?.some(
            (c) => c.id === previousChatId && c.id !== variables.id,
          );

        if (isPreviousAvailable) {
          setSelectedChatId(previousChatId);
        } else {
          // Fallback to new workspace view
          setSelectedChatId(null);
        }
      }

      // Clear after 10 seconds (Cmd+Z window)
      const timeoutId = setTimeout(() => {
        removeWorkspaceFromStack(variables.id);
      }, 10000);

      // Add to unified undo stack for Cmd+Z
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

  // Cmd+Z to undo archive (supports multiple undos for workspaces AND sub-chats)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && undoStack.length > 0) {
        e.preventDefault();
        // Get the most recent item
        const lastItem = undoStack[undoStack.length - 1];
        if (!lastItem) return;

        // Clear timeout and remove from stack
        clearTimeout(lastItem.timeoutId);
        setUndoStack((prev) => prev.slice(0, -1));

        if (lastItem.type === "workspace") {
          // Restore workspace from archive
          restoreChatMutation.mutate({ id: lastItem.chatId });
        } else if (lastItem.type === "subchat") {
          // Restore sub-chat tab (re-add to open tabs)
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

      // Add each chat to unified undo stack for Cmd+Z
      const newItems: UndoItem[] = variables.chatIds.map((chatId) => {
        const timeoutId = setTimeout(() => {
          removeWorkspaceFromStack(chatId);
        }, 10000);
        return { type: "workspace" as const, chatId, timeoutId };
      });
      setUndoStack((prev) => [...prev, ...newItems]);
    },
  });

  // Reset selected chat when project changes (but not on initial load)
  const prevProjectIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Skip on initial mount (prevProjectIdRef is undefined)
    if (prevProjectIdRef.current === undefined) {
      prevProjectIdRef.current = selectedProject?.id ?? null;
      return;
    }
    // Only reset if project actually changed from a real value (not from null/initial load)
    if (
      prevProjectIdRef.current !== null &&
      prevProjectIdRef.current !== selectedProject?.id &&
      selectedChatId
    ) {
      setSelectedChatId(null);
    }
    prevProjectIdRef.current = selectedProject?.id ?? null;
  }, [selectedProject?.id]); // Don't include selectedChatId in deps to avoid loops

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
    // Only save if pinnedChatIds actually changed (avoid saving on load)
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

  // Rename mutation
  const renameChatMutation = trpc.chats.rename.useMutation({
    onSuccess: () => {
      utils.chats.list.invalidate();
      utils.chats.listWithSubChats.invalidate();
    },
    onError: () => {
      toast.error("Failed to rename agent");
    },
  });

  const handleRenameSave = async (newName: string) => {
    if (!renamingChat) return;

    const chatId = renamingChat.id;
    const oldName = renamingChat.name;

    // Optimistically update the query cache
    utils.chats.list.setData({}, (old) => {
      if (!old) return old;
      return old.map((c) => (c.id === chatId ? { ...c, name: newName } : c));
    });

    setRenameLoading(true);

    try {
      await renameChatMutation.mutateAsync({
        id: chatId,
        name: newName,
      });
    } catch {
      // Rollback on error
      utils.chats.list.setData({}, (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === chatId ? { ...c, name: oldName } : c));
      });
    } finally {
      setRenameLoading(false);
      setRenamingChat(null);
    }
  };

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

    // If active chat is being archived, navigate to previous or new workspace
    const isArchivingActiveChat =
      selectedChatId && chatIdsToArchive.includes(selectedChatId);

    archiveChatsBatchMutation.mutate(
      { chatIds: chatIdsToArchive },
      {
        onSuccess: () => {
          if (isArchivingActiveChat) {
            // Check if previous chat is available (exists and not being archived)
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
      // If the deleted draft was selected, clear selection
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

  // Convert file stats from DB to a Map for easy lookup
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

  // Aggregate pending plan approvals by workspace (chatId) from DB
  const workspacePendingPlans = useMemo(() => {
    const chatIdsWithPendingPlans = new Set<string>();
    if (pendingPlanApprovalsData) {
      for (const { chatId } of pendingPlanApprovalsData) {
        chatIdsWithPendingPlans.add(chatId);
      }
    }
    return chatIdsWithPendingPlans;
  }, [pendingPlanApprovalsData]);

  const handleNewAgent = () => {
    triggerHaptic("light");
    setSelectedChatId(null);
    setSelectedDraftId(null); // Clear selected draft so form starts empty
    // On mobile, switch to chat mode to show NewChatForm
    if (isMobileFullscreen && onChatSelect) {
      onChatSelect();
    }
  };

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
      // Select the parent chat
      setSelectedChatId(chatId);
      // Set the sub-chat as active in the store
      const store = useAgentSubChatStore.getState();
      store.setChatId(chatId);
      store.addToOpenSubChats(subChatId);
      store.setActiveSubChat(subChatId);
      // On mobile, switch to chat mode
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
      // Select the parent workspace
      setSelectedChatId(variables.chatId);
      // Open and select the new sub-chat
      const store = useAgentSubChatStore.getState();
      store.setChatId(variables.chatId);
      store.addToOpenSubChats(newSubChat.id);
      store.setActiveSubChat(newSubChat.id);
    },
  });

  // Mutation for checking out branch before creating sub-chat (doesn't update DB)
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
      // Find the chat data to check its branch
      const chatData = chatsWithSubChats?.find((c) => c.id === chatId);
      const projectPath = selectedProject?.path;
      const worktreePath = chatData?.worktreePath;

      // Determine if this is local mode (not using a separate worktree)
      const isWorktreeMode =
        worktreePath && projectPath && worktreePath !== projectPath;
      const isLocalMode = !isWorktreeMode && projectPath;

      const chatBranch = chatData?.branch;

      // Check if branch switch is needed
      if (isLocalMode && chatBranch && projectPath) {
        let currentBranch: string | undefined;
        try {
          const freshBranches = await utils.changes.getBranches.fetch({
            worktreePath: projectPath,
          });
          currentBranch = freshBranches.currentBranch;
        } catch {
          // Fall back - assume no switch needed
        }

        if (currentBranch && chatBranch !== currentBranch) {
          // Show confirmation dialog instead of creating immediately
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

      // No branch switch needed, create directly
      createSubChatMutation.mutate({ chatId, mode: "agent" });
    },
    [
      createSubChatMutation,
      chatsWithSubChats,
      selectedProject?.path,
      utils.changes.getBranches,
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
      // Switch branch first
      await checkoutBranchMutation.mutateAsync({
        projectPath: selectedProject.path,
        branch: pendingBranchSwitch.targetBranch,
      });

      // Then create sub-chat
      createSubChatMutation.mutate({
        chatId: pendingBranchSwitch.payload.chatId,
        mode: "agent",
      });
    } catch {
      // Error already handled by mutation onError
    } finally {
      setBranchSwitchDialogOpen(false);
      setPendingBranchSwitch(null);
    }
  }, [
    pendingBranchSwitch,
    selectedProject?.path,
    checkoutBranchMutation,
    createSubChatMutation,
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

      // Remove from open tabs first
      store.removeFromOpenSubChats(subChatId);

      // Delete from database
      deleteSubChatMutation.mutate({ id: subChatId });

      // If deleting active, switch to another
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
    // Shift+click for range selection (works in both normal and multi-select mode)
    if (e?.shiftKey) {
      e.preventDefault();

      const clickedIndex =
        globalIndex ?? filteredChats.findIndex((c) => c.id === chatId);

      if (clickedIndex === -1) return;

      // Find the anchor: use active chat or last selected item
      let anchorIndex = -1;

      // First try: use currently active/selected chat as anchor
      if (selectedChatId) {
        anchorIndex = filteredChats.findIndex((c) => c.id === selectedChatId);
      }

      // If no active chat, try to use the last item in selection
      if (anchorIndex === -1 && selectedChatIds.size > 0) {
        // Find the first selected item in the list as anchor
        for (let i = 0; i < filteredChats.length; i++) {
          if (selectedChatIds.has(filteredChats[i]!.id)) {
            anchorIndex = i;
            break;
          }
        }
      }

      // If still no anchor, just select the clicked item
      if (anchorIndex === -1) {
        if (!selectedChatIds.has(chatId)) {
          toggleChatSelection(chatId);
        }
        return;
      }

      // Select range from anchor to clicked item
      const startIndex = Math.min(anchorIndex, clickedIndex);
      const endIndex = Math.max(anchorIndex, clickedIndex);

      // Build new selection set with the range
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

    // In multi-select mode, clicking on the item still navigates to the chat
    // Only clicking on the checkbox toggles selection
    setSelectedChatId(chatId);
    // On mobile, notify parent to switch to chat mode
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
      // Check for Cmd+F or Ctrl+F (only for search functionality)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.code === "KeyF" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        e.stopPropagation();

        // Focus search input
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
  // X to toggle selection of hovered or focused chat
  useHotkeys("x", () => {
    if (!filteredChats || filteredChats.length === 0) return;

    // Prefer hovered, then focused - do NOT fallback to 0 (would conflict with sub-chat sidebar)
    const targetIndex =
      hoveredChatIndex >= 0
        ? hoveredChatIndex
        : focusedChatIndex >= 0
          ? focusedChatIndex
          : -1;

    if (targetIndex >= 0 && targetIndex < filteredChats.length) {
      const chatId = filteredChats[targetIndex]!.id;
      // Toggle selection (both select and deselect)
      toggleChatSelection(chatId);
    }
  }, [filteredChats, hoveredChatIndex, focusedChatIndex, toggleChatSelection]);

  // Cmd+A / Ctrl+A to select all chats (only when at least one is already selected)
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

  // Cmd+E to archive current workspace (desktop) or Opt+Cmd+E (web)
  useEffect(() => {
    const handleArchiveHotkey = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp();

      // Desktop: Cmd+E (without Alt)
      const isDesktopShortcut =
        isDesktop &&
        e.metaKey &&
        e.code === "KeyE" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey;
      // Web: Opt+Cmd+E (with Alt)
      const isWebShortcut = e.altKey && e.metaKey && e.code === "KeyE";

      if (isDesktopShortcut || isWebShortcut) {
        e.preventDefault();

        // If multi-select mode, bulk archive selected chats
        if (isMultiSelectMode && selectedChatIds.size > 0) {
          if (!archiveChatsBatchMutation.isPending) {
            handleBulkArchive();
          }
          return;
        }

        // Otherwise archive current chat
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

  // Mobile fullscreen mode - render without ResizableSidebar wrapper
  const sidebarContent = (
    <div
      className={cn(
        "group/sidebar flex flex-col gap-0 overflow-hidden select-none",
        isMobileFullscreen
          ? "h-full w-full bg-background"
          : "h-full bg-tl-background",
      )}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={(e) => {
        // Electron's drag region (WebkitAppRegion: "drag") returns a non-HTMLElement
        // object as relatedTarget. We preserve hover state in this case so the
        // traffic lights remain visible when hovering over the drag area.
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !(relatedTarget instanceof HTMLElement)) return;
        const isStillInSidebar = relatedTarget.closest(
          "[data-sidebar-content]",
        );
        if (!isStillInSidebar) {
          setIsSidebarHovered(false);
        }
      }}
      data-mobile-fullscreen={isMobileFullscreen || undefined}
      data-sidebar-content
    >
      {/* Header area with close button at top-right (next to traffic lights) */}
      {/* This div has its own hover handlers because the drag region blocks events from bubbling to parent */}
      <div
        className="relative shrink-0"
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={(e) => {
          // Electron's drag region (WebkitAppRegion: "drag") returns a non-HTMLElement
          // object as relatedTarget. We preserve hover state in this case so the
          // traffic lights remain visible when hovering over the drag area.
          const relatedTarget = e.relatedTarget;
          if (!relatedTarget || !(relatedTarget instanceof HTMLElement)) return;
          const isStillInSidebar = relatedTarget.closest(
            "[data-sidebar-content]",
          );
          if (!isStillInSidebar) {
            setIsSidebarHovered(false);
          }
        }}
      >
        {/* Draggable area for window movement - background layer (hidden in fullscreen) */}
        {isDesktop && !isFullscreen && (
          <div
            className="absolute inset-x-0 top-0 h-[32px] z-0"
            style={{
              // @ts-expect-error - WebKit-specific property
              WebkitAppRegion: "drag",
            }}
            data-sidebar-content
          />
        )}

        {/* Custom traffic lights - positioned at top left, centered in 32px area */}
        <TrafficLights
          isHovered={isSidebarHovered || isDropdownOpen}
          isFullscreen={isFullscreen}
          isDesktop={isDesktop}
          className="absolute left-3 top-[10px] z-20"
        />

        {/* Close button - positioned at top right, adjusted for traffic lights area when not fullscreen */}
        {!isMobileFullscreen && (
          <div
            className={cn(
              "absolute right-2 z-20 transition-opacity duration-150",
              // In fullscreen or non-desktop, position at top-2. In desktop mode with traffic lights, also top-2
              "top-2",
              isSidebarHovered || isDropdownOpen ? "opacity-100" : "opacity-0",
            )}
            style={{
              // Make clickable over drag region
              // @ts-expect-error - WebKit-specific property
              WebkitAppRegion: "no-drag",
            }}
          >
            <TooltipProvider>
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <ButtonCustom
                    variant="ghost"
                    size="icon"
                    onClick={onToggleSidebar}
                    tabIndex={-1}
                    className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground shrink-0 rounded-md"
                    aria-label="Close sidebar"
                  >
                    <IconDoubleChevronLeft className="h-4 w-4" />
                  </ButtonCustom>
                </TooltipTrigger>
                <TooltipContent>
                  Close sidebar
                  <Kbd>⌘\</Kbd>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Spacer for macOS traffic lights (close/minimize/maximize) */}
        <TrafficLightSpacer isFullscreen={isFullscreen} isDesktop={isDesktop} />

        {/* Team dropdown - below traffic lights */}
        <div className="px-2 pt-2 pb-2">
          <div className="flex items-center gap-1">
            {/* Tiny team dropdown */}
            <div className="flex-1 min-w-0">
              <DropdownMenu
                open={isDropdownOpen}
                onOpenChange={setIsDropdownOpen}
              >
                <DropdownMenuTrigger asChild>
                  <ButtonCustom
                    variant="ghost"
                    className="h-6 px-1.5 justify-start hover:bg-foreground/10 rounded-md group/team-button max-w-full"
                    suppressHydrationWarning
                  >
                    <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                      <div className="flex items-center justify-center shrink-0">
                        <Logo className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="text-sm font-medium text-foreground truncate">
                          Better Code
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-3 text-muted-foreground shrink-0 overflow-hidden",
                          isDropdownOpen
                            ? "opacity-100 w-3"
                            : "opacity-0 w-0 group-hover/team-button:opacity-100 group-hover/team-button:w-3",
                        )}
                      />
                    </div>
                  </ButtonCustom>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-52 pt-0"
                  sideOffset={8}
                >
                  {userId ? (
                    <>
                      {/* Project section at the top */}
                      <div className="relative rounded-t-xl border-b overflow-hidden">
                        <div className="absolute inset-0 bg-popover brightness-110" />
                        <div className="relative pl-2 pt-1.5 pb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded flex items-center justify-center bg-background shrink-0 overflow-hidden">
                              <Logo className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="font-medium text-sm text-foreground truncate">
                                {desktopUser?.name || "User"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {desktopUser?.email}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Settings */}
                      <DropdownMenuItem
                        className="gap-2"
                        onSelect={() => {
                          setIsDropdownOpen(false);
                          setSettingsActiveTab("profile");
                          setSettingsDialogOpen(true);
                        }}
                      >
                        <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        Settings
                      </DropdownMenuItem>

                      {/* Help Submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                          <QuestionCircleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1">Help</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent
                          className="w-36"
                          sideOffset={6}
                          alignOffset={-4}
                        >
                          {!isMobileFullscreen && (
                            <DropdownMenuItem
                              onSelect={() => {
                                setIsDropdownOpen(false);
                                setShortcutsDialogOpen(true);
                              }}
                              className="gap-2"
                            >
                              <KeyboardIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1">Shortcuts</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator />

                      {/* Log out */}
                      <div className="">
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => onSignOut()}
                        >
                          <svg
                            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <polyline
                              points="16,17 21,12 16,7"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line
                              x1="21"
                              y1="12"
                              x2="9"
                              y2="12"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Log out
                        </DropdownMenuItem>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Login for unauthenticated users */}
                      <div className="">
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={() => {
                            setIsDropdownOpen(false);
                            setShowAuthDialog(true);
                          }}
                        >
                          <ProfileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          Login
                        </DropdownMenuItem>
                      </div>

                      <DropdownMenuSeparator />

                      {/* Help Submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                          <QuestionCircleIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1">Help</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent
                          className="w-36"
                          sideOffset={6}
                          alignOffset={-4}
                        >
                          {!isMobileFullscreen && (
                            <DropdownMenuItem
                              onSelect={() => {
                                setIsDropdownOpen(false);
                                setShortcutsDialogOpen(true);
                              }}
                              className="gap-2"
                            >
                              <KeyboardIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="flex-1">Shortcuts</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Project Selector */}
      <ProjectSelectorHeader onNewWorkspace={handleNewAgent} />

      {/* Search */}
      <div className="px-2 pb-3 shrink-0">
        <div className="space-y-2">
          {/* Search Input */}
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
                  setFocusedChatIndex(-1); // Reset focus
                  return;
                }

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFocusedChatIndex((prev) => {
                    // If no focus yet, start from first item
                    if (prev === -1) return 0;
                    // Otherwise move down
                    return prev < filteredChats.length - 1 ? prev + 1 : prev;
                  });
                  return;
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFocusedChatIndex((prev) => {
                    // If no focus yet, start from last item
                    if (prev === -1) return filteredChats.length - 1;
                    // Otherwise move up
                    return prev > 0 ? prev - 1 : prev;
                  });
                  return;
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  // Only open if something is focused (not -1)
                  if (focusedChatIndex >= 0) {
                    const focusedChat = filteredChats[focusedChatIndex];
                    if (focusedChat) {
                      handleChatClick(focusedChat.id);
                      searchInputRef.current?.blur();
                      setFocusedChatIndex(-1); // Reset focus after selection
                    }
                  }
                  return;
                }
              }}
              className={cn(
                "w-full rounded-lg text-sm bg-muted border border-input placeholder:text-muted-foreground/40",
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
          {/* Drafts Section - always show if there are drafts */}
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
                        // Navigate to NewChatForm with this draft selected
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
                            {/* Delete button - shown on hover */}
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

          {/* Chats Section - Tree View with inline sub-chats */}
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
                        loadingSubChatIds={new Set([...loadingSubChats.keys()])}
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
                        renderSubChatContextMenu={(subChat) => (
                          <SubChatContextMenu
                            subChat={subChat}
                            isPinned={false}
                            onTogglePin={() => {}}
                            onRename={() => {}}
                            onArchive={() => {}}
                            onArchiveOthers={() => {}}
                            onDelete={handleDeleteSubChat}
                            isOnlyChat={subChats.length <= 1}
                          />
                        )}
                      />
                    );
                  })}
                </SidebarListSection>
              )}

              {/* Unpinned section */}
              {unpinnedAgents.length > 0 && (
                <SidebarListSection
                  title={
                    pinnedAgents.length > 0 ? "Recent workspaces" : "Workspaces"
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
                        loadingSubChatIds={new Set([...loadingSubChats.keys()])}
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
                        renderSubChatContextMenu={(subChat) => (
                          <SubChatContextMenu
                            subChat={subChat}
                            isPinned={false}
                            onTogglePin={() => {}}
                            onRename={() => {}}
                            onArchive={() => {}}
                            onArchiveOthers={() => {}}
                            onDelete={handleDeleteSubChat}
                            isOnlyChat={subChats.length <= 1}
                          />
                        )}
                      />
                    );
                  })}
                </SidebarListSection>
              )}
            </div>
          ) : null}
        </div>

        {/* Top gradient fade (appears when scrolled down) */}
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

      {/* Footer - Multi-select toolbar or normal footer */}
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
            {/* Selection info */}
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

            {/* Action buttons */}
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
                  open={helpPopoverOpen || blockHelpTooltip ? false : undefined}
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

                {/* Archive Button - shown only if there are archived chats */}
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
  );

  return (
    <>
      {sidebarContent}

      {/* Agent name tooltip portal */}
      {/* Agent name tooltip portal */}
      <AgentTooltipPortal />

      {/* Auth Dialog */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />

      {/* Rename Dialog */}
      <AgentsRenameSubChatDialog
        isOpen={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false);
          setRenamingChat(null);
        }}
        onSave={handleRenameSave}
        currentName={renamingChat?.name || ""}
        isLoading={renameLoading}
      />

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
