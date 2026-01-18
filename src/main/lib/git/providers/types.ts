import type { GitProvider } from "../index";

/** Single CI/CD check item - provider agnostic */
export interface CheckItem {
  name: string;
  status: "success" | "failure" | "pending" | "skipped" | "cancelled";
  url?: string;
}

/** Merge/Pull Request state - normalized across providers */
export type MergeRequestState = "open" | "draft" | "merged" | "closed";

/** Review decision - normalized */
export type ReviewDecision = "approved" | "changes_requested" | "pending";

/** Checks/Pipeline status - normalized */
export type ChecksStatus = "success" | "failure" | "pending" | "none";

/** Provider-agnostic PR/MR status */
export interface GitHostStatus {
  /** The provider type */
  provider: GitProvider;

  /** PR/MR info (null if none exists for branch) */
  mergeRequest: {
    /** PR number (GitHub) or MR IID (GitLab) */
    number: number;
    title: string;
    url: string;
    state: MergeRequestState;
    mergedAt?: number;
    additions: number;
    deletions: number;
    reviewDecision: ReviewDecision;
    checksStatus: ChecksStatus;
    checks: CheckItem[];
  } | null;

  /** Repository web URL */
  repoUrl: string;

  /** Whether current branch exists on remote */
  branchExistsOnRemote: boolean;

  /** Timestamp of last refresh */
  lastRefreshed: number;
}

/** Git host provider interface */
export interface GitHostProvider {
  /** Provider identifier */
  readonly id: GitProvider;

  /** CLI tool name (for error messages) */
  readonly cliToolName: string;

  /** Fetch MR/PR status for a worktree path */
  fetchStatus(worktreePath: string): Promise<GitHostStatus | null>;

  /** Get the compare URL for creating a new MR/PR */
  getCompareUrl(repoUrl: string, branch: string, baseBranch: string): string;

  /** Get the CLI merge command and args */
  getMergeCommand(
    mrNumber: number,
    method: "merge" | "squash" | "rebase",
  ): {
    command: string;
    args: string[];
  };
}
