import type { GitHubStatus } from "../../../main/lib/git/github/types";
import { trpc } from "../../lib/trpc";

interface UsePRStatusOptions {
	worktreePath: string | undefined;
	enabled?: boolean;
	refetchInterval?: number;
}

interface UsePRStatusResult {
	pr: GitHubStatus["pr"] | null;
	repoUrl: string | null;
	branchExistsOnRemote: boolean;
	isLoading: boolean;
	refetch: () => void;
}

/**
 * Hook to fetch and manage GitHub PR status for a worktree.
 * Returns PR info, loading state, and refetch function.
 */
export function usePRStatus({
	worktreePath,
	enabled = true,
	refetchInterval = 10000,
}: UsePRStatusOptions): UsePRStatusResult {
	const {
		data: githubStatus,
		isLoading,
		refetch,
	} = trpc.changes.getGitHubStatus.useQuery(
		{ worktreePath: worktreePath! },
		{
			enabled: enabled && !!worktreePath,
			refetchInterval,
		},
	);

	return {
		pr: githubStatus?.pr ?? null,
		repoUrl: githubStatus?.repoUrl ?? null,
		branchExistsOnRemote: githubStatus?.branchExistsOnRemote ?? false,
		isLoading,
		refetch,
	};
}
