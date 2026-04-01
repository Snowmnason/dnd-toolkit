/**
 * Phase 5: Job Setup Phase (NON-CRITICAL)
 *
 * Responsibility: Initialize background job queue INFRASTRUCTURE only
 * Called by: system/Kernel/app-kernel.ts
 *
 * Timing: ~20-50ms
 * Critical: NO — app can run without background jobs, but jobs won't execute
 * Failure mode: Logged as warning; does not block app startup
 *
 * Sets up storage adapters and initializes the queue singleton.
 * Handler registration is handled separately in registration-phase.ts.
 *
 * Must run:
 * - AFTER services-phase (needs initialized storage/SecureStorage)
 * - BEFORE auth-phase (auth may trigger sync jobs)
 * - BEFORE registration-phase (infrastructure must exist before handlers register)
 *
 * NOTE: Background jobs are non-critical; app boots without them
 */

/**
 * Execute job setup phase
 *
 * Initializes the background job queue with storage adapters.
 * Handler registration happens later in registration-phase.ts.
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

    // Create adapters and inject into queue singleton
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
  } catch (error) {
    const { logger } = await import("@/lib/utils");
    const { reportJobsBootstrapCrash } = await import(
      '@/system/Degrade/handlers/crash-handlers'
    );
    logger
      .category("bootstrap")
      .warn("Job setup phase warning (non-critical)", {
        error: (error as Error).message,
      });
    reportJobsBootstrapCrash(String(error));
    // Non-critical — app boots without background jobs
  }
}
