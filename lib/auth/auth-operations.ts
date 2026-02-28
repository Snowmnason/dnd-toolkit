/**
 * Semantic Auth Operations Layer
 *
 * This module provides high-level, semantic auth operations that wrap the AuthProvider abstraction.
 * Each operation:
 * - Validates inputs (email format, password strength, etc.)
 * - Handles errors and maps them to normalized AuthError types
 * - Logs operation results with appropriate categories (auth, security)
 * - Manages rate limiting and attempt tracking via AuthGuard
 * - Returns structured result objects with success/error/message fields
 *
 * When to Use:
 * - UI components and hooks should call functions from this module, NOT getAuthProvider() directly
 * - For signup/signin workflows, use signUpUser/signInUser
 * - For password recovery, use sendPasswordReset
 * - For profile updates, use updatePassword
 * - For email confirmation, use resendConfirmationEmail
 *
 * Architecture:
 * - All functions delegate to AuthProvider via getAuthProvider()
 * - Input validation happens before calling the provider
 * - Error mapping normalizes Supabase errors to app-level AuthError types
 * - Results always follow the pattern: { success, error?, message?, data? }
 *
 * @see AuthProvider - The underlying provider abstraction
 * @see auth-state.ts - AuthStateManager for session management
 * @see lib/services/auth-provider.ts - Provider interface definition
 */

import {
    EmailAlreadyExistsError,
    getAuthProvider,
    InvalidCredentialsError,
    NetworkError,
    RateLimitError,
    type Session,
    UserNotFoundError,
} from "@/lib/services";
import { validateEmail, validatePassword } from "@/validation/";
import { type AuthErrorCode, ERROR_CODES, RetryErrorCode } from "../../maps/ERROR_CODES";
import { logger } from "@/lib/utils";
import {
    checkAuthGuard,
    recordAuthFailure,
    recordAuthSuccess,
} from "./auth-attempt-guard";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Standard result format for auth operations.
 * Used by all public operations in this module.
 */
export interface AuthOperationResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Extended result for signup with optional email-exists modal hint.
 */
export interface SignUpOperationResult extends AuthOperationResult {
  showEmailExistsModal?: boolean;
  redirectTo?: string;
}

/**
 * Extended result for signin with optional redirect hint and validation warning.
 */
export interface SignInOperationResult extends AuthOperationResult {
  redirectTo?: string;
  validationWarning?: string;
}

/**
 * Extended result for password reset with optional email-not-found modal hint.
 */
export interface ResetPasswordOperationResult extends AuthOperationResult {
  showEmailNotFoundModal?: boolean;
}

/**
 * Extended result for resend confirmation email.
 */
export interface ResendOperationResult extends AuthOperationResult {
  retryAfterMs?: number;
}

/**
 * Error retry strategy classification.
 * Determines whether an error should auto-retry or require user action.
 */
interface ErrorRetryStrategy {
  shouldAutoRetry: boolean;
  suggestRetryAfterMs?: number;
  reason: RetryErrorCode;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map normalized AuthError types returned by AuthProvider to human-friendly messages.
 * Provides consistent error classification across all auth operations.
 *
 * @param error - The AuthError from AuthProvider
 * @returns ErrorRetryStrategy with classification
 */
function classifyErrorRetryStrategy(error: unknown): ErrorRetryStrategy {
  if (error instanceof NetworkError) {
    return {
      shouldAutoRetry: true,
      suggestRetryAfterMs: 2000,
      reason: ERROR_CODES.RETRY.TRANSIENT_NETWORK_FAILURE,
    };
  }

  if (error instanceof RateLimitError) {
    return {
      shouldAutoRetry: false,
      suggestRetryAfterMs: (error.retryAfterSeconds || 60) * 1000,
      reason: ERROR_CODES.RETRY.RATE_LIMIT_EXCEEDED,
    };
  }

  if (
    error instanceof InvalidCredentialsError ||
    error instanceof EmailAlreadyExistsError
  ) {
    return {
      shouldAutoRetry: false,
      reason: ERROR_CODES.RETRY.PERMANENT_FAILURE,
    };
  }

  return {
    shouldAutoRetry: false,
    reason: ERROR_CODES.RETRY.UNKNOWN,
  };
}

/**
 * Map a normalized AuthError instance to a canonical `AuthErrorCode`.
 */
export function mapAuthErrorToCode(error: unknown): AuthErrorCode {
  if (error instanceof InvalidCredentialsError) return ERROR_CODES.AUTH.INVALID_CREDENTIALS;
  if (error instanceof EmailAlreadyExistsError)  return ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS;
  if (error instanceof UserNotFoundError)        return ERROR_CODES.AUTH.USER_NOT_FOUND;
  if (error instanceof NetworkError)             return ERROR_CODES.AUTH.UNKNOWN;
  if (error instanceof RateLimitError)           return ERROR_CODES.AUTH.RATE_LIMIT;
  return ERROR_CODES.AUTH.UNKNOWN;
}

// ============================================================================
// SIGNUP OPERATION
// ============================================================================

/**
 * Sign up a new user with email and password.
 *
 * Flow:
 * 1. Validate email format and password strength (client-side)
 * 2. Check rate limiting via AuthGuard
 * 3. Call AuthProvider.signUp() with base64-encoded redirect URL
 * 4. Record success/failure for rate limiting
 * 5. Return structured result with optional email-exists modal hint
 *
 * @param email - User's email address
 * @param password - User's password (will be validated against requirements)
 * @returns SignUpOperationResult with success flag, error message, and optional redirect
 *
 * @example
 * const result = await signUpUser('user@example.com', 'SecurePassword123!');
 * if (result.success) {
 *   router.push(result.redirectTo); // Navigate to email confirmation
 * } else if (result.showEmailExistsModal) {
 *   // Show modal: "Email already in use"
 * }
 */
export const signUpUser = async (
  email: string,
  password: string,
): Promise<SignUpOperationResult> => {
  try {
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    if (!emailValidation.isValid) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: "Password does not meet security requirements.",
      };
    }

    const sanitizedEmail = emailValidation.sanitized;

    // Rate limiting check
    const guard = await checkAuthGuard(sanitizedEmail, "signup");
    if (!guard.allowed) {
      const retrySeconds = guard.retryAfterMs
        ? Math.ceil(guard.retryAfterMs / 1000)
        : undefined;
      return {
        success: false,
        error: retrySeconds
          ? `Too many sign up attempts. Try again in ${retrySeconds} seconds.`
          : "Too many sign up attempts. Please wait before trying again.",
      };
    }

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://dnd-tool.thesnowpost.com";

    const authProvider = await getAuthProvider();
    const signupResult = await authProvider.signUp(sanitizedEmail, password, {
      emailRedirectTo: `${baseUrl}/login/auth-redirect?action=signup-confirm`,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!signupResult.success) {
      await recordAuthFailure(sanitizedEmail, "signup");

      const error = signupResult.error;
      const retryStrategy = classifyErrorRetryStrategy(error);
      const errorCode = mapAuthErrorToCode(error);

      logger.category('auth').debug(`Signup error classified: ${retryStrategy.reason}`, {
        shouldAutoRetry: retryStrategy.shouldAutoRetry,
        suggestRetryAfterMs: retryStrategy.suggestRetryAfterMs,
        errorCode,
      });

      if (error instanceof EmailAlreadyExistsError) {
        return { success: false, showEmailExistsModal: true };
      }

      if (error.message.includes("Password")) {
        return {
          success: false,
          error:
            "Password does not meet requirements. Please check and try again.",
        };
      } else {
        return {
          success: false,
          error: error.message || "Account creation failed. Please try again.",
        };
      }
    }

    await recordAuthSuccess(sanitizedEmail, "signup");

    return {
      success: true,
      redirectTo: `/login/email-confirmation?email=${encodeURIComponent(
        sanitizedEmail
      )}`,
    };
  } catch (error) {
    logger.category('auth').error("Sign up error:", error);
    const message = (error as Error)?.message?.includes("Request timeout")
      ? "The server took too long to respond. Please try again."
      : "An unexpected error occurred. Please try again.";
    return { success: false, error: message };
  }
};

// ============================================================================
// SIGNIN OPERATION
// ============================================================================

/**
 * Sign in an existing user with email and password.
 *
 * Flow:
 * 1. Validate email format (basic syntax check)
 * 2. Check rate limiting via AuthGuard
 * 3. Call AuthProvider.signIn() with user credentials
 * 4. Record success/failure for rate limiting
 * 5. Return structured result with optional redirect
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns SignInOperationResult with success flag and error message
 *
 * @example
 * const result = await signInUser('user@example.com', 'password');
 * if (result.success) {
 *   // AuthProvider manages session state, navigate to main app
 * }
 */
export const signInUser = async (
  email: string,
  password: string,
): Promise<SignInOperationResult> => {
  try {
    const emailValidation = validateEmail(email);

    if (!emailValidation.isValid) {
      return { success: false, error: "Please enter a valid email address." };
    }

    const sanitizedEmail = emailValidation.sanitized;

    // Rate limiting check
    const guard = await checkAuthGuard(sanitizedEmail, "signin");
    if (!guard.allowed) {
      const retrySeconds = guard.retryAfterMs
        ? Math.ceil(guard.retryAfterMs / 1000)
        : undefined;
      return {
        success: false,
        error: retrySeconds
          ? `Too many sign in attempts. Try again in ${retrySeconds} seconds.`
          : "Too many sign in attempts. Please wait before trying again.",
      };
    }

    const authProvider = await getAuthProvider();
    const signinResult = await authProvider.signIn(
      sanitizedEmail,
      password,
    );

    if (!signinResult.success) {
      await recordAuthFailure(sanitizedEmail, "signin");

      const error = signinResult.error;
      const retryStrategy = classifyErrorRetryStrategy(error);
      const errorCode = mapAuthErrorToCode(error);

      logger.category('auth').debug(`Sign in error classified: ${retryStrategy.reason}`, {
        shouldAutoRetry: retryStrategy.shouldAutoRetry,
        suggestRetryAfterMs: retryStrategy.suggestRetryAfterMs,
        errorCode,
      });

      if (error instanceof InvalidCredentialsError) {
        return {
          success: false,
          error: "Invalid email or password. Please try again.",
        };
      } else if (error instanceof UserNotFoundError) {
        return {
          success: false,
          error: "No account found with this email. Please sign up first.",
        };
      } else {
        return {
          success: false,
          error: error.message || "Sign in failed. Please try again.",
        };
      }
    }

    await recordAuthSuccess(sanitizedEmail, "signin");

    return {
      success: true,
    };
  } catch (error) {
    logger.category('auth').error("Sign in error:", error);
    const message = (error as Error)?.message?.includes("Request timeout")
      ? "The server took too long to respond. Please try again."
      : "An unexpected error occurred. Please try again.";
    return { success: false, error: message };
  }
};

// ============================================================================
// PASSWORD RESET OPERATION
// ============================================================================

/**
 * Send a password reset email to a user's email address.
 *
 * Flow:
 * 1. Validate email format
 * 2. Call AuthProvider.resetPassword()
 * 3. Return structured result with optional email-not-found modal hint
 *
 * @param email - User's email address to send reset link
 * @returns ResetPasswordOperationResult with success flag and error message
 *
 * @example
 * const result = await sendPasswordReset('user@example.com');
 * if (result.success) {
 *   // Show message: "Check your email for reset link"
 * }
 */
export const sendPasswordReset = async (
  email: string,
): Promise<ResetPasswordOperationResult> => {
  try {
    const emailValidation = validateEmail(email);

    if (!emailValidation.isValid) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    const sanitizedEmail = emailValidation.sanitized;

    const authProvider = await getAuthProvider();
    const resetResult = await authProvider.resetPassword(sanitizedEmail);

    if (!resetResult.success) {
      logger.category('auth').warn("Reset password failed for email:", {
        email: sanitizedEmail,
        message: resetResult.message,
      });
      // For security, don't reveal whether email exists
      // Still show success message to prevent email enumeration attacks
      return {
        success: true,
        message: "If an account exists with this email, you will receive a reset link.",
        showEmailNotFoundModal: false, // Security: don't reveal non-existent emails
      };
    }

    logger.category('auth').info("Password reset email sent", { email: sanitizedEmail });
    return {
      success: true,
      message: "Check your email for a password reset link.",
    };
  } catch (error) {
    logger.category('auth').error("Password reset error:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
};

// ============================================================================
// UPDATE PASSWORD OPERATION
// ============================================================================

/**
 * Update the current user's password (authenticated operation).
 *
 * Flow:
 * 1. Validate new password strength
 * 2. Require authentication (user must have valid session)
 * 3. Call AuthProvider.updatePassword()
 * 4. Return structured result
 *
 * @param newPassword - The new password to set
 * @returns AuthOperationResult with success flag and error message
 *
 * @example
 * const result = await updatePassword('NewSecurePassword123!');
 * if (result.success) {
 *   // Password updated, may need to re-authenticate
 * }
 */
export const updatePassword = async (
  newPassword: string,
): Promise<AuthOperationResult> => {
  try {
    const passwordValidation = validatePassword(newPassword);

    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: "Password does not meet security requirements.",
      };
    }

    const authProvider = await getAuthProvider();

    // Guard: must be authenticated before updating password
    const currentSession = await authProvider.getSession();
    if (!currentSession) {
      return {
        success: false,
        error: "You must be signed in to change your password.",
      };
    }

    const updateResult = await authProvider.updatePassword(newPassword);

    if (!updateResult.success) {
      logger.category('auth').error("Update password error:", updateResult.error);
      return {
        success: false,
        error: updateResult.error || "Failed to update password. Please try again.",
      };
    }

    logger.category('auth').info("Password updated successfully");
    return {
      success: true,
      message: "Password updated successfully.",
    };
  } catch (error) {
    logger.category('auth').error("Update password error:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
};

// ============================================================================
// RESEND CONFIRMATION EMAIL OPERATION
// ============================================================================

/**
 * Resend the email confirmation link to a user's email address.
 *
 * This is called when a user didn't receive the initial confirmation email
 * or accidentally dismissed it. Includes rate limiting to prevent abuse.
 *
 * Flow:
 * 1. Validate email format
 * 2. Check rate limiting (prevent rapid resend attempts)
 * 3. Call AuthProvider.resend()
 * 4. Return structured result with retry hint on rate limit
 *
 * @param email - The email address to send confirmation to
 * @returns ResendOperationResult with success flag and optional retry timing
 *
 * @example
 * const result = await resendConfirmationEmail('user@example.com');
 * if (result.success) {
 *   // Show message: "Confirmation email sent"
 *   // Disable button for result.retryAfterMs milliseconds
 * }
 */
export const resendConfirmationEmail = async (
  email: string,
): Promise<ResendOperationResult> => {
  try {
    const emailValidation = validateEmail(email);

    if (!emailValidation.isValid) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    const sanitizedEmail = emailValidation.sanitized;

    // Resend uses "reset" scope for rate limiting (both are transient operations)
    const guard = await checkAuthGuard(sanitizedEmail, "reset");
    if (!guard.allowed) {
      // For resend, we want to inform the user when they can try again
      const retryAfterMs = guard.retryAfterMs || 60000; // Default 60s if not specified
      return {
        success: false,
        error: "Please wait before requesting another confirmation email.",
        retryAfterMs,
      };
    }

    const authProvider = await getAuthProvider();
    const resendResult = await authProvider.resend(sanitizedEmail);

    if (!resendResult.success) {
      logger.category('auth').warn("Resend confirmation failed:", {
        email: sanitizedEmail,
        message: resendResult.message,
      });
      return {
        success: false,
        error:
          resendResult.message ||
          "Failed to resend confirmation email. Please try again.",
      };
    }

    logger.category('auth').info("Confirmation email resent", { email: sanitizedEmail });
    return {
      success: true,
      message: resendResult.message || "Confirmation email sent.",
      retryAfterMs: 30000, // Suggest 30 second cooldown for UI
    };
  } catch (error) {
    logger.category('auth').error("Resend confirmation error:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
};

/**
 * Sign out the current user and clear session state.
 *
 * For a comprehensive sign-out that also clears caches and user data,
 * use `signOutUser` from lib/settings instead.
 *
 * This is a simple wrapper over AuthProvider.signOut() for symmetry
 * with other auth operations. Use this only if you need minimal logout without cache cleanup.
 *
 * @returns AuthOperationResult with success flag
 * @deprecated Use `signOutUser` from lib/settings for comprehensive sign-out with cache cleanup
 *
 * @example
 * // For comprehensive sign-out with cache cleanup:
 * import { signOutUser } from '@/lib/settings';
 * await signOutUser();
 *
 * // For minimal sign-out (provider only):
 * const result = await signOutSessionOnly();
 * if(result.success) router.replace('/login/sign-in');
 */
export const signOutSessionOnly = async (): Promise<AuthOperationResult> => {
  try {
    const authProvider = await getAuthProvider();
    await authProvider.signOut();

    logger.category('auth').info("User signed out from session");
    return {
      success: true,
      message: "Signed out successfully.",
    };
  } catch (error) {
    logger.category('auth').error("Sign out error:", error);
    return {
      success: false,
      error: "An unexpected error occurred during sign out.",
    };
  }
};

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/**
 * Get the current auth session.
 *
 * Thin wrapper over `getAuthProvider().getSession()` for use in components and
 * hooks that don't need the full provider. Returns null safely if the provider
 * is not yet initialized or no session exists.
 *
 * @returns The current Session, or null if unauthenticated
 *
 * @example
 * const session = await getCurrentSession();
 * if (!session) { router.replace('/login/sign-in'); }
 */
export const getCurrentSession = async (): Promise<Session | null> => {
  try {
    const provider = await getAuthProvider();
    return await provider.getSession();
    } catch (error) {
    logger.category('auth').error("Failed to get current session:", error);
    return null;
  }
};

/**
 * Subscribe to auth state changes.
 *
 * Wraps `provider.onAuthStateChange()` so components don't need to call
 * `getAuthProvider()` directly. Returns an unsubscribe function.
 *
 * For React components, prefer the `useAuthStateListener` hook which manages
 * the subscription lifecycle automatically.
 *
 * @param callback - Called whenever the session changes (login, logout, refresh)
 * @returns Cleanup function — call it to unsubscribe
 *
 * @example
 * const unsubscribe = await listenToAuthStateChanges((session) => {
 *   if (!session) redirectToLogin();
 * });
 * // Later:
 * unsubscribe();
 */
export const listenToAuthStateChanges = async (
  callback: (session: Session | null) => void,
): Promise<() => void> => {
  try {
    const provider = await getAuthProvider();
    return provider.onAuthStateChange(callback);
  } catch (error) {
    logger.category('auth').error("Failed to set up auth state listener:", error);
    return () => {}; // No-op cleanup on failure
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export from authService (these are still used by hooks)
export {
    checkPendingInvites,
    generateWorldInviteLink,
    type ResetPasswordResult,
    type SignInResult,
    type SignUpResult
} from "./authService";

