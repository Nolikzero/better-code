import type { ProviderId } from "@shared/types";
import { atom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";
import type { FileChange } from "../../../../shared/utils";

// Selected agent chat ID - null means "new chat" view (persisted to restore on reload)
export const selectedAgentChatIdAtom = atomWithStorage<string | null>(
  "agents:selectedChatId",
  null,
  undefined,
  { getOnInit: true },
);

// Previous agent chat ID - used to navigate back after archiving current chat
// Not persisted - only tracks within current session
export const previousAgentChatIdAtom = atom<string | null>(null);

// Selected draft ID - when user clicks on a draft in sidebar, this is set
// NewChatForm uses this to restore the draft text
// Reset to null when "New Workspace" is clicked or chat is created
export const selectedDraftIdAtom = atom<string | null>(null);

// Preview paths storage - stores all preview paths keyed by chatId
const previewPathsStorageAtom = atomWithStorage<Record<string, string>>(
  "agents:previewPaths",
  {},
  undefined,
  { getOnInit: true },
);

// atomFamily to get/set preview path per chatId
export const previewPathAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(previewPathsStorageAtom)[chatId] ?? "/",
    (get, set, newPath: string) => {
      const current = get(previewPathsStorageAtom);
      set(previewPathsStorageAtom, { ...current, [chatId]: newPath });
    },
  ),
);

// Preview viewport modes storage - stores viewport mode per chatId
const viewportModesStorageAtom = atomWithStorage<
  Record<string, "desktop" | "mobile">
>("agents:viewportModes", {}, undefined, { getOnInit: true });

// atomFamily to get/set viewport mode per chatId
export const viewportModeAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(viewportModesStorageAtom)[chatId] ?? "desktop",
    (get, set, newMode: "desktop" | "mobile") => {
      const current = get(viewportModesStorageAtom);
      set(viewportModesStorageAtom, { ...current, [chatId]: newMode });
    },
  ),
);

// Preview scales storage - stores scale per chatId
const previewScalesStorageAtom = atomWithStorage<Record<string, number>>(
  "agents:previewScales",
  {},
  undefined,
  { getOnInit: true },
);

// atomFamily to get/set preview scale per chatId
export const previewScaleAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(previewScalesStorageAtom)[chatId] ?? 100,
    (get, set, newScale: number) => {
      const current = get(previewScalesStorageAtom);
      set(previewScalesStorageAtom, { ...current, [chatId]: newScale });
    },
  ),
);

// Mobile device dimensions storage - stores device settings per chatId
type MobileDeviceSettings = {
  width: number;
  height: number;
  preset: string;
};

const mobileDevicesStorageAtom = atomWithStorage<
  Record<string, MobileDeviceSettings>
>("agents:mobileDevices", {}, undefined, { getOnInit: true });

// atomFamily to get/set mobile device settings per chatId
export const mobileDeviceAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) =>
      get(mobileDevicesStorageAtom)[chatId] ?? {
        width: 393,
        height: 852,
        preset: "iPhone 16",
      },
    (get, set, newDevice: MobileDeviceSettings) => {
      const current = get(mobileDevicesStorageAtom);
      set(mobileDevicesStorageAtom, { ...current, [chatId]: newDevice });
    },
  ),
);

// Loading sub-chats: Map<subChatId, parentChatId>
// Used to show loading indicators on tabs and sidebar
// Set when generation starts, cleared when onFinish fires
export const loadingSubChatsAtom = atom<Map<string, string>>(new Map());

// Helper to set loading state
export const setLoading = (
  setter: (fn: (prev: Map<string, string>) => Map<string, string>) => void,
  subChatId: string,
  parentChatId: string,
) => {
  setter((prev) => {
    const next = new Map(prev);
    next.set(subChatId, parentChatId);
    return next;
  });
};

// Helper to clear loading state
export const clearLoading = (
  setter: (fn: (prev: Map<string, string>) => Map<string, string>) => void,
  subChatId: string,
) => {
  setter((prev) => {
    const next = new Map(prev);
    next.delete(subChatId);
    return next;
  });
};

// Persisted preferences for agents page
type SavedRepo = {
  id: string;
  name: string;
  full_name: string;
  sandbox_status?: "not_setup" | "in_progress" | "ready" | "error";
  installation_id?: string;
  isPublicImport?: boolean;
} | null;

export const lastSelectedRepoAtom = atomWithStorage<SavedRepo>(
  "agents:lastSelectedRepo",
  null,
  undefined,
  { getOnInit: true },
);

// Selected local project (persisted)
type SelectedProject = {
  id: string;
  name: string;
  path: string;
  gitRemoteUrl?: string | null;
  gitProvider?: "github" | "gitlab" | "bitbucket" | null;
  gitOwner?: string | null;
  gitRepo?: string | null;
} | null;

export const selectedProjectAtom = atomWithStorage<SelectedProject>(
  "agents:selectedProject",
  null,
  undefined,
  { getOnInit: true },
);

const _lastSelectedAgentIdAtom = atomWithStorage<string>(
  "agents:lastSelectedAgentId",
  "claude-code",
  undefined,
  { getOnInit: true },
);

export const lastSelectedModelIdAtom = atomWithStorage<string>(
  "agents:lastSelectedModelId",
  "sonnet",
  undefined,
  { getOnInit: true },
);

// Agent mode - "plan", "agent", or "ralph"
export type AgentMode = "plan" | "agent" | "ralph";
export const agentModeAtom = atomWithStorage<AgentMode>(
  "agents:agentMode",
  "agent",
  undefined,
  { getOnInit: true },
);

// Backward compatibility - derived atom that maps to/from agentModeAtom
export const isPlanModeAtom = atom(
  (get) => get(agentModeAtom) === "plan",
  (_get, set, isPlan: boolean) => set(agentModeAtom, isPlan ? "plan" : "agent"),
);

// Model ID to full Claude model string mapping
export const MODEL_ID_MAP: Record<string, string> = {
  opus: "opus",
  sonnet: "sonnet",
  haiku: "haiku",
};

// Sidebar state
export const agentsSidebarOpenAtom = atomWithStorage<boolean>(
  "agents-sidebar-open",
  true,
  undefined,
  { getOnInit: true },
);

// Sidebar width with localStorage persistence
export const agentsSidebarWidthAtom = atomWithStorage<number>(
  "agents-sidebar-width",
  180,
  undefined,
  { getOnInit: true },
);

// Chats sidebar (right) state
export const chatsSidebarOpenAtom = atomWithStorage<boolean>(
  "chats-sidebar-open",
  true,
  undefined,
  { getOnInit: true },
);

// Chats sidebar (right) width with localStorage persistence
export const chatsSidebarWidthAtom = atomWithStorage<number>(
  "chats-sidebar-width",
  250,
  undefined,
  { getOnInit: true },
);

// Expanded chat IDs in sidebar tree view (persisted)
// When a chat is selected, it auto-expands to show sub-chats
export const expandedChatIdsAtom = atomWithStorage<string[]>(
  "agents:expandedChatIds",
  [],
  undefined,
  { getOnInit: true },
);

// Preview sidebar (right) width and open state
export const agentsPreviewSidebarWidthAtom = atomWithStorage<number>(
  "agents-preview-sidebar-width",
  500,
  undefined,
  { getOnInit: true },
);

export const agentsPreviewSidebarOpenAtom = atomWithStorage<boolean>(
  "agents-preview-sidebar-open",
  true,
  undefined,
  { getOnInit: true },
);

// ========================================
// Dev Server Preview State
// ========================================

// Dev server running state per chat
export type DevServerState = {
  paneId: string;
  port: number | null;
  status: "starting" | "running" | "stopped" | "error";
};

const devServerStatesStorageAtom = atomWithStorage<
  Record<string, DevServerState | null>
>("agents:devServerStates", {}, undefined, { getOnInit: true });

export const devServerStateAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(devServerStatesStorageAtom)[chatId] ?? null,
    (get, set, newState: DevServerState | null) => {
      const current = get(devServerStatesStorageAtom);
      set(devServerStatesStorageAtom, { ...current, [chatId]: newState });
    },
  ),
);

// View mode for the chat area: "chat" | "split" | "preview"
export type ChatViewMode = "chat" | "split" | "preview";

const chatViewModesStorageAtom = atomWithStorage<Record<string, ChatViewMode>>(
  "agents:chatViewModes",
  {},
  undefined,
  { getOnInit: true },
);

export const chatViewModeAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(chatViewModesStorageAtom)[chatId] ?? "chat",
    (get, set, newMode: ChatViewMode) => {
      const current = get(chatViewModesStorageAtom);
      set(chatViewModesStorageAtom, { ...current, [chatId]: newMode });
    },
  ),
);

// Detected ports from dev server per chat
const devServerPortsStorageAtom = atomWithStorage<Record<string, number[]>>(
  "agents:devServerPorts",
  {},
  undefined,
  { getOnInit: true },
);

export const devServerPortsAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(devServerPortsStorageAtom)[chatId] ?? [],
    (get, set, update: number[] | ((prev: number[]) => number[])) => {
      const current = get(devServerPortsStorageAtom);
      const prev = current[chatId] ?? [];
      const newPorts = typeof update === "function" ? update(prev) : update;
      set(devServerPortsStorageAtom, { ...current, [chatId]: newPorts });
    },
  ),
);

// Local preview URL (http://localhost:{port}) per chat
const localPreviewUrlsStorageAtom = atomWithStorage<
  Record<string, string | null>
>("agents:localPreviewUrls", {}, undefined, { getOnInit: true });

export const localPreviewUrlAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(localPreviewUrlsStorageAtom)[chatId] ?? null,
    (get, set, newUrl: string | null) => {
      const current = get(localPreviewUrlsStorageAtom);
      set(localPreviewUrlsStorageAtom, { ...current, [chatId]: newUrl });
    },
  ),
);

// Diff sidebar (right) width (global - same width for all chats)
export const agentsDiffSidebarWidthAtom = atomWithStorage<number>(
  "agents-diff-sidebar-width",
  500,
  undefined,
  { getOnInit: true },
);

// Diff sidebar open state storage - stores per chatId
const diffSidebarOpenStorageAtom = atomWithStorage<Record<string, boolean>>(
  "agents:diffSidebarOpen",
  {},
  undefined,
  { getOnInit: true },
);

// atomFamily to get/set diff sidebar open state per chatId
export const diffSidebarOpenAtomFamily = atomFamily((chatId: string) =>
  atom(
    (get) => get(diffSidebarOpenStorageAtom)[chatId] ?? false,
    (get, set, isOpen: boolean) => {
      const current = get(diffSidebarOpenStorageAtom);
      set(diffSidebarOpenStorageAtom, { ...current, [chatId]: isOpen });
    },
  ),
);

// Legacy global atom - kept for backwards compatibility, maps to empty string key
// TODO: Remove after migration
export const agentsDiffSidebarOpenAtom = atomWithStorage<boolean>(
  "agents-diff-sidebar-open",
  false,
  undefined,
  { getOnInit: true },
);

// Focused file path in diff sidebar (for scroll-to-file feature)
// Set by AgentEditTool on click, consumed by AgentDiffView
export const agentsFocusedDiffFileAtom = atom<string | null>(null);

// Center diff view open state - when true, shows diff viewer in main content instead of chat
export const centerDiffViewOpenAtom = atom<boolean>(false);

// Selected file path for center diff view (which file to highlight/scroll to)
// Different from agentsFocusedDiffFileAtom - this persists the selection
export const centerDiffSelectedFileAtom = atom<string | null>(null);

// Hovered file path for sync between sidebar and center diff view
// When hovering a file in either view, both highlight and scroll to it
export const hoveredDiffFileAtom = atom<string | null>(null);

// ========================================
// Git Actions State
// ========================================

// Selected files for git operations (Set of file paths)
export const selectedDiffFilesAtom = atom<Set<string>>(new Set<string>());

// Toggle selection helper (write-only atom)
export const toggleDiffFileSelectionAtom = atom(
  null,
  (get, set, filePath: string) => {
    const currentSet = get(selectedDiffFilesAtom);
    const newSet = new Set(currentSet);
    if (newSet.has(filePath)) {
      newSet.delete(filePath);
    } else {
      newSet.add(filePath);
    }
    set(selectedDiffFilesAtom, newSet);
  },
);

// Select all files helper (write-only atom)
export const selectAllDiffFilesAtom = atom(
  null,
  (_get, set, files: string[]) => {
    set(selectedDiffFilesAtom, new Set(files));
  },
);

// Deselect all files helper (write-only atom)
export const deselectAllDiffFilesAtom = atom(null, (_get, set) => {
  set(selectedDiffFilesAtom, new Set<string>());
});

// Anchor point for shift+click range selection
export const diffFileSelectionAnchorAtom = atom<string | null>(null);

// Multi-select mode indicator (more than one file selected)
export const isDiffFileMultiSelectModeAtom = atom((get) => {
  return get(selectedDiffFilesAtom).size > 1;
});

// Selected files count
export const selectedDiffFilesCountAtom = atom((get) => {
  return get(selectedDiffFilesAtom).size;
});

// Range selection for shift+click
export const selectDiffFileRangeAtom = atom(
  null,
  (
    get,
    set,
    { filePath, allFiles }: { filePath: string; allFiles: string[] },
  ) => {
    const currentSet = get(selectedDiffFilesAtom);
    const anchor = get(diffFileSelectionAnchorAtom);

    // Find anchor index
    let anchorIndex = anchor ? allFiles.indexOf(anchor) : -1;
    if (anchorIndex === -1 && currentSet.size > 0) {
      anchorIndex = allFiles.findIndex((f) => currentSet.has(f));
    }

    const clickedIndex = allFiles.indexOf(filePath);
    if (clickedIndex === -1) return;

    if (anchorIndex === -1) {
      // No anchor: select clicked and set as anchor
      const newSet = new Set(currentSet);
      newSet.add(filePath);
      set(selectedDiffFilesAtom, newSet);
      set(diffFileSelectionAnchorAtom, filePath);
      return;
    }

    // Range selection
    const start = Math.min(anchorIndex, clickedIndex);
    const end = Math.max(anchorIndex, clickedIndex);
    const newSet = new Set(currentSet);
    for (let i = start; i <= end; i++) {
      newSet.add(allFiles[i]!);
    }
    set(selectedDiffFilesAtom, newSet);
  },
);

// Set anchor for selection (used on normal clicks)
export const setDiffFileAnchorAtom = atom(
  null,
  (_get, set, filePath: string | null) => {
    set(diffFileSelectionAnchorAtom, filePath);
  },
);

// Commit message input
export const commitMessageAtom = atom<string>("");

// Git actions loading states
export interface GitActionsLoadingState {
  isCommitting: boolean;
  isStashing: boolean;
  isUnstashing: boolean;
  isPushing: boolean;
}

export const gitActionsLoadingAtom = atom<GitActionsLoadingState>({
  isCommitting: false,
  isStashing: false,
  isUnstashing: false,
  isPushing: false,
});

// Whether there are stashes available (for enabling/disabling Pop button)
export const hasStashAtom = atom<boolean>(false);

// Track chats with unseen changes (finished streaming but user hasn't opened them)
// Updated by onFinish callback in Chat instances
export const agentsUnseenChangesAtom = atom<Set<string>>(new Set<string>());

// Current todos state per sub-chat
// Syncs the first (creation) todo tool with subsequent updates
// Map structure: { [subChatId]: TodoState }
interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

interface TodoState {
  todos: TodoItem[];
  creationToolCallId: string | null; // ID of the tool call that created the todos
}

const allTodosStorageAtom = atom<Record<string, TodoState>>({});

// atomFamily to get/set todos per subChatId
export const currentTodosAtomFamily = atomFamily((subChatId: string) =>
  atom(
    (get) =>
      get(allTodosStorageAtom)[subChatId] ?? {
        todos: [],
        creationToolCallId: null,
      },
    (get, set, newState: TodoState) => {
      const current = get(allTodosStorageAtom);
      set(allTodosStorageAtom, { ...current, [subChatId]: newState });
    },
  ),
);

// Track sub-chats with unseen changes (finished streaming but user hasn't viewed them)
// Updated by onFinish callback in Chat instances
export const agentsSubChatUnseenChangesAtom = atom<Set<string>>(
  new Set<string>(),
);

// Archive popover open state
export const archivePopoverOpenAtom = atom<boolean>(false);

// Search query for archive
export const archiveSearchQueryAtom = atom<string>("");

// Repository filter for archive (null = all repositories)
const _archiveRepositoryFilterAtom = atom<string | null>(null);

// Track last used mode (plan/agent) per chat
// Map<chatId, "plan" | "agent">
export const lastChatModesAtom = atom<Map<string, "plan" | "agent" | "ralph">>(
  new Map<string, "plan" | "agent" | "ralph">(),
);

// Mobile view mode - chat (default, shows NewChatForm), chats list, preview, diff, or terminal
type AgentsMobileViewMode = "chats" | "chat" | "preview" | "diff" | "terminal";
export const agentsMobileViewModeAtom = atom<AgentsMobileViewMode>("chat");

// Scroll position persistence per sub-chat
// Maps subChatId to scroll data with validation metadata
export interface ScrollPositionData {
  scrollTop: number; // Saved scroll position in pixels
  scrollHeight: number; // Total scrollable height at save time (for validation)
  messageCount: number; // Number of messages at save time (for validation)
  wasStreaming: boolean; // Was chat streaming when we left?
  lastAssistantMsgId?: string; // ID of last assistant message when we left
}

export const agentsScrollPositionsAtom = atomWithStorage<
  Record<string, ScrollPositionData>
>("agents-scroll-positions-v2", {}, undefined, { getOnInit: true });

// Module-level cache for SYNCHRONOUS scroll position access during tab switches.
// The Jotai atom is async (state updates are batched), so we need this cache
// to ensure we always read the latest saved position immediately.
const scrollPositionsCache = new Map<string, ScrollPositionData>();

export const scrollPositionsCacheStore = {
  get: (subChatId: string): ScrollPositionData | undefined =>
    scrollPositionsCache.get(subChatId),

  set: (subChatId: string, data: ScrollPositionData) => {
    scrollPositionsCache.set(subChatId, data);
  },

  delete: (subChatId: string) => {
    scrollPositionsCache.delete(subChatId);
  },

  clear: () => {
    scrollPositionsCache.clear();
  },
};

// Debug mode for testing first-time user experience
// Only works in development mode
interface AgentsDebugMode {
  enabled: boolean;
  simulateNoTeams: boolean; // Simulate no teams available
  simulateNoRepos: boolean; // Simulate no repositories connected
  simulateNoReadyRepos: boolean; // Simulate only non-ready repos (in_progress/error)
  resetOnboarding: boolean; // Reset onboarding dialog on next load
  bypassConnections: boolean; // Allow going through onboarding steps even if already connected
  forceStep:
    | "workspace"
    | "profile"
    | "claude-code"
    | "github"
    | "discord"
    | null; // Force a specific onboarding step
  simulateCompleted: boolean; // Simulate onboarding as completed
}

export const agentsDebugModeAtom = atomWithStorage<AgentsDebugMode>(
  "agents:debugMode",
  {
    enabled: false,
    simulateNoTeams: false,
    simulateNoRepos: false,
    simulateNoReadyRepos: false,
    resetOnboarding: false,
    bypassConnections: false,
    forceStep: null,
    simulateCompleted: false,
  },
  undefined,
  { getOnInit: true },
);

// Changed files per sub-chat for tracking edits/writes
// Map<subChatId, FileChange[]>
// SubChatFileChange is an alias for FileChange from shared types for backwards compatibility
export type SubChatFileChange = FileChange;

export const subChatFilesAtom = atom<Map<string, SubChatFileChange[]>>(
  new Map(),
);

// Mapping from subChatId to chatId (workspace ID) for aggregating stats
// Map<subChatId, chatId>
export const subChatToChatMapAtom = atom<Map<string, string>>(new Map());

// Filter files for diff sidebar (null = show all files)
// When set, AgentDiffView will only show files matching these paths
export const filteredDiffFilesAtom = atom<string[] | null>(null);

// Pending PR message to send to chat
// Set by ChatView when "Create PR" is clicked, consumed by ChatViewInner
export const pendingPrMessageAtom = atom<string | null>(null);

// Pending Review message to send to chat
// Set by ChatView when "Review" is clicked, consumed by ChatViewInner
export const pendingReviewMessageAtom = atom<string | null>(null);

// Pending auth retry - stores failed message when auth-error occurs
// After successful OAuth flow, this triggers automatic retry of the message
type PendingAuthRetryMessage = {
  subChatId: string; // Required: only retry in the correct chat
  prompt: string;
  images?: Array<{
    base64Data: string;
    mediaType: string;
    filename?: string;
  }>;
  readyToRetry: boolean; // Only retry when this is true (set by modal on OAuth success)
};
export const pendingAuthRetryMessageAtom = atom<PendingAuthRetryMessage | null>(
  null,
);

// Pending Ralph auto-start implementation - when PRD is generated or story completes,
// the backend emits ralph-auto-continue with a pre-built continuation message
export interface PendingRalphAutoStart {
  subChatId: string;
  completedStoryId?: string;
  continuationMessage: string;
  nextStoryId: string;
  nextStoryTitle: string;
}
export const pendingRalphAutoStartsAtom = atom<
  Map<string, PendingRalphAutoStart>
>(new Map());

// Ralph PRD generation status - used to show PRD status card in chat UI
// Bypasses AI SDK tool mechanism for more reliable rendering
export interface RalphPrdStatus {
  subChatId: string;
  status: "generating" | "complete";
  message?: string;
  prd?: {
    goal: string;
    branchName: string;
    stories: Array<{
      id: string;
      title: string;
      priority: number;
      type?: string;
    }>;
  };
}
export const ralphPrdStatusesAtom = atom<Map<string, RalphPrdStatus>>(
  new Map(),
);

// Ralph injected prompt - used to update in-memory Chat messages with the enhanced prompt
export const ralphInjectedPromptsAtom = atom<
  Map<string, { subChatId: string; text: string }>
>(new Map());

// Provider that triggered auth error - used by login modal to show provider-specific instructions
export const authErrorProviderAtom = atom<ProviderId | null>(null);

// Work mode preference (local = work in project dir, worktree = create isolated worktree)
export type WorkMode = "local" | "worktree";
export const lastSelectedWorkModeAtom = atomWithStorage<WorkMode>(
  "agents:lastSelectedWorkMode",
  "worktree", // default to worktree for current behavior
  undefined,
  { getOnInit: true },
);

// Last selected branch per project (persisted)
// Maps projectId -> branchName
export const lastSelectedBranchesAtom = atomWithStorage<Record<string, string>>(
  "agents:lastSelectedBranches",
  {},
  undefined,
  { getOnInit: true },
);

// Compacting status per sub-chat
// Set<subChatId> - subChats currently being compacted
export const compactingSubChatsAtom = atom<Set<string>>(new Set<string>());

// Track IDs of chats/subchats created in this browser session (NOT persisted - resets on reload)
// Used to determine whether to show placeholder + typewriter effect
export const justCreatedIdsAtom = atom<Set<string>>(new Set<string>());

// Pending user questions from AskUserQuestion tool
// Set when Claude requests user input, cleared when answered or skipped
export const QUESTIONS_SKIPPED_MESSAGE =
  "User skipped questions - proceed with defaults";
export const QUESTIONS_TIMED_OUT_MESSAGE = "Timed out";

export type PendingUserQuestions = {
  subChatId: string;
  toolUseId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
};
export const pendingUserQuestionsAtom = atom<PendingUserQuestions | null>(null);

// Track sub-chats with pending plan approval (plan ready but not yet implemented)
// Set<subChatId>
export const pendingPlanApprovalsAtom = atom<Set<string>>(new Set<string>());

// Store AskUserQuestion results by toolUseId for real-time updates
// Map<toolUseId, result>
export const askUserQuestionResultsAtom = atom<Map<string, unknown>>(new Map());

// Unified undo stack for workspace and sub-chat archivation
// Supports Cmd+Z to restore the last archived item (workspace or sub-chat)
export type UndoItem =
  | {
      type: "workspace";
      chatId: string;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  | {
      type: "subchat";
      subChatId: string;
      chatId: string;
      timeoutId: ReturnType<typeof setTimeout>;
    };

export const undoStackAtom = atom<UndoItem[]>([]);

// Prompt history storage - stores prompts per scope key
// Key format: "project:{projectId}" or "chat:{chatId}"
const promptHistoryStorageAtom = atomWithStorage<Record<string, string[]>>(
  "agents:promptHistory",
  {},
  undefined,
  { getOnInit: true },
);

const MAX_PROMPT_HISTORY = 100;

// atomFamily to get/set prompt history per scope
export const promptHistoryAtomFamily = atomFamily((scopeKey: string) =>
  atom(
    (get) => get(promptHistoryStorageAtom)[scopeKey] ?? [],
    (get, set, newPrompt: string | string[]) => {
      const current = get(promptHistoryStorageAtom);
      const existing = current[scopeKey] ?? [];

      // Handle both single prompt (add) and full array (set)
      const updated =
        typeof newPrompt === "string"
          ? [...existing.filter((p) => p !== newPrompt), newPrompt] // Dedupe and add to end
          : newPrompt;

      // Limit size
      const limited = updated.slice(-MAX_PROMPT_HISTORY);
      set(promptHistoryStorageAtom, { ...current, [scopeKey]: limited });
    },
  ),
);

// Navigation index per editor instance (NOT persisted - resets on mount)
// -1 = not navigating (at current input), 0+ = index from end of history
interface HistoryNavState {
  index: number;
  savedInput: string; // Saves current input when starting navigation
}

export const historyNavAtomFamily = atomFamily((_scopeKey: string) =>
  atom<HistoryNavState>({ index: -1, savedInput: "" }),
);

// Added directories per sub-chat (synced from database)
// Stores additional working directories for context (e.g., /add-dir command)
const addedDirectoriesStorageAtom = atom<Record<string, string[]>>({});

// atomFamily to get/set added directories per subChatId
export const addedDirectoriesAtomFamily = atomFamily((subChatId: string) =>
  atom(
    (get) => get(addedDirectoriesStorageAtom)[subChatId] ?? [],
    (get, set, newDirs: string[] | ((prev: string[]) => string[])) => {
      const current = get(addedDirectoriesStorageAtom);
      const existing = current[subChatId] ?? [];
      const updated =
        typeof newDirs === "function" ? newDirs(existing) : newDirs;
      set(addedDirectoriesStorageAtom, { ...current, [subChatId]: updated });
    },
  ),
);

// ============================================================================
// Left Sidebar Changes View State
// ============================================================================

// Import types for commit history
import type { ChangedFile, CommitInfo } from "../../../../shared/changes-types";
// Import types from use-diff-management hook
import type { DiffStats, ParsedFileDiff } from "../hooks/use-diff-management";

// Re-export for convenience
export type { DiffStats, ParsedFileDiff };
export type { ChangedFile, CommitInfo };

// Shared diff data from active chat (set by active-chat.tsx, read by left sidebar)
export interface ActiveChatDiffData {
  chatId: string;
  worktreePath: string | null;
  sandboxId: string | undefined;
  repository: string | undefined;
  diffStats: DiffStats;
  diffContent: string | null;
  parsedFileDiffs: ParsedFileDiff[] | null;
  prefetchedFileContents: Record<string, string>;
  commits?: CommitInfo[]; // Commit history for the branch vs base
}

export const activeChatDiffDataAtom = atom<ActiveChatDiffData | null>(null);

// Project-level diff data (set by agents-content.tsx when no chat selected)
export interface ProjectDiffData {
  projectId: string;
  projectPath: string;
  diffStats: DiffStats;
  diffContent: string | null;
  parsedFileDiffs: ParsedFileDiff[] | null;
  prefetchedFileContents: Record<string, string>;
  commits?: CommitInfo[]; // Commit history for current branch vs default
}

export const projectDiffDataAtom = atom<ProjectDiffData | null>(null);

// Trigger to refresh diff data - increment to trigger refetch
// Used by components that modify the worktree (discard changes, etc.)
export const refreshDiffTriggerAtom = atom<number>(0);

// PR actions state (set by active-chat.tsx, read by left sidebar)
export interface PrActionsState {
  // PR state
  prUrl: string | null;
  prNumber: number | null;
  hasPrNumber: boolean;
  isPrOpen: boolean;
  // Loading states
  isCreatingPr: boolean;
  isCommittingToPr: boolean;
  isMergingPr: boolean;
  isReviewing: boolean;
  // Actions
  onCreatePr: () => void;
  onCommitToPr: () => void;
  onMergePr: () => void;
  onReview: () => void;
}

export const prActionsAtom = atom<PrActionsState | null>(null);

// Left sidebar expanded width (when showing diffs)
export const leftSidebarExpandedWidthAtom = atomWithStorage<number>(
  "agents:leftSidebarExpandedWidth",
  350,
  undefined,
  { getOnInit: true },
);

// Changes section collapsed state in left sidebar
export const changesSectionCollapsedAtom = atomWithStorage<boolean>(
  "agents:changesSectionCollapsed",
  false,
  undefined,
  { getOnInit: true },
);

// Right sidebar section collapse states
export const pinnedSectionCollapsedAtom = atomWithStorage<boolean>(
  "agents:pinnedSectionCollapsed",
  false,
  undefined,
  { getOnInit: true },
);

export const recentSectionCollapsedAtom = atomWithStorage<boolean>(
  "agents:recentSectionCollapsed",
  false,
  undefined,
  { getOnInit: true },
);

export const draftsSectionCollapsedAtom = atomWithStorage<boolean>(
  "agents:draftsSectionCollapsed",
  false,
  undefined,
  { getOnInit: true },
);

// ============================================================================
// Commit History State
// ============================================================================

// Expanded commit hashes in the changes view - which commits are currently expanded
// Uses string[] instead of Set for JSON serialization with atomWithStorage
export const expandedCommitHashesAtom = atomWithStorage<string[]>(
  "agents:expandedCommitHashes",
  [],
  undefined,
  { getOnInit: true },
);

// Helper atoms for toggling commit expansion
export const toggleCommitExpandedAtom = atom(
  null,
  (get, set, commitHash: string) => {
    const current = get(expandedCommitHashesAtom);
    if (current.includes(commitHash)) {
      set(
        expandedCommitHashesAtom,
        current.filter((h) => h !== commitHash),
      );
    } else {
      set(expandedCommitHashesAtom, [...current, commitHash]);
    }
  },
);

// Cache for lazy-loaded commit files
export interface CommitFilesState {
  files: ChangedFile[];
  isLoading: boolean;
  hasFetched: boolean;
  error?: string;
}

// Internal storage atom for commit files cache
const commitFilesCacheStorageAtom = atom<Record<string, CommitFilesState>>({});

// atomFamily to get/set commit files per commit hash
export const commitFilesAtomFamily = atomFamily((commitHash: string) =>
  atom(
    (get) =>
      get(commitFilesCacheStorageAtom)[commitHash] ?? {
        files: [],
        isLoading: false,
        hasFetched: false,
      },
    (get, set, newState: CommitFilesState) => {
      const current = get(commitFilesCacheStorageAtom);
      set(commitFilesCacheStorageAtom, { ...current, [commitHash]: newState });
    },
  ),
);

// Clear commit files cache (used when switching chats)
export const clearCommitFilesCacheAtom = atom(null, (_get, set) => {
  set(commitFilesCacheStorageAtom, {});
});

// ============================================================================
// Diff Viewing Mode (Center Diff View)
// ============================================================================

// The three diff viewing modes for the center diff view
export type DiffViewingMode =
  | { type: "uncommitted" }
  | { type: "commit"; commitHash: string; message: string }
  | { type: "full" };

// Current diff viewing mode
export const diffViewingModeAtom = atom<DiffViewingMode>({
  type: "uncommitted",
});

// Commit diff data - separate from activeChatDiffDataAtom to avoid corrupting sidebar state
export interface CommitDiffData {
  commitHash: string;
  diffContent: string | null;
  parsedFileDiffs: ParsedFileDiff[] | null;
  diffStats: DiffStats;
  prefetchedFileContents: Record<string, string>;
  isLoading: boolean;
}

export const commitDiffDataAtom = atom<CommitDiffData | null>(null);

// Full diff data - all changes (committed + uncommitted) vs base branch
export interface FullDiffData {
  diffContent: string | null;
  parsedFileDiffs: ParsedFileDiff[] | null;
  diffStats: DiffStats;
  prefetchedFileContents: Record<string, string>;
  isLoading: boolean;
}

export const fullDiffDataAtom = atom<FullDiffData | null>(null);

// ============================================================================
// Left Sidebar Project Tree State
// ============================================================================

// Active tab in left sidebar ('project' = file tree, 'changes' = git changes)
export type LeftSidebarTab = "project" | "changes";
export const leftSidebarActiveTabAtom = atomWithStorage<LeftSidebarTab>(
  "agents:leftSidebarActiveTab",
  "project",
  undefined,
  { getOnInit: true },
);

// Expanded folders per project (persisted)
// Maps projectPath -> array of expanded folder relative paths
export const expandedFoldersAtom = atomWithStorage<Record<string, string[]>>(
  "agents:expandedFolders",
  {},
  undefined,
  { getOnInit: true },
);

// atomFamily to get/set expanded folders per project
export const expandedFoldersAtomFamily = atomFamily((projectPath: string) =>
  atom(
    (get) => get(expandedFoldersAtom)[projectPath] ?? [],
    (get, set, update: string[] | ((prev: string[]) => string[])) => {
      const current = get(expandedFoldersAtom);
      const prevPaths = current[projectPath] ?? [];
      const newPaths =
        typeof update === "function" ? update(prevPaths) : update;
      set(expandedFoldersAtom, { ...current, [projectPath]: newPaths });
    },
  ),
);

// ============================================================================
// Center File Viewer State
// ============================================================================

// Center file view open state - when true, shows file viewer in main content
export const centerFileViewOpenAtom = atom<boolean>(false);

// File path for center file view (relative to project)
export const centerFilePathAtom = atom<string | null>(null);

// Target line number for center file view (null = no specific line)
// Set by QuickOpenDialog when user types "filename:123" syntax
export const centerFileLineAtom = atom<number | null>(null);

// Trigger reveal in project tree - set to relative file path
// When set, ProjectFileTree expands all parent folders, scrolls to file, and highlights it
export const revealFileInTreeAtom = atom<string | null>(null);

// ============================================================================
// Main Content Tabs State
// ============================================================================

// Main content active tab - controls which view is shown in center area
// Order: Chat | File | Changes
export type MainContentTab = "chat" | "file" | "changes";
export const mainContentActiveTabAtom = atom<MainContentTab>("chat");

// Chat input height - tracked for overlay positioning
// When File/Changes tabs overlay the chat, they need to leave room for the input
export const chatInputHeightAtom = atom<number>(120);

// ============================================================================
// Code Snippet Context (Add selected text to chat)
// ============================================================================

// Code snippet attachment type for adding selected code to chat context
export interface CodeSnippet {
  id: string;
  filePath: string; // Relative path to file
  startLine: number; // 1-indexed start line
  endLine: number; // 1-indexed end line
  content: string; // Selected text content
  language: string; // Language for syntax highlighting
}

// Code snippets storage per sub-chat (transient, not persisted)
const codeSnippetsStorageAtom = atom<Record<string, CodeSnippet[]>>({});

// atomFamily to get/set code snippets per subChatId
export const codeSnippetsAtomFamily = atomFamily((subChatId: string) =>
  atom(
    (get) => get(codeSnippetsStorageAtom)[subChatId] ?? [],
    (
      get,
      set,
      update: CodeSnippet[] | ((prev: CodeSnippet[]) => CodeSnippet[]),
    ) => {
      const current = get(codeSnippetsStorageAtom);
      const existing = current[subChatId] ?? [];
      const updated = typeof update === "function" ? update(existing) : update;
      set(codeSnippetsStorageAtom, { ...current, [subChatId]: updated });
    },
  ),
);

// ============================================================================
// Pending File Mentions (for adding files from project tree to chat)
// ============================================================================

// Import type for FileMentionOption
import type { FileMentionOption } from "../mentions/types";

// Pending file mentions to be added to chat input
// Set by project tree context menu or drag, consumed by active-chat
export const pendingFileMentionsAtom = atom<FileMentionOption[]>([]);
