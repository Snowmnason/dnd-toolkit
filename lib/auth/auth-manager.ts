import { usersDB } from "@/lib/database";
import {
    authGetSession,
    authGetUser,
    authOnStateChange,
    authResendConfirmation,
    authResetPassword,
    authRestoreSession,
    authSignIn,
    authSignInWithIdToken,
    authSignInWithOAuth,
    authSignOut,
    authSignUp,
    authUpdatePassword,
} from "@/lib/middleware/services";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils";
import { STORAGE_KEYS } from "@/maps";
import {
    mapSignInError,
    mapSignUpError,
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



/**
 * Sign in orchestrator.
 * Pre-flight (validation, rate limiting) via auth-operations,
 * service call via auth-service, then post-login side effects.
 */
export const signInUser = async (
  email: string,
  password: string,
): Promise<SignInResult> => {
  const prep = await prepareSignIn(email);
  if (!prep.ready) return prep.result;

  try {
    const signinResult = await authSignIn(prep.sanitizedEmail, password);

    if (!signinResult.success) {
      await recordAuthAttempt(prep.sanitizedEmail, "signin", false);
      return mapSignInError(signinResult.error);
    }

    await recordAuthAttempt(prep.sanitizedEmail, "signin", true);

    // Post-login state setup
    const { AuthStateManager } = await import("./auth-state");
    const session = await authGetSession();
    if (session && (session as any).raw) {
      await AuthStateManager.setSession((session as any).raw);
    }
    await AuthStateManager.setHasAccount(true);
    await StorageManager.setRaw(STORAGE_KEYS.LAST_LOGGED_IN, Date.now().toString());

    // Profile check + redirect determination
    try {
      const userProfile = await usersDB.getCurrentUser();
      await AuthStateManager.saveUserData(userProfile);
      const hasValidProfile = (userProfile?.username?.trim() ?? '').length > 0;
      const pendingInvite = await checkPendingInvites();

      if (hasValidProfile) {
        if (pendingInvite) {
          await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
          return {
            success: true,
            redirectTo: `/login/auth-redirect?action=world-invite&token=${pendingInvite.token}&worldName=${encodeURIComponent(pendingInvite.worldName)}`,
          };
        }
        return { success: true, redirectTo: "/select/world-selection" };
      }
      return { success: true, redirectTo: "/login/complete-profile" };
    } catch (profileError) {
      logger.category('auth').error("Profile check error during sign-in:", profileError);
      return { success: true, redirectTo: "/select/world-selection" };
    }
  } catch (error) {
    logger.category('auth').error("Sign in error:", error);
    const message = (error as Error)?.message?.includes("Request timeout")
      ? "The server took too long to respond. Please try again."
      : (error as Error)?.message?.includes("fetch")
        ? "Connection error. Please check your internet and try again."
        : "Sign in failed. Please try again.";
    return { success: false, error: message };
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
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://dnd-tool.thesnowpost.com";

    const signupResult = await authSignUp(prep.sanitizedEmail, password, {
      emailRedirectTo: `${baseUrl}/login/auth-redirect?action=signup-confirm`,
    });

    await new Promise((r) => setTimeout(r, 500));

    if (!signupResult.success) {
      await recordAuthAttempt(prep.sanitizedEmail, "signup", false);
      return mapSignUpError(signupResult.error);
    }

    await recordAuthAttempt(prep.sanitizedEmail, "signup", true);
    return {
      success: true,
      redirectTo: `/login/email-confirmation?email=${encodeURIComponent(prep.sanitizedEmail)}`,
    };
  } catch (error) {
    logger.category("auth").error("Sign up error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
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
  try {
    try {
      await authSignOut();
    } catch (error) {
      logger.category("auth").error("Error signing out from auth provider", error);
    }

    const { AuthStateManager } = await import("./auth-state");
    await AuthStateManager.clearAuthState();

    // Reset theme to defaults for next user
    await Promise.all([
      StorageManager.setRaw(STORAGE_KEYS.THEME_PREFERENCE, "classic"),
      StorageManager.setRaw(STORAGE_KEYS.THEME_MODE, "dark"),
    ]);
  } catch (error) {
    logger.category("auth").error("Sign out error", error);
    throw new Error("Failed to sign out. Please try again.");
  }
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
    return await authSignInWithIdToken(provider, token, options);
  } catch (error) {
    logger.category('auth').error(`ID token sign-in error for ${provider}:`, error);
    return { success: false, error };
  }
};

// ============================================================================
// INVITE UTILITIES
// ============================================================================

// Generate world invite link with Supabase-generated token
export const generateWorldInviteLink = async (
  worldId: string,
  worldName: string,
  hoursValid = 24,
): Promise<{ success: boolean; inviteLink?: string; error?: string }> => {
  try {
    if (!worldId || !worldName) {
      return {
        success: false,
        error: "World ID and name are required",
      };
    }

    // Import invitesDB here to avoid circular dependencies
    const { invitesDB } = await import("../database/invites");

    // Create invite link in database with Supabase-generated token
    const result = await invitesDB.createInviteLink({
      worldId,
      hoursValid,
    });

    if (!result.success || !result.inviteLink) {
      return {
        success: false,
        error: result.error || "Failed to create invite link",
      };
    }

    // Build the full invite URL using the token
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://dnd-tool.thesnowpost.com";

    const inviteLink = `${baseUrl}/login/auth-redirect?action=world-invite&token=${result.inviteLink.token}&worldName=${encodeURIComponent(worldName)}`;

    // Try to copy to clipboard
    if (typeof window !== "undefined" && window.navigator?.clipboard) {
      try {
        await window.navigator.clipboard.writeText(inviteLink);
        logger.category('auth').debug("Invite link copied to clipboard!");
      } catch {
        logger.category('auth').debug("Could not copy to clipboard automatically");
      }
    }

    logger.category('auth').info("World Invite Link Generated:", {
      world: worldName,
      token: result.inviteLink.token,
      expires: result.inviteLink.expires_at,
      link: inviteLink,
    });

    return {
      success: true,
      inviteLink,
    };
  } catch (error) {
    logger.category('auth').error("Failed to generate invite link:", error);
    return {
      success: false,
      error: "Failed to generate invite link",
    };
  }
};

// Helper function to check for pending invites
export const checkPendingInvites = async (): Promise<{
  token: string;
  worldName: string;
} | null> => {
  if (typeof window !== "undefined") {
    const stored = await StorageManager.getRaw(STORAGE_KEYS.PENDING_INVITE);
    if (stored) {
      try {
        const inviteData = JSON.parse(stored);
        // Check if invite is less than 24 hours old
        if (Date.now() - inviteData.timestamp < 24 * 60 * 60 * 1000) {
          return { token: inviteData.token, worldName: inviteData.worldName };
        } else {
          // Clean up expired invite
          await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
        }
      } catch (error) {
        logger.category('auth').error("Error parsing pending invite:", error);
        await StorageManager.remove(STORAGE_KEYS.PENDING_INVITE);
      }
    }
  }
  return null;
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
