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
  /** If true, shows "继续" instead of "保存" and doesn't fetch project data */
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
  const [runCommand, setRunCommand] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setInitCommand(project.worktreeInitCommand || "");
      setRunCommand(project.runCommand || "");
    }
  }, [project]);

  const updateProject = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.get.invalidate({ id: projectId });
      toast.success("项目设置已保存");
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
      runCommand: runCommand.trim() || null,
    });
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNewProject ? "配置项目" : "项目设置"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isNewProject && (
            <div className="space-y-2">
              <Label htmlFor="project-name">项目名称</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入项目名称"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="init-command">工作树初始化命令</Label>
            <Textarea
              id="init-command"
              placeholder="例如：bun install && cp $PROJECT_DIR/.env ./"
              value={initCommand}
              onChange={(e) => setInitCommand(e.target.value)}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              创建新工作树后运行的命令。可用变量：{" "}
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

          <div className="space-y-2">
            <Label htmlFor="run-command">开发服务器命令</Label>
            <Input
              id="run-command"
              placeholder="例如：bun dev、npm run dev"
              value={runCommand}
              onChange={(e) => setRunCommand(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              用于启动开发服务器的命令。检测到端口后会自动打开预览。
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {isNewProject ? (
            <>
              <Button variant="ghost" onClick={handleSkip}>
                跳过
              </Button>
              <Button onClick={handleSave} disabled={updateProject.isPending}>
                {updateProject.isPending ? "正在保存…" : "继续"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={updateProject.isPending}>
                {updateProject.isPending ? "正在保存…" : "保存"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
