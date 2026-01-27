/**
 * Branch detection, existence checks, and branch operations.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import simpleGit from "simple-git";
import { DEFAULT_BRANCH_CANDIDATES } from "./constants";
import {
  type BranchExistsResult,
  GIT_EXIT_CODES,
  categorizeGitError,
  isExecFileException,
} from "./git-error-handling";
import { getGitEnv } from "./shell-env-utils";

const execFileAsync = promisify(execFile);

async function hasOriginRemote(mainRepoPath: string): Promise<boolean> {
  try {
    const git = simpleGit(mainRepoPath);
    const remotes = await git.getRemotes();
    return remotes.some((r) => r.name === "origin");
  } catch {
    return false;
  }
}

/**
 * Gets the current branch name (HEAD)
 * @returns The current branch name, or null if in detached HEAD state
 */
export async function getCurrentBranch(repoPath: string): Promise<string | null> {
  const git = simpleGit(repoPath);
  try {
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const trimmed = branch.trim();
    return trimmed === "HEAD" ? null : trimmed;
  } catch {
    return null;
  }
}

export async function getDefaultBranch(mainRepoPath: string): Promise<string> {
  const git = simpleGit(mainRepoPath);

  const hasRemote = await hasOriginRemote(mainRepoPath);

  if (hasRemote) {
    // Try to get the default branch from origin/HEAD
    try {
      const headRef = await git.raw([
        "symbolic-ref",
        "refs/remotes/origin/HEAD",
      ]);
      const match = headRef.trim().match(/refs\/remotes\/origin\/(.+)/);
      if (match) return match[1];
    } catch {}

    // Check remote branches for common default branch names
    try {
      const branches = await git.branch(["-r"]);
      const remoteBranches = branches.all.map((b) => b.replace("origin/", ""));

      for (const candidate of DEFAULT_BRANCH_CANDIDATES) {
        if (remoteBranches.includes(candidate)) {
          return candidate;
        }
      }
    } catch {}

    // Try ls-remote as last resort for remote repos
    try {
      const result = await git.raw(["ls-remote", "--symref", "origin", "HEAD"]);
      const symrefMatch = result.match(/ref:\s+refs\/heads\/(.+?)\tHEAD/);
      if (symrefMatch) {
        return symrefMatch[1];
      }
    } catch {}
  } else {
    // No remote - use the current local branch or check for common branch names
    try {
      const currentBranch = await getCurrentBranch(mainRepoPath);
      if (currentBranch) {
        return currentBranch;
      }
    } catch {}

    // Fallback: check for common default branch names locally
    try {
      const localBranches = await git.branchLocal();
      for (const candidate of DEFAULT_BRANCH_CANDIDATES) {
        if (localBranches.all.includes(candidate)) {
          return candidate;
        }
      }
      if (localBranches.all.length > 0) {
        return localBranches.all[0];
      }
    } catch {}
  }

  return "main";
}

export async function fetchDefaultBranch(
  mainRepoPath: string,
  defaultBranch: string,
): Promise<string> {
  const git = simpleGit(mainRepoPath);
  await git.fetch("origin", defaultBranch);
  const commit = await git.revparse(`origin/${defaultBranch}`);
  return commit.trim();
}

/**
 * Refreshes the local origin/HEAD symref from the remote and returns the current default branch.
 * This detects when the remote repository's default branch has changed (e.g., master -> main).
 */
export async function refreshDefaultBranch(
  mainRepoPath: string,
): Promise<string | null> {
  const git = simpleGit(mainRepoPath);

  const hasRemote = await hasOriginRemote(mainRepoPath);
  if (!hasRemote) {
    return null;
  }

  try {
    await git.remote(["set-head", "origin", "--auto"]);

    const headRef = await git.raw(["symbolic-ref", "refs/remotes/origin/HEAD"]);
    const match = headRef.trim().match(/refs\/remotes\/origin\/(.+)/);
    if (match) {
      return match[1];
    }
  } catch {
    try {
      const result = await git.raw(["ls-remote", "--symref", "origin", "HEAD"]);
      const symrefMatch = result.match(/ref:\s+refs\/heads\/(.+?)\tHEAD/);
      if (symrefMatch) {
        return symrefMatch[1];
      }
    } catch {
      // Network unavailable - caller will use cached value
    }
  }

  return null;
}

export async function checkNeedsRebase(
  worktreePath: string,
  defaultBranch: string,
): Promise<boolean> {
  const git = simpleGit(worktreePath);
  const behindCount = await git.raw([
    "rev-list",
    "--count",
    `HEAD..origin/${defaultBranch}`,
  ]);
  return Number.parseInt(behindCount.trim(), 10) > 0;
}

export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  const git = simpleGit(worktreePath);
  const status = await git.status();
  return !status.isClean();
}

export async function hasUnpushedCommits(worktreePath: string): Promise<boolean> {
  const git = simpleGit(worktreePath);
  try {
    const aheadCount = await git.raw([
      "rev-list",
      "--count",
      "@{upstream}..HEAD",
    ]);
    return Number.parseInt(aheadCount.trim(), 10) > 0;
  } catch {
    try {
      const localCommits = await git.raw([
        "rev-list",
        "--count",
        "HEAD",
        "--not",
        "--remotes",
      ]);
      return Number.parseInt(localCommits.trim(), 10) > 0;
    } catch {
      return false;
    }
  }
}

export { type BranchExistsResult } from "./git-error-handling";

export async function branchExistsOnRemote(
  worktreePath: string,
  branchName: string,
): Promise<BranchExistsResult> {
  const env = await getGitEnv();

  try {
    await execFileAsync(
      "git",
      [
        "-C",
        worktreePath,
        "ls-remote",
        "--exit-code",
        "--heads",
        "origin",
        branchName,
      ],
      { env, timeout: 30_000 },
    );
    return { status: "exists" };
  } catch (error) {
    if (!isExecFileException(error)) {
      return {
        status: "error",
        message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (typeof error.code === "string") {
      if (error.code === "ENOENT") {
        return {
          status: "error",
          message: "Git is not installed or not found in PATH.",
        };
      }
      if (error.code === "ETIMEDOUT") {
        return {
          status: "error",
          message: "Git command timed out. Check your network connection.",
        };
      }
      return {
        status: "error",
        message: `System error: ${error.code}`,
      };
    }

    if (error.killed || error.signal) {
      return {
        status: "error",
        message: "Git command timed out. Check your network connection.",
      };
    }

    if (error.code === GIT_EXIT_CODES.NO_MATCHING_REFS) {
      return { status: "not_found" };
    }

    const errorText = error.stderr || error.message || "";
    return categorizeGitError(errorText);
  }
}

/**
 * Detect which branch a worktree was likely based off of.
 * Uses merge-base to find the closest common ancestor with candidate base branches.
 */
export async function detectBaseBranch(
  worktreePath: string,
  currentBranch: string,
  defaultBranch: string,
): Promise<string | null> {
  const git = simpleGit(worktreePath);

  const candidates = [
    defaultBranch,
    ...DEFAULT_BRANCH_CANDIDATES,
    "development",
  ].filter((b, i, arr) => arr.indexOf(b) === i); // dedupe

  let bestCandidate: string | null = null;
  let bestAheadCount = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === currentBranch) continue;

    try {
      const remoteBranch = `origin/${candidate}`;
      await git.raw(["rev-parse", "--verify", remoteBranch]);

      const mergeBase = await git.raw(["merge-base", "HEAD", remoteBranch]);
      const aheadCount = await git.raw([
        "rev-list",
        "--count",
        `${mergeBase.trim()}..HEAD`,
      ]);

      const count = Number.parseInt(aheadCount.trim(), 10);
      if (count < bestAheadCount) {
        bestAheadCount = count;
        bestCandidate = candidate;
      }
    } catch {}
  }

  return bestCandidate;
}

/**
 * Lists all local and remote branches in a repository
 */
export async function listBranches(
  repoPath: string,
  options?: { fetch?: boolean },
): Promise<{ local: string[]; remote: string[] }> {
  const git = simpleGit(repoPath);

  if (options?.fetch) {
    try {
      await git.fetch(["--prune"]);
    } catch {
      // Ignore fetch errors (e.g., offline)
    }
  }

  const localResult = await git.branchLocal();
  const local = localResult.all;

  const remoteResult = await git.branch(["-r"]);
  const remote = remoteResult.all
    .filter((b) => b.startsWith("origin/") && !b.includes("->"))
    .map((b) => b.replace("origin/", ""));

  return { local, remote };
}

/**
 * Checks if a git ref exists locally (without network access).
 */
export async function refExistsLocally(
  repoPath: string,
  ref: string,
): Promise<boolean> {
  const git = simpleGit(repoPath);
  try {
    await git.raw(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Result of pre-checkout safety checks
 */
export interface CheckoutSafetyResult {
  safe: boolean;
  error?: string;
  hasUncommittedChanges?: boolean;
  hasUntrackedFiles?: boolean;
}

/**
 * Performs safety checks before a branch checkout.
 */
export async function checkBranchCheckoutSafety(
  repoPath: string,
): Promise<CheckoutSafetyResult> {
  const git = simpleGit(repoPath);

  try {
    const status = await git.status();

    const hasChanges =
      status.staged.length > 0 ||
      status.modified.length > 0 ||
      status.deleted.length > 0 ||
      status.created.length > 0 ||
      status.renamed.length > 0 ||
      status.conflicted.length > 0;

    const hasUntrackedFiles = status.not_added.length > 0;

    if (hasChanges) {
      return {
        safe: false,
        error:
          "Cannot switch branches: you have uncommitted changes. Please commit or stash your changes first.",
        hasUncommittedChanges: true,
        hasUntrackedFiles,
      };
    }

    try {
      await git.fetch(["--prune"]);
    } catch {
      // Ignore fetch errors
    }

    return {
      safe: true,
      hasUncommittedChanges: false,
      hasUntrackedFiles: false,
    };
  } catch (error) {
    return {
      safe: false,
      error: `Failed to check repository status: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Checks out a branch in a repository.
 * If the branch only exists on remote, creates a local tracking branch.
 */
export async function checkoutBranch(
  repoPath: string,
  branch: string,
): Promise<void> {
  const git = simpleGit(repoPath);

  const localBranches = await git.branchLocal();
  if (localBranches.all.includes(branch)) {
    await git.checkout(branch);
    return;
  }

  const remoteBranches = await git.branch(["-r"]);
  const remoteBranchName = `origin/${branch}`;
  if (remoteBranches.all.includes(remoteBranchName)) {
    await git.checkout(["-b", branch, "--track", remoteBranchName]);
    return;
  }

  await git.checkout(branch);
}

/**
 * Safe branch checkout that performs safety checks first.
 */
export async function safeCheckoutBranch(
  repoPath: string,
  branch: string,
): Promise<void> {
  const currentBranch = await getCurrentBranch(repoPath);
  if (currentBranch === branch) {
    return;
  }

  const safety = await checkBranchCheckoutSafety(repoPath);
  if (!safety.safe) {
    throw new Error(safety.error);
  }

  await checkoutBranch(repoPath, branch);

  const verifyBranch = await getCurrentBranch(repoPath);
  if (verifyBranch !== branch) {
    throw new Error(
      `Branch checkout verification failed: expected "${branch}" but HEAD is on "${verifyBranch ?? "detached HEAD"}"`,
    );
  }
}
