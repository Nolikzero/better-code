"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
// import { selectedTeamIdAtom } from "@/lib/atoms/team"
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { AlignJustify, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  BranchIcon,
  CheckIcon,
  IconChevronDown,
  SearchIcon,
} from "../../../components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import {
  defaultProviderIdAtom,
  lastSelectedModelByProviderAtom,
  type ProviderId,
} from "../../../lib/atoms";
import { cn } from "../../../lib/utils";
import {
  agentsDebugModeAtom,
  historyNavAtomFamily,
  isPlanModeAtom,
  justCreatedIdsAtom,
  lastSelectedBranchesAtom,
  lastSelectedRepoAtom,
  lastSelectedWorkModeAtom,
  promptHistoryAtomFamily,
  selectedAgentChatIdAtom,
  selectedDraftIdAtom,
  selectedProjectAtom,
} from "../atoms";
import { ProjectSelector } from "../components/project-selector";
import { WorkModeSelector } from "../components/work-mode-selector";
import { useProviders } from "../hooks/use-providers";

const selectedTeamIdAtom = atom<string | null>(null);
// import { agentsSettingsDialogOpenAtom, agentsSettingsDialogActiveTabAtom } from "@/lib/atoms/agents-settings-dialog"
const agentsSettingsDialogOpenAtom = atom(false);
const agentsSettingsDialogActiveTabAtom = atom<string | null>(null);

import { formatTimeAgo } from "@shared/utils";
// Desktop uses real tRPC
import { toast } from "sonner";
import SiriOrb from "../../../components/ui/siri-orb";
// import { CreateBranchDialog } from "@/app/(alpha)/agents/{components}/create-branch-dialog"
import { trpc } from "../../../lib/trpc";
import { agentsSidebarOpenAtom, agentsUnseenChangesAtom } from "../atoms";
import {
  AgentsSlashCommand,
  COMMAND_PROMPTS,
  type SlashCommandOption,
} from "../commands";
import { AgentSendButton } from "../components/agent-send-button";
import {
  ChatInputActions,
  ChatInputAttachments,
  ChatInputEditor,
  ChatInputRoot,
} from "../components/chat-input";
import { CreateBranchDialog } from "../components/create-branch-dialog";
import { ModeToggleDropdown } from "../components/mode-toggle-dropdown";
import { ModelSelectorDropdown } from "../components/model-selector-dropdown";
import { OpenCodeModelSelector } from "../components/opencode-model-selector";
import { ProviderSelectorDropdown } from "../components/provider-selector-dropdown";
import { WebSearchModeSelector } from "../components/web-search-mode-selector";
import { useAgentsFileUpload } from "../hooks/use-agents-file-upload";
import { useFocusInputOnEnter } from "../hooks/use-focus-input-on-enter";
import { useMentionDropdown } from "../hooks/use-mention-dropdown";
import { useSlashCommandDropdown } from "../hooks/use-slash-command-dropdown";
import { useToggleFocusOnCmdEsc } from "../hooks/use-toggle-focus-on-cmd-esc";
import {
  deleteNewChatDraft,
  generateDraftId,
  loadGlobalDrafts,
  markDraftVisible,
  saveGlobalDrafts,
} from "../lib/drafts";
import {
  AgentsFileMention,
  type AgentsMentionsEditorHandle,
  type FileMentionOption,
} from "../mentions";
import { useAgentSubChatStore } from "../stores/sub-chat-store";
import { AgentsHeaderControls } from "../ui/agents-header-controls";
import { PROVIDERS } from "../ui/provider-icons";
import { handlePasteEvent } from "../utils/paste-text";

interface NewChatFormProps {
  isMobileFullscreen?: boolean;
  onBackToChats?: () => void;
}

export function NewChatForm({
  isMobileFullscreen = false,
  onBackToChats,
}: NewChatFormProps = {}) {
  // UNCONTROLLED: just track if editor has content for send button
  const [hasContent, setHasContent] = useState(false);
  const [selectedTeamId] = useAtom(selectedTeamIdAtom);
  const [_selectedChatId, setSelectedChatId] = useAtom(selectedAgentChatIdAtom);
  const [selectedDraftId, setSelectedDraftId] = useAtom(selectedDraftIdAtom);
  const [sidebarOpen, setSidebarOpen] = useAtom(agentsSidebarOpenAtom);

  // Current draft ID being edited (generated when user starts typing in empty form)
  const currentDraftIdRef = useRef<string | null>(null);
  const unseenChanges = useAtomValue(agentsUnseenChangesAtom);

  // Check if any chat has unseen changes
  const hasAnyUnseenChanges = unseenChanges.size > 0;
  const [lastSelectedRepo, setLastSelectedRepo] = useAtom(lastSelectedRepoAtom);
  const [selectedProject, setSelectedProject] = useAtom(selectedProjectAtom);

  // Fetch projects to validate selectedProject exists
  const { data: projectsList, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery();

  // Validate selected project exists in DB
  // While loading, trust the stored value to prevent flicker
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null;
    // While loading, trust localStorage value to prevent flicker
    if (isLoadingProjects) return selectedProject;
    // After loading, validate against DB
    if (!projectsList) return null;
    const exists = projectsList.some((p) => p.id === selectedProject.id);
    return exists ? selectedProject : null;
  }, [selectedProject, projectsList, isLoadingProjects]);

  // Clear invalid project from storage
  useEffect(() => {
    if (selectedProject && projectsList && !validatedProject) {
      setSelectedProject(null);
    }
  }, [selectedProject, projectsList, validatedProject, setSelectedProject]);
  // Provider & model selection (from global atoms + tRPC)
  const [defaultProvider, setDefaultProvider] = useAtom(defaultProviderIdAtom);
  const [modelByProvider, setModelByProvider] = useAtom(
    lastSelectedModelByProviderAtom,
  );
  const { providers, getModels } = useProviders();

  // Derive current provider and model from tRPC data
  const _currentProvider =
    providers.find((p) => p.id === defaultProvider) || PROVIDERS[0];
  const providerModels = getModels(defaultProvider);
  const currentModelId =
    modelByProvider[defaultProvider] || providerModels[0]?.id;
  const _currentModel =
    providerModels.find((m) => m.id === currentModelId) || providerModels[0];

  const [isPlanMode, setIsPlanMode] = useAtom(isPlanModeAtom);

  // Reset to agent mode when switching to Codex provider (Codex doesn't support plan mode)
  useEffect(() => {
    if (defaultProvider === "codex" && isPlanMode) {
      setIsPlanMode(false);
    }
  }, [defaultProvider, isPlanMode, setIsPlanMode]);
  const [workMode, setWorkMode] = useAtom(lastSelectedWorkModeAtom);
  const debugMode = useAtomValue(agentsDebugModeAtom);
  const _setSettingsDialogOpen = useSetAtom(agentsSettingsDialogOpenAtom);
  const _setSettingsActiveTab = useSetAtom(agentsSettingsDialogActiveTabAtom);
  const setJustCreatedIds = useSetAtom(justCreatedIdsAtom);

  // Prompt history - scoped to project
  const historyKey = validatedProject ? `project:${validatedProject.id}` : "";
  const [history, addToHistory] = useAtom(promptHistoryAtomFamily(historyKey));
  const [navState, setNavState] = useAtom(historyNavAtomFamily(historyKey));

  // Reset navigation when project changes
  useEffect(() => {
    setNavState({ index: -1, savedInput: "" });
  }, [validatedProject?.id, setNavState]);

  const [repoSearchQuery, _setRepoSearchQuery] = useState("");
  const [createBranchDialogOpen, setCreateBranchDialogOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Parse owner/repo from GitHub URL
  const _parseGitHubUrl = (url: string) => {
    const match = url.match(/(?:github\.com\/)?([^/]+)\/([^/\s#?]+)/);
    if (!match) return null;
    return `${match[1]}/${match[2].replace(/\.git$/, "")}`;
  };
  const [_repoPopoverOpen, _setRepoPopoverOpen] = useState(false);
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false);
  const [lastSelectedBranches, setLastSelectedBranches] = useAtom(
    lastSelectedBranchesAtom,
  );
  const [branchSearch, setBranchSearch] = useState("");

  // Get/set selected branch for current project (persisted per project)
  const selectedBranch = validatedProject?.id
    ? lastSelectedBranches[validatedProject.id] || ""
    : "";
  const setSelectedBranch = useCallback(
    (branch: string) => {
      if (validatedProject?.id) {
        setLastSelectedBranches((prev) => ({
          ...prev,
          [validatedProject.id]: branch,
        }));
      }
    },
    [validatedProject?.id, setLastSelectedBranches],
  );
  const branchListRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<AgentsMentionsEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image upload hook
  const {
    images,
    handleAddAttachments,
    removeImage,
    clearImages,
    isUploading,
  } = useAgentsFileUpload();

  // Mention dropdown state (from hook)
  const {
    showMentionDropdown,
    mentionSearchText,
    mentionPosition,
    showingFilesList,
    showingSkillsList,
    showingAgentsList,
    showingToolsList,
    openMention,
    closeMention,
    handleMentionSelect: handleMentionSelectBase,
  } = useMentionDropdown();

  // Slash command dropdown state (from hook)
  const {
    showSlashDropdown,
    slashSearchText,
    slashPosition,
    openSlash: handleSlashTrigger,
    closeSlash: handleCloseSlashTrigger,
  } = useSlashCommandDropdown();

  // Shift+Tab handler for mode switching (now handled inside input component via onShiftTab prop)

  // Keyboard shortcut: Enter to focus input when not already focused
  useFocusInputOnEnter(editorRef);

  // Keyboard shortcut: Cmd+Esc to toggle focus/blur
  useToggleFocusOnCmdEsc(editorRef);

  // Fetch repos from team
  // Desktop: no remote repos, we use local projects
  // Type stub for compatibility with web app code
  type RepoItem = {
    id: string;
    name: string;
    full_name: string;
    sandbox_status: "not_setup" | "in_progress" | "ready" | "error";
    pushed_at?: string;
  };
  const reposData: { repositories: RepoItem[] } = { repositories: [] };
  const _isLoadingRepos = false;

  // Memoize repos arrays to prevent useEffect from running on every keystroke
  // Apply debug mode simulations
  const repos = useMemo(() => {
    if (debugMode.enabled && debugMode.simulateNoRepos) {
      return [];
    }
    return reposData?.repositories || [];
  }, [reposData?.repositories, debugMode.enabled, debugMode.simulateNoRepos]);

  const readyRepos = useMemo(() => {
    if (debugMode.enabled && debugMode.simulateNoReadyRepos) {
      return [];
    }
    return repos.filter((r) => r.sandbox_status === "ready");
  }, [repos, debugMode.enabled, debugMode.simulateNoReadyRepos]);

  const _notReadyRepos = useMemo(
    () => repos.filter((r) => r.sandbox_status !== "ready"),
    [repos],
  );

  // Use state to avoid hydration mismatch
  const [resolvedRepo, setResolvedRepo] = useState<(typeof repos)[0] | null>(
    null,
  );

  // Derive selected repo from saved or first available (client-side only)
  // Now includes all repos, not just ready ones
  useEffect(() => {
    if (lastSelectedRepo) {
      // For public imports, use lastSelectedRepo directly (it won't be in repos list)
      if (lastSelectedRepo.isPublicImport) {
        setResolvedRepo({
          id: lastSelectedRepo.id,
          name: lastSelectedRepo.name,
          full_name: lastSelectedRepo.full_name,
          sandbox_status: lastSelectedRepo.sandbox_status || "not_setup",
        } as (typeof repos)[0]);
        return;
      }

      // Look in all repos by id or full_name
      // Only compare IDs when lastSelectedRepo.id is non-empty (old localStorage data might have empty id)
      const stillExists = repos.find(
        (r) =>
          (lastSelectedRepo.id && r.id === lastSelectedRepo.id) ||
          r.full_name === lastSelectedRepo.full_name,
      );
      if (stillExists) {
        setResolvedRepo(stillExists);
        return;
      }
    }

    if (repos.length === 0) {
      setResolvedRepo(null);
      return;
    }

    // Auto-save first repo if none saved (prefer ready repos, then any)
    if (!lastSelectedRepo && repos.length > 0) {
      const firstRepo = readyRepos[0] || repos[0];
      setLastSelectedRepo({
        id: firstRepo.id,
        name: firstRepo.name,
        full_name: firstRepo.full_name,
        sandbox_status: firstRepo.sandbox_status,
      });
    }

    setResolvedRepo(readyRepos[0] || repos[0] || null);
  }, [lastSelectedRepo, repos, readyRepos, setLastSelectedRepo]);

  // Desktop: fetch branches from local git repository
  const branchesQuery = trpc.changes.getBranches.useQuery(
    { worktreePath: validatedProject?.path || "" },
    {
      enabled: !!validatedProject?.path,
      staleTime: 30_000, // Cache for 30 seconds
    },
  );

  // Fetch recent chats for current project (for display below input)
  const { data: recentChats } = trpc.chats.listWithSubChats.useQuery(
    { projectId: validatedProject?.id ?? "" },
    { enabled: !!validatedProject?.id },
  );

  // Check if workspace already exists for selected branch (local mode only)
  // This enables the "continuing in existing workspace" indicator
  const existingWorkspaceQuery = trpc.chats.findByProjectAndBranch.useQuery(
    {
      projectId: validatedProject?.id ?? "",
      branch: selectedBranch,
    },
    {
      enabled:
        !!validatedProject?.id && workMode === "local" && !!selectedBranch,
      staleTime: 10_000, // Cache for 10 seconds
    },
  );

  // Transform branch data to match web app format
  const branches = useMemo(() => {
    if (!branchesQuery.data) return [];

    const { local, remote, defaultBranch, currentBranch } = branchesQuery.data;

    // Combine local and remote branches, preferring local info
    const branchMap = new Map<
      string,
      {
        name: string;
        protected: boolean;
        isDefault: boolean;
        isCurrent: boolean;
        committedAt: string | null;
        authorName: null;
      }
    >();

    // Add remote branches first
    for (const name of remote) {
      branchMap.set(name, {
        name,
        protected: false,
        isDefault: name === defaultBranch,
        isCurrent: name === currentBranch,
        committedAt: null,
        authorName: null,
      });
    }

    // Override with local branches (they have commit dates)
    for (const { branch, lastCommitDate } of local) {
      branchMap.set(branch, {
        name: branch,
        protected: false,
        isDefault: branch === defaultBranch,
        isCurrent: branch === currentBranch,
        committedAt: lastCommitDate
          ? new Date(lastCommitDate).toISOString()
          : null,
        authorName: null,
      });
    }

    // Sort: default first, then by commit date
    return Array.from(branchMap.values()).sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      // Sort by commit date (most recent first)
      if (a.committedAt && b.committedAt) {
        return (
          new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
        );
      }
      if (a.committedAt) return -1;
      if (b.committedAt) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [branchesQuery.data]);

  // Filter branches based on search
  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches;
    const search = branchSearch.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(search));
  }, [branches, branchSearch]);

  // Virtualizer for branch list - only active when popover is open
  const branchVirtualizer = useVirtualizer({
    count: filteredBranches.length,
    getScrollElement: () => branchListRef.current,
    estimateSize: () => 28, // Each item is h-7 (28px)
    overscan: 5,
    enabled: branchPopoverOpen, // Only virtualize when popover is open
  });

  // Force virtualizer to re-measure when popover opens
  useEffect(() => {
    if (branchPopoverOpen) {
      // Small delay to ensure ref is attached
      const timer = setTimeout(() => {
        branchVirtualizer.measure();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [branchPopoverOpen]);

  // Format relative time for branches (reuse shared utility)
  const formatRelativeTime = (dateString: string | null): string => {
    if (!dateString) return "";
    return formatTimeAgo(dateString);
  };

  // Track if we've already set the branch for Local mode on this mount
  const hasSetLocalBranchRef = useRef(false);

  // Set branch when project/branches change
  // In Local mode: initialize to current branch on first load
  // In Worktree mode: use saved branch or default branch
  useEffect(() => {
    if (!branchesQuery.data || !validatedProject?.id) return;

    if (workMode === "local") {
      // In Local mode, only set initial branch - don't override user selection
      const currentBranch = branchesQuery.data.currentBranch;
      if (currentBranch && !hasSetLocalBranchRef.current) {
        hasSetLocalBranchRef.current = true;
        setSelectedBranch(currentBranch);
      }
    } else {
      // In Worktree mode, only set if no branch selected
      const currentSelection = lastSelectedBranches[validatedProject.id];
      if (!currentSelection) {
        setSelectedBranch(branchesQuery.data.defaultBranch);
      }
    }
  }, [
    branchesQuery.data,
    validatedProject?.id,
    setSelectedBranch,
    workMode,
    lastSelectedBranches,
  ]);

  // Reset the flag when switching modes or projects to allow re-initialization
  useEffect(() => {
    hasSetLocalBranchRef.current = false;
  }, [workMode, validatedProject?.id]);

  // Auto-focus input when NewChatForm is shown (when clicking "New Chat")
  // Skip on mobile to prevent keyboard from opening automatically
  useEffect(() => {
    if (isMobileFullscreen) return; // Don't autofocus on mobile

    // Small delay to ensure DOM is ready and animations complete
    const timeoutId = setTimeout(() => {
      editorRef.current?.focus();
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [isMobileFullscreen]); // Run on mount and when mobile state changes

  // Detect dark mode for SiriOrb colors
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    // Listen for theme changes via class attribute
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // SiriOrb colors adapted for light/dark theme
  const orbColors = useMemo(
    () =>
      isDarkMode
        ? {
            bg: "oklch(20% 0.02 264.695)",
            c1: "oklch(70% 0.22 350)", // Brighter pink for dark mode
            c2: "oklch(75% 0.2 200)", // Brighter blue for dark mode
            c3: "oklch(72% 0.22 280)", // Brighter purple for dark mode
          }
        : {
            bg: "oklch(95% 0.02 264.695)",
            c1: "oklch(75% 0.15 350)", // Pastel pink
            c2: "oklch(80% 0.12 200)", // Pastel blue
            c3: "oklch(78% 0.14 280)", // Pastel purple/lavender
          },
    [isDarkMode],
  );

  // Track last saved text to avoid unnecessary updates
  const lastSavedTextRef = useRef<string>("");

  // Track previous draft ID to detect when switching away from a draft
  const prevSelectedDraftIdRef = useRef<string | null>(null);

  // Restore draft when a specific draft is selected from sidebar
  // Or clear editor when "New Workspace" is clicked (selectedDraftId becomes null)
  useEffect(() => {
    const hadDraftBefore = prevSelectedDraftIdRef.current !== null;
    prevSelectedDraftIdRef.current = selectedDraftId;

    if (!selectedDraftId) {
      // No draft selected - clear editor if we had a draft before (user clicked "New Workspace")
      currentDraftIdRef.current = null;
      lastSavedTextRef.current = "";
      if (hadDraftBefore && editorRef.current) {
        editorRef.current.clear();
        setHasContent(false);
      }
      return;
    }

    const globalDrafts = loadGlobalDrafts();
    const draft = globalDrafts[selectedDraftId];
    if (draft?.text) {
      currentDraftIdRef.current = selectedDraftId;
      lastSavedTextRef.current = draft.text; // Initialize to prevent immediate re-save

      // Try to set value immediately if editor is ready
      if (editorRef.current) {
        editorRef.current.setValue(draft.text);
        setHasContent(true);
      } else {
        // Fallback: wait for editor to initialize (rare case)
        const timeoutId = setTimeout(() => {
          editorRef.current?.setValue(draft.text);
          setHasContent(true);
        }, 50);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedDraftId]);

  // Mark draft as visible when component unmounts (user navigates away)
  // This ensures the draft only appears in the sidebar after leaving the form
  useEffect(() => {
    return () => {
      // On unmount, mark current draft as visible so it appears in sidebar
      if (currentDraftIdRef.current) {
        markDraftVisible(currentDraftIdRef.current);
      }
    };
  }, []);

  // Filter all repos by search (combined list) and sort by preview status
  const _filteredRepos = repos
    .filter(
      (repo) =>
        repo.name.toLowerCase().includes(repoSearchQuery.toLowerCase()) ||
        repo.full_name.toLowerCase().includes(repoSearchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      // 1. Repos with preview (sandbox_status === "ready") come first
      const aHasPreview = a.sandbox_status === "ready";
      const bHasPreview = b.sandbox_status === "ready";
      if (aHasPreview && !bHasPreview) return -1;
      if (!aHasPreview && bHasPreview) return 1;

      // 2. Sort by last commit date (pushed_at) - most recent first
      const aDate = a.pushed_at ? new Date(a.pushed_at).getTime() : 0;
      const bDate = b.pushed_at ? new Date(b.pushed_at).getTime() : 0;
      return bDate - aDate;
    });

  // Create chat mutation (real tRPC)
  const utils = trpc.useUtils();
  const createChatMutation = trpc.chats.create.useMutation({
    onSuccess: (data) => {
      // Clear editor and images only on success
      editorRef.current?.clear();
      clearImages();
      clearCurrentDraft();

      const newSubChatId = data.newSubChatId || data.subChats?.[0]?.id;

      // For existing workspace reuse, optimistically update the chats.get cache
      // BEFORE initializing store or setting selectedChatId. This prevents the race
      // condition where the active-chat effect overwrites fresh store data with stale cache.
      if ((data as any).isExisting && newSubChatId && data.subChats?.[0]) {
        utils.chats.get.setData({ id: data.id }, (oldData) => {
          if (!oldData) return oldData;
          const existingSubChats = (oldData as any).subChats || [];
          // Check if new subchat already exists to avoid duplicates
          if (existingSubChats.some((sc: any) => sc.id === newSubChatId)) {
            return oldData;
          }
          return {
            ...oldData,
            subChats: [...existingSubChats, data.subChats![0]],
          };
        });
      }

      // 1. Initialize sub-chat store with data from response
      // This must happen before setSelectedChatId triggers any effects
      if (newSubChatId) {
        const store = useAgentSubChatStore.getState();
        store.setChatId(data.id);

        // Populate allSubChats from creation response so UI has data immediately
        const subChatMeta =
          data.subChats?.map((sc) => ({
            id: sc.id,
            name: sc.name || "New Chat",
            created_at: sc.createdAt?.toISOString() || new Date().toISOString(),
            mode: (sc.mode as "plan" | "agent") || "agent",
            providerId: sc.providerId as ProviderId | undefined,
          })) || [];
        store.setAllSubChats(subChatMeta);
        store.addToOpenSubChats(newSubChatId);
        store.setActiveSubChat(newSubChatId);
      }

      // 2. Invalidate queries
      utils.chats.list.invalidate();
      utils.chats.listWithSubChats.invalidate();
      // Invalidate branches query to reflect the new current branch after checkout
      utils.changes.getBranches.invalidate();
      // Invalidate chats.get query to ensure new sub-chat is loaded (for eventual consistency)
      utils.chats.get.invalidate({ id: data.id });

      // 3. LAST: Set selected chat ID (triggers navigation and effects)
      setSelectedChatId(data.id);

      // Track this chat and its first subchat as just created for typewriter effect
      const ids = [data.id];
      if (newSubChatId) {
        ids.push(newSubChatId);
      }
      setJustCreatedIds((prev) => new Set([...prev, ...ids]));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Open folder mutation for selecting a project
  const openFolder = trpc.projects.openFolder.useMutation({
    onSuccess: (project) => {
      if (project) {
        // Optimistically update the projects list cache to prevent "Select repo" flash
        // This ensures validatedProject can find the new project immediately
        utils.projects.list.setData(undefined, (oldData) => {
          if (!oldData) return [project];
          // Check if project already exists (reopened existing project)
          const exists = oldData.some((p) => p.id === project.id);
          if (exists) {
            // Update existing project's timestamp
            return oldData.map((p) =>
              p.id === project.id ? { ...p, updatedAt: project.updatedAt } : p,
            );
          }
          // Add new project at the beginning
          return [project, ...oldData];
        });

        setSelectedProject({
          id: project.id,
          name: project.name,
          path: project.path,
          gitRemoteUrl: project.gitRemoteUrl,
          gitProvider: project.gitProvider as
            | "github"
            | "gitlab"
            | "bitbucket"
            | null,
          gitOwner: project.gitOwner,
          gitRepo: project.gitRepo,
        });
      }
    },
  });

  const handleOpenFolder = async () => {
    await openFolder.mutateAsync();
  };

  const handleSend = useCallback(() => {
    // Get value from uncontrolled editor
    const message = editorRef.current?.getValue() || "";

    if (!message.trim() || !selectedProject) {
      return;
    }

    // Add to prompt history before sending
    if (historyKey) {
      addToHistory(message.trim());
    }
    setNavState({ index: -1, savedInput: "" });

    // Build message parts array (images first, then text)
    type MessagePart =
      | { type: "text"; text: string }
      | {
          type: "data-image";
          data: {
            url: string;
            mediaType?: string;
            filename?: string;
            base64Data?: string;
          };
        };

    const parts: MessagePart[] = images
      .filter((img) => !img.isLoading && img.url)
      .map((img) => ({
        type: "data-image" as const,
        data: {
          url: img.url!,
          mediaType: img.mediaType,
          filename: img.filename,
          base64Data: img.base64Data,
        },
      }));

    if (message.trim()) {
      parts.push({ type: "text" as const, text: message.trim() });
    }

    // Create chat with selected project, branch, and initial message
    console.log(
      "[new-chat-form] Creating chat with providerId:",
      defaultProvider,
    );
    createChatMutation.mutate({
      projectId: selectedProject.id,
      name: message.trim().slice(0, 50), // Use first 50 chars as chat name
      initialMessageParts: parts.length > 0 ? parts : undefined,
      // Worktree mode: baseBranch is what to branch FROM
      baseBranch:
        workMode === "worktree" ? selectedBranch || undefined : undefined,
      // Local mode: selectedBranch is what to switch TO
      selectedBranch:
        workMode === "local" ? selectedBranch || undefined : undefined,
      useWorktree: workMode === "worktree",
      mode: isPlanMode ? "plan" : "agent",
      providerId: defaultProvider,
    });
    // Editor and images are cleared in onSuccess callback
  }, [
    selectedProject,
    createChatMutation,
    hasContent,
    selectedBranch,
    workMode,
    images,
    isPlanMode,
    defaultProvider,
    historyKey,
    addToHistory,
    setNavState,
  ]);

  // History navigation handlers
  const handleArrowUp = useCallback(() => {
    if (!historyKey || history.length === 0) return false;

    const currentValue = editorRef.current?.getValue() || "";

    if (navState.index === -1) {
      // Starting navigation - save current input
      setNavState({ index: 0, savedInput: currentValue });
      editorRef.current?.setValue(history[history.length - 1] || "");
    } else if (navState.index < history.length - 1) {
      // Navigate further back
      const newIndex = navState.index + 1;
      setNavState((prev) => ({ ...prev, index: newIndex }));
      editorRef.current?.setValue(history[history.length - 1 - newIndex] || "");
    }
    return true;
  }, [historyKey, history, navState, setNavState]);

  const handleArrowDown = useCallback(() => {
    if (!historyKey || navState.index === -1) return false;

    if (navState.index === 0) {
      // Return to saved input
      editorRef.current?.setValue(navState.savedInput);
      setNavState({ index: -1, savedInput: "" });
    } else {
      // Navigate forward
      const newIndex = navState.index - 1;
      setNavState((prev) => ({ ...prev, index: newIndex }));
      editorRef.current?.setValue(history[history.length - 1 - newIndex] || "");
    }
    return true;
  }, [historyKey, history, navState, setNavState]);

  // Wrap the base mention select handler to pass in the editor insert function
  const handleMentionSelect = useCallback(
    (mention: FileMentionOption) => {
      handleMentionSelectBase(mention, (m) =>
        editorRef.current?.insertMention(m),
      );
    },
    [handleMentionSelectBase],
  );

  // Save draft to localStorage when content changes
  const handleContentChange = useCallback(
    (hasContent: boolean) => {
      setHasContent(hasContent);
      const text = editorRef.current?.getValue() || "";

      // Skip if text hasn't changed
      if (text === lastSavedTextRef.current) {
        return;
      }
      lastSavedTextRef.current = text;

      const globalDrafts = loadGlobalDrafts();

      if (text.trim() && validatedProject) {
        // If no current draft ID, create a new one
        if (!currentDraftIdRef.current) {
          currentDraftIdRef.current = generateDraftId();
        }

        const key = currentDraftIdRef.current;
        globalDrafts[key] = {
          text,
          updatedAt: Date.now(),
          project: {
            id: validatedProject.id,
            name: validatedProject.name,
            path: validatedProject.path,
            gitOwner: validatedProject.gitOwner,
            gitRepo: validatedProject.gitRepo,
            gitProvider: validatedProject.gitProvider,
          },
        };
        saveGlobalDrafts(globalDrafts);
      } else if (currentDraftIdRef.current) {
        // Text is empty - delete the current draft
        deleteNewChatDraft(currentDraftIdRef.current);
        currentDraftIdRef.current = null;
      }
    },
    [validatedProject],
  );

  // Clear current draft when chat is created
  const clearCurrentDraft = useCallback(() => {
    if (!currentDraftIdRef.current) return;

    deleteNewChatDraft(currentDraftIdRef.current);
    currentDraftIdRef.current = null;
    setSelectedDraftId(null);
  }, [setSelectedDraftId]);

  // Memoized callbacks to prevent re-renders
  const handleMentionTrigger = useCallback(
    ({ searchText, rect }: { searchText: string; rect: DOMRect }) => {
      if (validatedProject) {
        openMention(searchText, rect);
      }
    },
    [validatedProject, openMention],
  );

  // Slash command select handler (handleSlashTrigger and handleCloseSlashTrigger come from hook)
  const handleSlashSelect = useCallback(
    (command: SlashCommandOption) => {
      // Clear the slash command text from editor
      editorRef.current?.clearSlashCommand();
      handleCloseSlashTrigger();

      // Handle builtin commands
      if (command.category === "builtin") {
        switch (command.name) {
          case "clear":
            editorRef.current?.clear();
            break;
          case "plan":
            if (!isPlanMode) {
              setIsPlanMode(true);
            }
            break;
          case "agent":
            if (isPlanMode) {
              setIsPlanMode(false);
            }
            break;
          // Prompt-based commands - auto-send to agent
          case "review":
          case "pr-comments":
          case "release-notes":
          case "security-review": {
            const prompt =
              COMMAND_PROMPTS[command.name as keyof typeof COMMAND_PROMPTS];
            if (prompt) {
              editorRef.current?.setValue(prompt);
              // Auto-send the prompt to agent
              setTimeout(() => handleSend(), 0);
            }
            break;
          }
        }
        return;
      }

      // Handle repository commands - auto-send to agent
      if (command.prompt) {
        editorRef.current?.setValue(command.prompt);
        setTimeout(() => handleSend(), 0);
      }
    },
    [isPlanMode, setIsPlanMode, handleSend, handleCloseSlashTrigger],
  );

  // Paste handler for images and plain text
  // Uses async text insertion to prevent UI freeze with large text
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => handlePasteEvent(e, handleAddAttachments),
    [handleAddAttachments],
  );

  // Filter dropped files to images only (for new-chat-form)
  const filterImagesOnly = useCallback(
    (files: File[]) => files.filter((f) => f.type.startsWith("image/")),
    [],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header - Simple burger on mobile, AgentsHeaderControls on desktop */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          // @ts-expect-error - WebKit-specific property for Electron window dragging
          WebkitAppRegion: "drag",
        }}
      >
        <div className="flex-1 min-w-0 flex items-center gap-4 px-2 py-2">
          {isMobileFullscreen ? (
            // Simple burger button for mobile - just opens chats list
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToChats}
              className="h-7 w-7 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shrink-0 rounded-md"
              aria-label="All projects"
            >
              <AlignJustify className="h-4 w-4" />
            </Button>
          ) : (
            <AgentsHeaderControls
              isSidebarOpen={sidebarOpen}
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
              hasUnseenChanges={hasAnyUnseenChanges}
            />
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto relative">
        <div className="w-full max-w-2xl space-y-4 md:space-y-6 relative z-10 px-4">
          {/* SiriOrb - only show when project is selected */}
          {validatedProject && (
            <div className="space-y-4 text-center mb-2 md:mb-4">
              <div className="flex justify-center">
                <SiriOrb
                  size="180px"
                  colors={orbColors}
                  animationDuration={20}
                />
              </div>
              <h1 className="text-2xl md:text-4xl font-medium tracking-tight">
                What would you like to do?
              </h1>
            </div>
          )}

          {/* Input Area or Select Repo State */}
          {!validatedProject ? (
            // No project selected - show select repo button (like Sign in button)
            <div className="flex justify-center">
              <button
                onClick={handleOpenFolder}
                disabled={openFolder.isPending}
                className="h-8 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {openFolder.isPending ? "Opening..." : "Select repo"}
              </button>
            </div>
          ) : (
            // Project selected - show input form
            <>
              <ChatInputRoot
                maxHeight={240}
                onSubmit={handleSend}
                contextItems={
                  images.length > 0 ? (
                    <ChatInputAttachments
                      images={images}
                      onRemoveImage={removeImage}
                    />
                  ) : undefined
                }
                onAddAttachments={handleAddAttachments}
                filterDroppedFiles={filterImagesOnly}
                editorRef={editorRef}
                fileInputRef={fileInputRef}
                hasContent={hasContent}
                isSubmitting={createChatMutation.isPending}
                isUploading={isUploading}
                disabled={createChatMutation.isPending}
              >
                <ChatInputEditor
                  onTrigger={handleMentionTrigger}
                  onCloseTrigger={closeMention}
                  onSlashTrigger={({ searchText, rect }) =>
                    handleSlashTrigger(searchText, rect)
                  }
                  onCloseSlashTrigger={handleCloseSlashTrigger}
                  onContentChange={handleContentChange}
                  onSubmit={handleSend}
                  onShiftTab={() => {
                    if (defaultProvider !== "codex") {
                      setIsPlanMode((prev) => !prev);
                    }
                  }}
                  onArrowUp={handleArrowUp}
                  onArrowDown={handleArrowDown}
                  onPaste={handlePaste}
                  isMobile={isMobileFullscreen}
                />
                <ChatInputActions
                  leftContent={
                    <>
                      {/* Mode toggle (Agent/Plan) - hidden for Codex which doesn't support plan mode */}
                      {defaultProvider !== "codex" && (
                        <ModeToggleDropdown
                          isPlanMode={isPlanMode}
                          onModeChange={setIsPlanMode}
                        />
                      )}

                      {/* Provider selector */}
                      <ProviderSelectorDropdown
                        providerId={defaultProvider}
                        onProviderChange={setDefaultProvider}
                      />

                      {/* Model selector */}
                      {defaultProvider === "opencode" ? (
                        <OpenCodeModelSelector
                          currentModelId={currentModelId}
                          onModelChange={(modelId) => {
                            setModelByProvider({
                              ...modelByProvider,
                              opencode: modelId,
                            });
                          }}
                        />
                      ) : (
                        <ModelSelectorDropdown
                          providerId={defaultProvider}
                          models={providerModels}
                          currentModelId={currentModelId}
                          onModelChange={(modelId) => {
                            setModelByProvider({
                              ...modelByProvider,
                              [defaultProvider]: modelId,
                            });
                          }}
                        />
                      )}

                      {/* Web search mode selector (Codex only) */}
                      {defaultProvider === "codex" && <WebSearchModeSelector />}
                    </>
                  }
                  acceptedFileTypes="image/jpeg,image/png"
                  onAddAttachments={handleAddAttachments}
                  maxImages={5}
                  imageCount={images.length}
                  actionButton={
                    <AgentSendButton
                      isStreaming={false}
                      isSubmitting={createChatMutation.isPending || isUploading}
                      disabled={Boolean(
                        !hasContent || !selectedProject || isUploading,
                      )}
                      onClick={handleSend}
                      isPlanMode={isPlanMode}
                    />
                  }
                />
              </ChatInputRoot>

              {/* Project, Work Mode, and Branch selectors - directly under input */}
              <div className="mt-1.5 md:mt-2 ml-[5px] flex items-center gap-2">
                <ProjectSelector />

                {/* Work mode selector - between project and branch */}
                {validatedProject && (
                  <WorkModeSelector
                    value={workMode}
                    onChange={setWorkMode}
                    disabled={createChatMutation.isPending}
                  />
                )}

                {/* Branch selector - visible for both local and worktree modes */}
                {validatedProject && (
                  <Popover
                    open={branchPopoverOpen}
                    onOpenChange={(open) => {
                      if (!open) {
                        setBranchSearch(""); // Clear search on close
                      }
                      setBranchPopoverOpen(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                        disabled={branchesQuery.isLoading}
                      >
                        <BranchIcon className="w-4 h-4" />
                        <span className="truncate max-w-[100px]">
                          {selectedBranch ||
                            branchesQuery.data?.defaultBranch ||
                            "main"}
                        </span>
                        <IconChevronDown className="w-3 h-3 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      {/* Search input with Create button */}
                      <div className="flex items-center gap-1.5 h-7 px-1.5 mx-1 my-1 rounded-md bg-muted/50">
                        <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search branches..."
                          value={branchSearch}
                          onChange={(e) => setBranchSearch(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 flex items-center gap-1 text-xs shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCreateBranchDialogOpen(true);
                            setBranchPopoverOpen(false);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                          Create
                        </Button>
                      </div>

                      {/* Virtualized branch list */}
                      {filteredBranches.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          No branches found.
                        </div>
                      ) : (
                        <div
                          ref={branchListRef}
                          className="overflow-auto py-1 scrollbar-hide"
                          style={{
                            height: Math.min(
                              filteredBranches.length * 32 + 8,
                              300,
                            ),
                          }}
                        >
                          <div
                            style={{
                              height: `${branchVirtualizer.getTotalSize()}px`,
                              width: "100%",
                              position: "relative",
                            }}
                          >
                            {branchVirtualizer
                              .getVirtualItems()
                              .map((virtualItem) => {
                                const branch =
                                  filteredBranches[virtualItem.index];
                                const isSelected =
                                  selectedBranch === branch.name ||
                                  (!selectedBranch && branch.isDefault);
                                return (
                                  <button
                                    key={branch.name}
                                    onClick={() => {
                                      setSelectedBranch(branch.name);
                                      setBranchPopoverOpen(false);
                                      setBranchSearch("");
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 w-[calc(100%-8px)] mx-1 px-1.5 text-sm text-left absolute left-0 top-0 rounded-md cursor-default select-none outline-hidden transition-colors",
                                      isSelected
                                        ? "dark:bg-neutral-800 text-foreground"
                                        : "dark:hover:bg-neutral-800 hover:text-foreground",
                                    )}
                                    style={{
                                      height: `${virtualItem.size}px`,
                                      transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                  >
                                    <BranchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="truncate flex-1">
                                      {branch.name}
                                    </span>
                                    {branch.committedAt && (
                                      <span className="text-xs text-muted-foreground/70 shrink-0">
                                        {formatRelativeTime(branch.committedAt)}
                                      </span>
                                    )}
                                    {branch.isDefault && (
                                      <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded shrink-0">
                                        default
                                      </span>
                                    )}
                                    {workMode === "local" &&
                                      branch.isCurrent && (
                                        <span className="text-[10px] text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                                          current
                                        </span>
                                      )}
                                    {isSelected && (
                                      <CheckIcon className="h-4 w-4 shrink-0 ml-auto" />
                                    )}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                )}

                {/* Create Branch Dialog */}
                {validatedProject && (
                  <CreateBranchDialog
                    open={createBranchDialogOpen}
                    onOpenChange={setCreateBranchDialogOpen}
                    projectPath={validatedProject.path}
                    branches={branches}
                    defaultBranch={branchesQuery.data?.defaultBranch || "main"}
                    onBranchCreated={(branchName) => {
                      setSelectedBranch(branchName);
                    }}
                  />
                )}

                {/* Existing workspace indicator - shown in local mode when workspace exists */}
                {workMode === "local" && existingWorkspaceQuery.data && (
                  <span className="text-xs text-muted-foreground/70 ml-1">
                    continuing in existing workspace
                  </span>
                )}
              </div>

              {/* Recent chats for this project */}
              {recentChats && recentChats.length > 0 && (
                <div className="mt-6 space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground px-1">
                    Recent
                  </h3>
                  <div className="space-y-1">
                    {recentChats.slice(0, 5).map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => setSelectedChatId(chat.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <span className="truncate flex-1">{chat.name}</span>
                        {chat.branch && (
                          <span className="text-xs text-muted-foreground truncate">
                            {chat.branch}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File mention dropdown */}
              {/* Desktop: use projectPath for local file search */}
              <AgentsFileMention
                isOpen={showMentionDropdown && !!validatedProject}
                onClose={closeMention}
                onSelect={handleMentionSelect}
                searchText={mentionSearchText}
                position={mentionPosition}
                projectPath={validatedProject?.path}
                showingFilesList={showingFilesList}
                showingSkillsList={showingSkillsList}
                showingAgentsList={showingAgentsList}
                showingToolsList={showingToolsList}
              />

              {/* Slash command dropdown */}
              <AgentsSlashCommand
                isOpen={showSlashDropdown}
                onClose={handleCloseSlashTrigger}
                onSelect={handleSlashSelect}
                searchText={slashSearchText}
                position={slashPosition}
                teamId={selectedTeamId || undefined}
                repository={resolvedRepo?.full_name}
                isPlanMode={isPlanMode}
                disabledCommands={["clear"]}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
