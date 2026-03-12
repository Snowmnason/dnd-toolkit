import { EmailAlreadyExistsError } from "@/lib/error";
import {
  authGetSession,
  authGetUser,
  authOnStateChange,
  authResendConfirmation,
  authResetPassword,
  authRestoreSession,
  authSignIn,
  authSignInWithOAuth,
  authUpdatePassword,
} from "@/lib/middleware/services";
import { logger } from "@/lib/utils";
import type {
  Phase1VerifyResult,
  Phase2UpdatePasswordResult,
  Phase2UpdateUsernameResult,
} from "./account/update-creds-system";
import type {
  DeletePhase1Result,
  DeletePhase2Result,
} from "./account/delete-account-system";
import {
  prepareResendConfirmation,
  prepareResetPassword,
  prepareSignIn,
  prepareSignUp,
  prepareUpdatePassword,
  recordAuthAttempt,
  type AuthOperationResult,
  type ResendResult,
  type ResetPasswordResult,
  type Session,
  type SignInResult,
  type SignUpResult,
} from "./auth-operations";

// Re-export types so consumers only need @/lib/auth
export type {
  AuthOperationResult, ResendResult, ResetPasswordResult, Session,
  SignInResult,
  SignUpResult
};

// ============================================================================
// SHARED VERIFICATION HELPERS
// ============================================================================

/**
 * Verify the current user is logged in with a valid server-verified session.
 * Centralized so systems don't duplicate validateCurrentUser() + error handling.
 *
 * @returns User's auth_id and email, or throws with a user-facing message.
 */
export async function ensureUserLoggedIn(): Promise<{ authId: string; email: string }> {
  const { validateCurrentUser } = await import('@/lib/database');
  const authUser = await validateCurrentUser();
  if (!authUser?.auth_id) {
    throw new Error('Unable to verify current user. Please ensure you are logged in.');
  }
  return { authId: authUser.auth_id, email: authUser.email };
}

/**
 * Verify the auth provider is initialized and network is available.
 * Centralized so systems don't duplicate isAuthConfigured() + error handling.
 *
 * @throws Error with user-facing message if provider is not ready.
 */
export async function ensureAuthProviderReady(): Promise<void> {
  const { isAuthConfigured } = await import('@/lib/middleware/services/auth-service');
  if (!isAuthConfigured()) {
    throw new Error('Auth provider is not available. Please check your network connection and try again.');
  }
}


// ============================================================================
// SIGN IN
// ============================================================================
/**
 * Sign in orchestrator.
 * Pre-flight (validation, rate limiting) via auth-operations,
 * delegation to sign-in-system for all auth + session + DB sync logic,
 * then maps system result back to the public SignInResult shape.
 */
export const signInUser = async (
  email: string,
  password: string,
): Promise<SignInResult> => {
  const prep = await prepareSignIn(email);
  if (!prep.ready) return prep.result;

  try {
    const { performSignIn } = await import('./account/sign-in-system');
    const systemResult = await performSignIn(prep.sanitizedEmail, password);

    if (systemResult.success) {
      await recordAuthAttempt(prep.sanitizedEmail, 'signin', true);
      return { success: true, redirectTo: systemResult.redirect };
    }

    await recordAuthAttempt(prep.sanitizedEmail, 'signin', false);
    const message = systemResult.errors?.[0]?.message ?? 'Sign in failed. Please try again.';
    return { success: false, error: message };
  } catch (error) {
    logger.category('auth').error('Sign in error:', error);
    const message = (error as Error)?.message?.includes('Request timeout')
      ? 'The server took too long to respond. Please try again.'
      : (error as Error)?.message?.includes('fetch')
        ? 'Connection error. Please check your internet and try again.'
        : 'Sign in failed. Please try again.';
    return { success: false, error: message };
  }
};

// ============================================================================
// VERIFY CREDENTIALS (re-auth without post-login flow — used by deleteAccount)
// ============================================================================

export const verifyCredentials = async (
  email: string,
  password: string,
): Promise<AuthOperationResult> => {
  try {
    const result = await authSignIn(email, password);
    if (!result.success) {
      return { success: false, error: "Password verification failed. Please check your password and try again." };
    }
    return { success: true };
  } catch (error) {
    logger.category("auth").error("Credential verification error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
};

// ============================================================================
// SIGN UP
// ============================================================================

export const signUpUser = async (
  email: string,
  password: string,
): Promise<SignUpResult> => {
  const prep = await prepareSignUp(email, password);
  if (!prep.ready) return prep.result;

  try {
    const { performSignUp } = await import('./account/sign-up-system');
    const systemResult = await performSignUp(prep.sanitizedEmail, password);

    if (systemResult.success) {
      await recordAuthAttempt(prep.sanitizedEmail, 'signup', true);
      return { success: true, redirectTo: systemResult.redirect };
    }

    await recordAuthAttempt(prep.sanitizedEmail, 'signup', false);
    const firstError = systemResult.errors[0];

    // Map email-already-exists to the modal flag using the preserved error instance
    if (firstError?.error instanceof EmailAlreadyExistsError) {
      return { success: false, showEmailExistsModal: true };
    }
    const msg = firstError?.message ?? '';
    if (msg.includes('Password')) {
      return { success: false, error: 'Password does not meet requirements. Please check and try again.' };
    }
    return { success: false, error: msg || 'Account creation failed. Please try again.' };
  } catch (error) {
    logger.category('auth').error('Sign up error:', error);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
};

// ============================================================================
// PASSWORD RESET
// ============================================================================

export const sendPasswordReset = async (
  email: string,
): Promise<ResetPasswordResult> => {
  const prep = await prepareResetPassword(email);
  if (!prep.ready) return prep.result;

  try {
    const resetResult = await authResetPassword(prep.sanitizedEmail);
    if (!resetResult.success) {
      logger.category("auth").warn("Reset password failed (not revealing to user)");
    } else {
      await recordAuthAttempt(prep.sanitizedEmail, "reset", true);
    }
    // Security: always return success to prevent email enumeration
    return {
      success: true,
      message: "If an account exists with this email, you will receive a reset link.",
    };
  } catch (error) {
    logger.category("auth").error("Password reset error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
};

// ============================================================================
// UPDATE PASSWORD
// ============================================================================

export const updatePassword = async (
  newPassword: string,
): Promise<AuthOperationResult> => {
  const prep = await prepareUpdatePassword(newPassword);
  if (!prep.ready) return prep.result;

  try {
    const session = await authGetSession();
    if (!session) {
      return { success: false, error: "You must be signed in to change your password." };
    }

    const updateResult = await authUpdatePassword(newPassword);
    if (!updateResult.success) {
      return { success: false, error: updateResult.error ?? "Failed to update password. Please try again." };
    }

    return { success: true, message: "Password updated successfully." };
  } catch (error) {
    logger.category("auth").error("Update password error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
};

// ============================================================================
// UPDATE CREDENTIALS (username / password — logged-in settings flow)
// ============================================================================

/**
 * Phase 1: Verify the user's identity before showing credential update modal.
 * Runs ensureUserLoggedIn + ensureAuthProviderReady guards.
 */
export const verifyIdentityForCredentialUpdate = async (): Promise<Phase1VerifyResult> => {
  try {
    await ensureUserLoggedIn();
    await ensureAuthProviderReady();
    return { success: true, errors: [] };
  } catch (error) {
    return {
      success: false,
      errors: [{ phase: 'verification', message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error : undefined }],
    };
  }
};

/**
 * Phase 2: Update the user's username.
 * Runs ensureUserLoggedIn guard, then delegates.
 */
export const updateUsernameUser = async (
  newUsername: string,
): Promise<Phase2UpdateUsernameResult> => {
  try {
    await ensureUserLoggedIn();
  } catch (error) {
    return {
      success: false,
      errors: [{ phase: 'verification', message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error : undefined }],
    };
  }
  const { performPhase2_UpdateUsername } = await import('./account/update-creds-system');
  return performPhase2_UpdateUsername(newUsername, 'user-initiated');
};

/**
 * Phase 2: Update the user's password while logged in (settings flow).
 * Validates password format + ensureUserLoggedIn guard before delegating.
 * Distinct from `updatePassword` which handles the token-based reset flow.
 */
export const updatePasswordLoggedIn = async (
  currentPassword: string,
  newPassword: string,
): Promise<Phase2UpdatePasswordResult> => {
  const prep = await prepareUpdatePassword(newPassword);
  if (!prep.ready) {
    return {
      success: false,
      errors: [{ phase: 'validation', message: prep.result.error ?? 'Invalid password format.' }],
    };
  }
  try {
    await ensureUserLoggedIn();
  } catch (error) {
    return {
      success: false,
      errors: [{ phase: 'verification', message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error : undefined }],
    };
  }
  const { performPhase2_UpdatePasswordLoggedIn } = await import('./account/update-creds-system');
  return performPhase2_UpdatePasswordLoggedIn(currentPassword, newPassword, 'user-initiated');
};

// ============================================================================
// RESEND CONFIRMATION EMAIL
// ============================================================================

export const resendConfirmationEmail = async (
  email: string,
): Promise<ResendResult> => {
  const prep = await prepareResendConfirmation(email);
  if (!prep.ready) return prep.result;

  try {
    const resendResult = await authResendConfirmation(prep.sanitizedEmail);
    if (!resendResult.success) {
      return {
        success: false,
        error: resendResult.message ?? "Failed to resend confirmation email. Please try again.",
      };
    }

    return {
      success: true,
      message: resendResult.message ?? "Confirmation email sent.",
      retryAfterMs: 30_000,
    };
  } catch (error) {
    logger.category("auth").error("Resend confirmation error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
};

// ============================================================================
// SIGN OUT (comprehensive — clears session, caches, and resets preferences)
// ============================================================================

export const signOutUser = async (): Promise<void> => {
  const { performSignOutPhase2_ClearAndSignOut } = await import('./account/sign-out-system');
  const result = await performSignOutPhase2_ClearAndSignOut('user-initiated');
  if (!result.success) {
    logger.category('auth').error('Sign out completed with errors', result.errors);
  }
};

// ============================================================================
// DELETE ACCOUNT (two-phase with auth-manager guards)
// ============================================================================

/**
 * Phase 1: Verify that account deletion is allowed.
 * Runs ensureUserLoggedIn + ensureAuthProviderReady guards.
 */
export const verifyDeletion = async (): Promise<DeletePhase1Result> => {
  try {
    await ensureUserLoggedIn();
    await ensureAuthProviderReady();
    return { success: true, message: 'Account can be deleted. Please enter your password to confirm.', errors: [] };
  } catch (error) {
    return {
      success: false,
      errors: [{ phase: 'verification', message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error : undefined }],
    };
  }
};

/**
 * Phase 2: Delete account and sign out.
 * Runs ensureUserLoggedIn guard + verifyCredentials before delegating to system.
 */
export const deleteAccountUser = async (password: string): Promise<DeletePhase2Result> => {
  let user: { authId: string; email: string };
  try {
    user = await ensureUserLoggedIn();
  } catch (error) {
    return {
      success: false,
      errors: [{ phase: 'verification', message: error instanceof Error ? error.message : 'Verification failed', error: error instanceof Error ? error : undefined }],
    };
  }
  const credResult = await verifyCredentials(user.email, password);
  if (!credResult.success) {
    return {
      success: false,
      errors: [{ phase: 'auth', message: credResult.error ?? 'Password verification failed.' }],
    };
  }
  const { performDeletePhase2_DeleteAndSignOut } = await import('./account/delete-account-system');
  return performDeletePhase2_DeleteAndSignOut(password, 'user-initiated');
};

// ============================================================================
// SESSION / STATE LISTENERS
// ============================================================================

export const getCurrentSession = async (): Promise<Session | null> => {
  try {
    return await authGetSession();
  } catch (error) {
    logger.category("auth").error("Failed to get current session:", error);
    return null;
  }
};

export const listenToAuthStateChanges = (
  callback: (session: Session | null) => void,
): (() => void) => {
  return authOnStateChange(callback);
};

// ============================================================================
// OAUTH / ID TOKEN SIGN IN
// ============================================================================

/**
 * Sign in with an OAuth provider (used for Google mobile redirect flow).
 * Returns a URL to open in the browser for OAuth authentication.
 *
 * @param provider - OAuth provider name (e.g., 'google')
 * @param options - Optional provider-specific options
 * @returns { url?: string } — open url in browser to complete OAuth
 */
export const signInWithOAuth = async (
  provider: string,
  options?: Record<string, any>
): Promise<{ url?: string }> => {
  try {
    return await authSignInWithOAuth(provider, options);
  } catch (error) {
    logger.category('auth').error(`OAuth sign-in error for ${provider}:`, error);
    return {};
  }
};

/**
 * Sign in with an ID token from a native OAuth flow (Apple, Google native).
 * Delegates to sign-in-system for full post-login orchestration (DB sync, redirect).
 *
 * @param provider - Provider name ('apple', 'google')
 * @param token - ID token from the native authentication library
 * @param options - Optional provider-specific options
 * @returns AuthResult with success flag and session or error
 */
export const signInWithIdToken = async (
  provider: string,
  token: string,
  options?: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: any }> => {
  try {
    const { performSignInWithIdToken } = await import('./account/sign-in-system');
    return await performSignInWithIdToken(provider, token, options);
  } catch (error) {
    logger.category('auth').error(`ID token sign-in error for ${provider}:`, error);
    return { success: false, error };
  }
};

// ============================================================================
// INVITE UTILITIES
// ============================================================================

export const generateWorldInviteLink = async (
  worldId: string,
  worldName: string,
  hoursValid = 24,
): Promise<{ success: boolean; inviteLink?: string; error?: string }> => {
  const { performGenerateInviteLink } = await import('./account/invite-system');
  return performGenerateInviteLink(worldId, worldName, hoursValid);
};

export const checkPendingInvites = async (): Promise<{
  token: string;
  worldName: string;
} | null> => {
  const { performCheckPendingInvites } = await import('./account/invite-system');
  return performCheckPendingInvites();
};

/**
 * Restore session from authentication tokens.
 * Used in password reset flow when user has tokens from URL parameters.
 *
 * @param tokens - { access_token, refresh_token? }
 * @returns true if restoration succeeded, false otherwise
 */
export const restoreSession = async (
  tokens: { access_token: string; refresh_token?: string }
): Promise<boolean> => {
  try {
    return await authRestoreSession(tokens);
  } catch (error) {
    logger.category('auth').error('Failed to restore session from tokens:', error);
    return false;
  }
};

/**
 * Get current user from session.
 * Delegates to auth-service's getUser().
 *
 * @returns User info or null if not authenticated
 */
export const getUser = async () => {
  try {
    return await authGetUser();
  } catch (error) {
    logger.category('auth').error('Failed to get current user:', error);
    return null;
  }
};

/**
 * Check if an auth session is currently active
 * Used by offline/storage modules to determine if they can access data
 * that requires authentication (e.g., user worlds list).
 *
 * This hides infrastructure concerns from callers — they just ask
 * "is auth session ready?" without knowing about Supabase or clients.
 *
 * @returns true if a valid session exists, false otherwise
 */
export const isAuthSessionReady = async (): Promise<boolean> => {
  try {
    const session = await getCurrentSession();
    return session !== null && session !== undefined;
  } catch (error) {
    logger.category('auth').debug('Failed to check session readiness:', error);
    return false;
  }
};
