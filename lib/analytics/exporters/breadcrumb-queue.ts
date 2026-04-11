/**
 * Breadcrumb Queue Service
 *
 * Generic, provider-agnostic queue for storing breadcrumbs offline
 * and flushing them when online.
 *
 * No Sentry imports here — all provider-specific logic is in adapters.
 */

import * as Crypto from 'expo-crypto';

import { ANALYTICS_RETRY_DEFAULTS, getAppConfig } from '@/config';
import { AnalyticsConsent } from '@/lib/analytics/consent/consent';
import { shouldEmitEvent, type ConsentCategory } from '@/lib/analytics/consent/consent-gating';
import { logger } from '@/lib/utils';
import { STORAGE_KEYS } from "@/maps";
import { clearAnalyticsQueue, loadAnalyticsQueue, persistAnalyticsQueue } from "@/middleware/storage";
import type { QueuedBreadcrumb } from '@/type-definitions/breadcrumb-queue-types.ts';

/**
 * In-memory queue statistics (not persisted)
 */
export interface BreadcrumbQueueStats {
  queueSize: number;
  oldestBreadcrumbTime?: number; // ms since epoch
  lastFlushTime?: number;
  overflowCount: number; // Session-only counter
  providerName: string | null;
  isFlushing: boolean;
}

/**
 * Breadcrumb Queue Service
 * Handles persistence, FIFO ordering, retry scheduling, deduplication
 */
class BreadcrumbQueueService {
  private queue: QueuedBreadcrumb[] = [];
  private providerName: string | null = null;
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
      this.maxRetries = breadcrumbsConfig?.maxRetries ?? ANALYTICS_RETRY_DEFAULTS.maxRetries;
      this.batchSize = breadcrumbsConfig?.batchSize ?? 10;
      this.retryBaseMs = breadcrumbsConfig?.retryBaseMs ?? ANALYTICS_RETRY_DEFAULTS.retryBaseMs;
      this.deduplicationTTL = 24 * 60 * 60 * 1000; // 24h in ms (hardcoded, not configurable)
      this.batchSpacingMs = 1500; // Space batches by 1.5s if 100+ pending (hardcoded, not configurable)
      this.debounceMs = breadcrumbsConfig?.debounceMs ?? ANALYTICS_RETRY_DEFAULTS.debounceMs; // Debounce flush: once per 5s
    } catch (error) {
      // Config loading failed; fall back to safe defaults
      logger.category('analytics').error('BreadcrumbQueue', `Failed to load config: ${error}, using defaults`);
      this.maxBreadcrumbs = 500;
      this.retentionDays = 14;
      this.maxRetries = ANALYTICS_RETRY_DEFAULTS.maxRetries;
      this.batchSize = 10;
      this.retryBaseMs = ANALYTICS_RETRY_DEFAULTS.retryBaseMs;
      this.deduplicationTTL = 24 * 60 * 60 * 1000;
      this.batchSpacingMs = 1500;
      this.debounceMs = ANALYTICS_RETRY_DEFAULTS.debounceMs;
    }
  }

  private networkUnsubscribe: (() => void) | null = null;
  private lastNetworkOnTime = 0;

  /**
   * Initialize queue from SecureStorage and set active provider
   */
  async initialize(providerName: string): Promise<void> {
    if (!providerName) {
      throw new Error('BreadcrumbQueue: providerName is required');
    }

    this.providerName = providerName;
    logger.category('analytics').analytics('BreadcrumbQueue', `Initializing with provider: ${providerName}`);

    try {
      // Load queue from storage
      const stored = await loadAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_QUEUE);
      if (stored) {
        this.queue = JSON.parse(stored) as QueuedBreadcrumb[];
        logger.category('analytics').analytics('BreadcrumbQueue', `Loaded ${this.queue.length} breadcrumbs from storage`);
      }

      // Load deduplication cache
      const dedupCached = await loadAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE);
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
        await clearAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_QUEUE);
        await clearAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE);
        logger.category('analytics').analytics('BreadcrumbQueue', 'Removed corrupted persisted queue data');
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
    if (!this.providerName) {
      logger.category('analytics').analytics('BreadcrumbQueue', 'enqueue called before initialization');
      return null;
    }

    // Check consent gate before persisting breadcrumb
    const consentCategory = this._getConsentCategoryForBreadcrumb(breadcrumb.category);
    const consentLevel = AnalyticsConsent.getLevel();

    if (!shouldEmitEvent(consentCategory, consentLevel)) {
      logger.category('analytics').warn(
        'BreadcrumbQueue',
        `Breadcrumb '${breadcrumb.category}' dropped (category=${consentCategory}, level=${consentLevel})`
      );
      return null;
    }

    // Compute fingerprint hash
    const fingerprint = await this._computeFingerprint(breadcrumb);

    // Check dedup cache
    const lastSent = this.deduplicationCache.get(fingerprint);
    if (lastSent && Date.now() - lastSent < this.deduplicationTTL) {
      logger.category('analytics').warn(
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

    logger.category('analytics').analytics(
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
      logger.category('analytics').info(
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
    logger.category('analytics').warn(
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
      providerName: this.providerName || 'unknown',
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
    if (this.isFlushing || !this.providerName || this.queue.length === 0) {
      logger.category('analytics').debug('BreadcrumbQueue', `Flush skipped: isFlushing=${this.isFlushing}, providerName=${this.providerName}, queueSize=${this.queue.length}`);
      return;
    }

    const now = Date.now();

    if (now < this.nextFlushAfterMs) {
      logger.category('analytics').debug('BreadcrumbQueue', `Flush skipped due to rate limit: nextFlushAfterMs=${this.nextFlushAfterMs}, now=${now}`);
      return;
    }

    this.isFlushing = true;
    this.lastFlushAttemptTime = now;

    try {
      const hasLargeQueue = this.queue.length >= 100;
      if (hasLargeQueue && this.lastFlushTime && now - this.lastFlushTime < this.batchSpacingMs) {
        logger.category('analytics').debug('BreadcrumbQueue', `Flush skipped due to batch spacing: queueSize=${this.queue.length}, lastFlushTime=${this.lastFlushTime}`);
        this.isFlushing = false;
        return;
      }

      let batch = this.peek(this.batchSize);
      logger.category('analytics').debug('BreadcrumbQueue', `Batch prepared for flush: batchSize=${batch.length}`);

      batch = batch.filter((b) => {
        const lastSent = this.deduplicationCache.get(b.fingerprint);
        if (lastSent && now - lastSent < this.deduplicationTTL) {
          logger.category('analytics').debug('BreadcrumbQueue', `Breadcrumb skipped due to deduplication: fingerprint=${b.fingerprint}`);
          return false;
        }
        return true;
      });

      if (batch.length === 0) {
        logger.category('analytics').debug('BreadcrumbQueue', 'No breadcrumbs to flush after deduplication');
        this.isFlushing = false;
        return;
      }

      this.currentBatchIds = new Set(batch.map((b) => b.id));
      logger.category('analytics').debug('BreadcrumbQueue', `Flushing batch: batchSize=${batch.length}`);

      const { sendBreadcrumbs } = require('@/lib/middleware/services/analytics-service');
      const result = await sendBreadcrumbs(this.providerName, batch);
      if (result === null) {
        logger.category('analytics').debug('BreadcrumbQueue', 'Flush aborted: Middleware returned null');
        this.isFlushing = false;
        return;
      }

      if (result.sent.length > 0) {
        logger.category('analytics').debug('BreadcrumbQueue', `Breadcrumbs sent: count=${result.sent.length}`);

        // Update deduplication cache with sent breadcrumbs
        batch
          .filter((b) => result.sent.includes(b.id))
          .forEach((b) => {
            this.deduplicationCache.set(b.fingerprint, Date.now());
          });

        await this._persistDedupCache();

        // Remove sent breadcrumbs from queue
        await this.remove(result.sent);
      }

      if (result.retry.length > 0) {
        logger.category('analytics').debug('BreadcrumbQueue', `Breadcrumbs marked for retry: count=${result.retry.length}`);

        // Mark failed breadcrumbs for retry
        for (const id of result.retry) {
          await this.markFailed(id, 'provider retry');
        }
      }

      if (result.discard.length > 0) {
        logger.category('analytics').debug('BreadcrumbQueue', `Breadcrumbs discarded: count=${result.discard.length}`);

        // Discard rejected breadcrumbs
        for (const id of result.discard) {
          await this.discard(id, 'provider rejected');
        }
      }

      // Apply rate limit backoff if provided
      if (result.retryAfterMs && result.retryAfterMs > 0) {
        this.nextFlushAfterMs = Date.now() + result.retryAfterMs;
        logger.category('analytics').debug('BreadcrumbQueue', `Rate limit applied: nextFlushAfterMs=${this.nextFlushAfterMs}`);
      }

      // Update last flush time for batch spacing logic
      this.lastFlushTime = Date.now();

      // Clear current batch
      this.currentBatchIds.clear();

    } catch (error) {
      logger.category('analytics').error('BreadcrumbQueue', `Flush failed: ${error}`);
      // Clear batch IDs even on error
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
    await clearAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_QUEUE);
    await clearAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE);
    logger.category('analytics').analytics('BreadcrumbQueue', 'Queue cleared');
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
   * Private: map breadcrumb category to consent category for gating
   */
  private _getConsentCategoryForBreadcrumb(breadcrumbCategory: string) {
    // Map breadcrumb categories to consent categories
    // Most breadcrumbs are performance/diagnostic; only essential breadcrumbs are always sent
    const consentMapping: Record<string, ConsentCategory> = {
      // Essential breadcrumbs (errors, exceptions)
      error: 'essential',
      exception: 'essential',
      fatal: 'essential',

      // Performance breadcrumbs (HTTP, navigation, transactions)
      http: 'performance',
      navigation: 'performance',
      transaction: 'performance',
      timing: 'performance',

      // Usage breadcrumbs (user interactions, state changes)
      user: 'usage',
      ui: 'usage',
      state: 'usage',
      custom: 'usage',
    };

    // eslint-disable-next-line security/detect-object-injection
    const mapped = consentMapping[breadcrumbCategory];
    if (mapped === undefined) {
      logger.category('analytics').warn('BreadcrumbQueue', `Unmapped breadcrumb category '${breadcrumbCategory}'; defaulting to 'performance'`);
      return 'performance';
    }
    return mapped;
  }

  /**
   * Private: persist queue to SecureStorage
   */
  private async _persist(): Promise<void> {
    try {
      await persistAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_QUEUE, JSON.stringify(this.queue));
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
      await persistAnalyticsQueue(STORAGE_KEYS.BREADCRUMB_DEDUP_CACHE, JSON.stringify(cacheObj));
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
        logger.category('analytics').info('BreadcrumbQueue', `Dropping old breadcrumb (id: ${b.id})`);
        return false;
      }
      return true;
    });

    // Trim to max size
    if (this.queue.length > this.maxBreadcrumbs) {
      const dropped = this.queue.length - this.maxBreadcrumbs;
      this.queue = this.queue.slice(-this.maxBreadcrumbs);
      this.overflowCount += dropped;
      logger.category('analytics').info('BreadcrumbQueue', `Trimmed ${dropped} old breadcrumbs on load`);
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
