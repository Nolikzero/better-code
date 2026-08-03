import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { z } from "zod";
import { isCliBinaryFile } from "./cli-runtime";

const binaryCacheEntrySchema = z.object({
  path: z.string(),
  source: z.string(),
});

const binaryCacheDataSchema = z.object({
  version: z.literal(2),
  entries: z.record(z.string(), binaryCacheEntrySchema),
});

type BinaryCacheEntry = z.infer<typeof binaryCacheEntrySchema>;
type BinaryCacheData = z.infer<typeof binaryCacheDataSchema>;

const CACHE_VERSION = 2 as const;

function getCachePath(): string {
  return path.join(app.getPath("userData"), "data", "binary-cache.json");
}

function readCache(): BinaryCacheData | null {
  try {
    return binaryCacheDataSchema.parse(
      JSON.parse(fs.readFileSync(getCachePath(), "utf-8")),
    );
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}

function writeCache(cache: BinaryCacheData): void {
  const cachePath = getCachePath();
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

export function getCachedBinary(
  provider: string,
): BinaryCacheEntry | undefined {
  const cache = readCache();
  const entry = cache?.entries[provider];
  if (!entry) return undefined;
  if (isCliBinaryFile(entry.path)) return entry;
  clearCachedBinary(provider);
  return undefined;
}

export function setCachedBinary(
  provider: string,
  result: BinaryCacheEntry | null,
): void {
  const cache = readCache() ?? { version: CACHE_VERSION, entries: {} };
  if (result === null) delete cache.entries[provider];
  else cache.entries[provider] = result;
  writeCache(cache);
}

export function clearBinaryCache(): void {
  try {
    fs.unlinkSync(getCachePath());
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return;
    throw error;
  }
}

export function clearCachedBinary(provider: string): void {
  const cache = readCache();
  if (!cache || !(provider in cache.entries)) return;
  delete cache.entries[provider];
  writeCache(cache);
}
