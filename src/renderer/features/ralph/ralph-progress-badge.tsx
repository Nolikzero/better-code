import { useAtomValue } from "jotai";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, RalphIcon } from "../../components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";
import { ralphPrdStatusesAtom } from "../agents/atoms";

interface RalphProgressBadgeProps {
  subChatId: string;
  className?: string;
}

interface UserStory {
  id: string;
  title: string;
  description: string;
  priority: number;
  acceptanceCriteria: string[];
  passes: boolean;
  notes?: string;
}

export function RalphProgressBadge({
  subChatId,
  className,
}: RalphProgressBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: ralphState, refetch } = trpc.ralph.getState.useQuery(
    { subChatId },
    {
      enabled: !!subChatId,
    },
  );

  // Listen for ralph-state-changed events to refetch data
  useEffect(() => {
    const handler = (event: CustomEvent<{ subChatId: string }>) => {
      if (event.detail?.subChatId === subChatId) {
        console.log(
          "[ralph-badge] Received ralph-state-changed, refetching for subChatId:",
          subChatId,
        );
        refetch();
      }
    };

    window.addEventListener("ralph-state-changed", handler as EventListener);
    return () =>
      window.removeEventListener(
        "ralph-state-changed",
        handler as EventListener,
      );
  }, [subChatId, refetch]);

  // Mutation to mark story complete
  const markCompleteMutation = trpc.ralph.markStoryComplete.useMutation({
    onSuccess: () => {
      utils.ralph.getState.invalidate({ subChatId });
    },
  });

  // Mutation to mark story incomplete
  const markIncompleteMutation = trpc.ralph.markStoryIncomplete.useMutation({
    onSuccess: () => {
      utils.ralph.getState.invalidate({ subChatId });
    },
  });

  // Toggle story completion status
  const handleToggleStory = (storyId: string, currentPasses: boolean) => {
    if (currentPasses) {
      markIncompleteMutation.mutate({ subChatId, storyId });
    } else {
      markCompleteMutation.mutate({ subChatId, storyId });
    }
  };

  const prdStatuses = useAtomValue(ralphPrdStatusesAtom);
  const prdStatus = useMemo(() => {
    return prdStatuses.get(subChatId) || null;
  }, [prdStatuses, subChatId]);
  const isGenerating = prdStatus?.status === "generating";
  // Bridge: keep loader visible until query refetches after generation completes
  const isPrdPendingRefetch =
    prdStatus?.status === "complete" && !ralphState?.hasPrd;

  // Track if we saw the "generating" animation during this mount cycle
  const [hasShownGenerating, setHasShownGenerating] = useState(false);
  const [showGeneratedFlash, setShowGeneratedFlash] = useState(false);

  useEffect(() => {
    if (isGenerating) {
      setHasShownGenerating(true);
    }
  }, [isGenerating]);

  // If we mount directly into "complete + hasPrd" without having seen "generating",
  // show a brief flash to indicate PRD was generated while viewing another chat
  useEffect(() => {
    if (
      prdStatus?.status === "complete" &&
      !hasShownGenerating &&
      ralphState?.hasPrd
    ) {
      setShowGeneratedFlash(true);
      const timer = setTimeout(() => setShowGeneratedFlash(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [prdStatus?.status, hasShownGenerating, ralphState?.hasPrd]);

  // Show loader during PRD generation (and briefly after, until query catches up)
  if (isGenerating || isPrdPendingRefetch) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md bg-muted/50 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Generating...</span>
      </div>
    );
  }

  // Brief flash when PRD was generated while component was unmounted
  if (showGeneratedFlash) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md bg-green-500/10 text-green-600 dark:text-green-400",
          className,
        )}
      >
        <CheckIcon className="h-3 w-3" />
        <span>PRD Generated!</span>
      </div>
    );
  }

  // Don't render if no PRD exists
  if (!ralphState?.hasPrd || !ralphState.prd) {
    return null;
  }

  const { stats, isComplete, prd } = ralphState;
  const stories = prd.stories as UserStory[];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md transition-colors",
            isComplete
              ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
              : "bg-muted/50 text-muted-foreground hover:bg-muted",
            className,
          )}
        >
          {isComplete ? (
            <CheckIcon className="h-3 w-3" />
          ) : (
            <RalphIcon className="h-3 w-3" />
          )}
          <span>
            {stats.completed}/{stats.total}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden"
      >
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Ralph Progress</h4>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                isComplete
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isComplete ? "Complete" : `${stats.completed}/${stats.total}`}
            </span>
          </div>
          {prd.goal && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {prd.goal}
            </p>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {stories
            .sort((a, b) => a.priority - b.priority)
            .map((story) => (
              <div
                key={story.id}
                className={cn(
                  "px-3 py-2 border-b border-border last:border-b-0",
                  story.passes ? "bg-green-500/5" : "",
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStory(story.id, story.passes);
                    }}
                    disabled={
                      markCompleteMutation.isPending ||
                      markIncompleteMutation.isPending
                    }
                    className={cn(
                      "mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer",
                      story.passes
                        ? "border-green-500 bg-green-500 hover:bg-green-600 hover:border-green-600"
                        : "border-muted-foreground/30 hover:border-muted-foreground/50",
                      (markCompleteMutation.isPending ||
                        markIncompleteMutation.isPending) &&
                        "opacity-50 cursor-wait",
                    )}
                    title={
                      story.passes ? "Mark as incomplete" : "Mark as complete"
                    }
                  >
                    {story.passes && (
                      <CheckIcon className="h-2.5 w-2.5 text-white" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {story.id}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        P{story.priority}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-xs",
                        story.passes
                          ? "text-muted-foreground line-through"
                          : "text-foreground",
                      )}
                    >
                      {story.title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
