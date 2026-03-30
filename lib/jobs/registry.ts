/**
 * Job Handler Registry
 *
 * Explicit registry of all background job handlers for the app.
 * Each entry defines a job name and a lazy loader that returns the handler function.
 *
 * Used by registration-phase.ts to register all handlers with the job queue
 * after infrastructure (job-setup) and domain phases (auth, feature flags) are complete.
 *
 * To add a new job:
 * 1. Create the job in lib/jobs/core/
 * 2. Add an entry here with name + loader
 * 3. Done — registration phase auto-discovers it
 */

import type { BackgroundJobQueue } from "@/system/Jobs/background-job-queue";

/**
 * A registrable job handler entry.
 * - name: unique job type identifier (matches what's used in queue.enqueue())
 * - register: async function that registers the handler with the queue
 */
export interface JobRegistryEntry {
  name: string;
  register: (queue: BackgroundJobQueue) => Promise<void>;
}

/**
 * All core job handlers.
 * Order doesn't matter — all are registered during the same phase.
 */
export const CORE_JOBS: JobRegistryEntry[] = [
  {
    name: "sync-orchestrator",
    register: async (queue) => {
      const { createSyncJobHandler } = await import("@/lib/jobs");
      const syncHandler = createSyncJobHandler();
      queue.registerHandler(
        syncHandler.name,
        async (payload: any, _context: any) => {
          await syncHandler.execute(payload);
        },
      );
    },
  },
  {
    name: "network-recovery-retry",
    register: async (queue) => {
      const { NetworkRecoveryRetryJobManager } = await import(
        "@/lib/jobs/core/network-recovery-retry-job"
      );
      const { NetworkStateManager } = await import(
        "@/system/Network/state-machine"
      );
      await NetworkRecoveryRetryJobManager.initialize(NetworkStateManager, queue);
    },
  },
  {
    name: "storage-health-check",
    register: async (queue) => {
      const { registerStorageHealthCheckJob, validateStorageHealth } = await import(
        "@/lib/middleware/storage/helpers/storage-health-monitor"
      );
      // Run initial health check now that queue is ready
      await validateStorageHealth();
      // Register recurring job
      await registerStorageHealthCheckJob(queue);
    },
  },
  {
    name: "feature-flags-refresh",
    register: async (queue) => {
      const { refreshSubscription } = await import("@/lib/premium");
      const { logger } = await import("@/lib/utils");
      queue.registerHandler("feature_flags_refresh", async () => {
        await refreshSubscription();
        logger.category("jobs").info("feature_flags_refresh job completed");
        return { updatedAt: Date.now() };
      });
    },
  },
];
