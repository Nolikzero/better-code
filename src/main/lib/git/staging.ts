import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import {
  gitCheckoutFile,
  gitStageAll,
  gitStageFile,
  gitUnstageAll,
  gitUnstageFile,
  secureFs,
} from "./security";

export const createStagingRouter = () => {
  return router({
    stageFile: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          filePath: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await gitStageFile(input.worktreePath, input.filePath);
        return { success: true };
      }),

    unstageFile: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          filePath: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await gitUnstageFile(input.worktreePath, input.filePath);
        return { success: true };
      }),

    discardChanges: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          filePath: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await gitCheckoutFile(input.worktreePath, input.filePath);
        return { success: true };
      }),

    stageAll: publicProcedure
      .input(z.object({ worktreePath: z.string() }))
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await gitStageAll(input.worktreePath);
        return { success: true };
      }),

    unstageAll: publicProcedure
      .input(z.object({ worktreePath: z.string() }))
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await gitUnstageAll(input.worktreePath);
        return { success: true };
      }),

    deleteUntracked: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          filePath: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await secureFs.delete(input.worktreePath, input.filePath);
        return { success: true };
      }),

    // Batch discard changes for multiple files
    discardChangesBatch: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          files: z.array(
            z.object({
              filePath: z.string(),
              isNew: z.boolean(),
            }),
          ),
        }),
      )
      .mutation(
        async ({ input }): Promise<{ success: boolean; errors: string[] }> => {
          const errors: string[] = [];

          for (const file of input.files) {
            try {
              if (file.isNew) {
                // Delete untracked file
                await secureFs.delete(input.worktreePath, file.filePath);
              } else {
                // Checkout tracked file (discard changes)
                await gitCheckoutFile(input.worktreePath, file.filePath);
              }
            } catch (error) {
              errors.push(
                `${file.filePath}: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
            }
          }

          return { success: errors.length === 0, errors };
        },
      ),
  });
};
