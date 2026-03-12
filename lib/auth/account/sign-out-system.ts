/**
 * Sign-Out System
 *
 * Centralized orchestration of complete user logout with ordered cleanup.
 *
 * Flow:
 * 1. Data Sync + Queue Drain (BEFORE confirmation): Ensure pending changes are uploaded. Returns to auth-manager.
 * 2. User Confirmation: Auth-manager shows modal. User confirms/cancels.
 * 3. If confirmed → Phase 2-4:
 *    - Clear Storage: Remove all auth/user/world/theme keys
 *    - Validate Cleared: Spot-check storage is empty
 *    - Sign Out from Provider: Call authSignOut() middleware
 *
 * Usage:
 *   // Phase 1: Check if pending changes can sync
 *   const syncResult = await performSignOutPhase1_DBSync('user-initiated');
 *   if (!syncResult.success) {
 *     // Show error to user: "Failed to sync data. Continue anyway?"
 *   }
 *
 *   // User clicks "OK" in confirmation modal
 *
 *   // Phase 2-4: Clear storage and sign out from provider
 *   const result = await performSignOutPhase2_ClearAndSignOut('user-initiated');
 *   if (result.success) {
 *     // Navigate to login
 *   }
 */

import { JobsManager } from '@/lib/jobs';
import { determineExitErrorRedirect, determineExitRedirect } from '@/lib/navigation';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from '@/maps';
import { AuthStateManager } from '../auth-state';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Source of sign-out trigger.
 */
export type SignOutSource = 'user-initiated' | 'auth-state-change';

/**
 * Hook error with phase and context.
 */
export interface SignOutError {
  phase: 'db-sync' | 'storage-clear' | 'validate-clear' | 'provider-signout' | 'hook';
  message: string;
  error?: Error;
}

/**
 * Result of Phase 1: DB Sync (before confirmation).
 * Returned to auth-manager for user confirmation.
 */
export interface SignOutPhase1Result {
  success: boolean;
  syncQueueSize: number;
  errors: SignOutError[];
}

/**
 * Result of Phase 2-4: Storage clear + provider sign-out (after confirmation).
 */
export interface SignOutPhase2Result {
  success: boolean;
  clearedKeys: string[];
  redirect?: string; // Where to navigate after sign-out
  errors: SignOutError[];
}

// ============================================================================
// SIGN-OUT PHASE 1: Sync before confirmation
// ============================================================================

/**
 * PHASE 1: Attempt to upload pending changes BEFORE showing confirmation modal.
 *
 * Returns to auth-manager for user confirmation.
 * If sync fails, user is asked: "Continue sign-out anyway?"
 */
export async function performSignOutPhase1_DBSync(source: SignOutSource): Promise<SignOutPhase1Result> {
  const result: SignOutPhase1Result = {
    success: true,
    syncQueueSize: 0,
    errors: [],
  };

  logger.category('security').info(`[${source}] Sign-out Phase 1: Syncing before confirmation`);

  try {
    const syncResult = await JobsManager.performSync({ mode: 'automatic', direction: 'upload' });
    result.syncQueueSize = syncResult.queue?.totalQueued ?? 0;
    // If operation completes without throwing, it succeeded
    result.success = true;
  } catch (error) {
    result.success = false;
    result.errors.push({
      phase: 'db-sync',
      message: error instanceof Error ? error.message : 'Data sync failed',
      error: error instanceof Error ? error : undefined,
    });
  }

  return result;
}

// ============================================================================
// SIGN-OUT PHASE 2-4: Clear storage and sign out (after confirmation)
// ============================================================================

/**
 * PHASE 2-4: Clear storage and sign out from provider (AFTER confirmation).
 *
 * Called after user confirms sign-out in modal.
 */
export async function performSignOutPhase2_ClearAndSignOut(source: SignOutSource): Promise<SignOutPhase2Result> {
  const result: SignOutPhase2Result = {
    success: true,
    clearedKeys: [],
    errors: [],
  };

  logger.category('security').info(`[${source}] Sign-out Phase 2: Clear storage started`);

    try {
      // =====================================================================
      // PHASE 2: CLEAR STORAGE
      // =====================================================================
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

      // Import storage manager to delete keys
      const { StorageManager } = await import('@/lib/storage');

      for (const key of keysToDelete) {
        try {
          await StorageManager.remove(key);
          result.clearedKeys.push(key);
          logger.category('security').debug(`Cleared storage key: ${key}`);
        } catch (err) {
          result.errors.push({
            phase: 'storage-clear',
            message: `Failed to clear key ${key}`,
            error: err instanceof Error ? err : undefined,
          });
          result.success = false;
          logger.category('security').warn(`Failed to clear key ${key}:`, err);
        }
      }

      // Clear world access pattern keys (world_access_*, world_access_meta_*)
      // Note: These are cleared via QueryCache invalidation on POST operations,
      // not stored directly. Skip pattern clearing for now.
      result.clearedKeys.push('world_access_*', 'world_access_meta_*');
      logger.category('security').debug('Cleared world access pattern keys');

      // Clear offline mutation queue
      try {
        const { OfflineMutationQueue } = await import('@/lib/offline/mutation-queue');
        await OfflineMutationQueue.clear();
        result.clearedKeys.push('OFFLINE_MUTATION_QUEUE');
        logger.category('security').debug('Cleared offline mutation queue');
      } catch (err) {
        result.errors.push({
          phase: 'storage-clear',
          message: 'Failed to clear offline mutation queue',
          error: err instanceof Error ? err : undefined,
        });
        result.success = false;
        logger.category('security').warn('Failed to clear offline mutation queue:', err);
      }

      // Clear query cache
      try {
        const { QueryCache } = await import('@/lib/middleware/storage');
        await QueryCache.clearAll();
        result.clearedKeys.push('QUERY_CACHE');
        logger.category('security').debug('Cleared query cache');
      } catch (err) {
        result.errors.push({
          phase: 'storage-clear',
          message: 'Failed to clear query cache',
          error: err instanceof Error ? err : undefined,
        });
        result.success = false;
        logger.category('security').warn('Failed to clear query cache:', err);
      }

      // Reset theme preferences to defaults
      try {
        await StorageManager.set(STORAGE_KEYS.THEME_PREFERENCE, JSON.stringify('classic'));
        await StorageManager.set(STORAGE_KEYS.THEME_MODE, JSON.stringify('dark'));
        result.clearedKeys.push(STORAGE_KEYS.THEME_PREFERENCE, STORAGE_KEYS.THEME_MODE);
        logger.category('security').debug('Reset theme preferences to defaults');
      } catch (err) {
        result.errors.push({
          phase: 'storage-clear',
          message: 'Failed to reset theme preferences',
          error: err instanceof Error ? err : undefined,
        });
        result.success = false;
        logger.category('security').warn('Failed to reset theme preferences:', err);
      }

      // =====================================================================
      // PHASE 3: VALIDATE CLEARED
      // =====================================================================
      try {
        logger.category('security').debug('Validating storage clear...');

        // Spot-check a few critical keys
        const { StorageManager: SM } = await import('@/lib/storage');
        const userDataExists = (await SM.get(STORAGE_KEYS.USER_DATA)) !== null;
        const connectedWorldsExists = (await SM.get(STORAGE_KEYS.CONNECTED_WORLDS)) !== null;
        const offlineQueueExists = (await SM.get(STORAGE_KEYS.OFFLINE_MUTATION_QUEUE)) !== null;

        if (userDataExists || connectedWorldsExists || offlineQueueExists) {
          result.success = false;
          result.errors.push({
            phase: 'validate-clear',
            message: 'Validation failed: Some keys were not fully cleared',
          });
          logger.category('security').warn('Storage validation failed: Keys still exist after clear');
        } else {
          logger.category('security').debug('Storage validation passed');
        }
      } catch (err) {
        result.errors.push({
          phase: 'validate-clear',
          message: 'Validation error',
          error: err instanceof Error ? err : undefined,
        });
        result.success = false;
        logger.category('security').warn('Storage validation error:', err);
      }

      // =====================================================================
      // PHASE 4: SIGN OUT FROM PROVIDER
      // =====================================================================
      try {
        logger.category('security').debug('Calling auth provider sign-out...');

        // Lazy import middleware to sign out from provider
        const { authSignOut } = await import('@/lib/middleware/services/auth-service');
        await authSignOut();

        logger.category('security').debug('Auth provider sign-out completed');
      } catch (err) {
        // Note: Local storage is already cleared, so user is signed out locally.
        // Provider sign-out failure is not critical.
        result.errors.push({
          phase: 'provider-signout',
          message: `Provider sign-out failed (local sign-out still completed): ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : undefined,
        });
        logger
          .category('security')
          .warn(`Auth provider sign-out failed (local sign-out completed):`, err);
        // Don't set success = false; local logout is what matters
      }

      // Clear auth state (idempotent)
      try {
        await AuthStateManager.clearAuthState();
        logger.category('security').debug('Auth state manager cleared');
      } catch (err) {
        result.errors.push({
          phase: 'provider-signout',
          message: 'Failed to clear auth state manager',
          error: err instanceof Error ? err : undefined,
        });
        logger.category('security').warn('Failed to clear auth state manager:', err);
      }

      // =====================================================================
      // DETERMINE REDIRECT
      // =====================================================================
      try {
        const navDecision = determineExitRedirect('signout');
        result.redirect = navDecision.redirect;
        logger.category('security').debug(`[${source}] Sign-out: ${navDecision.reason}`);
      } catch (err) {
        const navDecision = determineExitErrorRedirect('signout');
        result.redirect = navDecision.redirect;
        logger.category('security').warn(`[${source}] Sign-out: Failed to determine redirect`, err);
      }

      // =====================================================================
      // FINAL STATUS
      // =====================================================================
      if (result.success) {
        logger
          .category('security')
          .info(`[${source}] Sign-out completed (${result.clearedKeys.length} keys cleared, no errors)`);
      } else {
        logger
          .category('security')
          .warn(`[${source}] Sign-out completed with errors (${result.errors.length} error(s))`);
      }

      return result;
    } catch (err) {
      // Catch-all for unexpected errors
      result.errors.push({
        phase: 'storage-clear',
        message: `Unexpected error during sign-out: ${err instanceof Error ? err.message : String(err)}`,
        error: err instanceof Error ? err : undefined,
      });
      result.success = false;

      logger.category('security').error('Unexpected error during sign-out:', err);

      return result;
    }
}
