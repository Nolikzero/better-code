import { createHash } from "node:crypto";
import type {
  EventFileEdited,
  EventMessagePartUpdated,
  EventPermissionReplied,
  EventPermissionUpdated,
  EventSessionDiff,
  EventSessionError,
  EventSessionStatus,
  EventSessionUpdated,
  EventTodoUpdated,
  EventVcsBranchUpdated,
  GlobalEvent,
  Part,
  TextPart,
  ToolPart,
  ToolState,
} from "@opencode-ai/sdk";
// Import SDK v2 types for question events (not in v1 Event union)
import type {
  ApiError,
  EventQuestionAsked,
  EventQuestionRejected,
  EventQuestionReplied,
  ProviderAuthError,
} from "@opencode-ai/sdk/v2";
import type { MessageMetadata, UIMessageChunk } from "@shared/types";
import { structuredPatch } from "diff";
import log from "electron-log";

// Event types we handle
type OpenCodeEvent = GlobalEvent["payload"];

const logger = log.scope("opencode-transform");

/**
 * Map OpenCode tool names to canonical names used in the UI
 */
const TOOL_NAME_MAP: Record<string, string> = {
  shell: "Bash",
  bash: "Bash",
  file_read: "Read",
  read: "Read",
  file_write: "Write",
  write: "Write",
  file_edit: "Edit",
  edit: "Edit",
  glob: "Glob",
  find_files: "Glob",
  grep: "Grep",
  search: "Grep",
  web_search: "WebSearch",
  thinking: "Thinking",
  task: "Task",
  todowrite: "TodoWrite",
  todoread: "TodoRead",
};

function normalizeToolName(toolName: string): string {
  const lower = toolName.toLowerCase();
  return TOOL_NAME_MAP[lower] || toolName;
}

/**
 * Normalize file path to match session.diff format.
 * Extracts relative path from absolute path when possible.
 * This is needed because tool inputs may use absolute paths while session.diff uses relative paths.
 */
function normalizeFilePath(filePath: string): string {
  if (!filePath) return filePath;

  // If it's already a relative path (doesn't start with /), use as-is
  if (!filePath.startsWith("/")) return filePath;

  // Try to extract project-relative path by finding common root indicators
  const parts = filePath.split("/");
  const rootIndicators = [
    "apps",
    "packages",
    "src",
    "lib",
    "components",
    "pages",
    "api",
    "server",
    "client",
  ];

  // Find the first occurrence of a root indicator
  const rootIndex = parts.findIndex((p) => rootIndicators.includes(p));
  if (rootIndex > 0) {
    return parts.slice(rootIndex).join("/");
  }

  // Fallback: use the last 3 path segments (usually enough to be unique)
  if (parts.length > 3) {
    return parts.slice(-3).join("/");
  }

  return filePath;
}

/**
 * Normalize OpenCode tool input property names to match UI expectations
 * OpenCode uses: path, content, before, after, command
 * UI expects: file_path, content, old_string, new_string, command
 */
function normalizeToolInput(
  toolName: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (!input || typeof input !== "object") return input;

  const normalized = { ...input };

  // Map 'path' or 'filePath' to 'file_path' for file operations
  if ("filePath" in normalized && !("file_path" in normalized)) {
    normalized.file_path = normalized.filePath;
  } else if ("path" in normalized && !("file_path" in normalized)) {
    normalized.file_path = normalized.path;
  }

  // Map 'before'/'after'/'oldString'/'newString' to 'old_string'/'new_string' for Edit
  if (toolName === "Edit") {
    if (!("old_string" in normalized)) {
      if ("oldString" in normalized) {
        normalized.old_string = normalized.oldString;
      } else if ("before" in normalized) {
        normalized.old_string = normalized.before;
      }
    }
    if (!("new_string" in normalized)) {
      if ("newString" in normalized) {
        normalized.new_string = normalized.newString;
      } else if ("after" in normalized) {
        normalized.new_string = normalized.after;
      }
    }
  }

  // Map 'query' to 'pattern' for Glob tool (OpenCode uses /find/file with query param)
  if (toolName === "Glob") {
    if ("query" in normalized && !("pattern" in normalized)) {
      normalized.pattern = normalized.query;
    }
  }

  return normalized;
}

/**
 * Generate a structuredPatch array from before/after file content.
 * Returns format expected by AgentEditTool: Array<{ lines: string[] }>
 */
function generateStructuredPatch(
  filePath: string,
  before: string,
  after: string,
): Array<{ lines: string[] }> {
  const patch = structuredPatch(filePath, filePath, before, after, "", "", {
    context: 3,
  });
  return patch.hunks.map((hunk) => ({ lines: hunk.lines }));
}

/**
 * Type guard for TextPart
 */
function isTextPart(part: Part): part is TextPart {
  return part.type === "text";
}

/**
 * Type guard for ToolPart
 */
function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool";
}

/**
 * State that can be persisted across transformer invocations
 */
export interface TransformerState {
  emittedDiffKeys: Set<string>;
}

/**
 * Transformer result with transform generator and state accessor
 */
export interface TransformerResult {
  transform: (event: OpenCodeEvent) => Generator<UIMessageChunk>;
  getState: () => TransformerState;
}

/**
 * Creates a transformer that converts OpenCode SSE events to UIMessageChunk format.
 * This allows OpenCode responses to be rendered using the same UI components as Claude.
 *
 * OpenCode event types (from SSE stream):
 * - message.part.updated: Text or tool part updates (streaming)
 * - session.status: Session status changes (idle, busy, retry)
 * - session.updated: Session info updates
 * - session.error: Session errors
 * - permission.updated: Permission request updates
 *
 * @param initialState - Optional initial state for resuming deduplication across turns
 */
export function createOpenCodeTransformer(
  initialState?: Partial<TransformerState>,
): TransformerResult {
  let started = false;
  let startTime: number | null = null;

  // Track session ID
  let sessionId: string | null = null;

  // Track text streaming
  let currentTextId: string | null = null;
  let currentTextContent = "";

  // Track tool calls
  const emittedToolIds = new Set<string>();
  const toolInputBuffers = new Map<string, string>();

  // Track emitted diff files to deduplicate repeated session.diff events
  // Key: "sessionId:file:contentHash" to detect same file with same content per session
  // Initialize from passed state to persist across message turns
  const emittedDiffKeys = initialState?.emittedDiffKeys ?? new Set<string>();

  // Track questions for answer transformation
  // Maps question ID to array of question texts
  const pendingQuestions = new Map<string, string[]>();

  // Track latest assistant message for token/cost metadata
  let latestAssistantMessage: {
    cost?: number;
    tokens?: {
      input: number;
      output: number;
      reasoning: number;
      cache: { read: number; write: number };
    };
  } | null = null;

  const genId = () =>
    `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Helper to end current text block
  function* endTextBlock(): Generator<UIMessageChunk> {
    if (currentTextId) {
      yield { type: "text-end", id: currentTextId };
      currentTextId = null;
      currentTextContent = "";
    }
  }

  const transform = function* (
    event: OpenCodeEvent,
  ): Generator<UIMessageChunk> {
    // Emit start once
    if (!started) {
      started = true;
      startTime = Date.now();
      yield { type: "start" };
      yield { type: "start-step" };
    }

    // Get event type as string for handling new v2 event types not in v1 union
    const eventType = (event as { type: string }).type;

    // Handle question events (v2 events not in v1 Event union type)
    if (eventType === "question.asked") {
      const questionEvent = event as unknown as EventQuestionAsked;
      const { id, questions } = questionEvent.properties;

      // Store question texts for later answer transformation
      pendingQuestions.set(
        id,
        questions.map((q) => q.question),
      );

      const mappedQuestions = questions.map((q) => ({
        question: q.question,
        header: q.header,
        options: q.options.map((opt) => ({
          label: opt.label,
          description: opt.description,
        })),
        multiSelect: q.multiple ?? false,
      }));

      // Emit tool-input-available to create the tool part for rendering
      yield {
        type: "tool-input-available",
        toolCallId: id,
        toolName: "AskUserQuestion",
        input: { questions: mappedQuestions },
      };

      // Emit ask-user-question to show the dialog
      yield {
        type: "ask-user-question",
        toolUseId: id,
        questions: mappedQuestions,
      };
      return;
    }

    if (eventType === "question.replied") {
      const replyEvent = event as unknown as EventQuestionReplied;
      const { requestID, answers } = replyEvent.properties;

      // Transform string[][] answers to Record<string, string> format
      // UI expects { "question text": "answer1, answer2" }
      const questionTexts = pendingQuestions.get(requestID);
      const answersRecord: Record<string, string> = {};

      if (questionTexts) {
        answers.forEach((answerArray, index) => {
          const questionText = questionTexts[index] || `Question ${index + 1}`;
          // Join multiple answers with comma (for multi-select)
          answersRecord[questionText] = answerArray.join(", ");
        });
        // Clean up stored questions
        pendingQuestions.delete(requestID);
      } else {
        // Fallback if we don't have the questions stored
        answers.forEach((answerArray, index) => {
          answersRecord[`Question ${index + 1}`] = answerArray.join(", ");
        });
      }

      // Emit tool-output-available to update the tool part with result
      yield {
        type: "tool-output-available",
        toolCallId: requestID,
        output: { answers: answersRecord },
      };

      // Emit ask-user-question-result for real-time UI update
      yield {
        type: "ask-user-question-result",
        toolUseId: requestID,
        result: { answers: answersRecord },
      };
      return;
    }

    if (eventType === "question.rejected") {
      const rejectEvent = event as unknown as EventQuestionRejected;
      const { requestID } = rejectEvent.properties;

      // Clean up stored questions
      pendingQuestions.delete(requestID);

      // Emit tool-output-error to update the tool part
      yield {
        type: "tool-output-error",
        toolCallId: requestID,
        errorText: "Skipped",
      };

      // Emit ask-user-question-result for real-time UI update
      yield {
        type: "ask-user-question-result",
        toolUseId: requestID,
        result: "Skipped",
      };
      return;
    }

    switch (event.type) {
      // ===== MESSAGE PART UPDATED (main streaming event) =====
      case "message.part.updated": {
        const msgEvent = event as EventMessagePartUpdated;
        const part = msgEvent.properties.part;
        const delta = msgEvent.properties.delta;

        // Capture session ID from part
        if ("sessionID" in part && part.sessionID) {
          sessionId = part.sessionID;
        }

        if (isTextPart(part)) {
          // Text streaming
          if (!currentTextId) {
            currentTextId = genId();
            yield { type: "text-start", id: currentTextId };
          }

          // Use delta if provided, otherwise compute from text
          const textDelta = delta ?? part.text.slice(currentTextContent.length);

          if (textDelta) {
            yield { type: "text-delta", id: currentTextId, delta: textDelta };
            currentTextContent += textDelta;
          }
        } else if (isToolPart(part)) {
          // Tool call starting/in-progress
          yield* endTextBlock();

          const toolId = part.callID || part.id;
          const toolName = normalizeToolName(part.tool || "unknown");

          if (!emittedToolIds.has(toolId)) {
            yield {
              type: "tool-input-start",
              toolCallId: toolId,
              toolName,
            };
            emittedToolIds.add(toolId);
            toolInputBuffers.set(toolId, "");
          }

          // Stream tool input if available
          const state: ToolState = part.state;
          if (state && "input" in state && state.input) {
            const argsStr =
              typeof state.input === "string"
                ? state.input
                : JSON.stringify(state.input, null, 2);

            const prevInput = toolInputBuffers.get(toolId) || "";
            const inputDelta = argsStr.slice(prevInput.length);

            if (inputDelta) {
              yield {
                type: "tool-input-delta",
                toolCallId: toolId,
                inputTextDelta: inputDelta,
              };
              toolInputBuffers.set(toolId, argsStr);
            }
          }

          // Check if tool is complete
          if (state.status === "completed") {
            const normalizedInput = normalizeToolInput(
              toolName,
              (state.input || {}) as Record<string, unknown>,
            );
            yield {
              type: "tool-input-available",
              toolCallId: toolId,
              toolName,
              input: normalizedInput,
            };

            // Generate structuredPatch for Write/Edit tools to enable proper diff rendering
            // Transform Grep/Glob output to include numFiles from metadata
            let toolOutput: string | object = state.output || "";
            if (toolName === "Grep" || toolName === "Glob") {
              const metadata = (state.metadata || {}) as Record<
                string,
                unknown
              >;
              // OpenCode uses "matches" for Grep, "count" for Glob
              const count = metadata.matches ?? metadata.count ?? 0;
              toolOutput = {
                output: state.output || "",
                numFiles: typeof count === "number" ? count : 0,
              };
            } else if (toolName === "Write" || toolName === "Edit") {
              const filePath = (normalizedInput.file_path as string) || "";
              if (toolName === "Write") {
                const content = (normalizedInput.content as string) || "";
                const patches = generateStructuredPatch(filePath, "", content);
                toolOutput = { structuredPatch: patches };
              } else {
                // Edit mode - generate diff from old_string/new_string
                const oldString = (normalizedInput.old_string as string) || "";
                const newString = (normalizedInput.new_string as string) || "";
                const patches = generateStructuredPatch(
                  filePath,
                  oldString,
                  newString,
                );
                toolOutput = { structuredPatch: patches };
              }
            }

            yield {
              type: "tool-output-available",
              toolCallId: toolId,
              output: toolOutput,
            };

            // Track completed Write/Edit tools to deduplicate against session.diff
            if (toolName === "Write" || toolName === "Edit") {
              // Use normalized file path to match session.diff format
              const stateWithTitle = state as { title?: string };
              const rawPath = stateWithTitle.title || normalizedInput.file_path;
              const dedupFilePath =
                rawPath && typeof rawPath === "string"
                  ? normalizeFilePath(rawPath)
                  : null;
              if (dedupFilePath) {
                // Reuse the same strings used for structuredPatch generation
                const beforeStr =
                  toolName === "Write"
                    ? ""
                    : String(normalizedInput.old_string || "");
                const afterStr =
                  toolName === "Write"
                    ? String(normalizedInput.content || "")
                    : String(normalizedInput.new_string || "");
                const contentHash = createHash("md5")
                  .update(`${beforeStr}|${afterStr}`)
                  .digest("hex");
                const effectiveSessionId = sessionId || "unknown";
                const diffKey = `${effectiveSessionId}:${dedupFilePath}:${contentHash}`;
                emittedDiffKeys.add(diffKey);
                logger.info(
                  `Tracked tool completion for dedup: ${dedupFilePath} (session: ${effectiveSessionId})`,
                );
              }
            }
          } else if (state.status === "error") {
            yield {
              type: "tool-input-available",
              toolCallId: toolId,
              toolName,
              input: normalizeToolInput(
                toolName,
                (state.input || {}) as Record<string, unknown>,
              ),
            };
            yield {
              type: "tool-output-error",
              toolCallId: toolId,
              errorText: state.error || "Tool execution failed",
            };
          }
        } else if (part.type === "step-start") {
          // New step starting - end text block
          yield* endTextBlock();
        } else if (part.type === "step-finish") {
          // Step finished
          yield* endTextBlock();
          yield { type: "finish-step" };
        } else if (part.type === "reasoning") {
          // Reasoning/thinking content
          yield* endTextBlock();
          const reasoningPart = part as {
            id: string;
            text: string;
            type: "reasoning";
          };
          yield {
            type: "reasoning",
            id: reasoningPart.id,
            text: reasoningPart.text || "",
          };
        } else if (part.type === "subtask") {
          // Subtask delegation - currently informational
          yield* endTextBlock();
          const subtaskPart = part as { prompt?: string; description?: string };
          logger.info(
            `Subtask: ${subtaskPart.description || subtaskPart.prompt || "unknown"}`,
          );
        } else if (part.type === "snapshot") {
          // State snapshot - informational
          logger.info(`Snapshot captured`);
        } else if (part.type === "patch") {
          // File patch - could trigger diff refresh in future
          const patchPart = part as { files?: string[] };
          logger.info(`Patch: ${patchPart.files?.length || 0} files`);
        } else if (part.type === "agent") {
          // Agent delegation
          yield* endTextBlock();
          const agentPart = part as { name?: string };
          logger.info(`Agent: ${agentPart.name || "unknown"}`);
        } else if (part.type === "retry") {
          // Retry attempt - informational
          const retryPart = part as unknown as {
            attempt?: number;
            error?: { data?: { message?: string } };
          };
          const errorMsg = retryPart.error?.data?.message || "unknown error";
          logger.info(`Retry attempt ${retryPart.attempt || "?"}: ${errorMsg}`);
        } else if (part.type === "compaction") {
          yield* endTextBlock();
          const compactionPart = part as { auto?: boolean };
          logger.info(
            `Compaction occurred (auto: ${compactionPart.auto ?? true})`,
          );
          const compactId = `compact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          yield {
            type: "system-Compact",
            toolCallId: compactId,
            state: "output-available",
          };
        }
        break;
      }

      // ===== SESSION STATUS =====
      case "session.status": {
        const statusEvent = event as EventSessionStatus;
        const { sessionID, status } = statusEvent.properties;

        // Capture session ID
        if (sessionID) {
          sessionId = sessionID;
        }

        if (status.type === "idle") {
          yield* endTextBlock();
          pendingQuestions.clear(); // Clean up orphaned questions on finish

          const metadata: MessageMetadata = {
            sessionId: sessionId || sessionID || undefined,
            durationMs: startTime ? Date.now() - startTime : undefined,
            resultSubtype: "success",
            // Include emittedDiffKeys for persistence across turns
            emittedDiffKeys: Array.from(emittedDiffKeys),
            // Token/cost data from message.updated event
            inputTokens: latestAssistantMessage?.tokens?.input,
            outputTokens: latestAssistantMessage?.tokens?.output,
            totalTokens: latestAssistantMessage?.tokens
              ? latestAssistantMessage.tokens.input +
                latestAssistantMessage.tokens.output
              : undefined,
            totalCostUsd: latestAssistantMessage?.cost,
            cachedInputTokens: latestAssistantMessage?.tokens?.cache?.read,
            reasoningTokens: latestAssistantMessage?.tokens?.reasoning,
          };

          yield { type: "message-metadata", messageMetadata: metadata };
          yield { type: "finish-step" };
          yield { type: "finish", messageMetadata: metadata };
        }
        break;
      }

      // ===== SESSION UPDATED =====
      case "session.updated": {
        const updatedEvent = event as EventSessionUpdated;
        const session = updatedEvent.properties.info;

        // Capture session ID
        if (session?.id) {
          sessionId = session.id;
        }
        break;
      }

      // ===== SESSION ERROR =====
      case "session.error": {
        const errorEvent = event as EventSessionError;
        const { sessionID, error } = errorEvent.properties;

        if (sessionID) {
          sessionId = sessionID;
        }

        yield* endTextBlock();
        pendingQuestions.clear(); // Clean up orphaned questions on error

        // Use SDK error type discrimination instead of string matching
        if (error && "name" in error) {
          const errorName = (error as { name: string }).name;

          if (errorName === "ProviderAuthError") {
            const authError = error as ProviderAuthError;
            yield {
              type: "auth-error",
              errorText: authError.data?.message || "Authentication failed",
            };
          } else if (errorName === "APIError") {
            const apiError = error as ApiError;
            // Check for auth-related status codes
            if (
              apiError.data?.statusCode === 401 ||
              apiError.data?.statusCode === 403
            ) {
              yield {
                type: "auth-error",
                errorText: apiError.data?.message || "Unauthorized",
              };
            } else {
              yield {
                type: "error",
                errorText: apiError.data?.message || "API error",
              };
            }
          } else if (errorName === "MessageAbortedError") {
            // User cancelled - not really an error
            yield { type: "error", errorText: "Message aborted" };
          } else {
            // UnknownError or other
            const unknownError = error as { data?: { message?: string } };
            yield {
              type: "error",
              errorText: unknownError.data?.message || "Unknown error",
            };
          }
        } else if (error) {
          // Fallback for errors without name property
          let errorMessage = "OpenCode session failed";
          const errorAny = error as unknown as Record<string, unknown>;
          if (typeof errorAny.message === "string") {
            errorMessage = errorAny.message;
          }
          yield { type: "error", errorText: errorMessage };
        } else {
          yield { type: "error", errorText: "OpenCode session failed" };
        }

        yield { type: "finish-step" };
        yield { type: "finish" };
        break;
      }

      // ===== PERMISSION UPDATED =====
      case "permission.updated": {
        const permEvent = event as EventPermissionUpdated;
        const { id, title } = permEvent.properties;

        // Map to ask-user-question format
        yield {
          type: "ask-user-question",
          toolUseId: id,
          questions: [
            {
              question: title,
              header: "Permission",
              options: [
                { label: "Allow", description: "Grant this permission" },
                { label: "Deny", description: "Deny this permission" },
              ],
              multiSelect: false,
            },
          ],
        };
        break;
      }

      // ===== PERMISSION REPLIED =====
      case "permission.replied": {
        const replyEvent = event as EventPermissionReplied;
        const { permissionID, response } = replyEvent.properties;
        yield {
          type: "ask-user-question-result",
          toolUseId: permissionID,
          result: response,
        };
        break;
      }

      // ===== FILE EDITED =====
      case "file.edited": {
        const fileEvent = event as EventFileEdited;
        // Informational - files are already shown via tool output
        logger.info(`File edited: ${fileEvent.properties.file}`);
        break;
      }

      // ===== SESSION DIFF =====
      case "session.diff": {
        const diffEvent = event as EventSessionDiff;
        const { diff } = diffEvent.properties;

        // Only emit session-diff for sidebar refresh
        // Tool UI parts are already created by message.part.updated when tools complete
        yield {
          type: "session-diff",
          diffs: diff.map((d) => ({
            file: d.file,
            additions: d.additions,
            deletions: d.deletions,
          })),
        };
        break;
      }

      // ===== TODO UPDATED =====
      case "todo.updated": {
        const todoEvent = event as EventTodoUpdated;
        const { todos } = todoEvent.properties;

        // Emit todo update for UI to sync with AgentTodoTool
        // Note: SDK Todo type has content, status, priority - activeForm may be added later
        yield {
          type: "todo-update",
          todos: todos.map((todo) => {
            const todoAny = todo as unknown as {
              content: string;
              status: string;
              activeForm?: string;
            };
            return {
              content: todoAny.content,
              status: todoAny.status as "pending" | "in_progress" | "completed",
              activeForm: todoAny.activeForm,
            };
          }),
        };
        break;
      }

      // ===== VCS BRANCH UPDATED =====
      case "vcs.branch.updated": {
        const branchEvent = event as EventVcsBranchUpdated;
        logger.info(`Branch updated: ${branchEvent.properties.branch}`);
        break;
      }

      // ===== NO-OP EVENTS (acknowledge without action) =====
      case "session.idle":
      case "session.compacted":
      case "session.created":
      case "session.deleted":
      case "message.removed":
      case "message.part.removed":
      case "command.executed":
        // These events don't need UI representation
        break;

      // ===== MESSAGE UPDATED (contains final token/cost data) =====
      case "message.updated": {
        // SDK type: EventMessageUpdated.properties.info is Message (UserMessage | AssistantMessage)
        const msgEvent = event as unknown as {
          properties: {
            info: {
              role?: string;
              cost?: number;
              tokens?: {
                input: number;
                output: number;
                reasoning: number;
                cache: { read: number; write: number };
              };
            };
          };
        };
        const msg = msgEvent.properties.info;
        if (msg?.role === "assistant" && msg.tokens) {
          latestAssistantMessage = {
            cost: msg.cost,
            tokens: msg.tokens,
          };
        }
        break;
      }

      default: {
        // Unknown event type - log for debugging
        const eventType = (event as { type: string }).type;
        if (eventType !== "file.watcher.updated") {
          logger.info(`Unhandled event type: ${eventType}`);
        }
      }
    }
  };

  return {
    transform,
    getState: () => ({ emittedDiffKeys }),
  };
}

/**
 * Helper to convert raw SSE data to OpenCodeEvent
 */
export function parseSSEEvent(
  eventType: string,
  data: string,
): OpenCodeEvent | null {
  try {
    const properties = JSON.parse(data);
    return { type: eventType, properties } as unknown as OpenCodeEvent;
  } catch (error) {
    logger.error("Failed to parse SSE event:", error);
    return null;
  }
}
