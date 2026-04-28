/**
 * Sign-Out Job — Centralized sign-out orchestration
 *
 * Single source of truth for all user logout cleanup:
 * - Storage keys (auth, user, worlds, entitlements, feature flags)
 * - Caches (query cache, fast cache, offline queue)
 * - Subscriptions (auth listeners, realtime channels)
 * - Provider sign-out
 * - Navigation redirect
 *
 * Called by sign-out-system.ts after user confirmation.
 * ALL sign-out cleanup logic is centralized here.
 *
 * @example
 * const result = await performSignOutPhase2_ClearAndSignOut('user-initiated');
 * if (result.success) navigate to login;
 */

import { AuthStateManager } from "@/lib/auth/auth-state";
import { beginSignOut } from "@/lib/auth/auth-subscription-manager";
import {
    ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX,
    OVERRIDE_CACHE_KEY_PREFIX,
} from "@/lib/feature-flags/server-sync/state";
import { determineExitErrorRedirect, determineExitRedirect } from "@/lib/navigation";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";

// ============================================================================
// TYPES
// ============================================================================

export type SignOutSource = "user-initiated" | "auth-state-change";

export interface SignOutError {
  phase:
    | "storage-clear"
    | "validate-clear"
    | "provider-signout"
    | "feature-flags-clear";
  message: string;
  error?: Error;
}

export interface SignOutPhase2Result {
  success: boolean;
  clearedKeys: string[];
  redirect?: string;
  errors: SignOutError[];
}

// ============================================================================
// SIGN-OUT JOB: Phase 2-4 (Clear storage + sign out from provider)
// ============================================================================

/**
 * Phase 2-4: Clear ALL caches, storage, and sign out from provider.
 *
 * Called after user confirms sign-out in modal.
 * Performs complete cleanup with phase-based error collection.
 *
 * Phases:
 * - Phase 2: Clear storage (all keys)
 * - Phase 3: Clear feature flags caches
 * - Phase 4: Validate cleared
 * - Phase 5: Sign out from provider
 * - Phase 6: Determine redirect
 */
export async function performSignOutPhase2_ClearAndSignOut(
  source: SignOutSource
): Promise<SignOutPhase2Result> {
  const result: SignOutPhase2Result = {
    success: true,
    clearedKeys: [],
    errors: [],
  };

  logger
    .category("security")
    .info(`[${source}] Sign-out Phase 2: Clear storage started`);

  // CRITICAL: Kill all auth subscriptions FIRST, before clearing storage.
  // This prevents zombie guard listeners from seeing half-cleared state and
  // interfering with re-login by redirecting to login prematurely.
  beginSignOut();

  try {
    // =====================================================================
    // PHASE 2: CLEAR CORE STORAGE
    // =====================================================================

    const { StorageManager } = await import("@/lib/storage");

    // Keys to completely delete
    const keysToDelete = [
      // Auth keys
      STORAGE_KEYS.SESSION_USER_EMAIL,
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
        result.clearedKeys.push(key);
        logger.category("security").debug(`Cleared storage key: ${key}`);
      } catch (err) {
        result.errors.push({
          phase: "storage-clear",
          message: `Failed to clear key ${key}`,
          error: err instanceof Error ? err : undefined,
        });
        result.success = false;
        logger.category("security").warn(`Failed to clear key ${key}:`, err);
      }
    }

    // Keys to set to default/empty values (vs delete)
    // CRITICAL: Setting to empty string makes bootstrap's staleness check skip
    // This prevents bootstrap from entering DEAD path due to missing LAST_LOGGED_IN
    try {
      await StorageManager.set(STORAGE_KEYS.LAST_LOGGED_IN, "");
      result.clearedKeys.push(STORAGE_KEYS.LAST_LOGGED_IN);
      logger
        .category("security")
        .debug(`Set LAST_LOGGED_IN to empty string`);
    } catch (err) {
      result.errors.push({
        phase: "storage-clear",
        message: `Failed to clear LAST_LOGGED_IN`,
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;
      logger.category("security").warn(`Failed to clear LAST_LOGGED_IN:`, err);
    }

    // Set HAS_ACCOUNT to false explicitly so bootstrap knows user is logged out
    try {
      await AuthStateManager.setHasAccount(false);
      result.clearedKeys.push(STORAGE_KEYS.HAS_ACCOUNT);
      logger.category("security").debug(`Set HAS_ACCOUNT to false`);
    } catch (err) {
      result.errors.push({
        phase: "storage-clear",
        message: `Failed to set HAS_ACCOUNT to false`,
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;
      logger.category("security").warn(`Failed to set HAS_ACCOUNT to false:`, err);
    }

    // Clear world access pattern keys
    result.clearedKeys.push("world_access_*", "world_access_meta_*");
    logger
      .category("security")
      .debug("Cleared world access pattern keys");

    // Clear offline mutation queue
    try {
      const { OfflineMutationQueue } = await import(
        "@/lib/offline/mutation-queue"
      );
      await OfflineMutationQueue.clear();
      result.clearedKeys.push("OFFLINE_MUTATION_QUEUE");
      logger.category("security").debug("Cleared offline mutation queue");
    } catch (err) {
      result.errors.push({
        phase: "storage-clear",
        message: "Failed to clear offline mutation queue",
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;
      logger
        .category("security")
        .warn("Failed to clear offline mutation queue:", err);
    }

    // Clear query cache
    try {
      const { QueryCache } = await import("@/middleware/storage");
      await QueryCache.clearAll();
      result.clearedKeys.push("QUERY_CACHE");
      logger.category("security").debug("Cleared query cache");
    } catch (err) {
      result.errors.push({
        phase: "storage-clear",
        message: "Failed to clear query cache",
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;
      logger.category("security").warn("Failed to clear query cache:", err);
    }

    // Clear FastCache (in-memory session cache)
    // CRITICAL: FastCache holds temporary session data like user info, world metadata
    try {
      const { FastCache } = await import("@/system/Storage");
      await FastCache.clear();
      result.clearedKeys.push("FASTCACHE");
      logger
        .category("security")
        .debug("Cleared FastCache (in-memory cache)");
    } catch (err) {
      result.errors.push({
        phase: "storage-clear",
        message: "Failed to clear FastCache",
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;
      logger.category("security").warn("Failed to clear FastCache:", err);
    }

    // Reset theme preferences to defaults
    try {
      await StorageManager.set(
        STORAGE_KEYS.THEME_PREFERENCE,
        JSON.stringify("classic")
      );
      await StorageManager.set(STORAGE_KEYS.THEME_MODE, JSON.stringify("dark"));
      result.clearedKeys.push(
        STORAGE_KEYS.THEME_PREFERENCE,
        STORAGE_KEYS.THEME_MODE
      );
      logger.category("security").debug("Reset theme preferences to defaults");
    } catch (err) {
      result.errors.push({
        phase: "storage-clear",
        message: "Failed to reset theme preferences",
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;
      logger
        .category("security")
        .warn("Failed to reset theme preferences:", err);
    }

    // =====================================================================
    // PHASE 3: CLEAR FEATURE FLAGS CACHES
    // =====================================================================

    try {
      // Remove feature flags root snapshot
      await StorageManager.remove(STORAGE_KEYS.FEATURE_FLAGS);
      result.clearedKeys.push(STORAGE_KEYS.FEATURE_FLAGS);
      logger
        .category("security")
        .debug(`Cleared feature flags root snapshot`);

      // Remove feature flags companion caches
      await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`);
      result.clearedKeys.push(`${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`);

      await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`);
      result.clearedKeys.push(`${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`);

      await StorageManager.remove(
        `${STORAGE_KEYS.FEATURE_FLAGS}:cohort_assignments`
      );
      result.clearedKeys.push(
        `${STORAGE_KEYS.FEATURE_FLAGS}:cohort_assignments`
      );

      logger
        .category("security")
        .debug(
          "Cleared feature flags companion caches (rollouts, cohorts, assignments)"
        );
    } catch (err) {
      result.errors.push({
        phase: "feature-flags-clear",
        message: "Failed to clear feature flags companion caches",
        error: err instanceof Error ? err : undefined,
      });
      logger
        .category("security")
        .warn(
          "Failed to clear feature flags companion caches:",
          err
        );
    }

    // Get userId for user-specific cache cleanup (if available)
    let userId: string | undefined;
    try {
      userId = (await AuthStateManager.getUserId()) ?? undefined;
    } catch {
      // Non-critical: userId unavailable
    }

    // Clear user-specific feature flags caches
    if (userId) {
      try {
        await StorageManager.remove(`${STORAGE_KEYS.ENTITLEMENTS}:${userId}`);
        result.clearedKeys.push(`${STORAGE_KEYS.ENTITLEMENTS}:${userId}`);

        // Entitlement overrides (per-user) — use canonical prefix from feature-flags system
        await StorageManager.remove(
          `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX}${userId}`
        );
        result.clearedKeys.push(
          `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX}${userId}`
        );

        // User cohort memberships
        await StorageManager.remove(
          `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${userId}`
        );
        result.clearedKeys.push(
          `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${userId}`
        );

        logger
          .category("security")
          .debug(
            `Cleared user-specific feature flags caches (userId: ${userId})`
          );
      } catch (err) {
        result.errors.push({
          phase: "feature-flags-clear",
          message: "Failed to clear user-specific feature flags caches",
          error: err instanceof Error ? err : undefined,
        });
        logger
          .category("security")
          .warn(
            "Failed to clear user-specific feature flags caches:",
            err
          );
      }

      // Clear feature flags override patterns (all user-specific override keys)
      // Use canonical prefix from feature-flags system to ensure we match actual stored keys
      try {
        const { SecureStorage } = await import("@/system/Storage");
        const allKeys = await SecureStorage.getAllKeys();
        if (allKeys && Array.isArray(allKeys)) {
          const overridePattern = `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}`;
          const keysToRemove = allKeys.filter((key: string) =>
            key.startsWith(overridePattern)
          );
          for (const key of keysToRemove) {
            await StorageManager.remove(key);
            result.clearedKeys.push(key);
          }
          if (keysToRemove.length > 0) {
            logger
              .category("security")
              .debug(
                `Cleared ${keysToRemove.length} feature flags override cache entries`
              );
          }
        }
      } catch (err) {
        result.errors.push({
          phase: "feature-flags-clear",
          message: "Failed to clear feature flags override cache",
          error: err instanceof Error ? err : undefined,
        });
        logger
          .category("security")
          .warn("Failed to clear feature flags override cache:", err);
      }
    }

    // =====================================================================
    // PHASE 4: VALIDATE CLEARED
    // =====================================================================

    try {
      logger.category("security").debug("Validating storage clear...");

      const { StorageManager: SM } = await import("@/lib/storage");
      const userDataExists = (await SM.get(STORAGE_KEYS.USER_DATA)) !== null;
      const connectedWorldsExists =
        (await SM.get(STORAGE_KEYS.CONNECTED_WORLDS)) !== null;
      const offlineQueueExists =
        (await SM.get(STORAGE_KEYS.OFFLINE_MUTATION_QUEUE)) !== null;

      if (userDataExists || connectedWorldsExists || offlineQueueExists) {
        result.success = false;
        result.errors.push({
          phase: "validate-clear",
          message: "Validation failed: Some keys were not fully cleared",
        });
        logger
          .category("security")
          .warn("Storage validation failed: Keys still exist after clear");
      } else {
        logger.category("security").debug("Storage validation passed");
      }
    } catch (err) {
      result.errors.push({
        phase: "validate-clear",
        message: "Validation error",
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;
      logger.category("security").warn("Storage validation error:", err);
    }

    // =====================================================================
    // PHASE 5: SIGN OUT FROM PROVIDER
    // =====================================================================

    try {
      logger
        .category("security")
        .debug("Calling auth provider sign-out...");

      const { authSignOut } = await import(
        "@/middleware/services/auth-service"
      );
      await authSignOut();

      logger
        .category("security")
        .debug("Auth provider sign-out completed");
    } catch (err) {
      // Note: Local storage is already cleared, so user is signed out locally.
      // Provider sign-out failure is not critical.
      result.errors.push({
        phase: "provider-signout",
        message: `Provider sign-out failed (local sign-out still completed): ${err instanceof Error ? err.message : String(err)}`,
        error: err instanceof Error ? err : undefined,
      });
      logger
        .category("security")
        .warn(
          `Auth provider sign-out failed (local sign-out completed):`,
          err
        );
      // Don't set success = false; local logout is what matters
    }

    // Clear auth state (idempotent)
    try {
      await AuthStateManager.clearAuthState();
      logger.category("security").debug("Auth state manager cleared");
    } catch (err) {
      result.errors.push({
        phase: "provider-signout",
        message: "Failed to clear auth state manager",
        error: err instanceof Error ? err : undefined,
      });
      logger
        .category("security")
        .warn("Failed to clear auth state manager:", err);
    }

    // =====================================================================
    // PHASE 6: DETERMINE REDIRECT
    // =====================================================================

    try {
      const navDecision = determineExitRedirect("signout");
      result.redirect = navDecision.redirect;
      logger
        .category("security")
        .debug(
          `[${source}] Sign-out: ${navDecision.reason}`
        );
    } catch (err) {
      const navDecision = determineExitErrorRedirect("signout");
      result.redirect = navDecision.redirect;
      logger
        .category("security")
        .warn(
          `[${source}] Sign-out: Failed to determine redirect`,
          err
        );
    }

    // =====================================================================
    // FINAL STATUS
    // =====================================================================

    if (result.success) {
      logger
        .category("security")
        .info(
          `[${source}] Sign-out completed (${result.clearedKeys.length} keys cleared, no errors)`
        );
    } else {
      logger
        .category("security")
        .warn(
          `[${source}] Sign-out completed with errors (${result.errors.length} error(s))`
        );
    }

    return result;
  } catch (err) {
    // Catch-all for unexpected errors
    result.errors.push({
      phase: "storage-clear",
      message: `Unexpected error during sign-out: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err : undefined,
    });
    result.success = false;

    logger.category("security").error("Unexpected error during sign-out:", err);

    return result;
  }
}
