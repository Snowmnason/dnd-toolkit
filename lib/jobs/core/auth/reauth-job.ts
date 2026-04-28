/**
 * Re-Auth Job
 *
 * Standalone re-authentication job — restores session from tokens and performs
 * post-auth setup (HAS_ACCOUNT flag, sync required, redirect determination).
 *
 * Part of the sync orchestrator's full sync workflow. Called as Job #1 before
 * parallel data sync jobs.
 *
 * Flow:
 * 1. Restore session from tokens (via middleware)
 * 2. Get userId from restored session
 * 3. Call performPostAuthSetup (shared logic: HAS_ACCOUNT, sync required, redirect)
 * 4. Return structured result with redirect and userId
 *
 * Usage:
 *   const result = await performReAuthJob(tokens, 'bootstrap');
 *   if (result.success) {
 *     // Redirect user, then start parallel data sync
 *   }
 */

import { AuthStateManager } from '@/lib/auth/auth-state';
import { determineEnterErrorRedirect, determineEnterRedirect } from '@/lib/navigation';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from '@/maps';

// ============================================================================
// TYPES
// ============================================================================

export type ReAuthContext = 'bootstrap' | 'email-link' | 'oauth' | 'password-reset' | 'recovery';

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export interface ReAuthJobResult {
  success: boolean;
  redirect?: string;
  userId?: string;
  worldIds?: string[];
  errors?: ReAuthJobError[];
  durationMs: number;
}

export interface ReAuthJobError {
  phase: 'restore' | 'post-auth' | 'redirect';
  message: string;
  error?: Error;
}

// ============================================================================
// SHARED POST-AUTH SETUP (extracted from sign-in-system.ts, steps 2-4)
// ============================================================================

/**
 * Shared logic after session is established.
 *
 * Steps:
 * 1. Set HAS_ACCOUNT flag
 * 2. Mark sync required + update LAST_LOGGED_IN timestamp
 * 3. Determine redirect (profile-based or bootstrap-based)
 *
 * @param userId - Authenticated user ID
 * @param context - What triggered auth (drives redirect logic for bootstrap)
 */
async function performPostAuthSetup(
  userId: string,
  context: ReAuthContext
): Promise<{ redirect?: string; worldIds: string[]; errors: ReAuthJobError[] }> {
  const errors: ReAuthJobError[] = [];
  const worldIds: string[] = [];

  // =====================================================================
  // STEP 1: SET HAS_ACCOUNT FLAG
  // =====================================================================
  try {
    await AuthStateManager.setHasAccount(true);
    logger.category('auth').debug(`[${context}] Re-auth: HAS_ACCOUNT set`);
  } catch (error) {
    logger.category('auth').warn(`[${context}] Re-auth: Failed to set HAS_ACCOUNT`, error);
    // Non-blocking
  }

  // =====================================================================
  // STEP 2: MARK SYNC REQUIRED + UPDATE LAST_LOGGED_IN
  // =====================================================================
  AuthStateManager.markSyncRequired();
  logger.category('auth').debug(`[${context}] Re-auth: Sync required marked (will run post-appReady)`);

  try {
    const { StorageManager } = await import('@/lib/storage');
    await StorageManager.setRaw(STORAGE_KEYS.LAST_LOGGED_IN, Date.now().toString());
    logger.category('auth').debug(`[${context}] Re-auth: LAST_LOGGED_IN updated`);
  } catch (error) {
    logger.category('auth').warn(`[${context}] Re-auth: Failed to update LAST_LOGGED_IN`, error);
    // Non-blocking
  }

  // =====================================================================
  // STEP 3: DETERMINE REDIRECT (initial, before full sync)
  // Note: performFullSync will refresh this after all sync jobs complete
  // =====================================================================
  const redirectResult = await determinePostAuthRedirect(context);
  const redirect = redirectResult.redirect;
  errors.push(...redirectResult.errors);

  return { redirect, worldIds, errors };
}

/**
 * Determine redirect after sync completes (called by performFullSync).
 *
 * This is deferred until after all 4 sync jobs finish so redirect is based
 * on the latest synced data (profile state, pending invites, etc.).
 *
 * @param context - Re-auth context (bootstrap, email-link, oauth, etc.)
 * @returns redirect URL and any errors
 */
export async function determinePostAuthRedirect(
  context: ReAuthContext
): Promise<{ redirect?: string; errors: ReAuthJobError[] }> {
  const errors: ReAuthJobError[] = [];
  let redirect: string | undefined;

  try {
    if (context === 'bootstrap') {
      // Bootstrap: staleness-based routing — staleness was decided upstream in auth-phase.ts
      const navDecision = determineEnterRedirect('reauth', null, [], undefined, 'bootstrap');
      redirect = navDecision.redirect;
      logger.category('auth').info(`[${context}] Post-sync: ${navDecision.reason}`);
    } else {
      // All other contexts: profile-based routing + pending invite check
      const { usersDB } = await import('@/lib/database');
      const { StorageManager } = await import('@/lib/storage');

      const user = await usersDB.getCurrentUser();
      const profileCompleted = await StorageManager.get(STORAGE_KEYS.PROFILE_COMPLETED);

      const navDecision = determineEnterRedirect(
        'reauth',
        user,
        [],
        undefined,
        context,
        profileCompleted
      );

      // TODO: FixDuringAuthRefactor
      // Previously, when routing to world-selection with a pending invite, the user was
      // bounced through `/login/auth-redirect?action=world-invite&...` to show an invite
      // modal ("Accept later" | "Decline invite"). That dependency on auth-redirect has been
      // removed so the screen can be deleted. The pending invite remains in storage.
      // During the auth refactor, restore invite modal UX at the destination (world-selection
      // or a dedicated invite screen) using executeInternalRedirectNavigation via navManager.
      redirect = navDecision.redirect;
      logger.category('auth').info(`[${context}] Post-sync: ${navDecision.reason}`);
    }
  } catch (error) {
    const navDecision = determineEnterErrorRedirect('reauth');
    redirect = navDecision.redirect;
    errors.push({ phase: 'redirect', message: navDecision.reason, error: error instanceof Error ? error : undefined });
    logger.category('auth').warn(`[${context}] Post-sync: Failed to determine redirect`, error);
  }

  return { redirect, errors };
}

// ============================================================================
// RE-AUTH JOB
// ============================================================================

/**
 * Restore session from tokens and perform post-auth setup.
 *
 * This is Job #1 in the full sync workflow, run before parallel data sync jobs.
 *
 * @param tokens - Access token and optional refresh token
 * @param context - What triggered re-auth (drives redirect logic)
 * @returns Structured result with success, redirect, userId, and errors
 */
export async function performReAuthJob(
  tokens: AuthTokens,
  context: ReAuthContext = 'bootstrap'
): Promise<ReAuthJobResult> {
  const startTime = Date.now();
  const result: ReAuthJobResult = {
    success: true,
    errors: [],
    durationMs: 0,
  };

  logger.category('auth').info(`[${context}] Re-auth job: Starting [${context}] flow`);

  try {
    // ─────────────────────────────────────────────────────────────────────
    // PHASE 1: RESTORE SESSION FROM TOKENS
    // ─────────────────────────────────────────────────────────────────────
    let userId: string | undefined;

    try {
      if (!tokens.access_token) throw new Error('access_token is required');
      const { authRestoreSession } = await import('@/middleware/services/auth-service');
      const restored = await authRestoreSession(tokens);
      if (!restored) throw new Error('Session restoration failed');

      userId = await AuthStateManager.getUserId();
      if (!userId) throw new Error('No userId available after restore');

      result.userId = userId;
      logger.category('auth').info(`[${context}] Re-auth job: Session restored, userId=${userId}`);
    } catch (error) {
      result.success = false;
      result.errors?.push({
        phase: 'restore',
        message: error instanceof Error ? error.message : 'Session restoration failed',
        error: error instanceof Error ? error : undefined,
      });
      logger.category('auth').warn(`[${context}] Re-auth job: Session restoration failed`, error);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 2-4: SHARED POST-AUTH SETUP (HAS_ACCOUNT, sync required, redirect)
    // Note: performFullSync will refresh redirect after all sync jobs complete
    // ─────────────────────────────────────────────────────────────────────
    const setup = await performPostAuthSetup(userId, context);
    result.redirect = setup.redirect;
    result.worldIds = setup.worldIds;
    if (setup.errors.length > 0) result.errors?.push(...setup.errors);

    logger.category('auth').info(`[${context}] Re-auth job: Auth setup complete (redirect=${result.redirect}). Full sync will refresh this.`);
  } catch (error) {
    result.success = false;
    result.errors?.push({
      phase: 'restore',
      message: 'Unexpected error during re-auth',
      error: error instanceof Error ? error : undefined,
    });
    logger.category('auth').error(`[${context}] Re-auth job: Unexpected error`, error);
  }

  result.durationMs = Date.now() - startTime;
  return result;
}
