/**
 * RalphOrchestrator - Encapsulates all Ralph-specific streaming logic.
 *
 * Phases:
 *   "planning" - No PRD exists; run in plan mode to generate a plan, then convert to PRD.
 *   "executing" - PRD exists; inject story context and detect completion signals.
 */

import type { UIMessageChunk } from "@shared/types";
import type { ProviderId } from "../providers/types";
import { getRalphService, type UserStory } from "./index";
import {
  isGitCommitOutput,
  parseCommitOutput,
  parseProgressBlock,
} from "./parser";
import { generatePrdFromPlan } from "./prd-generator";
import {
  buildRalphPlanningPrompt,
  buildRalphSystemPrompt,
  checkForCompletion,
} from "./prompt";

export interface RalphOrchestratorConfig {
  chatId: string;
  subChatId: string;
  cwd: string;
  providerId: ProviderId;
  originalPrompt: string;
  existingMessages: any[];
}

export interface RalphStreamDecision {
  effectiveMode: "plan" | "agent";
  modifiedPrompt: string;
}

export class RalphOrchestrator {
  private phase: "planning" | "executing" = "planning";
  private capturedPlanText: string | null = null;
  private exitPlanModeCallId: string | null = null;
  private planCompleted = false;
  private autoContinueNextStory: UserStory | null = null;
  private lastCompletedStoryId: string | null = null;

  private config: RalphOrchestratorConfig;
  private emit: (chunk: UIMessageChunk) => void;

  constructor(
    config: RalphOrchestratorConfig,
    emit: (chunk: UIMessageChunk) => void,
  ) {
    this.config = config;
    this.emit = emit;
  }

  /**
   * Determine phase and compute the effective mode + prompt for the provider.
   * Called BEFORE starting the provider stream.
   */
  prepareStream(): RalphStreamDecision {
    const ralphService = getRalphService();
    const prd = ralphService.getPrd(this.config.subChatId);

    if (!prd) {
      // No PRD → planning phase
      this.phase = "planning";

      const hasAssistantResponse = this.config.existingMessages.some(
        (msg: any) => msg.role === "assistant",
      );

      if (!hasAssistantResponse) {
        const useExitPlanMode =
          !this.config.providerId || this.config.providerId === "claude";
        const planningPrompt = buildRalphPlanningPrompt(useExitPlanMode);
        return {
          effectiveMode: "plan",
          modifiedPrompt: `${planningPrompt}\n\nFeature to implement:\n${this.config.originalPrompt}`,
        };
      }

      // Continuing planning conversation (user answered a question)
      return {
        effectiveMode: "plan",
        modifiedPrompt: this.config.originalPrompt,
      };
    }

    // PRD exists → executing phase
    this.phase = "executing";
    const progressText = ralphService.getProgressText(this.config.subChatId);
    const currentIteration = ralphService.getCurrentIteration(
      this.config.subChatId,
    );
    const ralphPrompt = buildRalphSystemPrompt(
      prd,
      progressText,
      currentIteration,
    );

    return {
      effectiveMode: "agent",
      modifiedPrompt: `${ralphPrompt}\n\n---\n\nUser message: ${this.config.originalPrompt}`,
    };
  }

  /**
   * Process each chunk during streaming.
   * Tracks plan completion signals and git commits.
   */
  processChunk(chunk: UIMessageChunk): void {
    switch (chunk.type) {
      case "text-delta":
        break;

      case "tool-input-available":
        if (this.phase === "planning" && chunk.toolName === "ExitPlanMode") {
          this.exitPlanModeCallId = chunk.toolCallId;
          console.log(
            `[ralph] ExitPlanMode detected callId=${chunk.toolCallId}`,
          );
        }
        break;

      case "tool-output-available":
        // Capture plan text from ExitPlanMode
        if (
          this.phase === "planning" &&
          this.exitPlanModeCallId &&
          chunk.toolCallId === this.exitPlanModeCallId
        ) {
          const output = chunk.output as any;
          if (output?.plan) {
            this.capturedPlanText = output.plan;
            this.planCompleted = true;
            console.log(
              `[ralph] Captured plan text (${this.capturedPlanText?.length} chars)`,
            );
          }
        }

        // Detect git commits during execution
        if (this.phase === "executing") {
          this.checkGitCommit(chunk.output);
        }
        break;
    }
  }

  /**
   * Whether the stream should be aborted after plan completion.
   */
  shouldAbortAfterPlanComplete(): boolean {
    return this.planCompleted;
  }

  /**
   * Post-stream processing: PRD generation or story completion detection.
   */
  async finalize(
    accumulatedParts: any[],
    abortController: AbortController,
  ): Promise<void> {
    if (this.phase === "planning") {
      await this.finalizePlanning(accumulatedParts, abortController);
    } else {
      this.finalizeExecution(accumulatedParts);
    }
  }

  /**
   * Whether the orchestrator wants to auto-continue with the next story.
   */
  shouldAutoContinue(): boolean {
    return this.autoContinueNextStory !== null;
  }

  /**
   * Get the next story to auto-continue with.
   */
  getNextContinuationStory(): UserStory | null {
    return this.autoContinueNextStory;
  }

  /**
   * Get the last completed story ID (for transition events).
   */
  getLastCompletedStoryId(): string | null {
    return this.lastCompletedStoryId;
  }

  /**
   * Reset internal state for the next continuation iteration.
   */
  resetForContinuation(): void {
    this.capturedPlanText = null;
    this.exitPlanModeCallId = null;
    this.planCompleted = false;
    this.autoContinueNextStory = null;
    this.lastCompletedStoryId = null;
  }

  /**
   * Update config for continuation iteration with new prompt and messages.
   */
  updateForContinuation(prompt: string, messages: any[]): void {
    this.config.originalPrompt = prompt;
    this.config.existingMessages = messages;
  }

  /**
   * Build the continuation message for a story (used by the backend loop).
   */
  buildContinuationMessage(nextStory: UserStory): string {
    const acceptanceCriteria =
      nextStory.acceptanceCriteria?.join("\n  - ") || "";
    const storyType = nextStory.type || "implementation";

    let instructions: string;
    if (storyType === "research") {
      instructions =
        "This is a **RESEARCH** story. Analyze the codebase and output your findings as markdown directly in this chat. Do NOT create code files to store research - just output text findings. Mark complete when done.";
    } else {
      instructions =
        "Create the branch if needed, implement the changes, run quality checks, and commit when done.";
    }

    return `Continue with story **${nextStory.id}: ${nextStory.title}**

**Type:** ${storyType.toUpperCase()}

**Description:** ${nextStory.description}

**Acceptance Criteria:**
  - ${acceptanceCriteria}

${instructions} Remember to output \`<story-complete>${nextStory.id}</story-complete>\` when finished.`;
  }

  // ─── Private ────────────────────────────────────────────────────────

  private async finalizePlanning(
    accumulatedParts: any[],
    abortController: AbortController,
  ): Promise<void> {
    // Check for ---PLAN_READY--- marker if ExitPlanMode wasn't used
    if (!this.capturedPlanText) {
      const fullText = this.getFullText(accumulatedParts);
      const marker = "---PLAN_READY---";
      if (fullText.includes(marker)) {
        const markerIndex = fullText.lastIndexOf(marker);
        this.capturedPlanText = fullText.substring(0, markerIndex).trim();
        console.log(
          "[ralph] Detected PLAN_READY marker, captured plan text:",
          this.capturedPlanText?.substring(0, 200),
        );
      }
    }

    if (!this.capturedPlanText) {
      // No plan captured yet - agent may still be asking questions
      console.log("[ralph] No plan captured yet, waiting for next turn");
      return;
    }

    // Generate PRD from plan
    console.log("[ralph] Generating PRD from plan...");
    this.emit({
      type: "ralph-prd-generating",
      message: "Generating structured PRD from plan...",
    } as UIMessageChunk);

    try {
      const prd = await generatePrdFromPlan(
        this.capturedPlanText,
        this.config.originalPrompt,
        this.config.providerId,
        this.config.chatId,
        this.config.subChatId,
        this.config.cwd,
        abortController,
      );

      const ralphService = getRalphService();
      ralphService.savePrd(this.config.subChatId, prd);

      console.log(
        "[ralph] PRD generated:",
        prd.goal,
        "stories:",
        prd.stories.length,
      );

      // Set auto-continue to first story
      const nextStory = ralphService.getNextStory(prd);
      if (nextStory) {
        this.autoContinueNextStory = nextStory;
      }

      this.emit({
        type: "ralph-prd-generated",
        prd,
        autoStartImplementation: !!nextStory,
      } as UIMessageChunk);
    } catch (e) {
      console.error("[ralph] Failed to generate PRD:", e);
      this.emit({
        type: "error",
        errorText: `Failed to generate PRD: ${e instanceof Error ? e.message : String(e)}`,
      } as UIMessageChunk);
    }
  }

  private finalizeExecution(accumulatedParts: any[]): void {
    const fullText = this.getFullText(accumulatedParts);
    if (!fullText.trim()) return;

    const ralphService = getRalphService();

    // 1. Check for full completion signal
    if (checkForCompletion(fullText)) {
      console.log("[ralph] Detected <promise>COMPLETE</promise> signal");
      const prd = ralphService.getPrd(this.config.subChatId);
      if (prd) {
        for (const story of prd.stories) {
          if (!story.passes) {
            ralphService.markStoryComplete(this.config.subChatId, story.id);
          }
        }
      }
      this.emit({ type: "ralph-complete" } as UIMessageChunk);
      return;
    }

    // 2. Parse progress block
    const progress = parseProgressBlock(fullText);

    // 3. Check for story completion tag (use last match)
    const storyCompleteMatches = [
      ...fullText.matchAll(/<story-complete>([^<]+)<\/story-complete>/g),
    ];
    const storyCompleteMatch =
      storyCompleteMatches.length > 0
        ? storyCompleteMatches[storyCompleteMatches.length - 1]
        : null;

    if (storyCompleteMatch) {
      const completedStoryId = storyCompleteMatch[1].trim();
      this.lastCompletedStoryId = completedStoryId;
      console.log("[ralph] Detected <story-complete>:", completedStoryId);

      // Check if already handled by git commit detection
      const prdBefore = ralphService.getPrd(this.config.subChatId);
      const alreadyComplete =
        prdBefore?.stories.find((s) => s.id === completedStoryId)?.passes ??
        false;

      ralphService.markStoryComplete(this.config.subChatId, completedStoryId);

      const prd = ralphService.getPrd(this.config.subChatId);
      const hasMoreStories = prd?.stories.some((s) => !s.passes) ?? false;

      if (!alreadyComplete) {
        // Save progress
        const completedStory = prd?.stories.find(
          (s) => s.id === completedStoryId,
        );
        if (completedStory) {
          if (progress && progress.storyId === completedStoryId) {
            ralphService.appendProgress(this.config.subChatId, {
              storyId: completedStoryId,
              iteration: ralphService.getCurrentIteration(
                this.config.subChatId,
              ),
              summary: progress.summary,
              learnings: progress.learnings,
            });
          } else {
            ralphService.appendProgress(this.config.subChatId, {
              storyId: completedStoryId,
              iteration: ralphService.getCurrentIteration(
                this.config.subChatId,
              ),
              summary: `Completed: ${completedStory.title}`,
              learnings: [],
            });
          }
        }

        // Set auto-continue if more stories remain
        if (hasMoreStories) {
          const nextStory = ralphService.getNextStory(prd!);
          if (nextStory) {
            this.autoContinueNextStory = nextStory;
          }
        }

        this.emit({
          type: "ralph-story-complete",
          storyId: completedStoryId,
          autoStartNext: hasMoreStories,
        } as UIMessageChunk);

        if (!hasMoreStories) {
          this.emit({ type: "ralph-complete" } as UIMessageChunk);
        }
      } else {
        console.log("[ralph] Story already completed (likely via git commit)");
      }
    } else if (progress) {
      // Standalone progress block (no story-complete tag)
      console.log("[ralph] Standalone progress for story:", progress.storyId);
      ralphService.appendProgress(this.config.subChatId, {
        storyId: progress.storyId,
        iteration: ralphService.getCurrentIteration(this.config.subChatId),
        summary: progress.summary,
        learnings: progress.learnings,
      });
      this.emit({
        type: "ralph-progress",
        storyId: progress.storyId,
        summary: progress.summary,
        learnings: progress.learnings,
      } as UIMessageChunk);
    }
  }

  private checkGitCommit(output: unknown): void {
    let toolOutput: string;
    if (typeof output === "string") {
      toolOutput = output;
    } else {
      try {
        toolOutput = JSON.stringify(output);
      } catch {
        return;
      }
    }

    if (!isGitCommitOutput(toolOutput)) return;

    const commitInfo = parseCommitOutput(toolOutput);
    if (!commitInfo?.storyId) return;

    console.log(`[ralph] Detected git commit for story: ${commitInfo.storyId}`);
    this.lastCompletedStoryId = commitInfo.storyId;
    const ralphService = getRalphService();
    const success = ralphService.markStoryComplete(
      this.config.subChatId,
      commitInfo.storyId,
    );

    if (!success) return;

    const prd = ralphService.getPrd(this.config.subChatId);
    const hasMoreStories = prd?.stories.some((s) => !s.passes) ?? false;

    // Auto-generate progress entry
    const completedStory = prd?.stories.find(
      (s) => s.id === commitInfo.storyId,
    );
    if (completedStory) {
      ralphService.appendProgress(this.config.subChatId, {
        storyId: commitInfo.storyId,
        iteration: ralphService.getCurrentIteration(this.config.subChatId),
        summary: `Completed: ${completedStory.title}`,
        learnings: [],
      });
    }

    // Set auto-continue if more stories remain
    if (hasMoreStories) {
      const nextStory = ralphService.getNextStory(prd!);
      if (nextStory) {
        this.autoContinueNextStory = nextStory;
      }
    }

    this.emit({
      type: "ralph-story-complete",
      storyId: commitInfo.storyId,
      autoStartNext: hasMoreStories,
    } as UIMessageChunk);

    if (!hasMoreStories) {
      this.emit({ type: "ralph-complete" } as UIMessageChunk);
    }
  }

  private getFullText(accumulatedParts: any[]): string {
    return accumulatedParts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("\n");
  }
}
