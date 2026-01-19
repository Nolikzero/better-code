import type { ChatTransport, UIMessage } from "ai";
import { toast } from "sonner";
import {
  agentsLoginModalOpenAtom,
  chatProviderOverridesAtom,
  codexApprovalPolicyAtom,
  codexReasoningEffortAtom,
  codexSandboxModeAtom,
  defaultProviderIdAtom,
  extendedThinkingEnabledAtom,
  lastSelectedModelByProviderAtom,
  type ProviderId,
  sessionInfoAtom,
  subChatProviderOverridesAtom,
} from "../../../lib/atoms";
import { appStore } from "../../../lib/jotai-store";
import { trpcClient } from "../../../lib/trpc";
import {
  showErrorNotification,
  showTimeoutNotification,
} from "../../sidebar/hooks/use-desktop-notifications";
import {
  addedDirectoriesAtomFamily,
  askUserQuestionResultsAtom,
  compactingSubChatsAtom,
  lastSelectedModelIdAtom,
  MODEL_ID_MAP,
  pendingAuthRetryMessageAtom,
  pendingUserQuestionsAtom,
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
    const chatOverrides = appStore.get(chatProviderOverridesAtom);
    const subChatOverrides = appStore.get(subChatProviderOverridesAtom);
    const effectiveProvider =
      this.config.providerId ||
      subChatOverrides[this.config.subChatId] ||
      chatOverrides[this.config.chatId] ||
      defaultProvider;

    // Read model selection for the effective provider
    const modelsByProvider = appStore.get(lastSelectedModelByProviderAtom);
    const modelString =
      modelsByProvider[effectiveProvider] ||
      (effectiveProvider === "claude" ? "sonnet" : "gpt-5.2-codex");

    // Legacy: still read from lastSelectedModelIdAtom for backwards compatibility with Claude
    const selectedModelId = appStore.get(lastSelectedModelIdAtom);
    const legacyModelString = MODEL_ID_MAP[selectedModelId];
    const finalModelString =
      effectiveProvider === "claude"
        ? legacyModelString || modelString
        : modelString;

    const currentMode =
      useAgentSubChatStore
        .getState()
        .allSubChats.find((subChat) => subChat.id === this.config.subChatId)
        ?.mode || this.config.mode;

    // Read Codex-specific settings (only used when provider is codex)
    const sandboxMode =
      effectiveProvider === "codex"
        ? appStore.get(codexSandboxModeAtom)
        : undefined;
    const approvalPolicy =
      effectiveProvider === "codex"
        ? appStore.get(codexApprovalPolicyAtom)
        : undefined;
    const reasoningEffort =
      effectiveProvider === "codex"
        ? appStore.get(codexReasoningEffortAtom)
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
      `[SD] R:START sub=${subId} cwd=${this.config.cwd} projectPath=${this.config.projectPath || "(not set)"} provider=${effectiveProvider}`,
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
            mode: currentMode as "plan" | "agent",
            sessionId,
            providerId: effectiveProvider, // AI provider selection
            ...(maxThinkingTokens && { maxThinkingTokens }),
            ...(finalModelString && { model: finalModelString }),
            ...(images.length > 0 && { images }),
            // Additional working directories
            ...(addDirs && addDirs.length > 0 && { addDirs }),
            // Codex-specific settings
            ...(sandboxMode && { sandboxMode }),
            ...(approvalPolicy && { approvalPolicy }),
            ...(reasoningEffort && { reasoningEffort }),
          },
          {
            onData: (chunk: UIMessageChunk) => {
              chunkCount++;
              lastChunkType = chunk.type;

              // Handle AskUserQuestion - show question UI
              if (chunk.type === "ask-user-question") {
                appStore.set(pendingUserQuestionsAtom, {
                  subChatId: this.config.subChatId,
                  toolUseId: chunk.toolUseId,
                  questions: chunk.questions,
                });
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
                  providerId: effectiveProvider,
                  // Debug: show all tools to check for MCP tools (format: mcp__servername__toolname)
                  allTools: chunk.tools,
                });
                appStore.set(sessionInfoAtom, {
                  tools: chunk.tools,
                  mcpServers: chunk.mcpServers,
                  plugins: chunk.plugins,
                  skills: chunk.skills,
                  providerId: effectiveProvider,
                });
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

              // Handle authentication errors - show Claude login modal
              if (chunk.type === "auth-error") {
                // Store the failed message for retry after successful auth
                // readyToRetry=false prevents immediate retry - modal sets it to true on OAuth success
                appStore.set(pendingAuthRetryMessageAtom, {
                  subChatId: this.config.subChatId,
                  prompt,
                  ...(images.length > 0 && { images }),
                  readyToRetry: false,
                });
                // Show the Claude Code login modal
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
