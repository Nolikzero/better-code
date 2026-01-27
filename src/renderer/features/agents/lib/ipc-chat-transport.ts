import type { ChatTransport, UIMessage } from "ai";
import { toast } from "sonner";
import { getQueryClient } from "../../../contexts/TRPCProvider";
import {
  agentsLoginModalOpenAtom,
  chatProviderOverridesAtom,
  codexApprovalPolicyAtom,
  codexReasoningEffortAtom,
  codexSandboxModeAtom,
  codexWebSearchModeAtom,
  defaultProviderIdAtom,
  enabledProviderIdsAtom,
  extendedThinkingEnabledAtom,
  lastSelectedModelByProviderAtom,
  type ProviderId,
  sessionInfoAtom,
  subChatModelOverridesAtom,
  subChatProviderOverridesAtom,
} from "../../../lib/atoms";
import { appStore } from "../../../lib/jotai-store";
import { trpcClient } from "../../../lib/trpc";
import {
  playCompletionSound,
  showErrorNotification,
  showQuestionNotification,
  showRalphCompleteNotification,
  showTimeoutNotification,
} from "../../sidebar/hooks/use-desktop-notifications";
import {
  addedDirectoriesAtomFamily,
  agentModeAtom,
  askUserQuestionResultsAtom,
  authErrorProviderAtom,
  compactingSubChatsAtom,
  currentTodosAtomFamily,
  lastSelectedModelIdAtom,
  MODEL_ID_MAP,
  pendingAuthRetryMessageAtom,
  pendingRalphAutoStartsAtom,
  pendingUserQuestionsAtom,
  ralphInjectedPromptsAtom,
  ralphPrdStatusesAtom,
} from "../atoms";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

// Error categories and their user-friendly messages
const ERROR_TOAST_CONFIG: Record<
  string,
  {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  }
> = {
  AUTH_FAILED_SDK: {
    title: "Not logged in",
    description: "Run 'claude login' in your terminal to authenticate",
    action: {
      label: "Copy command",
      onClick: () => navigator.clipboard.writeText("claude login"),
    },
  },
  INVALID_API_KEY_SDK: {
    title: "Invalid API key",
    description:
      "Your Claude API key is invalid. Check your CLI configuration.",
  },
  INVALID_API_KEY: {
    title: "Invalid API key",
    description:
      "Your Claude API key is invalid. Check your CLI configuration.",
  },
  RATE_LIMIT_SDK: {
    title: "Rate limited",
    description: "Too many requests. Please wait a moment and try again.",
  },
  RATE_LIMIT: {
    title: "Rate limited",
    description: "Too many requests. Please wait a moment and try again.",
  },
  OVERLOADED_SDK: {
    title: "Claude is busy",
    description:
      "The service is overloaded. Please try again in a few moments.",
  },
  PROCESS_CRASH: {
    title: "Claude crashed",
    description:
      "The Claude process exited unexpectedly. Try sending your message again.",
  },
  EXECUTABLE_NOT_FOUND: {
    title: "Claude CLI not found",
    description:
      "Install Claude Code CLI: npm install -g @anthropic-ai/claude-code",
    action: {
      label: "Copy command",
      onClick: () =>
        navigator.clipboard.writeText(
          "npm install -g @anthropic-ai/claude-code",
        ),
    },
  },
  NETWORK_ERROR: {
    title: "Network error",
    description: "Check your internet connection and try again.",
  },
  AUTH_FAILURE: {
    title: "Authentication failed",
    description: "Your session may have expired. Try logging in again.",
  },
};

type UIMessageChunk = any; // Inferred from subscription

type IPCChatTransportConfig = {
  chatId: string;
  subChatId: string;
  cwd: string;
  projectPath?: string; // Original project path for MCP config lookup (when using worktrees)
  mode: "plan" | "agent" | string;
  model?: string;
  providerId?: ProviderId; // AI provider selection (claude or codex)
};

// Image attachment type matching the tRPC schema
type ImageAttachment = {
  base64Data: string;
  mediaType: string;
  filename?: string;
};

export class IPCChatTransport implements ChatTransport<UIMessage> {
  constructor(private config: IPCChatTransportConfig) {}

  async sendMessages(options: {
    messages: UIMessage[];
    abortSignal?: AbortSignal;
  }): Promise<ReadableStream<UIMessageChunk>> {
    // Extract prompt and images from last user message
    const lastUser = [...options.messages]
      .reverse()
      .find((m) => m.role === "user");
    const prompt = this.extractText(lastUser);
    const images = this.extractImages(lastUser);

    // Get sessionId for resume
    const lastAssistant = [...options.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    const sessionId = (lastAssistant as any)?.metadata?.sessionId;

    // Read extended thinking setting dynamically (so toggle applies to existing chats)
    // Note: claude-opus-4-5-20251101 has a max output of 64000 tokens, so we use 60000 to stay within limits
    const thinkingEnabled = appStore.get(extendedThinkingEnabledAtom);
    const maxThinkingTokens = thinkingEnabled ? 60_000 : undefined;

    // Determine effective provider (config override -> subchat override -> chat override -> global default)
    const defaultProvider = appStore.get(defaultProviderIdAtom);
    const enabledProviders = appStore.get(enabledProviderIdsAtom);
    const chatOverrides = appStore.get(chatProviderOverridesAtom);
    const subChatOverrides = appStore.get(subChatProviderOverridesAtom);
    const effectiveProvider =
      this.config.providerId ||
      subChatOverrides[this.config.subChatId] ||
      chatOverrides[this.config.chatId] ||
      defaultProvider;
    const resolvedProvider = enabledProviders.includes(effectiveProvider)
      ? effectiveProvider
      : enabledProviders[0] || effectiveProvider;

    // Read per-subchat model override first
    const subChatModelOverrides = appStore.get(subChatModelOverridesAtom);
    const subChatModel = subChatModelOverrides[this.config.subChatId];

    // Read model selection for the effective provider (fallback)
    const modelsByProvider = appStore.get(lastSelectedModelByProviderAtom);
    const modelString =
      modelsByProvider[resolvedProvider] ||
      (resolvedProvider === "claude" ? "sonnet" : "gpt-5.2-codex");

    // Legacy: still read from lastSelectedModelIdAtom for backwards compatibility with Claude
    const selectedModelId = appStore.get(lastSelectedModelIdAtom);
    const legacyModelString = MODEL_ID_MAP[selectedModelId];

    // Priority: per-subchat override -> legacy/global model
    const finalModelString = subChatModel
      ? subChatModel
      : resolvedProvider === "claude"
        ? legacyModelString || modelString
        : modelString;

    const currentMode =
      useAgentSubChatStore
        .getState()
        .allSubChats.find((subChat) => subChat.id === this.config.subChatId)
        ?.mode || this.config.mode;

    // Read Codex-specific settings (only used when provider is codex)
    const sandboxMode =
      resolvedProvider === "codex"
        ? appStore.get(codexSandboxModeAtom)
        : undefined;
    const approvalPolicy =
      resolvedProvider === "codex"
        ? appStore.get(codexApprovalPolicyAtom)
        : undefined;
    const reasoningEffort =
      resolvedProvider === "codex"
        ? appStore.get(codexReasoningEffortAtom)
        : undefined;
    const webSearchMode =
      resolvedProvider === "codex"
        ? appStore.get(codexWebSearchModeAtom)
        : undefined;

    // Get added directories for this sub-chat
    const addDirs = appStore.get(
      addedDirectoriesAtomFamily(this.config.subChatId),
    );

    // Stream debug logging
    const subId = this.config.subChatId.slice(-8);
    let chunkCount = 0;
    let lastChunkType = "";
    console.log(
      `[SD] R:START sub=${subId} cwd=${this.config.cwd} projectPath=${this.config.projectPath || "(not set)"} provider=${resolvedProvider}`,
    );

    return new ReadableStream({
      start: (controller) => {
        // Track stream state to prevent operations on closed stream
        let streamClosed = false;

        const sub = trpcClient.chat.chat.subscribe(
          {
            subChatId: this.config.subChatId,
            chatId: this.config.chatId,
            prompt,
            cwd: this.config.cwd,
            projectPath: this.config.projectPath, // Original project path for MCP config lookup
            mode: currentMode as "plan" | "agent" | "ralph",
            sessionId,
            providerId: resolvedProvider, // AI provider selection
            ...(maxThinkingTokens && { maxThinkingTokens }),
            ...(finalModelString && { model: finalModelString }),
            ...(images.length > 0 && { images }),
            // Additional working directories
            ...(addDirs && addDirs.length > 0 && { addDirs }),
            // Codex-specific settings
            ...(sandboxMode && { sandboxMode }),
            ...(approvalPolicy && { approvalPolicy }),
            ...(reasoningEffort && { reasoningEffort }),
            ...(webSearchMode && { webSearchMode }),
          },
          {
            onData: (chunk: UIMessageChunk) => {
              // Defensive isolation: verify chunk belongs to this subchat
              const chunkSubChatId = (chunk as any)._subChatId;
              if (chunkSubChatId && chunkSubChatId !== this.config.subChatId) {
                console.warn(
                  `[SD] R:MISROUTE sub=${subId} got chunk for ${chunkSubChatId?.slice(-8)} type=${chunk.type}`,
                );
                return; // Drop misrouted chunk
              }
              // Strip internal routing field before processing
              delete (chunk as any)._subChatId;

              chunkCount++;
              lastChunkType = chunk.type;

              // Handle AskUserQuestion - show question UI
              if (chunk.type === "ask-user-question") {
                appStore.set(pendingUserQuestionsAtom, {
                  subChatId: this.config.subChatId,
                  toolUseId: chunk.toolUseId,
                  questions: chunk.questions,
                });
                // Immediate desktop notification so user knows input is needed
                const subChatName =
                  useAgentSubChatStore
                    .getState()
                    .allSubChats.find((sc) => sc.id === this.config.subChatId)
                    ?.name || "Chat";
                showQuestionNotification(
                  subChatName,
                  this.config.chatId,
                  this.config.subChatId,
                );
              }

              // Handle AskUserQuestion timeout - clear pending question immediately
              if (chunk.type === "ask-user-question-timeout") {
                const pending = appStore.get(pendingUserQuestionsAtom);
                if (pending && pending.toolUseId === chunk.toolUseId) {
                  appStore.set(pendingUserQuestionsAtom, null);
                }
                // Show desktop notification for timeout (user attention needed)
                const subChatName =
                  useAgentSubChatStore
                    .getState()
                    .allSubChats.find((sc) => sc.id === this.config.subChatId)
                    ?.name || "Chat";
                showTimeoutNotification(
                  subChatName,
                  this.config.chatId,
                  this.config.subChatId,
                );
              }

              // Handle AskUserQuestion result - store for real-time updates
              if (chunk.type === "ask-user-question-result") {
                const currentResults = appStore.get(askUserQuestionResultsAtom);
                const newResults = new Map(currentResults);
                newResults.set(chunk.toolUseId, chunk.result);
                appStore.set(askUserQuestionResultsAtom, newResults);
              }

              // Handle compacting status - track in atom for UI display
              if (chunk.type === "system-Compact") {
                const compacting = appStore.get(compactingSubChatsAtom);
                const newCompacting = new Set(compacting);
                if (chunk.state === "input-streaming") {
                  // Compacting started
                  newCompacting.add(this.config.subChatId);
                } else {
                  // Compacting finished (output-available)
                  newCompacting.delete(this.config.subChatId);
                }
                appStore.set(compactingSubChatsAtom, newCompacting);
              }

              // Handle session init - store MCP servers, plugins, tools info
              if (chunk.type === "session-init") {
                console.log("[MCP] Received session-init:", {
                  tools: chunk.tools?.length,
                  mcpServers: chunk.mcpServers,
                  plugins: chunk.plugins,
                  skills: chunk.skills?.length,
                  providerId: resolvedProvider,
                  // Debug: show all tools to check for MCP tools (format: mcp__servername__toolname)
                  allTools: chunk.tools,
                });
                appStore.set(sessionInfoAtom, {
                  subChatId: this.config.subChatId,
                  tools: chunk.tools,
                  mcpServers: chunk.mcpServers,
                  plugins: chunk.plugins,
                  skills: chunk.skills,
                  providerId: resolvedProvider,
                });
              }

              // Handle todo updates from OpenCode - sync with AgentTodoTool via atom
              if (chunk.type === "todo-update") {
                const todosAtom = currentTodosAtomFamily(this.config.subChatId);
                const currentState = appStore.get(todosAtom);
                appStore.set(todosAtom, {
                  todos: chunk.todos,
                  creationToolCallId: currentState.creationToolCallId, // Preserve creation ID
                });
                // Don't pass to stream - handled via atom update
                return;
              }

              // === Ralph Prompt Injection ===
              if (chunk.type === "ralph-prompt-injected") {
                const currentPrompts = new Map(
                  appStore.get(ralphInjectedPromptsAtom),
                );
                currentPrompts.set(this.config.subChatId, {
                  subChatId: this.config.subChatId,
                  text: chunk.text,
                });
                appStore.set(ralphInjectedPromptsAtom, currentPrompts);
                return;
              }

              // === Ralph Automation Events ===
              // Helper to invalidate all ralph queries and broadcast state change event
              const invalidateRalphQueries = (subChatId?: string) => {
                // Broadcast custom event so badge can listen regardless of cache timing
                window.dispatchEvent(
                  new CustomEvent("ralph-state-changed", {
                    detail: { subChatId: subChatId || this.config.subChatId },
                  }),
                );
                console.log(
                  "[ralph] Dispatched ralph-state-changed event for subChatId:",
                  subChatId || this.config.subChatId,
                );

                // Also invalidate query cache for components that are already subscribed
                const queryClient = getQueryClient();
                if (queryClient) {
                  queryClient.invalidateQueries({
                    predicate: (query) => {
                      const key = query.queryKey;
                      return (
                        Array.isArray(key) &&
                        Array.isArray(key[0]) &&
                        key[0][0] === "ralph"
                      );
                    },
                    refetchType: "all",
                  });
                }
              };

              if (chunk.type === "ralph-complete") {
                toast.success("Ralph: All stories complete!", {
                  description:
                    "All PRD stories have been implemented. Switching to Agent mode.",
                  duration: 5000,
                });

                // Desktop notification + sound for Ralph completion
                const ralphSubChatName =
                  useAgentSubChatStore
                    .getState()
                    .allSubChats.find((sc) => sc.id === this.config.subChatId)
                    ?.name || "Chat";
                showRalphCompleteNotification(
                  ralphSubChatName,
                  this.config.chatId,
                  this.config.subChatId,
                );
                playCompletionSound();

                // Invalidate ralph query cache to update badge UI
                invalidateRalphQueries();

                // === Auto-switch to Agent mode ===
                // 1. Update database
                trpcClient.chats.updateSubChatMode
                  .mutate({
                    id: this.config.subChatId,
                    mode: "agent",
                  })
                  .catch((err) => {
                    console.warn(
                      "[ralph] Failed to update sub-chat mode in DB:",
                      err,
                    );
                  });

                // 2. Update Zustand store (for UI consistency)
                useAgentSubChatStore
                  .getState()
                  .updateSubChatMode(this.config.subChatId, "agent");

                // 3. Update global atom ONLY if this is the active sub-chat
                const activeSubChatId =
                  useAgentSubChatStore.getState().activeSubChatId;
                if (activeSubChatId === this.config.subChatId) {
                  appStore.set(agentModeAtom, "agent");
                }

                // Don't pass to stream - handled via toast
                return;
              }

              if (chunk.type === "ralph-story-complete") {
                toast.success(`Story ${chunk.storyId} complete!`, {
                  description: chunk.autoStartNext
                    ? "Starting next story..."
                    : "All stories complete!",
                  duration: 3000,
                });
                // Invalidate ralph query cache to update UI immediately
                invalidateRalphQueries();
                // Don't pass to stream - handled via toast
                return;
              }

              if (chunk.type === "ralph-story-transition") {
                toast.info(`Starting story: ${chunk.nextStoryTitle}`, {
                  description: `${chunk.storiesCompleted}/${chunk.storiesTotal} stories complete`,
                  duration: 3000,
                });
                invalidateRalphQueries();
                return;
              }

              if (chunk.type === "ralph-progress") {
                // Progress is saved server-side, just log here
                console.log("[ralph] Progress saved for story:", chunk.storyId);
                // Invalidate ralph query cache to update UI immediately
                invalidateRalphQueries();
                // Don't pass to stream - handled server-side
                return;
              }

              if (chunk.type === "ralph-prd-generating") {
                toast.info(chunk.message || "Generating PRD...", {
                  duration: 2000,
                });
                console.log(
                  "[ralph] PRD generation in progress:",
                  chunk.message,
                );

                // Update atom for UI rendering (bypasses AI SDK tool mechanism)
                const generatingStatuses = new Map(
                  appStore.get(ralphPrdStatusesAtom),
                );
                generatingStatuses.set(this.config.subChatId, {
                  subChatId: this.config.subChatId,
                  status: "generating",
                  message: chunk.message,
                });
                appStore.set(ralphPrdStatusesAtom, generatingStatuses);
                return;
              }

              if (chunk.type === "ralph-prd-generated") {
                toast.success("PRD generated!", {
                  description: chunk.autoStartImplementation
                    ? "Starting implementation of first story..."
                    : "Ready to start implementation.",
                  duration: 3000,
                });

                // Update atom with complete PRD for UI rendering
                const completeStatuses = new Map(
                  appStore.get(ralphPrdStatusesAtom),
                );
                completeStatuses.set(this.config.subChatId, {
                  subChatId: this.config.subChatId,
                  status: "complete",
                  prd: chunk.prd,
                });
                appStore.set(ralphPrdStatusesAtom, completeStatuses);

                // Invalidate ralph query cache to update UI immediately (show badge)
                invalidateRalphQueries();
                return;
              }

              if (chunk.type === "ralph-auto-continue") {
                // Backend signals frontend to send continuation message after stream ends
                const currentAutoStarts = new Map(
                  appStore.get(pendingRalphAutoStartsAtom),
                );
                currentAutoStarts.set(this.config.subChatId, {
                  subChatId: this.config.subChatId,
                  completedStoryId: chunk.completedStoryId,
                  continuationMessage: chunk.continuationMessage,
                  nextStoryId: chunk.nextStoryId,
                  nextStoryTitle: chunk.nextStoryTitle,
                });
                appStore.set(pendingRalphAutoStartsAtom, currentAutoStarts);
                return;
              }

              // Clear pending questions ONLY when agent has moved on
              // Don't clear on tool-input-* chunks (still building the question input)
              // Clear when we get tool-output-* (answer received) or text-delta (agent moved on)
              const shouldClearOnChunk =
                chunk.type !== "ask-user-question" &&
                chunk.type !== "ask-user-question-timeout" &&
                chunk.type !== "ask-user-question-result" &&
                !chunk.type.startsWith("tool-input") && // Don't clear while input is being built
                chunk.type !== "start" &&
                chunk.type !== "start-step";

              if (shouldClearOnChunk) {
                const pending = appStore.get(pendingUserQuestionsAtom);
                if (pending && pending.subChatId === this.config.subChatId) {
                  appStore.set(pendingUserQuestionsAtom, null);
                }
              }

              // Handle authentication errors - show login modal
              if (chunk.type === "auth-error") {
                // Store the failed message for retry after successful auth
                // readyToRetry=false prevents immediate retry - modal sets it to true on OAuth success
                appStore.set(pendingAuthRetryMessageAtom, {
                  subChatId: this.config.subChatId,
                  prompt,
                  ...(images.length > 0 && { images }),
                  readyToRetry: false,
                });
                // Store which provider triggered the auth error
                appStore.set(authErrorProviderAtom, resolvedProvider);
                // Show the login modal
                appStore.set(agentsLoginModalOpenAtom, true);
                // Use controller.error() instead of controller.close() so that
                // the SDK Chat properly resets status from "streaming" to "ready"
                // This allows user to retry sending messages after failed auth
                streamClosed = true;
                controller.error(new Error("Authentication required"));
                return;
              }

              // Handle errors - show toast to user FIRST before anything else
              if (chunk.type === "error") {
                // Show toast based on error category
                const category = chunk.debugInfo?.category || "UNKNOWN";
                const config = ERROR_TOAST_CONFIG[category];

                if (config) {
                  toast.error(config.title, {
                    description: config.description,
                    duration: 8000,
                    action: config.action
                      ? {
                          label: config.action.label,
                          onClick: config.action.onClick,
                        }
                      : undefined,
                  });
                  // Also show desktop notification if window is unfocused
                  showErrorNotification(config.title, config.description);
                } else {
                  const errorTitle = "Something went wrong";
                  const errorDescription =
                    chunk.errorText || "An unexpected error occurred";
                  toast.error(errorTitle, {
                    description: errorDescription,
                    duration: 8000,
                  });
                  // Also show desktop notification if window is unfocused
                  showErrorNotification(errorTitle, errorDescription);
                }
              }

              // Skip enqueue if stream is already closed
              if (streamClosed) {
                return;
              }

              // Try to enqueue, but don't crash if stream is already closed
              try {
                controller.enqueue(chunk);
              } catch (e) {
                // Stream was closed externally, mark it as such
                streamClosed = true;
                console.log(
                  `[SD] R:ENQUEUE_ERR sub=${subId} type=${chunk.type} n=${chunkCount} err=${e}`,
                );
                return;
              }

              if (chunk.type === "finish") {
                console.log(`[SD] R:FINISH sub=${subId} n=${chunkCount}`);
                streamClosed = true;
                try {
                  controller.close();
                } catch {
                  // Already closed
                }
              }
            },
            onError: (err: Error) => {
              console.log(
                `[SD] R:ERROR sub=${subId} n=${chunkCount} last=${lastChunkType} err=${err.message}`,
              );
              if (streamClosed) return;
              streamClosed = true;
              controller.error(err);
            },
            onComplete: () => {
              console.log(
                `[SD] R:COMPLETE sub=${subId} n=${chunkCount} last=${lastChunkType}`,
              );
              // Note: Don't clear pending questions here - let active-chat.tsx handle it
              // via the stream stop detection effect. Clearing here causes race conditions
              // where sync effect immediately restores from messages.
              if (streamClosed) return;
              streamClosed = true;
              try {
                controller.close();
              } catch {
                // Already closed
              }
            },
          },
        );

        // Handle abort
        options.abortSignal?.addEventListener("abort", () => {
          console.log(
            `[SD] R:ABORT sub=${subId} n=${chunkCount} last=${lastChunkType}`,
          );
          sub.unsubscribe();
          trpcClient.chat.cancel.mutate({ subChatId: this.config.subChatId });
          if (streamClosed) return;
          streamClosed = true;
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      },
    });
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null; // Not needed for local app
  }

  private extractText(msg: UIMessage | undefined): string {
    if (!msg) return "";
    if (msg.parts) {
      return msg.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n");
    }
    return "";
  }

  /**
   * Extract images from message parts
   * Looks for parts with type "data-image" that have base64Data
   */
  private extractImages(msg: UIMessage | undefined): ImageAttachment[] {
    if (!msg || !msg.parts) return [];

    const images: ImageAttachment[] = [];

    for (const part of msg.parts) {
      // Check for data-image parts with base64 data
      if (part.type === "data-image" && (part as any).data) {
        const data = (part as any).data;
        if (data.base64Data && data.mediaType) {
          images.push({
            base64Data: data.base64Data,
            mediaType: data.mediaType,
            filename: data.filename,
          });
        }
      }
    }

    return images;
  }
}
