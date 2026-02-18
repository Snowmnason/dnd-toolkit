/**
 * Breadcrumb Queue Service
 *
 * Generic, provider-agnostic queue for storing breadcrumbs offline
 * and flushing them when online.
 *
 * No Sentry imports here — all provider-specific logic is in adapters.
 */

import { BreadcrumbProvider, BreadcrumbSendResult, QueuedBreadcrumb } from '@/lib/services/provider-adapter';
import { STORAGE_KEYS, SecureStorage } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';

/**
 * In-memory queue statistics (not persisted)
 */
export interface BreadcrumbQueueStats {
  queueSize: number;
  oldestBreadcrumbTime?: number; // ms since epoch
  lastFlushTime?: number;
  overflowCount: number; // Session-only counter
  providerName: string;
}

/**
 * Breadcrumb Queue Service
 * Handles persistence, FIFO ordering, retry scheduling, deduplication
 */
class BreadcrumbQueueService {
  private queue: QueuedBreadcrumb[] = [];
  private provider: BreadcrumbProvider | null = null;
  private overflowCount = 0; // Session-only
  private lastFlushTime: number | undefined = undefined;
  private isFlushing = false;
  private deduplicationCache = new Map<string, number>(); // fingerprint -> lastSentAt (ms)
  private readonly maxBreadcrumbs = 500;
  private readonly retentionDays = 14;
  private readonly deduplicationTTL = 24 * 60 * 60 * 1000; // 24h in ms
  private networkUnsubscribe: (() => void) | null = null;
  private lastNetworkOnTime = 0;
  private readonly debounceMs = 5000; // Debounce flush: once per 5s

  /**
   * Initialize queue from SecureStorage and set active provider
   */
  async initialize(provider: BreadcrumbProvider): Promise<void> {
    if (!provider) {
      throw new Error('BreadcrumbQueue: provider is required');
    }

    this.provider = provider;
    logger.category('analytics').info('BreadcrumbQueue', `Initializing with provider: ${provider.name}`);

    try {
      // Load queue from storage
      const stored = await SecureStorage.getItem(STORAGE_KEYS.BREADCRUMB_QUEUE);
      if (stored) {
        this.queue = JSON.parse(stored) as QueuedBreadcrumb[];
        logger.category('analytics').info('BreadcrumbQueue', `Loaded ${this.queue.length} breadcrumbs from storage`);
      }

      // Load deduplication cache
      const dedupCached = await SecureStorage.getItem(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE);
      if (dedupCached) {
        const parsed = JSON.parse(dedupCached) as Record<string, number>;
        this.deduplicationCache = new Map(Object.entries(parsed));
      }

      // Validate and clean up on load
      await this._validateAndCleanup();
    } catch (error) {
      logger.category('analytics').error('BreadcrumbQueue', `Failed to initialize: ${error}`);
      this.queue = [];
      this.deduplicationCache.clear();
    }
  }

  /**
   * Queue a breadcrumb for delivery
   * Returns the queued breadcrumb or null if filtered by dedup
   */
  async enqueue(breadcrumb: Omit<QueuedBreadcrumb, 'id' | 'fingerprint' | 'retryCount' | 'maxRetries'>): Promise<QueuedBreadcrumb | null> {
    if (!this.provider) {
      logger.category('analytics').warn('BreadcrumbQueue', 'enqueue called before initialization');
      return null;
    }

    // Compute fingerprint hash
    const fingerprint = this._computeFingerprint(breadcrumb);

    // Check dedup cache
    const lastSent = this.deduplicationCache.get(fingerprint);
    if (lastSent && Date.now() - lastSent < this.deduplicationTTL) {
      logger.category('analytics').debug(
        'BreadcrumbQueue',
        `Skipping duplicate breadcrumb (fingerprint: ${fingerprint})`
      );
      return null;
    }

    // Create queued breadcrumb
    const queuedBreadcrumb: QueuedBreadcrumb = {
      id: crypto.randomBytes(16).toString('hex'),
      timestamp: breadcrumb.timestamp,
      category: breadcrumb.category,
      level: breadcrumb.level,
      message: breadcrumb.message,
      data: breadcrumb.data,
      fingerprint,
      retryCount: 0,
      maxRetries: 5,
      metadata: {
        ...breadcrumb.metadata,
        offlineAt: Date.now(),
      },
    };

    // Add to queue
    this.queue.push(queuedBreadcrumb);

    // Check overflow
    if (this.queue.length > this.maxBreadcrumbs) {
      const dropped = this.queue.shift();
      this.overflowCount++;
      logger.category('analytics').warn(
        'BreadcrumbQueue',
        `Queue overflow: dropped old breadcrumb (id: ${dropped?.id}), overflow count: ${this.overflowCount}`
      );
    }

    // Persist to storage
    await this._persist();

    logger.category('analytics').debug(
      'BreadcrumbQueue',
      `Enqueued breadcrumb (id: ${queuedBreadcrumb.id}, queue size: ${this.queue.length})`
    );

    return queuedBreadcrumb;
  }

  /**
   * Peek at the next batch of breadcrumbs (FIFO)
   */
  peek(batchSize: number = 10): QueuedBreadcrumb[] {
    return this.queue.slice(0, batchSize);
  }

  /**
   * Remove breadcrumbs by ID (after successful send)
   */
  async remove(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const before = this.queue.length;
    this.queue = this.queue.filter((b) => !idSet.has(b.id));

    if (before !== this.queue.length) {
      await this._persist();
      logger.category('analytics').debug(
        'BreadcrumbQueue',
        `Removed ${before - this.queue.length} breadcrumbs, queue size: ${this.queue.length}`
      );
    }
  }

  /**
   * Mark breadcrumb as failed, schedule retry via exponential backoff
   */
  async markFailed(id: string, reason: string): Promise<void> {
    const breadcrumb = this.queue.find((b) => b.id === id);
    if (!breadcrumb) return;

    breadcrumb.retryCount++;

    if (breadcrumb.retryCount >= breadcrumb.maxRetries) {
      // Max retries exceeded, discard
      await this.discard(id, `max retries exceeded (${reason})`);
      return;
    }

    // Schedule next retry
    const backoffMs = Math.pow(2, Math.min(breadcrumb.retryCount, 4)) * 1000; // 1s, 2s, 4s, 8s, 16s
    breadcrumb.nextAttemptAt = Date.now() + backoffMs;

    await this._persist();
    logger.category('analytics').debug(
      'BreadcrumbQueue',
      `Markfailed breadcrumb (id: ${id}, retry: ${breadcrumb.retryCount}/${breadcrumb.maxRetries}, next attempt: ${backoffMs}ms)`
    );
  }

  /**
   * Discard breadcrumb permanently (4xx, validation errors, max retries)
   */
  async discard(id: string, reason: string): Promise<void> {
    const index = this.queue.findIndex((b) => b.id === id);
    if (index === -1) return;

    // Remove the breadcrumb atomically and return the removed item.
    const [breadcrumb] = this.queue.splice(index, 1);
    if (!breadcrumb) return;

    await this._persist();
    logger.category('analytics').warn('BreadcrumbQueue', `Discarded breadcrumb (id: ${id}, reason: ${reason})`);
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get queue statistics
   */
  getStats(): BreadcrumbQueueStats {
    return {
      queueSize: this.queue.length,
      oldestBreadcrumbTime: this.queue.length > 0 ? this.queue[0].timestamp : undefined,
      lastFlushTime: this.lastFlushTime,
      overflowCount: this.overflowCount,
      providerName: this.provider?.name || 'unknown',
    };
  }

  /**
   * Get and reset overflow counter (session-only metric)
   */
  getAndResetOverflowCount(): number {
    const count = this.overflowCount;
    this.overflowCount = 0;
    return count;
  }

  /**
   * Flush pending breadcrumbs via provider
   */
  async flush(): Promise<void> {
    if (this.isFlushing || !this.provider || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      const batch = this.peek(10); // Provider typically recommends 10 per request

      logger.category('analytics').info(
        'BreadcrumbQueue',
        `Flushing batch of ${batch.length} breadcrumbs via ${this.provider.name}`
      );

      const result: BreadcrumbSendResult = await this.provider.sendBatch(batch);

      // Process successes
      if (result.sent.length > 0) {
        // Mark as sent in dedup cache
        for (const id of result.sent) {
          const breadcrumb = this.queue.find((b) => b.id === id);
          if (breadcrumb) {
            this.deduplicationCache.set(breadcrumb.fingerprint, Date.now());
          }
        }
        await this._persistDedupCache();
        await this.remove(result.sent);
        logger.category('analytics').debug('BreadcrumbQueue', `Sent ${result.sent.length} breadcrumbs`);
      }

      // Process retries (5xx, network errors, rate-limited)
      for (const id of result.retry) {
        await this.markFailed(id, 'provider retry');
      }

      // Process discards (4xx, validation errors)
      for (const id of result.discard) {
        await this.discard(id, 'provider rejected');
      }

      this.lastFlushTime = Date.now();
      logger.category('analytics').info(
        'BreadcrumbQueue',
        `Flush complete: sent ${result.sent.length}, retry ${result.retry.length}, discard ${result.discard.length}`
      );
    } catch (error) {
      logger.category('analytics').error('BreadcrumbQueue', `Flush failed: ${error}`);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Clear queue (emergency/consent revocation)
   */
  async clear(): Promise<void> {
    this.queue = [];
    this.deduplicationCache.clear();
    this.overflowCount = 0;
    await SecureStorage.removeItem(STORAGE_KEYS.BREADCRUMB_QUEUE);
    await SecureStorage.removeItem(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE);
    logger.category('analytics').info('BreadcrumbQueue', 'Queue cleared');
  }

  /**
   * Hook into NetworkDetection for auto-flush on online transition
   * Returns unsubscribe function for cleanup
   */
  hookNetworkDetection(networkDetection: { subscribe: (cb: (status: { isOnline: boolean }) => void) => () => void }): void {
    if (this.networkUnsubscribe) {
      logger.category('analytics').warn('BreadcrumbQueue', 'NetworkDetection already hooked');
      return;
    }

    let wasOnline = true; // Assume online on initial hook

    this.networkUnsubscribe = networkDetection.subscribe(async (status) => {
      const now = Date.now();
      const isOnline = status.isOnline;

      // Online transition (false -> true) with debounce (once per 5s)
      if (isOnline && !wasOnline && now - this.lastNetworkOnTime >= this.debounceMs) {
        this.lastNetworkOnTime = now;
        logger.category('analytics').info('BreadcrumbQueue', 'Online transition detected, triggering auto-flush');

        // Flush in background (non-blocking)
        this.flush().catch((err) => {
          logger.category('analytics').warn('BreadcrumbQueue', `Auto-flush failed: ${err}`);
        });
      }

      wasOnline = isOnline;
    });

    logger.category('analytics').info('BreadcrumbQueue', 'NetworkDetection hook installed');
  }

  /**
   * Unhook from NetworkDetection
   */
  unhookNetworkDetection(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
      logger.category('analytics').info('BreadcrumbQueue', 'NetworkDetection hook removed');
    }
  }

  /**
   * Private: compute SHA1 hash fingerprint
   */
  private _computeFingerprint(breadcrumb: Omit<QueuedBreadcrumb, 'id' | 'fingerprint' | 'retryCount' | 'maxRetries'>): string {
    const canonical = `${breadcrumb.category}:${breadcrumb.level}:${breadcrumb.message}:${JSON.stringify(breadcrumb.data || {})}`;
    return crypto.createHash('sha1').update(canonical).digest('hex');
  }

  /**
   * Private: persist queue to SecureStorage
   */
  private async _persist(): Promise<void> {
    try {
      await SecureStorage.setItem(STORAGE_KEYS.BREADCRUMB_QUEUE, JSON.stringify(this.queue));
    } catch (error) {
      logger.category('analytics').error('BreadcrumbQueue', `Failed to persist queue: ${error}`);
    }
  }

  /**
   * Private: persist dedup cache to SecureStorage
   */
  private async _persistDedupCache(): Promise<void> {
    try {
      const cacheObj = Object.fromEntries(this.deduplicationCache);
      await SecureStorage.setItem(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE, JSON.stringify(cacheObj));
    } catch (error) {
      logger.category('analytics').error('BreadcrumbQueue', `Failed to persist dedup cache: ${error}`);
    }
  }

  /**
   * Private: validate and clean up queue on load
   */
  private async _validateAndCleanup(): Promise<void> {
    const before = this.queue.length;
    const now = Date.now();
    const maxAgeMs = this.retentionDays * 24 * 60 * 60 * 1000;

    // Remove corrupted/invalid entries
    this.queue = this.queue.filter((b) => {
      if (!b.id || !b.timestamp || !b.category || !b.level || !b.message) {
        logger.category('analytics').warn('BreadcrumbQueue', `Dropping corrupted breadcrumb: ${JSON.stringify(b)}`);
        return false;
      }
      return true;
    });

    // Remove old breadcrumbs (>14 days)
    this.queue = this.queue.filter((b) => {
      if (now - b.timestamp > maxAgeMs) {
        logger.category('analytics').debug('BreadcrumbQueue', `Dropping old breadcrumb (id: ${b.id})`);
        return false;
      }
      return true;
    });

    // Trim to max size
    if (this.queue.length > this.maxBreadcrumbs) {
      const dropped = this.queue.length - this.maxBreadcrumbs;
      this.queue = this.queue.slice(-this.maxBreadcrumbs);
      this.overflowCount += dropped;
      logger.category('analytics').warn('BreadcrumbQueue', `Trimmed ${dropped} old breadcrumbs on load`);
    }

    if (before !== this.queue.length) {
      await this._persist();
    }

    // Cleanup dedup cache (remove >24h old entries)
    let cacheSize = this.deduplicationCache.size;
    for (const [fingerprint, sentAt] of this.deduplicationCache.entries()) {
      if (now - sentAt > this.deduplicationTTL) {
        this.deduplicationCache.delete(fingerprint);
      }
    }
    if (cacheSize !== this.deduplicationCache.size) {
      await this._persistDedupCache();
    }
  }
}

// Export singleton instance
export const breadcrumbQueue = new BreadcrumbQueueService();
