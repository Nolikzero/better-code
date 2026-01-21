import type {
  AgentMessageItem,
  CommandExecutionItem,
  ErrorItem,
  FileChangeItem,
  McpToolCallItem,
  ReasoningItem,
  ThreadEvent,
  ThreadItem,
  TodoListItem,
  Usage,
  WebSearchItem,
} from "@openai/codex-sdk";
import type { MessageMetadata, UIMessageChunk } from "../claude/types";

/**
 * Creates a transformer that converts OpenAI Codex SDK events to UIMessageChunk format.
 * This allows Codex responses to be rendered using the same UI components as Claude.
 *
 * SDK event types:
 * - thread.started: A new thread has started (contains thread_id for resumption)
 * - turn.started: A turn has started
 * - item.started: A new item (message, command, file_change) has started
 * - item.updated: An item has been updated (delta content)
 * - item.completed: An item has completed
 * - turn.completed: A turn has completed (contains usage stats)
 * - turn.failed: A turn has failed
 * - error: Fatal stream error
 */
export function createCodexTransformer() {
  let started = false;
  let startTime: number | null = null;

  // Track session/thread ID for conversation continuation
  let threadId: string | null = null;

  // Track text streaming
  let textId: string | null = null;
  let textStarted = false;

  // Track tool calls
  const emittedToolIds = new Set<string>();

  // Track accumulated content for items
  const itemContent = new Map<string, string>();

  const genId = () =>
    `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Helper to end current text block
  function* endTextBlock(): Generator<UIMessageChunk> {
    if (textStarted && textId) {
      yield { type: "text-end", id: textId };
      textStarted = false;
      textId = null;
    }
  }

  // Helper to get tool name for file change
  function getFileChangeToolName(kind: string): string {
    switch (kind) {
      case "add":
        return "Write";
      case "delete":
        return "Delete";
      case "update":
      default:
        return "Edit";
    }
  }

  // Helper to handle item events
  function* handleItemStarted(item: ThreadItem): Generator<UIMessageChunk> {
    switch (item.type) {
      case "agent_message":
        // Start text streaming
        yield* endTextBlock();
        textId = genId();
        yield { type: "text-start", id: textId };
        textStarted = true;
        itemContent.set(item.id, "");
        break;

      case "command_execution":
        // Bash command execution
        yield* endTextBlock();
        if (!emittedToolIds.has(item.id)) {
          yield {
            type: "tool-input-start",
            toolCallId: item.id,
            toolName: "Bash",
          };
        }
        break;

      case "reasoning":
        // Reasoning/thinking
        yield* endTextBlock();
        if (!emittedToolIds.has(item.id)) {
          yield {
            type: "tool-input-start",
            toolCallId: item.id,
            toolName: "Thinking",
          };
        }
        itemContent.set(item.id, "");
        break;

      case "file_change":
        // File changes - SDK groups multiple changes into one item
        yield* endTextBlock();
        // We'll emit individual tool calls for each file in the changes array
        break;

      case "mcp_tool_call": {
        // MCP tool calls
        yield* endTextBlock();
        const mcpItem = item as McpToolCallItem;
        const toolName = `mcp__${mcpItem.server}__${mcpItem.tool}`;
        if (!emittedToolIds.has(item.id)) {
          yield {
            type: "tool-input-start",
            toolCallId: item.id,
            toolName,
          };
        }
        break;
      }

      case "web_search":
        // Web search tool
        yield* endTextBlock();
        if (!emittedToolIds.has(item.id)) {
          yield {
            type: "tool-input-start",
            toolCallId: item.id,
            toolName: "WebSearch",
          };
        }
        break;

      case "todo_list":
        // Todo list - we can emit as a special tool
        yield* endTextBlock();
        if (!emittedToolIds.has(item.id)) {
          yield {
            type: "tool-input-start",
            toolCallId: item.id,
            toolName: "TodoWrite",
          };
        }
        break;

      case "error":
        // Non-fatal error item
        yield* endTextBlock();
        break;
    }
  }

  function* handleItemUpdated(item: ThreadItem): Generator<UIMessageChunk> {
    switch (item.type) {
      case "agent_message": {
        // Stream text delta
        const agentItem = item as AgentMessageItem;
        if (textStarted && textId && agentItem.text) {
          const prevContent = itemContent.get(item.id) || "";
          const newContent = agentItem.text;
          const delta = newContent.slice(prevContent.length);
          if (delta) {
            yield { type: "text-delta", id: textId, delta };
            itemContent.set(item.id, newContent);
          }
        }
        break;
      }

      case "command_execution": {
        // Stream command input
        const cmdItem = item as CommandExecutionItem;
        if (cmdItem.command && !emittedToolIds.has(item.id)) {
          yield {
            type: "tool-input-delta",
            toolCallId: item.id,
            inputTextDelta: cmdItem.command,
          };
        }
        break;
      }

      case "reasoning": {
        // Stream reasoning delta
        const reasonItem = item as ReasoningItem;
        if (reasonItem.text) {
          const prevContent = itemContent.get(item.id) || "";
          const newContent = reasonItem.text;
          const delta = newContent.slice(prevContent.length);
          if (delta) {
            yield {
              type: "tool-input-delta",
              toolCallId: item.id,
              inputTextDelta: delta,
            };
            itemContent.set(item.id, newContent);
          }
        }
        break;
      }
    }
  }

  function* handleItemCompleted(item: ThreadItem): Generator<UIMessageChunk> {
    switch (item.type) {
      case "agent_message": {
        const agentItem = item as AgentMessageItem;
        // If item.completed comes directly without item.started,
        // emit the full text content
        if (agentItem.text && !itemContent.has(item.id)) {
          yield* endTextBlock();
          const id = genId();
          yield { type: "text-start", id };
          yield { type: "text-delta", id, delta: agentItem.text };
          yield { type: "text-end", id };
        } else if (textStarted) {
          // Normal flow: end the text block that was started
          yield* endTextBlock();
        }
        break;
      }

      case "command_execution": {
        const cmdItem = item as CommandExecutionItem;
        // Emit complete command
        if (!emittedToolIds.has(item.id)) {
          emittedToolIds.add(item.id);
          yield {
            type: "tool-input-available",
            toolCallId: item.id,
            toolName: "Bash",
            input: {
              command: cmdItem.command || "",
            },
          };
          // Emit output
          yield {
            type: "tool-output-available",
            toolCallId: item.id,
            output: {
              stdout: cmdItem.aggregated_output || "",
              exitCode: cmdItem.exit_code ?? 0,
            },
          };
        }
        break;
      }

      case "reasoning": {
        const reasonItem = item as ReasoningItem;
        // Emit complete reasoning
        if (!emittedToolIds.has(item.id)) {
          emittedToolIds.add(item.id);
          const reasoningText =
            itemContent.get(item.id) || reasonItem.text || "";
          yield {
            type: "tool-input-available",
            toolCallId: item.id,
            toolName: "Thinking",
            input: { text: reasoningText },
          };
          yield {
            type: "tool-output-available",
            toolCallId: item.id,
            output: { completed: true },
          };
        }
        break;
      }

      case "file_change": {
        const fileItem = item as FileChangeItem;
        // Emit a tool call for each file change
        if (!emittedToolIds.has(item.id)) {
          emittedToolIds.add(item.id);
          for (const change of fileItem.changes) {
            const changeId = `${item.id}_${change.path}`;
            const toolName = getFileChangeToolName(change.kind);
            yield {
              type: "tool-input-available",
              toolCallId: changeId,
              toolName,
              input: {
                file_path: change.path,
                kind: change.kind,
              },
            };
            yield {
              type: "tool-output-available",
              toolCallId: changeId,
              output: {
                success: fileItem.status === "completed",
              },
            };
          }
        }
        break;
      }

      case "mcp_tool_call": {
        const mcpItem = item as McpToolCallItem;
        const toolName = `mcp__${mcpItem.server}__${mcpItem.tool}`;
        if (!emittedToolIds.has(item.id)) {
          emittedToolIds.add(item.id);
          yield {
            type: "tool-input-available",
            toolCallId: item.id,
            toolName,
            input: mcpItem.arguments,
          };
          if (mcpItem.result) {
            yield {
              type: "tool-output-available",
              toolCallId: item.id,
              output: mcpItem.result,
            };
          } else if (mcpItem.error) {
            yield {
              type: "tool-output-available",
              toolCallId: item.id,
              output: { error: mcpItem.error.message },
            };
          }
        }
        break;
      }

      case "web_search": {
        const searchItem = item as WebSearchItem;
        if (!emittedToolIds.has(item.id)) {
          emittedToolIds.add(item.id);
          yield {
            type: "tool-input-available",
            toolCallId: item.id,
            toolName: "WebSearch",
            input: {
              query: searchItem.query || "",
            },
          };
          yield {
            type: "tool-output-available",
            toolCallId: item.id,
            output: { completed: true },
          };
        }
        break;
      }

      case "todo_list": {
        const todoItem = item as TodoListItem;
        if (!emittedToolIds.has(item.id)) {
          emittedToolIds.add(item.id);
          yield {
            type: "tool-input-available",
            toolCallId: item.id,
            toolName: "TodoWrite",
            input: {
              todos: todoItem.items.map((t) => ({
                content: t.text,
                status: t.completed ? "completed" : "pending",
              })),
            },
          };
          yield {
            type: "tool-output-available",
            toolCallId: item.id,
            output: { success: true },
          };
        }
        break;
      }

      case "error": {
        const errorItem = item as ErrorItem;
        yield {
          type: "error",
          errorText: errorItem.message,
        };
        break;
      }
    }
  }

  function* handleTurnCompleted(usage: Usage): Generator<UIMessageChunk> {
    yield* endTextBlock();

    const metadata: MessageMetadata = {
      // Use threadId captured from thread.started event
      sessionId: threadId || undefined,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
      cachedInputTokens: usage.cached_input_tokens,
      durationMs: startTime ? Date.now() - startTime : undefined,
      resultSubtype: "success",
    };

    yield { type: "message-metadata", messageMetadata: metadata };
    yield { type: "finish-step" };
    yield { type: "finish", messageMetadata: metadata };
  }

  return function* transform(event: ThreadEvent): Generator<UIMessageChunk> {
    // Emit start once
    if (!started) {
      started = true;
      startTime = Date.now();
      yield { type: "start" };
      yield { type: "start-step" };
    }

    // Handle different Codex event types
    switch (event.type) {
      case "thread.started":
        // Capture thread_id for session continuation
        threadId = event.thread_id || null;
        break;

      case "turn.started":
        // Turn started - nothing specific to emit
        break;

      case "item.started":
        yield* handleItemStarted(event.item);
        break;

      case "item.updated":
        yield* handleItemUpdated(event.item);
        break;

      case "item.completed":
        yield* handleItemCompleted(event.item);
        break;

      case "turn.completed":
        yield* handleTurnCompleted(event.usage);
        break;

      case "turn.failed": {
        yield* endTextBlock();
        const errorMessage = event.error?.message || "Codex execution failed";
        yield {
          type: "error",
          errorText: errorMessage,
        };
        yield { type: "finish-step" };
        yield { type: "finish" };
        break;
      }

      case "error": {
        yield* endTextBlock();
        const errorMessage = event.message || "Unknown error";

        // Check for auth errors
        if (
          errorMessage.includes("authentication") ||
          errorMessage.includes("api_key") ||
          errorMessage.includes("401")
        ) {
          yield {
            type: "auth-error",
            errorText: errorMessage,
          };
        } else {
          yield {
            type: "error",
            errorText: errorMessage,
          };
        }
        break;
      }
    }
  };
}
