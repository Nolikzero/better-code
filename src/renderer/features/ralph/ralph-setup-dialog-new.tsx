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
              <DialogTitle>描述你的功能</DialogTitle>
              <DialogDescription>
                用自然语言描述你想构建的功能，AI 将生成包含用户故事的结构化
                PRD。
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4">
              <Textarea
                placeholder="我想在设置页面添加深色模式开关。它应保存偏好、立即生效，并适用于所有组件…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                className="resize-none"
              />

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!description.trim() || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2 animate-pulse" />
                    正在生成…
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    生成 PRD
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
                审查 PRD
              </DialogTitle>
              <DialogDescription>
                审查并编辑生成的 PRD。每个故事都应能在一次 AI 迭代中完成。
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* Goal */}
              <div className="space-y-2">
                <Label htmlFor="goal">目标</Label>
                <Textarea
                  id="goal"
                  placeholder="描述此功能的总体目标…"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Branch Name */}
              <div className="space-y-2">
                <Label htmlFor="branchName">分支名称</Label>
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
                  <Label>用户故事（{stories.length})</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddStory}
                    className="h-7 text-xs"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    添加故事
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
                          {story.title || "未命名用户故事"}
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
                            <Label className="text-xs">标题</Label>
                            <Input
                              placeholder="故事标题"
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
                            <Label className="text-xs">描述</Label>
                            <Textarea
                              placeholder="作为用户，我希望…"
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
                              <Label className="text-xs">验收标准</Label>
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
                                      placeholder="验收标准…"
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
                取消
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  !stories.some((s) => s.title.trim() || s.description.trim())
                }
              >
                保存 PRD
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
