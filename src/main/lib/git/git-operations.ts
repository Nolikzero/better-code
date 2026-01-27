import { shell } from "electron";
import simpleGit from "simple-git";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { clearDiffCache } from "./diff-cache";
import { isUpstreamMissingError } from "./git-utils";
import { fetchGitHubPRStatus } from "./github";
import type { GitProvider } from "./index";
import { fetchGitHostStatus, getCompareUrl } from "./providers";
import {
  assertRegisteredWorktree,
  gitHasStash,
  gitStageFiles,
  gitStash,
  gitStashPop,
} from "./security";
import { clearStatusCache } from "./status-cache";
import { parseGitRemoteUrl } from "./utils/parse-remote-url";

async function hasUpstreamBranch(
  git: ReturnType<typeof simpleGit>,
): Promise<boolean> {
  try {
    await git.raw(["rev-parse", "--abbrev-ref", "@{upstream}"]);
    return true;
  } catch {
    return false;
  }
}

function invalidateCaches(worktreePath: string): void {
  clearStatusCache(worktreePath);
  clearDiffCache(worktreePath);
}

export const createGitOperationsRouter = () => {
  return router({
    // NOTE: saveFile is defined in file-contents.ts with hardened path validation
    // Do NOT add saveFile here - it would overwrite the secure version

    commit: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          message: z.string(),
        }),
      )
      .mutation(
        async ({ input }): Promise<{ success: boolean; hash: string }> => {
          assertRegisteredWorktree(input.worktreePath);

          const git = simpleGit(input.worktreePath);
          const result = await git.commit(input.message);
          invalidateCaches(input.worktreePath);
          return { success: true, hash: result.commit };
        },
      ),

    // Commit with selected files only (stages specified files, then commits)
    commitSelected: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          files: z.array(z.string()),
          message: z.string(),
        }),
      )
      .mutation(
        async ({ input }): Promise<{ success: boolean; hash: string }> => {
          assertRegisteredWorktree(input.worktreePath);

          if (input.files.length === 0) {
            throw new Error("No files selected for commit");
          }

          // Stage only the selected files
          await gitStageFiles(input.worktreePath, input.files);

          // Commit the staged files
          const git = simpleGit(input.worktreePath);
          const result = await git.commit(input.message);
          invalidateCaches(input.worktreePath);
          return { success: true, hash: result.commit };
        },
      ),

    // Stash all uncommitted changes
    stash: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          message: z.string().optional(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await gitStash(input.worktreePath, input.message);
        invalidateCaches(input.worktreePath);
        return { success: true };
      }),

    // Pop (apply and remove) the most recent stash
    stashPop: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        await gitStashPop(input.worktreePath);
        invalidateCaches(input.worktreePath);
        return { success: true };
      }),

    // Check if there are any stashes
    hasStash: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
        }),
      )
      .query(async ({ input }): Promise<{ hasStash: boolean }> => {
        const hasStash = await gitHasStash(input.worktreePath);
        return { hasStash };
      }),

    push: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          setUpstream: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        assertRegisteredWorktree(input.worktreePath);

        const git = simpleGit(input.worktreePath);
        const hasUpstream = await hasUpstreamBranch(git);

        if (input.setUpstream && !hasUpstream) {
          const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
          await git.push(["--set-upstream", "origin", branch.trim()]);
        } else {
          await git.push();
        }
        await git.fetch();
        invalidateCaches(input.worktreePath);
        return { success: true };
      }),

    pull: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        assertRegisteredWorktree(input.worktreePath);

        const git = simpleGit(input.worktreePath);
        try {
          await git.pull(["--rebase"]);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (isUpstreamMissingError(message)) {
            throw new Error(
              "No upstream branch to pull from. The remote branch may have been deleted.",
            );
          }
          throw error;
        }
        invalidateCaches(input.worktreePath);
        return { success: true };
      }),

    sync: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        assertRegisteredWorktree(input.worktreePath);

        const git = simpleGit(input.worktreePath);
        try {
          await git.pull(["--rebase"]);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          if (isUpstreamMissingError(message)) {
            const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
            await git.push(["--set-upstream", "origin", branch.trim()]);
            await git.fetch();
            invalidateCaches(input.worktreePath);
            return { success: true };
          }
          throw error;
        }
        await git.push();
        await git.fetch();
        invalidateCaches(input.worktreePath);
        return { success: true };
      }),

    createPR: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          provider: z
            .enum(["github", "gitlab", "bitbucket"])
            .nullable()
            .optional(),
          baseBranch: z.string().optional().default("main"),
        }),
      )
      .mutation(
        async ({ input }): Promise<{ success: boolean; url: string }> => {
          assertRegisteredWorktree(input.worktreePath);

          const git = simpleGit(input.worktreePath);
          const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
          const hasUpstream = await hasUpstreamBranch(git);

          // Ensure branch is pushed first
          if (!hasUpstream) {
            await git.push(["--set-upstream", "origin", branch]);
          } else {
            // Push any unpushed commits
            await git.push();
          }

          // Get the remote URL
          const remoteUrl = (await git.remote(["get-url", "origin"])) || "";
          const provider = input.provider as GitProvider;

          const parsed = parseGitRemoteUrl(remoteUrl);

          // Use provider-aware URL generation if provider is known
          if (parsed.repoUrl && provider && provider !== "bitbucket") {
            const url = getCompareUrl(
              provider,
              parsed.repoUrl,
              branch,
              input.baseBranch,
            );
            if (url) {
              await shell.openExternal(url);
              await git.fetch();
              return { success: true, url };
            }
          }

          // Fallback to parsed URL or fail
          if (!parsed.repoUrl) {
            throw new Error(
              "Could not determine repository URL. Ensure the remote is configured for GitHub or GitLab.",
            );
          }

          const url = `${parsed.repoUrl}/compare/${branch}?expand=1`;

          await shell.openExternal(url);
          await git.fetch();

          return { success: true, url };
        },
      ),

    // Legacy GitHub-only status (kept for backwards compatibility)
    getGitHubStatus: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
        }),
      )
      .query(async ({ input }) => {
        assertRegisteredWorktree(input.worktreePath);
        return await fetchGitHubPRStatus(input.worktreePath);
      }),

    // Provider-aware git host status
    getGitHostStatus: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          provider: z
            .enum(["github", "gitlab", "bitbucket"])
            .nullable()
            .optional(),
        }),
      )
      .query(async ({ input }) => {
        assertRegisteredWorktree(input.worktreePath);
        const provider = input.provider as GitProvider;
        if (!provider) {
          // Default to GitHub for backwards compatibility
          return await fetchGitHubPRStatus(input.worktreePath);
        }
        return await fetchGitHostStatus(input.worktreePath, provider);
      }),
  });
};
