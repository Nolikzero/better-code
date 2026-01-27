/**
 * Generic TTL (Time-To-Live) cache backed by an in-memory Map.
 * Replaces multiple one-off cache implementations across the git layer.
 */
export class TtlCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /** Delete a single key. */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /** Delete all keys that start with the given prefix. */
  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /** Clear the entire cache. */
  clear(): void {
    this.cache.clear();
  }
}
