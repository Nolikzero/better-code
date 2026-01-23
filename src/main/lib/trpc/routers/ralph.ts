import { z } from "zod";
import {
  getRalphService,
  type ProgressEntry,
  type RalphPrdData,
  type UserStory,
} from "../../ralph";
import { publicProcedure, router } from "../index";

// Zod schemas for validation
const userStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.number(),
  acceptanceCriteria: z.array(z.string()),
  passes: z.boolean().default(false),
  notes: z.string().optional(),
  type: z.enum(["research", "implementation"]).optional(),
});

const prdSchema = z.object({
  branchName: z.string(),
  goal: z.string(),
  stories: z.array(userStorySchema),
});

const progressEntrySchema = z.object({
  storyId: z.string(),
  iteration: z.number(),
  summary: z.string(),
  learnings: z.array(z.string()),
});

export const ralphRouter = router({
  /**
   * Get Ralph state (PRD + progress) for a chat
   */
  getState: publicProcedure
    .input(z.object({ subChatId: z.string() }))
    .query(({ input }) => {
      const service = getRalphService();
      const prd = service.getPrd(input.subChatId);
      const progress = service.getProgress(input.subChatId);
      const currentIteration = service.getCurrentIteration(input.subChatId);

      if (!prd) {
        return {
          hasPrd: false,
          prd: null,
          progress: [],
          currentIteration: 1,
          stats: { completed: 0, total: 0 },
          nextStory: null,
          isComplete: false,
        };
      }

      return {
        hasPrd: true,
        prd,
        progress,
        currentIteration,
        stats: service.getStats(prd),
        nextStory: service.getNextStory(prd),
        isComplete: service.isComplete(prd),
      };
    }),

  /**
   * Initialize or update PRD for a chat
   */
  savePrd: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        prd: prdSchema,
      }),
    )
    .mutation(({ input }) => {
      const service = getRalphService();
      service.savePrd(input.subChatId, input.prd as RalphPrdData);
      return { success: true };
    }),

  /**
   * Mark a story as complete
   */
  markStoryComplete: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        storyId: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const service = getRalphService();
      service.markStoryComplete(input.subChatId, input.storyId);
      return { success: true };
    }),

  /**
   * Mark a story as incomplete
   */
  markStoryIncomplete: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        storyId: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const service = getRalphService();
      service.markStoryIncomplete(input.subChatId, input.storyId);
      return { success: true };
    }),

  /**
   * Update a single story
   */
  updateStory: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        story: userStorySchema,
      }),
    )
    .mutation(({ input }) => {
      const service = getRalphService();
      const prd = service.getPrd(input.subChatId);
      if (!prd) {
        throw new Error("No PRD found for this sub-chat");
      }

      const updatedStories = prd.stories.map((story) =>
        story.id === input.story.id ? (input.story as UserStory) : story,
      );

      service.savePrd(input.subChatId, { ...prd, stories: updatedStories });
      return { success: true };
    }),

  /**
   * Add a new story to the PRD
   */
  addStory: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        story: userStorySchema,
      }),
    )
    .mutation(({ input }) => {
      const service = getRalphService();
      const prd = service.getPrd(input.subChatId);
      if (!prd) {
        throw new Error("No PRD found for this sub-chat");
      }

      const updatedStories = [...prd.stories, input.story as UserStory];
      service.savePrd(input.subChatId, { ...prd, stories: updatedStories });
      return { success: true };
    }),

  /**
   * Remove a story from the PRD
   */
  removeStory: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        storyId: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const service = getRalphService();
      const prd = service.getPrd(input.subChatId);
      if (!prd) {
        throw new Error("No PRD found for this sub-chat");
      }

      const updatedStories = prd.stories.filter(
        (story) => story.id !== input.storyId,
      );
      service.savePrd(input.subChatId, { ...prd, stories: updatedStories });
      return { success: true };
    }),

  /**
   * Append a progress entry
   */
  appendProgress: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        entry: progressEntrySchema,
      }),
    )
    .mutation(({ input }) => {
      const service = getRalphService();
      service.appendProgress(input.subChatId, input.entry as ProgressEntry);
      return { success: true };
    }),

  /**
   * Get progress text (for display or injection)
   */
  getProgressText: publicProcedure
    .input(z.object({ subChatId: z.string() }))
    .query(({ input }) => {
      const service = getRalphService();
      return service.getProgressText(input.subChatId);
    }),
});
