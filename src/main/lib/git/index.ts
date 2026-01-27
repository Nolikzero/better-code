/**
 * Git module - combines all git-related routers
 * Flattened structure to match Superset API (changes.getStatus, changes.stageFile, etc.)
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { router } from "../trpc";
import { createBranchesRouter } from "./branches";
import { createFileContentsRouter } from "./file-contents";
import { createGitOperationsRouter } from "./git-operations";
import { createStagingRouter } from "./staging";
import { createStatusRouter } from "./status";
import { parseGitRemoteUrl } from "./utils/parse-remote-url";

const execAsync = promisify(exec);

// Re-export branch watcher
export { branchWatcher } from "./branch-watcher";
// Re-export GitHub utilities
export * from "./github";
// Re-export GitLab utilities
export * from "./gitlab";
// Re-export provider utilities (excluding CheckItem to avoid conflict with github/types)
export {
  fetchGitHostStatus,
  getMergeCommand,
} from "./providers";
// Re-export worktree utilities
export * from "./worktree";
// Re-export multi-repo utilities
export * from "./multi-repo";
// Re-export types

/**
 * Combined git router with flattened procedures
 * This matches Superset's changes router API structure
 */
export const createGitRouter = () => {
  return router({
    // Merge all sub-router procedures at top level
    ...createStatusRouter()._def.procedures,
    ...createStagingRouter()._def.procedures,
    ...createGitOperationsRouter()._def.procedures,
    ...createBranchesRouter()._def.procedures,
    ...createFileContentsRouter()._def.procedures,
  });
};

// ============ GIT REMOTE INFO ============

export type GitProvider = "github" | "gitlab" | "bitbucket" | null;

export interface GitRemoteInfo {
  remoteUrl: string | null;
  provider: GitProvider;
  owner: string | null;
  repo: string | null;
}

/**
 * Check if a path is a git repository
 */
async function isGitRepo(path: string): Promise<boolean> {
  try {
    await execAsync("git rev-parse --git-dir", { cwd: path });
    return true;
  } catch {
    return false;
  }
}

// parseGitRemoteUrl is imported from ./utils/parse-remote-url

/**
 * Get git remote info for a project path
 * Extracts remote URL, provider (github/gitlab/bitbucket), owner, and repo name
 */
export async function getGitRemoteInfo(
  projectPath: string,
): Promise<GitRemoteInfo> {
  const emptyResult: GitRemoteInfo = {
    remoteUrl: null,
    provider: null,
    owner: null,
    repo: null,
  };

  // Check if it's a git repo
  const isRepo = await isGitRepo(projectPath);
  if (!isRepo) {
    return emptyResult;
  }

  try {
    // Get the remote URL for origin
    const { stdout } = await execAsync("git remote get-url origin", {
      cwd: projectPath,
    });

    const remoteUrl = stdout.trim();
    if (!remoteUrl) {
      return emptyResult;
    }

    const parsed = parseGitRemoteUrl(remoteUrl);

    return {
      remoteUrl,
      provider: parsed.provider,
      owner: parsed.owner,
      repo: parsed.repo,
    };
  } catch {
    // No remote configured or other error
    return emptyResult;
  }
}
