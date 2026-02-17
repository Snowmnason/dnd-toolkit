/**
 * Network Recovery Auto-Retry Job
 *
 * Background job that automatically attempts reconnection when network is RECOVERING.
 * Uses exponential backoff and checks network reachability at intervals.
 *
 * Integrates with:
 * - Job Queue (#167) for background execution
 * - NetworkStateMachine for state transitions
 * - NetworkRecoveryManager for retry tracking
 * - NetworkDetection for reachability checks
 */

import { NetworkDetection } from "@/lib/network/network-detection";
import { NetworkStateManager } from "@/lib/network/state-machine";
import { logger } from "@/lib/utils/logger";
import { NetworkRecoveryManager } from "./network-recovery";

type NetworkStateMachine = typeof NetworkStateManager;

/**
 * Configuration for network recovery retry job
 */
interface NetworkRecoveryRetryJobConfig {
  /** Max retries before giving up */
  maxRetries?: number;
  /** Enable/disable auto-retry (default: true) */
  enabled?: boolean;
}

/**
 * Network Recovery Retry Job Manager
 *
 * Coordinates with Job Queue to run periodic reconnection attempts
 */
export const NetworkRecoveryRetryJobManager = {
  _networkStateMachine: null as NetworkStateMachine | null,
  _jobQueue: null as any, // BackgroundJobQueue instance
  _isRunning: false,
  _isAppInBackground: false,
  _config: null as NetworkRecoveryRetryJobConfig | null,

  /**
   * Initialize the retry job manager
   * Called during app bootstrap
   */
  async initialize(
    networkStateMachine: NetworkStateMachine,
    jobQueue: any,
    config?: NetworkRecoveryRetryJobConfig,
  ): Promise<void> {
    this._networkStateMachine = networkStateMachine;
    this._jobQueue = jobQueue;
    this._config = config || {};

    const enabled = config?.enabled ?? true;
    if (!enabled) {
      logger.info("network", "Network recovery retry job disabled");
      return;
    }

    // Register the retry job handler
    jobQueue.registerHandler(
      "network_recovery_retry",
      this._handleRecoveryRetry.bind(this),
    );

    // Register hooks to start/stop retry job based on state transitions
    networkStateMachine.onSpecificTransition("GOOD", "RECOVERING", async () => {
      logger.info(
        "network",
        "Transitioning to RECOVERING: starting auto-retry",
      );
      await this._startRetryJob();
    });

    networkStateMachine.onSpecificTransition("BAD", "RECOVERING", async () => {
      logger.info(
        "network",
        "Transitioning to RECOVERING: starting auto-retry",
      );
      await this._startRetryJob();
    });

    networkStateMachine.onSpecificTransition(
      "CELLULAR",
      "RECOVERING",
      async () => {
        logger.info(
          "network",
          "Transitioning to RECOVERING: starting auto-retry",
        );
        await this._startRetryJob();
      },
    );

    // Stop retry job on successful recovery
    networkStateMachine.onSpecificTransition("RECOVERING", "GOOD", async () => {
      logger.info("network", "Recovery successful: stopping auto-retry");
      await this._stopRetryJob();
    });

    // Also stop on other recovery scenarios (unlikely but possible)
    networkStateMachine.onSpecificTransition("RECOVERING", "BAD", async () => {
      logger.info(
        "network",
        "Transitioned RECOVERING → BAD: stopping auto-retry",
      );
      await this._stopRetryJob();
    });

    networkStateMachine.onSpecificTransition(
      "RECOVERING",
      "CELLULAR",
      async () => {
        logger.info(
          "network",
          "Transitioned RECOVERING → CELLULAR: stopping auto-retry",
        );
        await this._stopRetryJob();
      },
    );

    logger.info("network", "Network recovery retry job initialized");
  },

  /**
   * Start the retry job by enqueueing it
   */
  async _startRetryJob(): Promise<void> {
    if (this._isRunning) {
      logger.debug("network", "Retry job already running");
      return;
    }

    try {
      this._isRunning = true;

      const jobId = await this._jobQueue.enqueue({
        type: "network_recovery_retry",
        payload: {
          startedAt: Date.now(),
        },
        idempotencyKey: "network_recovery_retry:main",
        maxRetries: 0, // Don't retry the retry job itself; let it handle retries internally
      });

      logger.info("network", "Enqueued network recovery retry job", { jobId });

      // Trigger immediate processing
      await this._jobQueue.runNext();
    } catch (error) {
      logger.error("network", "Failed to start retry job", error);
      this._isRunning = false;
    }
  },

  /**
   * Stop the retry job
   */
  async _stopRetryJob(): Promise<void> {
    this._isRunning = false;
    logger.debug("network", "Stopping network recovery retry job");
  },

  /**
   * Job handler: attempt network reconnection
   */
  async _handleRecoveryRetry(payload: any): Promise<void> {
    if (!this._networkStateMachine) {
      throw new Error("NetworkStateMachine not initialized");
    }

    const state = this._networkStateMachine.getState();

    // Only retry if still in RECOVERING state
    if (state !== "RECOVERING") {
      logger.debug("network", "Not in RECOVERING state, skipping retry", {
        state,
      });
      return;
    }

    // Check if app is backgrounded
    if (this._isAppInBackground) {
      logger.debug("network", "App backgrounded, pausing retry");
      return;
    }

    const retryState = NetworkRecoveryManager.getRecoveryState();
    // Use configured maxRetries or default to 5
    const maxRetries = this._config?.maxRetries ?? 5;

    if (retryState.retries >= maxRetries) {
      logger.warn("network", "Max recovery retries exceeded", {
        retries: retryState.retries,
      });
      // Don't retry further; let user manually recover
      return;
    }

    try {
      const backoffMs = NetworkRecoveryManager.getTimeUntilNextRetry();

      if (backoffMs > 0) {
        logger.debug("network", "Waiting for backoff before retry", {
          backoffMs,
        });
        // Schedule next attempt via job queue with delay
        await this._jobQueue.enqueue({
          type: "network_recovery_retry",
          payload,
          runAt: Date.now() + backoffMs,
          idempotencyKey: "network_recovery_retry:main",
          maxRetries: 0,
        });
        return;
      }

      // Check network reachability
      logger.debug("network", "Checking network reachability");
      const status = NetworkDetection.getStatus();

      if (status.isOnline) {
        logger.info("network", "Network reachable! Transitioning to GOOD");
        await this._networkStateMachine.transitionTo(
          "GOOD",
          "Auto-retry successful",
        );
        this._isRunning = false;
        return;
      }

      // Still offline: increment retry count and retry
      logger.info("network", "Network still unreachable, scheduling retry", {
        retries: retryState.retries,
      });

      await NetworkRecoveryManager.incrementRetries();

      // Requeue the job with backoff
      const nextBackoff = NetworkRecoveryManager.getTimeUntilNextRetry();
      logger.debug("network", "Scheduling next retry attempt", {
        backoffMs: nextBackoff,
      });

      await this._jobQueue.enqueue({
        type: "network_recovery_retry",
        payload,
        idempotencyKey: "network_recovery_retry:main",
        maxRetries: 0,
      });
    } catch (error) {
      logger.error("network", "Error during recovery retry", error);

      // Requeue for next attempt
      if (this._isRunning) {
        try {
          await this._jobQueue.enqueue({
            type: "network_recovery_retry",
            payload,
            idempotencyKey: "network_recovery_retry:main",
            maxRetries: 0,
          });
        } catch (requeueError) {
          logger.error("network", "Failed to requeue retry job", requeueError);
        }
      }
    }
  },

  /**
   * Handle app lifecycle: pause retries when backgrounded
   */
  handleAppBackground(): void {
    this._isAppInBackground = true;
    logger.debug("network", "App backgrounded: pausing retry attempts");
  },

  /**
   * Resume retries when app comes to foreground
   */
  async handleAppForeground(): Promise<void> {
    this._isAppInBackground = false;
    logger.debug("network", "App in foreground: resuming retry attempts");

    // Immediately attempt retry if still in RECOVERING
    if (
      this._isRunning &&
      this._networkStateMachine?.getState() === "RECOVERING"
    ) {
      logger.debug("network", "Triggering retry on app foreground");
      await this._jobQueue.runNext();
    }
  },

  /**
   * Reset state (for testing)
   */
  _reset(): void {
    this._isRunning = false;
    this._isAppInBackground = false;
    this._networkStateMachine = null;
    this._jobQueue = null;
  },
};

export type { NetworkRecoveryRetryJobConfig };

