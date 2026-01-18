import { fetchGitLabMRStatus } from "../gitlab/gitlab";
import type { GitHostProvider, GitHostStatus } from "./types";

/**
 * GitLab adapter - wraps GitLab implementation to conform to GitHostProvider interface
 */
export const gitlabAdapter: GitHostProvider = {
  id: "gitlab",
  cliToolName: "glab",

  async fetchStatus(worktreePath: string): Promise<GitHostStatus | null> {
    const status = await fetchGitLabMRStatus(worktreePath);
    if (!status) {
      return null;
    }

    // Map GitLabStatus to GitHostStatus
    return {
      provider: "gitlab",
      mergeRequest: status.mr
        ? {
            number: status.mr.number,
            title: status.mr.title,
            url: status.mr.url,
            state: status.mr.state,
            mergedAt: status.mr.mergedAt,
            additions: status.mr.additions,
            deletions: status.mr.deletions,
            reviewDecision: status.mr.reviewDecision,
            checksStatus: status.mr.checksStatus,
            checks: status.mr.checks,
          }
        : null,
      repoUrl: status.repoUrl,
      branchExistsOnRemote: status.branchExistsOnRemote,
      lastRefreshed: status.lastRefreshed,
    };
  },

  getCompareUrl(repoUrl: string, branch: string, baseBranch: string): string {
    // GitLab MR creation URL format
    const encodedBranch = encodeURIComponent(branch);
    const encodedBase = encodeURIComponent(baseBranch);
    return `${repoUrl}/-/merge_requests/new?merge_request[source_branch]=${encodedBranch}&merge_request[target_branch]=${encodedBase}`;
  },

  getMergeCommand(
    mrNumber: number,
    method: "merge" | "squash" | "rebase",
  ): { command: string; args: string[] } {
    const args = ["mr", "merge", String(mrNumber)];
    if (method === "squash") {
      args.push("--squash");
    } else if (method === "rebase") {
      args.push("--rebase");
    }
    args.push("--remove-source-branch", "--yes");
    return { command: "glab", args };
  },
};
