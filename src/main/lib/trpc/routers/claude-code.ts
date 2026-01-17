import { shell } from "electron";
import { z } from "zod";
import { publicProcedure, router } from "../index";

/**
 * Claude Code router for desktop
 * Uses CLI-based authentication - users run `claude login` in terminal
 */
export const claudeCodeRouter = router({
  /**
   * Check integration status
   * Always returns connected since we rely on CLI authentication
   */
  getIntegration: publicProcedure.query(() => {
    return {
      isConnected: true,
      source: "cli" as const,
    };
  }),

  /**
   * Disconnect is a no-op - users should run `claude logout` in terminal
   */
  disconnect: publicProcedure.mutation(() => {
    console.log(
      "[ClaudeCode] Disconnect requested - users should run 'claude logout' in terminal",
    );
    return {
      success: true,
      message: "Run 'claude logout' in your terminal to sign out",
    };
  }),

  /**
   * Open URL in browser (kept for utility)
   */
  openOAuthUrl: publicProcedure
    .input(z.string())
    .mutation(async ({ input: url }) => {
      await shell.openExternal(url);
      return { success: true };
    }),

  /**
   * Stub: Start authentication flow
   * Desktop uses CLI auth - this is a stub for compatibility
   */
  startAuth: publicProcedure.mutation(() => {
    return {
      sandboxId: "desktop",
      sandboxUrl: "",
      sessionId: "desktop",
    };
  }),

  /**
   * Stub: Poll authentication status
   * Desktop uses CLI auth - this is a stub for compatibility
   */
  pollStatus: publicProcedure.query(() => {
    return {
      state: "connected",
      oauthUrl: null as string | null,
    };
  }),

  /**
   * Stub: Submit authentication code
   * Desktop uses CLI auth - this is a stub for compatibility
   */
  submitCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .mutation(() => {
      return { success: true };
    }),
});
