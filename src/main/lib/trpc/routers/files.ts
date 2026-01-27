import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { fileIndexManager } from "../../files/file-index";
import {
  ALLOWED_LOCK_FILES,
  IGNORED_DIRS,
  IGNORED_EXTENSIONS,
  IGNORED_FILES,
} from "../../files/scan-ignore-lists";
import {
  assertRegisteredWorktree,
  validateRelativePath,
} from "../../git/security/path-validation";
import {
  type DirectoryChangeEvent,
  fileWatcher,
} from "../../watcher/file-watcher";
import { publicProcedure, router } from "../index";

// Entry type for files and folders
interface FileEntry {
  path: string;
  type: "file" | "folder";
}

// Directory listing entry (returned to frontend)
interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "folder";
  isHidden: boolean;
}

// LRU cache for directory listings
class DirectoryLRUCache {
  private cache = new Map<
    string,
    { entries: DirectoryEntry[]; timestamp: number }
  >();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries = 5000, ttlMs = 60000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  private makeKey(
    projectPath: string,
    relativePath: string,
    showHidden: boolean,
  ): string {
    return `${projectPath}\0${relativePath}\0${showHidden}`;
  }

  get(
    projectPath: string,
    relativePath: string,
    showHidden: boolean,
  ): DirectoryEntry[] | null {
    const key = this.makeKey(projectPath, relativePath, showHidden);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.entries;
  }

  set(
    projectPath: string,
    relativePath: string,
    showHidden: boolean,
    entries: DirectoryEntry[],
  ): void {
    const key = this.makeKey(projectPath, relativePath, showHidden);
    this.cache.delete(key); // Remove if exists (for LRU ordering)
    this.cache.set(key, { entries, timestamp: Date.now() });
    // Evict oldest entries if over limit
    if (this.cache.size > this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /** Invalidate all entries for a project whose relativePath starts with the given prefix */
  invalidateByPrefix(projectPath: string, pathPrefix: string): void {
    const prefix = `${projectPath}\0${pathPrefix}`;
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Invalidate all entries for a project */
  invalidateProject(projectPath: string): void {
    const prefix = `${projectPath}\0`;
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const directoryCache = new DirectoryLRUCache();

// Fallback: shallow scan cache for when FTS5 index is still building
const shallowCache = new Map<
  string,
  { entries: FileEntry[]; timestamp: number }
>();
const SHALLOW_CACHE_TTL = 30000; // 30 seconds

/**
 * Quick shallow scan (depth 2) for fallback while FTS5 index builds.
 */
async function shallowScan(
  rootPath: string,
  currentPath: string = rootPath,
  depth = 0,
): Promise<FileEntry[]> {
  if (depth > 2) return [];

  const entries: FileEntry[] = [];
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
        entries.push({ path: relativePath, type: "folder" });
        const sub = await shallowScan(rootPath, fullPath, depth + 1);
        entries.push(...sub);
      } else if (entry.isFile()) {
        if (IGNORED_FILES.has(entry.name)) continue;
        const ext = entry.name.includes(".")
          ? `.${entry.name.split(".").pop()?.toLowerCase()}`
          : "";
        if (IGNORED_EXTENSIONS.has(ext) && !ALLOWED_LOCK_FILES.has(entry.name))
          continue;
        entries.push({ path: relativePath, type: "file" });
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return entries;
}

/**
 * Fallback search using shallow scan when FTS5 index isn't ready yet.
 */
async function fallbackSearch(
  projectPath: string,
  query: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    label: string;
    path: string;
    repository: string;
    type: "file" | "folder";
  }>
> {
  const cached = shallowCache.get(projectPath);
  const now = Date.now();

  let entries: FileEntry[];
  if (cached && now - cached.timestamp < SHALLOW_CACHE_TTL) {
    entries = cached.entries;
  } else {
    entries = await shallowScan(projectPath);
    shallowCache.set(projectPath, { entries, timestamp: now });
  }

  const queryLower = query.toLowerCase();
  let filtered = entries;
  if (query) {
    const words = queryLower.split(/\s+/).filter(Boolean);
    filtered = entries.filter((entry) => {
      const pathLower = entry.path.toLowerCase();
      return words.every((w) => pathLower.includes(w));
    });
  }

  if (query) {
    filtered.sort((a, b) => {
      const aName = basename(a.path).toLowerCase();
      const bName = basename(b.path).toLowerCase();

      // Priority 1: Exact name match
      const aExact = aName === queryLower;
      const bExact = bName === queryLower;
      if (aExact !== bExact) return aExact ? -1 : 1;

      // Priority 2: Name starts with query
      const aStarts = aName.startsWith(queryLower);
      const bStarts = bName.startsWith(queryLower);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;

      // Priority 3: Shorter name wins among prefix matches
      if (aStarts && bStarts && aName.length !== bName.length) {
        return aName.length - bName.length;
      }

      // Priority 4: Name contains query vs path-only match
      const aContains = aName.includes(queryLower);
      const bContains = bName.includes(queryLower);
      if (aContains !== bContains) return aContains ? -1 : 1;

      return aName.localeCompare(bName);
    });
  }

  return filtered.slice(0, limit).map((entry) => ({
    id: `${entry.type}:local:${entry.path}`,
    label: basename(entry.path),
    path: entry.path,
    repository: "local",
    type: entry.type,
  }));
}

/** Shared implementation for listing a single directory with LRU caching */
async function listDirectoryImpl(
  projectPath: string,
  relativePath: string,
  showHidden: boolean,
): Promise<DirectoryEntry[]> {
  if (!projectPath) return [];

  // Validate that projectPath is a registered project/worktree
  assertRegisteredWorktree(projectPath);

  // Validate relativePath to prevent path traversal
  if (relativePath) {
    validateRelativePath(relativePath, { allowRoot: true });
  }

  // Check cache first
  const cached = directoryCache.get(projectPath, relativePath, showHidden);
  if (cached) return cached;

  const targetPath = relativePath
    ? join(projectPath, relativePath)
    : projectPath;

  try {
    const pathStat = await stat(targetPath);
    if (!pathStat.isDirectory()) return [];

    const dirEntries = await readdir(targetPath, { withFileTypes: true });
    const entries: DirectoryEntry[] = [];

    for (const entry of dirEntries) {
      const isHidden = entry.name.startsWith(".");
      const entryRelPath = relativePath
        ? join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (isHidden && !showHidden) {
          if (
            !entry.name.startsWith(".github") &&
            !entry.name.startsWith(".vscode")
          ) {
            continue;
          }
        }
        entries.push({
          name: entry.name,
          path: entryRelPath,
          type: "folder",
          isHidden,
        });
      } else if (entry.isFile()) {
        if (IGNORED_FILES.has(entry.name)) continue;
        if (isHidden && !showHidden) continue;
        const ext = entry.name.includes(".")
          ? `.${entry.name.split(".").pop()?.toLowerCase()}`
          : "";
        if (IGNORED_EXTENSIONS.has(ext)) {
          if (!ALLOWED_LOCK_FILES.has(entry.name)) continue;
        }
        entries.push({
          name: entry.name,
          path: entryRelPath,
          type: "file",
          isHidden,
        });
      }
    }

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    directoryCache.set(projectPath, relativePath, showHidden, entries);
    return entries;
  } catch (error) {
    console.error("[files] Error listing directory:", error);
    return [];
  }
}

export const filesRouter = router({
  /**
   * Search files and folders in a local project directory
   */
  search: publicProcedure
    .input(
      z.object({
        projectPath: z.string(),
        query: z.string().default(""),
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ input }) => {
      const { projectPath, query, limit } = input;

      if (!projectPath) {
        return [];
      }

      try {
        // Verify the path exists and is a directory
        const pathStat = await stat(projectPath);
        if (!pathStat.isDirectory()) {
          console.warn(`[files] Not a directory: ${projectPath}`);
          return [];
        }

        // Get or create the FTS5 index (triggers background build on first call)
        const index = await fileIndexManager.getIndex(projectPath);

        // If index is ready, use FTS5 for fast search
        if (index.state === "ready") {
          const results = index.search(query, limit);
          return results;
        }

        // Index still building — use shallow scan fallback
        return await fallbackSearch(projectPath, query, limit);
      } catch (error) {
        console.error("[files] Error searching files:", error);
        return [];
      }
    }),

  /**
   * Eagerly warm the file index for a project so it's ready before first search.
   */
  warmIndex: publicProcedure
    .input(z.object({ projectPath: z.string() }))
    .mutation(async ({ input }) => {
      if (!input.projectPath) return;
      await fileIndexManager.getIndex(input.projectPath);
    }),

  /**
   * Get the index state for a project (idle, building, ready)
   */
  indexStatus: publicProcedure
    .input(z.object({ projectPath: z.string() }))
    .query(({ input }) => {
      const { projectPath } = input;
      if (!projectPath) return { state: "idle" as const };
      return { state: fileIndexManager.getState(projectPath) };
    }),

  /**
   * Clear the file cache for a project (useful when files change)
   */
  clearCache: publicProcedure
    .input(z.object({ projectPath: z.string() }))
    .mutation(({ input }) => {
      shallowCache.delete(input.projectPath);
      directoryCache.invalidateProject(input.projectPath);
      // Close and rebuild the FTS5 index
      fileIndexManager.close(input.projectPath);
      return { success: true };
    }),

  /**
   * List immediate children of a directory (non-recursive, for lazy loading)
   */
  listDirectory: publicProcedure
    .input(
      z.object({
        projectPath: z.string(),
        relativePath: z.string().default(""),
        showHidden: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      return listDirectoryImpl(
        input.projectPath,
        input.relativePath,
        input.showHidden,
      );
    }),

  /**
   * Batch-list multiple directories in a single call (for reveal & mount restore)
   */
  batchListDirectories: publicProcedure
    .input(
      z.object({
        projectPath: z.string(),
        relativePaths: z.array(z.string()),
        showHidden: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const { projectPath, relativePaths, showHidden } = input;
      const results: Record<string, DirectoryEntry[]> = {};
      await Promise.all(
        relativePaths.map(async (relPath) => {
          results[relPath] = await listDirectoryImpl(
            projectPath,
            relPath,
            showHidden,
          );
        }),
      );
      return results;
    }),

  /**
   * Read file content for viewing in the center panel
   */
  readFileContent: publicProcedure
    .input(
      z.object({
        projectPath: z.string(),
        relativePath: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { projectPath, relativePath } = input;

      if (!projectPath || !relativePath) {
        return { content: "", error: "Invalid path" };
      }

      // Validate that projectPath is a registered project/worktree
      assertRegisteredWorktree(projectPath);

      // Validate relativePath to prevent path traversal
      validateRelativePath(relativePath);

      const filePath = join(projectPath, relativePath);

      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
          return { content: "", error: "Not a file" };
        }

        // Check if file is too large (> 1MB)
        if (fileStat.size > 1024 * 1024) {
          return { content: "", error: "File too large to display" };
        }

        // Check if file is binary by reading first few bytes
        const buffer = await readFile(filePath);
        const isBinary = buffer.some(
          (byte) =>
            byte === 0 ||
            (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13),
        );

        if (isBinary) {
          return { content: "", error: "Binary file - cannot display" };
        }

        const content = buffer.toString("utf-8");
        return { content, error: null };
      } catch (error) {
        console.error("[files] Error reading file:", error);
        return { content: "", error: "Failed to read file" };
      }
    }),

  /**
   * Subscribe to directory changes for real-time file tree updates
   */
  watchDirectory: publicProcedure
    .input(
      z.object({
        directoryPath: z.string(),
        subscriberId: z.string(),
      }),
    )
    .subscription(({ input }) => {
      const { directoryPath, subscriberId } = input;

      return observable<DirectoryChangeEvent>((emit) => {
        const eventName = `directory:${directoryPath}`;

        const onDirectoryChange = (event: DirectoryChangeEvent) => {
          // Invalidate backend directory cache for the changed path's parent
          const relPath = event.relativePath;
          const parentDir = relPath.includes("/")
            ? relPath.substring(0, relPath.lastIndexOf("/"))
            : "";
          // Invalidate the parent directory listing
          directoryCache.invalidateByPrefix(directoryPath, parentDir);
          // Also invalidate the exact directory if it was removed/added
          if (event.type === "addDir" || event.type === "unlinkDir") {
            directoryCache.invalidateByPrefix(directoryPath, relPath);
          }
          emit.next(event);
        };

        // Start watching and subscribe to events
        fileWatcher.watchDirectory(directoryPath, subscriberId);
        fileWatcher.on(eventName, onDirectoryChange);

        // Return cleanup function
        return () => {
          fileWatcher.off(eventName, onDirectoryChange);
          fileWatcher.unwatchDirectory(directoryPath, subscriberId);
        };
      });
    }),
});
