/**
 * Phase 5: Auth Phase (BLOCKING)
 *
 * Responsibility:
 * 1. Evaluate data staleness (check LAST_LOGGED_IN timestamp age)
 * 2. If DEAD (> 30 days): Clear all storage and exit
 * 3. If FRESH (< 4 days): Load local auth state (skip expensive server check, token guaranteed valid)
 * 4. If STALE (4-30 days): Perform server re-auth to verify token still valid
 *
 * Staleness Decision Logic:
 * - DEAD (> 30 days): Full storage clear, no session restore
 * - STALE (4-30 days): Perform server re-auth (token may have expired after Supabase 5-day limit)
 * - FRESH (< 4 days): Load local state only (token definitely valid, 1-day safety buffer)
 *
 * Input: Storage initialization from Phase 3
 * Output: void (does not throw; failure is non-critical)
 *
 * Timing: 
 *   - FRESH: 10-50ms expected (no network call)
 *   - STALE: 50-500ms expected (includes server re-auth)
 *   - DEAD: <500ms (quick cleanup, no restore)
 * Critical: BLOCKING — Blocks appReady to prevent race conditions
 * Failure mode: Logged as warning; unauthenticated users redirected to login by useAuthGuard
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
 * 3. If FRESH (< 4 days): Loads local auth state (skips expensive server check)
 * 4. If STALE (4-30 days): Calls performReAuth to verify token with server
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

      // Guard against empty, null, or non-numeric values
      // Valid values are timestamp strings like "1700000000000"
      // Invalid values (empty string, "0", null, etc.) mean "never logged in" or "cleared"
      const isValidTimestamp = lastLoggedInStr && 
        lastLoggedInStr.trim() && 
        /^\d+$/.test(lastLoggedInStr); // Only digits

      if (isValidTimestamp) {
        const lastLoggedInMs = parseInt(lastLoggedInStr, 10);
        
        // Additional safety: ensure timestamp is after 2020 and before now
        const REASONABLE_THRESHOLD = new Date('2020-01-01').getTime();
        if (lastLoggedInMs > REASONABLE_THRESHOLD && lastLoggedInMs <= Date.now()) {
          const ageMs = Date.now() - lastLoggedInMs;

          const STALE_THRESHOLD = 4 * 24 * 60 * 60 * 1000; // 4 days (1-day buffer before Supabase 5-day expiration)
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

          let isDataFresh = false;
          if (ageMs > STALE_THRESHOLD) {
            // STALE: 4-30 days - will attempt server re-auth to verify token still valid
            logger.category("bootstrap").info(
              `Data is STALE (${(ageMs / 1000 / 60 / 60 / 24).toFixed(1)} days old) - attempting server re-auth`
            );
          } else {
            // FRESH: < 4 days - skip server re-auth (token definitely still valid, 1-day buffer before 5-day expiration)
            isDataFresh = true;
            logger.category("bootstrap").info(
              `Data is FRESH (${(ageMs / 1000 / 60 / 60).toFixed(1)} hours old) - skipping server re-auth`
            );
          }

          // Attempt re-auth only for STALE data (server check); FRESH data skips network
          if (isDataFresh) {
            // FRESH: Load local auth state, skip expensive server check
            try {
              const { AuthStateManager } = await import("@/lib/auth/auth-state");
              const userId = await AuthStateManager.getUserId();
              if (userId) {
                logger
                  .category("bootstrap")
                  .info("✅ Fresh session loaded from local state");
              } else {
                logger
                  .category("bootstrap")
                  .debug("Fresh session found but no userId in local state");
              }
            } catch (err) {
              logger
                .category("bootstrap")
                .warn("Failed to load fresh session state:", err);
            }
          } else {
            // STALE: Perform server re-auth to verify token is still valid
            const { SessionAdapter } = await import("@/system/Services");
            const sessionData = await SessionAdapter.restoreSession();

            if (sessionData) {
              try {
                const { performReAuth } = await import(
                  "@/lib/auth/account/sign-in-system"
                );
                const reAuthResult = await performReAuth(sessionData, "bootstrap");

                if (reAuthResult.success) {
                  logger
                    .category("bootstrap")
                    .info("✅ Stale session re-auth completed successfully");
                } else {
                  logger
                    .category("bootstrap")
                    .warn("Stale session re-auth had errors, unauthenticated (will redirect to login)");
                }
              } catch (err) {
                logger
                  .category("bootstrap")
                  .warn("Failed to perform stale session re-auth:", err);
              }
            } else {
              logger
                .category("bootstrap")
                .debug("No session data to restore, unauthenticated (will redirect to login)");
            }
          }
        } else {
          // Timestamp is invalid (before 2020 or in future) - treat as cleared
          logger.category("bootstrap").debug(
            "Timestamp validation failed, treating as cleared session",
          );
        }
      } else {
        // No valid timestamp - first time user or cleared cache
        logger
          .category("bootstrap")
          .debug("No previous login found, unauthenticated (will redirect to login)");
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
