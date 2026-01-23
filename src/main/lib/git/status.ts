import { observable } from "@trpc/server/observable";
import simpleGit from "simple-git";
import { z } from "zod";
import type {
  ChangedFile,
  GitChangesStatus,
} from "../../../shared/changes-types";
import { publicProcedure, router } from "../trpc";
import { fileWatcher, type GitChangeEvent } from "../watcher/file-watcher";
import { type BranchChangeEvent, branchWatcher } from "./branch-watcher";
import { assertRegisteredWorktree, secureFs } from "./security";
import { applyNumstatToFiles } from "./utils/apply-numstat";
import {
  parseGitLog,
  parseGitStatus,
  parseNameStatus,
} from "./utils/parse-status";
import { getDefaultBranch, getWorktreeDiff } from "./worktree";

// TTL cache for getStatus results to prevent redundant git subprocess calls
const statusCache = new Map<
  string,
  { data: GitChangesStatus; timestamp: number }
>();
const STATUS_CACHE_TTL = 1000; // 1 second

export const createStatusRouter = () => {
  return router({
    getStatus: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          defaultBranch: z.string().optional(),
        }),
      )
      .query(async ({ input }): Promise<GitChangesStatus> => {
        assertRegisteredWorktree(input.worktreePath);

        // Return cached result if still fresh
        const cached = statusCache.get(input.worktreePath);
        if (cached && Date.now() - cached.timestamp < STATUS_CACHE_TTL) {
          return cached.data;
        }

        const git = simpleGit(input.worktreePath);
        const defaultBranch =
          input.defaultBranch || (await getDefaultBranch(input.worktreePath));

        const status = await git.status();
        const parsed = parseGitStatus(status);

        const branchComparison = await getBranchComparison(git, defaultBranch);
        const trackingStatus = await getTrackingBranchStatus(git);

        await applyNumstatToFiles(git, parsed.staged, [
          "diff",
          "--cached",
          "--numstat",
        ]);

        await applyNumstatToFiles(git, parsed.unstaged, ["diff", "--numstat"]);

        await applyUntrackedLineCount(input.worktreePath, parsed.untracked);

        const result = {
          branch: parsed.branch,
          defaultBranch,
          againstBase: branchComparison.againstBase,
          commits: branchComparison.commits,
          staged: parsed.staged,
          unstaged: parsed.unstaged,
          untracked: parsed.untracked,
          ahead: branchComparison.ahead,
          behind: branchComparison.behind,
          pushCount: trackingStatus.pushCount,
          pullCount: trackingStatus.pullCount,
          hasUpstream: trackingStatus.hasUpstream,
        };

        statusCache.set(input.worktreePath, {
          data: result,
          timestamp: Date.now(),
        });
        return result;
      }),

    getCommitFiles: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          commitHash: z.string(),
        }),
      )
      .query(async ({ input }): Promise<ChangedFile[]> => {
        assertRegisteredWorktree(input.worktreePath);

        const git = simpleGit(input.worktreePath);

        const nameStatus = await git.raw([
          "diff-tree",
          "--root",
          "--no-commit-id",
          "--name-status",
          "-r",
          input.commitHash,
        ]);
        const files = parseNameStatus(nameStatus);

        await applyNumstatToFiles(git, files, [
          "diff-tree",
          "--root",
          "--no-commit-id",
          "--numstat",
          "-r",
          input.commitHash,
        ]);

        return files;
      }),

    /**
     * Get unified diff for a single commit by worktree path.
     * Works for both chat worktrees and project paths.
     */
    getCommitDiff: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          commitHash: z.string(),
        }),
      )
      .query(async ({ input }) => {
        assertRegisteredWorktree(input.worktreePath);

        const git = simpleGit(input.worktreePath);
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
          } catch (e) {
            return {
              diff: null,
              error: e instanceof Error ? e.message : "Unknown error",
            };
          }
        }
      }),

    /**
     * Get the full diff (committed + uncommitted) against the base/default branch.
     * Works for both chat worktrees and project paths.
     */
    getFullDiff: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          baseBranch: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        assertRegisteredWorktree(input.worktreePath);

        const result = await getWorktreeDiff(
          input.worktreePath,
          input.baseBranch,
          { fullDiff: true },
        );

        if (!result.success) {
          return { diff: null, error: result.error };
        }

        return { diff: result.diff || "" };
      }),

    /**
     * Lightweight query that only fetches commit history (single git log command).
     * Use this instead of getStatus when you only need the commit list.
     */
    getCommits: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          defaultBranch: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        assertRegisteredWorktree(input.worktreePath);
        const git = simpleGit(input.worktreePath);
        const defaultBranch =
          input.defaultBranch || (await getDefaultBranch(input.worktreePath));

        try {
          const logOutput = await git.raw([
            "log",
            `origin/${defaultBranch}..HEAD`,
            "--format=%H|%h|%s|%an|%aI",
          ]);
          return { commits: parseGitLog(logOutput), defaultBranch };
        } catch {
          return { commits: [], defaultBranch };
        }
      }),

    /**
     * Subscribe to git status changes for real-time updates
     */
    watchGitStatus: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          subscriberId: z.string(),
        }),
      )
      .subscription(({ input }) => {
        const { worktreePath, subscriberId } = input;

        return observable<GitChangeEvent>((emit) => {
          const eventName = `git:${worktreePath}`;

          const onGitChange = (event: GitChangeEvent) => {
            emit.next(event);
          };

          // Start watching and subscribe to events
          fileWatcher.watchGitStatus(worktreePath, subscriberId);
          fileWatcher.on(eventName, onGitChange);

          // Return cleanup function
          return () => {
            fileWatcher.off(eventName, onGitChange);
            fileWatcher.unwatchGitStatus(worktreePath, subscriberId);
          };
        });
      }),

    /**
     * Subscribe to branch changes for a chat's worktree.
     * Watches the HEAD file and emits events when the branch changes.
     */
    watchBranchChange: publicProcedure
      .input(
        z.object({
          chatId: z.string(),
          worktreePath: z.string(),
          subscriberId: z.string(),
        }),
      )
      .subscription(({ input }) => {
        const { chatId, worktreePath, subscriberId } = input;

        return observable<BranchChangeEvent>((emit) => {
          const eventName = `branch:${chatId}`;

          const onBranchChange = (event: BranchChangeEvent) => {
            emit.next(event);
          };

          branchWatcher
            .watch(chatId, worktreePath, subscriberId)
            .catch((err) => {
              console.error(
                "[watchBranchChange] Failed to start watcher:",
                err,
              );
            });
          branchWatcher.on(eventName, onBranchChange);

          return () => {
            branchWatcher.off(eventName, onBranchChange);
            branchWatcher.unwatch(chatId, subscriberId);
          };
        });
      }),
  });
};

interface BranchComparison {
  commits: GitChangesStatus["commits"];
  againstBase: ChangedFile[];
  ahead: number;
  behind: number;
}

async function getBranchComparison(
  git: ReturnType<typeof simpleGit>,
  defaultBranch: string,
): Promise<BranchComparison> {
  let commits: GitChangesStatus["commits"] = [];
  let againstBase: ChangedFile[] = [];
  let ahead = 0;
  let behind = 0;

  try {
    const tracking = await git.raw([
      "rev-list",
      "--left-right",
      "--count",
      `origin/${defaultBranch}...HEAD`,
    ]);
    const [behindStr, aheadStr] = tracking.trim().split(/\s+/);
    behind = Number.parseInt(behindStr || "0", 10);
    ahead = Number.parseInt(aheadStr || "0", 10);

    const logOutput = await git.raw([
      "log",
      `origin/${defaultBranch}..HEAD`,
      "--format=%H|%h|%s|%an|%aI",
    ]);
    commits = parseGitLog(logOutput);

    if (ahead > 0) {
      const nameStatus = await git.raw([
        "diff",
        "--name-status",
        `origin/${defaultBranch}...HEAD`,
      ]);
      againstBase = parseNameStatus(nameStatus);

      await applyNumstatToFiles(git, againstBase, [
        "diff",
        "--numstat",
        `origin/${defaultBranch}...HEAD`,
      ]);
    }
  } catch {}

  return { commits, againstBase, ahead, behind };
}

/** Max file size for line counting (1 MiB) - skip larger files to avoid OOM */
const MAX_LINE_COUNT_SIZE = 1 * 1024 * 1024;

async function applyUntrackedLineCount(
  worktreePath: string,
  untracked: ChangedFile[],
): Promise<void> {
  for (const file of untracked) {
    try {
      const stats = await secureFs.stat(worktreePath, file.path);
      if (stats.size > MAX_LINE_COUNT_SIZE) continue;

      const content = await secureFs.readFile(worktreePath, file.path);
      const lineCount = content.split("\n").length;
      file.additions = lineCount;
      file.deletions = 0;
    } catch {
      // Skip files that fail validation or reading
    }
  }
}

interface TrackingStatus {
  pushCount: number;
  pullCount: number;
  hasUpstream: boolean;
}

async function getTrackingBranchStatus(
  git: ReturnType<typeof simpleGit>,
): Promise<TrackingStatus> {
  try {
    const upstream = await git.raw([
      "rev-parse",
      "--abbrev-ref",
      "@{upstream}",
    ]);
    if (!upstream.trim()) {
      return { pushCount: 0, pullCount: 0, hasUpstream: false };
    }

    const tracking = await git.raw([
      "rev-list",
      "--left-right",
      "--count",
      "@{upstream}...HEAD",
    ]);
    const [pullStr, pushStr] = tracking.trim().split(/\s+/);
    return {
      pushCount: Number.parseInt(pushStr || "0", 10),
      pullCount: Number.parseInt(pullStr || "0", 10),
      hasUpstream: true,
    };
  } catch {
    return { pushCount: 0, pullCount: 0, hasUpstream: false };
  }
}
