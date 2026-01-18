import { TRPCError } from "@trpc/server";
import { execSync } from "child_process";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import simpleGit from "simple-git";
import { z } from "zod";
import { chats, getDatabase, projects, subChats } from "../../db";
import {
  createWorktreeForChat,
  fetchGitHostStatus,
  fetchGitHubPRStatus,
  type GitProvider,
  getMergeCommand,
  getWorktreeDiff,
  removeWorktree,
} from "../../git";
import { execWithShellEnv } from "../../git/shell-env";
import { buildClaudeEnv, getClaudeBinaryPath } from "../../providers/claude";
import { publicProcedure, router } from "../index";

// Dynamic import for ESM module
const getClaudeQuery = async () => {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  return sdk.query;
};

/**
 * Read Claude Code CLI OAuth token from macOS Keychain
 */
function getCliOAuthToken(): string | null {
  if (process.platform !== "darwin") return null;

  try {
    const output = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();

    if (!output) return null;

    const credentials = JSON.parse(output);
    const accessToken = credentials?.claudeAiOauth?.accessToken;

    if (accessToken?.startsWith("sk-ant-oat01-")) {
      return accessToken;
    }

    return null;
  } catch {
    return null;
  }
}

// Fallback to truncated user message if AI generation fails
function getFallbackName(userMessage: string): string {
  const trimmed = userMessage.trim();
  if (trimmed.length <= 25) {
    return trimmed || "New Chat";
  }
  return `${trimmed.substring(0, 25)}...`;
}

export const chatsRouter = router({
  /**
   * List all non-archived chats (optionally filter by project)
   */
  list: publicProcedure
    .input(z.object({ projectId: z.string().optional() }))
    .query(({ input }) => {
      const db = getDatabase();
      const conditions = [isNull(chats.archivedAt)];
      if (input.projectId) {
        conditions.push(eq(chats.projectId, input.projectId));
      }
      return db
        .select()
        .from(chats)
        .where(and(...conditions))
        .orderBy(desc(chats.updatedAt))
        .all();
    }),

  /**
   * List archived chats (optionally filter by project)
   */
  listArchived: publicProcedure
    .input(z.object({ projectId: z.string().optional() }))
    .query(({ input }) => {
      const db = getDatabase();
      const conditions = [isNotNull(chats.archivedAt)];
      if (input.projectId) {
        conditions.push(eq(chats.projectId, input.projectId));
      }
      return db
        .select()
        .from(chats)
        .where(and(...conditions))
        .orderBy(desc(chats.archivedAt))
        .all();
    }),

  /**
   * Get a single chat with all sub-chats (optimized single query with JOINs)
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDatabase();

      // Single query with JOINs instead of 3 separate queries
      const rows = db
        .select({
          chat: chats,
          subChat: subChats,
          project: projects,
        })
        .from(chats)
        .leftJoin(subChats, eq(subChats.chatId, chats.id))
        .leftJoin(projects, eq(projects.id, chats.projectId))
        .where(eq(chats.id, input.id))
        .all();

      if (!rows.length || !rows[0].chat) return null;

      const chat = rows[0].chat;
      const project = rows[0].project;

      // Collect and sort sub-chats from joined results
      const chatSubChats = rows
        .filter((row) => row.subChat !== null)
        .map((row) => row.subChat!)
        .sort(
          (a, b) =>
            (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0),
        );

      return { ...chat, subChats: chatSubChats, project };
    }),

  /**
   * Create a new chat with optional git worktree
   */
  create: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().optional(),
        initialMessage: z.string().optional(),
        initialMessageParts: z
          .array(
            z.union([
              z.object({ type: z.literal("text"), text: z.string() }),
              z.object({
                type: z.literal("data-image"),
                data: z.object({
                  url: z.string(),
                  mediaType: z.string().optional(),
                  filename: z.string().optional(),
                  base64Data: z.string().optional(),
                }),
              }),
            ]),
          )
          .optional(),
        baseBranch: z.string().optional(), // Branch to base the worktree off
        useWorktree: z.boolean().default(true), // If false, work directly in project dir
        mode: z.enum(["plan", "agent"]).default("agent"),
        providerId: z.enum(["claude", "codex"]).optional().default("claude"),
      }),
    )
    .mutation(async ({ input }) => {
      console.log("[chats.create] called with:", input);
      const db = getDatabase();

      // Get project path
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .get();
      console.log("[chats.create] found project:", project);
      if (!project) throw new Error("Project not found");

      // Create chat (fast path)
      const chat = db
        .insert(chats)
        .values({
          name: input.name,
          projectId: input.projectId,
          providerId: input.providerId,
        })
        .returning()
        .get();
      console.log("[chats.create] created chat:", chat);

      // Create initial sub-chat with user message (AI SDK format)
      // If initialMessageParts is provided, use it; otherwise fallback to text-only message
      let initialMessages = "[]";

      if (input.initialMessageParts && input.initialMessageParts.length > 0) {
        initialMessages = JSON.stringify([
          {
            id: `msg-${Date.now()}`,
            role: "user",
            parts: input.initialMessageParts,
          },
        ]);
      } else if (input.initialMessage) {
        initialMessages = JSON.stringify([
          {
            id: `msg-${Date.now()}`,
            role: "user",
            parts: [{ type: "text", text: input.initialMessage }],
          },
        ]);
      }

      const subChat = db
        .insert(subChats)
        .values({
          chatId: chat.id,
          mode: input.mode,
          messages: initialMessages,
          providerId: input.providerId,
        })
        .returning()
        .get();
      console.log("[chats.create] created subChat:", subChat);

      // Worktree creation result (will be set if useWorktree is true)
      let worktreeResult: {
        worktreePath?: string;
        branch?: string;
        baseBranch?: string;
      } = {};

      // Only create worktree if useWorktree is true
      if (input.useWorktree) {
        console.log(
          "[chats.create] creating worktree with baseBranch:",
          input.baseBranch,
        );
        const result = await createWorktreeForChat(
          project.path,
          project.id,
          chat.id,
          input.baseBranch,
        );
        console.log("[chats.create] worktree result:", result);

        if (result.success && result.worktreePath) {
          db.update(chats)
            .set({
              worktreePath: result.worktreePath,
              branch: result.branch,
              baseBranch: result.baseBranch,
            })
            .where(eq(chats.id, chat.id))
            .run();
          worktreeResult = {
            worktreePath: result.worktreePath,
            branch: result.branch,
            baseBranch: result.baseBranch,
          };
        } else {
          console.warn(`[Worktree] Failed: ${result.error}`);
          // Fallback to project path
          db.update(chats)
            .set({ worktreePath: project.path })
            .where(eq(chats.id, chat.id))
            .run();
          worktreeResult = { worktreePath: project.path };
        }
      } else {
        // Local mode: use project path directly, no branch info
        console.log("[chats.create] local mode - using project path directly");
        db.update(chats)
          .set({ worktreePath: project.path })
          .where(eq(chats.id, chat.id))
          .run();
        worktreeResult = { worktreePath: project.path };
      }

      const response = {
        ...chat,
        worktreePath: worktreeResult.worktreePath || project.path,
        branch: worktreeResult.branch,
        baseBranch: worktreeResult.baseBranch,
        subChats: [subChat],
      };

      console.log("[chats.create] returning:", response);
      return response;
    }),

  /**
   * Rename a chat
   */
  rename: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(chats)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(chats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Archive a chat
   */
  archive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(chats)
        .set({ archivedAt: new Date() })
        .where(eq(chats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Restore an archived chat
   */
  restore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(chats)
        .set({ archivedAt: null })
        .where(eq(chats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Update the provider for a chat
   */
  updateProvider: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        providerId: z.enum(["claude", "codex"]),
      }),
    )
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(chats)
        .set({ providerId: input.providerId, updatedAt: new Date() })
        .where(eq(chats.id, input.chatId))
        .returning()
        .get();
    }),

  /**
   * Archive multiple chats at once
   */
  archiveBatch: publicProcedure
    .input(z.object({ chatIds: z.array(z.string()) }))
    .mutation(({ input }) => {
      const db = getDatabase();
      if (input.chatIds.length === 0) return [];
      return db
        .update(chats)
        .set({ archivedAt: new Date() })
        .where(inArray(chats.id, input.chatIds))
        .returning()
        .all();
    }),

  /**
   * Delete a chat permanently (with worktree cleanup)
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase();

      // Get chat before deletion
      const chat = db.select().from(chats).where(eq(chats.id, input.id)).get();

      // Cleanup worktree if it was created (has branch = was a real worktree, not just project path)
      if (chat?.worktreePath && chat?.branch) {
        const project = db
          .select()
          .from(projects)
          .where(eq(projects.id, chat.projectId))
          .get();
        if (project) {
          const result = await removeWorktree(project.path, chat.worktreePath);
          if (!result.success) {
            console.warn(`[Worktree] Cleanup failed: ${result.error}`);
          }
        }
      }

      return db.delete(chats).where(eq(chats.id, input.id)).returning().get();
    }),

  // ============ Sub-chat procedures ============

  /**
   * Get a single sub-chat (optimized single query with JOINs)
   */
  getSubChat: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDatabase();

      // Single query with JOINs instead of 3 separate queries
      const row = db
        .select({
          subChat: subChats,
          chat: chats,
          project: projects,
        })
        .from(subChats)
        .leftJoin(chats, eq(chats.id, subChats.chatId))
        .leftJoin(projects, eq(projects.id, chats.projectId))
        .where(eq(subChats.id, input.id))
        .get();

      if (!row?.subChat) return null;

      return {
        ...row.subChat,
        chat: row.chat ? { ...row.chat, project: row.project } : null,
      };
    }),

  /**
   * Create a new sub-chat
   */
  createSubChat: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        name: z.string().optional(),
        mode: z.enum(["plan", "agent"]).default("agent"),
      }),
    )
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .insert(subChats)
        .values({
          chatId: input.chatId,
          name: input.name,
          mode: input.mode,
          messages: "[]",
        })
        .returning()
        .get();
    }),

  /**
   * Update sub-chat messages
   */
  updateSubChatMessages: publicProcedure
    .input(z.object({ id: z.string(), messages: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(subChats)
        .set({ messages: input.messages, updatedAt: new Date() })
        .where(eq(subChats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Update sub-chat session ID (for Claude resume)
   */
  updateSubChatSession: publicProcedure
    .input(z.object({ id: z.string(), sessionId: z.string().nullable() }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(subChats)
        .set({ sessionId: input.sessionId })
        .where(eq(subChats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Update sub-chat mode
   */
  updateSubChatMode: publicProcedure
    .input(z.object({ id: z.string(), mode: z.enum(["plan", "agent"]) }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(subChats)
        .set({ mode: input.mode })
        .where(eq(subChats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Rename a sub-chat
   */
  renameSubChat: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(subChats)
        .set({ name: input.name })
        .where(eq(subChats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Delete a sub-chat
   */
  deleteSubChat: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .delete(subChats)
        .where(eq(subChats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Get git diff for a chat's worktree
   */
  getDiff: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase();
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get();

      if (!chat?.worktreePath) {
        return { diff: null, error: "No worktree path" };
      }

      const result = await getWorktreeDiff(
        chat.worktreePath,
        chat.baseBranch ?? undefined,
      );

      if (!result.success) {
        return { diff: null, error: result.error };
      }

      return { diff: result.diff || "" };
    }),

  /**
   * Generate a name for a sub-chat
   * Uses Claude SDK to generate a concise name, falls back to truncated message
   */
  generateSubChatName: publicProcedure
    .input(
      z.object({
        userMessage: z.string(),
        providerId: z.enum(["claude", "codex"]).optional().default("claude"),
      }),
    )
    .mutation(async ({ input }) => {
      // Only use AI generation for Claude provider
      // Other providers fallback to truncated message
      if (input.providerId !== "claude") {
        return { name: getFallbackName(input.userMessage) };
      }

      try {
        const claudeQuery = await getClaudeQuery();
        const claudeEnv = buildClaudeEnv();
        const binaryResult = getClaudeBinaryPath();
        if (!binaryResult) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Claude Code binary not found. Install via https://claude.ai/install.sh or run 'bun run claude:download'",
          });
        }
        const claudeBinaryPath = binaryResult.path;

        // Get CLI OAuth token from keychain
        const cliOAuthToken = getCliOAuthToken();

        const prompt = `Generate a very short title (2-5 words, max 30 chars) for a chat that starts with this message. Return ONLY the title, no quotes, no explanation:

"${input.userMessage.slice(0, 200)}"`;

        let generatedName = "";
        const abortController = new AbortController();

        // Set a timeout to abort if it takes too long
        const timeout = setTimeout(() => abortController.abort(), 10000);

        try {
          const stream = claudeQuery({
            prompt,
            options: {
              abortController,
              cwd: process.cwd(),
              env: {
                ...claudeEnv,
                ...(cliOAuthToken && {
                  CLAUDE_CODE_OAUTH_TOKEN: cliOAuthToken,
                }),
              },
              maxTurns: 1,
              pathToClaudeCodeExecutable: claudeBinaryPath,
            },
          });

          for await (const msg of stream) {
            // Extract text from assistant messages
            if (msg.type === "assistant" && msg.message?.content) {
              for (const block of msg.message.content) {
                if (block.type === "text") {
                  generatedName += block.text;
                }
              }
            }
          }
        } finally {
          clearTimeout(timeout);
        }

        // Clean up the generated name
        const cleanName = generatedName
          .trim()
          .replace(/^["']|["']$/g, "") // Remove quotes
          .slice(0, 50); // Limit length

        if (cleanName.length > 0) {
          return { name: cleanName };
        }
      } catch (error) {
        console.warn(
          "[generateSubChatName] SDK call failed, using fallback:",
          error,
        );
      }

      return { name: getFallbackName(input.userMessage) };
    }),

  // ============ PR-related procedures ============

  /**
   * Get PR context for message generation (branch info, uncommitted changes, etc.)
   */
  getPrContext: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase();
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get();

      if (!chat?.worktreePath) {
        return null;
      }

      try {
        const git = simpleGit(chat.worktreePath);
        const status = await git.status();

        // Check if upstream exists
        let hasUpstream = false;
        try {
          const tracking = await git.raw([
            "rev-parse",
            "--abbrev-ref",
            "@{upstream}",
          ]);
          hasUpstream = !!tracking.trim();
        } catch {
          hasUpstream = false;
        }

        const project = db
          .select()
          .from(projects)
          .where(eq(projects.id, chat.projectId))
          .get();

        return {
          branch: chat.branch || status.current || "unknown",
          baseBranch: chat.baseBranch || "main",
          uncommittedCount: status.files.length,
          hasUpstream,
          provider: project?.gitProvider as GitProvider | null,
        };
      } catch (error) {
        console.error("[getPrContext] Error:", error);
        return null;
      }
    }),

  /**
   * Update PR info after Claude creates a PR
   */
  updatePrInfo: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        prUrl: z.string(),
        prNumber: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDatabase();
      return db
        .update(chats)
        .set({
          prUrl: input.prUrl,
          prNumber: input.prNumber,
          updatedAt: new Date(),
        })
        .where(eq(chats.id, input.chatId))
        .returning()
        .get();
    }),

  /**
   * Get PR/MR status from GitHub or GitLab (provider-aware)
   */
  getPrStatus: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase();
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get();

      if (!chat?.worktreePath) {
        return null;
      }

      // Get project to determine git provider
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, chat.projectId))
        .get();

      const provider = (project?.gitProvider as GitProvider) || null;

      // Use provider-aware fetch if provider is known
      if (provider) {
        return await fetchGitHostStatus(chat.worktreePath, provider);
      }

      // Fallback to GitHub for backwards compatibility
      return await fetchGitHubPRStatus(chat.worktreePath);
    }),

  /**
   * Merge PR/MR via gh or glab CLI (provider-aware)
   */
  mergePr: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        method: z.enum(["merge", "squash", "rebase"]).default("squash"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get();

      if (!chat?.worktreePath || !chat?.prNumber) {
        throw new Error("No PR/MR to merge");
      }

      // Get project to determine git provider
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, chat.projectId))
        .get();

      const provider = (project?.gitProvider as GitProvider) || null;

      try {
        // Use provider-aware merge command if available
        const mergeCmd = provider
          ? getMergeCommand(provider, chat.prNumber, input.method)
          : null;

        if (mergeCmd) {
          await execWithShellEnv(mergeCmd.command, mergeCmd.args, {
            cwd: chat.worktreePath,
          });
        } else {
          // Fallback to GitHub CLI for backwards compatibility
          await execWithShellEnv(
            "gh",
            [
              "pr",
              "merge",
              String(chat.prNumber),
              `--${input.method}`,
              "--delete-branch",
            ],
            { cwd: chat.worktreePath },
          );
        }
        return { success: true };
      } catch (error) {
        console.error("[mergePr] Error:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to merge PR/MR",
        );
      }
    }),

  /**
   * Get file change statistics for all non-archived chats.
   * Uses computed columns instead of parsing messages JSON for performance.
   */
  getFileStats: publicProcedure
    .input(
      z.object({ openSubChatIds: z.array(z.string()).optional() }).optional(),
    )
    .query(({ input }) => {
      const db = getDatabase();
      const openSubChatIdsSet = input?.openSubChatIds
        ? new Set(input.openSubChatIds)
        : null;

      // Query computed columns directly - no JSON parsing needed
      const rows = db
        .select({
          chatId: chats.id,
          subChatId: subChats.id,
          additions: subChats.fileAdditions,
          deletions: subChats.fileDeletions,
          fileCount: subChats.fileCount,
        })
        .from(chats)
        .leftJoin(subChats, eq(subChats.chatId, chats.id))
        .where(isNull(chats.archivedAt))
        .all()
        // Filter by open sub-chats if provided
        .filter(
          (row) =>
            !openSubChatIdsSet ||
            !row.subChatId ||
            openSubChatIdsSet.has(row.subChatId),
        );

      // Aggregate stats per workspace (chatId)
      const statsMap = new Map<
        string,
        { additions: number; deletions: number; fileCount: number }
      >();

      for (const row of rows) {
        if (!row.chatId) continue;

        const existing = statsMap.get(row.chatId) || {
          additions: 0,
          deletions: 0,
          fileCount: 0,
        };
        existing.additions += row.additions || 0;
        existing.deletions += row.deletions || 0;
        existing.fileCount += row.fileCount || 0;
        statsMap.set(row.chatId, existing);
      }

      // Convert to array for easier consumption
      return Array.from(statsMap.entries()).map(([chatId, stats]) => ({
        chatId,
        ...stats,
      }));
    }),

  /**
   * Get sub-chats with pending plan approvals.
   * Uses computed column instead of parsing messages JSON for performance.
   */
  getPendingPlanApprovals: publicProcedure
    .input(
      z.object({ openSubChatIds: z.array(z.string()).optional() }).optional(),
    )
    .query(({ input }) => {
      const db = getDatabase();
      const openSubChatIdsSet = input?.openSubChatIds
        ? new Set(input.openSubChatIds)
        : null;

      // Query computed column directly - no JSON parsing needed
      const rows = db
        .select({
          subChatId: subChats.id,
          chatId: subChats.chatId,
          hasPendingPlanApproval: subChats.hasPendingPlanApproval,
        })
        .from(subChats)
        .innerJoin(chats, eq(chats.id, subChats.chatId))
        .where(
          and(
            eq(subChats.hasPendingPlanApproval, true),
            isNull(chats.archivedAt),
          ),
        )
        .all()
        // Filter by open sub-chats if provided
        .filter(
          (row) => !openSubChatIdsSet || openSubChatIdsSet.has(row.subChatId),
        );

      return rows.map((row) => ({
        subChatId: row.subChatId,
        chatId: row.chatId,
      }));
    }),
});
