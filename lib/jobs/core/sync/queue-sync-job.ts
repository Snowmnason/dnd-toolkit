/**
 * Queue Sync Job
 *
 * Synchronizes offline mutation queue with server.
 *
 * Handles:
 * - Upload: Drain offline queue (push pending mutations to server)
 * - Download: Receive server responses / conflict notifications
 *
 * This is primarily an UPLOAD operation because:
 * - Offline queue contains pending changes the user made locally
 * - We need to push these to the server
 * - On conflict during sync, server resolves or returns conflict notification
 *
 * @module lib/jobs/core/sync/queue-sync-job
 */

import { logger } from "@/lib/utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export type SyncDirection = "download" | "upload";
export type SyncMode = "automatic" | "manual";

/**
 * Result of queue sync operation.
 */
export interface QueueSyncResult {
  success: boolean;
  totalQueued: number;
  syncedCount: number;
  failedCount: number;
  conflicts: {
    mutationId: string;
    table: string;
    reason: string;
  }[];
  errors: {
    phase: "queue-drain" | "conflict-resolve";
    message: string;
    error?: Error;
  }[];
  durationMs: number;
}

// ============================================================================
// QUEUE SYNC JOB
// ============================================================================

/**
 * Synchronize offline mutation queue with server.
 *
 * Primary use: UPLOAD (drain pending mutations)
 * Secondary use: DOWNLOAD (receive conflict notifications)
 *
 * @param mode 'automatic' (auto-resolve conflicts) or 'manual' (user decides)
 * @param direction 'download' (receive) or 'upload' (push pending mutations)
 * @returns QueueSyncResult with success status and any errors
 */
export async function performQueueSync(
  mode: SyncMode,
  direction: SyncDirection = "upload"
): Promise<QueueSyncResult> {
  const startTime = Date.now();
  const result: QueueSyncResult = {
    success: true,
    totalQueued: 0,
    syncedCount: 0,
    failedCount: 0,
    conflicts: [],
    errors: [],
    durationMs: 0,
  };

  try {
    logger
      .category("jobs")
      .debug(`Queue sync starting [${mode}/${direction}]`);

    // ─── UPLOAD: Drain offline queue (push pending mutations) ────────────
    if (direction === "upload") {
      try {
        logger
          .category("jobs")
          .debug("Draining offline mutation queue...");

        const { OnlineSyncManager } = await import("@/lib/offline/sync-manager");

        const syncStatus = await OnlineSyncManager.syncAll();

        result.totalQueued = syncStatus.totalQueued;
        result.syncedCount = syncStatus.syncedCount;
        result.failedCount = syncStatus.failedCount;

        logger
          .category("jobs")
          .info(
            `Queue sync: ${syncStatus.syncedCount}/${syncStatus.totalQueued} mutations synced`
          );

        if (syncStatus.failedCount > 0) {
          // Determine handling based on mode
          if (mode === "automatic") {
            // Alert user but continue (non-blocking)
            logger
              .category("jobs")
              .warn(
                `[AUTOMATIC] ${syncStatus.failedCount} mutations failed to sync - notifying user`
              );
            result.errors.push({
              phase: "queue-drain",
              message: `${syncStatus.failedCount} mutation(s) failed to sync. Changes will retry automatically.`,
            });
          } else {
            // Manual mode: user decides how to handle
            logger
              .category("jobs")
              .warn(
                `[MANUAL] ${syncStatus.failedCount} mutations failed to sync - user decision pending`
              );
            result.errors.push({
              phase: "queue-drain",
              message: `${syncStatus.failedCount} mutation(s) failed to sync. User action required.`,
            });
          }
          result.success = false;
        }
      } catch (error) {
        result.errors.push({
          phase: "queue-drain",
          message:
            error instanceof Error ? error.message : "Failed to drain queue",
          error: error instanceof Error ? error : undefined,
        });
        logger
          .category("jobs")
          .warn("Failed to drain offline queue:", error);
        result.success = false;
      }
    }

    // ─── DOWNLOAD: Receive conflict notifications (future) ──────────────
    if (direction === "download") {
      // Future: Fetch conflict notifications from server
      // When uploading failed, server sends back what changed
      // User then decides: keep local, accept server, or merge
      logger
        .category("jobs")
        .debug(
          "Queue download (conflict resolution) not yet implemented"
        );
    }

    // ─── FINALIZE ───────────────────────────────────────────────────────
    result.durationMs = Date.now() - startTime;

    logger
      .category("jobs")
      .info(
        `Queue sync completed (${result.durationMs}ms): ${result.success ? "SUCCESS" : "WITH ERRORS"}`
      );

    return result;
  } catch (error) {
    result.success = false;
    result.durationMs = Date.now() - startTime;
    result.errors.push({
      phase: "queue-drain",
      message: error instanceof Error ? error.message : "Queue sync failed",
      error: error instanceof Error ? error : undefined,
    });

    logger
      .category("jobs")
      .error("Queue sync failed:", error);

    return result;
  }
}
