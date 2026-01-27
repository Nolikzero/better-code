/**
 * Multi-repository detection for workspace directories.
 * Detects when a project directory contains multiple git repositories.
 */
import { exec } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { TtlCache } from "../cache/ttl-cache";

const execAsync = promisify(exec);

export interface SubRepoInfo {
  /** Directory name */
  name: string;
  /** Absolute path to the sub-repo */
  path: string;
  /** Path relative to the project root */
  relativePath: string;
}

export interface MultiRepoDetectionResult {
  /** Whether the root project directory itself is a git repo */
  isRootRepo: boolean;
  /** Whether multiple git repos were detected (root counts if it's a repo) */
  isMultiRepo: boolean;
  /** Sub-repositories found (does NOT include root if root is a repo) */
  subRepos: SubRepoInfo[];
}

const CACHE_TTL = 300_000; // 5 minutes
const cache = new TtlCache<MultiRepoDetectionResult>(CACHE_TTL);

/**
 * Check if a directory is a git repository.
 */
async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    await execAsync("git rev-parse --git-dir", { cwd: dirPath });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect sub-repositories inside a project directory.
 * Scans only 1 level deep for directories containing `.git`.
 */
export async function detectSubRepos(
  projectPath: string,
): Promise<MultiRepoDetectionResult> {
  const cached = cache.get(projectPath);
  if (cached) {
    return cached;
  }

  const isRootRepo = await isGitRepo(projectPath);
  const subRepos: SubRepoInfo[] = [];

  try {
    const entries = await readdir(projectPath, { withFileTypes: true });

    // Check each immediate subdirectory for .git
    const checks = entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules",
      )
      .map(async (entry) => {
        const dirPath = join(projectPath, entry.name);
        try {
          const gitDir = join(dirPath, ".git");
          const gitStat = await stat(gitDir);
          // .git can be a directory (normal repo) or file (worktree/submodule)
          if (gitStat.isDirectory() || gitStat.isFile()) {
            return {
              name: entry.name,
              path: dirPath,
              relativePath: entry.name,
            };
          }
        } catch {
          // No .git directory, skip
        }
        return null;
      });

    const results = await Promise.all(checks);
    for (const r of results) {
      if (r) subRepos.push(r);
    }

    // Sort alphabetically
    subRepos.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.warn("[multi-repo] Failed to scan subdirectories:", error);
  }

  const result: MultiRepoDetectionResult = {
    isRootRepo,
    isMultiRepo: subRepos.length > 0,
    subRepos,
  };

  cache.set(projectPath, result);
  return result;
}

/**
 * Clear the detection cache for a specific path or all paths.
 */
export function clearMultiRepoCache(projectPath?: string): void {
  if (projectPath) {
    cache.delete(projectPath);
  } else {
    cache.clear();
  }
}
