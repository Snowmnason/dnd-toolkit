/**
 * Phase 5: Registration Phase
 *
 * Responsibility: Register all background job handlers with the queue.
 * Called by: system/Kernel/app-kernel.ts
 *
 * Timing: ~5-20ms (handler registration only, no I/O)
 * Critical: NO — app can start without all handlers, but jobs won't execute
 * Failure mode: Logs warning; does not block app startup
 *
 * Does:
 * 1. Register sync-orchestrator job handler
 * 2. Initialize network-recovery-retry job manager (registers handler + state-machine listeners)
 *
 * Must run:
 * - AFTER services-phase (job infrastructure must be initialized)
 * - BEFORE auth-phase (auth may trigger sync/network-recovery jobs)
 */

/**
 * Execute registration phase
 *
 * Registers all long-lived background job handlers so the queue can
 * dispatch to them when jobs are dequeued.
 */
export async function registrationPhase(): Promise<void> {
  const { registerJobHandlers } = await import('@/lib/middleware/jobs/job-service');
  await registerJobHandlers();
}
