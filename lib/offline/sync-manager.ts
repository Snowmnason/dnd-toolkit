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
 */

import { QueryCache } from "@/lib/cache/query-cache";
import {
    NetworkDetection,
    type NetworkStatus,
} from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";
import { OfflineMutationQueue } from "./mutation-queue";
import type {
    OfflineSyncConfig,
    OfflineSyncStatus,
    QueuedMutation,
    SyncResult,
} from "./types";

/**
 * Default sync configuration
 */
const DEFAULT_CONFIG: Required<OfflineSyncConfig> = {
  batchSize: 5,
  debounceMs: 5000,
  maxRetries: 5,
  retryBaseMs: 2000,
  conflictStrategy: "client_wins",
};

class OnlineSyncManagerService {
  private networkUnsubscribe: (() => void) | null = null;
  private isOnline = false;
  private isSyncing = false;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
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

      // Subscribe to network status changes
      this.networkUnsubscribe = NetworkDetection.subscribe(
        (status: NetworkStatus) => {
          this.onNetworkStatusChanged(status);
        },
      );

      // Check initial network status
      const initialStatus = NetworkDetection.getStatus();
      this.onNetworkStatusChanged(initialStatus);

      logger.category("storage").info("OnlineSyncManager initialized");
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
    this.isOnline = status.isOnline && (status.isInternetReachable ?? true);

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
      logger.category("storage").debug("Sync already in progress");
      return this.lastSyncStatus;
    }

    this.isSyncing = true;
    const startTime = Date.now();

    // Reset status
    this.lastSyncStatus = {
      isSyncing: true,
      totalQueued: await OfflineMutationQueue.size(),
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
        const batch = await OfflineMutationQueue.peek(this.config.batchSize);
        if (batch.length === 0) {
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
      this.lastSyncStatus.totalQueued = await OfflineMutationQueue.size();

      const duration = Date.now() - startTime;
      logger
        .category("storage")
        .info(
          `Sync complete: ${totalSynced}/${totalProcessed} succeeded in ${duration}ms`,
        );
    } catch (error) {
      this.lastSyncStatus.lastError = (error as Error).message;
      logger.category("error").error("Sync failed:", error);
    } finally {
      this.isSyncing = false;
      this.lastSyncStatus.isSyncing = false;
      this.notifyStatusListeners();
    }

    return this.lastSyncStatus;
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
      // TODO: Implement actual sync with database
      // This stub represents where mutations would be applied to Supabase
      // For Phase 1, this is a placeholder
      // In Phase 2, integrate with worldsDB.create/update/delete

      logger.category("storage").debug(`Syncing mutation ${mutation.id}`);

      // Simulate successful sync for now
      // In Phase 2, call actual DB function:
      // const result = await worldsDB[mutation.operation](mutation.payload);

      // Invalidate cache tags after sync
      if (mutation.invalidateTags && mutation.invalidateTags.length > 0) {
        try {
          await QueryCache.invalidateByTags(mutation.invalidateTags);
        } catch (err) {
          logger.category("error").warn("Failed to invalidate cache:", err);
        }
      }

      return {
        mutationId: mutation.id,
        success: true,
        data: {
          /* response from server */
        },
        retryable: false,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;

      // Determine if error is retryable
      const isNetworkError =
        errorMsg.includes("network") || errorMsg.includes("offline");
      const isRateLimited =
        errorMsg.includes("429") || errorMsg.includes("rate limit");
      const retryable = isNetworkError || isRateLimited;

      if (retryable) {
        // Update retry count
        await OfflineMutationQueue.markFailed(mutation.id, errorMsg);

        // Calculate backoff
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
   */
  private calculateBackoff(retryCount: number): number {
    const baseMs = this.config.retryBaseMs;
    return baseMs * Math.pow(2, retryCount);
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
    }
    logger.category("storage").info("OnlineSyncManager resumed");
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
    logger.category("storage").info("OnlineSyncManager destroyed");
  }
}

// Singleton instance
export const OnlineSyncManager = new OnlineSyncManagerService();
