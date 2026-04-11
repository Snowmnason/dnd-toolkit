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

import { getAppConfig } from '@/config';
import { reportCrash } from "@/lib/error";
import { getJobQueue } from "@/lib/jobs";
import { isKernelIdle } from "@/lib/kernel/kernel-manager";
import { logger } from "@/lib/utils";
import { DegradeCapability } from "@/type-definitions/degrade";

const AUTH_HEALTH_CHECK_JOB_TYPE = "auth_health_check";
// Default to 4 hours if not configured
const AUTH_HEALTH_CHECK_INTERVAL_MS =
  getAppConfig()?.safeMode?.authHealthCheckIntervalMs ?? 4 * 60 * 60 * 1000;

/**
 * Initialize auth health monitoring.
 * Performs initial health check and registers background job for periodic checks.
 *
 * IMPORTANT: Initial check is awaited to prevent race conditions with kernel's auth phase.
 * Must complete before returning to ensure safe mode triggers are not missed or duplicated.
 */
export async function initializeAuthHealthMonitoring(): Promise<void> {
  logger.category("bootstrap").info("Initializing auth health monitoring");

  // Perform initial health check (blocking) to avoid race with kernel auth phase
  // If auth is invalid, this will trigger safe mode before we continue
  try {
    await validateAuthHealth();
  } catch (error) {
    logger.category("auth").error("Error during initial auth health check", {
      error: String(error),
    });
    // Continue anyway - the error is already logged and safe mode may have been triggered
  }

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
 * Only triggers safe mode if a user was previously authenticated but the session is now invalid.
 * Does NOT trigger safe mode for unauthenticated first-time users (intentional state).
 * If expired, triggers SAFE safe mode and UI layer redirects to login.
 */
async function validateAuthHealth(): Promise<void> {
  try {
    logger.category("auth").debug("Running auth health check");

    // Check if auth backend is configured via middleware
    const { isAuthConfigured } = await import("@/middleware/services");
    if (!isAuthConfigured()) {
      logger
        .category("auth")
        .debug("Auth not configured, skipping auth health check");
      return;
    }

    const { AuthStateManager } = await import("../auth-state");

    // Check if user had a previous session/account
    const authState = await AuthStateManager.getAuthState();
    const hadPreviousAccount = authState.hasAccount;

    // Check if user is currently authenticated
    const isAuthenticated = await AuthStateManager.isAuthenticated();

    if (!isAuthenticated) {
      // Only trigger safe mode if user HAD an account but is now unauthenticated
      // (Session expired or invalidated)
      // Do NOT trigger safe mode for intentionally unauthenticated users (fresh install, logged out)
      if (hadPreviousAccount) {
        logger
          .category("auth")
          .warn(
            "Auth health check failed: previously authenticated user session is now invalid",
          );

        // Trigger safe mode via centralized degradation manager — UI routing layer will redirect to login
        reportCrash(DegradeCapability.AUTH, 'session-expired', {
          details: 'User session was valid but has expired. Please log in again.',
        });
      } else {
        logger
          .category("auth")
          .debug("Auth health check: user is not authenticated (intentional)");
      }
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
 * Reschedules itself for next check interval if app is still active.
 *
 * NOTE: Checks if kernel is still active (not reset to IDLE phase) before rescheduling
 * to prevent unbounded job chains after app reset or destruction.
 */
async function handleAuthHealthCheck(): Promise<{ nextCheckAt: number }> {
  await validateAuthHealth();

  // Bounds check: only reschedule if app kernel is still active
  // If kernel was reset (e.g., app destroyed, testing scenario), don't reschedule
  if (isKernelIdle()) {
    logger
      .category("auth")
      .debug("Auth health check not rescheduling - kernel is idle");
    return { nextCheckAt: 0 };
  }

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
