import { z } from "zod"
import { shell } from "electron"
import { router, publicProcedure } from "../index"

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
    }
  }),

  /**
   * Disconnect is a no-op - users should run `claude logout` in terminal
   */
  disconnect: publicProcedure.mutation(() => {
    console.log("[ClaudeCode] Disconnect requested - users should run 'claude logout' in terminal")
    return {
      success: true,
      message: "Run 'claude logout' in your terminal to sign out",
    }
  }),

  /**
   * Open URL in browser (kept for utility)
   */
  openOAuthUrl: publicProcedure
    .input(z.string())
    .mutation(async ({ input: url }) => {
      await shell.openExternal(url)
      return { success: true }
    }),
})
