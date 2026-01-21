"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** If true, shows "Continue" instead of "Save" and doesn't fetch project data */
  isNewProject?: boolean;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  projectId,
  isNewProject = false,
}: ProjectSettingsDialogProps) {
  const utils = trpc.useUtils();
  const { data: project } = trpc.projects.get.useQuery(
    { id: projectId },
    { enabled: open && !isNewProject },
  );

  const [name, setName] = useState("");
  const [initCommand, setInitCommand] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setInitCommand(project.worktreeInitCommand || "");
    }
  }, [project]);

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.get.invalidate({ id: projectId });
      toast.success("Project settings saved");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSave = () => {
    updateProject.mutate({
      id: projectId,
      name: name.trim() || undefined,
      worktreeInitCommand: initCommand.trim() || null,
    });
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNewProject ? "Configure Project" : "Project Settings"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isNewProject && (
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="init-command">Worktree Init Command</Label>
            <Textarea
              id="init-command"
              placeholder="e.g., bun install && cp $PROJECT_DIR/.env ./"
              value={initCommand}
              onChange={(e) => setInitCommand(e.target.value)}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Command to run after creating a new worktree. Available variables:{" "}
              <code className="text-xs bg-muted px-1 rounded">
                $PROJECT_DIR
              </code>
              ,{" "}
              <code className="text-xs bg-muted px-1 rounded">
                $WORKTREE_PATH
              </code>
              ,{" "}
              <code className="text-xs bg-muted px-1 rounded">
                $BRANCH_NAME
              </code>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {isNewProject ? (
            <>
              <Button variant="ghost" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleSave} disabled={updateProject.isPending}>
                {updateProject.isPending ? "Saving..." : "Continue"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateProject.isPending}>
                {updateProject.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
