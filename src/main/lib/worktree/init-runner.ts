import { EventEmitter } from "node:events";
import os from "node:os";
import * as pty from "node-pty";
import { getShellEnvironment } from "../git/shell-env";
import { getDefaultShell } from "../terminal/env";

export interface WorktreeInitEvent {
  type: "output" | "complete" | "error";
  chatId: string;
  data?: string;
  exitCode?: number;
  error?: string;
}

export interface WorktreeInitStatus {
  chatId: string;
  status: "pending" | "running" | "completed" | "error";
  output: string;
  exitCode?: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

// Auto-cleanup completed statuses after 5 minutes
const STATUS_TTL_MS = 5 * 60 * 1000;

class WorktreeInitRunner extends EventEmitter {
  private statuses = new Map<string, WorktreeInitStatus>();
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  async runInitCommand(params: {
    chatId: string;
    command: string;
    worktreePath: string;
    projectPath: string;
    branchName: string;
  }): Promise<void> {
    const { chatId, command, worktreePath, projectPath, branchName } = params;

    // Clear any existing cleanup timer for this chatId
    const existingTimer = this.cleanupTimers.get(chatId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.cleanupTimers.delete(chatId);
    }

    // Initialize status
    const status: WorktreeInitStatus = {
      chatId,
      status: "running",
      output: "",
      startedAt: Date.now(),
    };
    this.statuses.set(chatId, status);

    // Emit initial event
    this.emit("init-progress", {
      type: "output",
      chatId,
      data: `$ ${command}\n`,
    } as WorktreeInitEvent);

    // Build environment with context variables and full shell PATH
    const shell = getDefaultShell();
    const shellEnv = await getShellEnvironment();
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...(shellEnv.PATH ? { PATH: shellEnv.PATH } : {}),
      PROJECT_DIR: projectPath,
      WORKTREE_PATH: worktreePath,
      BRANCH_NAME: branchName,
      HOME: os.homedir(),
      SHELL: shell,
      TERM: "xterm-256color",
    };

    return new Promise((resolve) => {
      let ptyProcess: pty.IPty;

      try {
        ptyProcess = pty.spawn(shell, ["-c", command], {
          name: "xterm-256color",
          cols: 120,
          rows: 30,
          cwd: worktreePath,
          env,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to spawn process";
        status.status = "error";
        status.error = errorMessage;
        status.completedAt = Date.now();

        this.emit("init-progress", {
          type: "error",
          chatId,
          error: errorMessage,
        } as WorktreeInitEvent);

        this.scheduleCleanup(chatId);
        resolve();
        return;
      }

      ptyProcess.onData((data) => {
        status.output += data;
        this.emit("init-progress", {
          type: "output",
          chatId,
          data,
        } as WorktreeInitEvent);
      });

      ptyProcess.onExit(({ exitCode }) => {
        status.status = exitCode === 0 ? "completed" : "error";
        status.exitCode = exitCode ?? undefined;
        status.completedAt = Date.now();

        if (exitCode !== 0) {
          status.error = `Command exited with code ${exitCode}`;
        }

        this.emit("init-progress", {
          type: "complete",
          chatId,
          exitCode: exitCode ?? undefined,
        } as WorktreeInitEvent);

        this.scheduleCleanup(chatId);
        resolve();
      });
    });
  }

  private scheduleCleanup(chatId: string): void {
    const timer = setTimeout(() => {
      this.statuses.delete(chatId);
      this.cleanupTimers.delete(chatId);
    }, STATUS_TTL_MS);
    this.cleanupTimers.set(chatId, timer);
  }

  getStatus(chatId: string): WorktreeInitStatus | undefined {
    return this.statuses.get(chatId);
  }

  clearStatus(chatId: string): void {
    this.statuses.delete(chatId);
    const timer = this.cleanupTimers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(chatId);
    }
  }

  hasRunningInit(chatId: string): boolean {
    const status = this.statuses.get(chatId);
    return status?.status === "running";
  }
}

export const worktreeInitRunner = new WorktreeInitRunner();
