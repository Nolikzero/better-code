import type { GitProvider } from "../index";
import { githubAdapter } from "./github-adapter";
import { gitlabAdapter } from "./gitlab-adapter";
import type { GitHostProvider, GitHostStatus } from "./types";

/**
 * Get the appropriate git host provider adapter based on the provider type
 */
function getGitHostProvider(provider: GitProvider): GitHostProvider | null {
  switch (provider) {
    case "github":
      return githubAdapter;
    case "gitlab":
      return gitlabAdapter;
    case "bitbucket":
      // Bitbucket not yet implemented
      return null;
    default:
      return null;
  }
}

/**
 * Fetch git host status using the appropriate provider
 * This is a convenience function that handles provider lookup
 */
export async function fetchGitHostStatus(
  worktreePath: string,
  provider: GitProvider,
): Promise<GitHostStatus | null> {
  const adapter = getGitHostProvider(provider);
  if (!adapter) {
    return null;
  }
  return adapter.fetchStatus(worktreePath);
}

/**
 * Get the compare URL for creating a new MR/PR
 */
export function getCompareUrl(
  provider: GitProvider,
  repoUrl: string,
  branch: string,
  baseBranch: string,
): string | null {
  const adapter = getGitHostProvider(provider);
  if (!adapter) {
    return null;
  }
  return adapter.getCompareUrl(repoUrl, branch, baseBranch);
}

/**
 * Get the CLI merge command for a provider
 */
export function getMergeCommand(
  provider: GitProvider,
  mrNumber: number,
  method: "merge" | "squash" | "rebase",
): { command: string; args: string[] } | null {
  const adapter = getGitHostProvider(provider);
  if (!adapter) {
    return null;
  }
  return adapter.getMergeCommand(mrNumber, method);
}
