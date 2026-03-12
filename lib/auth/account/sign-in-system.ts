/**
 * Sign-In System
 *
 * Centralizes user login orchestration with post-login data sync.
 *
 * Flow:
 * 1. Validate email + password format
 * 2. Call auth provider via middleware
 * 3. Store session + metadata (HAS_ACCOUNT, LAST_LOGGED_IN timestamp)
 * 4. Sync data (profile + worlds, download from server)
 * 5. Drain offline mutation queue (upload pending changes)
 * 6. Determine redirect based on profile completeness
 *
 * Usage:
 *   const result = await performSignIn('user@example.com', 'password123');
 *   if (result.success) {
 *     navigate(result.redirect);
 *   } else {
 *     showError(result.errors);
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
 * Result of attempted sign-in.
 */
export interface SignInResult {
  success: boolean;
  redirect?: string; // Where to navigate after successful sign-in
  userId?: string;
  errors?: SignInError[];
}

/**
 * Sign-in error with phase and context.
 */
export interface SignInError {
  phase: 'validation' | 'auth' | 'db-sync' | 'redirect';
  message: string;
  error?: Error;
}

// ============================================================================
// SIGN-IN SYSTEM
// ============================================================================

/**
 * Performs complete user login orchestration.
 *
 * Steps:
 * 1. Call auth provider via middleware
 * 2. Store session + HAS_ACCOUNT flag + LAST_LOGGED_IN timestamp
 * 3. Call performDBSync() to fetch profile, refresh worlds, drain offline queue
 * 4. Determine redirect based on profile completeness + worlds availability
 *
 * @param email - User's email address (pre-validated by auth-manager)
 * @param password - User's password (pre-validated by auth-manager)
 * @returns SignInResult with success status, redirect URL, and any errors
 *
 * @remarks
 * - Input validation is handled by auth-manager using signInSchema (Zod)
 * - Post-login setup is consolidated here (no duplicate logic in auth-redirect or OAuth hooks)
 * - LAST_LOGGED_IN is set to Date.now() during DB sync
 * - Non-blocking on individual DB sync failures; continues with redirect
 * - Redirect logic: incomplete profile → /login/complete-profile, has worlds → /select/world-selection
 *
 * @example
 * const result = await performSignIn('test@example.com', 'mypassword');
 * if (result.success) {
 *   navigate(result.redirect); // /select/world-selection or /login/complete-profile
 * } else {
 *   showErrorModal(result.errors);
 * }
 */
export async function performSignIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const result: SignInResult = {
    success: true,
    errors: [],
  };

  logger.category('auth').info('Sign-in: Starting email/password flow');

  try {
    // =====================================================================
    // STEP 1: CALL AUTH PROVIDER
    // =====================================================================
    // Note: Input validation happens in auth-manager via signInSchema
    logger.category('auth').debug('Sign-in: Calling auth provider');

    let session;
    try {
      const { authSignIn } = await import('@/lib/middleware/services/auth-service');
      const authResult = await authSignIn(email, password);
      
      if (!authResult.success) {
        throw new Error(authResult.error?.message || 'Authentication failed');
      }
      
      session = authResult.data;
    } catch (error) {
      result.success = false;
      result.errors?.push({
        phase: 'auth',
        message: error instanceof Error ? error.message : 'Authentication failed',
        error: error instanceof Error ? error : undefined,
      });
      logger.category('auth').warn('Sign-in: Auth provider failed', error);
      return result;
    }

    if (!session) {
      result.success = false;
      result.errors?.push({
        phase: 'auth',
        message: 'No session returned from auth provider',
      });
      logger.category('auth').warn('Sign-in: No session returned');
      return result;
    }

    // =====================================================================
    // STEP 2: STORE SESSION + METADATA
    // =====================================================================
    logger.category('auth').debug('Sign-in: Storing session + metadata');

    try {
      // Store session in auth state
      await AuthStateManager.setSession(session);

      // Set account flag
      const { StorageManager } = await import('@/lib/storage');
      await StorageManager.set(STORAGE_KEYS.HAS_ACCOUNT, true);

      result.userId = session.userId;
      logger.category('auth').info(`Sign-in: Session stored for user ${result.userId}`);
    } catch (error) {
      result.success = false;
      result.errors?.push({
        phase: 'auth',
        message: 'Failed to store session',
        error: error instanceof Error ? error : undefined,
      });
      logger.category('auth').warn('Sign-in: Failed to store session', error);
      return result;
    }

    // =====================================================================
    // STEP 3: SYNC DATA (via JobsManager orchestration)
    // =====================================================================
    const syncResult = await JobsManager.performSync({ mode: 'automatic', direction: 'download' });
    const worldIds = syncResult.worlds?.worldIds || [];

    // =====================================================================
    // STEP 4: DETERMINE REDIRECT
    // =====================================================================
    logger.category('auth').debug('Sign-in: Determining post-login redirect');

    try {
      const { usersDB } = await import('@/lib/database');
      const user = await usersDB.getCurrentUser();
      const navDecision = determineEnterRedirect('signin', user, worldIds);
      result.redirect = navDecision.redirect;
      logger.category('auth').info(`Sign-in: ${navDecision.reason}`);
    } catch (error) {
      const navDecision = determineEnterErrorRedirect('signin');
      result.redirect = navDecision.redirect;
      result.errors?.push({
        phase: 'redirect',
        message: navDecision.reason,
        error: error instanceof Error ? error : undefined,
      });
      logger.category('auth').warn('Sign-in: Failed to determine redirect', error);
    }

    logger.category('auth').info(`Sign-in: Complete. Redirect: ${result.redirect}`);
    return result;
  } catch (error) {
    result.success = false;
    result.errors?.push({
      phase: 'auth',
      message: 'Unexpected error during sign-in',
      error: error instanceof Error ? error : undefined,
    });
    logger.category('auth').error('Sign-in: Unexpected error', error);
    return result;
  }
}

// ============================================================================
// ID TOKEN SIGN-IN (Google / Apple native)
// ============================================================================

/**
 * Performs sign-in via ID token from a native auth provider (Google, Apple).
 *
 * Same post-login flow as performSignIn: store session, DB sync, determine redirect.
 *
 * @param provider - Provider name ('google', 'apple')
 * @param token - ID token from the native authentication library
 * @param options - Optional provider-specific options (e.g., access_token for Apple web)
 * @returns Result with success flag, optional data/error
 */
export async function performSignInWithIdToken(
  provider: string,
  token: string,
  options?: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: any }> {
  logger.category('auth').info(`Sign-in: Starting ID token flow for ${provider}`);

  try {
    // STEP 1: Call auth provider with ID token
    const { authSignInWithIdToken } = await import('@/lib/middleware/services/auth-service');
    const authResult = await authSignInWithIdToken(provider, token, options);

    if (!authResult.success) {
      logger.category('auth').warn(`Sign-in: ID token auth failed for ${provider}`);
      return { success: false, error: authResult.error };
    }

    const session = authResult.data;
    if (!session) {
      logger.category('auth').warn(`Sign-in: No session returned for ${provider}`);
      return { success: false, error: { message: 'No session returned from auth provider' } };
    }

    // STEP 2: Store session + metadata
    try {
      await AuthStateManager.setSession(session);
      const { StorageManager } = await import('@/lib/storage');
      await StorageManager.set(STORAGE_KEYS.HAS_ACCOUNT, true);
      logger.category('auth').info(`Sign-in: Session stored for ${provider} user ${session.userId}`);
    } catch (error) {
      logger.category('auth').warn(`Sign-in: Failed to store session for ${provider}`, error);
      return { success: false, error: { message: 'Failed to store session' } };
    }

    // STEP 3: Sync data (via JobsManager orchestration)
    await JobsManager.performSync({ mode: 'automatic', direction: 'download' });

    logger.category('auth').info(`Sign-in: ID token flow complete for ${provider}`);
    return { success: true, data: session };
  } catch (error) {
    logger.category('auth').error(`Sign-in: Unexpected error in ID token flow for ${provider}`, error);
    return { success: false, error };
  }
}
