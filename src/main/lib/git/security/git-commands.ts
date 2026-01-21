import simpleGit from "simple-git";
import {
  assertRegisteredWorktree,
  assertValidGitPath,
} from "./path-validation";

/**
 * Git command helpers with semantic naming.
 *
 * Design principle: Different functions for different git semantics.
 * You can't accidentally use file checkout syntax for branch switching.
 *
 * Each function:
 * 1. Validates worktree is registered
 * 2. Validates paths/refs as appropriate
 * 3. Uses the correct git command syntax
 */

/**
 * Switch to a branch.
 *
 * Uses `git switch` (unambiguous branch operation, git 2.23+).
 * Falls back to `git checkout <branch>` for older git versions.
 *
 * Note: `git checkout -- <branch>` is WRONG - that's file checkout syntax.
 */
export async function gitSwitchBranch(
  worktreePath: string,
  branch: string,
): Promise<void> {
  assertRegisteredWorktree(worktreePath);

  // Validate: reject anything that looks like a flag
  if (branch.startsWith("-")) {
    throw new Error("Invalid branch name: cannot start with -");
  }

  // Validate: reject empty branch names
  if (!branch.trim()) {
    throw new Error("Invalid branch name: cannot be empty");
  }

  const git = simpleGit(worktreePath);

  try {
    // Prefer `git switch` - unambiguous branch operation (git 2.23+)
    await git.raw(["switch", branch]);
  } catch (switchError) {
    // Check if it's because `switch` command doesn't exist (old git < 2.23)
    // Git outputs: "git: 'switch' is not a git command. See 'git --help'."
    const errorMessage = String(switchError);
    if (errorMessage.includes("is not a git command")) {
      // Fallback for older git versions
      // Note: checkout WITHOUT -- is correct for branches
      await git.checkout(branch);
    } else {
      throw switchError;
    }
  }
}

/**
 * Checkout (restore) a file path, discarding local changes.
 *
 * Uses `git checkout -- <path>` - the `--` is REQUIRED here
 * to indicate path mode (not branch mode).
 */
export async function gitCheckoutFile(
  worktreePath: string,
  filePath: string,
): Promise<void> {
  assertRegisteredWorktree(worktreePath);
  assertValidGitPath(filePath);

  const git = simpleGit(worktreePath);
  // `--` is correct here - we want path semantics
  await git.checkout(["--", filePath]);
}

/**
 * Stage a file for commit.
 *
 * Uses `git add -- <path>` - the `--` prevents paths starting
 * with `-` from being interpreted as flags.
 */
export async function gitStageFile(
  worktreePath: string,
  filePath: string,
): Promise<void> {
  assertRegisteredWorktree(worktreePath);
  assertValidGitPath(filePath);

  const git = simpleGit(worktreePath);
  await git.add(["--", filePath]);
}

/**
 * Stage all changes for commit.
 *
 * Uses `git add -A` to stage all changes (new, modified, deleted).
 */
export async function gitStageAll(worktreePath: string): Promise<void> {
  assertRegisteredWorktree(worktreePath);

  const git = simpleGit(worktreePath);
  await git.add("-A");
}

/**
 * Unstage a file (remove from staging area).
 *
 * Uses `git reset HEAD -- <path>` to unstage without
 * discarding changes.
 */
export async function gitUnstageFile(
  worktreePath: string,
  filePath: string,
): Promise<void> {
  assertRegisteredWorktree(worktreePath);
  assertValidGitPath(filePath);

  const git = simpleGit(worktreePath);
  await git.reset(["HEAD", "--", filePath]);
}

/**
 * Unstage all files.
 *
 * Uses `git reset HEAD` to unstage all changes without
 * discarding them.
 */
export async function gitUnstageAll(worktreePath: string): Promise<void> {
  assertRegisteredWorktree(worktreePath);

  const git = simpleGit(worktreePath);
  await git.reset(["HEAD"]);
}

/**
 * Stash all uncommitted changes.
 *
 * Uses `git stash push` with optional message.
 * Includes both staged and unstaged changes.
 */
export async function gitStash(
  worktreePath: string,
  message?: string,
): Promise<void> {
  assertRegisteredWorktree(worktreePath);

  const git = simpleGit(worktreePath);
  const args = ["stash", "push"];
  if (message) {
    args.push("-m", message);
  }
  await git.raw(args);
}

/**
 * Pop (apply and remove) the most recent stash.
 *
 * Uses `git stash pop` to apply the most recent stash
 * and remove it from the stash list.
 */
export async function gitStashPop(worktreePath: string): Promise<void> {
  assertRegisteredWorktree(worktreePath);

  const git = simpleGit(worktreePath);
  await git.raw(["stash", "pop"]);
}

/**
 * Check if there are any stashes in the repository.
 *
 * Uses `git stash list` and checks if the output is non-empty.
 */
export async function gitHasStash(worktreePath: string): Promise<boolean> {
  assertRegisteredWorktree(worktreePath);

  const git = simpleGit(worktreePath);
  const result = await git.raw(["stash", "list"]);
  return result.trim().length > 0;
}

/**
 * Stage multiple files for commit.
 *
 * Uses `git add -- <paths>` to stage multiple files at once.
 */
export async function gitStageFiles(
  worktreePath: string,
  filePaths: string[],
): Promise<void> {
  assertRegisteredWorktree(worktreePath);

  // Validate all paths before staging
  for (const filePath of filePaths) {
    assertValidGitPath(filePath);
  }

  const git = simpleGit(worktreePath);
  await git.add(["--", ...filePaths]);
}
