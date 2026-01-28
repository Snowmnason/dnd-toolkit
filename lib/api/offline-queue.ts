import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import {
    handleCacheMigration,
    validateCacheEntry,
    type CacheSchema,
    type VersionedCacheEntry,
} from "@/lib/storage/cache-versioning";
import { logger } from "@/lib/utils/logger";
import type { RequestOptions } from "./request-manager";

/**
 * Offline Queue System
 *
 * Queues requests that fail when offline (NetworkDetection = OFFLINE/NO_WIFI)
 * or when circuit breaker is Open. Replays queued requests automatically
 * when connectivity is restored or manually via flushOfflineQueue().
 *
 * Features:
 * - FIFO replay with per-key deduplication (keeps latest, resets attempt count)
 * - Persistent storage via SecureStorage with schema versioning
 * - Serialization: only JSON-serializable request descriptors (no functions/tokens)
 * - Privacy integration: redacts sensitive fields before persistence
 * - Configurable max queue size (default 100, configurable drop-oldest policy)
 * - Configurable retry attempts (default 3) before marking failed
 * - Circuit breaker coordination: queues when circuit is Open
 * - Auth context preservation: stores authStrategy, fetches fresh token at replay
 */

/**
 * Request descriptor stored in offline queue
 * Only serializable data; functions/secrets not stored
 */
export interface QueuedRequestEntry {
  /** Unique request key (e.g., "api:users:list") */
  key: string;

  /** HTTP URL or endpoint identifier */
  url: string;

  /** HTTP method (GET, POST, etc.) */
  method: string;

  /** Serializable request headers (redacted) */
  headers?: Record<string, string>;

  /** Serializable request body (redacted) */
  body?: any;

  /** Query parameters */
  params?: Record<string, any>;

  /** Auth strategy name for replay (optional) */
  authStrategy?: string;

  /** RequestManager options (redacted/serializable only) - subset excluding authStrategy and rateLimitKey */
  options?: Omit<RequestOptions, "authStrategy" | "rateLimitKey">;

  /** Timestamp when request was queued */
  createdAt: number;

  /** Number of replay attempts */
  attempts: number;

  /** When request was last attempted */
  lastAttemptAt?: number;
}

/**
 * Queue entry with versioning metadata
 */
export interface OfflineQueueData {
  entries: QueuedRequestEntry[];
  maxQueueSize: number;
  maxRetryAttempts: number;
}

/**
 * Offline queue statistics
 */
export interface OfflineQueueStats {
  queueLength: number;
  oldestEntryTime: number | null;
  failedAttempts: number; // Count of entries that have failed replays
  maxQueueSize: number;
  maxRetryAttempts: number;
}

/**
 * Offline Queue Configuration
 */
export interface OfflineQueueConfig {
  /** Max number of requests to queue before dropping oldest (default: 100) */
  maxQueueSize?: number;

  /** Max replay attempts per request before marking failed (default: 3) */
  maxRetryAttempts?: number;

  /** Enable offline queuing (default: true) */
  enabled?: boolean;
}

// ===== Storage Schema =====

const OFFLINE_QUEUE_SCHEMA: CacheSchema<OfflineQueueData> = {
  version: 1,
  validate: (data: any): boolean => {
    return (
      data &&
      typeof data === "object" &&
      Array.isArray(data.entries) &&
      typeof data.maxQueueSize === "number" &&
      typeof data.maxRetryAttempts === "number"
    );
  },
  migrate: (oldData: any, oldVersion: number): OfflineQueueData | null => {
    // No migrations yet (v1 is initial)
    if (oldVersion === 0) {
      if (!Array.isArray(oldData.entries)) return null;
      return {
        entries: oldData.entries,
        maxQueueSize: oldData.maxQueueSize || 100,
        maxRetryAttempts: oldData.maxRetryAttempts || 3,
      };
    }
    return null;
  },
};

/**
 * Offline Queue Manager
 *
 * Singleton managing the queue lifecycle: enqueue, persist, load, flush/replay
 */
export const OfflineQueueManager = {
  // In-memory queue state
  _queue: new Map<string, QueuedRequestEntry>(), // Deduplicated by key
  _config: {
    maxQueueSize: 100,
    maxRetryAttempts: 3,
    enabled: true,
  } as Required<OfflineQueueConfig>,
  _isInitialized: false,

  /**
   * Initialize offline queue from SecureStorage
   */
  async initialize(config?: OfflineQueueConfig): Promise<void> {
    if (this._isInitialized) return;

    // Merge config with defaults
    this._config = {
      maxQueueSize: config?.maxQueueSize ?? 100,
      maxRetryAttempts: config?.maxRetryAttempts ?? 3,
      enabled: config?.enabled ?? true,
    };

    if (!this._config.enabled) {
      logger.info("api", "Offline queue disabled");
      this._isInitialized = true;
      return;
    }

    try {
      const stored = await SecureStorage.getJSON<
        VersionedCacheEntry<OfflineQueueData>
      >(STORAGE_KEYS.OFFLINE_QUEUE);

      if (stored) {
        const validation = validateCacheEntry(stored, OFFLINE_QUEUE_SCHEMA);
        if (validation.valid) {
          const queueData = (stored as VersionedCacheEntry<OfflineQueueData>)
            .data;
          this._queue = new Map(queueData.entries.map((e) => [e.key, e]));
          logger.info("api", "Offline queue loaded", {
            length: this._queue.size,
            oldestEntry: this._getOldestEntryTime(),
          });
        } else if (validation.shouldMigrate && OFFLINE_QUEUE_SCHEMA.migrate) {
          const migrated = await handleCacheMigration(
            stored,
            validation,
            OFFLINE_QUEUE_SCHEMA,
          );
          if (migrated) {
            this._queue = new Map(migrated.entries.map((e) => [e.key, e]));
            await this._persist();
          } else {
            this._queue.clear();
          }
        } else {
          this._queue.clear();
          logger.warn("api", "Offline queue reset due to validation failure");
        }
      }
    } catch (error) {
      logger.error("api", "Error loading offline queue", error);
      this._queue.clear();
    }

    this._isInitialized = true;
  },

  /**
   * Enqueue a request for offline replay
   */
  async enqueue(entry: QueuedRequestEntry): Promise<void> {
    if (!this._config.enabled) return;

    // Deduplicate: overwrite existing entry with same key, reset attempts
    this._queue.set(entry.key, {
      ...entry,
      attempts: 0,
      lastAttemptAt: undefined,
    });

    // Enforce max queue size: drop oldest entries
    if (this._queue.size > this._config.maxQueueSize) {
      const sortedByAge = Array.from(this._queue.values()).sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      const entriesToKeep = sortedByAge.slice(
        sortedByAge.length - this._config.maxQueueSize,
      );
      this._queue.clear();
      entriesToKeep.forEach((e) => this._queue.set(e.key, e));

      logger.warn(
        "api",
        "Offline queue size exceeded, dropped oldest entries",
        {
          queueSize: this._queue.size,
        },
      );
    }

    await this._persist();
    logger.debug("api", "Request queued for offline replay", {
      key: entry.key,
      queueLength: this._queue.size,
    });
  },

  /**
   * Dequeue a single entry (mark as processed during replay)
   */
  async dequeue(key: string): Promise<void> {
    if (!this._config.enabled) return;
    this._queue.delete(key);
    await this._persist();
  },

  /**
   * Get all queued entries (for replay)
   */
  getEntries(): QueuedRequestEntry[] {
    return Array.from(this._queue.values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  },

  /**
   * Mark a queued entry as attempted
   */
  async recordAttempt(key: string): Promise<void> {
    const entry = this._queue.get(key);
    if (!entry) return;

    entry.attempts++;
    entry.lastAttemptAt = Date.now();

    // If max attempts exceeded, remove from queue
    if (entry.attempts > this._config.maxRetryAttempts) {
      logger.warn("api", "Offline queue entry max retries exceeded", {
        key,
        attempts: entry.attempts,
      });
      this._queue.delete(key);
    }

    await this._persist();
  },

  /**
   * Get queue statistics
   */
  getStats(): OfflineQueueStats {
    const failedCount = Array.from(this._queue.values()).filter(
      (e) => e.attempts > 0,
    ).length;

    return {
      queueLength: this._queue.size,
      oldestEntryTime: this._getOldestEntryTime(),
      failedAttempts: failedCount,
      maxQueueSize: this._config.maxQueueSize,
      maxRetryAttempts: this._config.maxRetryAttempts,
    };
  },

  /**
   * Clear entire queue or single key
   */
  async clear(key?: string): Promise<void> {
    if (key) {
      this._queue.delete(key);
    } else {
      this._queue.clear();
    }
    await this._persist();
  },

  /**
   * Private: Persist queue to SecureStorage
   */
  async _persist(): Promise<void> {
    try {
      const queueData: OfflineQueueData = {
        entries: Array.from(this._queue.values()),
        maxQueueSize: this._config.maxQueueSize,
        maxRetryAttempts: this._config.maxRetryAttempts,
      };

      const versionedEntry: VersionedCacheEntry<OfflineQueueData> = {
        version: OFFLINE_QUEUE_SCHEMA.version,
        data: queueData,
        timestamp: Date.now(),
      };

      await SecureStorage.setJSON(STORAGE_KEYS.OFFLINE_QUEUE, versionedEntry);
    } catch (error) {
      logger.error("api", "Error persisting offline queue", error);
    }
  },

  /**
   * Private: Get oldest entry creation time
   */
  _getOldestEntryTime(): number | null {
    const entries = Array.from(this._queue.values());
    if (entries.length === 0) return null;
    return Math.min(...entries.map((e) => e.createdAt));
  },

  /**
   * Reset manager state (for testing only)
   */
  _reset(): void {
    this._queue.clear();
    this._isInitialized = false;
    this._config = {
      maxQueueSize: 100,
      maxRetryAttempts: 3,
      enabled: true,
    };
  },
};
