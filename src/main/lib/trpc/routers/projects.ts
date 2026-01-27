import { desc, eq } from "drizzle-orm";
import { BrowserWindow, dialog } from "electron";
import { basename } from "path";
import { z } from "zod";
import { chats, getDatabase, projects } from "../../db";
import {
  getGitRemoteInfo,
  getWorktreeDiff,
  getWorktreeNumstat,
  removeWorktree,
} from "../../git";
import { detectSubRepos } from "../../git/multi-repo";
import { assertRegisteredWorktree } from "../../git/security/path-validation";
import { publicProcedure, router } from "../index";

interface RepoInfo {
  name: string;
  path: string;
  relativePath: string;
}

/**
 * Resolve the list of repos for a multi-repo project.
 * Uses knownRepos if provided (skipping detectSubRepos), otherwise detects sub-repos.
 */
async function resolveMultiRepos(
  projectId: string,
  knownRepos?: RepoInfo[],
): Promise<RepoInfo[]> {
  if (knownRepos && knownRepos.length > 0) {
    for (const repo of knownRepos) {
      assertRegisteredWorktree(repo.path);
    }
    return knownRepos;
  }

  const db = getDatabase();
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project?.path) {
    return [];
  }

  const detection = await detectSubRepos(project.path);
  const repoPaths: RepoInfo[] = [];

  if (detection.isRootRepo) {
    repoPaths.push({
      name: basename(project.path),
      path: project.path,
      relativePath: ".",
    });
  }

  for (const sub of detection.subRepos) {
    repoPaths.push(sub);
  }

  return repoPaths;
}

function buildDiffResponse(
  repo: RepoInfo,
  result: { success: boolean; diff?: string; error?: string },
) {
  return {
    name: repo.name,
    path: repo.path,
    relativePath: repo.relativePath,
    diff: result.success ? result.diff || "" : null,
    error: result.success ? undefined : result.error,
  };
}

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
      return (
        db.select().from(projects).where(eq(projects.id, input.id)).get() ??
        null
      );
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

    // Get git remote info and multi-repo detection in parallel
    const [gitInfo, multiRepoResult] = await Promise.all([
      getGitRemoteInfo(folderPath),
      detectSubRepos(folderPath),
    ]);

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
          isMultiRepo: multiRepoResult.isMultiRepo,
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
        isMultiRepo: multiRepoResult.isMultiRepo,
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
        // Update git info and multi-repo detection (may have changed since creation)
        const [gitInfo, multiRepoResult] = await Promise.all([
          getGitRemoteInfo(input.path),
          detectSubRepos(input.path),
        ]);
        return db
          .update(projects)
          .set({
            updatedAt: new Date(),
            gitRemoteUrl: gitInfo.remoteUrl,
            gitProvider: gitInfo.provider,
            gitOwner: gitInfo.owner,
            gitRepo: gitInfo.repo,
            isMultiRepo: multiRepoResult.isMultiRepo,
          })
          .where(eq(projects.id, existing.id))
          .returning()
          .get();
      }

      // Get git remote info and multi-repo detection in parallel
      const [gitInfo, multiRepoResult] = await Promise.all([
        getGitRemoteInfo(input.path),
        detectSubRepos(input.path),
      ]);

      return db
        .insert(projects)
        .values({
          name,
          path: input.path,
          gitRemoteUrl: gitInfo.remoteUrl,
          gitProvider: gitInfo.provider,
          gitOwner: gitInfo.owner,
          gitRepo: gitInfo.repo,
          isMultiRepo: multiRepoResult.isMultiRepo,
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
        .filter(
          (chat) => chat.worktreePath && chat.worktreePath !== project.path,
        )
        .map(async (chat) => {
          try {
            const result = await removeWorktree(
              project.path,
              chat.worktreePath!,
            );
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

  /**
   * Detect sub-repositories inside a project directory.
   * Returns whether the root is a git repo, and lists any sub-repos.
   */
  detectRepos: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase();
      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .get();

      if (!project?.path) {
        return { isRootRepo: false, isMultiRepo: false, subRepos: [] };
      }

      return detectSubRepos(project.path);
    }),

  /**
   * Get git diffs for all sub-repositories in a multi-repo project.
   * Returns per-repo diff data for repos that have changes.
   */
  getMultiRepoDiff: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        /** Optional pre-resolved repo paths to skip detectSubRepos call */
        knownRepos: z
          .array(
            z.object({
              name: z.string(),
              path: z.string(),
              relativePath: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const repoPaths = await resolveMultiRepos(
        input.projectId,
        input.knownRepos,
      );
      if (repoPaths.length === 0) return { repos: [] };

      const results = await Promise.all(
        repoPaths.map(async (repo) => {
          const result = await getWorktreeDiff(repo.path, undefined, {
            uncommittedOnly: true,
            skipUntracked: true,
          });
          return buildDiffResponse(repo, result);
        }),
      );

      return { repos: results };
    }),

  /**
   * Get git diff for a single repository path.
   * Used for incremental updates when a file watcher fires.
   */
  getSingleRepoDiff: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        repoName: z.string(),
        relativePath: z.string(),
      }),
    )
    .query(async ({ input }) => {
      // Validate that repoPath is within a registered project
      assertRegisteredWorktree(input.repoPath);

      const result = await getWorktreeDiff(input.repoPath, undefined, {
        uncommittedOnly: true,
      });
      return buildDiffResponse(
        {
          name: input.repoName,
          path: input.repoPath,
          relativePath: input.relativePath,
        },
        result,
      );
    }),

  /**
   * Get lightweight diff stats (numstat) for all sub-repositories.
   * Returns file count, additions, deletions per repo without full diff content.
   */
  getMultiRepoStats: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        knownRepos: z
          .array(
            z.object({
              name: z.string(),
              path: z.string(),
              relativePath: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const repoPaths = await resolveMultiRepos(
        input.projectId,
        input.knownRepos,
      );
      if (repoPaths.length === 0) return { repos: [] };

      const results = await Promise.all(
        repoPaths.map(async (repo) => {
          const result = await getWorktreeNumstat(repo.path);
          return {
            name: repo.name,
            path: repo.path,
            relativePath: repo.relativePath,
            fileCount: result.success ? (result.fileCount ?? 0) : 0,
            additions: result.success ? (result.additions ?? 0) : 0,
            deletions: result.success ? (result.deletions ?? 0) : 0,
            error: result.success ? undefined : result.error,
          };
        }),
      );

      return { repos: results };
    }),
});
