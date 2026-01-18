import { fetchGitHubPRStatus } from "../github/github";
import type { GitHostProvider, GitHostStatus } from "./types";

/**
 * GitHub adapter - wraps existing GitHub implementation to conform to GitHostProvider interface
 */
export const githubAdapter: GitHostProvider = {
  id: "github",
  cliToolName: "gh",

  async fetchStatus(worktreePath: string): Promise<GitHostStatus | null> {
    const status = await fetchGitHubPRStatus(worktreePath);
    if (!status) {
      return null;
    }

    // Map GitHubStatus to GitHostStatus
    return {
      provider: "github",
      mergeRequest: status.pr
        ? {
            number: status.pr.number,
            title: status.pr.title,
            url: status.pr.url,
            state: status.pr.state,
            mergedAt: status.pr.mergedAt,
            additions: status.pr.additions,
            deletions: status.pr.deletions,
            reviewDecision: status.pr.reviewDecision,
            checksStatus: status.pr.checksStatus,
            checks: status.pr.checks,
          }
        : null,
      repoUrl: status.repoUrl,
      branchExistsOnRemote: status.branchExistsOnRemote,
      lastRefreshed: status.lastRefreshed,
    };
  },

  getCompareUrl(repoUrl: string, branch: string, baseBranch: string): string {
    // GitHub compare URL format
    return `${repoUrl}/compare/${baseBranch}...${encodeURIComponent(branch)}?expand=1`;
  },

  getMergeCommand(
    mrNumber: number,
    method: "merge" | "squash" | "rebase",
  ): { command: string; args: string[] } {
    const args = ["pr", "merge", String(mrNumber), `--${method}`];
    if (method === "squash" || method === "merge") {
      args.push("--delete-branch");
    }
    return { command: "gh", args };
  },
};
