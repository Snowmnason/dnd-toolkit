/**
 * Phase 6: Sync Phase (BLOCKING)
 *
 * Responsibility:
 * Initialize offline mutation queue and automatic synchronization manager.
 * Loads queued mutations from storage and prepares automatic sync on reconnect.
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
 *
 * Why blocking:
 * - If app starts while sync is in-progress, race conditions can occur
 * - User expects mutations to eventually sync; blocking ensures queue is ready
 * - Prevents duplicate mutations if app is restarted mid-sync
 *
 * Depends on: NETWORK_PHASE, STORAGE_PHASE (loads queue), SERVICES_PHASE (DB access)
 * Enables: Offline mutations work immediately when online, auto-sync on reconnect
 *
 * Used by: system/Kernel/app-kernel.ts (Phase 6, blocking)
 * Also: lib/offline/sync-manager, lib/offline/mutation-queue, lib/offline/sync-handlers
 */

/**
 * Execute sync phase
 *
 * Initializes offline mutation queue and automatic synchronization.
 * Blocking: failures won't prevent initialization, but must complete before appReady.
 * Runs as a post-ready background task.
 */
export async function offlinePhase(): Promise<void> {
  const { logger } = await import("@/lib/utils");

  try {
    const { OfflineQueueManager } = await import(
      "@/system/API/resilience/offline-queue"
    );
    const { initializeOfflineQueueReplay } = await import(
      "@/system/API/resilience/offline-queue-replay"
    );
    const { initializeSync } = await import("@/lib/kernel/kernel-manager");

    // Load persisted queue from storage
    await OfflineQueueManager.initialize();

    // Initialize OnlineSyncManager for syncing offline data to database
    await initializeSync();

    // Set up network listener for automatic replay on reconnect
    await initializeOfflineQueueReplay();

    logger.category("bootstrap").info("✅ Offline queue system initialized");
  } catch (error) {
    logger
      .category("bootstrap")
      .warn("Failed to initialize offline queue system (non-critical)", {
        error: (error as Error).message,
      });
    // Non-critical: app continues without offline queue
  }
}
