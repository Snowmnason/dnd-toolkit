/**
 * LRU (Least Recently Used) Eviction Tracker
 *
 * Tracks cache entry metadata for LRU eviction:
 * - Entry size (UTF-8 byte length)
 * - Last access time (for LRU ordering)
 * - Creation time
 *
 * Provides atomic eviction logic with thread-safe access under lock.
 *
 * **Key Properties:**
 * - Measures size: `Buffer.byteLength(JSON.stringify(data), 'utf8')`
 * - Updates lastAccessTime on every get/set
 * - Sorts by lastAccessTime to evict least recently used first
 * - No external locking needed; intended to be locked by caller (QueryCache)
 */

import { logger } from '@/lib/utils/logger';

/**
 * LRU entry metadata
 */
export interface LRUEntryMetadata {
  /** Size of entry in UTF-8 bytes */
  sizeBytes: number;

  /** Last access time (ms since epoch) - updated on get/set */
  lastAccessTime: number;

  /** Creation time (ms since epoch) */
  createdAt: number;
}

/**
 * LRU eviction tracker
 */
export class LRUEvictionTracker {
  /** Map: key → metadata */
  private entries: Map<string, LRUEntryMetadata> = new Map();

  /** Total size of all entries in bytes */
  private totalSizeBytes: number = 0;

  /**
   * Add or update entry metadata
   * @param key Cache key
   * @param sizeBytes Entry size in UTF-8 bytes
   * @returns Size difference (positive = added/grew, negative = replaced/shrunk)
   */
  public trackEntry(key: string, sizeBytes: number): number {
    const now = Date.now();
    const existing = this.entries.get(key);
    let sizeDelta = sizeBytes;

    if (existing) {
      // Replacing existing entry
      sizeDelta = sizeBytes - existing.sizeBytes;
      // Update access time
      existing.lastAccessTime = now;
      existing.sizeBytes = sizeBytes;
    } else {
      // New entry
      this.entries.set(key, {
        sizeBytes,
        lastAccessTime: now,
        createdAt: now,
      });
    }

    this.totalSizeBytes += sizeDelta;
    return sizeDelta;
  }

  /**
   * Remove entry metadata
   * @param key Cache key
   * @returns Size freed (in bytes)
   */
  public untrackEntry(key: string): number {
    const metadata = this.entries.get(key);
    if (!metadata) return 0;

    this.entries.delete(key);
    this.totalSizeBytes -= metadata.sizeBytes;
    return metadata.sizeBytes;
  }

  /**
   * Update last access time (called on cache.get())
   * @param key Cache key
   */
  public updateAccessTime(key: string): void {
    const metadata = this.entries.get(key);
    if (metadata) {
      metadata.lastAccessTime = Date.now();
    }
  }

  /**
   * Get N oldest entries by access time (for eviction)
   * @param count Number of entries to return
   * @returns Array of [key, metadata] pairs sorted by lastAccessTime (oldest first)
   */
  public getOldestN(count: number): [string, LRUEntryMetadata][] {
    return Array.from(this.entries.entries())
      .sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime)
      .slice(0, count);
  }

  /**
   * Get total cache size in bytes
   */
  public getTotalSizeBytes(): number {
    return this.totalSizeBytes;
  }

  /**
   * Get entry count
   */
  public getEntryCount(): number {
    return this.entries.size;
  }

  /**
   * Get metadata for a specific entry
   */
  public getEntryMetadata(key: string): LRUEntryMetadata | undefined {
    return this.entries.get(key);
  }

  /**
   * Get all entries (for debugging/stats)
   */
  public getAllEntries(): [string, LRUEntryMetadata][] {
    return Array.from(this.entries.entries());
  }

  /**
   * Clear all tracked entries
   */
  public clear(): void {
    this.entries.clear();
    this.totalSizeBytes = 0;
  }

  /**
   * Get LRU stats snapshot
   */
  public getStats(): {
    totalSizeBytes: number;
    entryCount: number;
    averageSizeBytes: number;
    oldestAccessTimeMs: number | null;
    newestAccessTimeMs: number | null;
  } {
    const entries = Array.from(this.entries.values());
    return {
      totalSizeBytes: this.totalSizeBytes,
      entryCount: this.entries.size,
      averageSizeBytes:
        this.entries.size > 0 ? this.totalSizeBytes / this.entries.size : 0,
      oldestAccessTimeMs:
        entries.length > 0
          ? Math.min(...entries.map((e) => e.lastAccessTime))
          : null,
      newestAccessTimeMs:
        entries.length > 0
          ? Math.max(...entries.map((e) => e.lastAccessTime))
          : null,
    };
  }
}

/**
 * Measure entry size in UTF-8 bytes (for consistent cross-platform sizing)
 * @param data Any object/value to measure
 * @returns Size in UTF-8 bytes (0 if measurement fails)
 *
 * **Error Handling:**
 * - If serialization fails (circular refs, non-serializable objects), returns 0
 * - Safe fallback prevents double-throwing on circular/malformed data
 * - Caller is responsible for handling zero-sized entries if needed
 */
export function measureEntrySize(data: any): number {
  try {
    const serialized = JSON.stringify(data);
    if (typeof Buffer !== 'undefined') {
      return Buffer.byteLength(serialized, 'utf8');
    }
    // Fallback for environments without Buffer
    return new TextEncoder().encode(serialized).length;
  } catch (error) {
    // Circular refs / non-serializable objects: use 1KB default so the entry
    // still counts toward cache limits rather than appearing as zero-size.
    logger
      .category('storage')
      .warn(
        `measureEntrySize: Failed to serialize data (using 1KB default): ${error instanceof Error ? error.message : String(error)}`,
      );
    return 1024;
  }
}
