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

import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
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
 * Configuration for retry behavior
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseRetryDelayMs: 2000,
  maxRetryDelayMs: 30000,
};

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
    RETRY_CONFIG.baseRetryDelayMs * Math.pow(2, retryCount),
    RETRY_CONFIG.maxRetryDelayMs,
  );
  return Date.now() + delayMs;
}

/**
 * Consent Sync Queue Service
 *
 * Singleton that manages queueing and processing consent changes for database sync.
 */
class ConsentSyncQueueService {
  private queue: PendingConsentSync[] = [];
  private isInitialized = false;
  private isProcessing = false;

  /**
   * Initialize the queue from storage
   * Call once on app startup
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
          .debug(`Loaded ${this.queue.length} pending consent syncs from storage`);
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
   */
  async enqueue(level: ConsentLevel): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
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
      .debug(`Queued consent sync: ${id}`, { level, queueSize: this.queue.length });

    // Non-blocking: trigger processing in background
    this.processQueue().catch((error) => {
      logger
        .category('analytics')
        .error('Background consent sync processing failed', { error });
    });

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
        .debug(`Processing ${readyItems.length} pending consent syncs`);

      // Process each item
      for (const item of readyItems) {
        try {
          await this.syncToDatabase(item);
          // Remove from queue on success
          this.queue = this.queue.filter((i) => i.id !== item.id);
          logger
            .category('analytics')
            .debug(`Consent sync succeeded: ${item.id}`, { level: item.level });
        } catch (error) {
          // Handle retry logic
          await this.handleSyncFailure(item, error);
        }
      }

      // Persist updated queue
      await this.persist();
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
    // Dynamically import to avoid circular depends and Supabase config checks
    const { isSupabaseConfigured } = await import('@/lib/database');
    const { userSettingsDB } = await import('@/lib/database');

    if (!isSupabaseConfigured()) {
      // No-op if Supabase not configured (e.g., GitHub Pages deployment)
      logger
        .category('analytics')
        .debug('Skipping consent sync - Supabase not configured');
      return;
    }

    // Update consent level in database
    // This method from user_settings.ts handles all auth validation and error handling
    await userSettingsDB.updateAnalyticsConsentLevel(item.level);

    logger
      .category('analytics')
      .info(`Consent level synced to database: ${item.level}`);
  }

  /**
   * Handle sync failure with retry logic
   */
  private async handleSyncFailure(
    item: PendingConsentSync,
    error: unknown,
  ): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (item.retryCount < RETRY_CONFIG.maxRetries) {
      // Schedule retry
      item.retryCount += 1;
      item.nextRetryAt = calculateNextRetry(item.retryCount);
      item.lastError = errorMsg;

      logger
        .category('analytics')
        .warn(`Consent sync failed, scheduled retry ${item.retryCount}/${RETRY_CONFIG.maxRetries}`, {
          id: item.id,
          error: errorMsg,
          nextRetryAt: new Date(item.nextRetryAt).toISOString(),
        });
    } else {
      // Max retries exceeded - log and keep in queue for manual inspection
      logger
        .category('analytics')
        .error(`Consent sync failed, max retries exceeded`, {
          id: item.id,
          error: errorMsg,
          retries: item.retryCount,
        });

      // Stop retrying but keep in queue (can be manually cleared)
      item.nextRetryAt = Date.now() + 24 * 60 * 60 * 1000; // Retry once per day
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
};

export type { PendingConsentSync };

