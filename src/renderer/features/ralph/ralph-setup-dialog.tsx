import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { PlusIcon, TrashIcon } from "../../components/ui/icons";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { trpc } from "../../lib/trpc";
import { cn } from "../../lib/utils";

interface UserStory {
  id: string;
  title: string;
  description: string;
  priority: number;
  acceptanceCriteria: string[];
  type?: "research" | "implementation";
  passes: boolean;
  notes?: string;
}

interface RalphSetupDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateStoryId(): string {
  const num = Math.floor(Math.random() * 900) + 100;
  return `US-${num}`;
}

function createEmptyStory(priority: number): UserStory {
  return {
    id: generateStoryId(),
    title: "",
    description: "",
    priority,
    acceptanceCriteria: [""],
    type: "implementation",
    passes: false,
  };
}

export const RalphSetupDialog = memo(function RalphSetupDialog({
  chatId,
  open,
  onOpenChange,
}: RalphSetupDialogProps) {
  const utils = trpc.useUtils();

  // State for the form
  const [goal, setGoal] = useState("");
  const [branchName, setBranchName] = useState("");
  const [stories, setStories] = useState<UserStory[]>([createEmptyStory(1)]);
  const [expandedStoryIndex, setExpandedStoryIndex] = useState<number | null>(
    0,
  );

  // Load existing PRD
  const { data: ralphState } = trpc.ralph.getState.useQuery(
    { chatId },
    {
      enabled: open && !!chatId,
    },
  );

  // Initialize form from existing PRD
  useEffect(() => {
    if (ralphState?.hasPrd && ralphState.prd) {
      setGoal(ralphState.prd.goal);
      setBranchName(ralphState.prd.branchName);
      setStories(
        ralphState.prd.stories.length > 0
          ? (ralphState.prd.stories as UserStory[])
          : [createEmptyStory(1)],
      );
    }
  }, [ralphState]);

  // Save PRD mutation
  const savePrdMutation = trpc.ralph.savePrd.useMutation({
    onSuccess: () => {
      utils.ralph.getState.invalidate({ chatId });
      onOpenChange(false);
    },
  });

  const handleSave = useCallback(() => {
    // Filter out empty stories
    const validStories = stories.filter(
      (s) => s.title.trim() || s.description.trim(),
    );

    if (validStories.length === 0) {
      return; // Don't save if no stories
    }

    savePrdMutation.mutate({
      chatId,
      prd: {
        goal,
        branchName,
        stories: validStories,
      },
    });
  }, [chatId, goal, branchName, stories, savePrdMutation]);

  const handleAddStory = useCallback(() => {
    const newPriority = stories.length + 1;
    setStories([...stories, createEmptyStory(newPriority)]);
    setExpandedStoryIndex(stories.length);
  }, [stories]);

  const handleRemoveStory = useCallback(
    (index: number) => {
      const newStories = stories.filter((_, i) => i !== index);
      // Reorder priorities
      const reordered = newStories.map((s, i) => ({ ...s, priority: i + 1 }));
      setStories(reordered);
      if (expandedStoryIndex === index) {
        setExpandedStoryIndex(null);
      } else if (expandedStoryIndex !== null && expandedStoryIndex > index) {
        setExpandedStoryIndex(expandedStoryIndex - 1);
      }
    },
    [stories, expandedStoryIndex],
  );

  const handleUpdateStory = useCallback(
    (index: number, updates: Partial<UserStory>) => {
      const newStories = [...stories];
      newStories[index] = { ...newStories[index], ...updates };
      setStories(newStories);
    },
    [stories],
  );

  const handleAddCriteria = useCallback(
    (storyIndex: number) => {
      const story = stories[storyIndex];
      handleUpdateStory(storyIndex, {
        acceptanceCriteria: [...story.acceptanceCriteria, ""],
      });
    },
    [stories, handleUpdateStory],
  );

  const handleUpdateCriteria = useCallback(
    (storyIndex: number, criteriaIndex: number, value: string) => {
      const story = stories[storyIndex];
      const newCriteria = [...story.acceptanceCriteria];
      newCriteria[criteriaIndex] = value;
      handleUpdateStory(storyIndex, { acceptanceCriteria: newCriteria });
    },
    [stories, handleUpdateStory],
  );

  const handleRemoveCriteria = useCallback(
    (storyIndex: number, criteriaIndex: number) => {
      const story = stories[storyIndex];
      const newCriteria = story.acceptanceCriteria.filter(
        (_, i) => i !== criteriaIndex,
      );
      handleUpdateStory(storyIndex, { acceptanceCriteria: newCriteria });
    },
    [stories, handleUpdateStory],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Ralph PRD Setup</DialogTitle>
          <DialogDescription>
            Define your product requirements. Each story should be completable
            in one AI iteration.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Goal */}
          <div className="space-y-2">
            <Label htmlFor="goal">Goal</Label>
            <Textarea
              id="goal"
              placeholder="Describe the overall goal of this feature..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
            />
          </div>

          {/* Branch Name */}
          <div className="space-y-2">
            <Label htmlFor="branchName">Branch Name</Label>
            <Input
              id="branchName"
              placeholder="ralph/feature-name"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
            />
          </div>

          {/* Stories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>User Stories</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddStory}
                className="h-7 text-xs"
              >
                <PlusIcon className="h-3 w-3 mr-1" />
                Add Story
              </Button>
            </div>

            <div className="space-y-2">
              {stories.map((story, index) => (
                <div
                  key={story.id}
                  className={cn(
                    "border rounded-lg transition-colors",
                    expandedStoryIndex === index
                      ? "border-primary/50 bg-muted/30"
                      : "border-border",
                  )}
                >
                  {/* Story Header - Always visible */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedStoryIndex(
                        expandedStoryIndex === index ? null : index,
                      )
                    }
                    className="w-full px-3 py-2 flex items-center gap-2 text-left"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-16">
                      {story.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      P{story.priority}
                    </span>
                    <span className="flex-1 text-sm truncate">
                      {story.title || "Untitled story"}
                    </span>
                    {story.passes && (
                      <span className="text-xs text-green-500">Complete</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStory(index);
                      }}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </Button>
                  </button>

                  {/* Expanded Content */}
                  {expandedStoryIndex === index && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                      {/* Title */}
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input
                          placeholder="Story title"
                          value={story.title}
                          onChange={(e) =>
                            handleUpdateStory(index, { title: e.target.value })
                          }
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          placeholder="As a user, I want to..."
                          value={story.description}
                          onChange={(e) =>
                            handleUpdateStory(index, {
                              description: e.target.value,
                            })
                          }
                          rows={2}
                        />
                      </div>

                      {/* Acceptance Criteria */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Acceptance Criteria</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddCriteria(index)}
                            className="h-6 text-xs"
                          >
                            <PlusIcon className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {story.acceptanceCriteria.map(
                            (criteria, criteriaIndex) => (
                              <div
                                key={criteriaIndex}
                                className="flex items-center gap-1"
                              >
                                <Input
                                  placeholder="Criterion..."
                                  value={criteria}
                                  onChange={(e) =>
                                    handleUpdateCriteria(
                                      index,
                                      criteriaIndex,
                                      e.target.value,
                                    )
                                  }
                                  className="flex-1 h-8 text-sm"
                                />
                                {story.acceptanceCriteria.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleRemoveCriteria(index, criteriaIndex)
                                    }
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              savePrdMutation.isPending ||
              !stories.some((s) => s.title.trim() || s.description.trim())
            }
          >
            {savePrdMutation.isPending ? "Saving..." : "Save PRD"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
