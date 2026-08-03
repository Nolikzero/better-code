import type { ChatTransport, UIMessage } from "ai";
import { toast } from "sonner";
import { getQueryClient } from "../../../contexts/TRPCProvider";
import {
  chatProviderOverridesAtom,
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
  compactingSubChatsAtom,
  currentTodosAtomFamily,
  pendingRalphAutoStartsAtom,
  pendingUserQuestionsAtom,
  ralphInjectedPromptsAtom,
  ralphPrdStatusesAtom,
} from "../atoms";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

// Error categories returned by the API-provider boundary.
const ERROR_TOAST_CONFIG: Record<
  string,
  { readonly title: string; readonly description: string }
> = {
  INVALID_API_KEY: {
    title: "API Key 无效",
    description: "请检查服务商的 API Key、Base URL 和接口格式。",
  },
  RATE_LIMIT: {
    title: "请求频率受限",
    description: "服务商拒绝了过于频繁的请求，请稍候再试。",
  },
  NETWORK_ERROR: {
    title: "网络错误",
    description: "请检查 Base URL、网络连接和服务商运行状态。",
  },
  AUTH_FAILURE: {
    title: "身份验证失败",
    description: "请前往设置检查 API Key 和服务商配置。",
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
  providerId?: ProviderId; // API provider selection
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

    // Get the persisted provider session ID when available.
    const lastAssistant = [...options.messages]
      .reverse()
      .find((message) => message.role === "assistant");
    const metadata = lastAssistant?.metadata;
    const sessionId =
      metadata &&
      typeof metadata === "object" &&
      "sessionId" in metadata &&
      typeof metadata.sessionId === "string"
        ? metadata.sessionId
        : undefined;

    // Keep the existing optional extended-thinking budget for compatible gateways.
    const thinkingEnabled = appStore.get(extendedThinkingEnabledAtom);
    const maxThinkingTokens = thinkingEnabled ? 60_000 : undefined;

    // Resolve provider and model from dynamic API-provider settings.
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
      : enabledProviders[0];

    if (!resolvedProvider) {
      const message = "尚未配置接口服务商，请前往设置添加。";
      toast.error("无法发送消息", { description: message });
      throw new Error(message);
    }

    const configuredModels = await trpcClient.providers.getModels.query({
      providerId: resolvedProvider,
    });
    const subChatModelOverrides = appStore.get(subChatModelOverridesAtom);
    const modelsByProvider = appStore.get(lastSelectedModelByProviderAtom);
    const storedModelId =
      this.config.model ||
      subChatModelOverrides[this.config.subChatId] ||
      modelsByProvider[resolvedProvider];
    const finalModelString = configuredModels.some(
      (model) => model.id === storedModelId,
    )
      ? storedModelId
      : configuredModels[0]?.id;

    if (!finalModelString) {
      const message = "当前服务商没有可用模型，请前往设置填写模型列表。";
      toast.error("无法发送消息", { description: message });
      throw new Error(message);
    }

    const currentMode =
      useAgentSubChatStore
        .getState()
        .allSubChats.find((subChat) => subChat.id === this.config.subChatId)
        ?.mode || this.config.mode;

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
                toast.success("Ralph：所有故事已完成！", {
                  description: "所有 PRD 故事均已实现，正在切换到智能体模式。",
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
                toast.success(`故事 ${chunk.storyId} 已完成！`, {
                  description: chunk.autoStartNext
                    ? "正在开始下一个故事…"
                    : "所有故事均已完成！",
                  duration: 3000,
                });
                // Invalidate ralph query cache to update UI immediately
                invalidateRalphQueries();
                // Don't pass to stream - handled via toast
                return;
              }

              if (chunk.type === "ralph-story-transition") {
                toast.info(`正在开始故事：${chunk.nextStoryTitle}`, {
                  description: `已完成 ${chunk.storiesCompleted}/${chunk.storiesTotal} 个故事`,
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
                toast.info(chunk.message || "正在生成 PRD…", {
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
                toast.success("PRD 已生成！", {
                  description: chunk.autoStartImplementation
                    ? "正在开始实现第一个故事…"
                    : "已准备好开始实现。",
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

              if (chunk.type === "auth-error") {
                const errorDescription =
                  chunk.errorText ||
                  "请前往设置检查 Base URL、API Key、接口格式和模型。";
                toast.error("服务商身份验证失败", {
                  description: errorDescription,
                  duration: 8000,
                });
                showErrorNotification("服务商身份验证失败", errorDescription);
                streamClosed = true;
                controller.error(new Error(errorDescription));
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
                  });
                  // Also show desktop notification if window is unfocused
                  showErrorNotification(config.title, config.description);
                } else {
                  const errorTitle = "出现问题";
                  const errorDescription = chunk.errorText || "发生了意外错误";
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
