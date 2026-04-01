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
    const { degradeManager } = await import("@/system/Degrade");
    const { initializeConnectivityHandler } = await import("@/system/Degrade/handlers/connectivity-handler");
    const { CORE_JOBS } = await import("@/lib/jobs/registry");
    const { SUBSCRIPTIONS } = await import("@/lib/subscriptions/registry");
    const { getJobQueue } = await import("@/system/Jobs/background-job-queue");

    // Initialize connectivity handler (always-listening subscription)
    initializeConnectivityHandler();
    logger.category("bootstrap").debug("Connectivity handler initialized");

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
        // Mark background jobs as degraded if registrations fail
        degradeManager.set('backgroundJobs', false, {
          source: 'registration-phase',
          reason: `Job handler registration failed: ${job.name}`,
        });
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
        // Mark background jobs as degraded if subscriptions fail
        degradeManager.set('backgroundJobs', false, {
          source: 'registration-phase',
          reason: `Subscription activation failed: ${sub.name}`,
        });
      }
    }

    logger
      .category("bootstrap")
      .info(
        `✅ Subscriptions activated (${SUBSCRIPTIONS.length - subErrors.length}/${SUBSCRIPTIONS.length})`,
      );
  } catch (error) {
    const { degradeManager } = await import("@/system/Degrade");
    const errorMsg = (error as Error).message;
    logger
      .category("bootstrap")
      .warn("Registration phase warning (non-critical)", {
        error: errorMsg,
      });
    // Mark background jobs as degraded if phase fails
    degradeManager.set('backgroundJobs', false, {
      source: 'registration-phase',
      reason: `Registration phase failed: ${errorMsg}`,
    });
    // Non-critical — app boots without handlers/subscriptions
  }
}
