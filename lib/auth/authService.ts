import {
    AuthError,
    EmailAlreadyExistsError,
    getAuthProvider,
    InvalidCredentialsError,
    NetworkError,
    RateLimitError,
    UserNotFoundError,
} from "@/lib/services";
import { usersDB } from "../database/users";
import { SecureStorage, STORAGE_KEYS } from "../storage";
import { logger } from "../utils/logger";
import {
    checkAuthGuard,
    recordAuthFailure,
    recordAuthSuccess,
} from "./auth-attempt-guard";
import { validateEmail, validatePassword } from "./validation";

export interface SignUpResult {
  success: boolean;
  error?: string;
  validationWarning?: string; // When client validation passed but server validation failed
  showEmailExistsModal?: boolean;
  redirectTo?: string;
}

export interface SignInResult {
  success: boolean;
  error?: string;
  validationWarning?: string; // When client validation passed but server validation failed
  redirectTo?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
  message?: string;
  showEmailNotFoundModal?: boolean;
}

/**
 * Error retry strategy classification.
 * Determines whether an error should auto-retry or require user action.
 *
 * **Auto-retry (transient failures):**
 * - NetworkError (connection issues, timeouts) — user should retry after network restored
 * - RateLimitError — suggest waiting before retrying (provides retryAfterSeconds)
 *
 * **No auto-retry (permanent failures):**
 * - InvalidCredentialsError — user must submit correct credentials again
 * - EmailAlreadyExistsError — user must use different email
 * - Other AuthErrors — require user intervention
 */
interface ErrorRetryStrategy {
  shouldAutoRetry: boolean;
  suggestRetryAfterMs?: number;
  reason: string;
}

/**
 * Map Supabase errors to normalized AuthError types.
 * Provides consistent error classification across signup/signin flows.
 */
function mapSupabaseErrorToNormalized(supabaseError: any): AuthError {
  const message = supabaseError?.message || 'Unknown auth error';
  const code = supabaseError?.code || supabaseError?.status;
  const messageLower = message.toLowerCase();

  // Invalid credentials
  if (
    messageLower.includes('invalid login credentials') ||
    messageLower.includes('invalid credentials') ||
    messageLower.includes('invalid email or password') ||
    messageLower.includes('incorrect password') ||
    code === 'invalid_credentials'
  ) {
    return new InvalidCredentialsError(message, supabaseError);
  }

  // Email already exists (signup conflicts)
  if (
    messageLower.includes('user already registered') ||
    messageLower.includes('already registered') ||
    messageLower.includes('already been registered') ||
    messageLower.includes('email address not available') ||
    messageLower.includes('duplicate key value') ||
    messageLower.includes('duplicate email') ||
    messageLower.includes('unique constraint') ||
    code === '23505' || // Postgres unique constraint error
    code === 'user_already_exists'
  ) {
    return new EmailAlreadyExistsError(message, supabaseError);
  }

  // User not found (reset password target)
  if (
    messageLower.includes('user not found') ||
    messageLower.includes('no user found') ||
    messageLower.includes('user does not exist') ||
    code === 'user_not_found'
  ) {
    return new UserNotFoundError(message, supabaseError);
  }

  // Rate limit exceeded (too many attempts)
  if (
    code === 429 ||
    code === 'RATE_LIMIT' ||
    messageLower.includes('too many') ||
    messageLower.includes('rate limit') ||
    messageLower.includes('throttle')
  ) {
    // Try to extract retry-after seconds from message (pattern: "123 seconds" or "123s")
    const retryAfterMatch = messageLower.match(/(\d+)/);
    const retryAfterSeconds = retryAfterMatch?.[1] ? parseInt(retryAfterMatch[1], 10) : undefined;
    return new RateLimitError(message, supabaseError, retryAfterSeconds);
  }

  // Network errors and timeouts
  if (
    messageLower.includes('request timeout') ||
    messageLower.includes('network') ||
    messageLower.includes('fetch failed') ||
    messageLower.includes('econnrefused') ||
    messageLower.includes('enotfound') ||
    messageLower.includes('time out') ||
    supabaseError instanceof TypeError ||
    code === 'NETWORK_ERROR' ||
    code === 'ETIMEDOUT'
  ) {
    return new NetworkError(message, supabaseError);
  }

  // Default: generic AuthError
  return new AuthError(message, supabaseError, code);
}

function classifyErrorRetryStrategy(error: unknown): ErrorRetryStrategy {
  if (error instanceof NetworkError) {
    return {
      shouldAutoRetry: true,
      suggestRetryAfterMs: 2000, // Wait 2s before auto-retry
      reason: "transient_network_failure",
    };
  }

  if (error instanceof RateLimitError) {
    return {
      shouldAutoRetry: false, // User should wait, not retry immediately
      suggestRetryAfterMs: (error.retryAfterSeconds || 60) * 1000,
      reason: "rate_limit_exceeded",
    };
  }

  // Permanent failures: InvalidCredentialsError, EmailAlreadyExistsError, etc.
  if (error instanceof InvalidCredentialsError || error instanceof EmailAlreadyExistsError) {
    return {
      shouldAutoRetry: false,
      reason: "permanent_failure",
    };
  }

  // Unknown or other errors: don't auto-retry
  return {
    shouldAutoRetry: false,
    reason: "unknown_error",
  };
}

// Sign up a new user
export const signUpUser = async (
  email: string,
  password: string,
): Promise<SignUpResult> => {
  try {
    // Validate and sanitize inputs
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

    // Use sanitized email
    const sanitizedEmail = emailValidation.sanitized;

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

    // Call AuthProvider directly (no RequestManager wrapper for auth operations)
    const authProvider = await getAuthProvider();
    const signupResult = await authProvider.signUp(sanitizedEmail, password, {
      emailRedirectTo: `${baseUrl}/login/auth-redirect?action=signup-confirm`,
    });

    // Give backend a moment to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!signupResult.success) {
      await recordAuthFailure(sanitizedEmail, "signup");
      
      const error = signupResult.error;
      const retryStrategy = classifyErrorRetryStrategy(error);
      
      logger.debug("auth", `Signup error classified: ${retryStrategy.reason}`, {
        shouldAutoRetry: retryStrategy.shouldAutoRetry,
        suggestRetryAfterMs: retryStrategy.suggestRetryAfterMs,
      });
      
      // Check for email already exists error
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
          error:
            error.message || "Account creation failed. Please try again.",
        };
      }
    } else {
      await recordAuthSuccess(sanitizedEmail, "signup");

      // Successful signup
      return {
        success: true,
        redirectTo: `/login/email-confirmation?email=${encodeURIComponent(sanitizedEmail)}`,
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  } catch (error) {
    logger.error("auth", "Sign up error:", error);
    const message = (error as Error)?.message?.includes("Request timeout")
      ? "The server took too long to respond. Please try again."
      : "An unexpected error occurred. Please try again.";
    return { success: false, error: message };
  }
};

// Sign in an existing user
export const signInUser = async (
  email: string,
  password: string,
): Promise<SignInResult> => {
  logger.debug("auth", `🔐 Sign-in attempt for email: ${email}`);

  try {
    // Validate and sanitize inputs
    const emailValidation = validateEmail(email);

    if (!emailValidation.isValid) {
      logger.warn("auth", "❌ Invalid email format");
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    // Use sanitized email
    const sanitizedEmail = emailValidation.sanitized;
    logger.debug("auth", `✅ Email validated: ${sanitizedEmail}`);

    const guard = await checkAuthGuard(sanitizedEmail, "signin");
    if (!guard.allowed) {
      const retrySeconds = guard.retryAfterMs
        ? Math.ceil(guard.retryAfterMs / 1000)
        : undefined;
      logger.warn(
        "auth",
        `🚫 Auth guard blocked sign-in for ${sanitizedEmail}`,
      );
      return {
        success: false,
        error: retrySeconds
          ? `Too many login attempts. Try again in ${retrySeconds} seconds.`
          : "Too many login attempts. Please wait before trying again.",
      };
    }

    logger.debug(
      "auth",
      `🔐 Calling AuthProvider signIn for ${sanitizedEmail}...`,
    );
    const signInStartTime = Date.now();

    // Call AuthProvider directly (no RequestManager wrapper for auth operations)
    const authProvider = await getAuthProvider();
    const signInResult = await authProvider.signIn(sanitizedEmail, password);

    const signInElapsed = Date.now() - signInStartTime;
    logger.debug("auth", `⏱️ Sign-in API call completed in ${signInElapsed}ms`);

    if (!signInResult.success) {
      await recordAuthFailure(sanitizedEmail, "signin");
      
      const error = signInResult.error;
      const retryStrategy = classifyErrorRetryStrategy(error);
      
      logger.error("auth", `❌ Sign-in error:`, error.message);
      logger.debug("auth", `Sign-in error classified: ${retryStrategy.reason}`, {
        shouldAutoRetry: retryStrategy.shouldAutoRetry,
        suggestRetryAfterMs: retryStrategy.suggestRetryAfterMs,
      });
      
      if (error instanceof InvalidCredentialsError) {
        return {
          success: false,
          error:
            "No account found or incorrect password. Don't have an account? Sign up to get started. 🎲",
        };
      }

      if (error.message.includes("Email not confirmed")) {
        return {
          success: false,
          error:
            "Please confirm your email first. Check your inbox for a verification link.",
        };
      }

      return {
        success: false,
        error: error.message || "Sign in failed. Please try again.",
      };
    }

    // Successful sign in
    const session = signInResult.data;
    await recordAuthSuccess(sanitizedEmail, "signin");
    logger.info(
      "auth",
      `✅ Sign-in successful for ${sanitizedEmail}, setting auth state...`,
    );

    // Set local auth state so route guards work immediately
    const { AuthStateManager } = await import("./auth-state");
    
    // CRITICAL: Save the session tokens to encrypted storage (web platform)
    // This must happen BEFORE setHasAccount to ensure tokens are persisted
    logger.debug("auth", "🔐 Session structure:", {
      hasUserId: !!session.userId,
      hasEmail: !!session.email,
      hasAccessToken: !!session.accessToken,
      hasRefreshToken: !!session.refreshToken,
      hasRaw: !!session.raw,
    });

    if (session.raw) {
      logger.debug("auth", "💾 Persisting auth session tokens to storage...");
      await AuthStateManager.setSession(session.raw);
    } else {
      logger.warn("auth", "⚠️ No raw session data in sign-in response");
    }
      
      await AuthStateManager.setHasAccount(true);

      // Record successful login timestamp (for welcome screen skip - valid for 7 days)
      const { SecureStorage, STORAGE_KEYS } = await import("@/lib/storage");
      await SecureStorage.setItem(
        STORAGE_KEYS.LAST_LOGGED_IN,
        Date.now().toString(),
      );
      logger.debug("auth", "✅ Auth state set, login timestamp recorded");

      // Check if user has a complete profile
      try {
        const profileStartTime = Date.now();
        const userProfile = await usersDB.getCurrentUser();
        const profileElapsed = Date.now() - profileStartTime;
        logger.debug(
          "auth",
          `⏱️ User profile fetch completed in ${profileElapsed}ms`,
        );

        // CRITICAL: Ensure user data is saved to storage before continuing
        // This ensures the userId context can load it immediately when the route renders
        logger.debug("auth", "💾 Ensuring user data is saved to storage...");
        await AuthStateManager.saveUserData(userProfile);
        logger.debug("auth", "✅ User data saved, userId available in storage");

        // Robust profile validation
        const hasValidProfile =
          userProfile &&
          userProfile.username &&
          userProfile.username.trim().length > 0;

        logger.debug(
          "auth",
          `Profile validation: hasValidProfile=${hasValidProfile}`,
        );

        // Check for pending invites
        const pendingInvite = await checkPendingInvites();
        logger.debug(
          "auth",
          `Pending invite check: ${pendingInvite ? "found" : "none"}`,
        );

        if (hasValidProfile) {
          // Profile is complete
          if (pendingInvite) {
            // Has pending invite - redirect to auth-redirect to process it
            logger.info(
              "auth",
              `🎫 Redirecting to auth-redirect for pending invite`,
            );
            if (typeof window !== "undefined") {
              await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE); // Clean up
            }
            return {
              success: true,
              redirectTo: `/login/auth-redirect?action=world-invite&token=${pendingInvite.token}&worldName=${encodeURIComponent(pendingInvite.worldName)}`,
            };
          } else {
            // No pending invite - go to world selection
            logger.info("auth", `🌍 Redirecting to world selection`);
            return {
              success: true,
              redirectTo: "/select/world-selection",
            };
          }
        } else {
          // Profile needs completion
          return {
            success: true,
            redirectTo: "/login/complete-profile",
          };
        }
      } catch (profileError) {
        logger.error(
          "auth",
          "Database error during sign-in profile check:",
          profileError,
        );
        // If database is unreachable, let user proceed to main app
        // They can complete profile when database is available
        // This prevents infinite redirect loops during database outages
        return {
          success: true,
          redirectTo: "/select/world-selection",
        };
      }
  } catch (error) {
    logger.error("auth", "Sign in error:", error);
    const message = (error as Error)?.message?.includes("Request timeout")
      ? "The server took too long to respond. Please try again."
      : (error as Error)?.message?.includes("fetch")
        ? "Connection error. Please check your internet and try again."
        : "Sign in failed. Please try again.";
    return { success: false, error: message };
  }
};

// Check if email already exists error
export const isEmailExistsError = (error: any): boolean => {
  return (
    error?.message?.includes("User already registered") ||
    error?.message?.includes("already registered") ||
    error?.message?.includes("already been registered") ||
    error?.message?.includes("email address not available") ||
    error?.message?.includes("duplicate key value") ||
    error?.code === "23505"
  );
};

// Send password reset email
export const sendPasswordReset = async (
  email: string,
): Promise<ResetPasswordResult> => {
  try {
    // Validate and sanitize input
    const emailValidation = validateEmail(email);

    if (!emailValidation.isValid) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    // Use sanitized email
    const sanitizedEmail = emailValidation.sanitized;

    const guard = await checkAuthGuard(sanitizedEmail, "reset");
    if (!guard.allowed) {
      const retrySeconds = guard.retryAfterMs
        ? Math.ceil(guard.retryAfterMs / 1000)
        : undefined;
      return {
        success: false,
        error: retrySeconds
          ? `Too many reset attempts. Try again in ${retrySeconds} seconds.`
          : "Too many reset attempts. Please wait before trying again.",
      };
    }

    // Proceed with password reset; backend will send email only if account exists.
    const authProvider = await getAuthProvider();
    const resetResult = await authProvider.resetPassword(sanitizedEmail);

    if (!resetResult.success) {
      // Log error details for debugging, but return generic message to prevent email enumeration
      logger.error(
        "auth",
        "Password reset API error (full details for debugging):",
        { message: resetResult.message },
      );
      return {
        success: true,
        message:
          "If that email exists, a reset link has been sent. Please check your inbox.",
      };
    }

    await recordAuthSuccess(sanitizedEmail, "reset");

    return {
      success: true,
      message:
        "If that email exists, a reset link has been sent. Please check your inbox.",
    };
  } catch (error) {
    logger.error("auth", "Password reset error:", error);
    const message = (error as Error)?.message?.includes("Request timeout")
      ? "The server took too long to respond. Please try again."
      : "An unexpected error occurred. Please try again.";
    return { success: false, error: message };
  }
};

// Update password after reset (called from reset confirmation page)
export const updatePassword = async (
  newPassword: string,
): Promise<ResetPasswordResult> => {
  try {
    const authProvider = await getAuthProvider();
    const result = await authProvider.updatePassword(newPassword);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update password. Please try again.",
      };
    }

    return {
      success: true,
      message:
        "Password updated successfully! You can now sign in with your new password.",
    };
  } catch (error) {
    logger.error("auth", "Password update error:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
};

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
        logger.debug("auth", "Invite link copied to clipboard!");
      } catch {
        logger.debug("auth", "Could not copy to clipboard automatically");
      }
    }

    logger.info("auth", "World Invite Link Generated:", {
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
    logger.error("auth", "Failed to generate invite link:", error);
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
    const stored = await SecureStorage.getItem(STORAGE_KEYS.PENDING_INVITE);
    if (stored) {
      try {
        const inviteData = JSON.parse(stored);
        // Check if invite is less than 24 hours old
        if (Date.now() - inviteData.timestamp < 24 * 60 * 60 * 1000) {
          return { token: inviteData.token, worldName: inviteData.worldName };
        } else {
          // Clean up expired invite
          await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE);
        }
      } catch (error) {
        logger.error("auth", "Error parsing pending invite:", error);
        await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE);
      }
    }
  }
  return null;
};
