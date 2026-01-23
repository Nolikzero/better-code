import { EventEmitter } from "node:events";
import { readFile, stat } from "node:fs/promises";
import * as path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { eq } from "drizzle-orm";
import { chats, getDatabase } from "../db";

export interface BranchChangeEvent {
  chatId: string;
  worktreePath: string;
  oldBranch: string | null;
  newBranch: string | null;
}

interface WatchEntry {
  chatId: string;
  worktreePath: string;
  headFilePath: string;
  currentBranch: string | null;
  watcher: FSWatcher;
  subscribers: Set<string>;
}

/**
 * BranchWatcher monitors the HEAD file of git worktrees/repos
 * to detect branch changes made outside the app (e.g., via bash commands).
 * When a branch change is detected, it updates the DB and emits an event.
 */
class BranchWatcher extends EventEmitter {
  private watchers = new Map<string, WatchEntry>();

  /**
   * Resolves the actual HEAD file path for a given worktree/repo path.
   * For worktrees: reads .git file -> follows gitdir pointer -> HEAD
   * For regular repos: .git/HEAD
   */
  async resolveHeadPath(worktreePath: string): Promise<string> {
    const dotGitPath = path.join(worktreePath, ".git");

    try {
      const stats = await stat(dotGitPath);

      if (stats.isFile()) {
        // Worktree: .git file contains "gitdir: <path>"
        const content = await readFile(dotGitPath, "utf-8");
        const match = content.match(/^gitdir:\s*(.+)$/m);
        if (!match) {
          throw new Error(`Invalid .git file format: ${dotGitPath}`);
        }

        let gitDir = match[1].trim();
        if (!path.isAbsolute(gitDir)) {
          gitDir = path.resolve(path.dirname(dotGitPath), gitDir);
        }
        return path.join(gitDir, "HEAD");
      }

      // Regular repo: .git/HEAD
      return path.join(dotGitPath, "HEAD");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // Fallback: assume regular repo
        return path.join(dotGitPath, "HEAD");
      }
      throw err;
    }
  }

  /**
   * Parses the HEAD file content to extract branch name.
   * Returns null for detached HEAD (commit hash instead of ref).
   */
  parseBranchFromHead(headContent: string): string | null {
    const trimmed = headContent.trim();
    const match = trimmed.match(/^ref: refs\/heads\/(.+)$/);
    if (match) {
      return match[1];
    }
    // Detached HEAD (raw commit hash)
    return null;
  }

  /**
   * Start watching a chat's worktree for branch changes.
   */
  async watch(
    chatId: string,
    worktreePath: string,
    subscriberId: string,
  ): Promise<void> {
    const existing = this.watchers.get(chatId);
    if (existing) {
      existing.subscribers.add(subscriberId);
      return;
    }

    const headFilePath = await this.resolveHeadPath(worktreePath);

    let currentBranch: string | null = null;
    try {
      const content = await readFile(headFilePath, "utf-8");
      currentBranch = this.parseBranchFromHead(content);
    } catch {
      // HEAD file might not exist yet
    }

    const watcher = chokidar.watch(headFilePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    const entry: WatchEntry = {
      chatId,
      worktreePath,
      headFilePath,
      currentBranch,
      watcher,
      subscribers: new Set([subscriberId]),
    };

    watcher.on("change", async () => {
      try {
        const content = await readFile(headFilePath, "utf-8");
        const newBranch = this.parseBranchFromHead(content);

        if (newBranch !== entry.currentBranch) {
          const oldBranch = entry.currentBranch;
          entry.currentBranch = newBranch;

          // Update the DB
          if (newBranch) {
            try {
              const db = getDatabase();
              db.update(chats)
                .set({ branch: newBranch, updatedAt: new Date() })
                .where(eq(chats.id, chatId))
                .run();
            } catch (dbErr) {
              console.error(
                `[BranchWatcher] Failed to update DB for chat ${chatId}:`,
                dbErr,
              );
            }
          }

          const event: BranchChangeEvent = {
            chatId,
            worktreePath,
            oldBranch,
            newBranch,
          };

          console.log(
            `[BranchWatcher] Branch changed for chat ${chatId}: ${oldBranch} -> ${newBranch}`,
          );
          this.emit(`branch:${chatId}`, event);
        }
      } catch (err) {
        console.error(
          `[BranchWatcher] Error reading HEAD for chat ${chatId}:`,
          err,
        );
      }
    });

    watcher.on("error", (error) => {
      console.error(`[BranchWatcher] Watcher error for chat ${chatId}:`, error);
    });

    this.watchers.set(chatId, entry);
  }

  /**
   * Stop watching for a specific subscriber.
   * Watcher is closed when all subscribers have unsubscribed.
   */
  unwatch(chatId: string, subscriberId: string): void {
    const entry = this.watchers.get(chatId);
    if (!entry) return;

    entry.subscribers.delete(subscriberId);

    if (entry.subscribers.size === 0) {
      entry.watcher.close();
      this.watchers.delete(chatId);
    }
  }

  /**
   * Close all watchers. Called on app quit.
   */
  async cleanup(): Promise<void> {
    for (const [_chatId, entry] of this.watchers) {
      await entry.watcher.close();
    }
    this.watchers.clear();
  }
}

export const branchWatcher = new BranchWatcher();
