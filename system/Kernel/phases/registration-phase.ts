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
    const { CORE_JOBS } = await import("@/lib/jobs/registry");
    const { SUBSCRIPTIONS } = await import("@/lib/subscriptions/registry");
    const { getJobQueue } = await import("@/system/Jobs/background-job-queue");

    const queue = getJobQueue();
    const jobErrors: string[] = [];
    const subErrors: string[] = [];

    // Register all job handlers
    for (const job of CORE_JOBS) {
      try {
        await job.register(queue);
      } catch (error) {
        jobErrors.push(`${job.name}: ${(error as Error).message}`);
        logger
          .category("bootstrap")
          .warn(`Job handler registration failed: ${job.name}`, {
            error: (error as Error).message,
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
        subErrors.push(`${sub.name}: ${(error as Error).message}`);
        logger
          .category("bootstrap")
          .warn(`Subscription activation failed: ${sub.name}`, {
            error: (error as Error).message,
          });
      }
    }

    logger
      .category("bootstrap")
      .info(
        `✅ Subscriptions activated (${SUBSCRIPTIONS.length - subErrors.length}/${SUBSCRIPTIONS.length})`,
      );
  } catch (error) {
    logger
      .category("bootstrap")
      .warn("Registration phase warning (non-critical)", {
        error: (error as Error).message,
      });
    // Non-critical — app boots without handlers/subscriptions
  }
}
