import { eq } from "drizzle-orm";
import simpleGit from "simple-git";
import { z } from "zod";
import { chats, getDatabase } from "../db";
import { publicProcedure, router } from "../trpc";
import { gitQueue } from "./git-queue";
import {
  assertRegisteredWorktree,
  getRegisteredChat,
  gitSwitchBranch,
} from "./security";

export const createBranchesRouter = () => {
  return router({
    getBranches: publicProcedure
      .input(z.object({ worktreePath: z.string() }))
      .query(
        async ({
          input,
        }): Promise<{
          local: Array<{ branch: string; lastCommitDate: number }>;
          remote: string[];
          defaultBranch: string;
          currentBranch: string;
          checkedOutBranches: Record<string, string>;
        }> => {
          assertRegisteredWorktree(input.worktreePath);
          const git = simpleGit(input.worktreePath);
          const branchSummary = await git.branch(["-a"]);

          const localBranches: string[] = [];
          const remote: string[] = [];

          for (const name of Object.keys(branchSummary.branches)) {
            if (name.startsWith("remotes/origin/")) {
              if (name === "remotes/origin/HEAD") continue;
              const remoteName = name.replace("remotes/origin/", "");
              remote.push(remoteName);
            } else {
              localBranches.push(name);
            }
          }

          const local = await getLocalBranchesWithDates(git, localBranches);
          const defaultBranch = await getDefaultBranch(git, remote);
          const checkedOutBranches = await getCheckedOutBranches(
            git,
            input.worktreePath,
          );

          // Get current branch
          const currentBranch = branchSummary.current || defaultBranch;

          return {
            local,
            remote: remote.sort(),
            defaultBranch,
            currentBranch,
            checkedOutBranches,
          };
        },
      ),

    switchBranch: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          branch: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        const _chat = getRegisteredChat(input.worktreePath);

        // Use git queue to serialize operations and prevent index.lock conflicts
        await gitQueue.enqueue(
          input.worktreePath,
          `switchBranch:${input.branch}`,
          async () => {
            await gitSwitchBranch(input.worktreePath, input.branch);
          },
        );

        // Update the branch in the chat record
        const db = getDatabase();
        db.update(chats)
          .set({ branch: input.branch })
          .where(eq(chats.worktreePath, input.worktreePath))
          .run();

        return { success: true };
      }),

    /**
     * Checkout a branch without updating the chat record in the database.
     * Used when switching to a chat that already has a branch stored.
     */
    checkoutBranch: publicProcedure
      .input(
        z.object({
          projectPath: z.string(),
          branch: z.string(),
        }),
      )
      .mutation(async ({ input }): Promise<{ success: boolean }> => {
        assertRegisteredWorktree(input.projectPath);

        // Use git queue to serialize operations and prevent index.lock conflicts
        await gitQueue.enqueue(
          input.projectPath,
          `checkoutBranch:${input.branch}`,
          async () => {
            await gitSwitchBranch(input.projectPath, input.branch);
          },
        );

        return { success: true };
      }),

    createBranch: publicProcedure
      .input(
        z.object({
          projectPath: z.string(),
          branchName: z.string(),
          baseBranch: z.string(),
        }),
      )
      .mutation(
        async ({
          input,
        }): Promise<{ success: boolean; branchName: string }> => {
          assertRegisteredWorktree(input.projectPath);

          // Use git queue to serialize operations and prevent index.lock conflicts
          await gitQueue.enqueue(
            input.projectPath,
            `createBranch:${input.branchName}`,
            async () => {
              const git = simpleGit(input.projectPath);

              // Check if branch already exists
              const branchSummary = await git.branch(["-a"]);
              const allBranches = Object.keys(branchSummary.branches);

              if (allBranches.includes(input.branchName)) {
                throw new Error(`Branch '${input.branchName}' already exists`);
              }

              // Determine the start point (prefer remote, fallback to local)
              let startPoint = input.baseBranch;
              if (allBranches.includes(`remotes/origin/${input.baseBranch}`)) {
                startPoint = `origin/${input.baseBranch}`;
              }

              // Create and switch to the new branch
              await git.checkout(["-b", input.branchName, startPoint]);
            },
          );

          return { success: true, branchName: input.branchName };
        },
      ),
  });
};

async function getLocalBranchesWithDates(
  git: ReturnType<typeof simpleGit>,
  localBranches: string[],
): Promise<Array<{ branch: string; lastCommitDate: number }>> {
  try {
    const branchInfo = await git.raw([
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(refname:short) %(committerdate:unix)",
      "refs/heads/",
    ]);

    const local: Array<{ branch: string; lastCommitDate: number }> = [];
    for (const line of branchInfo.trim().split("\n")) {
      if (!line) continue;
      const lastSpaceIdx = line.lastIndexOf(" ");
      const branch = line.substring(0, lastSpaceIdx);
      const timestamp = Number.parseInt(line.substring(lastSpaceIdx + 1), 10);
      if (localBranches.includes(branch)) {
        local.push({
          branch,
          lastCommitDate: timestamp * 1000,
        });
      }
    }
    return local;
  } catch {
    return localBranches.map((branch) => ({ branch, lastCommitDate: 0 }));
  }
}

async function getDefaultBranch(
  git: ReturnType<typeof simpleGit>,
  remoteBranches: string[],
): Promise<string> {
  try {
    const headRef = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const match = headRef.match(/refs\/remotes\/origin\/(.+)/);
    if (match) {
      return match[1].trim();
    }
  } catch {
    if (remoteBranches.includes("master") && !remoteBranches.includes("main")) {
      return "master";
    }
  }
  return "main";
}

async function getCheckedOutBranches(
  git: ReturnType<typeof simpleGit>,
  currentWorktreePath: string,
): Promise<Record<string, string>> {
  const checkedOutBranches: Record<string, string> = {};

  try {
    const worktreeList = await git.raw(["worktree", "list", "--porcelain"]);
    const lines = worktreeList.split("\n");
    let currentPath: string | null = null;

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        currentPath = line.substring(9).trim();
      } else if (line.startsWith("branch ")) {
        const branch = line.substring(7).trim().replace("refs/heads/", "");
        if (currentPath && currentPath !== currentWorktreePath) {
          checkedOutBranches[branch] = currentPath;
        }
      }
    }
  } catch {}

  return checkedOutBranches;
}
