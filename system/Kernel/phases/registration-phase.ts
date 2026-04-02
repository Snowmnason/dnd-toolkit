/**
 * Phase 8: Registration Phase (NON-CRITICAL)
 *
 * Responsibility: Register all job handlers and activate all subscriptions
 * Called by: system/Kernel/app-kernel.ts
 *
 * Timing: ~30-100ms (handler registration + subscription activation)
 * Critical: NO — app can run without handlers/subscriptions, but background jobs won't execute
 * Failure mode: Individual failures logged as warnings; does not block app startup
 *
 * Iterates two explicit registries:
 * 1. CORE_JOBS (lib/jobs/registry.ts) — registers job handlers with the queue
 * 2. SUBSCRIPTIONS (lib/subscriptions/registry.ts) — activates long-lived listeners
 *
 * Must run:
 * - AFTER featureFlags-phase (jobs/subscriptions may depend on feature flags)
 * - AFTER jobSetup-phase (queue infrastructure must be initialized)
 * - BEFORE appReady (all handlers must be registered before UI triggers jobs)
 *
 * NOTE: Job queue infrastructure is initialized in job-setup-phase.
 *       This phase only registers handlers and activates subscriptions.
 */

import { logger } from "@/lib/utils";

/**
 * Execute registration phase
 *
 * Registers all job handlers from the explicit registry, then activates
 * all subscriptions. Each entry is independent — failures are logged
 * but don't block other registrations or app startup.
 */
export async function registrationPhase(): Promise<void> {
  try {
    const { initializeConnectivityHandler, appDegrade } = await import("@/system/Degrade");
    const { registerAllSystemResponses } = await import("@/system/Degrade/responses/system-responses");
    const { registerAllLibResponses } = await import("@/lib/error/degrade/lib-responses");
    const { registerDisplayCallbacks } = await import("@/lib/error/degrade/degrade-manager");
    const { setSafeMode } = await import("@/lib/kernel");
    const { createSafeModeState, SafeModeReason } = await import("@/lib/error");
    const { showDegradeToast } = await import("@/lib/utils/toast-queue");
    const { reportBackgroundJobsFault } = await import("@/system/Degrade/handlers/fault-handlers");
    const { registerCrashCallback } = await import("@/system/Degrade/handlers/crash-handlers");
    const { CORE_JOBS } = await import("@/lib/jobs/registry");
    const { SUBSCRIPTIONS } = await import("@/lib/subscriptions/registry");
    const { getJobQueue } = await import("@/system/Jobs/background-job-queue");

    // Initialize connectivity handler (always-listening subscription)
    initializeConnectivityHandler();
    logger.category("bootstrap").debug("Connectivity handler initialized");

    // Register system-level degradation responses (infrastructure: stop processes, pause queues)
    registerAllSystemResponses(appDegrade);
    logger.category("bootstrap").debug("System degradation responses registered");

    // Register UI display callbacks for degradation events
    registerDisplayCallbacks({
      showSafeMode: (capability, reason) => {
        try {
          // Map capability to appropriate SafeModeReason
          let safeModeReason = SafeModeReason.UNKNOWN;
          switch (capability) {
            case "database":
              safeModeReason = SafeModeReason.STORAGE_UNREADABLE;
              break;
            case "auth":
              safeModeReason = SafeModeReason.AUTH_INVALID;
              break;
            case "storage":
              safeModeReason = SafeModeReason.STORAGE_CORRUPTED;
              break;
            case "sync":
              safeModeReason = SafeModeReason.NETWORK_SYNC_FAILURES;
              break;
            case "connectivity":
              safeModeReason = SafeModeReason.NETWORK_UNAVAILABLE;
              break;
            default:
              safeModeReason = SafeModeReason.UNKNOWN;
          }

          const safeModeState = createSafeModeState(safeModeReason, {
            details: `${capability}: ${reason}`,
          });
          setSafeMode(safeModeState);
        } catch (error) {
          // Fallback if safe mode creation fails
          logger
            .category("bootstrap")
            .error("Failed to enter safe mode", { error, capability, reason });
        }
      },
      showToast: (options) => {
        try {
          showDegradeToast(options);
        } catch (error) {
          logger
            .category("bootstrap")
            .error("Failed to show toast", { error, options });
        }
      },
    });
    logger.category("bootstrap").debug("Display callbacks registered");

    // Register crash callback — bridges crash-handlers (system/) → safe mode (lib/)
    // 'safe-mode': trigger SafeModeScreen
    // 'error-boundary': no-op here — the phase re-throws, AppErrorBoundary catches it
    // 'continue': no-op — flag is set on appDegrade, app proceeds with degradation
    registerCrashCallback((notification) => {
      if (notification.suggestedAction === 'safe-mode') {
        try {
          let safeModeReason = SafeModeReason.UNKNOWN;
          switch (notification.capability) {
            case "database":
              safeModeReason = SafeModeReason.STORAGE_UNREADABLE;
              break;
            case "auth":
              safeModeReason = SafeModeReason.AUTH_INVALID;
              break;
            case "storage":
              safeModeReason = SafeModeReason.STORAGE_CORRUPTED;
              break;
            case "sync":
              safeModeReason = SafeModeReason.NETWORK_SYNC_FAILURES;
              break;
            case "connectivity":
              safeModeReason = SafeModeReason.NETWORK_UNAVAILABLE;
              break;
            default:
              safeModeReason = SafeModeReason.UNKNOWN;
          }
          const safeModeState = createSafeModeState(safeModeReason, {
            details: `${notification.capability}: ${notification.reason}`,
          });
          setSafeMode(safeModeState);
        } catch (error) {
          logger.category("bootstrap").error("Crash callback failed to enter safe mode", {
            error,
            capability: notification.capability,
            reason: notification.reason,
          });
        }
      }
      // 'error-boundary' and 'continue' are intentionally no-ops here
    });
    logger.category("bootstrap").debug("Crash callback registered");

    // Register lib-level degradation responses (UI decisions: feature gating, banners)
    registerAllLibResponses();
    logger.category("bootstrap").debug("Lib degradation responses registered");

    const queue = getJobQueue();
    const jobErrors: string[] = [];
    const subErrors: string[] = [];

    // Register all job handlers
    for (const job of CORE_JOBS) {
      try {
        await job.register(queue);
      } catch (error) {
        const errorMsg = (error as Error).message;
        jobErrors.push(`${job.name}: ${errorMsg}`);
        logger
          .category("bootstrap")
          .warn(`Job handler registration failed: ${job.name}`, {
            error: errorMsg,
          });
        reportBackgroundJobsFault(`Job handler registration failed: ${job.name}`);
      }
    }

    logger
      .category("bootstrap")
      .info(
        `✅ Job handlers registered (${CORE_JOBS.length - jobErrors.length}/${CORE_JOBS.length})`,
      );

    // Activate all subscriptions
    for (const sub of SUBSCRIPTIONS) {
      try {
        await sub.activate();
      } catch (error) {
        const errorMsg = (error as Error).message;
        subErrors.push(`${sub.name}: ${errorMsg}`);
        logger
          .category("bootstrap")
          .warn(`Subscription activation failed: ${sub.name}`, {
            error: errorMsg,
          });
        reportBackgroundJobsFault(`Subscription activation failed: ${sub.name}`);
      }
    }

    logger
      .category("bootstrap")
      .info(
        `✅ Subscriptions activated (${SUBSCRIPTIONS.length - subErrors.length}/${SUBSCRIPTIONS.length})`,
      );
  } catch (error) {
    const { reportBackgroundJobsFault } = await import("@/system/Degrade/handlers/fault-handlers");
    const errorMsg = (error as Error).message;
    logger
      .category("bootstrap")
      .warn("Registration phase warning (non-critical)", {
        error: errorMsg,
      });
    reportBackgroundJobsFault(`Registration phase failed: ${errorMsg}`);
    // Non-critical — app boots without handlers/subscriptions
  }
}
