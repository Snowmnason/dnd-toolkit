/**
 * Online Sync Manager
 *
 * Watches network status and automatically syncs queued mutations when online.
 *
 * Features:
 * - Automatic sync on network reconnection
 * - Debouncing to avoid thrashing on poor connectivity
 * - Batch processing to avoid timeouts
 * - Exponential backoff retry
 * - Basic conflict detection (timestamp comparison)
 * - Cache invalidation on successful sync
 *
 * Network Cascade Detection (Phase 4):
 * Tracks consecutive sync failures and automatically enters DEGRADED safe mode
 * if a cascade is detected (repeated failures that could cause data inconsistencies).
 * - NetworkCascadeDetector.recordFailure() called when sync completely fails
 * - NetworkCascadeDetector.recordSuccess() called when sync completes (even partially)
 * - Safe mode triggered when cascade threshold is exceeded
 * - Detector auto-resets when app exits safe mode
 */

// NOTE: previously had a diagnostic call to `process.memoryUsage()` here which
// caused runtime failures under Metro (process.memoryUsage not available).
// Keep this file import-safe in all environments.

// TODO: SYNC HANDLER REGISTRATION
// ════════════════════════════════════════════════════════════════════════════════
// CRITICAL: This sync manager requires sync handlers to be registered before
// mutations are synced. Without handlers, all sync attempts will fail with:
// "No sync handler registered for table: <tableName>"
//
// Handlers are registered via:
//   registerSyncHandler(tableName, handler)
//
// Each domain module (notes, characters, shops, etc.) must call registerSyncHandler()
// during initialization to define HOW that table's mutations are synced to the database.
//
// Example handler for notes table:
//   registerSyncHandler('notes', async (payload, operation, supabase) => {
//     if (operation === 'create') {
//       return await supabase.from('notes').insert(payload).select().single();
//     }
//     if (operation === 'update') {
//       return await supabase.from('notes').update(payload).eq('id', payload.id).select().single();
//     }
//     if (operation === 'delete') {
//       return await supabase.from('notes').delete().eq('id', payload.id);
//     }
//   });
//
// See: lib/offline/sync-handlers.ts & docs/issues/MileStone 2/Tier 2/SYNC_HANDLER_EXAMPLES.ts
// ════════════════════════════════════════════════════════════════════════════════

import { getAppConfig, OFFLINE_SYNC_DEFAULTS } from "@/config";
import {
    NetworkCascadeDetector,
    reportCrash,
} from "@/lib/error";
import { DegradeCapability } from "@/type-definitions/degrade";
import { getNetworkStatus, subscribeToNetworkStatus, type NetworkStatus } from "@/lib/middleware/network";
import { QueryCache } from "@/lib/middleware/storage";
import { logger } from "@/lib/utils";
import type {
    OfflineSyncConfig,
    OfflineSyncStatus,
    QueuedMutation,
    SyncResult,
} from "@/type-definitions";
import { getConflictQueueManager } from "./conflict/conflict-queue-manager";
import { executeConflictResolution } from "./conflict/conflict-resolution";
import { OfflineMutationQueue } from "./mutation-queue";
import {
    CircuitBreakerReplayManager,
    NetworkErrorClassifier,
} from "./offline-recovery";

/**
 * Get default sync configuration from appsettings
 */
function getDefaultConfig(): Required<OfflineSyncConfig> {
  const config = getAppConfig();
  return {
    batchSize: OFFLINE_SYNC_DEFAULTS.batchSize,
    debounceMs: config.sync?.debounceMs ?? OFFLINE_SYNC_DEFAULTS.debounceMs,
    maxRetries: OFFLINE_SYNC_DEFAULTS.maxRetries,
    retryBaseMs: config.sync?.retryBaseMs ?? OFFLINE_SYNC_DEFAULTS.retryBaseMs,
    conflictStrategy: OFFLINE_SYNC_DEFAULTS.conflictStrategy,
  };
}

const DEFAULT_CONFIG = getDefaultConfig();

class OnlineSyncManagerService {
  private networkUnsubscribe: (() => void) | null = null;
  private isOnline = false;
  private isSyncing = false;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduledRetryTimer: ReturnType<typeof setTimeout> | null = null; // Timer for next scheduled retry
  private nextScheduledRetryTime: number = Infinity; // Track next scheduled time
  private config: Required<OfflineSyncConfig> = DEFAULT_CONFIG;
  private lastSyncStatus: OfflineSyncStatus = {
    isSyncing: false,
    totalQueued: 0,
    syncedCount: 0,
    failedCount: 0,
    conflicts: [],
  };
  private statusListeners: Set<(status: OfflineSyncStatus) => void> = new Set();

  /**
   * Initialize the sync manager
   * Subscribe to network status and start sync flow
   */
  async initialize(config?: Partial<OfflineSyncConfig>): Promise<void> {
    try {
      // Merge config
      if (config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
      }

      // Initialize offline queue from storage
      await OfflineMutationQueue.initialize();

      // Validate sync handlers for any queued mutations
      const queuedMutations = await OfflineMutationQueue.getAll();
      if (queuedMutations.length > 0) {
        const { validateHandlersForQueue } = await import("./sync-handlers");
        const queuedTables = [...new Set(queuedMutations.map(m => m.table))];
        validateHandlersForQueue(queuedTables);
      }

      // Subscribe to network status changes
      this.networkUnsubscribe = subscribeToNetworkStatus(
        (status: NetworkStatus) => {
          this.onNetworkStatusChanged(status);
        },
      );

      // Check initial network status
      const initialStatus = getNetworkStatus();
      this.onNetworkStatusChanged(initialStatus);
    } catch (error) {
      logger
        .category("error")
        .error("Failed to initialize OnlineSyncManager:", error);
    }
  }

  /**
   * Handle network status changes
   */
  private onNetworkStatusChanged(status: NetworkStatus): void {
    const wasOnline = this.isOnline;
    this.isOnline = status.isOnline;

    logger.category("network").debug(`Network status: online=${this.isOnline}`);

    // Trigger sync when going from offline to online
    if (!wasOnline && this.isOnline) {
      this.triggerSync();
    }
  }

  /**
   * Trigger a sync with debouncing to avoid thrashing
   */
  private triggerSync(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    logger
      .category("storage")
      .debug(`Scheduling sync in ${this.config.debounceMs}ms...`);

    this.syncDebounceTimer = setTimeout(() => {
      this.syncAll().catch((err) => {
        logger.category("error").error("Sync failed:", err);
      });
    }, this.config.debounceMs);
  }

  /**
   * Synchronize all queued mutations
   * Public method for manual sync triggers
   */
  async syncAll(): Promise<OfflineSyncStatus> {
    if (!this.isOnline) {
      logger.category("network").warn("Cannot sync: offline");
      return this.lastSyncStatus;
    }

    if (this.isSyncing) {
      return this.lastSyncStatus;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    // Reset status
    this.lastSyncStatus = {
      isSyncing: true,
      totalQueued: OfflineMutationQueue.size(),
      syncedCount: 0,
      failedCount: 0,
      conflicts: [],
      lastSyncAttempt: startTime,
    };
    this.notifyStatusListeners();

    try {
      let totalProcessed = 0;
      let totalSynced = 0;
      let totalFailed = 0;

      while (this.isOnline) {
        // Phase 4: Use getReadyBatch() to respect scheduled retry times
        const batch = await OfflineMutationQueue.getReadyBatch(
          this.config.batchSize,
        );
        if (batch.length === 0) {
          // No ready mutations: schedule a timer for the next scheduled retry (if any)
          await this.scheduleNextRetryWakeup();
          break;
        }

        logger
          .category("storage")
          .info(`Processing batch of ${batch.length} mutations`);

        const results: SyncResult[] = [];
        for (const mutation of batch) {
          const result = await this.syncMutation(mutation);
          results.push(result);
          totalProcessed++;

          if (result.success) {
            totalSynced++;
          } else if (result.conflict) {
            this.lastSyncStatus.conflicts.push(result.conflict);
          } else if (!result.retryable) {
            totalFailed++;
          }
        }

        // Remove successfully synced mutations
        const syncedIds = results
          .filter((r) => r.success)
          .map((r) => r.mutationId);
        if (syncedIds.length > 0) {
          await OfflineMutationQueue.remove(syncedIds);
        }

        // Discard permanently failed mutations
        const failedIds = results
          .filter((r) => !r.success && !r.retryable && !r.conflict)
          .map((r) => r.mutationId);
        for (const id of failedIds) {
          await OfflineMutationQueue.discard(id, "Permanent failure");
        }
      }

      this.lastSyncStatus.syncedCount = totalSynced;
      this.lastSyncStatus.failedCount = totalFailed;
      this.lastSyncStatus.totalQueued = OfflineMutationQueue.size();

      const duration = Date.now() - startTime;
      logger
        .category("storage")
        .info(
          `Sync complete: ${totalSynced}/${totalProcessed} succeeded in ${duration}ms`,
        );

      // Network cascade detector: record success when sync completes
      // This resets the failure counter even if some items failed
      NetworkCascadeDetector.recordSuccess();
    } catch (error) {
      this.lastSyncStatus.lastError = (error as Error).message;
      logger.category("error").error("Sync failed:", error);

      // Network cascade detector: record failure and check if cascade detected
      const cascadeDetected = NetworkCascadeDetector.recordFailure();
      if (cascadeDetected) {
        logger
          .category("network")
          .error("Network cascade detected - entering DEGRADED safe mode", {
            consecutiveFailures:
              NetworkCascadeDetector.getConsecutiveFailures(),
          });
        reportCrash(DegradeCapability.SYNC, 'cascade-detected', {
            details: `Consecutive sync failures: ${NetworkCascadeDetector.getConsecutiveFailures()}`,
          });
      }
    } finally {
      this.isSyncing = false;
      this.lastSyncStatus.isSyncing = false;
      this.notifyStatusListeners();
    }

    return this.lastSyncStatus;
  }

  /**
   * Schedule a timer to wake up the sync manager at the next scheduled retry time
   * Prevents scheduled retries from stalling indefinitely when all ready mutations are processed
   *
   * Phase 4: Ensures scheduled retries (nextAttemptAt in future) actually execute
   */
  private async scheduleNextRetryWakeup(): Promise<void> {
    // Get all mutations to find the earliest scheduled retry
    const allMutations = await OfflineMutationQueue.getAll();

    if (allMutations.length === 0) {
      // No mutations left: clear any pending timer
      this.clearScheduledRetryTimer();
      logger
        .category("storage")
        .debug("Queue empty: cleared scheduled retry timer");
      return;
    }

    // Find the earliest mutation that's scheduled for the future
    const now = Date.now();
    let nextRetryTime = Infinity;

    for (const mutation of allMutations) {
      if (
        mutation.nextAttemptAt &&
        mutation.nextAttemptAt > now &&
        mutation.nextAttemptAt < nextRetryTime
      ) {
        nextRetryTime = mutation.nextAttemptAt;
      }
    }

    // If no scheduled retries in the future, we're done
    if (nextRetryTime === Infinity) {
      this.clearScheduledRetryTimer();
      logger.category("storage").debug("No scheduled retries: cleared timer");
      return;
    }

    // Only set a new timer if the scheduled time changed
    if (this.nextScheduledRetryTime === nextRetryTime) {
      logger
        .category("storage")
        .debug("Scheduled retry timer already set for next attempt", {
          delay: nextRetryTime - now,
        });
      return;
    }

    // Clear old timer
    this.clearScheduledRetryTimer();

    // Schedule new timer
    const delayMs = Math.max(0, nextRetryTime - now);
    this.nextScheduledRetryTime = nextRetryTime;

    logger.category("storage").debug("Scheduled retry timer set", {
      delayMs,
      nextRetryTime: new Date(nextRetryTime).toISOString(),
    });

    this.scheduledRetryTimer = setTimeout(() => {
      this.scheduledRetryTimer = null;
      this.nextScheduledRetryTime = Infinity;
      logger
        .category("storage")
        .debug("Scheduled retry timer fired: triggering sync");
      this.triggerSync();
    }, delayMs);
  }

  /**
   * Clear any pending scheduled retry timer
   * Called during cleanup or when a new sync completes
   */
  private clearScheduledRetryTimer(): void {
    if (this.scheduledRetryTimer !== null) {
      clearTimeout(this.scheduledRetryTimer);
      this.scheduledRetryTimer = null;
      this.nextScheduledRetryTime = Infinity;
      logger.category("storage").debug("Cleared scheduled retry timer");
    }
  }

  /**
   * Sync a single mutation
   * Handles retry logic and conflict detection
   */
  private async syncMutation(mutation: QueuedMutation): Promise<SyncResult> {
    const maxRetries = this.config.maxRetries;

    if (mutation.retryCount >= maxRetries) {
      return {
        mutationId: mutation.id,
        success: false,
        error: `Max retries (${maxRetries}) exceeded`,
        retryable: false,
      };
    }

    try {
      logger
        .category("storage")
        .debug(
          `Syncing mutation ${mutation.id} (${mutation.operation} on ${mutation.table})`,
        );

      // Execute sync handler via domain wrapper (hides supabase client details)
      const { executeSyncMutationHandler } = await import("@/lib/database");
      const handlerResult = await executeSyncMutationHandler(mutation);

      if (!handlerResult.success) {
        const isConflict = handlerResult.conflict || false;

        // Phase 4: Use standardized error classification as source of truth
        const errorContract = NetworkErrorClassifier.classify(
          new Error(handlerResult.error),
        );

        if (isConflict) {
          // Create conflict object for tracking
          const conflictData = {
            mutationId: mutation.id,
            type: "version_mismatch" as const,
            message: handlerResult.error || "Conflict detected",
          };

          // Enqueue conflict for tracking, debugging, and potential future user-choice modal
          // This records the conflict even though v1 auto-resolves with LWW
          getConflictQueueManager().enqueueConflict(mutation, conflictData);

          // v1: Always use Last-Write-Wins (LWW)
          // Extract server timestamp from handlerResult.data.updated_at (ISO8601 or epoch-ms)
          // If unavailable, treat as undefined (conservative server-wins behavior)
          let serverTimestamp: number | undefined;
          if (handlerResult.data?.updated_at) {
            const parsed =
              typeof handlerResult.data.updated_at === "number"
                ? handlerResult.data.updated_at
                : new Date(handlerResult.data.updated_at).getTime();
            serverTimestamp = isNaN(parsed) ? undefined : parsed;
          }

          const resolution = executeConflictResolution(mutation, conflictData, {
            timestamp: serverTimestamp,
          });

          logger
            .category("storage")
            .info("Conflict detected and resolved (LWW)", {
              mutationId: mutation.id,
              conflictType: conflictData.type,
              strategy: resolution.strategy,
              shouldRetry: resolution.shouldRetry,
              shouldKeep: resolution.shouldKeep,
            });

          // v1: Apply LWW automatically for all content (no user-choice modal)
          if (resolution.shouldRetry) {
            // Retry: keep in queue, will retry on next sync
            await OfflineMutationQueue.markFailed(
              mutation.id,
              `Conflict resolved (LWW: local newer): ${handlerResult.error || "Version mismatch"}`,
            );

            return {
              mutationId: mutation.id,
              success: false,
              error: handlerResult.error || "Conflict detected",
              conflict: conflictData,
              retryable: true, // Will retry
            };
          } else {
            // Discard: remove from queue (server won)
            await OfflineMutationQueue.remove([mutation.id]);

            logger
              .category("storage")
              .info("Mutation discarded (LWW: server newer)", {
                mutationId: mutation.id,
              });

            return {
              mutationId: mutation.id,
              success: false,
              error: handlerResult.error || "Conflict detected",
              conflict: conflictData,
              retryable: false, // Discarded
            };
          }
        }

        // Use error contract's retryable decision (not string matching)
        const retryable = errorContract.retryable;

        if (retryable) {
          // Record error type from standardized classification
          await OfflineMutationQueue.markFailed(
            mutation.id,
            handlerResult.error || "Unknown error",
            errorContract.type,
          );

          // Record failure in circuit breaker to prevent cascading
          const isNetworkError = errorContract.type === "network";
          await CircuitBreakerReplayManager.recordReplayFailure(
            mutation,
            new Error(handlerResult.error),
            isNetworkError,
          );
        }

        return {
          mutationId: mutation.id,
          success: false,
          error: handlerResult.error,
          retryable,
        };
      }

      // Success — invalidate cache tags if provided (background sync operation; show stale while refetching)
      if (mutation.invalidateTags && mutation.invalidateTags.length > 0) {
        try {
          await QueryCache.invalidateByTags(mutation.invalidateTags, { strategy: 'background' });
        } catch (err) {
          logger.category("error").warn("Failed to invalidate cache:", err);
        }
      }

      // Phase 4: Record success in circuit breaker
      await CircuitBreakerReplayManager.recordReplaySuccess(mutation);

      logger
        .category("storage")
        .info(
          `Mutation ${mutation.id} synced successfully (${mutation.table} ${mutation.operation})`,
        );

      return {
        mutationId: mutation.id,
        success: true,
        data: handlerResult.data,
        retryable: false,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;

      // Phase 4: Use standardized error classification for robust decisions
      const errorContract = NetworkErrorClassifier.classify(error);
      const retryable = errorContract.retryable;

      if (retryable) {
        await OfflineMutationQueue.markFailed(
          mutation.id,
          errorMsg,
          errorContract.type,
        );

        // Phase 4: Record failure in circuit breaker
        const isNetworkError = errorContract.type === "network";
        await CircuitBreakerReplayManager.recordReplayFailure(
          mutation,
          error,
          isNetworkError,
        );

        const backoff = this.calculateBackoff(mutation.retryCount);
        logger
          .category("storage")
          .debug(`Retrying mutation ${mutation.id} in ${backoff}ms`);
      } else {
        logger
          .category("error")
          .error(`Mutation ${mutation.id} failed permanently:`, error);
      }

      return {
        mutationId: mutation.id,
        success: false,
        error: errorMsg,
        retryable,
      };
    }
  }

  /**
   * Calculate exponential backoff time
   * Phase 4: Uses BackoffScheduler with jitter for better recovery
   */
  private calculateBackoff(retryCount: number): number {
    const baseMs = this.config.retryBaseMs;
    const multiplier = Math.pow(2, retryCount);
    const jitter = 0.9 + Math.random() * 0.2; // ±10% factor
    const backoffMs = Math.floor(baseMs * multiplier * jitter);
    return Math.min(backoffMs, 300000); // Cap at 5 minutes
  }

  /**
   * Subscribe to sync status changes (for UI)
   */
  subscribe(listener: (status: OfflineSyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notifyStatusListeners(): void {
    for (const listener of this.statusListeners) {
      listener(this.lastSyncStatus);
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): OfflineSyncStatus {
    return { ...this.lastSyncStatus };
  }

  /**
   * Pause syncing (e.g., during auth refresh)
   */
  pause(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    logger.category("storage").info("OnlineSyncManager paused");
  }

  /**
   * Resume syncing
   */
  resume(): void {
    if (this.isOnline) {
      this.triggerSync();
      // Enqueue feature flag refresh job on app resume
      this.triggerFeatureFlagRefresh().catch((err) => {
        logger
          .category("error")
          .warn("Failed to trigger feature_flags_refresh on resume", { err });
      });
    }
    logger.category("storage").info("OnlineSyncManager resumed");
  }

  /**
   * Trigger a feature flags refresh via background job queue
   * Enqueues a "feature_flags_refresh" job that will be executed when online
   * Uses job queue with requiresNetwork: true to defer if offline
   */
  async triggerFeatureFlagRefresh(): Promise<void> {
    try {
      const { getJobQueue } = await import("@/lib/jobs");
      const queue = getJobQueue();

      // Enqueue feature flag refresh job
      // This will be deferred if offline and executed when network available
      const jobId = await queue.enqueue({
        type: "feature_flags_refresh",
        payload: { triggeredAt: Date.now() },
        idempotencyKey: `ff-refresh:${Date.now()}`,
        requiresNetwork: true, // Requires online - will defer if offline
      });

      logger
        .category("storage")
        .debug(`Feature flags refresh job enqueued: ${jobId}`);
    } catch (error) {
      logger
        .category("error")
        .warn("Failed to enqueue feature_flags_refresh job", {
          error: (error as Error).message,
        });
    }
  }

  /**
   * Phase 4: Get comprehensive queue statistics
   *
   * Includes failure types, retry counts, timing info for observability
   */
  async getQueueStats() {
    return OfflineMutationQueue.getStats(this.lastSyncStatus);
  }

  /**
   * Cleanup on app shutdown
   */
  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    // Clear scheduled retry timer
    this.clearScheduledRetryTimer();
    logger.category("storage").info("OnlineSyncManager destroyed");
  }
}

// Singleton instance
export const OnlineSyncManager = new OnlineSyncManagerService();
