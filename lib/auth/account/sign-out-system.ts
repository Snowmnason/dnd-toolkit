/**
 * Sign-Out System
 *
 * Centralized orchestration of complete user logout with ordered cleanup.
 *
 * Flow:
 * 1. DB Sync (BEFORE confirmation): Try to sync offline mutations. Returns to auth-manager.
 * 2. User Confirmation: Auth-manager shows modal. User confirms/cancels.
 * 3. If confirmed → Phase 2-4:
 *    - Clear Storage: Remove all auth/user/world/theme keys
 *    - Validate Cleared: Spot-check storage is empty
 *    - Sign Out from Provider: Call authSignOut() middleware
 *
 * Hook Registry: Available for future extensions at different phases.
 *
 * Usage:
 *   // Phase 1: Check if offline mutations can sync
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

import { performDBSync } from '@/lib/database/sync/DB-sync';
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
 * Hook phase identifier for future extensions.
 */
export type SignOutHookPhase = 'post-db-sync' | 'post-storage-clear' | 'post-provider-signout';

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

/**
 * Hook interface for participating in sign-out (for future extensions).
 *
 * Hooks are executed serially after specific phases.
 */
export interface ISignOutHook {
  /**
   * Name of the hook (for logging and deduplication).
   */
  name: string;

  /**
   * Phase after which to execute this hook.
   */
  phase: SignOutHookPhase;

  /**
   * Execution priority (higher = earlier). Defaults to 0.
   */
  priority?: number;

  /**
   * Async function to execute.
   */
  execute: () => Promise<void>;
}

// ============================================================================
// SIGN-OUT SYSTEM SINGLETON
// ============================================================================

/**
 * Manages sign-out orchestration with hook registry.
 */
class SignOutSystemImpl {
  /**
   * Hook registry: Map<phase, ISignOutHook[]>
   */
  private hooks: Map<SignOutHookPhase, ISignOutHook[]> = new Map([
    ['post-db-sync', []],
    ['post-storage-clear', []],
    ['post-provider-signout', []],
  ]);

  /**
   * Track registered hook names to prevent duplicates.
   */
  private registeredNames: Set<string> = new Set();

  /**
   * Register a sign-out hook for a specific phase.
   *
   * Hooks with the same name will not be registered twice (idempotent).
   *
   * @param hook The hook to register
   */
  registerSignOutHook(hook: ISignOutHook): void {
    if (!hook.name) {
      throw new Error('Hook name is required');
    }
    if (!hook.execute || typeof hook.execute !== 'function') {
      throw new Error(`Hook "${hook.name}" must have an execute function`);
    }

    const validPhases: SignOutHookPhase[] = ['post-db-sync', 'post-storage-clear', 'post-provider-signout'];
    if (!validPhases.includes(hook.phase)) {
      throw new Error(
        `Hook "${hook.name}" has invalid phase "${hook.phase}". Must be: ${validPhases.join(', ')}`
      );
    }

    if (this.registeredNames.has(hook.name)) {
      logger.category('security').debug(`Hook "${hook.name}" already registered, skipping`);
      return;
    }

    this.registeredNames.add(hook.name);
    const phaseHooks = this.hooks.get(hook.phase)!;
    phaseHooks.push(hook);

    // Sort by priority (descending) then insertion order
    phaseHooks.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA;
    });

    logger
      .category('security')
      .debug(`Registered sign-out hook: "${hook.name}" (phase=${hook.phase}, priority=${hook.priority ?? 0})`);
  }

  /**
   * PHASE 1: Try to sync offline mutations (BEFORE confirmation)
   *
   * Returns to auth-manager for user confirmation.
   * If this fails, user is asked: "Continue sign-out anyway?"
   *
   * @param source The source of the sign-out trigger
   * @returns Result with sync queue size and any errors
   */
  async performSignOutPhase1_DBSync(source: SignOutSource): Promise<SignOutPhase1Result> {
    const result: SignOutPhase1Result = {
      success: true,
      syncQueueSize: 0,
      errors: [],
    };

    logger.category('security').info(`[${source}] Sign-out Phase 1: DB Sync started`);

    try {
      // =====================================================================
      // PHASE 1a: PERFORM CENTRALIZED DB SYNC
      // =====================================================================
      // Sync user profile, worlds, offline queue, and update LAST_LOGGED_IN timestamp
      const dbSyncResult = await performDBSync('signout');

      if (!dbSyncResult.success && dbSyncResult.errors && dbSyncResult.errors.length > 0) {
        // DB sync failed; collect errors but continue
        for (const err of dbSyncResult.errors) {
          result.errors.push({
            phase: 'db-sync',
            message: err.message,
            error: err.error,
          });
        }
        result.success = false;
        logger
          .category('security')
          .warn(
            `[${source}] Phase 1a: DB sync had ${dbSyncResult.errors.length} error(s), continuing...`
          );
      } else {
        logger.category('security').info(`[${source}] Phase 1a: DB sync completed successfully`);
      }

      // =====================================================================
      // PHASE 1b: CHECK OFFLINE SYNC STATUS
      // =====================================================================
      // Lazy import OnlineSyncManager to sync offline mutations
      // TODO: In the future, we could have more granular control over which mutations to sync or a "fast sync" mode for sign-out to speed this up. For now, we just call syncAll().
      // TODO: We could also consider adding a timeout to the sync operation, so it doesn't block indefinitely 
      // if there are network issues. For now, we rely on the sync manager's internal handling of timeouts and errors.
      const { OnlineSyncManager } = await import('@/lib/offline/sync-manager');

      // Try to sync all queued mutations
      const syncStatus = await OnlineSyncManager.syncAll();

      result.syncQueueSize = syncStatus.totalQueued;

      if (!syncStatus.isSyncing && syncStatus.syncedCount === syncStatus.totalQueued) {
        // All synced successfully
        logger.category('security').info(`[${source}] Phase 1b: Synced ${syncStatus.syncedCount} mutations`);
      } else if (syncStatus.failedCount > 0) {
        // Some mutations failed
        result.success = false;
        result.errors.push({
          phase: 'db-sync',
          message: `Failed to sync ${syncStatus.failedCount} mutations. Data may be lost.`,
        });
        logger
          .category('security')
          .warn(`[${source}] Phase 1b: ${syncStatus.failedCount} mutations failed to sync`);
      }
    } catch (error) {
      // Network error or sync manager error
      result.success = false;
      result.errors.push({
        phase: 'db-sync',
        message: error instanceof Error ? error.message : 'DB sync failed',
        error: error instanceof Error ? error : undefined,
      });
      logger.category('security').warn(`[${source}] Phase 1: DB sync failed:`, error);
    }

    // Execute post-db-sync hooks
    await this.executeHooks('post-db-sync', result.errors, source);

    return result;
  }

  /**
   * PHASE 2-4: Clear storage and sign out from provider (AFTER confirmation)
   *
   * Called after user confirms sign-out in modal.
   *
   * @param source The source of the sign-out trigger
   * @returns Result with cleared keys and any errors
   */
  async performSignOutPhase2_ClearAndSignOut(source: SignOutSource): Promise<SignOutPhase2Result> {
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

      // Execute post-storage-clear hooks
      await this.executeHooks('post-storage-clear', result.errors, source);

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

      // Execute post-provider-signout hooks
      await this.executeHooks('post-provider-signout', result.errors, source);

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

  /**
   * Execute all hooks for a specific phase.
   * Hooks run serially; errors are caught and collected.
   *
   * @private
   * @param phase The phase to execute hooks for
   * @param errors Errors array to append to
   * @param source The sign-out source (for logging)
   */
  private async executeHooks(phase: SignOutHookPhase, errors: SignOutError[], source: SignOutSource): Promise<void> {
    const phaseHooks = this.hooks.get(phase) ?? [];

    if (phaseHooks.length === 0) {
      return;
    }

    logger.category('security').debug(`[${source}] Executing ${phaseHooks.length} hook(s) for phase: ${phase}`);

    for (const hook of phaseHooks) {
      try {
        logger.category('security').debug(`[${source}] Executing hook: "${hook.name}"`);
        await hook.execute();
        logger.category('security').debug(`[${source}] Hook "${hook.name}" completed`);
      } catch (err) {
        errors.push({
          phase: 'hook',
          message: `Hook "${hook.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err : undefined,
        });
        logger.category('security').warn(`[${source}] Hook "${hook.name}" failed:`, err);
        // Continue to next hook
      }
    }
  }
}

// ============================================================================
// SINGLETON EXPORT & PUBLIC API
// ============================================================================

const signOutSystem = new SignOutSystemImpl();

/**
 * Register a hook to participate in sign-out orchestration.
 *
 * @param hook The hook to register
 */
export function registerSignOutHook(hook: ISignOutHook): void {
  signOutSystem.registerSignOutHook(hook);
}

/**
 * PHASE 1: Attempt to sync offline mutations (BEFORE confirmation).
 *
 * Returns to auth-manager for user confirmation.
 * If sync fails, user is asked: "Continue sign-out anyway?"
 *
 * @param source The source of the sign-out trigger
 * @returns Promise<SignOutPhase1Result>
 */
export async function performSignOutPhase1_DBSync(source: SignOutSource): Promise<SignOutPhase1Result> {
  return signOutSystem.performSignOutPhase1_DBSync(source);
}

/**
 * PHASE 2-4: Clear storage and sign out from provider (AFTER confirmation).
 *
 * Called after user confirms sign-out in modal.
 *
 * @param source The source of the sign-out trigger
 * @returns Promise<SignOutPhase2Result>
 */
export async function performSignOutPhase2_ClearAndSignOut(source: SignOutSource): Promise<SignOutPhase2Result> {
  return signOutSystem.performSignOutPhase2_ClearAndSignOut(source);
}

/**
 * Get the hook registry (mainly for testing/debugging).
 *
 * @internal
 */
export function getSignOutHookRegistry(): Map<SignOutHookPhase, ISignOutHook[]> {
  return new Map(signOutSystem['hooks']);
}
