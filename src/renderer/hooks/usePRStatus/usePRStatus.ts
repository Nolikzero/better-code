import type { GitHubStatus } from "../../../main/lib/git/github/types";
import type { GitHostStatus } from "../../../main/lib/git/providers/types";
import { trpc } from "../../lib/trpc";

type GitProvider = "github" | "gitlab" | "bitbucket" | null;

interface UsePRStatusOptions {
  worktreePath: string | undefined;
  enabled?: boolean;
  refetchInterval?: number;
}

interface UsePRStatusResult {
  pr: GitHubStatus["pr"] | null;
  repoUrl: string | null;
  branchExistsOnRemote: boolean;
  provider: GitProvider;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch and manage PR/MR status for a worktree.
 * Returns PR/MR info, provider type, loading state, and refetch function.
 * Works with both GitHub (PR) and GitLab (MR).
 */
export function usePRStatus({
  worktreePath,
  enabled = true,
  refetchInterval = 10000,
}: UsePRStatusOptions): UsePRStatusResult {
  const {
    data: status,
    isLoading,
    refetch,
  } = trpc.changes.getGitHubStatus.useQuery(
    { worktreePath: worktreePath! },
    {
      enabled: enabled && !!worktreePath,
      refetchInterval,
    },
  );

  // Detect provider from status response
  // GitHostStatus has 'provider' field, GitHubStatus (legacy) doesn't
  const provider: GitProvider =
    (status as unknown as GitHostStatus)?.provider ??
    (status?.pr ? "github" : null);

  // Map GitHostStatus.mergeRequest to pr for backwards compatibility
  const pr =
    (status as unknown as GitHostStatus)?.mergeRequest ??
    (status as GitHubStatus | undefined)?.pr ??
    null;

  return {
    pr,
    repoUrl: status?.repoUrl ?? null,
    branchExistsOnRemote: status?.branchExistsOnRemote ?? false,
    provider,
    isLoading,
    refetch,
  };
}
