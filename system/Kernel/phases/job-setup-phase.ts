/**
 * Phase 5: Job Setup Phase (NON-CRITICAL)
 *
 * Responsibility: Initialize background job queue infrastructure and register handlers
 * Called by: system/Kernel/app-kernel.ts
 *
 * Timing: ~25-70ms total
 * Critical: NO — app can run without background jobs, but jobs won't execute
 * Failure mode: Logged as warning; does not block app startup
 *
 * Two-step process inlined in this phase (not delegated to middleware):
 * 1. Create FastCacheAdapter + SecureStorageAdapter and inject into queue singleton — ~20-50ms
 * 2. Register all job handlers (sync-orchestrator, network-recovery-retry) — ~5-20ms
 *
 * Must run:
 * - AFTER services-phase (needs initialized storage/SecureStorage)
 * - BEFORE auth-phase (auth may trigger sync jobs)
 *
 * NOTE: Background jobs are non-critical; app boots without them
 */

/**
 * Execute job setup phase
 *
 * Initializes the background job queue with storage adapters, then
 * registers all handlers so the queue can dispatch when jobs are dequeued.
 */
export async function jobSetupPhase(): Promise<void> {
  try {
    const { logger } = await import("@/lib/utils");
    const { getJobQueue } = await import("@/system/Jobs/background-job-queue");
    const { FastCacheAdapter } = await import(
      "@/system/Jobs/adapters/fastcache-adapter"
    );
    const { SecureStorageAdapter } = await import(
      "@/system/Jobs/adapters/secure-storage-adapter"
    );

    // Step 1: Create adapters and inject into queue singleton
    const defaultAdapter = new FastCacheAdapter();
    const secureAdapter = new SecureStorageAdapter();
    const queue = getJobQueue({
      storageAdapter: defaultAdapter,
      secureAdapter,
    });
    await queue.initialize();
    logger
      .category("bootstrap")
      .info("✅ Job infrastructure initialized (fastcache + secure adapters)");

    // Step 2: Register all job handlers with the queue
    const { createSyncJobHandler } = await import("@/lib/jobs");
    const syncHandler = createSyncJobHandler();
    queue.registerHandler(syncHandler.name, (async (payload: any) => {
      await syncHandler.execute(payload);
    }) as any); // JobHandler expects (payload, context), but we only need payload

    // Network recovery — full init: registers handler + wires state-machine transition listeners
    const { NetworkRecoveryRetryJobManager } = await import(
      "@/lib/jobs/core/network-recovery-retry-job"
    );
    const { NetworkStateManager } = await import(
      "@/system/Network/state-machine"
    );
    await NetworkRecoveryRetryJobManager.initialize(NetworkStateManager, queue);

    logger
      .category("bootstrap")
      .info(
        "✅ Job handlers registered (sync-orchestrator, network-recovery-retry)",
      );

    // Register storage health check job (deferred from storage phase where queue wasn't initialized yet)
    // This includes both the initial health check and the recurring job registration
    const { registerStorageHealthCheckJob, validateStorageHealth } = await import(
      "@/lib/middleware/storage/helpers/storage-health-monitor"
    );
    
    // Run initial health check now that queue is ready
    await validateStorageHealth();
    
    // Register recurring job
    await registerStorageHealthCheckJob(queue);
  } catch (error) {
    const { logger } = await import("@/lib/utils");
    logger
      .category("bootstrap")
      .warn("Job setup phase warning (non-critical)", {
        error: (error as Error).message,
      });
    // Non-critical — app boots without background jobs
  }
}
