/**
 * Phase 5: Auth Phase (BLOCKING)
 *
 * Responsibility:
 * 1. Evaluate data staleness (check LAST_LOGGED_IN timestamp age)
 * 2. If DEAD (> 30 days): Clear all storage and exit
 * 3. If FRESH/STALE: Perform session re-auth + DB sync
 *
 * Staleness Decision Logic:
 * - DEAD (> 30 days): Full storage clear, no session restore
 * - STALE (7-30 days): Attempt restore, redirect shows welcome
 * - FRESH (< 7 days): Attempt restore, normal flow
 *
 * Input: Storage initialization from Phase 3
 * Output: void (does not throw; failure is non-critical)
 *
 * Timing: 50-500ms expected (includes DB sync if not dead)
 * Critical: BLOCKING — Blocks appReady to prevent race conditions
 * Failure mode: Logged as warning; app continues as guest
 *
 * Deferred to Runtime:
 * - Complete sign-out flow (handled by auth-manager)
 * - Auth health monitoring (background periodic checks)
 *
 * Depends on: STORAGE_PHASE (LAST_LOGGED_IN timestamp)
 * Enables: Correct auth state (authenticated or cleared)
 *
 * Used by: system/Kernel/app-kernel.ts (Phase 5, blocking)
 * Also: lib/auth/auth-manager, lib/auth/auth-state, hooks/auth
 */

/**
 * Execute auth phase
 *
 * 1. Evaluates LAST_LOGGED_IN timestamp to determine data staleness
 * 2. If DEAD (> 30 days): Clears all storage and exits
 * 3. If FRESH/STALE: Calls performReAuth to restore and sync
 *
 * Non-critical: failures won't block app startup.
 * The orchestrator (app-kernel) marks authReady via runPhase.
 */
export async function authPhase(): Promise<void> {
  const { logger } = await import("@/lib/utils");

  try {
    // ─── Evaluate Data Staleness (Early Decision) ───────────────────
    logger.category("bootstrap").debug("Checking data staleness...");

    try {
      const { StorageManager } = await import("@/lib/storage");
      const { STORAGE_KEYS } = await import("@/maps");

      const lastLoggedInStr = await StorageManager.getRaw(
        STORAGE_KEYS.LAST_LOGGED_IN
      );

      if (lastLoggedInStr) {
        const lastLoggedInMs = parseInt(lastLoggedInStr, 10);
        const ageMs = Date.now() - lastLoggedInMs;

        const STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
        const DEAD_THRESHOLD = 30 * 24 * 60 * 60 * 1000; // 30 days

        if (ageMs > DEAD_THRESHOLD) {
          // DEAD: > 30 days - clear all storage and exit
          logger.category("bootstrap").warn(
            `Data is DEAD (${(ageMs / 1000 / 60 / 60 / 24).toFixed(1)} days old) - clearing all storage`
          );

          const keysToDelete = [
            // Auth keys
            STORAGE_KEYS.HAS_ACCOUNT,
            STORAGE_KEYS.SESSION_USER_EMAIL,
            STORAGE_KEYS.LAST_LOGGED_IN,
            // User keys
            STORAGE_KEYS.USER_DATA,
            STORAGE_KEYS.CONNECTED_WORLDS,
            STORAGE_KEYS.CONNECTED_WORLDS_METADATA,
            // Entitlements
            STORAGE_KEYS.ENTITLEMENTS,
          ];

          for (const key of keysToDelete) {
            try {
              await StorageManager.remove(key);
              logger
                .category("bootstrap")
                .debug(`Cleared storage key: ${key}`);
            } catch (err) {
              logger
                .category("bootstrap")
                .warn(`Failed to clear key ${key}:`, err);
            }
          }

          // Clear offline mutation queue
          try {
            const { OfflineMutationQueue } = await import(
              "@/lib/offline/mutation-queue"
            );
            await OfflineMutationQueue.clear();
            logger.category("bootstrap").debug("Cleared offline mutation queue");
          } catch (err) {
            logger
              .category("bootstrap")
              .warn("Failed to clear offline mutation queue:", err);
          }

          // Clear query cache
          try {
            const { QueryCache } = await import(
              "@/lib/middleware/storage"
            );
            await QueryCache.clearAll();
            logger.category("bootstrap").debug("Cleared query cache");
          } catch (err) {
            logger
              .category("bootstrap")
              .warn("Failed to clear query cache:", err);
          }

          logger
            .category("bootstrap")
            .info("✅ All storage cleared (dead session > 30 days)");
          return; // Exit early - don't attempt to restore session
        }

        if (ageMs > STALE_THRESHOLD) {
          // STALE: 7-30 days - allow restore
          logger.category("bootstrap").info(
            `Data is STALE (${(ageMs / 1000 / 60 / 60 / 24).toFixed(1)} days old) - attempting restore`
          );
        } else {
          // FRESH: < 7 days - allow restore
          logger.category("bootstrap").info(
            `Data is FRESH (${(ageMs / 1000 / 60 / 60).toFixed(1)} hours old) - attempting restore`
          );
        }

        // Attempt re-auth for FRESH/STALE data
        const { SessionAdapter } = await import("@/system/Services");
        const sessionData = await SessionAdapter.restoreSession();

        if (sessionData) {
          try {
            const { performReAuth } = await import(
              "@/lib/auth/account/re-auth-system"
            );
            const reAuthResult = await performReAuth(sessionData, "bootstrap");

            if (reAuthResult.success) {
              logger
                .category("bootstrap")
                .info("✅ Session re-auth completed successfully");
            } else {
              logger
                .category("bootstrap")
                .warn("Session re-auth had errors, continuing as guest");
            }
          } catch (err) {
            logger
              .category("bootstrap")
              .warn("Failed to perform re-auth:", err);
          }
        } else {
          logger
            .category("bootstrap")
            .debug("No session data to restore, continuing as guest");
        }
      } else {
        // No timestamp - first time user
        logger
          .category("bootstrap")
          .debug("No previous login found, continuing as guest");
      }
    } catch (error) {
      logger.category("bootstrap").warn("Failed to evaluate staleness:", {
        error: (error as Error).message,
      });
      // Continue - staleness check failure is non-critical
    }
  } catch (error) {
    logger
      .category("bootstrap")
      .warn("Auth phase failed (non-critical)", {
        error: (error as Error).message,
      });
    // Don't throw — auth phase failure is non-critical
  }
}

