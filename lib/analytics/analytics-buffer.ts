/**
 * Analytics Buffer for Offline Support
 *
 * Queue analytics events while offline and automatically flush when reconnected.
 * Stores events in SecureStorage (encrypted, survives app restart).
 *
 * Features:
 * - FIFO ordering by timestamp
 * - UUID-based deduplication
 * - Retry counting and tracking
 * - Configurable queue size limit (default 100 events)
 * - Automatic validation on load (removes corrupted/stale events)
 * - Overflow handling (FIFO drop: discard oldest if exceeds max size)
 * - Respects analytics consent (discard pending on consent withdraw)
 */

import { getAppConfig } from "@/lib/config/loader";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";

/**
 * An analytics event queued for offline delivery
 */
export interface QueuedAnalyticsEvent {
  id: string; // UUID for deduplication
  timestamp: number; // When created (milliseconds since epoch)
  eventType: string; // 'pageview', 'event', 'error', 'performance'
  payload: Record<string, any>; // Sanitized event data (no PII)
  retryCount: number; // Number of failed delivery attempts
  maxRetries: number; // Max retry attempts before discard (default 5)
  metadata?: {
    offlineAt?: number; // When queued during offline period
    priority?: "high" | "low"; // high = always retry, low = may drop on overflow
  };
}

/**
 * Configuration for analytics buffer
 */
export interface AnalyticsBufferConfig {
  enabled: boolean;
  maxSize: number; // Max events in queue (default 100)
  maxRetries: number; // Max retries before discard (default 5)
  batchSize: number; // Events per flush request (default 25)
  retryBaseMs: number; // Base backoff delay (default 1000ms)
  debounceMs: number; // Debounce flush on network flaps (default 5000ms)
}

/**
 * Hard-coded safe defaults (fallback only)
 */
const SAFE_DEFAULTS: AnalyticsBufferConfig = {
  enabled: true,
  maxSize: 100,
  maxRetries: 5,
  batchSize: 25,
  retryBaseMs: 1000,
  debounceMs: 5000,
};

/**
 * Load analytics buffer config from appsettings, fall back to defaults if null
 * This const is evaluated at module load time and provides the source of truth
 */
const ANALYTICS_CONFIG: AnalyticsBufferConfig = (() => {
  try {
    const appConfig = getAppConfig();
    const bufferConfig = appConfig.analytics?.buffer;
    // If config exists in appsettings, merge with defaults; otherwise use defaults
    return bufferConfig
      ? { ...SAFE_DEFAULTS, ...bufferConfig }
      : SAFE_DEFAULTS;
  } catch {
    // If getAppConfig() fails, use defaults
    return SAFE_DEFAULTS;
  }
})();

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Statistics about the analytics buffer state
 */
export interface AnalyticsBufferStats {
  queueSize: number; // Current number of events in queue
  oldestEventAge: number; // Age of oldest event in milliseconds (0 if empty)
  overflowCount: number; // Number of events dropped due to overflow
  maxSize: number; // Configured max queue size
  retryStats: {
    eventsWithRetries: number; // Events that have been retried at least once
    averageRetryCount: number; // Average retry count across all events
    maxRetryCount: number; // Highest retry count in queue
  };
}

/**
 * Analytics Buffer Service
 *
 * Singleton service for managing offline analytics event queue.
 * Initialize once on app startup; events are automatically queued when offline.
 */
class AnalyticsBufferService {
  private queue: QueuedAnalyticsEvent[] = [];
  private initialized = false;
  private config: AnalyticsBufferConfig = ANALYTICS_CONFIG;
  private overflowCount = 0; // Track events dropped due to overflow

  /**
   * Initialize the queue from storage
   * Call once on app startup
   *
   * Config is loaded from appsettings at module load time (see ANALYTICS_CONFIG const).
   * User-provided overrides can be applied here.
   */
  async initialize(config?: Partial<AnalyticsBufferConfig>): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Apply user-provided runtime overrides if supplied
    if (config) {
      this.config = { ...this.config, ...config };
      logger
        .category("analytics")
        .info(`Applied runtime config overrides: ${JSON.stringify(config)}`);
    }

    try {
      const stored = await SecureStorage.getJSON<QueuedAnalyticsEvent[]>(
        STORAGE_KEYS.ANALYTICS_OFFLINE_QUEUE,
      );

      if (Array.isArray(stored)) {
        // Validate and clean queue on load
        const { valid, discarded } = this.validateQueueOnLoad(stored);
        this.queue = valid;

        logger
          .category("analytics")
          .info(
            `Loaded ${this.queue.length} queued analytics events from storage` +
              (discarded > 0 ? ` (${discarded} discarded as stale/corrupted)` : ""),
          );
      }

      this.initialized = true;
      logger
        .category("analytics")
        .info(
          `Analytics buffer initialized. Config: enabled=${this.config.enabled}, maxSize=${this.config.maxSize}, maxRetries=${this.config.maxRetries}`,
        );
    } catch (error) {
      logger
        .category("error")
        .error("Failed to initialize analytics buffer:", error);
      this.initialized = true; // Don't block app startup
    }
  }

  /**
   * Validate queue on load: remove corrupted/old events
   *
   * - Discard events older than 7 days
   * - Discard events missing required fields
   * - Trim to max 100 if overflow
   */
  private validateQueueOnLoad(
    events: any[],
  ): { valid: QueuedAnalyticsEvent[]; discarded: number } {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let discarded = 0;

    // Filter: keep only valid, recent events
    let valid = events.filter((event) => {
      // Check required fields
      if (!event.id || !event.timestamp || !event.eventType) {
        logger
          .category("analytics")
          .warn(
            `Discarded corrupted event (missing required fields): ${JSON.stringify(event).slice(0, 100)}`,
          );
        discarded++;
        return false;
      }

      // Check age (7-day retention)
      if (now - event.timestamp > sevenDaysMs) {
        logger
          .category("analytics")
          .debug(`Discarded stale event older than 7 days: ${event.id}`);
        discarded++;
        return false;
      }

      return true;
    });

    // Trim to max size if needed (keep newest, drop oldest)
    if (valid.length > this.config.maxSize) {
      const trimmed = valid.slice(-this.config.maxSize);
      const droppedCount = valid.length - trimmed.length;
      logger
        .category("analytics")
        .warn(
          `Queue exceeded max size (${valid.length} > ${this.config.maxSize}); dropped ${droppedCount} oldest events`,
        );
      discarded += droppedCount;
      valid = trimmed;
    }

    return { valid, discarded };
  }

  /**
   * Add an analytics event to the queue
   *
   * Returns the queued event or null if queueing failed
   */
  async enqueue(
    event: Omit<QueuedAnalyticsEvent, "id" | "timestamp" | "retryCount">,
  ): Promise<QueuedAnalyticsEvent | null> {
    if (!this.initialized) {
      logger
        .category("analytics")
        .warn("Analytics buffer not initialized; discarding event");
      return null;
    }

    try {
      const queued: QueuedAnalyticsEvent = {
        ...event,
        id: generateUUID(),
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Check if queue is at max size (FIFO overflow: drop oldest)
      if (this.queue.length >= this.config.maxSize) {
        const oldest = this.queue.shift();
        this.overflowCount++;
        logger
          .category("analytics")
          .warn(
            `Analytics queue at max size (${this.config.maxSize}); dropped oldest event: ${oldest?.id}`,
          );
      }

      this.queue.push(queued);
      await this.persist();

      logger
        .category("analytics")
        .debug(
          `Queued analytics event: ${queued.id} (${queued.eventType}) - queue size: ${this.queue.length}`,
        );

      return queued;
    } catch (error) {
      logger
        .category("error")
        .error("Failed to enqueue analytics event:", error);
      return null;
    }
  }

  /**
   * Get the next batch of events for flushing
   *
   * Returns events in FIFO order (oldest first), up to batchSize
   */
  async peek(batchSize: number = this.config.batchSize): Promise<QueuedAnalyticsEvent[]> {
    return this.queue
      .slice(0, batchSize)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Remove events from the queue after successful flush
   */
  async remove(ids: string[]): Promise<void> {
    const beforeCount = this.queue.length;
    this.queue = this.queue.filter((e) => !ids.includes(e.id));
    const removedCount = beforeCount - this.queue.length;

    if (removedCount > 0) {
      await this.persist();
      logger
        .category("analytics")
        .debug(
          `Removed ${removedCount} flushed analytics events from queue (new size: ${this.queue.length})`,
        );
    }
  }

  /**
   * Mark an event as failed (increment retry count)
   *
   * Called when a flush attempt fails; tracks failure reason
   */
  async markFailed(id: string, reason: string): Promise<void> {
    const event = this.queue.find((e) => e.id === id);
    if (!event) {
      logger
        .category("analytics")
        .warn(`Event not found in queue for retry marking: ${id}`);
      return;
    }

    event.retryCount++;
    await this.persist();

    logger
      .category("analytics")
      .debug(
        `Marked event ${id} as failed (attempt ${event.retryCount}/${event.maxRetries}): ${reason}`,
      );
  }

  /**
   * Remove an event permanently (after max retries or user action)
   */
  async discard(id: string, reason: string): Promise<void> {
    const beforeCount = this.queue.length;
    this.queue = this.queue.filter((e) => e.id !== id);

    if (this.queue.length < beforeCount) {
      await this.persist();
      logger
        .category("analytics")
        .info(`Discarded analytics event ${id}: ${reason}`);
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Clear the entire queue
   *
   * Use with caution; typically called on consent withdraw
   */
  async clear(): Promise<void> {
    this.queue = [];
    this.overflowCount = 0;
    await SecureStorage.removeItem(STORAGE_KEYS.ANALYTICS_OFFLINE_QUEUE);
    logger.category("analytics").warn("Cleared analytics buffer queue");
  }

  /**
   * Get comprehensive queue statistics
   */
  getStats(): AnalyticsBufferStats {
    const now = Date.now();
    const oldestEvent = this.queue.length > 0 ? this.queue[0] : null;
    const retryStats = this.queue.reduce(
      (acc, event) => {
        if (event.retryCount > 0) {
          acc.eventsWithRetries++;
        }
        acc.totalRetries += event.retryCount;
        acc.maxRetryCount = Math.max(acc.maxRetryCount, event.retryCount);
        return acc;
      },
      { eventsWithRetries: 0, totalRetries: 0, maxRetryCount: 0 },
    );

    return {
      queueSize: this.queue.length,
      oldestEventAge: oldestEvent ? now - oldestEvent.timestamp : 0,
      overflowCount: this.overflowCount,
      maxSize: this.config.maxSize,
      retryStats: {
        eventsWithRetries: retryStats.eventsWithRetries,
        averageRetryCount:
          this.queue.length > 0
            ? retryStats.totalRetries / this.queue.length
            : 0,
        maxRetryCount: retryStats.maxRetryCount,
      },
    };
  }

  /**
   * Get all queued events (for debugging)
   */
  async getAll(): Promise<QueuedAnalyticsEvent[]> {
    return [...this.queue];
  }

  /**
   * Get a specific event by ID
   */
  getEvent(id: string): QueuedAnalyticsEvent | undefined {
    return this.queue.find((e) => e.id === id);
  }

  /**
   * Persist the entire queue to storage
   */
  private async persist(): Promise<void> {
    try {
      await SecureStorage.setJSON(
        STORAGE_KEYS.ANALYTICS_OFFLINE_QUEUE,
        this.queue,
      );
    } catch (error) {
      logger
        .category("error")
        .error("Failed to persist analytics buffer:", error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalyticsBufferConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime (e.g., from remote config)
   */
  updateConfig(config: Partial<AnalyticsBufferConfig>): void {
    this.config = { ...this.config, ...config };
    logger
      .category("analytics")
      .info(`Updated analytics buffer config: ${JSON.stringify(config)}`);
  }

  /**
   * Check if buffer is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if buffer is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Singleton instance
 */
export const analyticsBufferService = new AnalyticsBufferService();
