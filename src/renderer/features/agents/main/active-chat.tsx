"use client";

// e2b API routes are used instead of useSandboxManager for agents
// import { clearSubChatSelectionAtom, isSubChatMultiSelectModeAtom, selectedSubChatIdsAtom } from "@/lib/atoms/agent-subchat-selection"
import { Chat, useChat } from "@ai-sdk/react";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useStickToBottom } from "use-stick-to-bottom";
import { Button } from "../../../components/ui/button";
import {
  AgentIcon,
  AttachIcon,
  IconCloseSidebarRight,
} from "../../../components/ui/icons";
import { Kbd } from "../../../components/ui/kbd";
import {
  PromptInput,
  PromptInputActions,
} from "../../../components/ui/prompt-input";
import { ResizableSidebar } from "../../../components/ui/resizable-sidebar";
import {
  chatProviderOverridesAtom,
  defaultProviderIdAtom,
  lastSelectedModelByProviderAtom,
  type ProviderId,
  soundNotificationsEnabledAtom,
  subChatProviderOverridesAtom,
} from "../../../lib/atoms";
import { appStore } from "../../../lib/jotai-store";
import { api } from "../../../lib/mock-api";
import { trpc, trpcClient } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import { isDesktopApp } from "../../../lib/utils/platform";
import { RalphProgressBadge, RalphSetupDialog } from "../../ralph";
// Sub-chats sidebar removed - sub-chats now shown inline in main sidebar tree view
// import { AgentsSubChatsSidebar } from "../../sidebar/agents-subchats-sidebar";
import { useDesktopNotifications } from "../../sidebar/hooks/use-desktop-notifications";
import { terminalSidebarOpenAtom } from "../../terminal/atoms";
import { TerminalSidebar } from "../../terminal/terminal-sidebar";
import {
  type AgentMode,
  activeChatDiffDataAtom,
  agentModeAtom,
  agentsPreviewSidebarOpenAtom,
  agentsPreviewSidebarWidthAtom,
  agentsSubChatUnseenChangesAtom,
  agentsUnseenChangesAtom,
  askUserQuestionResultsAtom,
  changesSectionCollapsedAtom,
  chatInputHeightAtom,
  chatsSidebarOpenAtom,
  clearLoading,
  codeSnippetsAtomFamily,
  compactingSubChatsAtom,
  historyNavAtomFamily,
  justCreatedIdsAtom,
  loadingSubChatsAtom,
  mainContentActiveTabAtom,
  pendingAuthRetryMessageAtom,
  pendingUserQuestionsAtom,
  prActionsAtom,
  promptHistoryAtomFamily,
  QUESTIONS_SKIPPED_MESSAGE,
  selectedAgentChatIdAtom,
  setLoading,
  undoStackAtom,
} from "../atoms";
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
import { ModeToggleDropdown } from "../components/mode-toggle-dropdown";
import { ModelSelectorDropdown } from "../components/model-selector-dropdown";
import { OpenCodeModelSelector } from "../components/opencode-model-selector";
import { ProviderSelectorDropdown } from "../components/provider-selector-dropdown";
import { WebSearchModeSelector } from "../components/web-search-mode-selector";
import { useAgentModeManagement } from "../hooks/use-agent-mode-management";
import { useAgentsFileUpload } from "../hooks/use-agents-file-upload";
import { useBranchSwitchConfirmation } from "../hooks/use-branch-switch-confirmation";
import { useChangedFilesTracking } from "../hooks/use-changed-files-tracking";
import { useDiffManagement } from "../hooks/use-diff-management";
import { useDraftManagement } from "../hooks/use-draft-management";
import { useFocusInputOnEnter } from "../hooks/use-focus-input-on-enter";
import { useMentionDropdown } from "../hooks/use-mention-dropdown";
import { useMessageHandling } from "../hooks/use-message-handling";
import { usePendingMessages } from "../hooks/use-pending-messages";
import { usePlanApproval } from "../hooks/use-plan-approval";
import { usePrActions } from "../hooks/use-pr-actions";
import { useProviderModelSelection } from "../hooks/use-provider-model-selection";
import { useRalphAutoStart } from "../hooks/use-ralph-auto-start";
import { useScrollTracking } from "../hooks/use-scroll-tracking";
import { useSlashCommandDropdown } from "../hooks/use-slash-command-dropdown";
import { useSubChatInitialization } from "../hooks/use-subchat-initialization";
import { useSubChatKeyboard } from "../hooks/use-subchat-keyboard";
import { useToggleFocusOnCmdEsc } from "../hooks/use-toggle-focus-on-cmd-esc";
import { IPCChatTransport } from "../lib/ipc-chat-transport";
import {
  AgentsFileMention,
  type AgentsMentionsEditorHandle,
  type FileMentionOption,
} from "../mentions";
import { agentChatStore } from "../stores/agent-chat-store";
import {
  type SubChatMeta,
  useAgentSubChatStore,
} from "../stores/sub-chat-store";
import { AddedDirectoriesBadge } from "../ui/added-directories-badge";
import { AgentContextIndicator } from "../ui/agent-context-indicator";
import { AgentPreview } from "../ui/agent-preview";
import { AgentUserQuestion } from "../ui/agent-user-question";
import { BranchSwitchDialog } from "../ui/branch-switch-dialog";
import { ChatTitleEditor } from "../ui/chat-title-editor";
// DiffSidebar moved to left sidebar - see LeftSidebarChangesView
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from "../ui/message-controls";
import { getProviderIcon } from "../ui/provider-icons";
import { SubChatStatusCard } from "../ui/sub-chat-status-card";
import { WorktreeInitProgress } from "../ui/worktree-init-progress";
import { autoRenameAgentChat } from "../utils/auto-rename";
import { handlePasteEvent } from "../utils/paste-text";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";

const clearSubChatSelectionAtom = atom(null, () => {});
const isSubChatMultiSelectModeAtom = atom(false);
const selectedSubChatIdsAtom = atom(new Set<string>());
// import { selectedTeamIdAtom } from "@/lib/atoms/team"
const selectedTeamIdAtom = atom<string | null>(null);
// Type for chat list items (from tRPC chats.list)
type ChatListItem = {
  id: string;
  name: string | null;
  projectId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  archivedAt: Date | null;
  worktreePath: string | null;
  branch: string | null;
  baseBranch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  providerId: string | null;
};

// Type for sub-chat items
type SubChatItem = {
  id: string;
  name?: string | null;
  mode?: "plan" | "agent" | "ralph" | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages?: any;
  streamId?: string | null;
  chatId?: string;
};

// Get the ID of the first sub-chat by creation date
function getFirstSubChatId(
  subChats:
    | Array<{ id: string; created_at?: Date | string | null }>
    | undefined,
): string | null {
  if (!subChats?.length) return null;
  const sorted = [...subChats].sort(
    (a, b) =>
      (a.created_at ? new Date(a.created_at).getTime() : 0) -
      (b.created_at ? new Date(b.created_at).getTime() : 0),
  );
  return sorted[0]?.id ?? null;
}

// Find the first NEW assistant message after the last known one
// Used for smart scroll: when returning to a chat where streaming finished,
// scroll to the start of the new response instead of bottom
function _findFirstNewAssistantMessage(
  messages: Array<{ id: string; role: string }>,
  lastKnownAssistantMsgId?: string,
): string | undefined {
  if (!lastKnownAssistantMsgId) {
    // No previous assistant message - find first one
    return messages.find((m) => m.role === "assistant")?.id;
  }

  // Find index of last known message
  const lastKnownIndex = messages.findIndex(
    (m) => m.id === lastKnownAssistantMsgId,
  );
  if (lastKnownIndex === -1) return undefined;

  // Find first assistant message after that
  for (let i = lastKnownIndex + 1; i < messages.length; i++) {
    if (messages[i]?.role === "assistant") {
      return messages[i]?.id;
    }
  }

  return undefined;
}

// Inner chat component - only rendered when chat object is ready
function ChatViewInner({
  chat,
  subChatId,
  parentChatId,
  onAutoRename,
  onCreateNewSubChat,
  teamId,
  repository,
  streamId,
  isMobile = false,
  sandboxSetupStatus = "ready",
  sandboxSetupError,
  onRetrySetup,
  sandboxId,
  projectPath,
  isArchived = false,
  onRestoreWorkspace,
  chatBranch,
  originalProjectPath,
  isOverlayMode = false,
  overlayContent,
}: {
  chat: Chat<any>;
  subChatId: string;
  parentChatId: string;
  isFirstSubChat: boolean;
  onAutoRename: (userMessage: string, subChatId: string) => void;
  onCreateNewSubChat?: () => void;
  teamId?: string;
  repository?: string;
  streamId?: string | null;
  isMobile?: boolean;
  sandboxSetupStatus?: "cloning" | "ready" | "error";
  sandboxSetupError?: string;
  onRetrySetup?: () => void;
  sandboxId?: string;
  projectPath?: string;
  isArchived?: boolean;
  onRestoreWorkspace?: () => void;
  chatBranch?: string | null;
  originalProjectPath?: string;
  isOverlayMode?: boolean;
  overlayContent?: React.ReactNode;
}) {
  // UNCONTROLLED: just track if editor has content for send button
  const [hasContent, setHasContent] = useState(false);
  const hasTriggeredRenameRef = useRef(false);
  const hasTriggeredAutoGenerateRef = useRef(false);

  // Input expansion state for overlay mode (compact bar that expands on hover)
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handlers for stable hover behavior with delayed collapse
  const handleInputAreaMouseEnter = useCallback(() => {
    // Cancel any pending collapse
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setIsInputExpanded(true);
  }, []);

  const handleInputAreaMouseLeave = useCallback(() => {
    // Delay collapse to avoid flickering
    collapseTimeoutRef.current = setTimeout(() => {
      setIsInputExpanded(false);
    }, 150);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  const editorRef = useRef<AgentsMentionsEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const _prevChatKeyRef = useRef<string | null>(null);
  const prevSubChatIdRef = useRef<string | null>(null);

  // Track input height for overlay positioning (when File/Changes tabs overlay the chat)
  const _setInputHeight = useSetAtom(chatInputHeightAtom);
  // For switching to chat tab after sending message in overlay mode
  const _setActiveTab = useSetAtom(mainContentActiveTabAtom);

  // TTS playback rate state (persists across messages and sessions via localStorage)
  const [ttsPlaybackRate, setTtsPlaybackRate] = useState<PlaybackSpeed>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tts-playback-rate");
      if (saved && PLAYBACK_SPEEDS.includes(Number(saved) as PlaybackSpeed)) {
        return Number(saved) as PlaybackSpeed;
      }
    }
    return 1;
  });

  // Save playback rate to localStorage when it changes
  const handlePlaybackRateChange = useCallback((rate: PlaybackSpeed) => {
    setTtsPlaybackRate(rate);
    localStorage.setItem("tts-playback-rate", String(rate));
  }, []);

  // tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Branch switch confirmation hook for sending messages
  const branchSwitchForMessage = useBranchSwitchConfirmation({
    projectPath: originalProjectPath,
    chatBranch,
    isWorktreeMode:
      !!projectPath &&
      !!originalProjectPath &&
      projectPath !== originalProjectPath,
  });

  // Get sub-chat name from store
  const subChatName = useAgentSubChatStore(
    (state) => state.allSubChats.find((sc) => sc.id === subChatId)?.name || "",
  );

  // Mutation for renaming sub-chat
  const renameSubChatMutation = api.agents.renameSubChat.useMutation({
    onSuccess: () => {
      utils.chats.listWithSubChats.invalidate();
    },
    onError: (error) => {
      if (error.data?.code === "NOT_FOUND") {
        toast.error("Send a message first before renaming this chat");
      } else {
        toast.error("Failed to rename chat");
      }
    },
  });

  // Handler for renaming sub-chat
  const handleRenameSubChat = useCallback(
    async (newName: string) => {
      // Optimistic update in store
      useAgentSubChatStore.getState().updateSubChatName(subChatId, newName);

      // Save to database
      try {
        await renameSubChatMutation.mutateAsync({
          subChatId,
          name: newName,
        });
      } catch {
        // Revert on error (toast shown by mutation onError)
        useAgentSubChatStore
          .getState()
          .updateSubChatName(subChatId, subChatName || "New Chat");
      }
    },
    [subChatId, subChatName, renameSubChatMutation],
  );

  // Agent mode state (read from global atom)
  const [agentMode, setAgentMode] = useAtom(agentModeAtom);
  // Backward compatibility helper
  const isPlanMode = agentMode === "plan";

  // Prompt history - scoped to chat (workspace)
  const historyKey = `chat:${parentChatId}`;
  const [history, _addToHistory] = useAtom(promptHistoryAtomFamily(historyKey));
  const [navState, setNavState] = useAtom(historyNavAtomFamily(historyKey));

  // Handler for mode changes
  const handleAgentModeChange = useCallback(
    (newMode: AgentMode) => {
      setAgentMode(newMode);
    },
    [setAgentMode],
  );

  // Provider & model selection hook - manages provider/model state, fetching, and persistence
  const {
    effectiveProvider,
    providerModels,
    currentModelId,
    handleProviderChange,
    handleModelChange,
    handleOpenCodeModelChange,
  } = useProviderModelSelection({
    subChatId,
    parentChatId,
  });

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [_shouldOpenClaudeSubmenu, setShouldOpenClaudeSubmenu] =
    useState(false);

  // File/image upload hook
  const {
    images,
    files,
    handleAddAttachments,
    removeImage,
    removeFile,
    clearAll,
    isUploading,
  } = useAgentsFileUpload();

  // Code snippets state for "Add to Chat" feature
  const [codeSnippets, setCodeSnippets] = useAtom(
    codeSnippetsAtomFamily(subChatId),
  );

  // Remove a code snippet by ID
  const removeCodeSnippet = useCallback(
    (snippetId: string) => {
      setCodeSnippets((prev) => prev.filter((s) => s.id !== snippetId));
    },
    [setCodeSnippets],
  );

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

  // Shift+Tab handler for mode switching (now handled inside input component)

  // Keyboard shortcut: Cmd+/ to open model selector (Claude submenu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        e.stopPropagation();

        setShouldOpenClaudeSubmenu(true);
        setIsModelDropdownOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Track chat changes for rename trigger reset
  const chatRef = useRef<Chat<any> | null>(null);

  if (prevSubChatIdRef.current !== subChatId) {
    hasTriggeredRenameRef.current = false; // Reset on sub-chat change
    hasTriggeredAutoGenerateRef.current = false; // Reset auto-generate on sub-chat change
    prevSubChatIdRef.current = subChatId;
  }
  chatRef.current = chat;

  // Refs for draft management hook
  const currentSubChatIdRef = useRef<string>(subChatId);
  const currentChatIdRef = useRef<string | null>(parentChatId);
  const currentDraftTextRef = useRef<string>("");
  currentSubChatIdRef.current = subChatId;
  currentChatIdRef.current = parentChatId;

  // Use subChatId as stable key to prevent HMR-induced duplicate resume requests
  // resume: !!streamId to reconnect to active streams (background streaming support)
  const { messages, sendMessage, setMessages, status, stop, regenerate } =
    useChat({
      id: subChatId,
      chat,
      resume: !!streamId,
      experimental_throttle: 100,
    });

  // Scroll management via use-stick-to-bottom for smooth auto-scrolling
  const { scrollRef, contentRef, scrollToBottom } = useStickToBottom({
    initial: "instant",
    resize: "smooth",
  });

  // Message handling hook - consolidates send, stop, compact, and branch switch logic
  const {
    handleSend,
    handleStop,
    handleCompact,
    handleConfirmBranchSwitchForMessage,
    stableHandleSend,
  } = useMessageHandling({
    subChatId,
    parentChatId,
    teamId,
    sendMessage,
    stop,
    messages,
    status,
    editorRef,
    images,
    files,
    clearAll,
    onAutoRename,
    scrollToBottom,
    branchSwitchForMessage,
    currentDraftTextRef,
    hasTriggeredRenameRef,
    sandboxSetupStatus,
    isArchived,
    onRestoreWorkspace,
    isOverlayMode,
    utils,
  });

  // Plan approval hook - handles plan detection, keyboard shortcuts, and approval flow
  const { hasUnapprovedPlan, handleApprovePlan } = usePlanApproval({
    subChatId,
    messages,
    sendMessage,
    isStreaming: status === "streaming" || status === "submitted",
    setAgentMode,
  });

  // Ralph auto-start hook - handles PRD state, setup dialog, and story auto-start
  const {
    ralphSetupOpen,
    setRalphSetupOpen,
    ralphState: _ralphState,
  } = useRalphAutoStart({
    subChatId,
    agentMode,
    messages,
    setMessages,
  });

  // Scroll tracking hook - tracks scroll position to auto-expand input when at bottom
  const { isAtBottom } = useScrollTracking({
    scrollRef,
    isOverlayMode,
  });

  // Agent mode management hook - handles mode initialization and persistence
  const { addedDirs, setAddedDirs } = useAgentModeManagement({
    subChatId,
    parentChatId,
    agentMode,
    setAgentMode,
    utils,
  });

  // Draft management hook - handles draft persistence and input height tracking
  useDraftManagement({
    subChatId,
    parentChatId,
    editorRef,
    inputContainerRef,
    currentDraftTextRef,
    currentChatIdRef,
    currentSubChatIdRef,
  });

  // Pending messages hook - handles pending PR/review messages and file mentions
  usePendingMessages({
    isStreaming: status === "streaming" || status === "submitted",
    sendMessage,
    editorRef,
  });

  // Stream debug: log status changes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (prevStatusRef.current !== status) {
      const subId = subChatId.slice(-8);
      console.log(
        `[SD] C:STATUS sub=${subId} ${prevStatusRef.current} → ${status} msgs=${messages.length}`,
      );
      prevStatusRef.current = status;
    }
  }, [status, subChatId, messages.length]);

  const isStreaming = status === "streaming" || status === "submitted";

  const [isInputFocused, setIsInputFocused] = useState(false);

  // Track compacting status from SDK
  const compactingSubChats = useAtomValue(compactingSubChatsAtom);
  const isCompacting = compactingSubChats.has(subChatId);

  // Sync loading status to atom for UI indicators
  // When streaming starts, set loading. When it stops, clear loading.
  // Unseen changes, sound notification, and sidebar refresh are handled in onFinish callback
  const setLoadingSubChats = useSetAtom(loadingSubChatsAtom);

  useEffect(() => {
    const storedParentChatId = agentChatStore.getParentChatId(subChatId);
    if (!storedParentChatId) return;

    if (isStreaming) {
      setLoading(setLoadingSubChats, subChatId, storedParentChatId);
    } else {
      clearLoading(setLoadingSubChats, subChatId);
    }
  }, [isStreaming, subChatId, setLoadingSubChats]);

  // Pending user questions from AskUserQuestion tool
  const [pendingQuestions, setPendingQuestions] = useAtom(
    pendingUserQuestionsAtom,
  );

  // Memoize the last assistant message to avoid unnecessary recalculations
  const lastAssistantMessage = useMemo(
    () => messages.findLast((m) => m.role === "assistant"),
    [messages],
  );

  // Track previous streaming state to detect stream stop
  const prevIsStreamingRef = useRef(isStreaming);
  // Track if we recently stopped streaming (to prevent sync effect from restoring)
  const recentlyStoppedStreamRef = useRef(false);

  // Clear pending questions when streaming is aborted
  // This effect runs when isStreaming transitions from true to false
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    // Detect streaming stop transition
    if (wasStreaming && !isStreaming) {
      // Mark that we recently stopped streaming
      recentlyStoppedStreamRef.current = true;
      // Clear the flag after a delay
      const flagTimeout = setTimeout(() => {
        recentlyStoppedStreamRef.current = false;
      }, 500);

      // Streaming just stopped - if there's a pending question for this chat,
      // clear it after a brief delay (backend already handled the abort)
      if (pendingQuestions?.subChatId === subChatId) {
        const timeout = setTimeout(() => {
          // Re-check if still showing the same question (might have been cleared by other means)
          setPendingQuestions((current) => {
            if (current?.subChatId === subChatId) {
              return null;
            }
            return current;
          });
        }, 150); // Small delay to allow for race conditions with transport chunks
        return () => {
          clearTimeout(timeout);
          clearTimeout(flagTimeout);
        };
      }
      return () => clearTimeout(flagTimeout);
    }
  }, [
    isStreaming,
    subChatId,
    pendingQuestions?.subChatId,
    pendingQuestions?.toolUseId,
    setPendingQuestions,
  ]);

  // Sync pending questions with messages state
  // This handles: 1) restoring on chat switch, 2) clearing when question is answered/timed out
  useEffect(() => {
    // Check if there's a pending AskUserQuestion in the last assistant message
    const pendingQuestionPart = lastAssistantMessage?.parts?.find(
      (part: any) =>
        part.type === "tool-AskUserQuestion" &&
        part.state !== "output-available" &&
        part.state !== "output-error" &&
        part.state !== "result" &&
        part.input?.questions,
    ) as any | undefined;

    // If streaming and we already have a pending question for this chat, keep it
    // (transport will manage it via chunks)
    if (isStreaming && pendingQuestions?.subChatId === subChatId) {
      // But if the question in messages is already answered, clear the atom
      if (pendingQuestions && !pendingQuestionPart) {
        // Check if the specific toolUseId is now answered
        const answeredPart = lastAssistantMessage?.parts?.find(
          (part: any) =>
            part.type === "tool-AskUserQuestion" &&
            part.toolCallId === pendingQuestions.toolUseId &&
            (part.state === "output-available" ||
              part.state === "output-error" ||
              part.state === "result"),
        );
        if (answeredPart) {
          setPendingQuestions(null);
        }
      }
      return;
    }

    // Not streaming - DON'T restore pending questions from messages
    // If stream is not active, the question is either:
    // 1. Already answered (state would be "output-available")
    // 2. Interrupted/aborted (should not show dialog)
    // 3. Timed out (should not show dialog)
    // We only show the question dialog during active streaming when
    // the backend is waiting for user response.
    if (pendingQuestionPart) {
      // Don't restore - if there's an existing pending question for this chat, clear it
      if (pendingQuestions?.subChatId === subChatId) {
        setPendingQuestions(null);
      }
    } else {
      // No pending question - clear if belongs to this sub-chat
      if (pendingQuestions?.subChatId === subChatId) {
        setPendingQuestions(null);
      }
    }
  }, [
    subChatId,
    lastAssistantMessage,
    isStreaming,
    pendingQuestions,
    setPendingQuestions,
  ]);

  // Handle answering questions
  const handleQuestionsAnswer = useCallback(
    async (answers: Record<string, string>) => {
      if (!pendingQuestions) return;
      const toolUseId = pendingQuestions.toolUseId;

      await trpcClient.chat.respondToolApproval.mutate({
        toolUseId,
        approved: true,
        updatedInput: { questions: pendingQuestions.questions, answers },
      });

      // Store result immediately for display (don't wait for stream)
      const currentResults = appStore.get(askUserQuestionResultsAtom);
      const newResults = new Map(currentResults);
      newResults.set(toolUseId, { answers });
      appStore.set(askUserQuestionResultsAtom, newResults);

      setPendingQuestions(null);
    },
    [pendingQuestions, setPendingQuestions],
  );

  // Handle skipping questions
  const handleQuestionsSkip = useCallback(async () => {
    if (!pendingQuestions) return;
    const toolUseId = pendingQuestions.toolUseId;

    // Clear UI immediately - don't wait for backend
    // This ensures dialog closes even if stream was already aborted
    setPendingQuestions(null);

    // Try to notify backend (may fail if already aborted - that's ok)
    try {
      await trpcClient.chat.respondToolApproval.mutate({
        toolUseId,
        approved: false,
        message: QUESTIONS_SKIPPED_MESSAGE,
      });
    } catch {
      // Stream likely already aborted - ignore
    }
  }, [pendingQuestions, setPendingQuestions]);

  // Watch for pending auth retry message (after successful OAuth flow)
  const [pendingAuthRetry, setPendingAuthRetry] = useAtom(
    pendingAuthRetryMessageAtom,
  );

  useEffect(() => {
    // Only retry when:
    // 1. There's a pending message
    // 2. readyToRetry is true (set by modal on OAuth success)
    // 3. We're in the correct chat
    // 4. Not currently streaming
    if (
      pendingAuthRetry?.readyToRetry &&
      pendingAuthRetry.subChatId === subChatId &&
      !isStreaming
    ) {
      // Clear the pending message immediately to prevent double-sending
      setPendingAuthRetry(null);

      // Build message parts
      const parts: Array<
        { type: "text"; text: string } | { type: "data-image"; data: any }
      > = [{ type: "text", text: pendingAuthRetry.prompt }];

      // Add images if present
      if (pendingAuthRetry.images && pendingAuthRetry.images.length > 0) {
        for (const img of pendingAuthRetry.images) {
          parts.push({
            type: "data-image",
            data: {
              base64Data: img.base64Data,
              mediaType: img.mediaType,
              filename: img.filename,
            },
          });
        }
      }

      // Send the message to Claude
      sendMessage({
        role: "user",
        parts,
      });
    }
  }, [
    pendingAuthRetry,
    isStreaming,
    sendMessage,
    setPendingAuthRetry,
    subChatId,
  ]);

  // Detect PR URLs in assistant messages and store them
  const detectedPrUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Only check after streaming ends
    if (isStreaming) return;

    // Look through messages for PR URLs
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;

      // Extract text content from message
      const textContent =
        msg.parts
          ?.filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join(" ") || "";

      // Match GitHub PR URL pattern
      const prUrlMatch = textContent.match(
        /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/,
      );

      if (prUrlMatch && prUrlMatch[0] !== detectedPrUrlRef.current) {
        const prUrl = prUrlMatch[0];
        const prNumber = Number.parseInt(prUrlMatch[1], 10);

        // Store to prevent duplicate calls
        detectedPrUrlRef.current = prUrl;

        // Update database
        trpcClient.chats.updatePrInfo
          .mutate({ chatId: parentChatId, prUrl, prNumber })
          .then(() => {
            toast.success(`PR #${prNumber} created!`, {
              position: "top-center",
            });
            // Invalidate the agentChat query to refetch with new PR info
            utils.agents.getAgentChat.invalidate({ chatId: parentChatId });
          });

        break; // Only process first PR URL found
      }
    }
  }, [messages, isStreaming, parentChatId]);

  // Track changed files from Edit/Write tool calls
  // Only recalculates after streaming ends (not during streaming)
  const { changedFiles: changedFilesForSubChat } = useChangedFilesTracking(
    messages,
    subChatId,
    isStreaming,
    parentChatId,
  );

  // ESC, Ctrl+C and Cmd+Shift+Backspace handler for stopping stream
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      let shouldStop = false;

      // Check for Escape key without modifiers (works even from input fields, like terminal Ctrl+C)
      // Ignore if Cmd/Ctrl is pressed (reserved for Cmd+Esc to focus input)
      if (
        e.key === "Escape" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        isStreaming
      ) {
        const target = e.target as HTMLElement;

        // Allow ESC to propagate if it originated from a modal/dialog/dropdown
        const isInsideOverlay = target.closest(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-state="open"]',
        );

        if (!isInsideOverlay) {
          shouldStop = true;
        }
      }

      // Check for Ctrl+C (only Ctrl, not Cmd on Mac)
      if (e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        if (!isStreaming) return;

        const selection = window.getSelection();
        const hasSelection = selection && selection.toString().length > 0;

        // If there's a text selection, let browser handle copy
        if (hasSelection) return;

        shouldStop = true;
      }

      // Check for Cmd+Shift+Backspace (Mac) or Ctrl+Shift+Backspace (Windows/Linux)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key === "Backspace" &&
        isStreaming
      ) {
        shouldStop = true;
      }

      if (shouldStop) {
        e.preventDefault();
        // Mark as manually aborted to prevent completion sound
        agentChatStore.setManuallyAborted(subChatId, true);
        await stop();
        // Call DELETE endpoint to cancel server-side stream
        await fetch(`/api/agents/chat?id=${encodeURIComponent(subChatId)}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming, stop, subChatId]);

  // Keyboard shortcut: Enter to focus input when not already focused
  useFocusInputOnEnter(editorRef);

  // Keyboard shortcut: Cmd+Esc to toggle focus/blur (without stopping generation)
  useToggleFocusOnCmdEsc(editorRef);

  // Auto-trigger AI response when we have initial message but no response yet
  // Also trigger auto-rename for ALL sub-chats with pre-populated message
  // IMPORTANT: Skip if there's an active streamId (prevents double-generation on resume)
  useEffect(() => {
    if (
      messages.length === 1 &&
      status === "ready" &&
      !streamId &&
      !hasTriggeredAutoGenerateRef.current
    ) {
      hasTriggeredAutoGenerateRef.current = true;
      // Trigger rename for pre-populated initial message (from createAgentChat)
      // Applies to ALL sub-chats, not just the first one
      if (!hasTriggeredRenameRef.current) {
        const firstMsg = messages[0];
        if (firstMsg?.role === "user") {
          const textPart = firstMsg.parts?.find((p: any) => p.type === "text");
          if (textPart && "text" in textPart) {
            hasTriggeredRenameRef.current = true;
            onAutoRename(textPart.text, subChatId);
          }
        }
      }
      regenerate();
    }
  }, [status, messages, regenerate, onAutoRename, streamId, subChatId]);

  // Auto-focus input when switching to this chat (any sub-chat change)
  // Skip on mobile to prevent keyboard from opening automatically
  useEffect(() => {
    if (isMobile) return; // Don't autofocus on mobile

    // Use requestAnimationFrame to ensure DOM is ready after render
    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  }, [subChatId, isMobile]);

  // Ref for messages.length - used in callbacks to avoid dependency on streaming updates
  const messagesLengthRef = useRef(messages.length);
  messagesLengthRef.current = messages.length;

  // History navigation handlers
  const handleArrowUp = useCallback(() => {
    if (history.length === 0) return false;

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
  }, [history, navState, setNavState]);

  const handleArrowDown = useCallback(() => {
    if (navState.index === -1) return false;

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
  }, [history, navState, setNavState]);

  // Wrap the base mention select handler to pass in the editor insert function
  const handleMentionSelect = useCallback(
    (mention: FileMentionOption) => {
      handleMentionSelectBase(mention, (m) =>
        editorRef.current?.insertMention(m),
      );
    },
    [handleMentionSelectBase],
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
            // Create a new sub-chat (fresh conversation)
            if (onCreateNewSubChat) {
              onCreateNewSubChat();
            }
            break;
          case "plan":
            if (agentMode !== "plan") {
              setAgentMode("plan");
            }
            break;
          case "agent":
            if (agentMode !== "agent") {
              setAgentMode("agent");
            }
            break;
          case "ralph":
            if (agentMode !== "ralph") {
              handleAgentModeChange("ralph");
            }
            break;
          case "compact":
            // Trigger context compaction
            handleCompact();
            break;
          case "add-dir":
            // Open native folder picker to add directories
            (async () => {
              if (!isDesktopApp()) {
                toast.error("Folder picker only available in desktop app");
                return;
              }
              const result = await window.desktopApi.dialog.showOpenDialog({
                title: "Select Additional Directory",
                properties: ["openDirectory", "multiSelections"],
              });
              if (!result.canceled && result.filePaths.length > 0) {
                // Get current added dirs from DB and merge
                const currentDirs = addedDirs ?? [];
                const newDirs = [
                  ...new Set([...currentDirs, ...result.filePaths]),
                ];
                // Save to DB
                await trpcClient.chats.updateSubChatAddedDirs.mutate({
                  id: subChatId,
                  addedDirs: newDirs,
                });
                // Update atom state
                setAddedDirs(newDirs);
                toast.success(
                  `Added ${result.filePaths.length} director${result.filePaths.length > 1 ? "ies" : "y"} to context`,
                );
              }
            })();
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
    [
      agentMode,
      setAgentMode,
      handleSend,
      onCreateNewSubChat,
      handleCompact,
      handleCloseSlashTrigger,
      subChatId,
      addedDirs,
      setAddedDirs,
    ],
  );

  // Paste handler for images and plain text
  // Uses async text insertion to prevent UI freeze with large text
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => handlePasteEvent(e, handleAddAttachments),
    [handleAddAttachments],
  );

  // Memoized JSX for ChatInputActions props to avoid recreating on every streaming update
  const hasNoMessages = messages.length === 0;
  const inputLeftContent = useMemo(
    () => (
      <>
        {hasNoMessages && (
          <ProviderSelectorDropdown
            providerId={effectiveProvider}
            onProviderChange={handleProviderChange}
          />
        )}
        <ModeToggleDropdown
          mode={agentMode}
          onModeChange={handleAgentModeChange}
        />
        {agentMode === "ralph" && subChatId && (
          <RalphProgressBadge subChatId={subChatId} className="ml-1" />
        )}
        {effectiveProvider === "opencode" ? (
          <OpenCodeModelSelector
            currentModelId={currentModelId}
            onModelChange={handleOpenCodeModelChange}
          />
        ) : (
          <ModelSelectorDropdown
            providerId={effectiveProvider}
            models={providerModels}
            currentModelId={currentModelId}
            onModelChange={handleModelChange}
            open={isModelDropdownOpen}
            onOpenChange={setIsModelDropdownOpen}
          />
        )}
        {effectiveProvider === "codex" && <WebSearchModeSelector />}
        <AddedDirectoriesBadge subChatId={subChatId} />
      </>
    ),
    [
      hasNoMessages,
      effectiveProvider,
      handleProviderChange,
      agentMode,
      handleAgentModeChange,
      parentChatId,
      currentModelId,
      handleOpenCodeModelChange,
      providerModels,
      handleModelChange,
      isModelDropdownOpen,
      setIsModelDropdownOpen,
      subChatId,
    ],
  );

  const inputActionButton = useMemo(() => {
    if (
      hasUnapprovedPlan &&
      !hasContent &&
      images.length === 0 &&
      files.length === 0 &&
      !isStreaming
    ) {
      return (
        <Button
          onClick={handleApprovePlan}
          size="sm"
          className="h-7 gap-1.5 rounded-lg"
        >
          Implement plan
          <Kbd>⌘↵</Kbd>
        </Button>
      );
    }
    return (
      <AgentSendButton
        isStreaming={isStreaming}
        isSubmitting={false}
        disabled={
          (!hasContent && images.length === 0 && files.length === 0) ||
          isUploading ||
          isStreaming
        }
        onClick={stableHandleSend}
        onStop={handleStop}
        isPlanMode={isPlanMode}
      />
    );
  }, [
    hasUnapprovedPlan,
    hasContent,
    images.length,
    files.length,
    isStreaming,
    handleApprovePlan,
    isUploading,
    stableHandleSend,
    handleStop,
    isPlanMode,
  ]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Chat title - flex above scroll area (desktop only) */}
      {/* Hidden in overlay mode (File/Changes tabs) */}
      {!isMobile && !isOverlayMode && (
        <div className="shrink-0 pb-2 pt-2">
          <ChatTitleEditor
            name={subChatName}
            placeholder="New Chat"
            onSave={handleRenameSubChat}
            isMobile={false}
            chatId={subChatId}
            hasMessages={messages.length > 0}
          />
        </div>
      )}

      {/* Messages - using use-stick-to-bottom for smooth auto-scrolling */}
      {/* Hidden in overlay mode (File/Changes tabs overlay this area) */}
      {isOverlayMode ? (
        /* Render overlay content (CenterDiffView/CenterFileView) when in overlay mode */
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {overlayContent}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto w-full relative allow-text-selection outline-hidden"
          tabIndex={-1}
          data-chat-container
        >
          <div ref={contentRef}>
            {/* Worktree init progress - shows when init command is running */}
            <div className="px-4 pt-4">
              <div className="w-full max-w-2xl 2xl:max-w-4xl mx-auto">
                <WorktreeInitProgress chatId={parentChatId} />
              </div>
            </div>
            <ChatMessages
              messages={messages}
              status={status}
              subChatId={subChatId}
              sandboxSetupStatus={sandboxSetupStatus}
              sandboxSetupError={sandboxSetupError}
              onRetrySetup={onRetrySetup}
              isMobile={isMobile}
              ttsPlaybackRate={ttsPlaybackRate}
              onPlaybackRateChange={handlePlaybackRateChange}
            />
            {!isOverlayMode && <div className="pb-40"></div>}
          </div>
        </div>
      )}

      {/* User questions panel - shows when AskUserQuestion tool is called */}
      {/* Only show if the pending question belongs to THIS sub-chat */}
      {pendingQuestions && pendingQuestions.subChatId === subChatId && (
        <div
          className={cn(
            "px-4 relative z-20",
            (isOverlayMode && !isInputExpanded) ||
              (!isOverlayMode && !isAtBottom && !isInputExpanded)
              ? "bottom-10"
              : "bottom-26",
          )}
        >
          <div className="w-full px-2 max-w-2xl mx-auto">
            <AgentUserQuestion
              pendingQuestions={pendingQuestions}
              onAnswer={handleQuestionsAnswer}
              onSkip={handleQuestionsSkip}
            />
          </div>
        </div>
      )}

      <div
        className="absolute w-full bottom-0"
        onMouseEnter={handleInputAreaMouseEnter}
        onMouseLeave={handleInputAreaMouseLeave}
      >
        {/* Compact bar - shown when not hovered, and in normal mode also requires not at bottom */}
        {((isOverlayMode && !isInputExpanded) ||
          (!isOverlayMode && !isAtBottom && !isInputExpanded)) && (
          <div className="px-2 pb-2 border-border/50 pt-2">
            <div className="w-full max-w-2xl mx-auto">
              <div className="h-8 px-3 bg-background flex items-center gap-2 text-sm text-muted-foreground rounded-xs border border-border/50 cursor-text hover:border-foreground/30 transition-colors">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">Send a message...</span>
                <ChevronUp className="w-4 h-4 shrink-0 ml-auto" />
              </div>
            </div>
          </div>
        )}

        {/* Expanded content - SubChatStatusCard + Input */}
        {/* Always render to preserve input state, use CSS to hide */}
        <div
          className={cn(
            "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            (isOverlayMode && isInputExpanded) ||
              (!isOverlayMode && (isAtBottom || isInputExpanded))
              ? "opacity-100 visible max-h-[500px]"
              : "opacity-0 invisible max-h-0 overflow-hidden pointer-events-none",
          )}
        >
          {/* Sub-chat status card - pinned above input */}
          {(isStreaming || changedFilesForSubChat.length > 0) &&
            !(pendingQuestions?.subChatId === subChatId) && (
              <div className="px-2 -mb-6 relative z-0">
                <div className="w-full max-w-2xl mx-auto px-2">
                  <SubChatStatusCard
                    chatId={parentChatId}
                    isStreaming={isStreaming}
                    isCompacting={isCompacting}
                    changedFiles={changedFilesForSubChat}
                    worktreePath={projectPath}
                    isOverlayMode={messages?.length !== 0}
                    isInputFocused={isInputFocused}
                    onStop={handleStop}
                  />
                </div>
              </div>
            )}

          {/* Input */}
          <div
            ref={inputContainerRef}
            className={cn(
              "px-2 pb-2 shadow-xs shadow-background relative z-20",
              (isStreaming || changedFilesForSubChat.length > 0) &&
                !(pendingQuestions?.subChatId === subChatId) &&
                "-mt-3 pt-3",
              // In overlay mode, add top border for visual separation
              isOverlayMode && "border-border/50 pt-2",
            )}
          >
            <div className="w-full max-w-2xl mx-auto">
              <ChatInputRoot
                maxHeight={200}
                onSubmit={stableHandleSend}
                onFocusChange={setIsInputFocused}
                contextItems={
                  images.length > 0 ||
                  files.length > 0 ||
                  codeSnippets.length > 0 ? (
                    <ChatInputAttachments
                      images={images}
                      files={files}
                      codeSnippets={codeSnippets}
                      onRemoveImage={removeImage}
                      onRemoveFile={removeFile}
                      onRemoveCodeSnippet={removeCodeSnippet}
                    />
                  ) : undefined
                }
                onAddAttachments={handleAddAttachments}
                editorRef={editorRef}
                fileInputRef={fileInputRef}
                hasContent={hasContent}
                isStreaming={isStreaming}
                isUploading={isUploading}
                isOverlayMode={messages?.length !== 0}
              >
                <ChatInputEditor
                  onTrigger={({ searchText, rect }) => {
                    // Desktop: use projectPath for local file search
                    if (projectPath || repository) {
                      openMention(searchText, rect);
                    }
                  }}
                  onCloseTrigger={closeMention}
                  onSlashTrigger={({ searchText, rect }) =>
                    handleSlashTrigger(searchText, rect)
                  }
                  onCloseSlashTrigger={handleCloseSlashTrigger}
                  onContentChange={setHasContent}
                  onSubmit={stableHandleSend}
                  onShiftTab={() => {
                    const nextMode: AgentMode = (() => {
                      switch (agentMode) {
                        case "agent":
                          return "plan";
                        case "plan":
                          return "ralph";
                        case "ralph":
                          return "agent";
                        default:
                          return "agent";
                      }
                    })();
                    handleAgentModeChange(nextMode);
                  }}
                  onArrowUp={handleArrowUp}
                  onArrowDown={handleArrowDown}
                  onPaste={handlePaste}
                  isMobile={isMobile}
                />
                <ChatInputActions
                  leftContent={inputLeftContent}
                  rightContent={
                    <AgentContextIndicator
                      messages={messages}
                      onCompact={handleCompact}
                      isCompacting={isCompacting}
                      disabled={isStreaming}
                    />
                  }
                  acceptedFileTypes="image/jpeg,image/png,.txt,.md,.markdown,.json,.yaml,.yml,.xml,.csv,.tsv,.log,.ini,.cfg,.conf,.js,.ts,.jsx,.tsx,.py,.rb,.go,.rs,.java,.kt,.swift,.c,.cpp,.h,.hpp,.cs,.php,.html,.css,.scss,.sass,.less,.sql,.sh,.bash,.zsh,.ps1,.bat,.env,.gitignore,.dockerignore,.editorconfig,.prettierrc,.eslintrc,.babelrc,.nvmrc,.pdf"
                  onAddAttachments={handleAddAttachments}
                  maxImages={5}
                  maxFiles={10}
                  imageCount={images.length}
                  fileCount={files.length}
                  actionButton={inputActionButton}
                />
              </ChatInputRoot>
            </div>
          </div>
        </div>

        {/* File mention dropdown */}
        {/* Desktop: use projectPath for local file search */}
        <AgentsFileMention
          isOpen={
            showMentionDropdown &&
            (!!projectPath || !!repository || !!sandboxId)
          }
          onClose={closeMention}
          onSelect={handleMentionSelect}
          searchText={mentionSearchText}
          position={mentionPosition}
          teamId={teamId}
          repository={repository}
          sandboxId={sandboxId}
          projectPath={projectPath}
          changedFiles={changedFilesForSubChat}
          // Subpage navigation state
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
          teamId={teamId}
          repository={repository}
          isPlanMode={isPlanMode}
        />
      </div>

      {/* Branch Switch Confirmation Dialog for sending messages */}
      <BranchSwitchDialog
        open={branchSwitchForMessage.dialogOpen}
        onOpenChange={branchSwitchForMessage.setDialogOpen}
        pendingSwitch={branchSwitchForMessage.pendingSwitch}
        isPending={branchSwitchForMessage.isPending}
        onConfirm={handleConfirmBranchSwitchForMessage}
        onCancel={branchSwitchForMessage.cancelSwitch}
      />

      {/* Ralph Setup Dialog for creating/editing PRD */}
      <RalphSetupDialog
        subChatId={subChatId}
        open={ralphSetupOpen}
        onOpenChange={setRalphSetupOpen}
      />
    </div>
  );
}

// Chat View wrapper - handles loading and creates chat object
export function ChatView({
  chatId,
  isSidebarOpen,
  onToggleSidebar,
  selectedTeamName: _selectedTeamName,
  selectedTeamImageUrl: _selectedTeamImageUrl,
  isMobileFullscreen = false,
  onBackToChats,
  onOpenPreview: _onOpenPreview,
  onOpenDiff: _onOpenDiff,
  onOpenTerminal: _onOpenTerminal,
  isOverlayMode = false,
  overlayContent,
}: {
  chatId: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedTeamName?: string;
  selectedTeamImageUrl?: string;
  isMobileFullscreen?: boolean;
  onBackToChats?: () => void;
  onOpenPreview?: () => void;
  onOpenDiff?: () => void;
  onOpenTerminal?: () => void;
  isOverlayMode?: boolean;
  overlayContent?: React.ReactNode;
}) {
  const [selectedTeamId] = useAtom(selectedTeamIdAtom);
  const [agentMode] = useAtom(agentModeAtom);
  const isPlanMode = agentMode === "plan";
  const setLoadingSubChats = useSetAtom(loadingSubChatsAtom);
  const unseenChanges = useAtomValue(agentsUnseenChangesAtom);
  const setUnseenChanges = useSetAtom(agentsUnseenChangesAtom);
  const setSubChatUnseenChanges = useSetAtom(agentsSubChatUnseenChangesAtom);
  const setJustCreatedIds = useSetAtom(justCreatedIdsAtom);
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom);
  const setUndoStack = useSetAtom(undoStackAtom);
  const { notifyAgentComplete, notifyPlanComplete } = useDesktopNotifications();

  // Check if any chat has unseen changes
  const hasAnyUnseenChanges = unseenChanges.size > 0;
  const [, forceUpdate] = useState({});
  const [isPreviewSidebarOpen, setIsPreviewSidebarOpen] = useAtom(
    agentsPreviewSidebarOpenAtom,
  );
  // Changes section collapsed state in left sidebar
  const [isChangesSectionCollapsed, setIsChangesSectionCollapsed] = useAtom(
    changesSectionCollapsedAtom,
  );
  // For backwards compatibility with existing code
  const isDiffSidebarOpen = !isChangesSectionCollapsed;
  const setIsDiffSidebarOpen = useCallback(
    (open: boolean) => setIsChangesSectionCollapsed(!open),
    [setIsChangesSectionCollapsed],
  );
  const [isTerminalSidebarOpen, setIsTerminalSidebarOpen] = useAtom(
    terminalSidebarOpenAtom,
  );
  const [isChatsSidebarOpen, setIsChatsSidebarOpen] =
    useAtom(chatsSidebarOpenAtom);
  // Clear "unseen changes" when chat is opened
  useEffect(() => {
    setUnseenChanges((prev: Set<string>) => {
      if (prev.has(chatId)) {
        const next = new Set(prev);
        next.delete(chatId);
        return next;
      }
      return prev;
    });
  }, [chatId, setUnseenChanges]);

  // Get sub-chat state from store
  const activeSubChatId = useAgentSubChatStore(
    (state) => state.activeSubChatId,
  );

  // Clear sub-chat "unseen changes" indicator when sub-chat becomes active
  useEffect(() => {
    if (!activeSubChatId) return;
    setSubChatUnseenChanges((prev: Set<string>) => {
      if (prev.has(activeSubChatId)) {
        const next = new Set(prev);
        next.delete(activeSubChatId);
        return next;
      }
      return prev;
    });
  }, [activeSubChatId, setSubChatUnseenChanges]);
  const _allSubChats = useAgentSubChatStore((state) => state.allSubChats);

  // tRPC utils for optimistic cache updates
  const utils = api.useUtils();

  // tRPC mutations for renaming
  const renameSubChatMutation = api.agents.renameSubChat.useMutation({
    onSuccess: () => {
      utils.chats.listWithSubChats.invalidate();
    },
  });
  const renameChatMutation = api.agents.renameChat.useMutation({
    onSuccess: () => {
      utils.chats.listWithSubChats.invalidate();
    },
  });
  const generateSubChatNameMutation =
    api.agents.generateSubChatName.useMutation();

  const { data: agentChat, isLoading: _isLoading } =
    api.agents.getAgentChat.useQuery({ chatId }, { enabled: !!chatId });
  const agentSubChats = (agentChat?.subChats ?? []) as Array<{
    id: string;
    name?: string | null;
    mode?: "plan" | "agent" | "ralph" | null;
    created_at?: Date | string | null;
    updated_at?: Date | string | null;
    messages?: any;
    stream_id?: string | null;
    providerId?: string | null;
    modelId?: string | null;
  }>;

  // Get PR status when PR exists (for checking if it's open/merged/closed)
  const hasPrNumber = !!agentChat?.prNumber;
  const { data: prStatusData, isLoading: isPrStatusLoading } =
    trpc.chats.getPrStatus.useQuery(
      { chatId },
      {
        enabled: hasPrNumber,
        refetchInterval: 30000, // Poll every 30 seconds
      },
    );
  // Handle both GitHubStatus (legacy .pr) and GitHostStatus (new .mergeRequest) formats
  const prOrMr =
    (prStatusData as { mergeRequest?: { state: string } } | undefined)
      ?.mergeRequest ??
    (prStatusData as { pr?: { state: string } } | undefined)?.pr;
  const prState = prOrMr?.state as
    | "open"
    | "draft"
    | "merged"
    | "closed"
    | undefined;
  // PR is open if state is explicitly "open" or "draft"
  // When PR status is still loading, assume open to avoid showing wrong button
  const isPrOpen =
    hasPrNumber &&
    (isPrStatusLoading || prState === "open" || prState === "draft");

  // Merge PR mutation
  const trpcUtils = trpc.useUtils();
  const mergePrMutation = trpc.chats.mergePr.useMutation({
    onSuccess: () => {
      toast.success("PR merged successfully!", { position: "top-center" });
      // Invalidate PR status to update button state
      trpcUtils.chats.getPrStatus.invalidate({ chatId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to merge PR", {
        position: "top-center",
      });
    },
  });

  // Use refs to store mutations, avoiding dependencies on unstable tRPC mutation objects
  const mergePrMutationRef = useRef(mergePrMutation);
  mergePrMutationRef.current = mergePrMutation;

  const generateSubChatNameMutationRef = useRef(generateSubChatNameMutation);
  generateSubChatNameMutationRef.current = generateSubChatNameMutation;

  const renameSubChatMutationRef = useRef(renameSubChatMutation);
  renameSubChatMutationRef.current = renameSubChatMutation;

  const renameChatMutationRef = useRef(renameChatMutation);
  renameChatMutationRef.current = renameChatMutation;

  // Use refs for tRPC utils to avoid unstable dependencies
  const utilsAgentsRef = useRef(utils.agents);
  utilsAgentsRef.current = utils.agents;

  const trpcUtilsChatsRef = useRef(trpcUtils.chats);
  trpcUtilsChatsRef.current = trpcUtils.chats;

  const handleMergePr = useCallback(() => {
    mergePrMutationRef.current.mutate({ chatId, method: "squash" });
  }, [chatId]);

  // Restore archived workspace mutation (silent - no toast)
  const restoreWorkspaceMutation = trpc.chats.restore.useMutation({
    onSuccess: (restoredChat) => {
      if (restoredChat) {
        // Update the main chat list cache
        trpcUtils.chats.list.setData({}, (oldData) => {
          if (!oldData) return [restoredChat];
          if (oldData.some((c) => c.id === restoredChat.id)) return oldData;
          return [restoredChat, ...oldData];
        });
      }
      // Invalidate both lists to refresh
      trpcUtils.chats.list.invalidate();
      trpcUtils.chats.listArchived.invalidate();
      // Invalidate this chat's data to update isArchived state
      utils.agents.getAgentChat.invalidate({ chatId });
    },
  });

  // Use ref to store mutation, avoiding dependency on unstable tRPC mutation object
  const restoreWorkspaceMutationRef = useRef(restoreWorkspaceMutation);
  restoreWorkspaceMutationRef.current = restoreWorkspaceMutation;

  const handleRestoreWorkspace = useCallback(() => {
    restoreWorkspaceMutationRef.current.mutate({ id: chatId });
  }, [chatId]);

  // Check if this workspace is archived
  const isArchived = !!agentChat?.archivedAt;

  // Sub-chat initialization hook - initializes store from database when chat loads
  useSubChatInitialization({
    chatId,
    agentChat,
    agentSubChats,
  });

  // Restore provider from database when chat loads
  const chatProviderOverrides = useAtomValue(chatProviderOverridesAtom);
  const setChatProviderOverrides = useSetAtom(chatProviderOverridesAtom);
  const globalDefaultProvider = useAtomValue(defaultProviderIdAtom);
  useEffect(() => {
    if (agentChat?.providerId) {
      setChatProviderOverrides((prev) => ({
        ...prev,
        [chatId]: agentChat.providerId as ProviderId,
      }));
    }
  }, [chatId, agentChat?.providerId, setChatProviderOverrides]);

  // Restore subchat provider from database when subchat loads
  const setSubChatProviderOverrides = useSetAtom(subChatProviderOverridesAtom);
  useEffect(() => {
    if (!activeSubChatId || !agentSubChats.length) return;
    const currentSubChat = agentSubChats.find(
      (sc) => sc.id === activeSubChatId,
    );
    if ((currentSubChat as any)?.providerId) {
      setSubChatProviderOverrides((prev) => ({
        ...prev,
        [activeSubChatId]: (currentSubChat as any).providerId as ProviderId,
      }));
    }
  }, [activeSubChatId, agentSubChats, setSubChatProviderOverrides]);

  // Get effective provider for this chat (per-chat override or global default)
  const effectiveProvider =
    chatProviderOverrides[chatId] || globalDefaultProvider;

  // Get user usage data for credit checks
  const { data: _usageData } = api.usage.getUserUsage.useQuery();

  // Desktop: use worktreePath instead of sandbox
  const worktreePath = agentChat?.worktreePath as string | null;
  const branch = agentChat?.branch as string | null;
  const baseBranch = agentChat?.baseBranch as string | null;
  // Desktop: original project path for MCP config lookup
  const originalProjectPath = (agentChat as any)?.project?.path as
    | string
    | undefined;

  // Branch switch confirmation hook for creating sub-chats
  const branchSwitchForSubChat = useBranchSwitchConfirmation({
    projectPath: originalProjectPath,
    chatBranch: branch,
    isWorktreeMode:
      !!worktreePath &&
      !!originalProjectPath &&
      worktreePath !== originalProjectPath,
  });
  // Fallback for web: use sandbox_id
  const sandboxId = agentChat?.sandbox_id ?? undefined;
  const sandboxUrl = sandboxId ? `https://3003-${sandboxId}.e2b.app` : null;
  // Desktop uses worktreePath, web uses sandboxUrl
  const chatWorkingDir = worktreePath || sandboxUrl;

  // Extract port, repository, and quick setup flag from meta
  const meta = agentChat?.meta as {
    sandboxConfig?: { port?: number };
    repository?: string;
    isQuickSetup?: boolean;
  } | null;
  const repository = meta?.repository;

  // Track if we've already triggered sandbox setup for this chat
  // Check if this is a quick setup (no preview available)
  const isQuickSetup = meta?.isQuickSetup || !meta?.sandboxConfig?.port;
  const previewPort = meta?.sandboxConfig?.port ?? 3000;

  // Check if preview can be opened (sandbox with port exists and not quick setup)
  const canOpenPreview = !!(
    sandboxId &&
    !isQuickSetup &&
    meta?.sandboxConfig?.port
  );

  // Check if diff can be opened (worktree for desktop, sandbox for web)
  const canOpenDiff = !!worktreePath || !!sandboxId;

  // Close preview sidebar if preview becomes unavailable
  useEffect(() => {
    if (!canOpenPreview && isPreviewSidebarOpen) {
      setIsPreviewSidebarOpen(false);
    }
  }, [canOpenPreview, isPreviewSidebarOpen, setIsPreviewSidebarOpen]);

  // Note: We no longer forcibly close diff sidebar when canOpenDiff is false.
  // The sidebar render is guarded by canOpenDiff, so it naturally hides.
  // Per-chat state (diffSidebarOpenAtomFamily) preserves each chat's preference.

  // Diff management hook - handles stats, content, prefetching
  const {
    diffStats,
    diffContent,
    parsedFileDiffs,
    prefetchedFileContents,
    commits,
    fetchDiffStatsRef,
  } = useDiffManagement({
    chatId,
    worktreePath,
    sandboxId,
    isDiffSidebarOpen,
    baseBranch,
  });

  // Subscribe to git status changes for real-time diff updates
  const gitWatcherSubscriberId = useId();
  trpc.changes.watchGitStatus.useSubscription(
    {
      worktreePath: worktreePath ?? "",
      subscriberId: gitWatcherSubscriberId,
    },
    {
      enabled: !!worktreePath,
      onData: () => {
        // Refetch diff data when git status changes
        fetchDiffStatsRef.current?.();
      },
      onError: (error) => {
        console.error("[ActiveChat] Git watch error:", error);
      },
    },
  );

  // Subscribe to branch changes for real-time detection
  const branchWatcherSubscriberId = useId();
  trpc.changes.watchBranchChange.useSubscription(
    {
      chatId,
      worktreePath: worktreePath ?? "",
      subscriberId: branchWatcherSubscriberId,
    },
    {
      enabled: !!worktreePath,
      onData: () => {
        // Refetch diff data when branch changes
        fetchDiffStatsRef.current?.();
        // Invalidate chat query to get updated branch from DB
        trpcUtils.chats.get.invalidate({ id: chatId });
        // Also invalidate sidebar chat list (shows branch badges)
        trpcUtils.chats.listWithSubChats.invalidate();
      },
      onError: (error) => {
        console.error("[ActiveChat] Branch watch error:", error);
      },
    },
  );

  // PR actions hook - handles create PR, commit to PR, review
  const {
    isCreatingPr,
    isCommittingToPr,
    isReviewing,
    handleCreatePr,
    handleCommitToPr,
    handleReview,
  } = usePrActions({ chatId });

  // Sync diff data to global atom for left sidebar changes view
  const setActiveChatDiffData = useSetAtom(activeChatDiffDataAtom);
  useEffect(() => {
    if (canOpenDiff) {
      setActiveChatDiffData({
        chatId,
        worktreePath,
        sandboxId,
        repository,
        diffStats,
        diffContent,
        parsedFileDiffs,
        prefetchedFileContents,
        commits,
      });
    } else {
      setActiveChatDiffData(null);
    }
    return () => {
      // Don't clear if changes or file tab is active (ChatView is unmounting to show CenterDiffView/CenterFileView)
      const activeTab = appStore.get(mainContentActiveTabAtom);
      if (activeTab === "changes" || activeTab === "file") {
        return;
      }
      // Don't clear if switching to another chat - let the new chat's effect overwrite with its data
      // Only clear if navigating away entirely (no chat selected)
      const currentSelectedChatId = appStore.get(selectedAgentChatIdAtom);
      if (currentSelectedChatId && currentSelectedChatId !== chatId) {
        return; // Switching chats - don't clear, new chat will overwrite
      }
      setActiveChatDiffData(null);
    };
  }, [
    chatId,
    worktreePath,
    sandboxId,
    repository,
    diffStats,
    diffContent,
    parsedFileDiffs,
    prefetchedFileContents,
    commits,
    canOpenDiff,
    setActiveChatDiffData,
  ]);

  // Sync PR actions to global atom for left sidebar changes view
  // Use useMemo to create stable object reference, only recreating when values actually change
  const setPrActions = useSetAtom(prActionsAtom);
  const prActionsValue = useMemo(() => {
    if (!canOpenDiff) return null;
    return {
      prUrl: agentChat?.prUrl ?? null,
      prNumber: agentChat?.prNumber ?? null,
      hasPrNumber,
      isPrOpen,
      isCreatingPr,
      isCommittingToPr,
      isMergingPr: mergePrMutation.isPending,
      isReviewing,
      onCreatePr: handleCreatePr,
      onCommitToPr: handleCommitToPr,
      onMergePr: handleMergePr,
      onReview: handleReview,
    };
  }, [
    canOpenDiff,
    agentChat?.prUrl,
    agentChat?.prNumber,
    hasPrNumber,
    isPrOpen,
    isCreatingPr,
    isCommittingToPr,
    mergePrMutation.isPending,
    isReviewing,
    handleCreatePr,
    handleCommitToPr,
    handleMergePr,
    handleReview,
  ]);

  useEffect(() => {
    setPrActions(prActionsValue);
    return () => {
      // Don't clear if changes tab is active (ChatView is unmounting to show CenterDiffView)
      const activeTab = appStore.get(mainContentActiveTabAtom);
      if (activeTab !== "changes") {
        setPrActions(null);
      }
    };
  }, [prActionsValue, setPrActions]);

  // Initialize store when chat data loads
  useEffect(() => {
    if (!agentChat) return;

    const store = useAgentSubChatStore.getState();

    // Only initialize if chatId changed
    if (store.chatId !== chatId) {
      store.setChatId(chatId);
    }

    // Re-get fresh state after setChatId may have loaded from localStorage
    const freshState = useAgentSubChatStore.getState();

    // Guard: Check if store has "fresh" data from creation that DB doesn't know about yet.
    // This prevents the race condition where new-chat-form.tsx sets fresh subchat data,
    // but this effect runs with stale cached agentSubChats and overwrites it.
    const storeHasFreshData = freshState.allSubChats.some(
      (sc) => !agentSubChats.find((dbSc) => dbSc.id === sc.id),
    );
    if (storeHasFreshData && freshState.allSubChats.length > 0) {
      // Store has newer data than DB query - preserve it and just validate open tabs
      const validOpenIds = freshState.openSubChatIds.filter((id) =>
        freshState.allSubChats.some((sc) => sc.id === id),
      );
      if (validOpenIds.length === 0 && freshState.allSubChats.length > 0) {
        freshState.addToOpenSubChats(freshState.allSubChats[0].id);
        freshState.setActiveSubChat(freshState.allSubChats[0].id);
      } else if (validOpenIds.length > 0) {
        const currentActive = freshState.activeSubChatId;
        if (!currentActive || !validOpenIds.includes(currentActive)) {
          freshState.setActiveSubChat(validOpenIds[0]);
        }
      }
      return;
    }

    // Get sub-chats from DB (like Canvas - no isPersistedInDb flag)
    // Build a map of existing local sub-chats to preserve their created_at if DB doesn't have it
    const existingSubChatsMap = new Map(
      freshState.allSubChats.map((sc) => [sc.id, sc]),
    );

    const dbSubChats: SubChatMeta[] = agentSubChats.map((sc) => {
      const existingLocal = existingSubChatsMap.get(sc.id);
      const createdAt =
        typeof sc.created_at === "string"
          ? sc.created_at
          : sc.created_at?.toISOString();
      const updatedAt =
        typeof sc.updated_at === "string"
          ? sc.updated_at
          : sc.updated_at?.toISOString();
      return {
        id: sc.id,
        name: sc.name || "New Chat",
        // Prefer DB timestamp, fall back to local timestamp, then current time
        created_at:
          createdAt ?? existingLocal?.created_at ?? new Date().toISOString(),
        updated_at: updatedAt ?? existingLocal?.updated_at,
        mode:
          (sc.mode as "plan" | "agent" | "ralph" | undefined) ||
          existingLocal?.mode ||
          "agent",
        providerId:
          (sc.providerId as ProviderId | undefined) ||
          existingLocal?.providerId,
        modelId: sc.modelId || existingLocal?.modelId,
      };
    });
    const dbSubChatIds = new Set(dbSubChats.map((sc) => sc.id));

    // Start with DB sub-chats
    const allSubChats: SubChatMeta[] = [...dbSubChats];

    // For each open tab ID that's NOT in DB, add placeholder (like Canvas)
    // This prevents losing tabs during race conditions
    const currentOpenIds = freshState.openSubChatIds;
    currentOpenIds.forEach((id) => {
      if (!dbSubChatIds.has(id)) {
        allSubChats.push({
          id,
          name: "New Chat",
          created_at: new Date().toISOString(),
        });
      }
    });

    freshState.setAllSubChats(allSubChats);

    // All open tabs are now valid (we created placeholders for non-DB ones)
    const validOpenIds = currentOpenIds;

    if (validOpenIds.length === 0 && allSubChats.length > 0) {
      // No valid open tabs, open the first sub-chat
      freshState.addToOpenSubChats(allSubChats[0].id);
      freshState.setActiveSubChat(allSubChats[0].id);
    } else if (validOpenIds.length > 0) {
      // Validate active tab is in open tabs
      const currentActive = freshState.activeSubChatId;
      if (!currentActive || !validOpenIds.includes(currentActive)) {
        freshState.setActiveSubChat(validOpenIds[0]);
      }
    }
  }, [agentChat, chatId]);

  // Create or get Chat instance for a sub-chat
  const getOrCreateChat = useCallback(
    (subChatId: string): Chat<any> | null => {
      // Desktop uses worktreePath, web uses sandboxUrl
      if (!chatWorkingDir || !agentChat) {
        return null;
      }

      // Return existing chat if we have it
      const existing = agentChatStore.get(subChatId);
      if (existing) {
        return existing;
      }

      // Find sub-chat data
      const subChat = agentSubChats.find((sc) => sc.id === subChatId);
      const messages = (subChat?.messages as any[]) || [];

      // Get mode from store metadata (falls back to current agentMode)
      const subChatMeta = useAgentSubChatStore
        .getState()
        .allSubChats.find((sc) => sc.id === subChatId);
      const subChatMode = subChatMeta?.mode || agentMode;

      // Desktop: use IPCChatTransport for local Claude Code execution
      // Note: Extended thinking setting is read dynamically inside the transport
      // projectPath: original project path for MCP config lookup (worktreePath is the cwd)
      const projectPath = (agentChat as any)?.project?.path as
        | string
        | undefined;
      const transport = worktreePath
        ? new IPCChatTransport({
            chatId,
            subChatId,
            cwd: worktreePath,
            projectPath,
            mode: subChatMode,
          })
        : null; // Web transport not supported in desktop app

      if (!transport) {
        console.error("[getOrCreateChat] No transport available");
        return null;
      }

      const newChat = new Chat<any>({
        id: subChatId,
        messages,
        transport,
        // Clear loading when streaming completes (works even if component unmounted)
        onFinish: () => {
          console.log(`[SD] C:FINISH sub=${subChatId.slice(-8)}`);
          clearLoading(setLoadingSubChats, subChatId);

          // Clear streamId so remount won't attempt resume (prevents stale resume=true
          // which blocks the auto-start effect for Ralph PRD follow-up messages)
          agentChatStore.setStreamId(subChatId, null);

          // Check if this was a manual abort (ESC/Ctrl+C) - skip sound if so
          const wasManuallyAborted =
            agentChatStore.wasManuallyAborted(subChatId);
          agentChatStore.clearManuallyAborted(subChatId);

          // Get CURRENT values at runtime (not stale closure values)
          const currentActiveSubChatId =
            useAgentSubChatStore.getState().activeSubChatId;
          const currentSelectedChatId = appStore.get(selectedAgentChatIdAtom);

          const isViewingThisSubChat = currentActiveSubChatId === subChatId;
          const isViewingThisChat = currentSelectedChatId === chatId;

          if (!isViewingThisSubChat) {
            setSubChatUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev);
              next.add(subChatId);
              return next;
            });
          }

          // Also mark parent chat as unseen if user is not viewing it
          if (!isViewingThisChat) {
            setUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev);
              next.add(chatId);
              return next;
            });

            // Play completion sound only if NOT manually aborted and sound is enabled
            if (!wasManuallyAborted) {
              const isSoundEnabled = appStore.get(
                soundNotificationsEnabledAtom,
              );
              if (isSoundEnabled) {
                try {
                  const audio = new Audio("./sound.mp3");
                  audio.volume = 1.0;
                  audio.play().catch(() => {});
                } catch {
                  // Ignore audio errors
                }
              }

              // Show native notification (desktop app, when window not focused)
              // Check if this was a plan completion (ExitPlanMode in last message)
              const chatInstance = agentChatStore.get(subChatId);
              const lastMsg = chatInstance?.messages?.slice(-1)[0];
              const hasExitPlanMode =
                lastMsg?.role === "assistant" &&
                lastMsg?.parts?.some(
                  (p: any) => p.type === "tool-ExitPlanMode",
                );
              if (hasExitPlanMode) {
                notifyPlanComplete(
                  agentChat?.name || "Chat",
                  chatId,
                  subChatId,
                );
              } else {
                notifyAgentComplete(
                  agentChat?.name || "Agent",
                  chatId,
                  subChatId,
                );
              }
            }
          }

          // Refresh diff stats after agent finishes making changes
          fetchDiffStatsRef.current();

          // Note: sidebar timestamp update is handled via optimistic update in handleSend
          // No need to refetch here as it would overwrite the optimistic update with stale data
        },
      });

      agentChatStore.set(subChatId, newChat, chatId);
      // Store streamId at creation time to prevent resume during active streaming
      // tRPC refetch would update stream_id in DB, but store stays stable
      agentChatStore.setStreamId(subChatId, subChat?.stream_id || null);
      forceUpdate({}); // Trigger re-render to use new chat
      return newChat;
    },
    [
      agentChat,
      chatWorkingDir,
      worktreePath,
      chatId,
      isPlanMode,
      setSubChatUnseenChanges,
      selectedChatId,
      setUnseenChanges,
      notifyAgentComplete,
      notifyPlanComplete,
    ],
  );

  // Handle creating a new sub-chat
  const handleCreateNewSubChat = useCallback(async () => {
    // Check if branch switch is needed before creating (local mode only)
    const needsSwitch =
      await branchSwitchForSubChat.checkBranchSwitch("create-subchat");
    if (needsSwitch) return; // Dialog shown, wait for confirmation

    // Proceed with sub-chat creation
    const store = useAgentSubChatStore.getState();
    const subChatMode = agentMode;

    // Get the current model for this provider
    const modelsByProvider = appStore.get(lastSelectedModelByProviderAtom);
    const modelId = modelsByProvider[effectiveProvider] || undefined;

    // Create sub-chat in DB first to get the real ID
    const newSubChat = await trpcClient.chats.createSubChat.mutate({
      chatId,
      name: "New Chat",
      mode: subChatMode,
      providerId: effectiveProvider,
      modelId,
    });
    const newId = newSubChat.id;

    // Track this subchat as just created for typewriter effect
    setJustCreatedIds((prev) => new Set([...prev, newId]));

    // Add to allSubChats with placeholder name
    store.addToAllSubChats({
      id: newId,
      name: "New Chat",
      created_at: new Date().toISOString(),
      mode: subChatMode,
      providerId: effectiveProvider,
      modelId,
    });

    // Also add to listWithSubChats query cache for sidebar
    const projectId = agentChat?.projectId;
    if (projectId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      trpcUtilsChatsRef.current.listWithSubChats.setData(
        { projectId },
        (old: any) => {
          if (!old) return old;
          return old.map((chat: any) =>
            chat.id === chatId
              ? {
                  ...chat,
                  subChats: [
                    ...(chat.subChats || []),
                    {
                      id: newId,
                      chatId,
                      name: "New Chat",
                      mode: subChatMode,
                      providerId: effectiveProvider,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      hasPendingPlanApproval: false,
                      fileAdditions: null,
                      fileDeletions: null,
                      fileCount: null,
                    },
                  ],
                }
              : chat,
          );
        },
      );
    }

    // Add to open tabs and set as active
    store.addToOpenSubChats(newId);
    store.setActiveSubChat(newId);

    // Create empty Chat instance for the new sub-chat
    if (worktreePath) {
      // Desktop: use IPCChatTransport for local Claude Code execution
      // Note: Extended thinking setting is read dynamically inside the transport
      // projectPath: original project path for MCP config lookup (worktreePath is the cwd)
      const projectPath = (agentChat as any)?.project?.path as
        | string
        | undefined;
      const transport = new IPCChatTransport({
        chatId,
        subChatId: newId,
        cwd: worktreePath,
        projectPath,
        mode: subChatMode,
      });

      const newChat = new Chat<any>({
        id: newId,
        messages: [],
        transport,
        // Clear loading when streaming completes
        onFinish: () => {
          console.log(`[SD] C:FINISH sub=${newId.slice(-8)}`);
          clearLoading(setLoadingSubChats, newId);

          // Check if this was a manual abort (ESC/Ctrl+C) - skip sound if so
          const wasManuallyAborted = agentChatStore.wasManuallyAborted(newId);
          agentChatStore.clearManuallyAborted(newId);

          // Get CURRENT values at runtime (not stale closure values)
          const currentActiveSubChatId =
            useAgentSubChatStore.getState().activeSubChatId;
          const currentSelectedChatId = appStore.get(selectedAgentChatIdAtom);

          const isViewingThisSubChat = currentActiveSubChatId === newId;
          const isViewingThisChat = currentSelectedChatId === chatId;

          if (!isViewingThisSubChat) {
            setSubChatUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev);
              next.add(newId);
              return next;
            });
          }

          // Also mark parent chat as unseen if user is not viewing it
          if (!isViewingThisChat) {
            setUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev);
              next.add(chatId);
              return next;
            });

            // Play completion sound only if NOT manually aborted and sound is enabled
            if (!wasManuallyAborted) {
              const isSoundEnabled = appStore.get(
                soundNotificationsEnabledAtom,
              );
              if (isSoundEnabled) {
                try {
                  const audio = new Audio("./sound.mp3");
                  audio.volume = 1.0;
                  audio.play().catch(() => {});
                } catch {
                  // Ignore audio errors
                }
              }

              // Show native notification (desktop app, when window not focused)
              // Check if this was a plan completion (ExitPlanMode in last message)
              const chatInstance = agentChatStore.get(newId);
              const lastMsg = chatInstance?.messages?.slice(-1)[0];
              const hasExitPlanMode =
                lastMsg?.role === "assistant" &&
                lastMsg?.parts?.some(
                  (p: any) => p.type === "tool-ExitPlanMode",
                );
              if (hasExitPlanMode) {
                notifyPlanComplete(agentChat?.name || "Chat", chatId, newId);
              } else {
                notifyAgentComplete(agentChat?.name || "Agent", chatId, newId);
              }
            }
          }

          // Refresh diff stats after agent finishes making changes
          fetchDiffStatsRef.current();

          // Note: sidebar timestamp update is handled via optimistic update in handleSend
          // No need to refetch here as it would overwrite the optimistic update with stale data
        },
      });
      agentChatStore.set(newId, newChat, chatId);
      agentChatStore.setStreamId(newId, null); // New chat has no active stream
      forceUpdate({}); // Trigger re-render
    }
  }, [
    worktreePath,
    chatId,
    isPlanMode,
    setSubChatUnseenChanges,
    selectedChatId,
    setUnseenChanges,
    notifyAgentComplete,
    notifyPlanComplete,
    agentChat?.name,
    agentChat?.projectId,
    branchSwitchForSubChat,
    effectiveProvider,
  ]);

  // Handler for confirming branch switch and creating sub-chat
  const handleConfirmBranchSwitchForNewSubChat = useCallback(async () => {
    const result = await branchSwitchForSubChat.confirmSwitch();
    if (!result.success) return;

    // Create sub-chat after successful branch switch
    const store = useAgentSubChatStore.getState();
    const subChatMode = appStore.get(agentModeAtom);

    // Get provider from current effective provider state
    const currentProvider = effectiveProvider;

    // Get the current model for this provider
    const modelsByProvider = appStore.get(lastSelectedModelByProviderAtom);
    const modelId = modelsByProvider[currentProvider] || undefined;

    const newSubChat = await trpcClient.chats.createSubChat.mutate({
      chatId,
      name: "New Chat",
      mode: subChatMode,
      providerId: currentProvider,
      modelId,
    });
    const newId = newSubChat.id;

    setJustCreatedIds((prev) => new Set([...prev, newId]));

    store.addToAllSubChats({
      id: newId,
      name: "New Chat",
      created_at: new Date().toISOString(),
      mode: subChatMode,
      providerId: currentProvider,
      modelId,
    });

    store.addToOpenSubChats(newId);
    store.setActiveSubChat(newId);
  }, [branchSwitchForSubChat, chatId, setJustCreatedIds, effectiveProvider]);

  // Multi-select state for sub-chats (for Cmd+W bulk close)
  const selectedSubChatIds = useAtomValue(selectedSubChatIdsAtom);
  const isSubChatMultiSelectMode = useAtomValue(isSubChatMultiSelectModeAtom);
  const clearSubChatSelection = useSetAtom(clearSubChatSelectionAtom);

  // Helper to add sub-chat to undo stack
  const addSubChatToUndoStack = useCallback(
    (subChatId: string) => {
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
          chatId,
          timeoutId,
        },
      ]);
    },
    [chatId, setUndoStack],
  );

  // Sub-chat keyboard shortcuts (Cmd+T, Cmd+W, Cmd+[/])
  useSubChatKeyboard({
    onCreateNew: handleCreateNewSubChat,
    addToUndoStack: addSubChatToUndoStack,
    isMultiSelectMode: isSubChatMultiSelectMode,
    selectedIds: selectedSubChatIds,
    clearSelection: clearSubChatSelection,
  });

  // Keyboard shortcut: Cmd + D to toggle diff sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Meta) + D (without Alt/Shift)
      if (
        e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        e.code === "KeyD"
      ) {
        e.preventDefault();
        e.stopPropagation();

        // Toggle: close if open, open if has changes
        if (isDiffSidebarOpen) {
          setIsDiffSidebarOpen(false);
        } else if (diffStats.hasChanges) {
          setIsDiffSidebarOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [diffStats.hasChanges, isDiffSidebarOpen]);

  // Keyboard shortcut: Create PR (preview)
  // Web: Opt+Cmd+Shift+P (Cmd+P is now Quick Open)
  // Desktop: Cmd+Shift+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp();

      // Desktop: Cmd+Shift+P (without Alt)
      const isDesktopShortcut =
        isDesktop &&
        e.metaKey &&
        e.shiftKey &&
        e.code === "KeyP" &&
        !e.altKey &&
        !e.ctrlKey;
      // Web: Opt+Cmd+Shift+P (with Alt and Shift)
      const isWebShortcut =
        e.altKey && e.metaKey && e.shiftKey && e.code === "KeyP";

      if (isDesktopShortcut || isWebShortcut) {
        e.preventDefault();
        e.stopPropagation();

        // Only create PR if there are changes and not already creating
        if (diffStats.hasChanges && !isCreatingPr) {
          handleCreatePr();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [diffStats.hasChanges, isCreatingPr, handleCreatePr]);

  // Keyboard shortcut: Cmd + Shift + E to restore archived workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey &&
        e.shiftKey &&
        !e.altKey &&
        !e.ctrlKey &&
        e.code === "KeyE"
      ) {
        if (isArchived && !restoreWorkspaceMutation.isPending) {
          e.preventDefault();
          e.stopPropagation();
          handleRestoreWorkspace();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isArchived, restoreWorkspaceMutation.isPending, handleRestoreWorkspace]);

  // Handle auto-rename for sub-chat and parent chat
  // Receives subChatId as param to avoid stale closure issues
  const handleAutoRename = useCallback(
    (userMessage: string, subChatId: string) => {
      // Check if this is the first sub-chat using agentSubChats directly
      // to avoid race condition with store initialization
      const firstSubChatId = getFirstSubChatId(agentSubChats);
      const isFirst = firstSubChatId === subChatId;

      autoRenameAgentChat({
        subChatId,
        parentChatId: chatId,
        userMessage,
        isFirstSubChat: isFirst,
        generateName: async (msg) => {
          return generateSubChatNameMutationRef.current.mutateAsync({
            userMessage: msg,
            providerId: effectiveProvider,
            projectPath: originalProjectPath || worktreePath || undefined,
          });
        },
        renameSubChat: async (input) => {
          await renameSubChatMutationRef.current.mutateAsync(input);
        },
        renameChat: async (input) => {
          await renameChatMutationRef.current.mutateAsync(input);
        },
        updateSubChatName: (subChatIdToUpdate, name) => {
          console.log("[updateSubChatName] Called with:", {
            subChatIdToUpdate,
            name,
          });
          // Update local store
          useAgentSubChatStore
            .getState()
            .updateSubChatName(subChatIdToUpdate, name);
          // Optimistic update for sidebar list (listWithSubChats query)
          const projectId = agentChat?.projectId;
          console.log("[updateSubChatName] projectId:", projectId);
          if (projectId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            trpcUtilsChatsRef.current.listWithSubChats.setData(
              { projectId },
              (old: any) => {
                console.log(
                  "[updateSubChatName] Cache before update:",
                  JSON.stringify(
                    old?.map((c: any) => ({
                      id: c.id,
                      subChats: c.subChats?.map((sc: any) => ({
                        id: sc.id,
                        name: sc.name,
                      })),
                    })),
                  ),
                );
                if (!old) return old;
                const updated = old.map((chat: any) => ({
                  ...chat,
                  subChats: chat.subChats?.map((sc: any) =>
                    sc.id === subChatIdToUpdate ? { ...sc, name } : sc,
                  ),
                }));
                console.log(
                  "[updateSubChatName] Cache after update:",
                  JSON.stringify(
                    updated?.map((c: any) => ({
                      id: c.id,
                      subChats: c.subChats?.map((sc: any) => ({
                        id: sc.id,
                        name: sc.name,
                      })),
                    })),
                  ),
                );
                return updated;
              },
            );
          }
          // Also update query cache so init effect doesn't overwrite
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          utilsAgentsRef.current.getAgentChat.setData(
            { chatId },
            (old: any) => {
              if (!old) return old;
              const existsInCache = old.subChats.some(
                (sc: SubChatItem) => sc.id === subChatIdToUpdate,
              );
              if (!existsInCache) {
                // Sub-chat not in cache yet (DB save still in flight) - add it
                return {
                  ...old,
                  subChats: [
                    ...old.subChats,
                    {
                      id: subChatIdToUpdate,
                      name,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      messages: [],
                      mode: "agent",
                      streamId: null,
                      chatId: chatId,
                    },
                  ],
                };
              }
              return {
                ...old,
                subChats: old.subChats.map((sc: SubChatItem) =>
                  sc.id === subChatIdToUpdate ? { ...sc, name } : sc,
                ),
              };
            },
          );
        },
        updateChatName: (chatIdToUpdate, name) => {
          // Optimistic update for sidebar list (listWithSubChats query)
          const projectId = agentChat?.projectId;
          if (projectId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            trpcUtilsChatsRef.current.listWithSubChats.setData(
              { projectId },
              (old: any) => {
                if (!old) return old;
                return old.map((chat: any) =>
                  chat.id === chatIdToUpdate ? { ...chat, name } : chat,
                );
              },
            );
          }
          // Optimistic update for sidebar (list query)
          // On desktop, selectedTeamId is always null, so we update unconditionally
          utilsAgentsRef.current.getAgentChats.setData(
            { teamId: selectedTeamId },
            (old: ChatListItem[] | undefined) => {
              if (!old) return old;
              return old.map((c: ChatListItem) =>
                c.id === chatIdToUpdate ? { ...c, name } : c,
              );
            },
          );
          // Optimistic update for header (single chat query)
          utilsAgentsRef.current.getAgentChat.setData(
            { chatId: chatIdToUpdate },
            (old) => {
              if (!old) return old;
              return { ...old, name };
            },
          );
        },
      });
    },
    [
      chatId,
      agentSubChats,
      agentChat,
      effectiveProvider,
      selectedTeamId,
      originalProjectPath,
      worktreePath,
    ],
  );

  // Get or create Chat instance for active sub-chat
  const activeChat = useMemo(() => {
    if (!activeSubChatId || !agentChat) {
      return null;
    }
    return getOrCreateChat(activeSubChatId);
  }, [activeSubChatId, agentChat, getOrCreateChat, chatId, chatWorkingDir]);

  // Check if active sub-chat is the first one (for renaming parent chat)
  // Use agentSubChats directly to avoid race condition with store initialization
  const isFirstSubChatActive = useMemo(() => {
    if (!activeSubChatId) return false;
    return getFirstSubChatId(agentSubChats) === activeSubChatId;
  }, [activeSubChatId, agentSubChats]);

  // Determine if chat header should be hidden
  const shouldHideChatHeader =
    isPreviewSidebarOpen && isDiffSidebarOpen && !isMobileFullscreen;

  // No early return - let the UI render with loading state handled by activeChat check below

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Main content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Chat Panel */}
          <div
            className="flex-1 flex flex-col overflow-hidden relative"
            style={{ minWidth: "350px" }}
          >
            {/* Chat Header - hidden in overlay mode */}
            {!shouldHideChatHeader && !isOverlayMode && (
              <ChatHeader
                chatId={chatId}
                subChatId={activeSubChatId ?? undefined}
                isMobileFullscreen={isMobileFullscreen}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={onToggleSidebar}
                hasAnyUnseenChanges={hasAnyUnseenChanges}
                onCreateNewSubChat={handleCreateNewSubChat}
                onBackToChats={onBackToChats}
                canOpenPreview={canOpenPreview}
                isPreviewSidebarOpen={isPreviewSidebarOpen}
                onOpenPreview={() => setIsPreviewSidebarOpen(true)}
                sandboxId={sandboxId}
                canOpenDiff={canOpenDiff}
                isDiffSidebarOpen={isDiffSidebarOpen}
                diffStats={diffStats}
                onOpenDiff={() => setIsDiffSidebarOpen(true)}
                canOpenTerminal={!!worktreePath}
                isTerminalSidebarOpen={isTerminalSidebarOpen}
                onOpenTerminal={() => setIsTerminalSidebarOpen(true)}
                worktreePath={worktreePath}
                branch={branch}
                baseBranch={baseBranch}
                isChatsSidebarOpen={isChatsSidebarOpen}
                onToggleChatsSidebar={() =>
                  setIsChatsSidebarOpen(!isChatsSidebarOpen)
                }
                isArchived={isArchived}
                onRestoreWorkspace={handleRestoreWorkspace}
                isRestoring={restoreWorkspaceMutation.isPending}
                originalProjectPath={originalProjectPath}
                effectiveProvider={effectiveProvider}
              />
            )}

            {/* Chat Content */}
            {activeChat && activeSubChatId ? (
              <ChatViewInner
                key={activeSubChatId}
                chat={activeChat}
                subChatId={activeSubChatId}
                parentChatId={chatId}
                isFirstSubChat={isFirstSubChatActive}
                onAutoRename={handleAutoRename}
                onCreateNewSubChat={handleCreateNewSubChat}
                teamId={selectedTeamId || undefined}
                repository={repository}
                streamId={agentChatStore.getStreamId(activeSubChatId)}
                isMobile={isMobileFullscreen}
                sandboxId={sandboxId || undefined}
                projectPath={worktreePath || undefined}
                isArchived={isArchived}
                onRestoreWorkspace={handleRestoreWorkspace}
                chatBranch={branch}
                originalProjectPath={originalProjectPath}
                isOverlayMode={isOverlayMode}
                overlayContent={overlayContent}
              />
            ) : (
              <>
                {/* Empty chat area - no loading indicator */}
                <div className="flex-1" />

                {/* Disabled input while loading */}
                <div className="px-2 pb-2">
                  <div className="w-full max-w-2xl 2xl:max-w-4xl mx-auto">
                    <div className="relative w-full">
                      <PromptInput
                        className="border bg-input-background relative z-10 p-2 rounded-xs opacity-50 pointer-events-none"
                        maxHeight={200}
                      >
                        <div className="p-1 text-muted-foreground text-sm">
                          Plan, @ for context, / for commands
                        </div>
                        <PromptInputActions className="w-full">
                          <div className="flex items-center gap-0.5 flex-1 min-w-0">
                            {/* Mode selector placeholder */}
                            <button
                              disabled
                              className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground rounded-md cursor-not-allowed"
                            >
                              <AgentIcon className="h-3.5 w-3.5" />
                              <span>Agent</span>
                              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                            </button>

                            {/* Model selector placeholder */}
                            <button
                              disabled
                              className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground rounded-md cursor-not-allowed"
                            >
                              {getProviderIcon("claude", "h-3.5 w-3.5")}
                              <span>
                                Sonnet{" "}
                                <span className="text-muted-foreground">
                                  4.5
                                </span>
                              </span>
                              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                            </button>
                          </div>
                          <div className="flex items-center gap-0.5 ml-auto shrink-0">
                            {/* Attach button placeholder */}
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled
                              className="h-7 w-7 rounded-xs cursor-not-allowed"
                            >
                              <AttachIcon className="h-4 w-4" />
                            </Button>

                            {/* Send button */}
                            <div className="ml-1">
                              <AgentSendButton
                                disabled={true}
                                onClick={() => {}}
                              />
                            </div>
                          </div>
                        </PromptInputActions>
                      </PromptInput>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview Sidebar - hidden on mobile fullscreen and when preview is not available */}
          {canOpenPreview && !isMobileFullscreen && (
            <ResizableSidebar
              isOpen={isPreviewSidebarOpen}
              onClose={() => setIsPreviewSidebarOpen(false)}
              widthAtom={agentsPreviewSidebarWidthAtom}
              minWidth={350}
              side="right"
              animationDuration={0}
              initialWidth={0}
              exitWidth={0}
              showResizeTooltip={true}
              className="bg-tl-background border-l"
              style={{ borderLeftWidth: "0.5px" }}
            >
              {isQuickSetup ? (
                <div className="flex flex-col h-full">
                  {/* Header with close button */}
                  <div className="flex items-center justify-end px-3 h-10 bg-tl-background shrink-0 border-b border-border/50">
                    <Button
                      variant="ghost"
                      className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md"
                      onClick={() => setIsPreviewSidebarOpen(false)}
                    >
                      <IconCloseSidebarRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  {/* Content */}
                  <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
                    <div className="text-muted-foreground mb-4">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-50"
                      >
                        <rect
                          x="2"
                          y="3"
                          width="20"
                          height="14"
                          rx="2"
                          ry="2"
                        />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Preview not available
                    </p>
                    <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                      Set up this repository to enable live preview
                    </p>
                  </div>
                </div>
              ) : (
                <AgentPreview
                  chatId={chatId}
                  sandboxId={sandboxId}
                  port={previewPort}
                  repository={repository}
                  hideHeader={false}
                  onClose={() => setIsPreviewSidebarOpen(false)}
                />
              )}
            </ResizableSidebar>
          )}

          {/* Terminal Sidebar - shows when worktree exists (desktop only) */}
          {worktreePath && (
            <TerminalSidebar
              chatId={chatId}
              cwd={worktreePath}
              workspaceId={chatId}
            />
          )}
        </div>
      </div>

      {/* Branch Switch Confirmation Dialog */}
      <BranchSwitchDialog
        open={branchSwitchForSubChat.dialogOpen}
        onOpenChange={branchSwitchForSubChat.setDialogOpen}
        pendingSwitch={branchSwitchForSubChat.pendingSwitch}
        isPending={branchSwitchForSubChat.isPending}
        onConfirm={handleConfirmBranchSwitchForNewSubChat}
        onCancel={branchSwitchForSubChat.cancelSwitch}
      />
    </>
  );
}
