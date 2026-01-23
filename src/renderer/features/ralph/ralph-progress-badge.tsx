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
  chatId: string;
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
  chatId,
  className,
}: RalphProgressBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: ralphState, refetch } = trpc.ralph.getState.useQuery(
    { chatId },
    {
      enabled: !!chatId,
    },
  );

  // Listen for ralph-state-changed events to refetch data
  useEffect(() => {
    const handler = (event: CustomEvent<{ chatId: string }>) => {
      // Refetch if event is for this chatId or if chatId matches
      if (event.detail?.chatId === chatId) {
        console.log(
          "[ralph-badge] Received ralph-state-changed, refetching for chatId:",
          chatId,
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
  }, [chatId, refetch]);

  // Mutation to mark story complete
  const markCompleteMutation = trpc.ralph.markStoryComplete.useMutation({
    onSuccess: () => {
      utils.ralph.getState.invalidate({ chatId });
    },
  });

  // Mutation to mark story incomplete
  const markIncompleteMutation = trpc.ralph.markStoryIncomplete.useMutation({
    onSuccess: () => {
      utils.ralph.getState.invalidate({ chatId });
    },
  });

  // Toggle story completion status
  const handleToggleStory = (storyId: string, currentPasses: boolean) => {
    if (currentPasses) {
      markIncompleteMutation.mutate({ chatId, storyId });
    } else {
      markCompleteMutation.mutate({ chatId, storyId });
    }
  };

  const prdStatuses = useAtomValue(ralphPrdStatusesAtom);
  const prdStatus = useMemo(() => {
    for (const [, status] of prdStatuses) {
      if (status.chatId === chatId) return status;
    }
    return null;
  }, [prdStatuses, chatId]);
  const isGenerating = prdStatus?.status === "generating";
  // Bridge: keep loader visible until query refetches after generation completes
  const isPrdPendingRefetch =
    prdStatus?.status === "complete" && !ralphState?.hasPrd;

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
