/**
 * Profile Sync Job
 *
 * Synchronizes user profile + settings with server.
 *
 * Handles:
 * - Download: Fetch fresh profile + settings from database
 * - Upload: Push local profile + settings changes (future conflict resolution)
 *
 * Paired together because:
 * - User settings are owned database records (like profile)
 * - Both represent user identity + preferences
 * - Same sync timing makes sense (during login, re-auth, manual sync)
 *
 * @module lib/jobs/core/sync/profile-sync-job
 */

import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";

// ============================================================================
// TYPES
// ============================================================================

export type SyncDirection = "download" | "upload";
export type SyncMode = "automatic" | "manual";

/**
 * Result of profile sync operation.
 */
export interface ProfileSyncResult {
  success: boolean;
  userId?: string;
  userSettings?: {
    theme?: string;
    language?: string;
    timezone?: string;
    preferences?: Record<string, unknown>;
  };
  errors: {
    phase: "profile-fetch" | "settings-fetch" | "profile-push" | "settings-push";
    message: string;
    error?: Error;
  }[];
  durationMs: number;
}

// ============================================================================
// PROFILE SYNC JOB
// ============================================================================

/**
 * Synchronize user profile and settings with server.
 *
 * @param mode 'automatic' (alert on conflicts) or 'manual' (user decides)
 * @param direction 'download' (fetch from server) or 'upload' (push to server)
 * @returns ProfileSyncResult with success status and any errors
 */
export async function performProfileSync(
  mode: SyncMode,
  direction: SyncDirection = "download"
): Promise<ProfileSyncResult> {
  const startTime = Date.now();
  const result: ProfileSyncResult = {
    success: true,
    userId: undefined,
    userSettings: undefined,
    errors: [],
    durationMs: 0,
  };

  try {
    logger
      .category("auth")
      .debug(`Profile sync starting [${mode}/${direction}]`);

    // ─── DOWNLOAD: Fetch profile + settings from server ──────────────────
    if (direction === "download") {
      // Fetch fresh profile
      try {
        logger
.category("auth")
          .debug("Fetching user profile from database...");

        const { usersDB } = await import("@/lib/database/users");
        const user = await usersDB.getCurrentUser({ forceRefresh: true });

        if (!user) {
          result.errors.push({
            phase: "profile-fetch",
            message: "User profile not found after authentication",
          });
          logger.category("auth").warn("User profile not found");
        } else {
          result.userId = user.id;
          logger
            .category("jobs")
            .debug(`Profile fetched: ${user.id}`);
        }
      } catch (error) {
        result.errors.push({
          phase: "profile-fetch",
          message: error instanceof Error ? error.message : "Failed to fetch profile",
          error: error instanceof Error ? error : undefined,
        });
        logger
          .category("jobs")
          .warn("Failed to fetch profile:", error);
      }

      // Fetch fresh user settings
      try {
        logger
          .category("auth")
          .debug("Fetching user settings from database...");

        const { userSettingsDB } = await import("@/lib/database/user_settings");
        const userId = result.userId || await (
          await import("@/lib/auth/auth-state")
        ).AuthStateManager.getUserId();

        if (userId) {
          const settings = await userSettingsDB.fetchUserSettingsById(userId, { forceRefresh: true });
          if (settings) {
            result.userSettings = {
              theme: settings.theme,
              language: settings.language,
              timezone: settings.timezone,
              preferences: settings.preferences,
            };
            logger
              .category("jobs")
              .debug("User settings fetched", {
                theme: settings.theme,
                language: settings.language,
              });
          }
        }
      } catch (error) {
        result.errors.push({
          phase: "settings-fetch",
          message: error instanceof Error ? error.message : "Failed to fetch settings",
          error: error instanceof Error ? error : undefined,
        });
        logger
          .category("jobs")
          .warn("Failed to fetch settings:", error);
      }

      // Persist theme preference to storage (for ThemeProvider to read)
      if (result.userSettings?.theme && result.userSettings.theme !== "auto") {
        try {
          const { StorageManager } = await import("@/lib/storage");
          await StorageManager.set(STORAGE_KEYS.THEME_PREFERENCE, result.userSettings.theme);
          logger
            .category("jobs")
            .debug("Theme preference persisted", {
              theme: result.userSettings.theme,
            });
        } catch (error) {
          logger
            .category("jobs")
            .warn("Failed to persist theme preference:", error);
        }
      }
    }

    // ─── UPLOAD: Push profile + settings to server (future) ──────────────
    if (direction === "upload") {
      // Future: Store local profile + settings changes and merge with server
      logger
        .category("jobs")
        .debug(
          "Profile upload not yet implemented (future conflict resolution)"
        );
    }

    // ─── FINALIZE ───────────────────────────────────────────────────────
    result.durationMs = Date.now() - startTime;
    result.success = result.errors.length === 0;

    logger
      .category("auth")
      .info(
        `Profile sync completed (${result.durationMs}ms): ${result.success ? "SUCCESS" : "WITH ERRORS"}`
      );

    return result;
  } catch (error) {
    result.success = false;
    result.durationMs = Date.now() - startTime;
    result.errors.push({
      phase: "profile-fetch",
      message: error instanceof Error ? error.message : "Profile sync failed",
      error: error instanceof Error ? error : undefined,
    });

    logger
      .category("auth")
      .error("Profile sync failed:", error);

    return result;
  }
}
