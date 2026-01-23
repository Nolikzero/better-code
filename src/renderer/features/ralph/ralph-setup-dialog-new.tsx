import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  ChevronLeftIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from "../../components/ui/icons";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

interface UserStory {
  id: string;
  title: string;
  description: string;
  priority: number;
  acceptanceCriteria: string[];
  passes: boolean;
  notes?: string;
}

export interface RalphPrdData {
  goal: string;
  branchName: string;
  stories: UserStory[];
}

interface RalphSetupDialogNewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (prd: RalphPrdData) => void;
  initialData?: RalphPrdData | null;
  projectPath?: string;
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
    passes: false,
  };
}

/**
 * Ralph PRD Setup Dialog for new chats (before chat creation).
 * Two-step flow: 1) Describe feature in plain text, 2) AI generates PRD, 3) Review/edit
 */
export function RalphSetupDialogNew({
  open,
  onOpenChange,
  onSave,
  initialData,
}: RalphSetupDialogNewProps) {
  // Step: "input" for description entry, "review" for generated PRD editing
  const [step, setStep] = useState<"input" | "review">("input");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // PRD state for review step
  const [goal, setGoal] = useState("");
  const [branchName, setBranchName] = useState("");
  const [stories, setStories] = useState<UserStory[]>([createEmptyStory(1)]);
  const [expandedStoryIndex, setExpandedStoryIndex] = useState<number | null>(
    0,
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (initialData) {
        // If we have initial data, go directly to review step
        setGoal(initialData.goal);
        setBranchName(initialData.branchName);
        setStories(
          initialData.stories.length > 0
            ? initialData.stories
            : [createEmptyStory(1)],
        );
        setStep("review");
        setDescription("");
      } else {
        // Start fresh with input step
        setStep("input");
        setDescription("");
        setGoal("");
        setBranchName("");
        setStories([createEmptyStory(1)]);
        setExpandedStoryIndex(0);
      }
      setError(null);
    }
  }, [open, initialData]);

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;

    setError(null);
    setIsGenerating(true);

    // PRD generation is now handled in-chat, not via this dialog
    // This dialog is kept for potential manual PRD editing in the future
    // For now, just move to review step with empty PRD
    setGoal(description);
    setBranchName("ralph/feature");
    setStories([createEmptyStory(1)]);
    setExpandedStoryIndex(0);
    setStep("review");
    setIsGenerating(false);
  }, [description]);

  const handleSave = useCallback(() => {
    // Filter out empty stories
    const validStories = stories.filter(
      (s) => s.title.trim() || s.description.trim(),
    );

    if (validStories.length === 0) {
      return; // Don't save if no stories
    }

    onSave({
      goal,
      branchName,
      stories: validStories,
    });
  }, [goal, branchName, stories, onSave]);

  const handleBack = useCallback(() => {
    setStep("input");
  }, []);

  const handleAddStory = useCallback(() => {
    const newPriority = stories.length + 1;
    setStories([...stories, createEmptyStory(newPriority)]);
    setExpandedStoryIndex(stories.length);
  }, [stories]);

  const handleRemoveStory = useCallback(
    (index: number) => {
      const newStories = stories.filter((_, i) => i !== index);
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
        {step === "input" ? (
          <>
            <DialogHeader>
              <DialogTitle>Describe Your Feature</DialogTitle>
              <DialogDescription>
                Describe what you want to build in plain text. AI will generate
                a structured PRD with user stories.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4">
              <Textarea
                placeholder="I want to add a dark mode toggle to the settings page. It should save the preference, apply immediately, and work across all components..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                className="resize-none"
              />

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!description.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2 animate-pulse" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Generate PRD
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1 -ml-1 hover:bg-muted rounded"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                Review PRD
              </DialogTitle>
              <DialogDescription>
                Review and edit the generated PRD. Each story should be
                completable in one AI iteration.
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
                  <Label>User Stories ({stories.length})</Label>
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
                                handleUpdateStory(index, {
                                  title: e.target.value,
                                })
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
                              <Label className="text-xs">
                                Acceptance Criteria
                              </Label>
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
                                          handleRemoveCriteria(
                                            index,
                                            criteriaIndex,
                                          )
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
                  !stories.some((s) => s.title.trim() || s.description.trim())
                }
              >
                Save PRD
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
