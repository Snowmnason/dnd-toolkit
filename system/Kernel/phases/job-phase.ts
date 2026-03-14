/**
 * Phase 6: Job Phase (NON-CRITICAL)
 *
 * Responsibility: Initialize background job queue infrastructure
 * Called by: system/Kernel/app-kernel.ts
 *
 * Timing: ~20-50ms (adapter setup only, no I/O)
 * Critical: NO — app can run without background jobs, but jobs won't execute
 * Failure mode: Logged as warning; does not block app startup
 *
 * Does:
 * 1. Create FastCacheAdapter (non-sensitive jobs)
 * 2. Create SecureStorageAdapter (sensitive jobs, PII, auth tokens)
 * 3. Inject adapters into job queue singleton
 * 4. Initialize queue
 *
 * Must run:
 * - AFTER services-phase (needs initialized storage/SecureStorage)
 * - BEFORE registration-phase (registration registers handlers with the queue)
 * - BEFORE auth-phase (auth may trigger sync jobs)
 *
 * NOTE: Background jobs are non-critical; app boots without them
 */

/**
 * Execute job phase
 *
 * Initializes the background job queue infrastructure with storage adapters.
 * After this phase, the queue singleton can accept handler registrations.
 */
export async function jobPhase(): Promise<void> {
  try {
    const { initializeJobInfrastructure } = await import(
      "@/lib/middleware/jobs/job-service"
    );

    await initializeJobInfrastructure();
  } catch (error) {
    const { logger } = await import("@/lib/utils");
    logger
      .category("bootstrap")
      .warn("Job infrastructure initialization warning (non-critical)", {
        error: (error as Error).message,
      });
    // Non-critical - app can still boot without background jobs
  }
}
