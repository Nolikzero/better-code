import { desc, eq } from "drizzle-orm";
import { BrowserWindow, dialog } from "electron";
import { basename } from "path";
import { z } from "zod";
import { chats, getDatabase, projects } from "../../db";
import { getGitRemoteInfo, getWorktreeDiff, removeWorktree } from "../../git";
import { publicProcedure, router } from "../index";

export const projectsRouter = router({
  /**
   * List all projects
   */
  list: publicProcedure.query(() => {
    const db = getDatabase();
    return db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
  }),

  /**
   * Get a single project by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDatabase();
      return db.select().from(projects).where(eq(projects.id, input.id)).get();
    }),

  /**
   * Open folder picker and create project
   */
  openFolder: publicProcedure.mutation(async ({ ctx }) => {
    const window = ctx.getWindow?.() ?? BrowserWindow.getFocusedWindow();

    if (!window) {
      console.error("[Projects] No window available for folder dialog");
      return null;
    }

    // Ensure window is focused before showing dialog (fixes first-launch timing issue on macOS)
    if (!window.isFocused()) {
      console.log("[Projects] Window not focused, focusing before dialog...");
      window.focus();
      // Small delay to ensure focus is applied by the OS
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Project Folder",
      buttonLabel: "Open Project",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const folderPath = result.filePaths[0]!;
    const folderName = basename(folderPath);

    // Get git remote info
    const gitInfo = await getGitRemoteInfo(folderPath);

    const db = getDatabase();

    // Check if project already exists
    const existing = db
      .select()
      .from(projects)
      .where(eq(projects.path, folderPath))
      .get();

    if (existing) {
      // Update the updatedAt timestamp and git info (in case remote changed)
      const updatedProject = db
        .update(projects)
        .set({
          updatedAt: new Date(),
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .where(eq(projects.id, existing.id))
        .returning()
        .get();

      return updatedProject;
    }

    // Create new project with git info
    return db
      .insert(projects)
      .values({
        name: folderName,
        path: folderPath,
        gitRemoteUrl: gitInfo.remoteUrl,
        gitProvider: gitInfo.provider,
        gitOwner: gitInfo.owner,
        gitRepo: gitInfo.repo,
      })
      .returning()
      .get();
  }),

  /**
   * Create a project from a known path
   */
  create: publicProcedure
    .input(z.object({ path: z.string(), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDatabase();
      const name = input.name || basename(input.path);

      // Check if project already exists
      const existing = db
        .select()
        .from(projects)
        .where(eq(projects.path, input.path))
        .get();

      if (existing) {
        return existing;
      }

      // Get git remote info
      const gitInfo = await getGitRemoteInfo(input.path);

      return db
        .insert(projects)
        .values({
          name,
          path: input.path,
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .returning()
        .get();
    }),

  /**
   * Rename a project
   */
  rename: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ input }) => {
      const db = getDatabase();
      return db
        .update(projects)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(projects.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Update project settings (name, worktreeInitCommand, runCommand)
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        worktreeInitCommand: z.string().nullable().optional(),
        runCommand: z.string().nullable().optional(),
      }),
    )
    .mutation(({ input }) => {
      const db = getDatabase();
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (input.name !== undefined) {
        updates.name = input.name;
      }
      if (input.worktreeInitCommand !== undefined) {
        updates.worktreeInitCommand = input.worktreeInitCommand;
      }
      if (input.runCommand !== undefined) {
        updates.runCommand = input.runCommand;
      }

      return db
        .update(projects)
        .set(updates)
        .where(eq(projects.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Delete a project and all its chats (with worktree cleanup)
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase();

      // Get project first (needed for path comparison and worktree removal)
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!project) {
        return null;
      }

      // Get all chats for this project to cleanup worktrees
      const projectChats = db
        .select()
        .from(chats)
        .where(eq(chats.projectId, input.id))
        .all();

      // Cleanup worktrees for each chat (in parallel for speed)
      const cleanupPromises = projectChats
        .filter((chat) => chat.worktreePath && chat.worktreePath !== project.path)
        .map(async (chat) => {
          try {
            const result = await removeWorktree(project.path, chat.worktreePath!);
            if (!result.success) {
              console.warn(
                `[Projects] Worktree cleanup failed for chat ${chat.id}: ${result.error}`,
              );
            }
            return { chatId: chat.id, success: result.success };
          } catch (error) {
            console.warn(
              `[Projects] Worktree cleanup error for chat ${chat.id}:`,
              error,
            );
            return { chatId: chat.id, success: false };
          }
        });

      // Wait for all cleanup attempts (don't block on failures)
      const cleanupResults = await Promise.allSettled(cleanupPromises);
      const failedCount = cleanupResults.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && !r.value.success),
      ).length;

      if (failedCount > 0) {
        console.warn(
          `[Projects] ${failedCount}/${cleanupPromises.length} worktree cleanups failed`,
        );
      }

      // Now delete project (cascades to chats in DB)
      return db
        .delete(projects)
        .where(eq(projects.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Refresh git info for a project (in case remote changed)
   */
  refreshGitInfo: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase();

      // Get project
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!project) {
        return null;
      }

      // Get fresh git info
      const gitInfo = await getGitRemoteInfo(project.path);

      // Update project
      return db
        .update(projects)
        .set({
          updatedAt: new Date(),
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
        })
        .where(eq(projects.id, input.id))
        .returning()
        .get();
    }),

  /**
   * Get git diff for a project's working directory
   * Shows uncommitted changes against HEAD
   */
  getDiff: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase();
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .get();

      if (!project?.path) {
        return { diff: null, error: "Project not found" };
      }

      // Use getWorktreeDiff with uncommittedOnly: true for project-level view
      // This ensures we only show uncommitted changes, not committed-but-not-pushed changes
      const result = await getWorktreeDiff(project.path, undefined, {
        uncommittedOnly: true,
      });

      if (!result.success) {
        return { diff: null, error: result.error };
      }

      return { diff: result.diff || "" };
    }),
});
