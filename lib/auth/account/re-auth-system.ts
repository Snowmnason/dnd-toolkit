/**
 * Re-Auth System
 *
 * Centralizes session restoration with data sync + offline queue drain.
 *
 * Flow:
 * 1. Restore session via auth provider using provided tokens
 * 2. Store session + metadata (HAS_ACCOUNT, LAST_LOGGED_IN timestamp)
 * 3. Sync data (profile + worlds, download from server)
 * 4. Drain offline mutation queue (upload pending changes)
 * 5. Determine redirect based on profile (not staleness)
 *
 * NOTE: Staleness evaluation happens EARLY in kernel auth-phase (not here).
 * This system is purely for restoring session + syncing data after login commitment.
 *
 * Entry Points:
 * - Email confirmation link: context='email-link'
 * - OAuth exchange: context='oauth'
 * - Password reset: context='password-reset'
 * - Manual sign-in: context='recovery'
 * - Bootstrap auto-login: context='bootstrap'
 *
 * Replaces direct restoreSession() calls with unified, orchestrated sync flow.
 *
 * Usage:
 *   const result = await performReAuth(
 *     { access_token: '...', refresh_token: '...' },
 *     'oauth'
 *   );
 *   if (result.success) {
 *     navigate(result.redirect);
 *   } else {
 *     show error toast;
 *   }
 */

import { JobsManager } from '@/lib/jobs';
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
  errors?: ReAuthError[];
}

/**
 * Re-auth error with phase and context.
 */
export interface ReAuthError {
  phase: 'restore' | 'db-sync' | 'redirect';
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
 * Performs complete session restoration with DB sync + offline queue drain.
 *
 * Steps:
 * 1. Restore session via auth provider using provided tokens
 * 2. Store session + HAS_ACCOUNT flag + LAST_LOGGED_IN timestamp
 * 3. Sync database (fetch profile, refresh worlds, drain offline queue)
 * 4. Determine redirect based on profile completeness
 *
 * @param tokens - Authentication tokens { access_token, refresh_token? }
 * @param context - Calling context (used for logging + redirect determination)
 * @returns ReAuthResult with success status, redirect URL, and any errors
 *
 * @remarks
 * - Staleness evaluation happens early in bootstrap auth-phase (not here)
 * - This is purely a data sync mechanism called after login commitment
 * - LAST_LOGGED_IN is updated to Date.now() (sets data to fresh)
 * - Non-blocking on individual DB sync failures; continues with redirect
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
    // STEP 3: SYNC DATA (via JobsManager orchestration)
    // =====================================================================
    const syncResult = await JobsManager.performSync({ mode: 'automatic', direction: 'download' });
    result.worldIds = syncResult.worlds?.worldIds || [];

    // =====================================================================
    // STEP 4: DETERMINE REDIRECT
    // =====================================================================
    // NOTE: For bootstrap context, staleness phase comes from evaluateStalenessPhase()
    // which is called EARLY in bootstrap (before this re-auth flow).
    // performDBSync() only updates LAST_LOGGED_IN; it doesn't evaluate staleness.
    logger.category('auth').debug(`[${context}] Re-auth: Determining redirect`);

    try {
      let user: any = null;
      if (context !== 'bootstrap') {
        // Non-bootstrap contexts need user profile for routing decision
        const { usersDB } = await import('@/lib/database');
        user = await usersDB.getCurrentUser();
      }

      // For bootstrap, staleness phase would be passed separately if needed
      // For non-bootstrap (oauth, email-link, password-reset), use profile-based routing
      const navDecision = determineEnterRedirect(
        'reauth',
        user,
        result.worldIds || [],
        undefined, // No staleness phase here - it's determined early in bootstrap
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
      `[${context}] Re-auth: Complete. Redirect: ${result.redirect}`
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
