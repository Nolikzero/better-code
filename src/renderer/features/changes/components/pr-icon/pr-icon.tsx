import { CircleDot, GitMerge, GitPullRequest } from "lucide-react";
import { cn } from "../../../../lib/utils";

export type PRState = "open" | "merged" | "closed" | "draft";

interface PRIconProps {
  state: PRState;
  className?: string;
}

const stateStyles: Record<PRState, string> = {
  open: "text-emerald-500",
  merged: "text-violet-500",
  closed: "text-red-500",
  draft: "text-muted-foreground",
};

/**
 * Renders a PR icon with color based on state.
 * - open: green pull request icon
 * - merged: purple/violet merge icon
 * - closed: red dot icon
 * - draft: muted pull request icon
 */
export function PRIcon({ state, className }: PRIconProps) {
  const baseClass = cn(stateStyles[state], className);

  if (state === "merged") {
    return <GitMerge className={baseClass} />;
  }

  if (state === "closed") {
    return <CircleDot className={baseClass} />;
  }

  // open or draft
  return <GitPullRequest className={baseClass} />;
}
