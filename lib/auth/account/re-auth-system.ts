/**
 * Re-Auth System
 *
 * Centralizes session restoration orchestration with DB sync + staleness evaluation.
 *
 * Flow:
 * 1. Restore session via auth provider using provided tokens
 * 2. Store session + metadata (HAS_ACCOUNT, LAST_LOGGED_IN timestamp)
 * 3. Call performDBSync() to sync profile + worlds + offline queue
 * 4. Evaluate data staleness (Fresh < 7d, Stale 7-30d, Dead > 30d)
 * 5. Determine redirect based on staleness phase + context
 *
 * Consolidated Entry Points:
 * - Bootstrap (app startup): context='bootstrap'
 * - Email confirmation link: context='email-link'
 * - OAuth exchange: context='oauth'
 * - Password reset: context='password-reset'
 *
 * Replaces 8+ direct restoreSession() calls with unified, orchestrated flow.
 *
 * Usage:
 *   const result = await performReAuth(
 *     { access_token: '...', refresh_token: '...' },
 *     'oauth'
 *   );
 *   if (result.success) {
 *     navigate(result.redirect);
 *   } else {
 *     if (result.stalenessPhase === 'dead') {
 *       navigate('/login');
 *     }
 *   }
 */

import { performDBSync } from '@/lib/database/sync/DB-sync';
import { determineEnterErrorRedirect, determineEnterRedirect } from '@/lib/navigation';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from '@/maps';
import { AuthStateManager } from '../auth-state';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context for re-auth operation (used for logging + redirect logic).
 */
export type ReAuthContext = 'bootstrap' | 'email-link' | 'oauth' | 'password-reset' | 'recovery';

/**
 * Result of attempted session restoration.
 */
export interface ReAuthResult {
  success: boolean;
  redirect?: string; // Where to navigate after restoration
  userId?: string;
  worldIds?: string[];
  stalenessPhase?: 'fresh' | 'stale' | 'dead'; // Data age phase
  errors?: ReAuthError[];
}

/**
 * Re-auth error with phase and context.
 */
export interface ReAuthError {
  phase: 'restore' | 'db-sync' | 'staleness' | 'redirect';
  message: string;
  error?: Error;
}

/**
 * Token set for session restoration.
 */
export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

// ============================================================================
// RE-AUTH SYSTEM
// ============================================================================

/**
 * Performs complete session restoration with DB sync + staleness evaluation.
 *
 * Steps:
 * 1. Restore session via auth provider using provided tokens
 * 2. Store session + HAS_ACCOUNT flag + LAST_LOGGED_IN timestamp
 * 3. Call performDBSync() to fetch profile, refresh worlds, drain offline queue
 * 4. Evaluate data staleness based on LAST_LOGGED_IN timestamp age
 * 5. Determine redirect based on staleness phase + context
 *
 * Staleness Phases:
 * - Fresh (< 7 days): Data is recent → Auto-restore silently
 * - Stale (7-30 days): Data is old but usable → Auto-restore, redirect to welcome screen
 * - Dead (> 30 days): Data is too old → Deny restore, require manual sign-in
 *
 * @param tokens - Authentication tokens { access_token, refresh_token? }
 * @param context - Calling context (used for logging + redirect determination)
 * @returns ReAuthResult with success status, redirect URL, staleness phase, and any errors
 *
 * @remarks
 * - Consolidates all direct restoreSession() calls (bootstrap, OAuth, email links, etc.)
 * - LAST_LOGGED_IN is set to Date.now() during DB sync
 * - Non-blocking on individual DB sync failures; continues with redirect based on staleness
 * - Staleness phase is determined by age of LAST_LOGGED_IN timestamp from DB sync result
 * - No UI feedback for staleness phases (silent redirects based on phase)
 *
 * @example
 * // Bootstrap recovery: check staleness
 * const result = await performReAuth({ access_token: '...' }, 'bootstrap');
 * if (result.stalenessPhase === 'dead') {
 *   navigate('/login'); // Require manual sign-in
 * } else if (result.stalenessPhase === 'stale') {
 *   navigate('/welcome'); // Show welcome screen
 * } else {
 *   navigate('/select/world-selection'); // Normal boot
 * }
 *
 * @example
 * // OAuth: proceed with redirect
 * const result = await performReAuth({ access_token: '...', refresh_token: '...' }, 'oauth');
 * if (result.success) {
 *   navigate(result.redirect);
 * }
 */
export async function performReAuth(
  tokens: AuthTokens,
  context: ReAuthContext = 'bootstrap'
): Promise<ReAuthResult> {
  const result: ReAuthResult = {
    success: true,
    errors: [],
  };

  logger.category('auth').info(`Re-auth: Starting [${context}] flow`);

  try {
    // =====================================================================
    // STEP 1: RESTORE SESSION
    // =====================================================================
    logger.category('auth').debug(`[${context}] Re-auth: Restoring session via auth provider`);

    let restored = false;
    try {
      if (!tokens.access_token) {
        throw new Error('access_token is required');
      }

      const { authRestoreSession } = await import('@/lib/middleware/services/auth-service');
      restored = await authRestoreSession(tokens);
    } catch (error) {
      result.success = false;
      result.errors?.push({
        phase: 'restore',
        message: error instanceof Error ? error.message : 'Session restoration failed',
        error: error instanceof Error ? error : undefined,
      });
      logger.category('auth').warn(`[${context}] Re-auth: Session restoration failed`, error);
      return result;
    }

    if (!restored) {
      result.success = false;
      result.errors?.push({
        phase: 'restore',
        message: 'Session restoration failed',
      });
      logger.category('auth').warn(`[${context}] Re-auth: Session restoration failed`);
      return result;
    }

    // =====================================================================
    // STEP 2: STORE SESSION + METADATA
    // =====================================================================
    logger.category('auth').debug(`[${context}] Re-auth: Storing session + metadata`);

    try {
      // Get userId from restored session
      const userId = await AuthStateManager.getUserId();
      if (!userId) {
        throw new Error('No userId available after restore');
      }

      // Set account flag
      const { StorageManager } = await import('@/lib/storage');
      await StorageManager.set(STORAGE_KEYS.HAS_ACCOUNT, true);

      result.userId = userId;
      logger.category('auth').info(`[${context}] Re-auth: Session stored for user ${result.userId}`);
    } catch (error) {
      result.success = false;
      result.errors?.push({
        phase: 'restore',
        message: 'Failed to store session',
        error: error instanceof Error ? error : undefined,
      });
      logger.category('auth').warn(`[${context}] Re-auth: Failed to store session`, error);
      return result;
    }

    // =====================================================================
    // STEP 3: PERFORM DB SYNC
    // =====================================================================
    logger.category('auth').debug(`[${context}] Re-auth: Performing centralized DB sync`);

    const dbSyncResult = await performDBSync('reauth');

    if (!dbSyncResult.success && dbSyncResult.errors && dbSyncResult.errors.length > 0) {
      // DB sync had errors, but allow re-auth to proceed
      for (const err of dbSyncResult.errors) {
        result.errors?.push({
          phase: 'db-sync',
          message: err.message,
          error: err.error,
        });
      }
      logger
        .category('auth')
        .warn(
          `[${context}] Re-auth: DB sync had ${dbSyncResult.errors.length} error(s), continuing...`
        );
    } else {
      logger.category('auth').info(`[${context}] Re-auth: DB sync completed successfully`);
    }

    // Copy world IDs from DB sync
    result.worldIds = dbSyncResult.worldIds || [];

    // =====================================================================
    // STEP 4: EVALUATE STALENESS PHASE
    // =====================================================================
    logger.category('auth').debug(`[${context}] Re-auth: Evaluating data staleness`);

    const stalenessPhase = dbSyncResult.stalenessPhase || 'fresh';
    result.stalenessPhase = stalenessPhase;

    logger.category('auth').info(`[${context}] Re-auth: Staleness phase = ${stalenessPhase}`);

    // =====================================================================
    // STEP 5: DETERMINE REDIRECT
    // =====================================================================
    logger.category('auth').debug(`[${context}] Re-auth: Determining redirect (staleness=${stalenessPhase})`);

    try {
      let user: any = null;
      if (context !== 'bootstrap') {
        // Non-bootstrap contexts need user profile for routing decision
        const { usersDB } = await import('@/lib/database');
        user = await usersDB.getCurrentUser();
      }

      const navDecision = determineEnterRedirect(
        'reauth',
        user,
        result.worldIds || [],
        stalenessPhase,
        context
      );
      result.redirect = navDecision.redirect;
      logger.category('auth').info(`[${context}] Re-auth: ${navDecision.reason}`);
    } catch (error) {
      const navDecision = determineEnterErrorRedirect('reauth');
      result.redirect = navDecision.redirect;
      result.errors?.push({
        phase: 'redirect',
        message: navDecision.reason,
        error: error instanceof Error ? error : undefined,
      });
      logger.category('auth').warn(`[${context}] Re-auth: Failed to determine redirect`, error);
    }

    logger.category('auth').info(
      `[${context}] Re-auth: Complete. Redirect: ${result.redirect}, Staleness: ${result.stalenessPhase}`
    );
    return result;
  } catch (error) {
    result.success = false;
    result.errors?.push({
      phase: 'restore',
      message: 'Unexpected error during re-auth',
      error: error instanceof Error ? error : undefined,
    });
    logger.category('auth').error(`[${context}] Re-auth: Unexpected error`, error);
    return result;
  }
}
