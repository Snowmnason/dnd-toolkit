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
 * - Overflow handling (FIFO drop: discard oldest if exceeds max size, tracked in current session)
 * - Respects analytics consent (discard pending on consent withdraw)
 *
 * **Overflow Tracking:**
 * overflowCount is a session-only metric that resets on app restart.
 * It tracks dropped events during the current session to help identify capacity issues.
 * Use getAndResetOverflowCount() to inspect and optionally reset the counter during a session.
 */
import { ANALYTICS_RETRY_DEFAULTS, getAppConfig } from '@/config';
import { isNetworkOnline } from "@/lib/middleware/network";
import { clearAnalyticsQueue, loadAnalyticsQueueJSON, persistAnalyticsQueueJSON } from "@/lib/middleware/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";

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
  nextAttemptAt?: number; // When to retry next (milliseconds since epoch); if < now, ready to retry
  lastErrorReason?: string; // Reason for last failure (e.g., "HTTP 500", "network_error")
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
  batchDelayMs: number; // Delay between batch sends to avoid overwhelming backend (default 1000ms)
  endpoint?: string | null; // Analytics endpoint URL (optional override; fallback to env var / Sentry DSN)
}

/**
 * Hard-coded safe defaults (fallback only)
 */
const SAFE_DEFAULTS: AnalyticsBufferConfig = {
  enabled: true,
  maxSize: 100,
  maxRetries: ANALYTICS_RETRY_DEFAULTS.maxRetries,
  batchSize: 25,
  retryBaseMs: ANALYTICS_RETRY_DEFAULTS.retryBaseMs,
  debounceMs: ANALYTICS_RETRY_DEFAULTS.debounceMs,
  batchDelayMs: 1000,
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
 * Calculate exponential backoff delay (milliseconds)
 * Progress: 1s → 2s → 4s → 8s → 16s
 */
export function calculateExponentialBackoff(
  retryCount: number,
  baseMs: number = 1000,
): number {
  // 2^retryCount * baseMs (min 1s, max 16x base)
  const exponent = Math.min(retryCount, 4); // Cap at 4 (16s max)
  return Math.pow(2, exponent) * baseMs;
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
 * Callback type for state change subscribers
 */
export type AnalyticsBufferSubscriber = () => void;

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
  // Session-only metric: resets on app initialization. Counts events dropped due to queue overflow.
  // Use getAndResetOverflowCount() to inspect and reset during a session.
  private overflowCount = 0;
  private subscribers = new Set<AnalyticsBufferSubscriber>(); // Observer pattern for state changes

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

    // Reset session-only metrics on initialization (app startup)
    this.overflowCount = 0;

    // Validate and apply user-provided runtime overrides if supplied
    if (config) {
      // Validate override values before applying
      if (config.maxSize !== undefined && config.maxSize < 1) {
        throw new Error(
          `analytics.buffer.maxSize must be at least 1, got ${config.maxSize}`,
        );
      }
      if (config.maxRetries !== undefined && config.maxRetries < 0) {
        throw new Error(
          `analytics.buffer.maxRetries must be non-negative, got ${config.maxRetries}`,
        );
      }
      if (config.batchSize !== undefined && config.batchSize < 1) {
        throw new Error(
          `analytics.buffer.batchSize must be at least 1, got ${config.batchSize}`,
        );
      }
      if (config.retryBaseMs !== undefined && config.retryBaseMs <= 0) {
        throw new Error(
          `analytics.buffer.retryBaseMs must be positive (> 0), got ${config.retryBaseMs}`,
        );
      }
      if (config.debounceMs !== undefined && config.debounceMs < 0) {
        throw new Error(
          `analytics.buffer.debounceMs must be non-negative, got ${config.debounceMs}`,
        );
      }
      if (config.batchDelayMs !== undefined && config.batchDelayMs < 0) {
        throw new Error(
          `analytics.buffer.batchDelayMs must be non-negative, got ${config.batchDelayMs}`,
        );
      }
      if (
        config.endpoint !== undefined &&
        config.endpoint !== null &&
        typeof config.endpoint === "string" &&
        config.endpoint.trim().length === 0
      ) {
        throw new Error(
          `analytics.buffer.endpoint must not be an empty string; use null to disable`,
        );
      }

      this.config = { ...this.config, ...config };
      logger
        .category("analytics")
        .info(`Applied runtime config overrides: ${JSON.stringify(config)}`);
    }

    try {
      const stored = await loadAnalyticsQueueJSON<QueuedAnalyticsEvent[]>(
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

      // If online and queue has events ready to retry (or never attempted),
      // schedule an immediate flush to avoid waiting for network flap or 30s scheduler
      this.scheduleReadyEventsFlushIfOnline();
    } catch (error) {
      logger
        .category("error")
        .error("Failed to initialize analytics buffer:", error);
      this.initialized = true; // Don't block app startup
    }
  }

  /**
   * Schedule an immediate flush if we're online and have ready events
   * This ensures events queued during offline period flush as soon as app starts online
   */
  private scheduleReadyEventsFlushIfOnline(): void {
    // Check if device is online
    try {
      if (!isNetworkOnline()) {
        return; // Offline, no-op
      }

      const now = Date.now();
      const hasReadyEvents = this.queue.some(
        (e) => !e.nextAttemptAt || e.nextAttemptAt <= now,
      );

      if (hasReadyEvents) {
        logger
          .category("analytics")
          .debug(
            `Buffer initialized online with ready events; scheduling immediate flush`,
          );
        // Import async here to avoid circular deps at module load time
        // The flush will happen asynchronously; we don't await it
        (async () => {
          try {
            const { flushAnalyticsQueue } = await import(
              "./analytics-network-integration"
            );
            await flushAnalyticsQueue();
          } catch (error) {
            logger
              .category("analytics")
              .error("Failed to flush ready events on initialize:", error);
          }
        })();
      }
    } catch {
      logger
        .category("analytics")
        .debug("Could not check for ready events on initialize (network not available yet)");
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
    event: Omit<QueuedAnalyticsEvent, "id" | "timestamp" | "retryCount"> & { maxRetries?: number },
  ): Promise<QueuedAnalyticsEvent | null> {
    if (!this.initialized) {
      logger
        .category("analytics")
        .warn("Analytics buffer not initialized; discarding event");
      return null;
    }

    if (!this.config.enabled) {
      logger
        .category("analytics")
        .debug("Analytics buffer disabled; skipping enqueue");
      return null;
    }

    try {
      const queued: QueuedAnalyticsEvent = {
        ...event,
        id: generateUUID(),
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: event.maxRetries ?? this.config.maxRetries,
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
      this.notifySubscribers();

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
  peek(batchSize: number = this.config.batchSize): QueuedAnalyticsEvent[] {
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
      this.notifySubscribers();
      logger
        .category("analytics")
        .debug(
          `Removed ${removedCount} flushed analytics events from queue (new size: ${this.queue.length})`,
        );
    }
  }

  /**
   * Mark an event as failed (increment retry count and schedule next attempt)
   *
   * Called when a flush attempt fails; tracks failure reason and schedules next retry via exponential backoff
   * If max retries exceeded, event is discarded automatically
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
    event.lastErrorReason = reason;

    // Check if max retries exceeded
    if (event.retryCount >= event.maxRetries) {
      // Discard permanently
      this.queue = this.queue.filter((e) => e.id !== id);
      await this.persist();
      this.notifySubscribers();
      logger
        .category("analytics")
        .warn(
          `Analytics event ${id} discarded after ${event.maxRetries} retries: ${reason}`,
        );
      return;
    }

    // Calculate next attempt time using exponential backoff
    const backoffMs = calculateExponentialBackoff(
      event.retryCount,
      this.config.retryBaseMs,
    );
    event.nextAttemptAt = Date.now() + backoffMs;

    await this.persist();
    this.notifySubscribers();

    logger
      .category("analytics")
      .debug(
        `Marked event ${id} as failed (attempt ${event.retryCount}/${event.maxRetries}): ${reason} - next attempt in ${backoffMs}ms`,
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
      this.notifySubscribers();
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
    await clearAnalyticsQueue(STORAGE_KEYS.ANALYTICS_OFFLINE_QUEUE);
    this.notifySubscribers();
    logger.category("analytics").warn("Cleared analytics buffer queue");
  }

  /**
   * Get and reset the overflow count for this session
   *
   * Use this to inspect how many events were dropped due to queue overflow,
   * then reset the counter for the next monitoring period.
   *
   * @returns Current overflow count (events dropped since last reset or app start)
   */
  getAndResetOverflowCount(): number {
    const count = this.overflowCount;
    this.overflowCount = 0;
    logger
      .category("analytics")
      .debug(
        `Overflow count reset: was ${count}, now 0 (session-only metric)`,
      );
    return count;
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
  getAll(): QueuedAnalyticsEvent[] {
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
      await persistAnalyticsQueueJSON(
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

  /**
   * Handle consent withdrawal
   *
   * Called when user withdraws analytics consent. Immediately discards all pending
   * events without flushing. Only new events emitted after re-consent are buffered.
   *
   * Respects Phase 1b spec: "On consent withdraw: call clear(), remove storage key,
   * and log the discard locally (non-identifying). Do not schedule or send any pending events."
   */
  async handleConsentWithdrawal(): Promise<void> {
    if (this.queue.length > 0) {
      const count = this.queue.length;
      await this.clear();
      logger
        .category("analytics")
        .info(
          `Analytics consent withdrawn; discarded ${count} pending events without sending`,
        );
    } else {
      logger
        .category("analytics")
        .debug("Analytics consent withdrawn; no pending events to discard");
    }
  }

  /**
   * Subscribe to buffer state changes (observer pattern)
   * Subscriber callback is called whenever queue or flushing state changes
   * Returns unsubscribe function
   */
  subscribe(callback: AnalyticsBufferSubscriber): () => void {
    this.subscribers.add(callback);
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of state change
   * @internal
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        logger
          .category("error")
          .error("Analytics buffer subscriber error:", error);
      }
    });
  }
}

/**
 * Singleton instance
 */
export const analyticsBufferService = new AnalyticsBufferService();
/**
 * Notify buffer subscribers when flushing state changes
 * Called from analytics-network-integration.ts via _setAnalyticsBufferFlushing
 * @internal
 */
export function notifyBufferStateChange(): void {
  (analyticsBufferService as any).notifySubscribers?.();
}

// ─── Module-level flushing state (shared with network integration) ────
let _isFlushing = false;
let _lastFlushTime: number | null = null;

/**
 * Set analytics buffer flushing state
 * @internal
 */
export function _setAnalyticsBufferFlushing(value: boolean, timestamp?: number): void {
  _isFlushing = value;
  if (timestamp !== undefined) {
    _lastFlushTime = timestamp;
  }
  notifyBufferStateChange();
}

/**
 * Get analytics buffer flushing state
 * @internal
 */
export function _getAnalyticsBufferFlushing(): { isFlushing: boolean; lastFlushTime: number | null } {
  return { isFlushing: _isFlushing, lastFlushTime: _lastFlushTime };
}