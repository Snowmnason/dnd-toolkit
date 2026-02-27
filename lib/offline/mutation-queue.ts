/**
 * Offline Mutation Queue
 *
 * Manages a persistent queue of mutations made while offline.
 * Stores mutations in SecureStorage (encrypted, survives app restart).
 *
 * Features:
 * - FIFO ordering by timestamp
 * - UUID-based tracking
 * - Retry counting
 * - Conflict detection metadata
 * - Cache invalidation tags
 */

import { OFFLINE_SYNC_DEFAULTS } from "@/config";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import {
    BackoffScheduler,
    OfflineQueueStatsCollector,
    Phase4Enhancements,
} from "./offline-recovery";
import type { QueuedMutation } from "./types";

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
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
 * Default configuration for offline sync
 */
const DEFAULT_CONFIG = {
  batchSize: OFFLINE_SYNC_DEFAULTS.batchSize,
  debounceMs: OFFLINE_SYNC_DEFAULTS.debounceMs,
  maxRetries: OFFLINE_SYNC_DEFAULTS.maxRetries,
  retryBaseMs: OFFLINE_SYNC_DEFAULTS.retryBaseMs,
};

class OfflineMutationQueueService {
  private queue: QueuedMutation[] = [];
  private initialized = false;

  /**
   * Initialize the queue from storage
   * Call once on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const stored = await SecureStorage.getJSON<QueuedMutation[]>(
        STORAGE_KEYS.OFFLINE_MUTATION_QUEUE,
      );

      if (Array.isArray(stored)) {
        this.queue = stored;
        logger
          .category("storage")
          .info(`Loaded ${this.queue.length} queued mutations from storage`);
      }
      this.initialized = true;
    } catch (error) {
      logger
        .category("error")
        .error("Failed to initialize offline mutation queue:", error);
      this.initialized = true; // Don't block app startup
    }
  }

  /**
   * Add a mutation to the queue
   * Call this when a mutation is made offline
   */
  async enqueue(
    mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">,
  ): Promise<QueuedMutation> {
    // Phase 4: Apply deterministic redaction and prepare for queueing
    const prepared = await Phase4Enhancements.prepareForQueue(mutation);

    const queued: QueuedMutation = {
      ...prepared,
      id: generateUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      // Phase 4: Initialize auth metadata if authStrategy is present
      authStrategy: mutation.authStrategy,
      // Phase 4: Set initial nextAttemptAt if provided, otherwise will be set on first failure
      nextAttemptAt: mutation.nextAttemptAt,
    };

    this.queue.push(queued);
    await this.persist();

    logger
      .category("storage")
      .debug(
        `Queued mutation: ${queued.id} (${queued.operation} on ${queued.table})` +
          (mutation.authStrategy ? ` [auth: ${mutation.authStrategy}]` : ""),
      );

    return queued;
  }

  /**
   * Get the next batch of mutations to sync
   */
  async peek(
    batchSize: number = DEFAULT_CONFIG.batchSize,
  ): Promise<QueuedMutation[]> {
    // Return next N mutations sorted by timestamp (oldest first)
    return this.queue
      .slice(0, batchSize)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Remove a mutation from the queue after successful sync
   */
  async remove(ids: string[]): Promise<void> {
    const beforeCount = this.queue.length;
    this.queue = this.queue.filter((m) => !ids.includes(m.id));
    const removedCount = beforeCount - this.queue.length;

    if (removedCount > 0) {
      await this.persist();
      logger
        .category("storage")
        .debug(`Removed ${removedCount} synced mutations from queue`);
    }
  }

  /**
   * Mark a mutation as failed (increment retry count)
   */
  async markFailed(
    id: string,
    reason: string,
    errorType?: string,
  ): Promise<void> {
    const mutation = this.queue.find((m) => m.id === id);
    if (!mutation) {
      logger.category("error").warn(`Mutation ${id} not found in queue`);
      return;
    }

    mutation.retryCount++;
    mutation.lastFailureReason = reason;

    // Phase 4: Track error type for telemetry
    if (errorType) {
      mutation.lastErrorType = errorType as any;
    }

    // Phase 4: Schedule next retry with backoff + jitter
    mutation.nextAttemptAt = BackoffScheduler.calculateNextAttemptAt(
      mutation,
      2000, // Base backoff: 2 seconds
    );

    await this.persist();

    logger
      .category("storage")
      .debug(
        `Marked mutation ${id} as failed (attempt ${mutation.retryCount}): ${reason}`,
      );
  }

  /**
   * Remove a mutation permanently (after max retries or user action)
   */
  async discard(id: string, reason: string): Promise<void> {
    const before = this.queue.length;
    this.queue = this.queue.filter((m) => m.id !== id);
    if (this.queue.length < before) {
      await this.persist();
      logger.category("storage").info(`Discarded mutation ${id}: ${reason}`);
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get all queued mutations (for debugging/UI)
   */
  async getAll(): Promise<QueuedMutation[]> {
    return [...this.queue];
  }

  /**
   * Clear the entire queue (use with caution)
   */
  async clear(): Promise<void> {
    this.queue = [];
    await SecureStorage.removeItem(STORAGE_KEYS.OFFLINE_MUTATION_QUEUE);
    logger.category("storage").warn("Cleared offline mutation queue");
  }

  /**
   * Persist queue to storage
   */
  private async persist(): Promise<void> {
    try {
      await SecureStorage.setJSON(STORAGE_KEYS.OFFLINE_MUTATION_QUEUE, this.queue);
    } catch (error) {
      logger
        .category("error")
        .error("Failed to persist mutation queue:", error);
    }
  }

  /**
   * Get mutation by ID (for sync manager)
   */
  getMutation(id: string): QueuedMutation | undefined {
    return this.queue.find((m) => m.id === id);
  }

  /**
   * Phase 4: Get next batch of mutations ready for retry
   *
   * Filters by nextAttemptAt to avoid retry storms
   */
  async getReadyBatch(
    batchSize: number = DEFAULT_CONFIG.batchSize,
  ): Promise<QueuedMutation[]> {
    const ready = BackoffScheduler.filterReadyMutations(this.queue);
    // Sort by timestamp first to ensure FIFO order, then slice to batch size
    const sortedReady = [...ready].sort((a, b) => a.timestamp - b.timestamp);
    return sortedReady.slice(0, batchSize);
  }

  /**
   * Phase 4: Update mutation with scheduled retry info
   *
   * Called when sync fails to schedule next retry attempt
   */
  async updateScheduledRetry(
    id: string,
    nextAttemptAt: number,
    errorType?: string,
  ): Promise<void> {
    const mutation = this.queue.find((m) => m.id === id);
    if (!mutation) {
      return;
    }

    mutation.nextAttemptAt = nextAttemptAt;
    if (errorType) {
      mutation.lastErrorType = errorType as any;
    }
    await this.persist();
  }

  /**
   * Phase 4: Get comprehensive queue statistics
   *
   * Includes failure types, retry counts, and timing info
   */
  async getStats(lastSyncResult?: any) {
    return OfflineQueueStatsCollector.collectStats(this.queue, lastSyncResult);
  }

  /**
   * Phase 4: Get mutations that have failed with specific error type
   *
   * Useful for debugging or targeted recovery
   */
  async getMutationsByErrorType(errorType: string): Promise<QueuedMutation[]> {
    return this.queue.filter((m) => m.lastErrorType === errorType);
  }

  /**
   * Get count of dead-letter mutations (permanently failed)
   *
   * A mutation is dead-lettered when retryCount >= maxRetries.
   * This method efficiently returns the count without loading the entire queue.
   */
  getDeadLetterCount(): number {
    return this.queue.filter((m) => m.retryCount >= DEFAULT_CONFIG.maxRetries)
      .length;
  }
}

// Singleton instance
export const OfflineMutationQueue = new OfflineMutationQueueService();
