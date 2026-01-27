/**
 * Diff generation: getWorktreeDiff and getWorktreeNumstat.
 */
import simpleGit from "simple-git";
import { getDefaultBranch } from "./branch-detection";
import { LOCK_FILE_EXCLUDES, isLockFile } from "./constants";
import { getDiffCache, setDiffCache } from "./diff-cache";

const MAX_DIFF_BYTES = 512 * 1024; // 512KB default cap

/**
 * Run a diff that includes untracked files by temporarily staging them
 * with `--intent-to-add`, then resetting afterwards.
 */
async function diffWithUntrackedFiles(
  git: ReturnType<typeof simpleGit>,
  untrackedFiles: string[],
  diffArgs: string[],
): Promise<string> {
  if (untrackedFiles.length > 0) {
    await git
      .raw(["add", "--intent-to-add", "--", ...untrackedFiles])
      .catch(() => {});
  }
  try {
    return (await git.diff(diffArgs)) || "";
  } finally {
    if (untrackedFiles.length > 0) {
      await git.raw(["reset", "--", ...untrackedFiles]).catch(() => {});
    }
  }
}

/**
 * Get lightweight diff statistics using `git diff HEAD --numstat`.
 * Returns file count, total additions, and total deletions without the full diff content.
 */
export async function getWorktreeNumstat(
  worktreePath: string,
): Promise<{
  success: boolean;
  fileCount?: number;
  additions?: number;
  deletions?: number;
  error?: string;
}> {
  try {
    const git = simpleGit(worktreePath);
    const raw = await git.diff([
      "HEAD",
      "--numstat",
      "--no-color",
      "--",
      ...LOCK_FILE_EXCLUDES,
    ]);

    let additions = 0;
    let deletions = 0;
    let fileCount = 0;

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      fileCount++;
      // Binary files show "-" for additions/deletions
      const add = parseInt(parts[0]!, 10);
      const del = parseInt(parts[1]!, 10);
      if (!isNaN(add)) additions += add;
      if (!isNaN(del)) deletions += del;
    }

    return { success: true, fileCount, additions, deletions };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get diff for a worktree compared to its base branch.
 * @param worktreePath - Path to the worktree
 * @param baseBranch - The base branch to compare against (if not provided, uses default branch)
 * @param options.uncommittedOnly - If true, only show uncommitted changes (return empty when working tree is clean)
 * @param options.fullDiff - If true, show all changes (committed + uncommitted) vs base branch
 * @param options.skipUntracked - Skip git.status() and untracked file handling — just run git diff HEAD.
 */
export async function getWorktreeDiff(
  worktreePath: string,
  baseBranch?: string,
  options?: {
    uncommittedOnly?: boolean;
    fullDiff?: boolean;
    maxDiffBytes?: number;
    skipUntracked?: boolean;
  },
): Promise<{
  success: boolean;
  diff?: string;
  error?: string;
  truncated?: boolean;
}> {
  // Check diff cache first
  const cached = getDiffCache(worktreePath, options);
  if (cached) {
    return { success: true, diff: cached.diff, truncated: cached.truncated };
  }

  try {
    const git = simpleGit(worktreePath);

    const maxBytes = options?.maxDiffBytes ?? MAX_DIFF_BYTES;
    const capDiff = (
      diff: string,
    ): { diff: string; truncated?: boolean } => {
      if (maxBytes > 0 && diff.length > maxBytes) {
        return { diff: diff.slice(0, maxBytes), truncated: true };
      }
      return { diff };
    };

    const lockFileExcludes = LOCK_FILE_EXCLUDES;

    // Fast path: skip git.status() and just run git diff HEAD.
    if (options?.skipUntracked) {
      try {
        const diff = await git.diff([
          "HEAD",
          "--no-color",
          "--",
          ...lockFileExcludes,
        ]);
        const capped = capDiff(diff || "");
        setDiffCache(worktreePath, options, capped.diff, capped.truncated);
        return { success: true, ...capped };
      } catch {
        setDiffCache(worktreePath, options, "");
        return { success: true, diff: "" };
      }
    }

    const status = await git.status();

    // Full diff mode: show all changes (committed + uncommitted) vs base branch
    if (options?.fullDiff) {
      const targetBranch = baseBranch || (await getDefaultBranch(worktreePath));

      if (!status.isClean()) {
        const untrackedFiles = status.not_added.filter(
          (f) => !isLockFile(f),
        );
        try {
          const diff = await diffWithUntrackedFiles(
            git,
            untrackedFiles,
            [`origin/${targetBranch}`, "--no-color", "--", ...lockFileExcludes],
          );
          const capped = capDiff(diff);
          setDiffCache(worktreePath, options, capped.diff, capped.truncated);
          return { success: true, ...capped };
        } catch {
          setDiffCache(worktreePath, options, "");
          return { success: true, diff: "" };
        }
      }

      // Clean tree: diff HEAD against base
      try {
        const diff = await git.diff([
          `origin/${targetBranch}...HEAD`,
          "--no-color",
          "--",
          ...lockFileExcludes,
        ]);
        const capped = capDiff(diff || "");
        setDiffCache(worktreePath, options, capped.diff, capped.truncated);
        return { success: true, ...capped };
      } catch {
        setDiffCache(worktreePath, options, "");
        return { success: true, diff: "" };
      }
    }

    // Has uncommitted changes - diff against HEAD
    if (!status.isClean()) {
      const untrackedFiles = status.not_added.filter(
        (f) => !isLockFile(f),
      );
      const diff = await diffWithUntrackedFiles(
        git,
        untrackedFiles,
        ["HEAD", "--no-color", "--", ...lockFileExcludes],
      );
      const capped = capDiff(diff);
      setDiffCache(worktreePath, options, capped.diff, capped.truncated);
      return { success: true, ...capped };
    }

    // Working tree is clean
    if (options?.uncommittedOnly) {
      setDiffCache(worktreePath, options, "");
      return { success: true, diff: "" };
    }

    // All committed - diff against base branch (for chat worktrees)
    const targetBranch = baseBranch || (await getDefaultBranch(worktreePath));

    try {
      const diff = await git.diff([
        `origin/${targetBranch}...HEAD`,
        "--no-color",
        "--",
        ...lockFileExcludes,
      ]);
      const capped = capDiff(diff || "");
      return { success: true, ...capped };
    } catch {
      return { success: true, diff: "" };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
