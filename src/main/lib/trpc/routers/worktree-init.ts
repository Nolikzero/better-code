import { observable } from "@trpc/server/observable";
import { z } from "zod";
import {
  type WorktreeInitEvent,
  worktreeInitRunner,
} from "../../worktree/init-runner";
import { publicProcedure, router } from "../index";

export const worktreeInitRouter = router({
  /**
   * Get current init status for a chat
   */
  getStatus: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(({ input }) => {
      return worktreeInitRunner.getStatus(input.chatId) ?? null;
    }),

  /**
   * Subscribe to init progress updates
   */
  watchProgress: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .subscription(({ input }) => {
      return observable<WorktreeInitEvent>((emit) => {
        const handler = (event: WorktreeInitEvent) => {
          if (event.chatId === input.chatId) {
            emit.next(event);
            if (event.type === "complete" || event.type === "error") {
              emit.complete();
            }
          }
        };

        worktreeInitRunner.on("init-progress", handler);

        // Emit current status immediately if running
        const status = worktreeInitRunner.getStatus(input.chatId);
        if (status?.status === "running" && status.output) {
          emit.next({
            type: "output",
            chatId: input.chatId,
            data: status.output,
          });
        }

        return () => {
          worktreeInitRunner.off("init-progress", handler);
        };
      });
    }),

  /**
   * Clear init status for a chat
   */
  clearStatus: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .mutation(({ input }) => {
      worktreeInitRunner.clearStatus(input.chatId);
    }),
});
