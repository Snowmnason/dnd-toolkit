/**
 * Auth Health Monitor
 *
 * Monitors Supabase session health via periodic background jobs.
 * Runs on initialization and every 4 hours thereafter (matches session staleness threshold).
 *
 * If auth becomes invalid:
 * - Triggers SAFE safe mode with AUTH_EXPIRED reason
 * - UI routing layer detects this and redirects to login
 */

import { getAppConfig } from "@/lib/config/loader";
import { createSafeModeState, SafeModeReason } from "@/lib/error/safe-mode";
import { getJobQueue } from "@/lib/jobs";
import { AppKernel } from "@/lib/kernel";
import { logger } from "@/lib/utils/logger";

const AUTH_HEALTH_CHECK_JOB_TYPE = "auth_health_check";
// Default to 4 hours if not configured
const AUTH_HEALTH_CHECK_INTERVAL_MS =
  getAppConfig()?.safeMode?.authHealthCheckIntervalMs ?? 4 * 60 * 60 * 1000;

/**
 * Initialize auth health monitoring.
 * Performs initial health check and registers background job for periodic checks.
 */
export async function initializeAuthHealthMonitoring(): Promise<void> {
  logger.category("bootstrap").info("Initializing auth health monitoring");

  // Perform initial health check (non-blocking, async)
  validateAuthHealth().catch((error) => {
    logger.category("auth").error("Error during initial auth health check", {
      error: String(error),
    });
  });

  // Register job handler if not already registered
  const queue = getJobQueue();
  if (!queue.hasHandler(AUTH_HEALTH_CHECK_JOB_TYPE)) {
    queue.registerHandler(AUTH_HEALTH_CHECK_JOB_TYPE, handleAuthHealthCheck);
  }

  // Enqueue recurring health check job
  // Schedule for 4 hours from now, will reschedule on completion
  await queue.enqueue({
    type: AUTH_HEALTH_CHECK_JOB_TYPE,
    payload: {},
    runAt: Date.now() + AUTH_HEALTH_CHECK_INTERVAL_MS,
    maxRetries: 1, // Don't retry health checks, they're periodic anyway
    idempotencyKey: `auth-health-check`, // Only one pending at a time
  });
}

/**
 * One-time auth health validation (run during bootstrap).
 * Checks if current session is valid.
 * If expired, triggers SAFE safe mode and UI layer redirects to login.
 */
async function validateAuthHealth(): Promise<void> {
  try {
    logger.category("auth").debug("Running auth health check");

    // Lazy-import to avoid circular dependency
    const { AuthStateManager } = await import("./auth-state");

    // Check if user is authenticated
    const isAuthenticated = await AuthStateManager.isAuthenticated();

    if (!isAuthenticated) {
      logger
        .category("auth")
        .warn("Auth health check failed: session not authenticated");

      // Trigger safe mode - UI routing layer will detect and redirect to login
      const safeMode = createSafeModeState(SafeModeReason.AUTH_EXPIRED, {
        details: "User session is not authenticated or has expired",
      });
      AppKernel.setSafeMode(safeMode);
      return;
    }

    logger.category("auth").debug("Auth health check passed");
  } catch (error) {
    logger.category("auth").error("Unexpected error during auth health check", {
      error: String(error),
    });
  }
}

/**
 * Background job handler for periodic auth health checks.
 * Called by job queue every 4 hours.
 * Reschedules itself for next check interval.
 */
async function handleAuthHealthCheck(): Promise<{ nextCheckAt: number }> {
  await validateAuthHealth();

  // Reschedule for next check
  const nextCheckAt = Date.now() + AUTH_HEALTH_CHECK_INTERVAL_MS;
  const queue = getJobQueue();

  await queue.enqueue({
    type: AUTH_HEALTH_CHECK_JOB_TYPE,
    payload: {},
    runAt: nextCheckAt,
    maxRetries: 1,
    idempotencyKey: `auth-health-check`,
  });

  return { nextCheckAt };
}
