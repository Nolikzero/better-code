/**
 * Worktree creation, removal, and lifecycle management.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import simpleGit from "simple-git";
import { animeWorktreeNames } from "./anime-names";
import { getDefaultBranch } from "./branch-detection";
import { isEnoent } from "./git-error-handling";
import { checkGitLfsAvailable } from "./shell-env";
import { getGitEnv } from "./shell-env-utils";

const execFileAsync = promisify(execFile);

async function repoUsesLfs(repoPath: string): Promise<boolean> {
  try {
    const lfsDir = join(repoPath, ".git", "lfs");
    const stats = await stat(lfsDir);
    if (stats.isDirectory()) {
      return true;
    }
  } catch (error) {
    if (!isEnoent(error)) {
      console.warn(`[git] Could not check .git/lfs directory: ${error}`);
    }
  }

  const attributeFiles = [
    join(repoPath, ".gitattributes"),
    join(repoPath, ".git", "info", "attributes"),
    join(repoPath, ".lfsconfig"),
  ];

  for (const filePath of attributeFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      if (content.includes("filter=lfs") || content.includes("[lfs]")) {
        return true;
      }
    } catch (error) {
      if (!isEnoent(error)) {
        console.warn(`[git] Could not read ${filePath}: ${error}`);
      }
    }
  }

  try {
    const git = simpleGit(repoPath);
    const lsFiles = await git.raw(["ls-files"]);
    const sampleFiles = lsFiles.split("\n").filter(Boolean).slice(0, 20);

    if (sampleFiles.length > 0) {
      const checkAttr = await git.raw([
        "check-attr",
        "filter",
        "--",
        ...sampleFiles,
      ]);
      if (checkAttr.includes("filter: lfs")) {
        return true;
      }
    }
  } catch {}

  return false;
}

function generateBranchName(usedBranches: Set<string> = new Set()): string {
  const available = animeWorktreeNames.filter(
    (name) => !usedBranches.has(name),
  );

  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }

  const baseName =
    animeWorktreeNames[Math.floor(Math.random() * animeWorktreeNames.length)];
  let suffix = 2;
  while (usedBranches.has(`${baseName}-${suffix}`)) {
    suffix++;
  }
  return `${baseName}-${suffix}`;
}

async function createWorktree(
  mainRepoPath: string,
  branch: string,
  worktreePath: string,
  startPoint = "origin/main",
): Promise<void> {
  const usesLfs = await repoUsesLfs(mainRepoPath);

  try {
    const parentDir = join(worktreePath, "..");
    await mkdir(parentDir, { recursive: true });

    const env = await getGitEnv();

    if (usesLfs) {
      const lfsAvailable = await checkGitLfsAvailable(env);
      if (!lfsAvailable) {
        throw new Error(
          "This repository uses Git LFS, but git-lfs was not found. " +
            `Please install git-lfs (e.g., 'brew install git-lfs') and run 'git lfs install'.`,
        );
      }
    }

    await execFileAsync(
      "git",
      [
        "-C",
        mainRepoPath,
        "worktree",
        "add",
        worktreePath,
        "-b",
        branch,
        `${startPoint}^{commit}`,
      ],
      { env, timeout: 120_000 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerError = errorMessage.toLowerCase();

    const isLockError =
      lowerError.includes("could not lock") ||
      lowerError.includes("unable to lock") ||
      (lowerError.includes(".lock") && lowerError.includes("file exists"));

    if (isLockError) {
      console.error(
        `Git lock file error during worktree creation: ${errorMessage}`,
      );
      throw new Error(
        "Failed to create worktree: The git repository is locked by another process. " +
          "This usually happens when another git operation is in progress, or a previous operation crashed. " +
          "Please wait for the other operation to complete, or manually remove the lock file " +
          `(e.g., .git/config.lock or .git/index.lock) if you're sure no git operations are running.`,
      );
    }

    const isLfsError =
      lowerError.includes("git-lfs") ||
      lowerError.includes("filter-process") ||
      lowerError.includes("smudge filter") ||
      (lowerError.includes("lfs") && lowerError.includes("not")) ||
      (lowerError.includes("lfs") && usesLfs);

    if (isLfsError) {
      console.error(`Git LFS error during worktree creation: ${errorMessage}`);
      throw new Error(
        "Failed to create worktree: This repository uses Git LFS, but git-lfs was not found or failed. " +
          `Please install git-lfs (e.g., 'brew install git-lfs') and run 'git lfs install'.`,
      );
    }

    console.error(`Failed to create worktree: ${errorMessage}`);
    throw new Error(`Failed to create worktree: ${errorMessage}`);
  }
}

export async function removeWorktree(
  mainRepoPath: string,
  worktreePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const env = await getGitEnv();

    await execFileAsync(
      "git",
      ["-C", mainRepoPath, "worktree", "remove", worktreePath, "--force"],
      { env, timeout: 60_000 },
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to remove worktree: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

export interface WorktreeResult {
  success: boolean;
  worktreePath?: string;
  branch?: string;
  baseBranch?: string;
  error?: string;
}

/**
 * Create a git worktree for a chat.
 */
export async function createWorktreeForChat(
  projectPath: string,
  projectId: string,
  _chatId: string,
  selectedBaseBranch?: string,
  usedBranches?: string[],
): Promise<WorktreeResult> {
  try {
    const git = simpleGit(projectPath);
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
      return { success: true, worktreePath: projectPath };
    }

    const baseBranch =
      selectedBaseBranch || (await getDefaultBranch(projectPath));

    const localBranches = await git.branchLocal();
    const allUsed = new Set([...(usedBranches ?? []), ...localBranches.all]);

    const branch = generateBranchName(allUsed);
    const worktreesDir = join(os.homedir(), ".bettercode", "worktrees");
    const worktreePath = join(worktreesDir, projectId, branch);

    await createWorktree(
      projectPath,
      branch,
      worktreePath,
      `origin/${baseBranch}`,
    );

    return { success: true, worktreePath, branch, baseBranch };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getGitRoot(path: string): Promise<string> {
  try {
    const git = simpleGit(path);
    const root = await git.revparse(["--show-toplevel"]);
    return root.trim();
  } catch (_error) {
    throw new Error(`Not a git repository: ${path}`);
  }
}

export async function worktreeExists(
  mainRepoPath: string,
  worktreePath: string,
): Promise<boolean> {
  try {
    const git = simpleGit(mainRepoPath);
    const worktrees = await git.raw(["worktree", "list", "--porcelain"]);

    const lines = worktrees.split("\n");
    const worktreePrefix = `worktree ${worktreePath}`;
    return lines.some((line) => line.trim() === worktreePrefix);
  } catch (error) {
    console.error(`Failed to check worktree existence: ${error}`);
    throw error;
  }
}

/**
 * Commit all changes in a worktree
 */
export async function commitWorktreeChanges(
  worktreePath: string,
  message: string,
): Promise<{ success: boolean; commitHash?: string; error?: string }> {
  try {
    const git = simpleGit(worktreePath);

    await git.add("-A");

    const status = await git.status();
    const hasChanges = status.staged.length > 0 || status.files.length > 0;

    if (!hasChanges) {
      return { success: false, error: "No changes to commit" };
    }

    const result = await git.commit(message);

    return { success: true, commitHash: result.commit };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Merge worktree branch into base branch
 */
export async function mergeWorktreeToMain(
  projectPath: string,
  worktreeBranch: string,
  baseBranch: string,
): Promise<{ success: boolean; error?: string }> {
  const git = simpleGit(projectPath);

  try {
    await git.checkout(baseBranch);
    await git.merge([worktreeBranch, "--no-edit"]);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    if (errorMsg.includes("CONFLICT") || errorMsg.includes("merge failed")) {
      await git.merge(["--abort"]).catch(() => {});
      return {
        success: false,
        error: "Merge conflicts detected. Please resolve manually.",
      };
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Push worktree branch to remote
 */
export async function pushWorktreeBranch(
  worktreePath: string,
  branch: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const git = simpleGit(worktreePath);

    const remotes = await git.getRemotes();
    if (remotes.length === 0) {
      return { success: false, error: "No remote repository configured" };
    }

    await git.push(["-u", "origin", branch]);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get current git status summary
 */
export async function getGitStatus(worktreePath: string): Promise<{
  hasUncommittedChanges: boolean;
  hasUnpushedCommits: boolean;
  currentBranch: string;
  error?: string;
}> {
  try {
    const git = simpleGit(worktreePath);
    const status = await git.status();

    return {
      hasUncommittedChanges: !status.isClean(),
      hasUnpushedCommits: status.ahead > 0,
      currentBranch: status.current || "",
    };
  } catch (error) {
    return {
      hasUncommittedChanges: false,
      hasUnpushedCommits: false,
      currentBranch: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
