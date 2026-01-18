import { GitPullRequest } from "lucide-react";
import type { GitHubStatus } from "../../../../main/lib/git/github/types";
import type { GitHostStatus } from "../../../../main/lib/git/providers/types";
import { IconSpinner } from "../../../components/ui/icons";
import { trpc } from "../../../lib/trpc";

interface PrStatusBarProps {
  chatId: string;
  prUrl: string;
  prNumber: number;
}

type PrState = "open" | "draft" | "merged" | "closed";
type ReviewDecision = "approved" | "changes_requested" | "pending";
type GitProvider = "github" | "gitlab" | "bitbucket" | null;

function getStatusLabel(
  state: PrState,
  reviewDecision?: ReviewDecision,
): string {
  if (state === "merged") return "Merged";
  if (state === "closed") return "Closed";
  if (state === "draft") return "Draft";
  if (reviewDecision === "approved") return "Ready to merge";
  if (reviewDecision === "changes_requested") return "Changes requested";
  return "Open";
}

export function PrStatusBar({ chatId, prUrl, prNumber }: PrStatusBarProps) {
  console.log("[PrStatusBar] Rendered with props:", {
    chatId,
    prUrl,
    prNumber,
  });

  // Poll PR status every 30 seconds
  const { data: status, isLoading } = trpc.chats.getPrStatus.useQuery(
    { chatId },
    { refetchInterval: 30000 },
  );

  // Handle both GitHubStatus (legacy) and GitHostStatus (new) response formats
  const provider: GitProvider =
    (status as unknown as GitHostStatus)?.provider ?? "github";
  const pr =
    (status as unknown as GitHostStatus)?.mergeRequest ??
    (status as GitHubStatus | undefined)?.pr ??
    null;
  const prLabel = provider === "gitlab" ? "MR" : "PR";

  console.log("[PrStatusBar] Query state:", {
    isLoading,
    status,
    pr,
    provider,
  });

  const handleOpenPr = () => {
    window.desktopApi.openExternal(prUrl);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 border-b border-border/50">
      {/* PR Link */}
      <button
        onClick={handleOpenPr}
        className="flex items-center gap-1.5 text-sm font-medium hover:underline text-foreground cursor-pointer"
      >
        <GitPullRequest className="h-4 w-4" />
        <span>
          {prLabel} #{prNumber}
        </span>
      </button>

      {/* Status */}
      {isLoading ? (
        <IconSpinner className="h-3.5 w-3.5" />
      ) : pr ? (
        <span className="text-xs font-mono text-muted-foreground">
          {getStatusLabel(
            pr.state as PrState,
            pr.reviewDecision as ReviewDecision,
          )}
        </span>
      ) : null}
    </div>
  );
}
