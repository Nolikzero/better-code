import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { basename, dirname, join, normalize, relative } from "node:path";
import { app } from "electron";
import { existsSync, mkdirSync } from "node:fs";
import simpleGit from "simple-git";
import {
  ALLOWED_LOCK_FILES,
  IGNORED_DIRS,
  IGNORED_EXTENSIONS,
  IGNORED_FILES,
} from "./scan-ignore-lists";

interface FileEntry {
  path: string;
  filename: string;
  type: "file" | "folder";
}

interface SearchResult {
  id: string;
  label: string;
  path: string;
  repository: string;
  type: "file" | "folder";
}

type IndexState = "idle" | "building" | "ready";

/** Minimum interval between on-demand refreshes (ms) */
const REFRESH_COOLDOWN = 10_000; // 10 seconds

/**
 * Per-project file index backed by SQLite FTS5 with trigram tokenizer.
 * Provides sub-5ms search across 50k+ files.
 *
 * Uses on-demand refresh with a cooldown instead of unconditional polling.
 * Refresh is triggered when a search is performed and the cooldown has elapsed.
 */
class ProjectFileIndex {
  private db: Database.Database;
  private projectPath: string;
  private _state: IndexState = "idle";
  private lastRefreshTime = 0;
  private refreshInProgress = false;

  // Prepared statements for performance
  private insertStmt: Database.Statement;
  private deleteStmt: Database.Statement;
  private searchStmt: Database.Statement;
  private searchAllStmt: Database.Statement;
  private likeSearchStmt: Database.Statement;
  private allPathsStmt: Database.Statement;

  get state(): IndexState {
    return this._state;
  }

  constructor(projectPath: string) {
    this.projectPath = normalize(projectPath);

    const dbPath = this.getDbPath();
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");

    // Store project path metadata for collision detection
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Verify this DB belongs to the expected project path
    const storedPath = this.db
      .prepare("SELECT value FROM meta WHERE key = 'project_path'")
      .get() as { value: string } | undefined;

    if (storedPath && storedPath.value !== this.projectPath) {
      // Hash collision — wipe the DB and re-initialize for the new path
      console.warn(
        `[FileIndex] Hash collision detected, reinitializing DB for: ${this.projectPath}`,
      );
      this.db.exec("DROP TABLE IF EXISTS meta");
      this.db.exec("DROP TABLE IF EXISTS file_index");
    }

    this.db
      .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)")
      .run("project_path", this.projectPath);

    // Create FTS5 table with trigram tokenizer for substring matching
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS file_index USING fts5(
        path,
        filename,
        type UNINDEXED,
        tokenize='trigram'
      );
    `);

    // Prepare statements
    this.insertStmt = this.db.prepare(
      "INSERT INTO file_index (path, filename, type) VALUES (?, ?, ?)",
    );
    this.deleteStmt = this.db.prepare(
      "DELETE FROM file_index WHERE path = ?",
    );
    this.searchStmt = this.db.prepare(`
      SELECT path, filename, type, rank
      FROM file_index
      WHERE file_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    this.searchAllStmt = this.db.prepare(`
      SELECT path, filename, type
      FROM file_index
      LIMIT ?
    `);
    // LIKE-based fallback for queries shorter than 3 chars (FTS5 trigram minimum)
    this.likeSearchStmt = this.db.prepare(`
      SELECT path, filename, type
      FROM file_index
      WHERE path LIKE ? OR filename LIKE ?
      LIMIT ?
    `);
    this.allPathsStmt = this.db.prepare(
      "SELECT path, type FROM file_index",
    );
  }

  private getDbPath(): string {
    const userDataPath = app.getPath("userData");
    const indexDir = join(userDataPath, "data", "file-indexes");
    if (!existsSync(indexDir)) {
      mkdirSync(indexDir, { recursive: true });
    }
    const hash = createHash("sha256")
      .update(this.projectPath)
      .digest("hex")
      .slice(0, 16);
    return join(indexDir, `file-index-${hash}.db`);
  }

  /**
   * Build the index by scanning the project directory.
   * Prefers `git ls-files` (respects .gitignore), falls back to manual scan.
   */
  async build(): Promise<void> {
    if (this._state === "building") return;
    this._state = "building";

    // Check if index already has data from a previous session (fast existence check)
    const hasData = this.db
      .prepare("SELECT 1 FROM file_index LIMIT 1")
      .get();

    if (hasData) {
      console.log(
        `[FileIndex] Reusing persisted index for: ${this.projectPath}`,
      );
      if (this._state === "building") {
        this._state = "ready";
      }
      // Trigger a background incremental refresh to pick up changes since last run
      this.lastRefreshTime = 0; // allow immediate refresh
      this.maybeRefresh();
      return;
    }

    console.log(`[FileIndex] Building index for: ${this.projectPath}`);
    const startTime = Date.now();

    // Clear existing entries
    this.db.exec("DELETE FROM file_index");

    let entries: FileEntry[];
    try {
      entries = await this.scanWithGit();
      console.log(`[FileIndex] Used git ls-files`);
    } catch {
      // Not a git repo or git not available — fall back to manual scan
      entries = [];
      await this.scanDirectory(
        this.projectPath,
        this.projectPath,
        entries,
        0,
        15,
      );
      console.log(`[FileIndex] Used manual directory scan (non-git)`);
    }

    // Batch insert using a transaction
    const insertMany = this.db.transaction((items: FileEntry[]) => {
      for (const entry of items) {
        this.insertStmt.run(entry.path, entry.filename, entry.type);
      }
    });
    insertMany(entries);

    this.lastRefreshTime = Date.now();

    // Guard: only transition to ready if we weren't closed during build
    if (this._state === "building") {
      this._state = "ready";
    }

    console.log(
      `[FileIndex] Indexed ${entries.length} entries in ${Date.now() - startTime}ms`,
    );
  }

  /**
   * Use `git ls-files` to get all tracked + untracked (non-ignored) files.
   * This perfectly respects all .gitignore files (root, nested, global, .git/info/exclude).
   */
  private async scanWithGit(): Promise<FileEntry[]> {
    const git = simpleGit(this.projectPath);

    // Verify this is a git repo (throws if not)
    await git.revparse(["--git-dir"]);

    // Get tracked files + untracked non-ignored files
    // --cached: tracked files
    // --others: untracked files
    // --exclude-standard: respect .gitignore
    const [trackedRaw, untrackedRaw] = await Promise.all([
      git.raw(["ls-files", "--cached"]),
      git.raw(["ls-files", "--others", "--exclude-standard"]),
    ]);

    const fileSet = new Set<string>();
    const entries: FileEntry[] = [];
    const folderSet = new Set<string>();

    for (const raw of [trackedRaw, untrackedRaw]) {
      const lines = raw.split("\n").filter(Boolean);
      for (const filePath of lines) {
        if (fileSet.has(filePath)) continue;
        fileSet.add(filePath);

        entries.push({
          path: filePath,
          filename: basename(filePath),
          type: "file",
        });

        // Collect parent directories as folder entries
        let dir = dirname(filePath);
        while (dir && dir !== ".") {
          if (folderSet.has(dir)) break;
          folderSet.add(dir);
          entries.push({
            path: dir,
            filename: basename(dir),
            type: "folder",
          });
          dir = dirname(dir);
        }
      }
    }

    return entries;
  }

  private async scanDirectory(
    rootPath: string,
    currentPath: string,
    entries: FileEntry[],
    depth: number,
    maxDepth: number,
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const dirEntries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of dirEntries) {
        const fullPath = join(currentPath, entry.name);
        const relativePath = relative(rootPath, fullPath);

        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          if (
            entry.name.startsWith(".") &&
            !entry.name.startsWith(".github") &&
            !entry.name.startsWith(".vscode")
          )
            continue;

          entries.push({
            path: relativePath,
            filename: entry.name,
            type: "folder",
          });

          await this.scanDirectory(
            rootPath,
            fullPath,
            entries,
            depth + 1,
            maxDepth,
          );
        } else if (entry.isFile()) {
          if (IGNORED_FILES.has(entry.name)) continue;

          const ext = entry.name.includes(".")
            ? `.${entry.name.split(".").pop()?.toLowerCase()}`
            : "";
          if (IGNORED_EXTENSIONS.has(ext)) {
            if (!ALLOWED_LOCK_FILES.has(entry.name)) continue;
          }

          entries.push({
            path: relativePath,
            filename: entry.name,
            type: "file",
          });
        }
      }
    } catch {
      // Silently skip directories we can't read
    }
  }

  /**
   * Trigger an incremental refresh if the cooldown has elapsed.
   * Runs in the background — does not block the caller.
   */
  private maybeRefresh(): void {
    if (this._state !== "ready") return;
    if (this.refreshInProgress) return;
    if (Date.now() - this.lastRefreshTime < REFRESH_COOLDOWN) return;

    this.refreshInProgress = true;
    this.incrementalRefresh()
      .catch((err) => {
        console.warn(`[FileIndex] Refresh error:`, err);
      })
      .finally(() => {
        this.refreshInProgress = false;
        this.lastRefreshTime = Date.now();
      });
  }

  /**
   * Re-scan the directory and apply only the diff (inserts + deletes).
   */
  private async incrementalRefresh(): Promise<void> {
    if (this._state !== "ready") return;

    let freshEntries: FileEntry[];
    try {
      freshEntries = await this.scanWithGit();
    } catch {
      freshEntries = [];
      await this.scanDirectory(
        this.projectPath,
        this.projectPath,
        freshEntries,
        0,
        15,
      );
    }

    // Build a set of current paths from the fresh scan
    const freshSet = new Map<string, FileEntry>();
    for (const entry of freshEntries) {
      freshSet.set(entry.path, entry);
    }

    // Get all paths currently in the index
    const indexedRows = this.allPathsStmt.all() as Array<{
      path: string;
      type: string;
    }>;
    const indexedSet = new Set<string>();
    for (const row of indexedRows) {
      indexedSet.add(row.path);
    }

    // Compute diff
    const toInsert: FileEntry[] = [];
    const toDelete: string[] = [];

    for (const entry of freshEntries) {
      if (!indexedSet.has(entry.path)) {
        toInsert.push(entry);
      }
    }

    for (const path of indexedSet) {
      if (!freshSet.has(path)) {
        toDelete.push(path);
      }
    }

    if (toInsert.length === 0 && toDelete.length === 0) return;

    const applyDiff = this.db.transaction(() => {
      for (const path of toDelete) {
        this.deleteStmt.run(path);
      }
      for (const entry of toInsert) {
        this.insertStmt.run(entry.path, entry.filename, entry.type);
      }
    });
    applyDiff();

    console.log(
      `[FileIndex] Refreshed: +${toInsert.length} -${toDelete.length}`,
    );
  }

  /**
   * Search the index. Returns results in <5ms for 50k+ files.
   * Triggers a background refresh if the cooldown has elapsed.
   */
  search(query: string, limit = 50): SearchResult[] {
    if (this._state !== "ready") return [];

    // Trigger background refresh on search
    this.maybeRefresh();

    try {
      let rows: Array<{ path: string; filename: string; type: string }>;

      if (!query) {
        rows = this.searchAllStmt.all(limit) as typeof rows;
      } else {
        // FTS5 trigram tokenizer needs at least 3 chars per term.
        // For shorter queries, fall back to LIKE.
        const words = query.trim().split(/\s+/).filter(Boolean);
        const hasShortWord = words.some((w) => w.length < 3);

        if (hasShortWord) {
          const pattern = `%${query}%`;
          rows = this.likeSearchStmt.all(pattern, pattern, limit) as typeof rows;
        } else {
          const ftsQuery = this.buildFtsQuery(query);
          rows = this.searchStmt.all(ftsQuery, limit) as typeof rows;
        }
      }

      return rows.map((row) => ({
        id: `${row.type}:local:${row.path}`,
        label: row.filename,
        path: row.path,
        repository: "local",
        type: row.type as "file" | "folder",
      }));
    } catch (err) {
      console.warn(`[FileIndex] Search error for "${query}":`, err);
      return [];
    }
  }

  /**
   * Build an FTS5-compatible query from user input.
   * Multi-word: "agents side" → "agents" AND "side"
   */
  private buildFtsQuery(input: string): string {
    const words = input
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => {
        const escaped = w.replace(/"/g, '""');
        return `"${escaped}"`;
      });

    if (words.length === 0) return '""';
    return words.join(" AND ");
  }

  /**
   * Close the index database.
   */
  close(): void {
    this._state = "idle";
    this.db.close();
  }
}

/**
 * Manages file indexes for all open projects.
 */
class FileIndexManager {
  private indexes = new Map<string, ProjectFileIndex>();

  /**
   * Get or create a file index for a project.
   * Triggers a background build if the index isn't ready.
   */
  async getIndex(projectPath: string): Promise<ProjectFileIndex> {
    const normalized = normalize(projectPath);
    let index = this.indexes.get(normalized);

    if (!index) {
      index = new ProjectFileIndex(normalized);
      this.indexes.set(normalized, index);
      // Start building in background
      index.build().catch((err) => {
        console.error(`[FileIndex] Build failed for ${normalized}:`, err);
      });
    }

    return index;
  }

  /**
   * Check if an index is ready for a project.
   */
  isReady(projectPath: string): boolean {
    const index = this.indexes.get(normalize(projectPath));
    return index?.state === "ready";
  }

  /**
   * Get the current index state for a project.
   */
  getState(projectPath: string): IndexState {
    const index = this.indexes.get(normalize(projectPath));
    return index?.state ?? "idle";
  }

  /**
   * Close and remove index for a project.
   */
  close(projectPath: string): void {
    const normalized = normalize(projectPath);
    const index = this.indexes.get(normalized);
    if (index) {
      index.close();
      this.indexes.delete(normalized);
    }
  }

  /**
   * Close all indexes. Call on app quit.
   */
  closeAll(): void {
    for (const index of this.indexes.values()) {
      index.close();
    }
    this.indexes.clear();
  }
}

/** Singleton file index manager */
export const fileIndexManager = new FileIndexManager();
