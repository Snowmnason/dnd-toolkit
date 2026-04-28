/**
 * Sign-Up System
 *
 * Centralizes new account creation orchestration with email confirmation flow.
 *
 * Flow:
 * 1. Validate email + password format using signUpSchema (Zod)
 * 2. Call auth provider via middleware to create account + send confirmation email
 * 3. Store session + metadata (HAS_ACCOUNT flag, LAST_LOGGED_IN timestamp) in cache
 * 4. Redirect to email-confirmation page
 * 5. When user clicks email link → auth-redirect with action=signup-confirm
 * 6. Re-auth system restores cached session and detects incomplete profile
 *    → Redirects to /login/complete-profile (without requiring password re-entry)
 *
 * Key insight: By caching session after signup, the confirmation email flow doesn't require
 * the user to log in again. Re-auth just restores the cached session and handles routing.
 *
 * Usage:
 *   const result = await performSignUp('user@example.com', 'password123');
 *   if (result.success) {
 *     navigate(result.redirect); // /login/email-confirmation?email=user@example.com
 *   } else {
 *     showError(result.errors);
 *   }
 */

import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from '@/maps';
import { AuthStateManager } from '../auth-state';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of attempted sign-up.
 */
export interface SignUpResult {
  success: boolean;
  redirect?: string; // Where to navigate after successful sign-up
  userId?: string;
  errors: SignUpError[]; // Always present (may be empty)
}

/**
 * Sign-up error with phase and context.
 */
export interface SignUpError {
  phase: 'validation' | 'auth' | 'session';
  message: string;
  error?: Error;
}

// ============================================================================
// SIGN-UP SYSTEM
// ============================================================================

/**
 * Performs complete new account creation orchestration.
 *
 * Steps:
 * 1. Validate email + password using Zod (signUpSchema)
 * 2. Call auth provider to create account + send confirmation email
 * 3. Store session + HAS_ACCOUNT flag + LAST_LOGGED_IN timestamp in cache
 * 4. Return redirect to email-confirmation page
 * 5. When user clicks email confirmation link, re-auth system:
 *    - Restores cached session (no password needed)
 *    - Performs DB sync
 *    - Detects incomplete profile
 *    - Redirects to /login/complete-profile
 *
 * @param email - User's email address (pre-validated by auth-manager with signUpSchema)
 * @param password - User's password (pre-validated by auth-manager with signUpSchema)
 * @returns SignUpResult with success status, redirect URL, and any errors
 *
 * @remarks
 * - Input validation is handled by auth-manager using signUpSchema (Zod)
 * - Session is cached so email confirmation flow can skip re-authentication
 * - LAST_LOGGED_IN timestamp is set to current time
 * - Non-blocking on individual failures; continues with error collection
 * - Error fallback: user can still proceed with email confirmation if caching fails
 *
 * @example
 * const result = await performSignUp('test@example.com', 'MyPassword123!');
 * if (result.success) {
 *   navigate(result.redirect); // /login/email-confirmation?email=test@example.com
 * } else {
 *   showErrorModal(result.errors);
 * }
 */
export async function performSignUp(
  email: string,
  password: string
): Promise<SignUpResult> {
  const result: SignUpResult = {
    success: true,
    errors: [] as SignUpError[],
  };

  logger.category('auth').info('Sign-up: Starting new account creation flow');

  try {
    // =====================================================================
    // STEP 1: CALL AUTH PROVIDER
    // =====================================================================
    // Note: Input validation happens in auth-manager via signUpSchema
    logger.category('auth').debug('Sign-up: Calling auth provider to create account');

    const { authSignUp } = await import('@/middleware/services');
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dnd-tool.thesnowpost.com';

    const signupResult = await authSignUp(email, password, {
      emailRedirectTo: `${baseUrl}/login/sign-up?action=signup-confirm`,
    });

    if (!signupResult.success) {
      logger.category('auth').warn(
        'Sign-up: Auth provider rejected account creation',
        signupResult.error
      );
      result.success = false;
      result.errors.push({
        phase: 'auth',
        message: signupResult.error?.message || 'Failed to create account. Please try again.',
        error: signupResult.error,
      });
      return result;
    }

    logger.category('auth').info('Sign-up: Account created successfully, confirmation email sent');

    // =====================================================================
    // STEP 2: STORE SESSION + METADATA IN CACHE
    // =====================================================================
    // Cache the session so when user clicks email confirmation link,
    // re-auth can restore it without requiring password re-entry.
    try {
      logger.category('auth').debug('Sign-up: Caching session + metadata for email confirmation flow');

      // Get session from auth provider
      const { authGetSession } = await import('@/middleware/services');
      const session = await authGetSession();

      if (session && (session as any).raw) {
        await AuthStateManager.setSession((session as any).raw);
      }

      // Mark account as created
      await AuthStateManager.setHasAccount(true);

      // Set LAST_LOGGED_IN to now
      const { StorageManager } = await import('@/lib/storage');
      await StorageManager.setRaw(STORAGE_KEYS.LAST_LOGGED_IN, Date.now().toString());

      logger.category('auth').debug('Sign-up: Session + metadata cached for later re-auth');
    } catch (sessionError) {
      logger.category('auth').warn('Sign-up: Failed to cache session', sessionError);
      // Non-blocking: user can still proceed with email confirmation
      // Re-auth will handle missing cache gracefully
      result.errors.push({
        phase: 'session',
        message: 'Warning: Could not cache session. Email confirmation may require re-authentication.',
        error: sessionError as Error,
      });
    }

    // =====================================================================
    // STEP 3: REDIRECT TO EMAIL CONFIRMATION PAGE
    // =====================================================================
    result.redirect = `/login/email-confirmation?email=${encodeURIComponent(email)}`;
    logger.category('auth').info('Sign-up: Complete, user redirected to email confirmation', {
      email,
      redirect: result.redirect,
    });

    return result;
  } catch (error) {
    logger.category('auth').error('Sign-up: Unexpected error during account creation', error);
    result.success = false;
    result.errors.push({
      phase: 'validation',
      message: (error as Error)?.message || 'An unexpected error occurred. Please try again.',
      error: error as Error,
    });
    return result;
  }
}
