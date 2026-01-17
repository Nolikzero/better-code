import type { MessageMetadata, UIMessageChunk } from "../claude/types";

/**
 * Creates a transformer that converts OpenAI Codex SDK events to UIMessageChunk format.
 * This allows Codex responses to be rendered using the same UI components as Claude.
 *
 * Codex SDK event types (from @openai/codex):
 * - item.started: A new item (message, command, file_edit) has started
 * - item.updated: An item has been updated (delta content)
 * - item.completed: An item has completed
 * - turn.started: A turn has started
 * - turn.completed: A turn has completed
 * - turn.failed: A turn has failed
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

  return function* transform(event: any): Generator<UIMessageChunk> {
    // Emit start once
    if (!started) {
      started = true;
      startTime = Date.now();
      yield { type: "start" };
      yield { type: "start-step" };
    }

    // Handle different Codex event types
    switch (event.type) {
      // ===== THREAD STARTED =====
      case "thread.started": {
        // Capture thread_id for session continuation
        threadId = event.thread_id || null;
        break;
      }

      // ===== ITEM STARTED =====
      case "item.started": {
        const item = event.item;
        if (!item) break;

        switch (item.type) {
          case "message":
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

          case "file_edit":
            // File editing
            yield* endTextBlock();
            if (!emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-start",
                toolCallId: item.id,
                toolName: "Edit",
              };
            }
            break;

          case "file_read":
            // File reading
            yield* endTextBlock();
            if (!emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-start",
                toolCallId: item.id,
                toolName: "Read",
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

          case "apply_patch":
          case "apply_patch_call":
            // V4A diff format patching
            yield* endTextBlock();
            if (!emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-start",
                toolCallId: item.id,
                toolName: "ApplyPatch",
              };
            }
            break;

          case "file_write":
          case "file_create":
            // File creation/write (different from edit)
            yield* endTextBlock();
            if (!emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-start",
                toolCallId: item.id,
                toolName: "Write",
              };
            }
            break;

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

          case "file_tree":
          case "list_directory":
            // File tree / directory listing
            yield* endTextBlock();
            if (!emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-start",
                toolCallId: item.id,
                toolName: "Glob",
              };
            }
            break;

          case "local_shell_call":
            // Local shell (sandboxed)
            yield* endTextBlock();
            if (!emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-start",
                toolCallId: item.id,
                toolName: "Bash",
              };
            }
            break;

          case "browser_action":
          case "browser":
            // Browser automation
            yield* endTextBlock();
            if (!emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-start",
                toolCallId: item.id,
                toolName: "Browser",
              };
            }
            break;
        }
        break;
      }

      // ===== ITEM UPDATED (delta content) =====
      case "item.updated": {
        const item = event.item;
        if (!item) break;

        // Codex uses "text" field, fallback to "content"
        const itemText = item.text ?? item.content;

        switch (item.type) {
          case "message":
          case "agent_message":
            // Stream text delta
            if (textStarted && textId && itemText) {
              const prevContent = itemContent.get(item.id) || "";
              const newContent = itemText;
              const delta = newContent.slice(prevContent.length);
              if (delta) {
                yield { type: "text-delta", id: textId, delta };
                itemContent.set(item.id, newContent);
              }
            }
            break;

          case "command_execution":
            // Stream command input
            if (item.command && !emittedToolIds.has(item.id)) {
              yield {
                type: "tool-input-delta",
                toolCallId: item.id,
                inputTextDelta: item.command,
              };
            }
            break;

          case "reasoning":
            // Stream reasoning delta
            if (itemText) {
              const prevContent = itemContent.get(item.id) || "";
              const newContent = itemText;
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
        break;
      }

      // ===== ITEM COMPLETED =====
      case "item.completed": {
        const item = event.item;
        if (!item) break;

        // Codex uses "text" field, fallback to "content"
        const itemText = item.text ?? item.content;

        switch (item.type) {
          case "message":
          case "agent_message":
            // If item.completed comes directly without item.started,
            // emit the full text content
            if (itemText && !itemContent.has(item.id)) {
              yield* endTextBlock();
              const id = genId();
              yield { type: "text-start", id };
              yield { type: "text-delta", id, delta: itemText };
              yield { type: "text-end", id };
            } else if (textStarted) {
              // Normal flow: end the text block that was started
              yield* endTextBlock();
            }
            break;

          case "command_execution":
            // Emit complete command
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "Bash",
                input: {
                  command: item.command || "",
                  description: item.description || "",
                },
              };
              // Emit output
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: {
                  stdout: item.aggregated_output || item.stdout || "",
                  stderr: item.stderr || "",
                  exitCode: item.exit_code ?? 0,
                },
              };
            }
            break;

          case "file_edit":
            // Emit complete file edit
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "Edit",
                input: {
                  file_path: item.path || item.file_path || "",
                  old_string: item.old_content || "",
                  new_string: item.new_content || "",
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: { success: true },
              };
            }
            break;

          case "file_read":
            // Emit complete file read
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "Read",
                input: {
                  file_path: item.path || item.file_path || "",
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: item.content || "",
              };
            }
            break;

          case "reasoning":
            // Emit complete reasoning
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              const reasoningText = itemContent.get(item.id) || itemText || "";
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

          case "apply_patch":
          case "apply_patch_call":
            // V4A diff format patching
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              // V4A format includes action (create_file, update_file, delete_file)
              // and the diff content with context lines
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "ApplyPatch",
                input: {
                  file_path: item.path || item.file_path || "",
                  action: item.action || "update_file",
                  diff: item.diff || item.patch || "",
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: {
                  success:
                    item.status === "completed" || item.success !== false,
                  error: item.error,
                },
              };
            }
            break;

          case "file_write":
          case "file_create":
            // File creation/write
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "Write",
                input: {
                  file_path: item.path || item.file_path || "",
                  content: item.content || "",
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: { success: true },
              };
            }
            break;

          case "web_search":
            // Web search results
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "WebSearch",
                input: {
                  query: item.query || "",
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: item.results || item.content || [],
              };
            }
            break;

          case "file_tree":
          case "list_directory":
            // Directory listing
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "Glob",
                input: {
                  path: item.path || item.directory || "",
                  pattern: item.pattern || "**/*",
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: item.files || item.entries || item.content || [],
              };
            }
            break;

          case "local_shell_call":
            // Local sandboxed shell
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "Bash",
                input: {
                  command: item.command || "",
                  description: item.description || "",
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: {
                  stdout: item.stdout || item.output || "",
                  stderr: item.stderr || "",
                  exitCode: item.exit_code ?? 0,
                },
              };
            }
            break;

          case "browser_action":
          case "browser":
            // Browser automation
            if (!emittedToolIds.has(item.id)) {
              emittedToolIds.add(item.id);
              yield {
                type: "tool-input-available",
                toolCallId: item.id,
                toolName: "Browser",
                input: {
                  url: item.url || "",
                  action: item.action || "navigate",
                  selector: item.selector,
                },
              };
              yield {
                type: "tool-output-available",
                toolCallId: item.id,
                output: {
                  screenshot: item.screenshot,
                  content: item.content,
                  success: item.success !== false,
                },
              };
            }
            break;
        }
        break;
      }

      // ===== TURN COMPLETED =====
      case "turn.completed": {
        yield* endTextBlock();

        const usage = event.usage || {};
        const metadata: MessageMetadata = {
          // Use threadId captured from thread.started event
          sessionId: threadId || event.session_id || event.thread_id,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          totalTokens: usage.total_tokens,
          // Enhanced token tracking
          cachedInputTokens: usage.cached_tokens || usage.cached_input_tokens,
          reasoningTokens: usage.reasoning_tokens,
          // Cost tracking
          totalCostUsd: event.total_cost_usd || usage.total_cost_usd,
          inputCostUsd: usage.input_cost_usd,
          outputCostUsd: usage.output_cost_usd,
          // Timing
          durationMs: startTime ? Date.now() - startTime : undefined,
          resultSubtype: "success",
          // Model info
          model: event.model,
        };

        yield { type: "message-metadata", messageMetadata: metadata };
        yield { type: "finish-step" };
        yield { type: "finish", messageMetadata: metadata };
        break;
      }

      // ===== TURN FAILED =====
      case "turn.failed": {
        yield* endTextBlock();

        const errorMessage =
          event.error?.message || event.message || "Codex execution failed";

        yield {
          type: "error",
          errorText: errorMessage,
        };

        yield { type: "finish-step" };
        yield { type: "finish" };
        break;
      }

      // ===== ERROR =====
      case "error": {
        yield* endTextBlock();

        const errorMessage =
          event.error?.message || event.message || "Unknown error";

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
