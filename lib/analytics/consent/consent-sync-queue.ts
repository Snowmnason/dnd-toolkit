/**
 * Analytics Consent Sync Queue
 *
 * Queues consent level changes for syncing to the database.
 * Handles offline scenarios with automatic retry on network recovery.
 *
 * Features:
 * - Persistent queue (SecureStorage)
 * - Fire-and-forget async processing
 * - Basic exponential backoff retry
 * - Network-aware automatic processing
 *
 * Usage:
 * ```ts
 * import { ConsentSyncQueue } from '@/lib/analytics/consent-sync-queue';
 *
 * // Queue a consent change for syncing
 * await ConsentSyncQueue.enqueue('full');
 *
 * // Manually process queue (also called automatically on network recovery)
 * await ConsentSyncQueue.processQueue();
 * ```
 */

import { CONSENT_SYNC_DEFAULTS } from '@/config';
import { SecureStorage } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from "@/maps";
import type { ConsentLevel } from './consent';

/**
 * A pending consent sync item
 */
interface PendingConsentSync {
  id: string;
  level: ConsentLevel;
  createdAt: number;
  retryCount: number;
  nextRetryAt: number;
  lastError?: string;
}



/**
 * Generate a simple UUID-like string
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate next retry time with exponential backoff
 */
function calculateNextRetry(retryCount: number): number {
  const delayMs = Math.min(
    CONSENT_SYNC_DEFAULTS.baseRetryDelayMs * Math.pow(2, retryCount),
    CONSENT_SYNC_DEFAULTS.maxRetryDelayMs,
  );
  return Date.now() + delayMs;
}

/**
 * Consent Sync Queue Service
 *
 * Singleton that manages queueing and processing consent changes for database sync.
 * Features:
 * - Persistent queue (survives app restart)
 * - Automatic retry scheduling with exponential backoff
 * - NetworkDetection hook for auto-processing on reconnect
 * - Retry timeout for automatic processing of ready items
 */
class ConsentSyncQueueService {
  private queue: PendingConsentSync[] = [];
  private isInitialized = false;
  private isProcessing = false;
  private retryTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private lastNetworkOnlineTime = 0;
  private networkDebounceMs = 5000; // Debounce network transitions to prevent spam

  /**
   * Initialize the queue from storage
   * Call once on app startup
   * 
   * Loads persisted queue items and triggers processQueue() if there are pending items
   * ready for retry.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const stored = await SecureStorage.getJSON<PendingConsentSync[]>(
        STORAGE_KEYS.CONSENT_SYNC_QUEUE,
      );

      if (Array.isArray(stored)) {
        this.queue = stored;
          logger
            .category('analytics')
            .analytics(`Loaded ${this.queue.length} pending consent syncs from storage`);
        
        // If there are pending items, schedule a retry check
        if (this.queue.length > 0) {
          this.scheduleRetryTimeout();
        }
      }
      this.isInitialized = true;
    } catch (error) {
      logger
      .category('analytics')
      .error('Failed to initialize consent sync queue from storage', { error });
      this.isInitialized = true; // Don't block app startup
    }
  }

  /**
   * Enqueue a consent change for syncing to database
   * Non-blocking - adds to queue and returns immediately
   *
   * **Coalescing:** If there are already pending items, replaces them with this latest change.
   * Only the most recent consent level matters, so we avoid unbounded queue growth when
   * users change consent multiple times while offline.
   */
  async enqueue(level: ConsentLevel): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Coalesce: Remove any existing pending items and replace with latest level
    // (User changing consent 3 times → only final state persists)
    if (this.queue.length > 0) {
      logger
        .category('analytics')
        .analytics(`Coalescing ${this.queue.length} pending items into new change`, {
          oldLevel: this.queue[0]?.level,
          newLevel: level,
        });
      this.queue = [];
    }

    const id = generateId();
    const syncItem: PendingConsentSync = {
      id,
      level,
      createdAt: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now(), // Ready to process immediately
    };

    this.queue.push(syncItem);
    await this.persist();

    logger
      .category('analytics')
      .analytics(`Queued consent sync: ${id}`, { level, queueSize: this.queue.length });

    // Non-blocking: trigger processing in background
    this.processQueue().catch((error) => {
      logger
        .category('analytics')
        .error('Background consent sync processing failed', { error });
    });

    // Schedule retry timeout for any pending items
    this.scheduleRetryTimeout();

    return id;
  }

  /**
   * Process all pending syncs that are ready to retry
   * Call this manually or it's called automatically on network recovery
   */
  async processQueue(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process items that are ready for retry
      const now = Date.now();
      const readyItems = this.queue.filter((item) => item.nextRetryAt <= now);

      if (readyItems.length === 0) {
        this.isProcessing = false;
        return;
      }

      logger
        .category('analytics')
        .analytics(`Processing ${readyItems.length} pending consent syncs`);

      // Process each item
      for (const item of readyItems) {
        try {
          await this.syncToDatabase(item);
          // Remove from queue on success
          this.queue = this.queue.filter((i) => i.id !== item.id);
          logger
            .category('analytics')
            .analytics(`Consent sync succeeded: ${item.id}`, { level: item.level });
        } catch (error) {
          // Handle retry logic
          await this.handleSyncFailure(item, error);
        }
      }

      // Persist updated queue
      await this.persist();
      
      // Reschedule retry timeout based on any remaining pending items
      this.scheduleRetryTimeout();
    } catch (error) {
      logger
        .category('analytics')
        .error('Error processing consent sync queue', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Sync a single consent change to the database
   * @throws If the database update fails
   */
  private async syncToDatabase(item: PendingConsentSync): Promise<void> {
    // Check if database is configured via domain wrapper
    const { isDatabaseConfigured } = await import('@/lib/database');
    const { userSettingsDB } = await import('@/lib/database');

    if (!isDatabaseConfigured()) {
      // No-op if database not configured (e.g., GitHub Pages deployment)
      logger
        .category('analytics')
        .analytics('Skipping consent sync - database not configured');
      return;
    }

    // Update consent level in database
    // This method from user_settings.ts handles all auth validation and error handling
    await userSettingsDB.updateAnalyticsConsentLevel(item.level);

    logger
      .category('analytics')
      .analytics(`Consent level synced to database: ${item.level}`);
  }

  /**
   * Handle sync failure with retry logic
   *
   * Retries with exponential backoff up to maxRetries. After max retries exceeded,
   * **discards the item** to prevent unbounded queue growth (e.g., failed auth → daily retries forever).
   *
   * Rationale: Consent sync failures are typically auth-related (not authenticated at sync time).
   * Retrying forever serves no purpose. Next time user changes consent (or logs in + changes consent),
   * a new item will be enqueued with fresh retry count.
   */
  private async handleSyncFailure(
    item: PendingConsentSync,
    error: unknown,
  ): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (item.retryCount < CONSENT_SYNC_DEFAULTS.maxRetries) {
      // Schedule retry
      item.retryCount += 1;
      item.nextRetryAt = calculateNextRetry(item.retryCount);
      item.lastError = errorMsg;

      logger
        .category('analytics')
        .warn(`Consent sync failed, scheduled retry ${item.retryCount}/${CONSENT_SYNC_DEFAULTS.maxRetries}`, {
          id: item.id,
          error: errorMsg,
          nextRetryAt: new Date(item.nextRetryAt).toISOString(),
        });
    } else {
      // Max retries exceeded - discard item to prevent unbounded queue
      logger
        .category('analytics')
        .error(`Consent sync failed, max retries exceeded; discarding item`, {
          id: item.id,
          error: errorMsg,
          retries: item.retryCount,
        });

      // Remove item from queue
      this.queue = this.queue.filter((i) => i.id !== item.id);
    }
  }

  /**
   * Persist queue to SecureStorage
   */
  private async persist(): Promise<void> {
    try {
      await SecureStorage.setJSON(STORAGE_KEYS.CONSENT_SYNC_QUEUE, this.queue);
    } catch (error) {
      logger
        .category('analytics')
        .error('Failed to persist consent sync queue', { error });
    }
  }

  /**
   * Schedule a timeout to process the queue when the next retry item is ready.
   * Prevents blocking the main thread and wakes up automatically at the right time.
   * @internal
   */
  private scheduleRetryTimeout(): void {
    // Clear any existing timeout
    if (this.retryTimeoutHandle) {
      clearTimeout(this.retryTimeoutHandle);
      this.retryTimeoutHandle = null;
    }

    if (this.queue.length === 0) {
      return; // Nothing to retry
    }

    // Find next item ready for retry
    const now = Date.now();
    const nextRetryItem = this.queue.reduce<PendingConsentSync | null>(
      (nearest, item) => {
        if (!nearest || item.nextRetryAt < nearest.nextRetryAt) {
          return item;
        }
        return nearest;
      },
      null,
    );

    if (!nextRetryItem) {
      return;
    }

    const delayMs = Math.max(0, nextRetryItem.nextRetryAt - now);

    // Schedule timeout to check if item is ready
    // Add small jitter to prevent thundering herd if multiple queues scheduled similarly
    const jitteredDelayMs = delayMs + Math.random() * 100;

    this.retryTimeoutHandle = setTimeout(() => {
      this.retryTimeoutHandle = null;
      this.processQueue().catch((error) => {
        logger
          .category('analytics')
          .warn('Retry timeout processing failed', { error });
      });
    }, jitteredDelayMs);

    logger
      .category('analytics')
      .analytics(`Scheduled next consent sync retry in ${delayMs}ms`);
  }

  /**
   * Hook into NetworkDetection for automatic processing on reconnect.
   * Triggers processQueue() when device transitions from offline → online.
   */
  hookNetworkDetection(networkDetection: { subscribe: (cb: (status: { isOnline: boolean }) => void) => () => void }): void {
    if (this.networkUnsubscribe) {
      logger
        .category('analytics')
        .info('ConsentSyncQueue', 'NetworkDetection already hooked');
      return;
    }

    let wasOnline = true; // Assume online on initial hook

    this.networkUnsubscribe = networkDetection.subscribe(async (status) => {
      const now = Date.now();
      const isOnline = status.isOnline;

      // Online transition (false -> true) with debounce
      if (isOnline && !wasOnline && now - this.lastNetworkOnlineTime >= this.networkDebounceMs) {
        this.lastNetworkOnlineTime = now;
        logger
          .category('analytics')
          .info('ConsentSyncQueue', 'Online transition detected, triggering auto-process');

        // Process in background (non-blocking)
        this.processQueue().catch((err) => {
          logger
            .category('analytics')
            .error('ConsentSyncQueue', `Auto-process failed: ${err}`);
        });
      }

      wasOnline = isOnline;
    });

    logger.category('analytics').info('ConsentSyncQueue', 'NetworkDetection hook installed');
  }

  /**
   * Unhook from NetworkDetection
   */
  unhookNetworkDetection(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
      logger
        .category('analytics')
        .analytics('ConsentSyncQueue', 'NetworkDetection hook removed');
    }

    // Also clear retry timeout
    if (this.retryTimeoutHandle) {
      clearTimeout(this.retryTimeoutHandle);
      this.retryTimeoutHandle = null;
    }
  }

  /**
   * Get current queue size (for diagnostics)
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get all pending syncs (for diagnostics/debugging)
   */
  getAll(): PendingConsentSync[] {
    return [...this.queue];
  }

  /**
   * Clear the queue (use with caution - for testing/recovery)
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persist();
    logger.category('analytics').warn('Consent sync queue cleared');
  }
}

/**
 * Singleton instance
 */
let queueInstance: ConsentSyncQueueService | null = null;

/**
 * Get the consent sync queue singleton
 */
export function getConsentSyncQueue(): ConsentSyncQueueService {
  if (!queueInstance) {
    queueInstance = new ConsentSyncQueueService();
  }
  return queueInstance;
}

/**
 * Exports for convenience
 */
export const ConsentSyncQueue = {
  /**
   * Initialize queue from storage (call once at app startup)
   * Loads persisted queue items and schedules retry timeout if needed
   */
  async initialize(): Promise<void> {
    return getConsentSyncQueue().initialize();
  },

  /**
   * Queue a consent change for syncing to database (fire-and-forget)
   */
  async enqueue(level: ConsentLevel): Promise<string> {
    return getConsentSyncQueue().enqueue(level);
  },

  /**
   * Process all pending syncs that are ready to retry
   */
  async processQueue(): Promise<void> {
    return getConsentSyncQueue().processQueue();
  },

  /**
   * Get current queue size
   */
  size(): number {
    return getConsentSyncQueue().size();
  },

  /**
   * Get all pending syncs
   */
  getAll(): PendingConsentSync[] {
    return getConsentSyncQueue().getAll();
  },

  /**
   * Clear queue (for testing/recovery)
   */
  async clear(): Promise<void> {
    return getConsentSyncQueue().clear();
  },

  /**
   * Hook into NetworkDetection for automatic processing on reconnect
   */
  hookNetworkDetection(networkDetection: { subscribe: (cb: (status: { isOnline: boolean }) => void) => () => void }): void {
    return getConsentSyncQueue().hookNetworkDetection(networkDetection);
  },

  /**
   * Unhook from NetworkDetection
   */
  unhookNetworkDetection(): void {
    return getConsentSyncQueue().unhookNetworkDetection();
  },
};

export type { PendingConsentSync };

