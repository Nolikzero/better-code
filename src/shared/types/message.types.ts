// MCP Server types
export type MCPServerStatus = "connected" | "failed" | "pending" | "needs-auth";

export type MCPServer = {
  name: string;
  status: MCPServerStatus;
  serverInfo?: {
    name: string;
    version: string;
  };
  error?: string;
};

// Message metadata
export type MessageMetadata = {
  sessionId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  // Enhanced token tracking (Codex)
  cachedInputTokens?: number;
  reasoningTokens?: number;
  // Cost tracking
  totalCostUsd?: number;
  inputCostUsd?: number;
  outputCostUsd?: number;
  // Timing
  durationMs?: number;
  resultSubtype?: string;
  finalTextId?: string;
  // Model info
  model?: string;
  // OpenCode-specific: persisted diff keys for deduplication across turns
  emittedDiffKeys?: string[];
};

// AI SDK UIMessageChunk format
export type UIMessageChunk =
  // Message lifecycle
  | { type: "start"; messageId?: string }
  | { type: "finish"; messageMetadata?: MessageMetadata }
  | { type: "start-step" }
  | { type: "finish-step" }
  // Text streaming
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  // Reasoning (Extended Thinking)
  | { type: "reasoning"; id: string; text: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  // Tool calls
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-delta"; toolCallId: string; inputTextDelta: string }
  | {
      type: "tool-input-available";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "tool-output-error"; toolCallId: string; errorText: string }
  // Error & metadata
  | { type: "error"; errorText: string }
  | { type: "auth-error"; errorText: string }
  | {
      type: "ask-user-question";
      toolUseId: string;
      questions: Array<{
        question: string;
        header: string;
        options: Array<{ label: string; description: string }>;
        multiSelect: boolean;
      }>;
    }
  | { type: "ask-user-question-timeout"; toolUseId: string }
  | { type: "ask-user-question-result"; toolUseId: string; result: unknown }
  | { type: "message-metadata"; messageMetadata: MessageMetadata }
  // System tools (rendered like regular tools)
  | {
      type: "system-Compact";
      toolCallId: string;
      state: "input-streaming" | "output-available";
    }
  // Session initialization (MCP servers, plugins, tools)
  | {
      type: "session-init";
      tools: string[];
      mcpServers: MCPServer[];
      plugins: { name: string; path: string }[];
      skills: string[];
    }
  // OpenCode todo updates (from todo.updated event)
  | {
      type: "todo-update";
      todos: Array<{
        content: string;
        status: "pending" | "in_progress" | "completed";
        activeForm?: string;
      }>;
    }
  // OpenCode session diff updates (from session.diff event)
  | {
      type: "session-diff";
      diffs: Array<{
        file: string;
        additions: number;
        deletions: number;
      }>;
    }
  // Ralph automation events
  | { type: "ralph-complete" }
  | { type: "ralph-story-complete"; storyId: string; autoStartNext?: boolean }
  | {
      type: "ralph-story-transition";
      completedStoryId: string;
      nextStoryId: string;
      nextStoryTitle: string;
      storiesCompleted: number;
      storiesTotal: number;
    }
  | {
      type: "ralph-progress";
      storyId: string | null;
      summary: string;
      learnings: string[];
    }
  | { type: "ralph-prompt-injected"; text: string }
  | { type: "ralph-prd-generating"; message: string }
  | {
      type: "ralph-prd-generated";
      prd: {
        goal: string;
        branchName: string;
        stories: Array<{
          id: string;
          title: string;
          description: string;
          priority: number;
          acceptanceCriteria: string[];
          type?: string;
          passes: boolean;
          notes?: string;
        }>;
      };
      autoStartImplementation?: boolean;
    };
