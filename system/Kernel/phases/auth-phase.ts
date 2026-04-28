/**
 * Phase 5: Auth Phase (BLOCKING)
 *
 * Responsibility:
 * 1. Evaluate data staleness (check LAST_LOGGED_IN timestamp age)
 * 2. If DEAD (> 30 days): Clear all storage and exit
 * 3. If FRESH (< 4 days): Load local auth state (skip expensive server check, token guaranteed valid)
 * 4. If STALE (4-30 days): Mark for re-auth (defer to sync-splash for centralized handling)
 *
 * Staleness Decision Logic:
 * - DEAD (> 30 days): Full storage clear, no session restore
 * - STALE (4-30 days): Mark sync required; sync-splash will call performReAuth during runtime
 * - FRESH (< 4 days): Load local state only (token definitely valid, 1-day safety buffer)
 *
 * Input: Storage initialization from Phase 3
 * Output: void (does not throw; failure is non-critical)
 *
 * Timing: 
 *   - FRESH: 10-50ms expected (no network call)
 *   - STALE: 10-50ms expected (just evaluation, no network call)
 *   - DEAD: <500ms (quick cleanup, no restore)
 * Critical: BLOCKING — Blocks appReady to prevent race conditions
 * Failure mode: Logged as warning; unauthenticated users redirected to login by useAuthGuard
 *
 * Deferred to Sync-Splash (Runtime):
 * - STALE re-auth (handled by sync-splash via performReAuth)
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
 * 2. If DEAD (> 30 days): Clears all storage, runs clearAuthState, exits
 * 3. If FRESH (< 4 days): Loads local auth state (skips expensive server check)
 * 4. If STALE (4-30 days): Marks sync required (defers re-auth to sync-splash)
 *
 * Non-critical: failures won't block app startup.
 * The orchestrator (app-kernel) marks authReady via runPhase.
 * STALE re-auth is handled by sync-splash at runtime for centralized control.
 */
export async function authPhase(signal: AbortSignal): Promise<void> {
  const { logger } = await import("@/lib/utils");

  if (signal.aborted) return;

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
                "@/middleware/storage"
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

            // Signal bootstrap freshness to web entry coordinator
            try {
              const { AuthStateManager } = await import("@/lib/auth/auth-state");
              AuthStateManager.setBootstrapFreshness('dead');
            } catch (err) {
              logger.category("bootstrap").warn("Failed to set bootstrap freshness:", err);
            }
            return; // Exit early - don't attempt to restore session
          }

          let isDataFresh = false;
          if (ageMs > STALE_THRESHOLD) {
            // STALE: 4-30 days - defer re-auth to sync-splash for centralized control
            logger.category("bootstrap").info(
              `Data is STALE (${(ageMs / 1000 / 60 / 60 / 24).toFixed(1)} days old) - marking sync required (deferred to sync-splash)`
            );
            try {
              const { AuthStateManager } = await import("@/lib/auth/auth-state");
              AuthStateManager.markSyncRequired();
              AuthStateManager.setBootstrapFreshness('stale');
              logger.category("bootstrap").debug("Marked sync required for STALE session");
            } catch (err) {
              logger.category("bootstrap").warn("Failed to mark sync required:", err);
            }
          } else {
            // FRESH: < 4 days - skip server re-auth (token definitely still valid, 1-day buffer before 5-day expiration)
            isDataFresh = true;
            logger.category("bootstrap").info(
              `Data is FRESH (${(ageMs / 1000 / 60 / 60).toFixed(1)} hours old) - loading local state`
            );

            // Signal bootstrap freshness to web entry coordinator
            try {
              const { AuthStateManager: ASM } = await import("@/lib/auth/auth-state");
              ASM.setBootstrapFreshness('fresh');
            } catch (err) {
              logger.category("bootstrap").warn("Failed to set bootstrap freshness:", err);
            }
          }

          // Load local state for FRESH sessions (STALE re-auth is deferred to sync-splash)
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

            // ─── Session Restoration for Web Persistence ───────────────────────
            // On web, token sessions don't persist across page reloads (JS context destroyed).
            // We restore the session using the stored refresh token via SessionAdapter.
            // This is a one-time call per bootstrap, necessary for web to work at all.
            try {
              const { getAuthProvider, getAuthProviderSync } = await import(
                "@/system/Services"
              );
              const { SessionAdapter } = await import(
                "@/system/Services/session-adapter"
              );

              // Only attempt restoration if auth provider is configured
              if (getAuthProviderSync()) {
                // Step 1: Retrieve saved session from encrypted storage
                const savedSession = await SessionAdapter.restoreSession();

                if (savedSession) {
                  // Step 2: Restore the saved session in the auth provider
                  const authProvider = await getAuthProvider();
                  const restored = await authProvider.restoreSession(
                    savedSession
                  );

                  if (restored) {
                    logger
                      .category("bootstrap")
                      .info("✅ Supabase session restored from refresh token");
                    // Access token is now in memory, ready for API calls
                  } else {
                    // Refresh token expired, invalid, or revoked
                    logger.category("bootstrap").warn(
                      "Session restoration failed (refresh token invalid/expired) - will re-auth on first route"
                    );
                    const { AuthStateManager } = await import(
                      "@/lib/auth/auth-state"
                    );
                    AuthStateManager.markSyncRequired();
                    // useSyncSplash will detect this and run full sync when appropriate
                  }
                } else {
                  // No saved session found in storage (never logged in, or cleared)
                  logger.category("bootstrap").debug(
                    "No persisted session found - user will need to log in"
                  );
                }
              }
            } catch (err) {
              logger.category("bootstrap").warn("Session restoration error:", {
                error: (err as Error).message,
              });
              // If restoration fails for any reason, mark sync as a safety measure
              try {
                const { AuthStateManager } = await import(
                  "@/lib/auth/auth-state"
                );
                AuthStateManager.markSyncRequired();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (_) {
                // Ignore if marking sync fails
              }
            }

            // ─── Background Token Refresh for FRESH Sessions ───────────
            // Since Supabase tokens expire after 5 days, we refresh proactively
            // if the session is >1 day old (within the 4-day FRESH window).
            // This ensures active users never hit token expiry.
            // Fire-and-forget: no await, no UI blocking, runs in background.
            const ONE_DAY_MS = 24 * 60 * 60 * 1000;
            const ageMs = Date.now() - parseInt(lastLoggedInStr, 10);
            if (ageMs > ONE_DAY_MS) {
              logger.category("bootstrap").debug(
                `Session is ${(ageMs / 1000 / 60 / 60).toFixed(1)} hours old - scheduling background token refresh`
              );
              // Fire and forget: refresh tokens in background without blocking UI
              backgroundRefreshToken().catch((err) => {
                logger.category("bootstrap").warn("Background token refresh failed:", err);
              });
            }

            // ─── Optional: Post-Bootstrap Full Sync ───────────────────────────
            // If you need to trigger a full sync right after bootstrap (e.g., force refresh,
            // cache validation failed, etc.), call:
            //   AuthStateManager.markPostBootstrapFullSync();
            // This will seamlessly transition Bootstrap → Sync splash with no UI flicker.
            // Example conditions:
            // - if (requiresFreshDataSync) { AuthStateManager.markPostBootstrapFullSync(); }
            // Note: useSyncSplash will detect this and run performFullSync automatically.
          }
        } else {
          // Timestamp is invalid (before 2020 or in future) - treat as cleared
          logger.category("bootstrap").debug(
            "Timestamp validation failed, treating as cleared session",
          );
          // Signal no valid session to web entry coordinator
          try {
            const { AuthStateManager: ASM } = await import("@/lib/auth/auth-state");
            ASM.setBootstrapFreshness('none');
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) { /* non-critical */ }
        }
      } else {
        // No valid timestamp - first time user or cleared cache
        logger
          .category("bootstrap")
          .debug("No previous login found, unauthenticated (will redirect to login)");
        // Signal no valid session to web entry coordinator
        try {
          const { AuthStateManager: ASM } = await import("@/lib/auth/auth-state");
          ASM.setBootstrapFreshness('none');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) { /* non-critical */ }
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

/**
 * Background token refresh for FRESH sessions
 *
 * Refreshes auth provider tokens in the background without blocking the UI.
 * Since tokens expire after 5 days, we refresh proactively if the session
 * is >1 day old (within the 4-day FRESH window) to ensure active users
 * never hit token expiry.
 *
 * Fire-and-forget: called without await, no impact on UI or startup time.
 * Failures are logged but don't propagate to caller.
 * Calls services directly (system layer, no middleware needed).
 */
async function backgroundRefreshToken(): Promise<void> {
  try {
    // Call services directly — we're in the kernel (system layer)
    const { getAuthProviderSync, getAuthProvider } = await import(
      "@/system/Services"
    );

    // Check if auth provider is configured (avoid unnecessary async call if not ready)
    if (!getAuthProviderSync()) {
      return; // Auth provider not configured (GH Pages, no env)
    }

    // Get auth provider and attempt token refresh
    const authProvider = await getAuthProvider();
    const refreshedSession = await authProvider.refreshSession();

    if (!refreshedSession) {
      // Refresh failed (network error, token rotated, etc.)
      // This is not fatal — the token still has days of validity left
      // If the token truly expires later, the next API call will trigger re-auth
      const { logger } = await import("@/lib/utils");
      logger
        .category("bootstrap")
        .debug(`Proactive token refresh deferred (will retry on next API call)`);
    } else {
      const { logger } = await import("@/lib/utils");
      logger.category("bootstrap").debug("✅ Proactive token refresh successful");
    }
  } catch (error) {
    // Guard against any unexpected errors during refresh
    const { logger } = await import("@/lib/utils");
    logger
      .category("bootstrap")
      .warn("Background token refresh error (non-fatal):", {
        error: (error as Error).message,
      });
  }
}
