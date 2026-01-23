"use client";

import { Check, GitBranch, Loader2 } from "lucide-react";
import { memo } from "react";
import { RalphIcon } from "../../components/ui/icons";
import { cn } from "../../lib/utils";

interface RalphPrdStatusCardProps {
  input: {
    status: "loading" | "generating" | "complete";
    message?: string;
    goal?: string;
    branchName?: string;
    storyCount?: number;
  };
  output?: {
    goal: string;
    branchName: string;
    stories: Array<{
      id: string;
      title: string;
      priority: number;
      type?: string;
    }>;
  };
  isPending?: boolean;
}

/**
 * Card shown in chat when PRD is being generated or has been generated.
 * Uses modern mono style with subtle animations.
 */
export const RalphPrdStatusCard = memo(function RalphPrdStatusCard({
  input,
  output,
  isPending,
}: RalphPrdStatusCardProps) {
  const isLoading = input.status === "loading" || isPending;
  const isGenerating = input.status === "generating";

  if (isLoading) {
    return (
      <div className="border border-border bg-muted/30 rounded-md">
        <div className="p-3 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              Preparing PRD
            </p>
            <p className="text-xs text-muted-foreground/70 truncate">
              {input.message || "Setting up product requirements generation..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="border border-border bg-muted/30 rounded-md">
        <div className="p-3 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Generating PRD</p>
            <p className="text-xs text-muted-foreground truncate">
              {input.message || "Creating product requirements from plan..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Complete state - show the generated PRD
  const prd = output;
  if (!prd) {
    return null;
  }

  return (
    <div className="border border-border bg-background rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">PRD Generated</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          <code className="bg-muted px-1.5 py-0.5 rounded-md font-mono text-[11px]">
            {prd.branchName}
          </code>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Goal */}
        <p className="text-sm text-muted-foreground">{prd.goal}</p>

        {/* Stories */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <RalphIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {prd.stories.length}{" "}
              {prd.stories.length === 1 ? "Story" : "Stories"}
            </span>
          </div>
          <div className="space-y-1">
            {prd.stories
              .sort((a, b) => a.priority - b.priority)
              .map((story) => (
                <div
                  key={story.id}
                  className={cn(
                    "flex items-start gap-2.5 p-2 rounded-md text-xs",
                    "bg-muted/30 hover:bg-muted/50 transition-colors",
                  )}
                >
                  <span className="text-muted-foreground font-mono shrink-0 w-8">
                    {story.id}
                  </span>
                  <span
                    className={cn(
                      "flex-1",
                      story.type === "research" &&
                        "italic text-muted-foreground",
                    )}
                  >
                    {story.title}
                  </span>
                  {story.type === "research" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase tracking-wide">
                      Research
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
});
