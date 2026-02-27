/**
 * Storage Health Monitor
 *
 * Monitors SecureStorage health via periodic background jobs.
 * Runs on initialization and every 5 minutes thereafter.
 *
 * If storage becomes inaccessible:
 * 1. Attempts automatic recovery (clears QueryCache)
 * 2. If recovery fails, triggers RECOVERY safe mode
 */

import { getAppConfig } from '@/config';
import { createSafeModeState, SafeModeReason } from "@/lib/error";
import { getJobQueue } from "@/lib/jobs";
import { AppKernel } from "@/lib/kernel";
import { logger } from "@/lib/utils/logger";

const STORAGE_HEALTH_CHECK_JOB_TYPE = "storage_health_check";
// Default to 5 minutes if not configured
const STORAGE_HEALTH_CHECK_INTERVAL_MS =
  getAppConfig()?.safeMode?.storageHealthCheckIntervalMs ?? 5 * 60 * 1000;
const STORAGE_HEALTH_TEST_KEY = "__storage_health_test__";

/**
 * Initialize storage health monitoring.
 * Performs initial health check and registers background job for periodic checks.
 */
export async function initializeStorageHealthMonitoring(): Promise<void> {
  logger.category("bootstrap").info("Initializing storage health monitoring");

  // Perform initial health check
  await validateStorageHealth();

  // Register job handler if not already registered
  const queue = getJobQueue();
  if (!queue.hasHandler(STORAGE_HEALTH_CHECK_JOB_TYPE)) {
    queue.registerHandler(
      STORAGE_HEALTH_CHECK_JOB_TYPE,
      handleStorageHealthCheck,
    );
  }

  // Enqueue recurring health check job
  // Schedule for 5 minutes from now, will reschedule on completion
  await queue.enqueue({
    type: STORAGE_HEALTH_CHECK_JOB_TYPE,
    payload: {},
    runAt: Date.now() + STORAGE_HEALTH_CHECK_INTERVAL_MS,
    maxRetries: 1, // Don't retry health checks, they're periodic anyway
    idempotencyKey: `storage-health-check`, // Only one pending at a time
  });
}

/**
 * One-time storage health validation (run on app start).
 * Tests if SecureStorage is readable and writable, and attempts recovery if it fails.
 */
async function validateStorageHealth(): Promise<void> {
  try {
    logger.category("storage").debug("Running storage health check");

    // Lazy-import to avoid circular dependency
    const { SecureStorage } = await import("../SecureStorage");
    const { QueryCache } = await import("@/lib/storage/cache/query-cache");

    // Test write to SecureStorage (critical for functionality)
    try {
      const testValue = `health_check_${Date.now()}`;
      await SecureStorage.setItem(STORAGE_HEALTH_TEST_KEY, testValue);

      // Test read to verify write succeeded
      const readValue = await SecureStorage.getItem(STORAGE_HEALTH_TEST_KEY);
      if (readValue !== testValue) {
        throw new Error(
          `Storage write/read mismatch: wrote "${testValue}", read "${readValue}"`,
        );
      }

      // Clean up test key
      try {
        await SecureStorage.removeItem(STORAGE_HEALTH_TEST_KEY);
      } catch (cleanupError) {
        // Non-critical if cleanup fails, but log it
        logger
          .category("storage")
          .debug("Storage health test key cleanup failed (non-critical)", {
            error: String(cleanupError),
          });
      }
    } catch (storageError) {
      logger
        .category("storage")
        .warn("Storage health check failed, attempting recovery", {
          error: String(storageError),
        });

      // Attempt auto-recovery: clear QueryCache
      try {
        await QueryCache.clearAll();
        logger
          .category("storage")
          .info("Storage recovery successful: cleared QueryCache");
        return; // Recovery succeeded, don't trigger safe mode
      } catch (recoveryError) {
        logger.category("storage").error("Storage recovery failed", {
          storageError: String(storageError),
          recoveryError: String(recoveryError),
        });

        // Recovery failed, trigger safe mode
        const safeMode = createSafeModeState(
          SafeModeReason.STORAGE_UNREADABLE,
          {
            details:
              "Storage system is unreadable or corrupted. Automatic recovery failed.",
            originalError: storageError as Error,
          },
        );
        AppKernel.setSafeMode(safeMode);
        return;
      }
    }

    logger.category("storage").debug("Storage health check passed");
  } catch (error) {
    logger
      .category("storage")
      .error("Unexpected error during storage health check", {
        error: String(error),
      });
  }
}

/**
 * Background job handler for periodic storage health checks.
 * Called by job queue every 5 minutes.
 * Reschedules itself for next check interval if app is still active.
 *
 * NOTE: Checks if kernel is still active (not reset to IDLE phase) before rescheduling
 * to prevent unbounded job chains after app reset or destruction.
 */
async function handleStorageHealthCheck(): Promise<{ nextCheckAt: number }> {
  await validateStorageHealth();

  // Bounds check: only reschedule if app kernel is still active
  // If kernel was reset (e.g., app destroyed, testing scenario), don't reschedule
  const kernelState = AppKernel.getState();
  if (kernelState.currentPhase === "idle") {
    logger
      .category("storage")
      .debug("Storage health check not rescheduling - kernel is idle");
    return { nextCheckAt: 0 };
  }

  // Reschedule for next check
  const nextCheckAt = Date.now() + STORAGE_HEALTH_CHECK_INTERVAL_MS;
  const queue = getJobQueue();

  await queue.enqueue({
    type: STORAGE_HEALTH_CHECK_JOB_TYPE,
    payload: {},
    runAt: nextCheckAt,
    maxRetries: 1,
    idempotencyKey: `storage-health-check`,
  });

  return { nextCheckAt };
}
