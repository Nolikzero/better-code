import type { UIMessageChunk } from "@shared/types";
import { observable } from "@trpc/server/observable";
import { eq } from "drizzle-orm";
import { BrowserWindow } from "electron";
import * as fs from "fs/promises";
import * as os from "os";
import path from "path";
import { z } from "zod";
import { chats, getDatabase, subChats } from "../../db";
import { computeAllStats } from "../../db/computed-stats";
import { chatStatsEmitter } from "../../events";
import { providerRegistry } from "../../providers/registry";
import type { ProviderId } from "../../providers/types";
import { getRalphService } from "../../ralph";
import { RalphOrchestrator } from "../../ralph/orchestrator";
import { publicProcedure, router } from "../index";
import { buildAgentsOption } from "./agent-utils";

/**
 * Parse @[agent:name], @[skill:name], and @[tool:name] mentions from prompt text
 * Returns the cleaned prompt and lists of mentioned agents/skills/tools
 */
function parseMentions(prompt: string): {
  cleanedPrompt: string;
  agentMentions: string[];
  skillMentions: string[];
  fileMentions: string[];
  folderMentions: string[];
  toolMentions: string[];
} {
  const agentMentions: string[] = [];
  const skillMentions: string[] = [];
  const fileMentions: string[] = [];
  const folderMentions: string[] = [];
  const toolMentions: string[] = [];

  const mentionRegex = /@\[(file|folder|skill|agent|tool):([^\]]+)\]/g;
  let match;

  while ((match = mentionRegex.exec(prompt)) !== null) {
    const [, type, name] = match;
    switch (type) {
      case "agent":
        agentMentions.push(name);
        break;
      case "skill":
        skillMentions.push(name);
        break;
      case "file":
        fileMentions.push(name);
        break;
      case "folder":
        folderMentions.push(name);
        break;
      case "tool":
        if (/^[a-zA-Z0-9_-]+$/.test(name)) {
          toolMentions.push(name);
        }
        break;
    }
  }

  let cleanedPrompt = prompt
    .replace(/@\[agent:[^\]]+\]/g, "")
    .replace(/@\[skill:[^\]]+\]/g, "")
    .replace(/@\[tool:[^\]]+\]/g, "")
    .trim();

  if (toolMentions.length > 0) {
    const toolHints = toolMentions
      .map((t) => `Use the ${t} tool for this request.`)
      .join(" ");
    cleanedPrompt = `${toolHints}\n\n${cleanedPrompt}`;
  }

  return {
    cleanedPrompt,
    agentMentions,
    skillMentions,
    fileMentions,
    folderMentions,
    toolMentions,
  };
}

/**
 * Build the final prompt with skill/agent instructions
 */
function buildFinalPrompt(
  cleanedPrompt: string,
  agentMentions: string[],
  skillMentions: string[],
): string {
  let finalPrompt = cleanedPrompt;

  if (!finalPrompt.trim()) {
    if (agentMentions.length > 0 && skillMentions.length > 0) {
      finalPrompt = `Use the ${agentMentions.join(", ")} agent(s) and invoke the "${skillMentions.join('", "')}" skill(s) using the Skill tool for this task.`;
    } else if (agentMentions.length > 0) {
      finalPrompt = `Use the ${agentMentions.join(", ")} agent(s) for this task.`;
    } else if (skillMentions.length > 0) {
      finalPrompt = `Invoke the "${skillMentions.join('", "')}" skill(s) using the Skill tool for this task.`;
    }
  } else if (skillMentions.length > 0) {
    finalPrompt = `${finalPrompt}\n\nUse the "${skillMentions.join('", "')}" skill(s) for this task.`;
  }

  return finalPrompt;
}

// Track pending tool approvals (shared between Claude's canUseTool callback and respondToolApproval endpoint)
const pendingToolApprovals = new Map<
  string,
  {
    subChatId: string;
    resolve: (decision: {
      approved: boolean;
      message?: string;
      updatedInput?: unknown;
    }) => void;
  }
>();

// Track pending OpenCode questions (different from Claude's Promise-based flow)
const pendingOpenCodeQuestions = new Map<
  string,
  {
    questionId: string;
    directory?: string;
    questions: Array<{
      question: string;
      header: string;
      options: Array<{ label: string; description: string }>;
      multiSelect: boolean;
    }>;
  }
>();

/**
 * Register a pending OpenCode question for response routing
 * Called by OpenCode provider when yielding ask-user-question chunks
 */
export function registerPendingOpenCodeQuestion(
  toolUseId: string,
  questionId: string,
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>,
  directory?: string,
): void {
  pendingOpenCodeQuestions.set(toolUseId, { questionId, questions, directory });
}

const clearPendingApprovals = (message: string, subChatId?: string) => {
  for (const [toolUseId, pending] of pendingToolApprovals) {
    if (subChatId && pending.subChatId !== subChatId) continue;
    pending.resolve({ approved: false, message });
    pendingToolApprovals.delete(toolUseId);
  }
};

/**
 * Create the AskUserQuestion callback for Claude's canUseTool.
 * Emits question to UI, waits for response, updates accumulated parts.
 */
function createAskUserQuestionCallback(
  subChatId: string,
  safeEmit: (chunk: UIMessageChunk) => boolean,
  parts: any[],
): (
  toolUseId: string,
  questions: unknown[],
) => Promise<{ approved: boolean; message?: string; updatedInput?: unknown }> {
  return async (toolUseId: string, questions: unknown[]) => {
    // Emit to UI
    safeEmit({
      type: "ask-user-question",
      toolUseId,
      questions,
    } as UIMessageChunk);

    // Wait for response (60s timeout)
    const response = await new Promise<{
      approved: boolean;
      message?: string;
      updatedInput?: unknown;
    }>((resolve) => {
      const timeoutId = setTimeout(() => {
        pendingToolApprovals.delete(toolUseId);
        safeEmit({
          type: "ask-user-question-timeout",
          toolUseId,
        } as UIMessageChunk);
        resolve({ approved: false, message: "Timed out" });
      }, 60000);

      pendingToolApprovals.set(toolUseId, {
        subChatId,
        resolve: (d) => {
          clearTimeout(timeoutId);
          resolve(d);
        },
      });
    });

    // Update accumulated parts
    const askToolPart = parts.find(
      (p) => p.toolCallId === toolUseId && p.type === "tool-AskUserQuestion",
    );

    if (!response.approved) {
      const errorMessage = response.message || "Skipped";
      if (askToolPart) {
        askToolPart.result = errorMessage;
        askToolPart.state = "result";
      }
      safeEmit({
        type: "ask-user-question-result",
        toolUseId,
        result: errorMessage,
      } as UIMessageChunk);
    } else {
      const answers = (response.updatedInput as any)?.answers;
      const answerResult = { answers };
      if (askToolPart) {
        askToolPart.result = answerResult;
        askToolPart.state = "result";
      }
      safeEmit({
        type: "ask-user-question-result",
        toolUseId,
        result: answerResult,
      } as UIMessageChunk);
    }

    return response;
  };
}

// Image attachment schema
const imageAttachmentSchema = z.object({
  base64Data: z.string(),
  mediaType: z.string(),
  filename: z.string().optional(),
});

export const chatRouter = router({
  /**
   * Stream chat - handles all providers (Claude, Codex, OpenCode)
   */
  chat: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        chatId: z.string(),
        prompt: z.string(),
        cwd: z.string(),
        projectPath: z.string().optional(),
        mode: z.enum(["plan", "agent", "ralph"]).default("agent"),
        sessionId: z.string().optional(),
        model: z.string().optional(),
        maxThinkingTokens: z.number().optional(),
        images: z.array(imageAttachmentSchema).optional(),
        providerId: z.enum(["claude", "codex", "opencode"]).optional(),
        addDirs: z.array(z.string()).optional(),
        // Codex-specific settings
        sandboxMode: z
          .enum(["read-only", "workspace-write", "danger-full-access"])
          .optional(),
        approvalPolicy: z
          .enum(["never", "on-request", "untrusted", "on-failure"])
          .optional(),
        reasoningEffort: z
          .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
          .optional(),
        // Codex SDK enhancement options
        outputSchema: z.record(z.string(), z.unknown()).optional(),
        networkAccessEnabled: z.boolean().optional(),
        webSearchMode: z.enum(["disabled", "cached", "live"]).optional(),
      }),
    )
    .subscription(({ input }) => {
      return observable<UIMessageChunk>((emit) => {
        const abortController = new AbortController();
        const streamId = crypto.randomUUID();

        const subId = input.subChatId.slice(-8);
        const streamStart = Date.now();
        let chunkCount = 0;
        let lastChunkType = "";
        console.log(
          `[SD] M:START sub=${subId} stream=${streamId.slice(-8)} mode=${input.mode}`,
        );

        let isObservableActive = true;

        const safeEmit = (chunk: UIMessageChunk) => {
          if (!isObservableActive) return false;
          try {
            // Tag every chunk with source subChatId for frontend ownership verification
            emit.next({
              ...chunk,
              _subChatId: input.subChatId,
            } as unknown as UIMessageChunk);
            return true;
          } catch {
            isObservableActive = false;
            return false;
          }
        };

        const safeComplete = () => {
          try {
            emit.complete();
          } catch {
            // Already completed
          }
        };

        const emitError = (error: unknown, context: string) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`[claude] ${context}:`, errorMessage);

          safeEmit({
            type: "error",
            errorText: `${context}: ${errorMessage}`,
            ...(process.env.NODE_ENV !== "production" && {
              debugInfo: {
                context,
                cwd: input.cwd,
                mode: input.mode,
              },
            }),
          } as UIMessageChunk);
        };

        (async () => {
          try {
            const db = getDatabase();

            // 1. Get existing messages from DB
            const existing = db
              .select()
              .from(subChats)
              .where(eq(subChats.id, input.subChatId))
              .get();

            console.log(
              `[SD] M:LOAD sub=${subId} messages=${existing?.messages ? "found" : "none"}`,
            );

            let existingMessages = [];

            try {
              existingMessages = existing?.messages
                ? JSON.parse(existing.messages)
                : [];
            } catch (e) {
              console.warn(
                `[chat] Failed to parse existing messages JSON for subChatId=${input.subChatId}:`,
                e,
              );
            }

            const existingSessionId = existing?.sessionId || null;

            let existingEmittedDiffKeys: string[] = [];

            try {
              existingEmittedDiffKeys = existing?.emittedDiffKeys
                ? JSON.parse(existing.emittedDiffKeys)
                : [];
            } catch (e) {
              console.warn(
                `[chat] Failed to parse existing emittedDiffKeys JSON for subChatId=${input.subChatId}:`,
                e,
              );
            }

            // Check for duplicate user message
            const lastMsg = existingMessages[existingMessages.length - 1];
            const isDuplicate =
              lastMsg?.role === "user" &&
              lastMsg?.parts?.[0]?.text === input.prompt;

            // 2. Create user message and save BEFORE streaming
            let userMessage: any;
            let messagesToSave: any[];

            if (isDuplicate) {
              userMessage = lastMsg;
              messagesToSave = existingMessages;
            } else {
              userMessage = {
                id: crypto.randomUUID(),
                role: "user",
                parts: [{ type: "text", text: input.prompt }],
              };
              messagesToSave = [...existingMessages, userMessage];

              const { fileStats, hasPendingPlanApproval } =
                computeAllStats(messagesToSave);

              db.update(subChats)
                .set({
                  messages: JSON.stringify(messagesToSave),
                  streamId,
                  updatedAt: new Date(),
                  hasPendingPlanApproval,
                  fileAdditions: fileStats.additions,
                  fileDeletions: fileStats.deletions,
                  fileCount: fileStats.fileCount,
                })
                .where(eq(subChats.id, input.subChatId))
                .run();
            }

            // 3. Ralph orchestration
            let orchestrator: RalphOrchestrator | null = null;
            let effectiveMode: "plan" | "agent" | "ralph" = input.mode;
            let modifiedPrompt = input.prompt;

            if (input.mode === "ralph") {
              orchestrator = new RalphOrchestrator(
                {
                  chatId: input.chatId,
                  subChatId: input.subChatId,
                  cwd: input.cwd,
                  providerId: (input.providerId || "claude") as ProviderId,
                  originalPrompt: input.prompt,
                  existingMessages,
                },
                safeEmit,
              );
              const decision = orchestrator.prepareStream();
              effectiveMode = decision.effectiveMode;
              modifiedPrompt = decision.modifiedPrompt;
              // Store enhanced prompt in user message for history consistency
              userMessage.parts[0].text = modifiedPrompt;
              // Notify frontend to update in-memory Chat message
              safeEmit({
                type: "ralph-prompt-injected",
                text: modifiedPrompt,
              } as UIMessageChunk);
            }

            // 4. Get provider
            const providerId = input.providerId || "claude";
            const provider = providerRegistry.get(providerId as ProviderId);

            if (!provider) {
              emitError(
                new Error(`Provider '${providerId}' not found`),
                "Provider not found",
              );
              safeEmit({ type: "finish" } as UIMessageChunk);
              safeComplete();
              return;
            }

            console.log(
              `[SD] M:PROVIDER_START sub=${subId} provider=${providerId}`,
            );

            // 5. Preprocessing: parse mentions and build prompt (first iteration only)
            const { cleanedPrompt, agentMentions, skillMentions } =
              parseMentions(orchestrator ? modifiedPrompt : input.prompt);

            // Build agents option (for Claude SDK agent registration)
            const agentsOption = await buildAgentsOption(
              agentMentions,
              input.cwd,
            );

            if (agentMentions.length > 0) {
              console.log(
                "[claude] Registering agents via SDK:",
                Object.keys(agentsOption),
              );
            }
            if (skillMentions.length > 0) {
              console.log("[claude] Skills mentioned:", skillMentions);
            }

            // 6. Load provider-specific config (MCP servers, etc.)
            const lookupPath = input.projectPath || input.cwd;
            const providerConfig =
              await provider.getProviderConfig?.(lookupPath);

            // Build final prompt
            const finalPrompt = orchestrator
              ? modifiedPrompt
              : buildFinalPrompt(cleanedPrompt, agentMentions, skillMentions);

            // 7. Accumulation state
            const parts: any[] = [];
            let currentText = "";
            let metadata: any = {};
            let planCompleted = false;
            const suppressedStreamingTools = new Set<string>();

            // 8. Stream from provider
            try {
              for await (const chunk of provider.chat({
                subChatId: input.subChatId,
                chatId: input.chatId,
                prompt: finalPrompt,
                cwd: input.cwd,
                projectPath: input.projectPath,
                mode: effectiveMode === "ralph" ? "agent" : effectiveMode,
                sessionId: input.sessionId || existingSessionId || undefined,
                model: input.model,
                maxThinkingTokens: input.maxThinkingTokens,
                abortController,
                addDirs: input.addDirs,
                images: input.images,
                // Claude-specific options
                mcpServers: providerConfig?.mcpServers,
                agents:
                  Object.keys(agentsOption).length > 0
                    ? agentsOption
                    : undefined,
                onAskUserQuestion: createAskUserQuestionCallback(
                  input.subChatId,
                  safeEmit,
                  parts,
                ),
                onFileChanged: (filePath, toolType, subChatId) => {
                  const windows = BrowserWindow.getAllWindows();
                  for (const win of windows) {
                    win.webContents.send("file-changed", {
                      filePath,
                      type: toolType,
                      subChatId,
                    });
                  }
                },
                onStderr: (data) => {
                  console.error("[claude stderr]", data);
                },
                // Codex-specific options
                sandboxMode: input.sandboxMode,
                approvalPolicy: input.approvalPolicy,
                reasoningEffort: input.reasoningEffort,
                outputSchema: input.outputSchema,
                networkAccessEnabled: input.networkAccessEnabled,
                webSearchMode: input.webSearchMode,
                // OpenCode-specific
                emittedDiffKeys: existingEmittedDiffKeys,
              })) {
                if (abortController.signal.aborted) break;

                chunkCount++;
                lastChunkType = chunk.type;

                // Ralph orchestration: track plan/story signals
                orchestrator?.processChunk(chunk);

                // Suppress Edit/Write tool input streaming for performance
                if (
                  chunk.type === "tool-input-start" &&
                  (chunk.toolName === "Edit" || chunk.toolName === "Write")
                ) {
                  suppressedStreamingTools.add(chunk.toolCallId);
                  continue;
                }
                if (
                  chunk.type === "tool-input-delta" &&
                  suppressedStreamingTools.has(chunk.toolCallId)
                ) {
                  continue;
                }

                // Emit to frontend
                if (!safeEmit(chunk)) {
                  console.log(
                    `[SD] M:EMIT_CLOSED sub=${subId} type=${chunk.type}`,
                  );
                  break;
                }

                // Accumulate based on chunk type
                switch (chunk.type) {
                  case "text-delta":
                    currentText += chunk.delta;
                    break;
                  case "text-end":
                    if (currentText.trim()) {
                      parts.push({ type: "text", text: currentText });
                      currentText = "";
                    }
                    break;
                  case "tool-input-available": {
                    const existingTool = parts.find(
                      (p: any) =>
                        p.type?.startsWith("tool-") &&
                        p.toolCallId === chunk.toolCallId,
                    );
                    if (existingTool) {
                      existingTool.input = chunk.input;
                      existingTool.state = "call";
                    } else {
                      parts.push({
                        type: `tool-${chunk.toolName}`,
                        toolCallId: chunk.toolCallId,
                        toolName: chunk.toolName,
                        input: chunk.input,
                        state: "call",
                      });
                    }
                    break;
                  }
                  case "tool-output-available": {
                    const toolPart = parts.find(
                      (p: any) =>
                        p.type?.startsWith("tool-") &&
                        p.toolCallId === chunk.toolCallId,
                    );
                    if (toolPart) {
                      toolPart.result = chunk.output;
                      toolPart.state = "result";
                    }

                    // Abort stream if plan is complete (Ralph planning phase)
                    if (orchestrator?.shouldAbortAfterPlanComplete()) {
                      planCompleted = true;
                      abortController.abort();
                    }
                    break;
                  }
                  case "message-metadata":
                    metadata = { ...metadata, ...chunk.messageMetadata };
                    break;
                  case "system-Compact": {
                    const existingCompact = parts.find(
                      (p: any) =>
                        p.type === "system-Compact" &&
                        p.toolCallId === chunk.toolCallId,
                    );
                    if (existingCompact) {
                      existingCompact.state = chunk.state;
                    } else {
                      parts.push({
                        type: "system-Compact",
                        toolCallId: chunk.toolCallId,
                        state: chunk.state,
                      });
                    }
                    break;
                  }
                }

                if (planCompleted) break;
                if (!isObservableActive) {
                  console.log(`[SD] M:OBSERVER_CLOSED_STREAM sub=${subId}`);
                  break;
                }
              }

              // Flush remaining text
              if (currentText.trim()) {
                parts.push({ type: "text", text: currentText });
              }

              // Ralph post-stream processing
              if (orchestrator) {
                const prdAbort = new AbortController();
                await orchestrator.finalize(parts, prdAbort);
              }

              // 9. Save to DB
              if (parts.length > 0) {
                const assistantMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  parts,
                  metadata,
                };
                const finalMessages = [...messagesToSave, assistantMessage];

                const { fileStats, hasPendingPlanApproval } =
                  computeAllStats(finalMessages);

                const resolvedSessionId =
                  metadata.sessionId || existingSessionId || undefined;

                db.update(subChats)
                  .set({
                    messages: JSON.stringify(finalMessages),
                    sessionId: resolvedSessionId,
                    streamId: null,
                    updatedAt: new Date(),
                    hasPendingPlanApproval,
                    fileAdditions: fileStats.additions,
                    fileDeletions: fileStats.deletions,
                    fileCount: fileStats.fileCount,
                    ...(metadata.emittedDiffKeys && {
                      emittedDiffKeys: JSON.stringify(metadata.emittedDiffKeys),
                    }),
                  })
                  .where(eq(subChats.id, input.subChatId))
                  .run();
                db.update(chats)
                  .set({ updatedAt: new Date() })
                  .where(eq(chats.id, input.chatId))
                  .run();

                chatStatsEmitter.emitStatsUpdate({
                  type: "file-stats",
                  chatId: input.chatId,
                  subChatId: input.subChatId,
                });
              } else {
                db.update(subChats)
                  .set({
                    sessionId:
                      metadata.sessionId || existingSessionId || undefined,
                    streamId: null,
                    updatedAt: new Date(),
                  })
                  .where(eq(subChats.id, input.subChatId))
                  .run();
              }

              // Ralph: signal frontend to auto-continue with next story
              if (orchestrator?.shouldAutoContinue()) {
                const nextStory = orchestrator.getNextContinuationStory();
                if (nextStory) {
                  const completedStoryId =
                    orchestrator.getLastCompletedStoryId() || "";
                  const continuationMessage =
                    orchestrator.buildContinuationMessage(nextStory);
                  const ralphService = getRalphService();
                  const prd = ralphService.getPrd(input.subChatId);
                  const stats = prd
                    ? ralphService.getStats(prd)
                    : { completed: 0, total: 0 };

                  safeEmit({
                    type: "ralph-story-transition",
                    completedStoryId,
                    nextStoryId: nextStory.id,
                    nextStoryTitle: nextStory.title,
                    storiesCompleted: stats.completed,
                    storiesTotal: stats.total,
                  } as UIMessageChunk);

                  safeEmit({
                    type: "ralph-auto-continue",
                    nextStoryId: nextStory.id,
                    nextStoryTitle: nextStory.title,
                    continuationMessage,
                    completedStoryId,
                  } as UIMessageChunk);
                }
              }
            } catch (streamError) {
              // Save accumulated parts even on error
              console.log(
                `[SD] M:CATCH_SAVE sub=${subId} aborted=${abortController.signal.aborted} parts=${parts.length}`,
              );
              if (currentText.trim()) {
                parts.push({ type: "text", text: currentText });
              }
              if (parts.length > 0) {
                const assistantMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  parts,
                  metadata,
                };
                const finalMessages = [...messagesToSave, assistantMessage];

                const { fileStats, hasPendingPlanApproval } =
                  computeAllStats(finalMessages);

                db.update(subChats)
                  .set({
                    messages: JSON.stringify(finalMessages),
                    sessionId:
                      metadata.sessionId || existingSessionId || undefined,
                    streamId: null,
                    updatedAt: new Date(),
                    hasPendingPlanApproval,
                    fileAdditions: fileStats.additions,
                    fileDeletions: fileStats.deletions,
                    fileCount: fileStats.fileCount,
                  })
                  .where(eq(subChats.id, input.subChatId))
                  .run();
                db.update(chats)
                  .set({ updatedAt: new Date() })
                  .where(eq(chats.id, input.chatId))
                  .run();

                chatStatsEmitter.emitStatsUpdate({
                  type: "file-stats",
                  chatId: input.chatId,
                  subChatId: input.subChatId,
                });
              }

              if (!abortController.signal.aborted) {
                emitError(streamError, `${providerId} provider error`);
              }
            }

            // Update parent chat timestamp
            db.update(chats)
              .set({ updatedAt: new Date() })
              .where(eq(chats.id, input.chatId))
              .run();

            const duration = ((Date.now() - streamStart) / 1000).toFixed(1);
            const reason = planCompleted ? "plan_complete" : "ok";
            console.log(
              `[SD] M:END sub=${subId} reason=${reason} n=${chunkCount} last=${lastChunkType} t=${duration}s`,
            );
            safeEmit({ type: "finish" } as UIMessageChunk);
            safeComplete();
          } catch (error) {
            const duration = ((Date.now() - streamStart) / 1000).toFixed(1);
            console.log(
              `[SD] M:END sub=${subId} reason=unexpected_error n=${chunkCount} t=${duration}s`,
            );
            emitError(error, "Unexpected error");
            safeEmit({ type: "finish" } as UIMessageChunk);
            safeComplete();
          }
        })();

        // Cleanup on unsubscribe
        return () => {
          console.log(`[SD] M:CLEANUP sub=${subId}`);
          isObservableActive = false;
          abortController.abort();
          clearPendingApprovals("Session ended.", input.subChatId);

          // Clear streamId on abort so conversation can be resumed
          const db = getDatabase();
          db.update(subChats)
            .set({ streamId: null })
            .where(eq(subChats.id, input.subChatId))
            .run();
        };
      });
    }),

  /**
   * Get MCP servers configuration for a project
   */
  getMcpConfig: publicProcedure
    .input(
      z.object({
        projectPath: z.string(),
        providerId: z.enum(["claude", "codex", "opencode"]).default("claude"),
      }),
    )
    .query(async ({ input }) => {
      const { projectPath, providerId } = input;

      try {
        const provider = providerRegistry.get(providerId as ProviderId);
        if (!provider?.getProviderConfig) {
          // Fallback: read ~/.claude.json directly for Claude
          if (providerId === "claude") {
            return await readClaudeMcpConfig(projectPath, providerId);
          }
          return { mcpServers: [], projectPath, providerId };
        }

        const config = await provider.getProviderConfig(projectPath);
        if (!config?.mcpServers) {
          return { mcpServers: [], projectPath, providerId };
        }

        const mcpServers = Object.entries(config.mcpServers).map(
          ([name, serverConfig]) => ({
            name,
            status: "pending" as const,
            config: serverConfig as Record<string, unknown>,
          }),
        );

        return { mcpServers, projectPath, providerId };
      } catch (error) {
        console.error("[getMcpConfig] Error reading config:", error);
        return {
          mcpServers: [],
          projectPath,
          providerId,
          error: String(error),
        };
      }
    }),

  /**
   * Cancel active session
   */
  cancel: publicProcedure
    .input(z.object({ subChatId: z.string() }))
    .mutation(({ input }) => {
      for (const provider of providerRegistry.getAll()) {
        if (provider.isActive(input.subChatId)) {
          provider.cancel(input.subChatId);
          clearPendingApprovals("Session cancelled.", input.subChatId);
          return { cancelled: true };
        }
      }
      return { cancelled: false };
    }),

  /**
   * Check if session is active
   */
  isActive: publicProcedure
    .input(z.object({ subChatId: z.string() }))
    .query(({ input }) => {
      for (const provider of providerRegistry.getAll()) {
        if (provider.isActive(input.subChatId)) return true;
      }
      return false;
    }),

  respondToolApproval: publicProcedure
    .input(
      z.object({
        toolUseId: z.string(),
        approved: z.boolean(),
        message: z.string().optional(),
        updatedInput: z.unknown().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // First check if this is an OpenCode question
      const openCodeQuestion = pendingOpenCodeQuestions.get(input.toolUseId);
      if (openCodeQuestion) {
        pendingOpenCodeQuestions.delete(input.toolUseId);

        const { replyToQuestion, rejectQuestion } = await import(
          "../../providers/opencode/client"
        );

        if (input.approved) {
          const updatedInput = input.updatedInput as {
            questions?: Array<{ header: string }>;
            answers?: Record<string, string | string[]>;
          };
          const answers = updatedInput?.answers || {};

          const answersArray: string[][] = openCodeQuestion.questions.map(
            (q, i) => {
              const answer =
                answers[q.question] ||
                answers[`q${i}`] ||
                answers[q.header] ||
                [];
              if (Array.isArray(answer)) {
                return answer as string[];
              }
              if (typeof answer === "string" && answer) {
                return answer
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
              }
              return [];
            },
          );

          console.log("[opencode] Replying to question:", {
            questionId: openCodeQuestion.questionId,
            directory: openCodeQuestion.directory,
            answersArray,
            rawAnswers: answers,
          });

          const success = await replyToQuestion(
            openCodeQuestion.questionId,
            answersArray,
            openCodeQuestion.directory,
          );
          return { ok: success };
        }

        const success = await rejectQuestion(
          openCodeQuestion.questionId,
          openCodeQuestion.directory,
        );
        return { ok: success };
      }

      // Claude flow - resolve pending Promise
      const pending = pendingToolApprovals.get(input.toolUseId);
      if (!pending) {
        return { ok: false };
      }
      pending.resolve({
        approved: input.approved,
        message: input.message,
        updatedInput: input.updatedInput,
      });
      pendingToolApprovals.delete(input.toolUseId);
      return { ok: true };
    }),
});

/**
 * Fallback: read MCP config directly from ~/.claude.json
 * Used when provider.getProviderConfig is not available
 */
async function readClaudeMcpConfig(projectPath: string, providerId: string) {
  const claudeJsonPath = path.join(os.homedir(), ".claude.json");

  const exists = await fs
    .stat(claudeJsonPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    return { mcpServers: [], projectPath, providerId };
  }

  const configContent = await fs.readFile(claudeJsonPath, "utf-8");
  const config = JSON.parse(configContent);
  const projectConfig = config.projects?.[projectPath];

  if (!projectConfig?.mcpServers) {
    return { mcpServers: [], projectPath, providerId };
  }

  const mcpServers = Object.entries(projectConfig.mcpServers).map(
    ([name, serverConfig]) => ({
      name,
      status: "pending" as const,
      config: serverConfig as Record<string, unknown>,
    }),
  );

  return { mcpServers, projectPath, providerId };
}
