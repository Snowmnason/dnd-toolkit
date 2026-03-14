/**
 * Sync Orchestrator
 *
 * Central coordination point for all data synchronization operations.
 *
 * Manages:
 * 1. Profile + Settings Sync
 * 2. Worlds + User-created Data Sync
 * 3. Offline Mutation Queue Sync
 *
 * Public API:
 * - performDataSync(mode, direction): Syncs all download/upload targets
 * - drainOfflineQueue(mode, direction): Syncs offline mutations only
 * - performDataSyncAll(mode): Download all + Upload all
 *
 * Built with job registration in mind:
 * - Each sync target is independently callable
 * - Handlers available for BackgroundJobQueue
 * - Can be registered as persistent jobs for retry/recovery
 *
 * Usage:
 * ```
 * // Re-auth: Get latest data from server
 * await performDataSync('automatic', 'download');
 * await drainOfflineQueue('automatic', 'upload');
 *
 * // Sign-out Phase 1: Ensure pending changes are uploaded before logout
 * await performDataSync('automatic', 'upload');
 * await drainOfflineQueue('automatic', 'upload');
 *
 * // Manual sync button: Full two-way sync
 * await performDataSync('manual', 'download');
 * await drainOfflineQueue('manual', 'upload');
 * ```
 *
 * @module lib/jobs/core/sync/sync-orchestrator
 */

import { logger } from "@/lib/utils/logger";
import {
    performProfileSync,
    ProfileSyncResult,
} from "./profile-sync-job";
import {
    performQueueSync,
    QueueSyncResult,
} from "./queue-sync-job";
import {
    performWorldsSync,
    WorldsSyncResult,
} from "./worlds-sync-job";

// ============================================================================
// TYPES
// ============================================================================

export type SyncDirection = "download" | "upload";
export type SyncMode = "automatic" | "manual";

/**
 * Combined result from data sync orchestration.
 */
export interface DataSyncResult {
  success: boolean;
  profile?: ProfileSyncResult;
  worlds?: WorldsSyncResult;
  errors: {
    target: "profile" | "worlds";
    message: string;
    error?: Error;
  }[];
  durationMs: number;
}

/**
 * Combined result from queue sync orchestration.
 */
export interface QueueDrainResult {
  success: boolean;
  queue?: QueueSyncResult;
  durationMs: number;
}

/**
 * Combined result from full sync (download all + upload all).
 */
export interface FullSyncResult {
  success: boolean;
  download?: DataSyncResult;
  upload?: DataSyncResult;
  drain?: QueueDrainResult;
  durationMs: number;
}

/**
 * Job handler signature for registration with BackgroundJobQueue.
 *
 * Allows sync jobs to be persisted, retried, and managed by the job system.
 */
export interface ISyncJobHandler {
  name: string;
  execute: (payload: {
    mode: SyncMode;
    direction?: SyncDirection;
    target?: "profile" | "worlds" | "queue";
  }) => Promise<void>;
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Perform data synchronization (profile + worlds).
 *
 * Calls profile and worlds sync jobs in sequence.
 * Short-circuits on critical errors.
 *
 * @param mode 'automatic' (alert on conflicts) or 'manual' (user decides)
 * @param direction 'download' (fetch from server) or 'upload' (push to server)
 * @returns Combined result from both sync targets
 */
export async function performDataSync(
  mode: SyncMode,
  direction: SyncDirection = "download"
): Promise<DataSyncResult> {
  const startTime = Date.now();
  const result: DataSyncResult = {
    success: true,
    profile: undefined,
    worlds: undefined,
    errors: [],
    durationMs: 0,
  };

  try {
    logger
      .category("auth")
      .info(`Data sync starting [${mode}/${direction}]`);

    // ─── SYNC PROFILE + SETTINGS ─────────────────────────────────────────
    try {
      result.profile = await performProfileSync(mode, direction);
      if (!result.profile.success) {
        result.success = false;
        result.profile.errors.forEach((err) => {
          result.errors.push({
            target: "profile",
            message: err.message,
            error: err.error,
          });
        });
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        target: "profile",
        message:
          error instanceof Error ? error.message : "Profile sync failed",
        error: error instanceof Error ? error : undefined,
      });
      logger
        .category("auth")
        .warn("Profile sync orchestration failed:", error);
    }

    // ─── SYNC WORLDS + USER-CREATED DATA ─────────────────────────────────
    try {
      result.worlds = await performWorldsSync(mode, direction);
      if (!result.worlds.success) {
        result.success = false;
        result.worlds.errors.forEach((err) => {
          result.errors.push({
            target: "worlds",
            message: err.message,
            error: err.error,
          });
        });
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        target: "worlds",
        message: error instanceof Error ? error.message : "Worlds sync failed",
        error: error instanceof Error ? error : undefined,
      });
      logger
        .category("auth")
        .warn("Worlds sync orchestration failed:", error);
    }

    // ─── FINALIZE ───────────────────────────────────────────────────────
    result.durationMs = Date.now() - startTime;

    logger
      .category("auth")
      .info(
        `Data sync completed (${result.durationMs}ms): ${result.success ? "SUCCESS" : "WITH ERRORS"}`
      );

    return result;
  } catch (error) {
    result.success = false;
    result.durationMs = Date.now() - startTime;
    result.errors.push({
      target: "profile",
      message:
        error instanceof Error ? error.message : "Data sync failed",
    });

    logger
      .category("auth")
      .error("Data sync orchestration failed:", error);

    return result;
  }
}

/**
 * Drain offline mutation queue.
 *
 * Pushes pending mutations to server and handles conflicts.
 *
 * @param mode 'automatic' (auto-resolve) or 'manual' (user decides)
 * @param direction 'upload' (push mutations) or 'download' (receive conflicts)
 * @returns Result from queue sync
 */
export async function drainOfflineQueue(
  mode: SyncMode,
  direction: SyncDirection = "upload"
): Promise<QueueDrainResult> {
  const startTime = Date.now();
  const result: QueueDrainResult = {
    success: true,
    queue: undefined,
    durationMs: 0,
  };

  try {
    logger
      .category("auth")
      .info(`Queue drain starting [${mode}/${direction}]`);

    result.queue = await performQueueSync(mode, direction);
    result.success = result.queue.success;

    result.durationMs = Date.now() - startTime;

    logger
      .category("auth")
      .info(
        `Queue drain completed (${result.durationMs}ms): ${result.success ? "SUCCESS" : "WITH ERRORS"}`
      );

    return result;
  } catch (error) {
    result.success = false;
    result.durationMs = Date.now() - startTime;

    logger
      .category("auth")
      .error("Queue drain orchestration failed:", error);

    return result;
  }
}

/**
 * Perform full synchronization (download all + upload all).
 *
 * Called by manual sync button to ensure bidirectional sync.
 *
 * @param mode 'automatic' (auto-resolve) or 'manual' (user decides)
 * @returns Combined result from all sync operations
 */
export async function performDataSyncAll(
  mode: SyncMode
): Promise<FullSyncResult> {
  const startTime = Date.now();
  const result: FullSyncResult = {
    success: true,
    download: undefined,
    upload: undefined,
    drain: undefined,
    durationMs: 0,
  };

  try {
    logger
      .category("auth")
      .info(`Full sync starting [${mode}]`);

    // ─── DOWNLOAD ALL ───────────────────────────────────────────────────
    result.download = await performDataSync(mode, "download");
    if (!result.download.success) {
      result.success = false;
    }

    // ─── UPLOAD ALL ──────────────────────────────────────────────────────
    result.upload = await performDataSync(mode, "upload");
    if (!result.upload.success) {
      result.success = false;
    }

    // ─── DRAIN OFFLINE QUEUE ────────────────────────────────────────────
    result.drain = await drainOfflineQueue(mode, "upload");
    if (!result.drain.success) {
      result.success = false;
    }

    // ─── FINALIZE ───────────────────────────────────────────────────────
    result.durationMs = Date.now() - startTime;

    logger
      .category("auth")
      .info(
        `Full sync completed (${result.durationMs}ms): ${result.success ? "SUCCESS" : "WITH ERRORS"}`
      );

    return result;
  } catch (error) {
    result.success = false;
    result.durationMs = Date.now() - startTime;

    logger
      .category("auth")
      .error("Full sync failed:", error);

    return result;
  }
}

// ============================================================================
// JOB HANDLERS (For Registration with BackgroundJobQueue)
// ============================================================================

/**
 * Execute the sync orchestrator logic. 
 * Called by auth systems directly for synchronous sync + by the job handler for queue execution.
 * 
 * @internal - logic is wrapped by createSyncJobHandler() for queue registration
 */
export async function executeSyncOperation(payload: {
  mode?: SyncMode;
  direction?: SyncDirection;
  target?: "profile" | "worlds" | "queue";
}): Promise<{ profile?: ProfileSyncResult; worlds?: WorldsSyncResult; queue?: QueueSyncResult }> {
  const { mode = "automatic", direction = "download", target } = payload;
  const results: any = {};

  if (target === "profile") {
    results.profile = await performProfileSync(mode, direction);
  } else if (target === "worlds") {
    results.worlds = await performWorldsSync(mode, direction);
  } else if (target === "queue") {
    results.queue = await performQueueSync(mode, direction);
  } else {
    // Default: run all
    results.profile = await performProfileSync(mode, direction);
    results.worlds = await performWorldsSync(mode, direction);
    results.queue = await performQueueSync(mode, direction);
  }

  return results;
}

/**
 * Creates a sync job handler for the background job queue.
 *
 * This handler can be registered with BackgroundJobQueue for:
 * - Automatic retry on network failure
 * - Crash resilience (job persists if app crashes)
 * - Exponential backoff scheduling
 *
 * @example
 * ```
 * const handler = createSyncJobHandler();
 * await BackgroundJobQueue.registerHandler(handler);
 * ```
 */
export function createSyncJobHandler(): ISyncJobHandler {
  return {
    name: "sync-orchestrator",
    execute: async (payload) => {
      // Execute the sync operation but discard results for queue execution
      // (queue handlers return void; auth systems call executeSyncOperation directly)
      await executeSyncOperation(payload as any);
    },
  };
}
