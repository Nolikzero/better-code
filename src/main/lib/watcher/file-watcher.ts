import { EventEmitter } from "node:events";
import * as path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

/** Directories to ignore when watching */
const IGNORED_DIRECTORIES = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/coverage/**",
  "**/__pycache__/**",
  "**/venv/**",
  "**/.venv/**",
  "**/target/**",
  "**/vendor/**",
];

interface DirectoryWatcherEntry {
  watcher: FSWatcher;
  subscribers: Set<string>;
}

interface GitWatcherEntry {
  watcher: FSWatcher;
  subscribers: Set<string>;
}

export interface DirectoryChangeEvent {
  type: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
  path: string;
  relativePath: string;
}

export interface GitChangeEvent {
  type: "statusChanged";
  worktreePath: string;
}

/**
 * FileWatcher service for monitoring file system changes.
 * Uses chokidar for reliable cross-platform file watching.
 */
class FileWatcher extends EventEmitter {
  private directoryWatchers = new Map<string, DirectoryWatcherEntry>();
  private gitWatchers = new Map<string, GitWatcherEntry>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Start watching a directory for file changes.
   * Multiple subscribers can watch the same directory.
   */
  watchDirectory(directoryPath: string, subscriberId: string): void {
    const normalizedPath = path.normalize(directoryPath);
    const existing = this.directoryWatchers.get(normalizedPath);

    if (existing) {
      existing.subscribers.add(subscriberId);
      return;
    }

    const watcher = chokidar.watch(normalizedPath, {
      ignored: IGNORED_DIRECTORIES,
      persistent: true,
      ignoreInitial: true,
      depth: 1, // Only watch immediate children
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    const handleEvent = (
      eventType: DirectoryChangeEvent["type"],
      filePath: string,
    ) => {
      const debounceKey = `dir:${normalizedPath}:${filePath}`;
      const existingTimer = this.debounceTimers.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(debounceKey);
        const event: DirectoryChangeEvent = {
          type: eventType,
          path: filePath,
          relativePath: path.relative(normalizedPath, filePath),
        };
        this.emit(`directory:${normalizedPath}`, event);
      }, 200);

      this.debounceTimers.set(debounceKey, timer);
    };

    watcher
      .on("add", (p) => handleEvent("add", p))
      .on("addDir", (p) => handleEvent("addDir", p))
      .on("change", (p) => handleEvent("change", p))
      .on("unlink", (p) => handleEvent("unlink", p))
      .on("unlinkDir", (p) => handleEvent("unlinkDir", p))
      .on("error", (error) => {
        console.error(`[FileWatcher] Error watching ${normalizedPath}:`, error);
      });

    this.directoryWatchers.set(normalizedPath, {
      watcher,
      subscribers: new Set([subscriberId]),
    });
  }

  /**
   * Stop watching a directory for a specific subscriber.
   * Watcher is only closed when all subscribers have unsubscribed.
   */
  unwatchDirectory(directoryPath: string, subscriberId: string): void {
    const normalizedPath = path.normalize(directoryPath);
    const entry = this.directoryWatchers.get(normalizedPath);

    if (!entry) return;

    entry.subscribers.delete(subscriberId);

    if (entry.subscribers.size === 0) {
      entry.watcher.close();
      this.directoryWatchers.delete(normalizedPath);

      // Clean up any pending debounce timers for this directory
      for (const [key, timer] of this.debounceTimers) {
        if (key.startsWith(`dir:${normalizedPath}:`)) {
          clearTimeout(timer);
          this.debounceTimers.delete(key);
        }
      }
    }
  }

  /**
   * Start watching a worktree for git status changes.
   * Monitors .git/index, .git/HEAD, and the worktree directory.
   */
  watchGitStatus(worktreePath: string, subscriberId: string): void {
    const normalizedPath = path.normalize(worktreePath);
    const existing = this.gitWatchers.get(normalizedPath);

    if (existing) {
      existing.subscribers.add(subscriberId);
      return;
    }

    const gitDir = path.join(normalizedPath, ".git");

    // Watch git-specific files and the worktree
    const watcher = chokidar.watch(
      [
        path.join(gitDir, "index"),
        path.join(gitDir, "HEAD"),
        path.join(gitDir, "COMMIT_EDITMSG"),
        path.join(gitDir, "refs"),
        normalizedPath,
      ],
      {
        ignored: [
          ...IGNORED_DIRECTORIES,
          // For worktree watching, also ignore .git internal files except specific ones
          path.join(gitDir, "objects/**"),
          path.join(gitDir, "logs/**"),
          path.join(gitDir, "hooks/**"),
        ],
        persistent: true,
        ignoreInitial: true,
        depth: 2, // Shallow depth for .git/refs changes; file edits detected via IPC
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      },
    );

    const handleGitChange = () => {
      const debounceKey = `git:${normalizedPath}`;
      const existingTimer = this.debounceTimers.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(debounceKey);
        const event: GitChangeEvent = {
          type: "statusChanged",
          worktreePath: normalizedPath,
        };
        this.emit(`git:${normalizedPath}`, event);
      }, 1000); // Debounce git events to coalesce rapid file writes during agent streaming

      this.debounceTimers.set(debounceKey, timer);
    };

    watcher
      .on("add", handleGitChange)
      .on("change", handleGitChange)
      .on("unlink", handleGitChange)
      .on("error", (error) => {
        console.error(
          `[FileWatcher] Error watching git status for ${normalizedPath}:`,
          error,
        );
      });

    this.gitWatchers.set(normalizedPath, {
      watcher,
      subscribers: new Set([subscriberId]),
    });
  }

  /**
   * Stop watching git status for a specific subscriber.
   */
  unwatchGitStatus(worktreePath: string, subscriberId: string): void {
    const normalizedPath = path.normalize(worktreePath);
    const entry = this.gitWatchers.get(normalizedPath);

    if (!entry) return;

    entry.subscribers.delete(subscriberId);

    if (entry.subscribers.size === 0) {
      entry.watcher.close();
      this.gitWatchers.delete(normalizedPath);

      // Clean up any pending debounce timers
      const debounceKey = `git:${normalizedPath}`;
      const timer = this.debounceTimers.get(debounceKey);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(debounceKey);
      }
    }
  }

  /**
   * Clean up all watchers.
   */
  async cleanup(): Promise<void> {
    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all directory watchers
    const closePromises: Promise<void>[] = [];
    for (const entry of this.directoryWatchers.values()) {
      closePromises.push(entry.watcher.close());
    }
    this.directoryWatchers.clear();

    // Close all git watchers
    for (const entry of this.gitWatchers.values()) {
      closePromises.push(entry.watcher.close());
    }
    this.gitWatchers.clear();

    await Promise.all(closePromises);
    this.removeAllListeners();
  }
}

/** Singleton file watcher instance */
export const fileWatcher = new FileWatcher();
