/**
 * Breadcrumb Queue Service
 *
 * Generic, provider-agnostic queue for storing breadcrumbs offline
 * and flushing them when online.
 *
 * No Sentry imports here — all provider-specific logic is in adapters.
 */

import * as Crypto from 'expo-crypto';

import { getAppConfig } from '@/lib/config';
import { BreadcrumbProvider, BreadcrumbSendResult, QueuedBreadcrumb } from '@/lib/services/provider-adapter';
import { STORAGE_KEYS, SecureStorage } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';

/**
 * In-memory queue statistics (not persisted)
 */
export interface BreadcrumbQueueStats {
  queueSize: number;
  oldestBreadcrumbTime?: number; // ms since epoch
  lastFlushTime?: number;
  overflowCount: number; // Session-only counter
  providerName: string;
  isFlushing: boolean;
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
  private lastFlushAttemptTime = 0; // Track when we last tried to flush
  private nextFlushAfterMs = 0; // Time when next flush is allowed (rate limit backoff)
  private isFlushing = false;
  private currentBatchIds = new Set<string>(); // Track current batch to prevent double-retry
  private deduplicationCache = new Map<string, number>(); // fingerprint -> lastSentAt (ms)
  
  // Config values with fallbacks (from appsettings or hardcoded defaults)
  private readonly maxBreadcrumbs: number;
  private readonly retentionDays: number;
  private readonly maxRetries: number;
  private readonly batchSize: number;
  private readonly retryBaseMs: number;
  private readonly deduplicationTTL: number;
  private readonly batchSpacingMs: number;
  private readonly debounceMs: number;

  constructor() {
    // Load config values from appsettings with fallbacks
    // Wrapped in try/catch to handle config load failures gracefully
    try {
      const config = getAppConfig();
      const breadcrumbsConfig = config.analytics?.breadcrumbs;

      this.maxBreadcrumbs = breadcrumbsConfig?.maxBreadcrumbs ?? 500;
      this.retentionDays = breadcrumbsConfig?.breadcrumbRetentionDays ?? 14;
      this.maxRetries = breadcrumbsConfig?.maxRetries ?? 5;
      this.batchSize = breadcrumbsConfig?.batchSize ?? 10;
      this.retryBaseMs = breadcrumbsConfig?.retryBaseMs ?? 1000;
      this.deduplicationTTL = 24 * 60 * 60 * 1000; // 24h in ms (hardcoded, not configurable)
      this.batchSpacingMs = 1500; // Space batches by 1.5s if 100+ pending (hardcoded, not configurable)
      this.debounceMs = breadcrumbsConfig?.debounceMs ?? 5000; // Debounce flush: once per 5s
    } catch (error) {
      // Config loading failed; fall back to safe defaults
      logger.category('analytics').warn('BreadcrumbQueue', `Failed to load config: ${error}, using defaults`);
      this.maxBreadcrumbs = 500;
      this.retentionDays = 14;
      this.maxRetries = 5;
      this.batchSize = 10;
      this.retryBaseMs = 1000;
      this.deduplicationTTL = 24 * 60 * 60 * 1000;
      this.batchSpacingMs = 1500;
      this.debounceMs = 5000;
    }
  }

  private networkUnsubscribe: (() => void) | null = null;
  private lastNetworkOnTime = 0;

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
      
      // Remove corrupted persisted data so we don't fail on next startup
      try {
        await SecureStorage.removeItem(STORAGE_KEYS.BREADCRUMB_QUEUE);
        await SecureStorage.removeItem(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE);
        logger.category('analytics').info('BreadcrumbQueue', 'Removed corrupted persisted queue data');
      } catch (cleanupError) {
        logger.category('analytics').warn('BreadcrumbQueue', `Failed to clean up corrupted data: ${cleanupError}`);
      }
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
    const fingerprint = await this._computeFingerprint(breadcrumb);

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
      id: this._bytesToHex(Crypto.getRandomBytes(16)),
      timestamp: breadcrumb.timestamp,
      category: breadcrumb.category,
      level: breadcrumb.level,
      message: breadcrumb.message,
      data: breadcrumb.data,
      fingerprint,
      retryCount: 0,
      maxRetries: this.maxRetries,
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
    const backoffMs = Math.pow(2, Math.min(breadcrumb.retryCount, 4)) * this.retryBaseMs; // Exponential backoff with configurable base
    breadcrumb.nextAttemptAt = Date.now() + backoffMs;

    await this._persist();
    logger.category('analytics').debug(
      'BreadcrumbQueue',
      `Marked failed breadcrumb (id: ${id}, retry: ${breadcrumb.retryCount}/${breadcrumb.maxRetries}, next attempt: ${backoffMs}ms)`
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
      isFlushing: this.isFlushing,
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
   * Implements Phase 1c: batch spacing, rate limit backoff, dedup-on-flush
   */
  async flush(): Promise<void> {
    if (this.isFlushing || !this.provider || this.queue.length === 0) {
      return;
    }

    const now = Date.now();

    // Phase 1c: Rate limit backoff — don't flush if we're rate-limited
    if (now < this.nextFlushAfterMs) {
      logger.category('analytics').debug(
        'BreadcrumbQueue',
        `Rate-limited: next flush in ${this.nextFlushAfterMs - now}ms`
      );
      return;
    }

    this.isFlushing = true;
    this.lastFlushAttemptTime = now;

    try {
      // Phase 1c: Batch spacing — if 100+ pending, space batches apart to avoid rate limit
      const hasLargeQueue = this.queue.length >= 100;
      if (hasLargeQueue && this.lastFlushTime && now - this.lastFlushTime < this.batchSpacingMs) {
        logger.category('analytics').debug('BreadcrumbQueue', `Batch spacing: deferring flush (${this.queue.length} pending)`);
        this.isFlushing = false;
        return;
      }

      // Phase 1c: Dedup-on-flush — skip breadcrumbs with recently-sent fingerprints
      let batch = this.peek(this.batchSize); // Configurable batch size

      batch = batch.filter((b) => {
        const lastSent = this.deduplicationCache.get(b.fingerprint);
        if (lastSent && now - lastSent < this.deduplicationTTL) {
          logger.category('analytics').debug(
            'BreadcrumbQueue',
            `Skipping duplicate on flush (fingerprint: ${b.fingerprint})`
          );
          return false; // Skip this breadcrumb
        }
        return true;
      });

      if (batch.length === 0) {
        logger.category('analytics').debug('BreadcrumbQueue', 'No new breadcrumbs to flush (all deduplicated)');
        this.isFlushing = false;
        return;
      }

      // Track current batch IDs (Phase 1c: prevent double-retry)
      this.currentBatchIds = new Set(batch.map((b) => b.id));

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
        // Only retry if this ID is from current batch (Phase 1c: prevent double-retry)
        if (this.currentBatchIds.has(id)) {
          await this.markFailed(id, 'provider retry');
        }
      }

      // Process discards (4xx, validation errors)
      for (const id of result.discard) {
        // Only discard if this ID is from current batch
        if (this.currentBatchIds.has(id)) {
          await this.discard(id, 'provider rejected');
        }
      }

      // Phase 1c: Handle rate-limited response (429) with Retry-After backoff
      if (result.retryAfterMs && result.retryAfterMs > 0) {
        this.nextFlushAfterMs = now + result.retryAfterMs;
        logger.category('analytics').warn(
          'BreadcrumbQueue',
          `Rate-limited: next flush in ${result.retryAfterMs}ms`
        );
      }

      this.lastFlushTime = now;
      this.currentBatchIds.clear();

      logger.category('analytics').info(
        'BreadcrumbQueue',
        `Flush complete: sent ${result.sent.length}, retry ${result.retry.length}, discard ${result.discard.length}`
      );
    } catch (error) {
      logger.category('analytics').error('BreadcrumbQueue', `Flush failed: ${error}`);
      this.currentBatchIds.clear();
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
   * Private: convert Uint8Array to hex string
   */
  private _bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Private: compute SHA1 hash fingerprint (async via expo-crypto)
   */
  private async _computeFingerprint(breadcrumb: Omit<QueuedBreadcrumb, 'id' | 'fingerprint' | 'retryCount' | 'maxRetries'>): Promise<string> {
    const canonical = `${breadcrumb.category}:${breadcrumb.level}:${breadcrumb.message}:${JSON.stringify(breadcrumb.data || {})}`;
    const encoder = new TextEncoder();
    const canonicalBytes = encoder.encode(canonical);
    const hashBuffer = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA1, canonicalBytes);
    return this._bytesToHex(new Uint8Array(hashBuffer));
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
