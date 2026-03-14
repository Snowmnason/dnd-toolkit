/**
 * Sign-In System
 *
 * Unified auth entry system — handles all forms of session establishment:
 * - Email/password sign-in (user-triggered)
 * - Token restore / re-auth (bootstrap, email-link, oauth, password-reset)
 * - Native ID token sign-in (Google, Apple)
 *
 * All three share the same post-auth setup (Steps 2-4). Only Step 1 differs.
 *
 * Flow:
 * 1. Establish session (varies by entry point)
 * 2. Store HAS_ACCOUNT flag
 * 3. Sync data (profile + worlds) + update LAST_LOGGED_IN timestamp
 * 4. Determine redirect based on profile completeness + context
 *
 * Entry points:
 *   performSignIn(email, password)         — user typed credentials
 *   performReAuth(tokens, context)         — automatic restore (bootstrap, oauth, etc.)
 *   performSignInWithIdToken(provider, t)  — Google/Apple native
 */

import { JobsManager } from '@/lib/jobs';
import { buildRoute, determineEnterErrorRedirect, determineEnterRedirect } from '@/lib/navigation';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from '@/maps';
import { AuthStateManager } from '../auth-state';

// ============================================================================
// TYPES
// ============================================================================

export type ReAuthContext = 'bootstrap' | 'email-link' | 'oauth' | 'password-reset' | 'recovery';

/** Combined auth context — signin is user-triggered, others are automatic restores */
export type AuthContext = 'signin' | ReAuthContext;

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export interface SignInResult {
  success: boolean;
  redirect?: string;
  userId?: string;
  errors?: SignInError[];
}

export interface SignInError {
  phase: 'validation' | 'auth' | 'db-sync' | 'redirect';
  message: string;
  error?: Error;
}

/** Same shape as SignInResult — separate type for callers that import ReAuthResult */
export interface ReAuthResult {
  success: boolean;
  redirect?: string;
  userId?: string;
  worldIds?: string[];
  errors?: ReAuthError[];
}

export interface ReAuthError {
  phase: 'restore' | 'db-sync' | 'redirect';
  message: string;
  error?: Error;
}

// ============================================================================
// SHARED POST-AUTH SETUP (Steps 2-4 — identical for all entry points)
// ============================================================================

/**
 * Shared logic after session is established.
 *
 * Steps:
 * 2. Set HAS_ACCOUNT flag
 * 3. Sync data (JobsManager) + update LAST_LOGGED_IN timestamp
 * 4. Determine redirect (profile-based, with pending invite check)
 *
 * @param userId - Authenticated user ID
 * @param context - What triggered auth (drives redirect logic for bootstrap)
 */
async function performPostAuthSetup(
  userId: string,
  context: AuthContext
): Promise<{ redirect?: string; worldIds: string[]; errors: { phase: string; message: string; error?: Error }[] }> {
  const errors: { phase: string; message: string; error?: Error }[] = [];

  // =====================================================================
  // STEP 2: SET HAS_ACCOUNT FLAG
  // =====================================================================
  try {
    await AuthStateManager.setHasAccount(true);
    logger.category('auth').debug(`[${context}] Post-auth: HAS_ACCOUNT set`);
  } catch (error) {
    logger.category('auth').warn(`[${context}] Post-auth: Failed to set HAS_ACCOUNT`, error);
    // Non-blocking
  }

  // =====================================================================
  // STEP 3: SYNC DATA + UPDATE LAST_LOGGED_IN
  // =====================================================================
  let worldIds: string[] = [];

  try {
    const syncResult = await JobsManager.performSync({ mode: 'automatic', direction: 'download' });
    worldIds = syncResult.worlds?.worldIds || [];
    logger.category('auth').debug(`[${context}] Post-auth: Sync complete, worlds: ${worldIds.length}`);
  } catch (error) {
    logger.category('auth').warn(`[${context}] Post-auth: Sync failed`, error);
    // Non-blocking
  }

  try {
    const { StorageManager } = await import('@/lib/storage');
    await StorageManager.setRaw(STORAGE_KEYS.LAST_LOGGED_IN, Date.now().toString());
    logger.category('auth').debug(`[${context}] Post-auth: LAST_LOGGED_IN updated`);
  } catch (error) {
    logger.category('auth').warn(`[${context}] Post-auth: Failed to update LAST_LOGGED_IN`, error);
    // Non-blocking
  }

  // =====================================================================
  // STEP 4: DETERMINE REDIRECT
  // =====================================================================
  let redirect: string | undefined;

  try {
    const flowType = context === 'signin' ? 'signin' : 'reauth';
    const reAuthContext = context !== 'signin' ? context : undefined;

    if (context === 'bootstrap') {
      // Bootstrap: staleness-based routing — staleness was decided upstream in auth-phase.ts
      // determineEnterRedirect handles this via the 'bootstrap' reAuthContext
      const navDecision = determineEnterRedirect('reauth', null, worldIds, undefined, 'bootstrap');
      redirect = navDecision.redirect;
      logger.category('auth').info(`[${context}] Post-auth: ${navDecision.reason}`);
    } else {
      // All other contexts: profile-based routing + pending invite check
      const { usersDB } = await import('@/lib/database');
      const { StorageManager } = await import('@/lib/storage');

      const user = await usersDB.getCurrentUser();
      const profileCompleted = await StorageManager.get(STORAGE_KEYS.PROFILE_COMPLETED);

      const navDecision = determineEnterRedirect(
        flowType,
        user,
        worldIds,
        undefined,
        reAuthContext,
        profileCompleted
      );

      // If routing to world-selection, check for a pending invite first
      if (navDecision.redirect === '/select/world-selection' && profileCompleted !== false) {
        try {
          const { checkPendingInvites } = await import('@/lib/auth');
          const pendingInvite = await checkPendingInvites();

          if (pendingInvite) {
            redirect = buildRoute('/login/auth-redirect', {
              action: 'world-invite',
              token: pendingInvite.token,
              worldName: pendingInvite.worldName,
            }) as string;
            logger.category('auth').info(`[${context}] Post-auth: Pending invite found, redirecting to invite flow`);
          } else {
            redirect = navDecision.redirect;
            logger.category('auth').info(`[${context}] Post-auth: ${navDecision.reason}`);
          }
        } catch {
          redirect = navDecision.redirect;
        }
      } else {
        redirect = navDecision.redirect;
        logger.category('auth').info(`[${context}] Post-auth: ${navDecision.reason}`);
      }
    }
  } catch (error) {
    const navDecision = determineEnterErrorRedirect(context === 'signin' ? 'signin' : 'reauth');
    redirect = navDecision.redirect;
    errors.push({ phase: 'redirect', message: navDecision.reason, error: error instanceof Error ? error : undefined });
    logger.category('auth').warn(`[${context}] Post-auth: Failed to determine redirect`, error);
  }

  return { redirect, worldIds, errors };
}

// ============================================================================
// EMAIL/PASSWORD SIGN-IN
// ============================================================================

export async function performSignIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const result: SignInResult = { success: true, errors: [] };

  logger.category('auth').info('Sign-in: Starting email/password flow');

  try {
    // STEP 1: CALL AUTH PROVIDER
    let session;
    try {
      const { authSignIn } = await import('@/lib/middleware/services/auth-service');
      const authResult = await authSignIn(email, password);
      if (!authResult.success) throw new Error(authResult.error?.message || 'Authentication failed');
      session = authResult.data;
    } catch (error) {
      result.success = false;
      result.errors?.push({ phase: 'auth', message: error instanceof Error ? error.message : 'Authentication failed', error: error instanceof Error ? error : undefined });
      logger.category('auth').warn('Sign-in: Auth provider failed', error);
      return result;
    }

    if (!session) {
      result.success = false;
      result.errors?.push({ phase: 'auth', message: 'No session returned from auth provider' });
      return result;
    }

    // Store session
    try {
      await AuthStateManager.setSession(session);
      result.userId = session.userId;
    } catch (error) {
      result.success = false;
      result.errors?.push({ phase: 'auth', message: 'Failed to store session', error: error instanceof Error ? error : undefined });
      return result;
    }

    // STEPS 2-4: Shared post-auth setup
    const setup = await performPostAuthSetup(session.userId, 'signin');
    result.redirect = setup.redirect;
    if (setup.errors.length > 0) result.errors?.push(...(setup.errors as SignInError[]));

    logger.category('auth').info(`Sign-in: Complete. Redirect: ${result.redirect}`);
    return result;
  } catch (error) {
    result.success = false;
    result.errors?.push({ phase: 'auth', message: 'Unexpected error during sign-in', error: error instanceof Error ? error : undefined });
    logger.category('auth').error('Sign-in: Unexpected error', error);
    return result;
  }
}

// ============================================================================
// TOKEN RESTORE / RE-AUTH (bootstrap, email-link, oauth, password-reset)
// ============================================================================

export async function performReAuth(
  tokens: AuthTokens,
  context: ReAuthContext = 'bootstrap'
): Promise<ReAuthResult> {
  const result: ReAuthResult = { success: true, errors: [] };

  logger.category('auth').info(`Re-auth: Starting [${context}] flow`);

  try {
    // STEP 1: RESTORE SESSION FROM TOKENS
    try {
      if (!tokens.access_token) throw new Error('access_token is required');
      const { authRestoreSession } = await import('@/lib/middleware/services/auth-service');
      const restored = await authRestoreSession(tokens);
      if (!restored) throw new Error('Session restoration failed');
    } catch (error) {
      result.success = false;
      result.errors?.push({ phase: 'restore', message: error instanceof Error ? error.message : 'Session restoration failed', error: error instanceof Error ? error : undefined });
      logger.category('auth').warn(`[${context}] Re-auth: Session restoration failed`, error);
      return result;
    }

    const userId = await AuthStateManager.getUserId();
    if (!userId) {
      result.success = false;
      result.errors?.push({ phase: 'restore', message: 'No userId available after restore' });
      return result;
    }
    result.userId = userId;

    // STEPS 2-4: Shared post-auth setup
    const setup = await performPostAuthSetup(userId, context);
    result.redirect = setup.redirect;
    result.worldIds = setup.worldIds;
    if (setup.errors.length > 0) result.errors?.push(...(setup.errors as ReAuthError[]));

    logger.category('auth').info(`[${context}] Re-auth: Complete. Redirect: ${result.redirect}`);
    return result;
  } catch (error) {
    result.success = false;
    result.errors?.push({ phase: 'restore', message: 'Unexpected error during re-auth', error: error instanceof Error ? error : undefined });
    logger.category('auth').error(`[${context}] Re-auth: Unexpected error`, error);
    return result;
  }
}

// ============================================================================
// NATIVE ID TOKEN SIGN-IN (Google / Apple)
// ============================================================================

export async function performSignInWithIdToken(
  provider: string,
  token: string,
  options?: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: any }> {
  logger.category('auth').info(`Sign-in: Starting ID token flow for ${provider}`);

  try {
    // STEP 1: CALL AUTH PROVIDER WITH ID TOKEN
    const { authSignInWithIdToken } = await import('@/lib/middleware/services/auth-service');
    const authResult = await authSignInWithIdToken(provider, token, options);

    if (!authResult.success) {
      logger.category('auth').warn(`Sign-in: ID token auth failed for ${provider}`);
      return { success: false, error: authResult.error };
    }

    const session = authResult.data;
    if (!session) {
      return { success: false, error: { message: 'No session returned from auth provider' } };
    }

    // Store session
    try {
      await AuthStateManager.setSession(session);
    } catch (error) {
      logger.category('auth').warn(`Sign-in: Failed to store session for ${provider}`, error);
      return { success: false, error: { message: 'Failed to store session' } };
    }

    // STEPS 2-4: Shared post-auth setup (using 'oauth' context for redirect logic)
    await performPostAuthSetup(session.userId, 'oauth');

    logger.category('auth').info(`Sign-in: ID token flow complete for ${provider}`);
    return { success: true, data: session };
  } catch (error) {
    logger.category('auth').error(`Sign-in: Unexpected error in ID token flow for ${provider}`, error);
    return { success: false, error };
  }
}
