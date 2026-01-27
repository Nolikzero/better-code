import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

interface BinaryCacheEntry {
  path: string;
  source: string;
}

interface BinaryCacheData {
  version: number;
  entries: Record<string, BinaryCacheEntry | null>;
}

const CACHE_VERSION = 1;

function getCachePath(): string {
  return path.join(app.getPath("userData"), "data", "binary-cache.json");
}

function readCache(): BinaryCacheData | null {
  try {
    const data = JSON.parse(fs.readFileSync(getCachePath(), "utf-8"));
    if (data?.version === CACHE_VERSION) return data;
  } catch {
    // File doesn't exist or is corrupted
  }
  return null;
}

function writeCache(cache: BinaryCacheData): void {
  const cachePath = getCachePath();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

/**
 * Get a cached binary entry for a provider.
 * Returns:
 * - undefined: cache miss (no entry or path no longer exists) → caller should discover
 * - null: binary was not found last time → caller can skip discovery
 * - BinaryCacheEntry: valid cached result
 */
export function getCachedBinary(
  provider: string,
): BinaryCacheEntry | null | undefined {
  const cache = readCache();
  if (!cache || !(provider in cache.entries)) return undefined;

  const entry = cache.entries[provider];
  if (entry === null) return null;

  // Validate: does the file still exist?
  if (fs.existsSync(entry.path)) {
    console.log(
      `[${provider}-binary] Using cached path: ${entry.path} (source: ${entry.source})`,
    );
    return entry;
  }

  console.log(
    `[${provider}-binary] Cached path no longer exists: ${entry.path}, re-discovering...`,
  );
  return undefined;
}

/**
 * Cache a binary discovery result for a provider.
 */
export function setCachedBinary(
  provider: string,
  result: BinaryCacheEntry | null,
): void {
  const cache = readCache() || { version: CACHE_VERSION, entries: {} };
  cache.entries[provider] = result;
  writeCache(cache);
}

/**
 * Clear the entire binary cache file.
 */
export function clearBinaryCache(): void {
  try {
    fs.unlinkSync(getCachePath());
  } catch {
    // File doesn't exist
  }
}

/**
 * Clear a single provider's entry from the cache.
 */
export function clearCachedBinary(provider: string): void {
  const cache = readCache();
  if (cache && provider in cache.entries) {
    delete cache.entries[provider];
    writeCache(cache);
  }
}
