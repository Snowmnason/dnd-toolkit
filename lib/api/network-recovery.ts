/**
 * Network Recovery Integration
 *
 * Orchestrates automatic recovery when transitioning between network states:
 * - RECOVERING → GOOD: Sync offline queue + invalidate stale cache
 * - GOOD → OFFLINE: Notify user of offline mode
 *
 * Phase 2 of APIClient factory: automatic network recovery coordination
 */

import { QueryCache } from "@/lib/cache";
import type { NetworkState } from "@/lib/network/state-machine";
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { OfflineQueueManager } from "./offline-queue";
import { RequestManager } from "./request-manager";

/**
 * Recovery state persistence
 * Survives app restart to maintain backoff progression
 */
export interface RecoveryState {
  /** Current retry count */
  retries: number;
  /** Timestamp of last recovery attempt */
  lastAttemptAt: number;
  /** When next retry should be attempted */
  nextRetryAt: number;
}

/**
 * Notification callback for UI notifications
 * Called during network state transitions
 */
export type NotificationCallback = (message: string) => void;

/**
 * Network Recovery Manager
 * Handles automatic recovery hooks and persistence
 */
export const NetworkRecoveryManager = {
  // In-memory state
  _recoveryState: {
    retries: 0,
    lastAttemptAt: 0,
    nextRetryAt: 0,
  } as RecoveryState,

  _isInitialized: false,
  _recoveryJobId: null as string | null,
  _notificationCallback: null as NotificationCallback | null,

  /**
   * Set notification callback (called from app to display toasts)
   */
  setNotificationCallback(callback: NotificationCallback): void {
    this._notificationCallback = callback;
  },

  /**
   * Notify user of a network event
   */
  _notify(message: string): void {
    if (this._notificationCallback) {
      this._notificationCallback(message);
    } else {
      logger.info("network", `Notification (callback not set): ${message}`);
    }
  },
  /**
   * Initialize recovery state from SecureStorage
   * Called during app bootstrap (AppKernel)
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) return;

    try {
      const stored = await SecureStorage.getJSON<RecoveryState>(
        STORAGE_KEYS.NETWORK_RECOVERY_STATE,
      );

      if (stored) {
        this._recoveryState = stored;
        logger.info("network", "Recovery state hydrated from storage", {
          retries: this._recoveryState.retries,
        });
      }
    } catch (error) {
      logger.error("network", "Error loading recovery state", error);
      // Continue with defaults
    }

    this._isInitialized = true;
  },

  /**
   * Get current recovery state
   */
  getRecoveryState(): RecoveryState {
    return { ...this._recoveryState };
  },

  /**
   * Update recovery retry count (persists to storage)
   */
  async incrementRetries(): Promise<void> {
    this._recoveryState.retries++;
    this._recoveryState.lastAttemptAt = Date.now();

    // Update nextRetryAt with exponential backoff
    const backoffMs = Math.min(
      1000 * Math.pow(2, this._recoveryState.retries - 1),
      30000,
    ); // Cap at 30s
    this._recoveryState.nextRetryAt = Date.now() + backoffMs;

    await this._persistRecoveryState();
  },

  /**
   * Reset recovery state on successful recovery
   */
  async resetRecoveryState(): Promise<void> {
    this._recoveryState = {
      retries: 0,
      lastAttemptAt: 0,
      nextRetryAt: 0,
    };

    await this._persistRecoveryState();
  },

  /**
   * Check if next retry is ready
   */
  isNextRetryReady(): boolean {
    return Date.now() >= this._recoveryState.nextRetryAt;
  },

  /**
   * Get milliseconds until next retry is ready
   */
  getTimeUntilNextRetry(): number {
    const delay = this._recoveryState.nextRetryAt - Date.now();
    return Math.max(0, delay);
  },

  /**
   * Persist recovery state to SecureStorage
   */
  async _persistRecoveryState(): Promise<void> {
    try {
      await SecureStorage.setJSON(
        STORAGE_KEYS.NETWORK_RECOVERY_STATE,
        this._recoveryState,
      );
    } catch (error) {
      logger.error("network", "Error persisting recovery state", error);
    }
  },

  /**
   * Reset all recovery state (for testing)
   */
  _reset(): void {
    this._recoveryState = {
      retries: 0,
      lastAttemptAt: 0,
      nextRetryAt: 0,
    };
    this._isInitialized = false;
    this._recoveryJobId = null;
  },
};

/**
 * Register network recovery hooks
 * Called during app bootstrap (AppKernel phase)
 *
 * @param networkStateMachine - NetworkStateMachine instance for hook registration
 */
export async function registerNetworkRecoveryHooks(
  networkStateMachine: any,
): Promise<void> {
  logger.info("network", "Registering network recovery hooks");

  // RECOVERING → GOOD: Sync queue + invalidate stale cache
  networkStateMachine.onSpecificTransition(
    "RECOVERING" as NetworkState,
    "GOOD" as NetworkState,
    async () => {
      logger.info("network", "Executing RECOVERING → GOOD recovery hooks");

      try {
        // Step 1: Sync pending offline queue mutations
        logger.debug("network", "Syncing offline queue mutations");
        await RequestManager.flushOfflineQueue();
        const stats = OfflineQueueManager.getStats();
        logger.info("network", "Offline queue synced", {
          remaining: stats.queueLength,
          maxRetries: stats.maxRetryAttempts,
        });

        // Step 2: Invalidate queries older than 2 hours (stale data)
        logger.debug("network", "Invalidating stale cache entries");
        const staleDuration = 2 * 60 * 60 * 1000; // 2 hours
        const invalidatedCount =
          await QueryCache.invalidateOlderThan(staleDuration);
        logger.info("network", "Stale cache invalidated", {
          count: invalidatedCount,
          staleDuration,
        });

        // Step 3: Reset recovery retry state
        await NetworkRecoveryManager.resetRecoveryState();

        // Step 4: Notify user
        NetworkRecoveryManager._notify(
          "Connection restored - syncing your changes",
        );
      } catch (error) {
        logger.error(
          "network",
          "Error during RECOVERING → GOOD recovery",
          error,
        );
        NetworkRecoveryManager._notify(
          "Connection restored but sync failed - please retry",
        );
      }
    },
  );

  // GOOD → OFFLINE: Notify user
  networkStateMachine.onSpecificTransition(
    "GOOD" as NetworkState,
    "OFFLINE" as NetworkState,
    async () => {
      logger.info("network", "Executing GOOD → OFFLINE notification");

      try {
        NetworkRecoveryManager._notify(
          "You are offline - changes will sync when online",
        );
      } catch (error) {
        logger.error(
          "network",
          "Error during GOOD → OFFLINE notification",
          error,
        );
      }
    },
  );

  // Also handle other quality transitions to OFFLINE (BAD, NO_WIFI)
  networkStateMachine.onSpecificTransition(
    "BAD" as NetworkState,
    "OFFLINE" as NetworkState,
    async () => {
      logger.info("network", "Executing BAD → OFFLINE notification");
      try {
        NetworkRecoveryManager._notify(
          "Connection lost - changes will sync when online",
        );
      } catch (error) {
        logger.error(
          "network",
          "Error during BAD → OFFLINE notification",
          error,
        );
      }
    },
  );

  networkStateMachine.onSpecificTransition(
    "NO_WIFI" as NetworkState,
    "OFFLINE" as NetworkState,
    async () => {
      logger.info("network", "Executing NO_WIFI → OFFLINE notification");
      try {
        NetworkRecoveryManager._notify(
          "No connection - changes will sync when online",
        );
      } catch (error) {
        logger.error(
          "network",
          "Error during NO_WIFI → OFFLINE notification",
          error,
        );
      }
    },
  );

  logger.info("network", "Network recovery hooks registered successfully");
}
