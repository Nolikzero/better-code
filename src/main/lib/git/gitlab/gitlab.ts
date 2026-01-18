import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CheckItem } from "../providers/types";
import { execWithShellEnv } from "../shell-env";
import { branchExistsOnRemote } from "../worktree";
import {
  type GLMRResponse,
  GLMRResponseSchema,
  type GLPipelineJob,
  GLRepoResponseSchema,
} from "./types";

const execFileAsync = promisify(execFile);

/** GitLab MR and branch status */
export interface GitLabStatus {
  mr: {
    number: number; // iid in GitLab terms
    title: string;
    url: string;
    state: "open" | "draft" | "merged" | "closed";
    mergedAt?: number;
    additions: number;
    deletions: number;
    reviewDecision: "approved" | "changes_requested" | "pending";
    checksStatus: "success" | "failure" | "pending" | "none";
    checks: CheckItem[];
  } | null;
  repoUrl: string;
  branchExistsOnRemote: boolean;
  lastRefreshed: number;
}

// Cache for GitLab status (10 second TTL)
const cache = new Map<string, { data: GitLabStatus; timestamp: number }>();
const CACHE_TTL_MS = 10_000;

/**
 * Fetches GitLab MR status for a worktree using the `glab` CLI.
 * Returns null if `glab` is not installed, not authenticated, or on error.
 * Results are cached for 10 seconds.
 */
export async function fetchGitLabMRStatus(
  worktreePath: string,
): Promise<GitLabStatus | null> {
  // Check cache first
  const cached = cache.get(worktreePath);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // First, get the repo URL
    const repoUrl = await getRepoUrl(worktreePath);
    if (!repoUrl) {
      return null;
    }

    // Get current branch name
    const { stdout: branchOutput } = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: worktreePath },
    );
    const branchName = branchOutput.trim();

    // Check if branch exists on remote and get MR info in parallel
    const [branchCheck, mrInfo] = await Promise.all([
      branchExistsOnRemote(worktreePath, branchName),
      getMRForBranch(worktreePath, branchName),
    ]);

    // Convert result to boolean - only "exists" is true
    const existsOnRemote = branchCheck.status === "exists";

    const result: GitLabStatus = {
      mr: mrInfo,
      repoUrl,
      branchExistsOnRemote: existsOnRemote,
      lastRefreshed: Date.now(),
    };

    // Cache the result
    cache.set(worktreePath, { data: result, timestamp: Date.now() });

    return result;
  } catch {
    // Any error (glab not installed, not auth'd, etc.) - return null
    return null;
  }
}

async function getRepoUrl(worktreePath: string): Promise<string | null> {
  try {
    const { stdout } = await execWithShellEnv(
      "glab",
      ["repo", "view", "--output", "json"],
      { cwd: worktreePath },
    );
    const raw = JSON.parse(stdout);
    const result = GLRepoResponseSchema.safeParse(raw);
    if (!result.success) {
      console.error("[GitLab] Repo schema validation failed:", result.error);
      console.error("[GitLab] Raw data:", JSON.stringify(raw, null, 2));
      return null;
    }
    return result.data.web_url;
  } catch {
    return null;
  }
}

async function getMRForBranch(
  worktreePath: string,
  branch: string,
): Promise<GitLabStatus["mr"]> {
  try {
    // Use execWithShellEnv to handle macOS GUI app PATH issues
    const { stdout } = await execWithShellEnv(
      "glab",
      ["mr", "view", branch, "--output", "json"],
      { cwd: worktreePath },
    );
    const raw = JSON.parse(stdout);
    const result = GLMRResponseSchema.safeParse(raw);
    if (!result.success) {
      console.error("[GitLab] MR schema validation failed:", result.error);
      console.error("[GitLab] Raw data:", JSON.stringify(raw, null, 2));
      throw new Error("MR schema validation failed");
    }
    const data = result.data;

    const checks = parsePipelineJobs(data.head_pipeline?.jobs);
    const checksStatus = computePipelineStatus(data.head_pipeline?.status);

    return {
      number: data.iid,
      title: data.title,
      url: data.web_url,
      state: mapMRState(data.state, data.draft),
      mergedAt: data.merged_at ? new Date(data.merged_at).getTime() : undefined,
      additions: data.diff_stats?.additions ?? 0,
      deletions: data.diff_stats?.deletions ?? 0,
      reviewDecision: mapReviewDecision(data.approved, data.approvals_left),
      checksStatus,
      checks,
    };
  } catch (error) {
    // "no merge request found" is not an error - just no MR
    if (
      error instanceof Error &&
      (error.message.includes("no merge request found") ||
        error.message.includes("no open merge request"))
    ) {
      return null;
    }
    // Re-throw other errors to be caught by parent
    throw error;
  }
}

function mapMRState(
  state: GLMRResponse["state"],
  isDraft?: boolean,
): NonNullable<GitLabStatus["mr"]>["state"] {
  if (state === "merged") return "merged";
  if (state === "closed") return "closed";
  if (isDraft) return "draft";
  return "open";
}

function mapReviewDecision(
  approved?: boolean,
  approvalsLeft?: number,
): NonNullable<GitLabStatus["mr"]>["reviewDecision"] {
  if (approved) return "approved";
  if (approvalsLeft !== undefined && approvalsLeft > 0) return "pending";
  // GitLab doesn't have explicit "changes_requested" - it's implicit in discussions
  return "pending";
}

function parsePipelineJobs(jobs?: GLPipelineJob[]): CheckItem[] {
  if (!jobs || jobs.length === 0) {
    return [];
  }

  return jobs.map((job) => {
    let status: CheckItem["status"];
    switch (job.status) {
      case "success":
        status = "success";
        break;
      case "failed":
        status = "failure";
        break;
      case "canceled":
        status = "cancelled";
        break;
      case "skipped":
      case "manual":
        status = "skipped";
        break;
      default:
        status = "pending";
    }

    return {
      name: job.name,
      status,
      url: job.web_url,
    };
  });
}

function computePipelineStatus(
  pipelineStatus?: string,
): NonNullable<GitLabStatus["mr"]>["checksStatus"] {
  if (!pipelineStatus) {
    return "none";
  }

  switch (pipelineStatus) {
    case "success":
      return "success";
    case "failed":
      return "failure";
    case "running":
    case "pending":
    case "created":
      return "pending";
    default:
      return "none";
  }
}
