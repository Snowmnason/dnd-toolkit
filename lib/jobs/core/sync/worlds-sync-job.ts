/**
 * Worlds Sync Job
 *
 * Synchronizes user worlds and user-created data with server.
 *
 * Handles:
 * - Download: Fetch fresh connected worlds from database
 * - Upload: Push local world changes (future conflict resolution)
 *
 * Paired together because:
 * - User-created data (campaigns, characters, etc.) depends on world context
 * - Same sync timing for both makes sense
 * - Both represent user-owned content
 *
 * @module lib/jobs/core/sync/worlds-sync-job
 */

import { logger } from "@/lib/utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export type SyncDirection = "download" | "upload";
export type SyncMode = "automatic" | "manual";

/**
 * Result of worlds sync operation.
 */
export interface WorldsSyncResult {
  success: boolean;
  worldIds: string[];
  worldCount: number;
  errors: {
    phase: "worlds-fetch" | "worlds-push";
    message: string;
    error?: Error;
    worldId?: string;
  }[];
  durationMs: number;
}

// ============================================================================
// WORLDS SYNC JOB
// ============================================================================

/**
 * Synchronize user worlds and user-created data with server.
 *
 * @param mode 'automatic' (alert on conflicts) or 'manual' (user decides)
 * @param direction 'download' (fetch from server) or 'upload' (push to server)
 * @returns WorldsSyncResult with success status and any errors
 */
export async function performWorldsSync(
  mode: SyncMode,
  direction: SyncDirection = "download"
): Promise<WorldsSyncResult> {
  const startTime = Date.now();
  const result: WorldsSyncResult = {
    success: true,
    worldIds: [],
    worldCount: 0,
    errors: [],
    durationMs: 0,
  };

  try {
    logger
      .category("jobs")
      .debug(`Worlds sync starting [${mode}/${direction}]`);

    // ─── DOWNLOAD: Fetch worlds from server ──────────────────────────────
    if (direction === "download") {
      try {
        logger
          .category("jobs")
          .debug("Fetching connected worlds from database...");

        const { worldsDB } = await import("@/lib/database/worlds");
        const worlds = await worldsDB.getMyWorlds();

        result.worldIds = worlds.map((w) => w.world_id);
        result.worldCount = worlds.length;

        logger
          .category("jobs")
          .info(`Worlds sync: Found ${worlds.length} connected world(s)`);
      } catch (error) {
        result.errors.push({
          phase: "worlds-fetch",
          message:
            error instanceof Error ? error.message : "Failed to fetch worlds",
          error: error instanceof Error ? error : undefined,
        });
        logger
          .category("jobs")
          .warn("Failed to fetch worlds:", error);
      }

      // Future: Fetch user-created data per world (campaigns, characters, etc.)
      // This can be expanded later as needed
      logger
        .category("jobs")
        .debug("User-created data sync pending further implementation");
    }

    // ─── UPLOAD: Push worlds + data to server (future) ──────────────────
    if (direction === "upload") {
      // Future: Store local world + data changes and merge with server
      logger
        .category("jobs")
        .debug(
          "Worlds upload not yet implemented (future conflict resolution)"
        );
    }

    // ─── FINALIZE ───────────────────────────────────────────────────────
    result.durationMs = Date.now() - startTime;
    result.success = result.errors.length === 0;

    logger
      .category("jobs")
      .info(
        `Worlds sync completed (${result.durationMs}ms): ${result.success ? "SUCCESS" : "WITH ERRORS"}`
      );

    return result;
  } catch (error) {
    result.success = false;
    result.durationMs = Date.now() - startTime;
    result.errors.push({
      phase: "worlds-fetch",
      message: error instanceof Error ? error.message : "Worlds sync failed",
      error: error instanceof Error ? error : undefined,
    });

    logger
      .category("jobs")
      .error("Worlds sync failed:", error);

    return result;
  }
}
