import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { execSync } from "child_process";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { app } from "electron";
import os from "os";
import path from "path";
import simpleGit from "simple-git";
import { z } from "zod";
import { chats, getDatabase, projects, subChats } from "../../db";
import { type ChatStatsEvent, chatStatsEmitter } from "../../events";
import {
  checkBranchCheckoutSafety,
  checkoutBranch,
  createWorktreeForChat,
  fetchGitHostStatus,
  fetchGitHubPRStatus,
  type GitProvider,
  getMergeCommand,
  getWorktreeDiff,
  removeWorktree,
} from "../../git";
import { gitQueue } from "../../git/git-queue";
import { execWithShellEnv } from "../../git/shell-env";
import { getClaudeBinaryPath } from "../../providers/claude";
import { providerRegistry } from "../../providers/registry";
import { getRalphService } from "../../ralph";
import { worktreeInitRunner } from "../../worktree/init-runner";
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
   * List chats with their sub-chats for a project (optimized for tree view)
   */
  listWithSubChats: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const db = getDatabase();

      // Get all non-archived chats for the project with their sub-chats in a single query
      const rows = db
        .select({
          chat: chats,
          subChat: {
            id: subChats.id,
            chatId: subChats.chatId,
            name: subChats.name,
            mode: subChats.mode,
            createdAt: subChats.createdAt,
            updatedAt: subChats.updatedAt,
            hasPendingPlanApproval: subChats.hasPendingPlanApproval,
            fileAdditions: subChats.fileAdditions,
            fileDeletions: subChats.fileDeletions,
            fileCount: subChats.fileCount,
            addedDirs: subChats.addedDirs,
            providerId: subChats.providerId,
            modelId: subChats.modelId,
          },
        })
        .from(chats)
        .leftJoin(subChats, eq(subChats.chatId, chats.id))
        .where(
          and(eq(chats.projectId, input.projectId), isNull(chats.archivedAt)),
        )
        .orderBy(desc(chats.updatedAt), desc(subChats.updatedAt))
        .all();

      // Group sub-chats by chat
      const chatMap = new Map<
        string,
        {
          chat: typeof chats.$inferSelect;
          subChats: Array<{
            id: string;
            chatId: string;
            name: string | null;
            mode: string;
            createdAt: Date | null;
            updatedAt: Date | null;
            hasPendingPlanApproval: boolean | null;
            fileAdditions: number | null;
            fileDeletions: number | null;
            fileCount: number | null;
            addedDirs: string | null;
            providerId: string | null;
            modelId: string | null;
          }>;
        }
      >();

      for (const row of rows) {
        if (!chatMap.has(row.chat.id)) {
          chatMap.set(row.chat.id, { chat: row.chat, subChats: [] });
        }
        if (row.subChat?.id) {
          chatMap.get(row.chat.id)!.subChats.push(row.subChat);
        }
      }

      // Convert to array and sort sub-chats by updatedAt desc
      return Array.from(chatMap.values()).map(({ chat, subChats }) => ({
        ...chat,
        subChats: subChats.sort(
          (a, b) =>
            (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0),
        ),
      }));
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
   * Find a chat (workspace) by project and branch - for branch-centric model
   */
  findByProjectAndBranch: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        branch: z.string(),
      }),
    )
    .query(({ input }) => {
      const db = getDatabase();
      const result = db
        .select()
        .from(chats)
        .where(
          and(
            eq(chats.projectId, input.projectId),
            eq(chats.branch, input.branch),
            isNull(chats.archivedAt),
          ),
        )
        .get();
      // Return null instead of undefined (React Query requirement)
      return result ?? null;
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
        selectedBranch: z.string().optional(), // Branch to switch to in local mode
        createNewBranch: z.boolean().optional(), // Create selectedBranch as new branch from current
        mode: z.enum(["plan", "agent", "ralph"]).default("agent"),
        providerId: z
          .enum(["claude", "codex", "opencode"])
          .optional()
          .default("claude"),
        initialAddedDirs: z.array(z.string()).optional(),
        modelId: z.string().optional(),
        // Ralph PRD data (for ralph mode - allows setting up PRD before chat creation)
        ralphPrd: z
          .object({
            goal: z.string(),
            branchName: z.string(),
            stories: z.array(
              z.object({
                id: z.string(),
                title: z.string(),
                description: z.string(),
                priority: z.number(),
                acceptanceCriteria: z.array(z.string()),
                passes: z.boolean(),
                notes: z.string().optional(),
              }),
            ),
          })
          .optional(),
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

      // Build initial messages for sub-chat
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

      // LOCAL MODE: Find-or-create workspace by branch (branch-centric model)
      if (!input.useWorktree && input.selectedBranch) {
        console.log(
          "[chats.create] local mode - checking for existing workspace:",
          input.projectId,
          input.selectedBranch,
        );

        // Check if workspace already exists for this (projectId, branch)
        // Include archived chats to handle unique constraint properly
        const existingChat = db
          .select()
          .from(chats)
          .where(
            and(
              eq(chats.projectId, input.projectId),
              eq(chats.branch, input.selectedBranch),
            ),
          )
          .get();

        if (existingChat) {
          // If chat is archived, unarchive it for reuse
          if (existingChat.archivedAt) {
            console.log(
              "[chats.create] found archived workspace, unarchiving:",
              existingChat.id,
            );
            db.update(chats)
              .set({ archivedAt: null, updatedAt: new Date() })
              .where(eq(chats.id, existingChat.id))
              .run();
          }
          console.log(
            "[chats.create] found existing workspace:",
            existingChat.id,
          );

          // Always checkout branch - user may have switched externally
          // Use git queue to serialize operations and prevent index.lock conflicts
          await gitQueue.enqueue(
            project.path,
            `checkoutBranch:existing:${input.selectedBranch}`,
            async () => {
              const git = simpleGit(project.path);
              const status = await git.status();
              const currentBranch = status.current;

              if (currentBranch !== input.selectedBranch) {
                console.log(
                  "[chats.create] existing workspace on different branch, switching:",
                  currentBranch,
                  "->",
                  input.selectedBranch,
                );
                const safety = await checkBranchCheckoutSafety(project.path);
                if (!safety.safe) {
                  console.log("[chats.create] checkout safety failed:", safety);
                  throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: safety.error,
                  });
                }
                console.log(
                  "[chats.create] checkout safety passed, performing checkout...",
                );
                await checkoutBranch(project.path, input.selectedBranch!);

                // Verify checkout succeeded
                const postStatus = await git.status();
                console.log(
                  "[chats.create] post-checkout branch:",
                  postStatus.current,
                );
                if (postStatus.current !== input.selectedBranch) {
                  throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `Branch checkout failed: expected "${input.selectedBranch}" but on "${postStatus.current}"`,
                  });
                }
                console.log("[chats.create] checkout verified successfully");
              } else {
                console.log(
                  "[chats.create] already on correct branch:",
                  currentBranch,
                );
              }
            },
          );

          // Workspace exists - just create a new SubChat in it
          const subChat = db
            .insert(subChats)
            .values({
              chatId: existingChat.id,
              mode: input.mode,
              messages: initialMessages,
              providerId: input.providerId,
              ...(input.modelId && { modelId: input.modelId }),
              addedDirs: JSON.stringify(input.initialAddedDirs ?? []),
            })
            .returning()
            .get();

          // Update chat's updatedAt
          db.update(chats)
            .set({ updatedAt: new Date() })
            .where(eq(chats.id, existingChat.id))
            .run();

          console.log(
            "[chats.create] created subChat in existing workspace:",
            subChat,
          );

          return {
            ...existingChat,
            archivedAt: null, // Ensure unarchived state is reflected
            subChats: [subChat],
            isExisting: true, // Flag to indicate workspace reuse
            newSubChatId: subChat.id, // Explicitly identify the new sub-chat
          };
        }

        // No existing workspace - proceed with new chat creation below
        console.log(
          "[chats.create] no existing workspace, creating new one for branch:",
          input.selectedBranch,
        );
      }

      // Create new chat (workspace)
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

      const subChat = db
        .insert(subChats)
        .values({
          chatId: chat.id,
          mode: input.mode,
          messages: initialMessages,
          providerId: input.providerId,
          ...(input.modelId && { modelId: input.modelId }),
          addedDirs: JSON.stringify(input.initialAddedDirs ?? []),
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

        // Query existing branches for this project to avoid name collisions
        const existingBranches = db
          .select({ branch: chats.branch })
          .from(chats)
          .where(eq(chats.projectId, input.projectId))
          .all()
          .map((row) => row.branch)
          .filter((b): b is string => b !== null);

        const result = await createWorktreeForChat(
          project.path,
          project.id,
          chat.id,
          input.baseBranch,
          existingBranches,
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

          // Run worktree init command if configured
          if (project.worktreeInitCommand) {
            console.log(
              "[chats.create] running worktree init command:",
              project.worktreeInitCommand,
            );
            // Run async - don't block chat creation
            worktreeInitRunner
              .runInitCommand({
                chatId: chat.id,
                command: project.worktreeInitCommand,
                worktreePath: result.worktreePath,
                projectPath: project.path,
                branchName: result.branch || "unknown",
              })
              .catch((err) => {
                console.error(
                  "[chats.create] Worktree init command failed:",
                  err,
                );
              });
          }
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
        // Local mode: use project path directly
        console.log("[chats.create] local mode - using project path directly");

        // Handle branch selection in local mode
        if (input.selectedBranch) {
          console.log(
            "[chats.create] local mode with branch selection:",
            input.selectedBranch,
            "createNew:",
            input.createNewBranch,
          );

          // Use git queue to serialize operations and prevent index.lock conflicts
          // Returns { needsBranchSwitch, currentBranch } for use after the queue completes
          const branchResult = await gitQueue.enqueue(
            project.path,
            `checkoutBranch:new:${input.selectedBranch}`,
            async () => {
              const git = simpleGit(project.path);
              const status = await git.status();
              const currentBranch = status.current || "main";

              // Check if we need to switch branches
              const needsBranchSwitch = input.selectedBranch !== currentBranch;

              if (needsBranchSwitch) {
                // Check for uncommitted changes before switching
                const safety = await checkBranchCheckoutSafety(project.path);
                if (!safety.safe) {
                  // Rollback: delete the chat we just created
                  db.delete(chats).where(eq(chats.id, chat.id)).run();
                  throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: safety.error,
                  });
                }

                if (input.createNewBranch) {
                  // Create new branch from current and switch to it
                  console.log(
                    "[chats.create] creating new branch:",
                    input.selectedBranch,
                    "from:",
                    currentBranch,
                  );
                  await git.checkout(["-b", input.selectedBranch!]);
                } else {
                  // Switch to existing branch
                  console.log(
                    "[chats.create] switching to existing branch:",
                    input.selectedBranch,
                  );
                  await checkoutBranch(project.path, input.selectedBranch!);
                }

                // Verify checkout succeeded
                const postStatus = await git.status();
                console.log(
                  "[chats.create] new workspace post-checkout branch:",
                  postStatus.current,
                );
                if (postStatus.current !== input.selectedBranch) {
                  // Rollback: delete the chat we just created
                  db.delete(chats).where(eq(chats.id, chat.id)).run();
                  throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: `Branch checkout failed: expected "${input.selectedBranch}" but on "${postStatus.current}"`,
                  });
                }
                console.log(
                  "[chats.create] new workspace checkout verified successfully",
                );
              } else {
                console.log(
                  "[chats.create] already on branch:",
                  input.selectedBranch,
                );
              }

              return { needsBranchSwitch, currentBranch };
            },
          );

          // Before setting branch, double-check no other chat has this branch
          // This handles race conditions and edge cases where find-or-create missed something
          const conflictingChat = db
            .select()
            .from(chats)
            .where(
              and(
                eq(chats.projectId, input.projectId),
                eq(chats.branch, input.selectedBranch),
              ),
            )
            .get();

          if (conflictingChat) {
            // Another chat already has this branch - delete the one we just created
            // and use the existing one instead
            console.log(
              "[chats.create] found conflicting chat with same branch, using existing:",
              conflictingChat.id,
            );
            db.delete(chats).where(eq(chats.id, chat.id)).run();

            // Unarchive if needed
            if (conflictingChat.archivedAt) {
              db.update(chats)
                .set({ archivedAt: null, updatedAt: new Date() })
                .where(eq(chats.id, conflictingChat.id))
                .run();
            }

            // Create sub-chat in existing workspace
            const existingSubChat = db
              .insert(subChats)
              .values({
                chatId: conflictingChat.id,
                mode: input.mode,
                messages: initialMessages,
                providerId: input.providerId,
                ...(input.modelId && { modelId: input.modelId }),
                addedDirs: JSON.stringify(input.initialAddedDirs ?? []),
              })
              .returning()
              .get();

            return {
              ...conflictingChat,
              archivedAt: null,
              subChats: [existingSubChat],
              isExisting: true,
              newSubChatId: existingSubChat.id,
            };
          }

          worktreeResult = {
            worktreePath: project.path,
            branch: input.selectedBranch,
            baseBranch: branchResult.needsBranchSwitch
              ? branchResult.currentBranch
              : undefined,
          };

          db.update(chats)
            .set({
              worktreePath: project.path,
              branch: input.selectedBranch,
              baseBranch: branchResult.needsBranchSwitch
                ? branchResult.currentBranch
                : undefined,
            })
            .where(eq(chats.id, chat.id))
            .run();
        } else {
          // No branch selection - use current branch
          db.update(chats)
            .set({ worktreePath: project.path })
            .where(eq(chats.id, chat.id))
            .run();
          worktreeResult = { worktreePath: project.path };
        }
      }

      // Save Ralph PRD if provided (for ralph mode)
      if (input.ralphPrd && input.mode === "ralph") {
        console.log("[chats.create] saving Ralph PRD for chat:", chat.id);
        getRalphService().savePrd(chat.id, {
          goal: input.ralphPrd.goal,
          branchName: input.ralphPrd.branchName,
          stories: input.ralphPrd.stories,
        });
      }

      const response = {
        ...chat,
        worktreePath: worktreeResult.worktreePath || project.path,
        branch: worktreeResult.branch,
        baseBranch: worktreeResult.baseBranch,
        subChats: [subChat],
        newSubChatId: subChat.id,
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
        providerId: z.enum(["claude", "codex", "opencode"]),
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

      // Stop all active subchats for this chat
      if (chat) {
        const chatSubChats = db
          .select({ id: subChats.id })
          .from(subChats)
          .where(eq(subChats.chatId, chat.id))
          .all();

        for (const subChat of chatSubChats) {
          for (const provider of providerRegistry.getAll()) {
            if (provider.isActive(subChat.id)) {
              provider.cancel(subChat.id);
            }
          }
        }
      }

      // Cleanup worktree if it exists and is a real worktree (not the project path itself)
      if (chat?.worktreePath) {
        const project = db
          .select()
          .from(projects)
          .where(eq(projects.id, chat.projectId))
          .get();
        // Only remove if worktreePath differs from project path (real worktree, not local mode)
        if (project && chat.worktreePath !== project.path) {
          const result = await removeWorktree(project.path, chat.worktreePath);
          if (!result.success) {
            console.warn(
              `[Worktree] Cleanup failed for chat ${input.id}: ${result.error}`,
            );
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
        mode: z.enum(["plan", "agent", "ralph"]).default("agent"),
        providerId: z.enum(["claude", "codex", "opencode"]).optional(),
        modelId: z.string().optional(),
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
          ...(input.providerId && { providerId: input.providerId }),
          ...(input.modelId && { modelId: input.modelId }),
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
    .input(
      z.object({ id: z.string(), mode: z.enum(["plan", "agent", "ralph"]) }),
    )
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
   * Update sub-chat provider
   */
  updateSubChatProvider: publicProcedure
    .input(
      z.object({
        id: z.string(),
        providerId: z.enum(["claude", "codex", "opencode"]),
      }),
    )
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(subChats)
        .set({ providerId: input.providerId })
        .where(eq(subChats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Update sub-chat model
   */
  updateSubChatModel: publicProcedure
    .input(
      z.object({
        id: z.string(),
        modelId: z.string(),
      }),
    )
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(subChats)
        .set({ modelId: input.modelId })
        .where(eq(subChats.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Update sub-chat added directories (for /add-dir command)
   */
  updateSubChatAddedDirs: publicProcedure
    .input(z.object({ id: z.string(), addedDirs: z.array(z.string()) }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(subChats)
        .set({ addedDirs: JSON.stringify(input.addedDirs) })
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

      // Stop active stream before deletion
      for (const provider of providerRegistry.getAll()) {
        if (provider.isActive(input.id)) {
          provider.cancel(input.id);
        }
      }

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

      // Pass uncommittedOnly: true to only show uncommitted changes
      // After commit, changes tab should be empty (same as project-level behavior)
      const result = await getWorktreeDiff(
        chat.worktreePath,
        chat.baseBranch ?? undefined,
        { uncommittedOnly: true },
      );

      if (!result.success) {
        return { diff: null, error: result.error };
      }

      return { diff: result.diff || "" };
    }),

  /**
   * Get unified diff for a single commit in a chat's worktree
   */
  getCommitDiff: publicProcedure
    .input(z.object({ chatId: z.string(), commitHash: z.string() }))
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

      const git = simpleGit(chat.worktreePath);
      const lockFileExcludes = [
        ":!*.lock",
        ":!*-lock.*",
        ":!package-lock.json",
        ":!pnpm-lock.yaml",
        ":!yarn.lock",
      ];

      try {
        const diff = await git.diff([
          `${input.commitHash}~1`,
          input.commitHash,
          "--no-color",
          "--",
          ...lockFileExcludes,
        ]);
        return { diff: diff || "" };
      } catch {
        // Handle initial commit (no parent) by diffing against empty tree
        try {
          const diff = await git.diff([
            "4b825dc642cb6eb9a060e54bf899d69f82559ef1",
            input.commitHash,
            "--no-color",
            "--",
            ...lockFileExcludes,
          ]);
          return { diff: diff || "" };
        } catch (fallbackError) {
          return {
            diff: null,
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : "Unknown error",
          };
        }
      }
    }),

  /**
   * Get full diff (committed + uncommitted) against base branch for a chat's worktree
   */
  getFullDiff: publicProcedure
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
        { fullDiff: true },
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
        providerId: z
          .enum(["claude", "codex", "opencode"])
          .optional()
          .default("claude"),
        projectPath: z.string().optional(),
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
        const binaryResult = getClaudeBinaryPath();
        if (!binaryResult) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Claude Code binary not found. Install via https://claude.ai/install.sh",
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

        // Use isolated config dir to avoid loading user's MCP servers/settings
        // which can trigger macOS TCC prompts (e.g., Photo Library access)
        const isolatedConfigDir = path.join(
          app.getPath("userData"),
          "claude-name-gen",
        );

        try {
          // Minimal env for name generation - avoid shell spawning which triggers TCC prompts
          const minimalEnv: Record<string, string> = {
            HOME: os.homedir(),
            USER: os.userInfo().username,
            PATH: process.env.PATH || "/usr/bin:/bin",
            SHELL: process.env.SHELL || "/bin/zsh",
            TERM: "xterm-256color",
            CLAUDE_CONFIG_DIR: isolatedConfigDir,
            CLAUDE_CODE_ENTRYPOINT: "sdk-ts",
            ...(cliOAuthToken && {
              CLAUDE_CODE_OAUTH_TOKEN: cliOAuthToken,
            }),
          };

          const stream = claudeQuery({
            prompt,
            options: {
              abortController,
              // Use project path as cwd, fallback to userData if not available
              cwd: input.projectPath || app.getPath("userData"),
              env: minimalEnv,
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

  /**
   * Subscribe to real-time updates for file stats and pending plan approvals.
   * Replaces polling with event-driven updates for better performance.
   */
  watchChatStats: publicProcedure
    .input(z.object({ openSubChatIds: z.array(z.string()) }))
    .subscription(({ input }) => {
      const openSubChatIdsSet = new Set(input.openSubChatIds);

      return observable<{
        fileStats: Array<{
          chatId: string;
          additions: number;
          deletions: number;
          fileCount: number;
        }>;
        planApprovals: Array<{ subChatId: string; chatId: string }>;
      }>((emit) => {
        const db = getDatabase();

        // Helper to fetch current stats
        const fetchAndEmit = () => {
          // Get file stats
          const fileRows = db
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
            .filter(
              (row) => !row.subChatId || openSubChatIdsSet.has(row.subChatId),
            );

          // Aggregate stats per workspace
          const statsMap = new Map<
            string,
            { additions: number; deletions: number; fileCount: number }
          >();
          for (const row of fileRows) {
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
          const fileStats = Array.from(statsMap.entries()).map(
            ([chatId, stats]) => ({ chatId, ...stats }),
          );

          // Get pending plan approvals
          const planRows = db
            .select({
              subChatId: subChats.id,
              chatId: subChats.chatId,
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
            .filter((row) => openSubChatIdsSet.has(row.subChatId));

          emit.next({ fileStats, planApprovals: planRows });
        };

        // Emit initial data
        fetchAndEmit();

        // Listen for updates
        const handler = (event: ChatStatsEvent) => {
          if (openSubChatIdsSet.has(event.subChatId)) {
            fetchAndEmit();
          }
        };

        chatStatsEmitter.on("stats-update", handler);

        // Return cleanup function
        return () => {
          chatStatsEmitter.off("stats-update", handler);
        };
      });
    }),
});
