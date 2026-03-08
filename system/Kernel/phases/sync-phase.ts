/**
 * Phase 6: Sync Phase (BLOCKING)
 *
 * Responsibility:
 * Initialize all async queue systems:
 * 1. Offline mutation queue + sync manager (persisted DB mutations)
 * 2. Background job queue + all job handlers (persisted background jobs)
 *
 * Input: Network status from Phase 2, Storage from Phase 3, Services from Phase 4
 * Output: void (does not throw; failure is non-critical)
 *
 * Timing: 100-300ms expected, max 1000ms timeout
 * Critical: BLOCKING — Blocks appReady to prevent read/write race conditions
 * Failure mode: Logged as warning; app continues without offline queue sync
 *
 * What gets initialized:
 * - OfflineMutationQueue (loads persisted mutations from SecureStorage)
 * - OnlineSyncManager (subscribes to network, auto-syncs when online)
 * - Sync handlers registry (maps table names to sync functions)
 * - Network cascade detector (tracks sync failures for safe mode)
 * - Conflict queue (tracks conflicts during sync attempts)
 * - Backoff scheduler (schedules retries with exponential backoff + jitter)
 * - BackgroundJobQueue singleton (loads persisted jobs, subscribes to network)
 * - Job handlers: network_recovery_retry (registered via NetworkRecoveryRetryJobManager)
 *
 * Why blocking:
 * - If app starts while sync is in-progress, race conditions can occur
 * - User expects mutations to eventually sync; blocking ensures queue is ready
 * - Prevents duplicate mutations if app is restarted mid-sync
 * - Job handlers must be registered before the queue fires on reconnect,
 *   otherwise persisted jobs fail with "No handler registered"
 *
 * Depends on: NETWORK_PHASE, STORAGE_PHASE (loads queue), SERVICES_PHASE (DB access)
 * Enables: Offline mutations work immediately when online, auto-sync on reconnect
 *
 * Used by: system/Kernel/app-kernel.ts (Phase 6, blocking)
 * Also: lib/offline/sync-manager, lib/offline/mutation-queue, lib/offline/sync-handlers
 *       lib/jobs, system/Jobs/background-job-queue
 */

/**
 * Execute sync phase
 *
 * Initializes offline mutation queue and automatic synchronization.
 * BLOCKING: Must complete before appReady to prevent read/write race conditions.
 * Failures are non-critical (logged as warning) and don't prevent initialization.
 */
export async function syncPhase(): Promise<void> {
  const { logger } = await import("@/lib/utils");

  // ── Offline Mutation Queue ──────────────────────────────────────────────
  try {
    const { OfflineQueueManager } = await import(
      "@/system/API/resilience/offline-queue"
    );
    const { initializeOfflineQueueReplay } = await import(
      "@/system/API/resilience/offline-queue-replay"
    );
    const { initializeSync } = await import("@/lib/kernel/kernel-manager");

    await OfflineQueueManager.initialize();
    await initializeSync();
    await initializeOfflineQueueReplay();

    logger.category("bootstrap").info("✅ Offline queue system initialized");
  } catch (error) {
    logger
      .category("bootstrap")
      .warn("Failed to initialize offline queue system (non-critical)", {
        error: (error as Error).message,
      });
  }

  // ── Background Job Queue ────────────────────────────────────────────────
  // Must register all handlers BEFORE the queue can fire on network reconnect.
  // Persisted jobs from a previous session must resolve to a registered handler.
  try {
    const { initializeJobInfrastructure } = await import("@/lib/middleware/jobs/job-service");
    const { getJobQueue, NetworkRecoveryRetryJobManager } = await import("@/lib/jobs");
    const { NetworkStateManager } = await import("@/system/Network/state-machine");

    await initializeJobInfrastructure();

    const queue = getJobQueue();
    await NetworkRecoveryRetryJobManager.initialize(NetworkStateManager, queue);

    logger.category("bootstrap").info("✅ Background job queue initialized");
  } catch (error) {
    logger
      .category("bootstrap")
      .warn("Failed to initialize background job queue (non-critical)", {
        error: (error as Error).message,
      });
  }
}
