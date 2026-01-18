import { shell } from "electron";
import simpleGit from "simple-git";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { isUpstreamMissingError } from "./git-utils";
import { fetchGitHubPRStatus } from "./github";
import type { GitProvider } from "./index";
import { fetchGitHostStatus, getCompareUrl } from "./providers";
import { assertRegisteredWorktree } from "./security";

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
          return { success: true, hash: result.commit };
        },
      ),

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
            return { success: true };
          }
          throw error;
        }
        await git.push();
        await git.fetch();
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

          // Use provider-aware URL generation if provider is known
          if (provider && provider !== "bitbucket") {
            // Extract repo URL from remote
            let repoUrl: string | null = null;

            if (provider === "github") {
              const match = remoteUrl
                .trim()
                .match(/github\.com[:/](.+?)(?:\.git)?$/);
              if (match) {
                repoUrl = `https://github.com/${match[1].replace(/\.git$/, "")}`;
              }
            } else if (provider === "gitlab") {
              const match = remoteUrl
                .trim()
                .match(/gitlab\.com[:/](.+?)(?:\.git)?$/);
              if (match) {
                repoUrl = `https://gitlab.com/${match[1].replace(/\.git$/, "")}`;
              }
            }

            if (repoUrl) {
              const url = getCompareUrl(
                provider,
                repoUrl,
                branch,
                input.baseBranch,
              );
              if (url) {
                await shell.openExternal(url);
                await git.fetch();
                return { success: true, url };
              }
            }
          }

          // Fallback to GitHub-only logic for backwards compatibility
          const repoMatch = remoteUrl
            .trim()
            .match(/github\.com[:/](.+?)(?:\.git)?$/);

          if (!repoMatch) {
            throw new Error(
              "Could not determine repository URL. Ensure the remote is configured for GitHub or GitLab.",
            );
          }

          const repo = repoMatch[1].replace(/\.git$/, "");
          const url = `https://github.com/${repo}/compare/${branch}?expand=1`;

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
