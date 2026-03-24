import { logger } from '@/lib/utils/logger';

/**
 * Configuration for LRU capacity management.
 */
export interface LRUCapacityConfig {
  hardMaxBytes: number;
  softThreshold: number; // 0.9 = 90%
  targetAfterEviction: number; // 0.7 = 70%
}

/**
 * LRU entry metadata (internal tracking)
 */
interface LRUEntryMetadata {
  /** Size of entry in UTF-8 bytes */
  sizeBytes: number;
  /** Last access time (ms since epoch) - updated on get/set */
  lastAccessTime: number;
  /** Creation time (ms since epoch) */
  createdAt: number;
}

/**
 * Entry in the LRU queue with size and last access time.
 */
export interface LRUEntry {
  key: string;
  sizeBytes: number;
  lastAccessTime: number;
}

/**
 * Result of an eviction operation.
 */
export interface EvictionResult {
  evictedCount: number;
  freedBytes: number;
  currentSize: number;
  durationMs: number;
}

/**
 * Callback for getting all cache entries with their sizes and access times.
 */
export type GetEntriesCallback = () => LRUEntry[];

/**
 * Callback for evicting cache entries by key.
 */
export type EvictEntriesCallback = (keys: string[]) => Promise<void>;

/**
 * Manages LRU (Least Recently Used) cache eviction based on capacity limits.
 * Combines capacity management with entry tracking:
 * - Tracks cumulative cache size and metadata (internally)
 * - Manages capacity-based eviction policies
 */
export class LRUEviction {
  private config: LRUCapacityConfig | null = null;
  private currentSize = 0;
  // Private tracker metadata
  private entries: Map<string, LRUEntryMetadata> = new Map();
  private totalSizeBytes: number = 0;

  // ===== Initialization =====

  /**
   * Initialize the LRU eviction manager with configuration.
   * Call this during app bootstrap.
   *
   * @param config - LRU capacity configuration (from appsettings)
   */
  initialize(config: LRUCapacityConfig): void {
    this.config = config;
    logger.category('storage').debug('LRU eviction initialized', {
      hardMaxBytes: config.hardMaxBytes,
      softThreshold: config.softThreshold,
      targetAfterEviction: config.targetAfterEviction,
      softThresholdBytes: Math.floor(config.hardMaxBytes * config.softThreshold),
      targetBytes: Math.floor(config.hardMaxBytes * config.targetAfterEviction),
    });
  }

  // ===== Tracker Methods (internal metadata) =====

  /**
   * Track or update entry metadata.
   * Called when entry is stored/updated in cache.
   *
   * @param key Cache key
   * @param sizeBytes Entry size in UTF-8 bytes
   * @returns Size difference (positive = added/grew, negative = replaced/shrunk)
   */
  trackEntry(key: string, sizeBytes: number): number {
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
   * Remove entry metadata.
   * Called when entry is evicted/deleted from cache.
   *
   * @param key Cache key
   * @returns Size freed (in bytes)
   */
  untrackEntry(key: string): number {
    const metadata = this.entries.get(key);
    if (!metadata) return 0;

    this.entries.delete(key);
    this.totalSizeBytes -= metadata.sizeBytes;
    return metadata.sizeBytes;
  }

  /**
   * Update last access time.
   * Called on cache.get() to mark entry as recently used.
   *
   * @param key Cache key
   */
  updateAccessTime(key: string): void {
    const metadata = this.entries.get(key);
    if (metadata) {
      metadata.lastAccessTime = Date.now();
    }
  }

  /**
   * Get metadata for a specific entry.
   */
  getEntryMetadata(key: string): LRUEntryMetadata | undefined {
    return this.entries.get(key);
  }

  /**
   * Get total tracked cache size in bytes.
   */
  getTotalSizeBytes(): number {
    return this.totalSizeBytes;
  }

  /**
   * Get entry count in tracker.
   */
  getEntryCount(): number {
    return this.entries.size;
  }

  /**
   * Get N oldest entries by access time (for eviction).
   * @param count Number of entries to return
   * @returns Array of [key, metadata] pairs sorted by lastAccessTime (oldest first)
   */
  getOldestN(count: number): [string, LRUEntryMetadata][] {
    return Array.from(this.entries.entries())
      .sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime)
      .slice(0, count);
  }

  /**
   * Get all entries (for debugging/stats).
   */
  getAllEntries(): [string, LRUEntryMetadata][] {
    return Array.from(this.entries.entries());
  }

  /**
   * Get LRU tracker stats snapshot.
   * Returns metadata about tracked entries (sizes, access times).
   */
  getStats(): {
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
      averageSizeBytes: this.entries.size > 0 ? this.totalSizeBytes / this.entries.size : 0,
      oldestAccessTimeMs: entries.length > 0 ? Math.min(...entries.map((e) => e.lastAccessTime)) : null,
      newestAccessTimeMs: entries.length > 0 ? Math.max(...entries.map((e) => e.lastAccessTime)) : null,
    };
  }

  /**
   * Clear all tracked entries.
   */
  clear(): void {
    this.entries.clear();
    this.totalSizeBytes = 0;
  }

  // ===== Capacity Management Methods =====

  /**
   * Update tracked cache size based on current entries.
   * Call after major cache operations to keep size in sync.
   *
   * @param entries - Current cache entries with sizes
   */
  updateSize(entries: LRUEntry[]): void {
    this.currentSize = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
    logger.category('storage').debug('Cache size updated', {
      currentSize: this.currentSize,
      entryCount: entries.length,
    });
  }

  /**
   * Get current cache size in bytes.
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Get capacity configuration.
   */
  getConfig(): LRUCapacityConfig | null {
    return this.config;
  }

  /**
   * Check if cache is approaching soft threshold.
   * Returns true if current size >= softThreshold * hardMax.
   */
  isApproachingCapacity(): boolean {
    if (!this.config) {
      return false;
    }
    const softThresholdBytes = this.config.hardMaxBytes * this.config.softThreshold;
    return this.currentSize >= softThresholdBytes;
  }

  /**
   * Check if cache has exceeded hard capacity limit.
   */
  isExceededHardLimit(): boolean {
    if (!this.config) {
      return false;
    }
    return this.currentSize > this.config.hardMaxBytes;
  }

  /**
   * Execute eviction to reduce cache size to target.
   * Removes least recently used (oldest lastAccessTime) entries first.
   *
   * @param getEntries - Callback to get current cache entries
   * @param evictEntries - Callback to perform actual eviction
   * @returns EvictionResult with count, freed bytes, and duration
   */
  async evict(getEntries: GetEntriesCallback, evictEntries: EvictEntriesCallback): Promise<EvictionResult> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const result: EvictionResult = {
      evictedCount: 0,
      freedBytes: 0,
      currentSize: this.currentSize,
      durationMs: 0,
    };

    if (!this.config) {
      logger.category('storage').warn('LRU eviction not initialized');
      result.durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
      return result;
    }

    try {
      // Get current entries
      const entries = getEntries();
      this.updateSize(entries);

      // Calculate target size
      const targetSize = this.config.hardMaxBytes * this.config.targetAfterEviction;

      if (this.currentSize <= targetSize) {
        logger.category('storage').debug('Cache size within target; no eviction needed', {
          currentSize: this.currentSize,
          targetSize,
        });
        result.currentSize = this.currentSize;
        result.durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
        return result;
      }

      // Sort by lastAccessTime (ascending = oldest first)
      const sortedByLRU = [...entries].sort((a, b) => a.lastAccessTime - b.lastAccessTime);

      // Collect entries to evict until reaching target
      const entriesToEvict: LRUEntry[] = [];
      let freedBytes = 0;

      for (const entry of sortedByLRU) {
        if (this.currentSize - freedBytes <= targetSize) {
          break;
        }
        entriesToEvict.push(entry);
        freedBytes += entry.sizeBytes;
      }

      // Perform eviction
      if (entriesToEvict.length > 0) {
        const keysToEvict = entriesToEvict.map((e) => e.key);
        await evictEntries(keysToEvict);

        result.evictedCount = entriesToEvict.length;
        result.freedBytes = freedBytes;
        this.currentSize -= freedBytes;
        result.currentSize = this.currentSize;

        logger.category('storage').info('Cache eviction completed', {
          evictedCount: result.evictedCount,
          freedBytes: result.freedBytes,
          newSize: this.currentSize,
          targetSize,
        });

        // Warn if eviction was large (capacity issue)
        if (result.evictedCount > 50) {
          logger.category('storage').warn('Large eviction event indicates capacity pressure', {
            evictedCount: result.evictedCount,
            freedBytes: result.freedBytes,
            advice: 'Consider increasing hardMaxBytes or reducing cache entry sizes',
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.category('storage').error('Fatal error during cache eviction', {
        error: err.message,
      });
    }

    result.durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    return result;
  }

  /**
   * Get statistics about capacity usage.
   */
  getCapacityStats(): {
    currentSize: number;
    hardMaxBytes: number;
    softThresholdBytes: number;
    targetBytes: number;
    utilizationPercent: number;
    isApproachingCapacity: boolean;
    isExceededHardLimit: boolean;
  } | null {
    if (!this.config) {
      return null;
    }

    const softThresholdBytes = this.config.hardMaxBytes * this.config.softThreshold;
    const targetBytes = this.config.hardMaxBytes * this.config.targetAfterEviction;
    const utilizationPercent = (this.currentSize / this.config.hardMaxBytes) * 100;

    return {
      currentSize: this.currentSize,
      hardMaxBytes: this.config.hardMaxBytes,
      softThresholdBytes,
      targetBytes,
      utilizationPercent,
      isApproachingCapacity: this.isApproachingCapacity(),
      isExceededHardLimit: this.isExceededHardLimit(),
    };
  }
}

/**
 * Singleton instance of the LRU eviction manager.
 */
export const lruEvictionManager = new LRUEviction();

/**
 * Measure entry size in UTF-8 bytes (for consistent cross-platform sizing)
 * @param data Any object/value to measure
 * @returns Size in UTF-8 bytes (1KB fallback on serialization failure)
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
