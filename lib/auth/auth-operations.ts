/**
 * Auth Operations — pure domain logic
 *
 * Provides:
 * - Unified result types for all auth operations
 * - Pre-flight helpers: validate inputs + check rate limits
 * - Record helpers: track success/failure for rate limiting
 * - Error mappers: convert adapter errors to user-facing results
 *
 * Has NO knowledge of auth-service or system/Services adapters.
 * auth-manager is the only consumer of these helpers and the only
 * file that calls auth-service.
 */

import {
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    NetworkError,
    RateLimitError,
    UserNotFoundError,
} from "@/lib/error";
import { logger } from "@/lib/utils";
import { type AuthErrorCode, ERROR_CODES } from "@/maps";
import type { Session } from "@/middleware/services";
import { validateEmail, validatePassword } from "@/validation/";
import {
    checkAuthGuard,
    recordAuthFailure,
    recordAuthSuccess,
} from "./auth-attempt-guard";

// ============================================================================
// TYPES — single source of truth for all auth result shapes
// ============================================================================

export interface AuthOperationResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface SignUpResult extends AuthOperationResult {
  showEmailExistsModal?: boolean;
  redirectTo?: string;
  validationWarning?: string;
}

export interface SignInResult extends AuthOperationResult {
  redirectTo?: string;
  validationWarning?: string;
}

export interface ResetPasswordResult extends AuthOperationResult {
  showEmailNotFoundModal?: boolean;
}

export interface ResendResult extends AuthOperationResult {
  retryAfterMs?: number;
}

// Re-export for consumers that import from @/lib/auth
export type { Session };

// ============================================================================
// ERROR MAPPING
// ============================================================================

/**
 * Map a normalized adapter error to a canonical AuthErrorCode.
 * Exported for hooks/components that need to branch on error type.
 */
export function mapAuthErrorToCode(error: unknown): AuthErrorCode {
  if (error instanceof InvalidCredentialsError) return ERROR_CODES.AUTH.INVALID_CREDENTIALS;
  if (error instanceof EmailAlreadyExistsError)  return ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS;
  if (error instanceof UserNotFoundError)        return ERROR_CODES.AUTH.USER_NOT_FOUND;
  if (error instanceof RateLimitError)           return ERROR_CODES.AUTH.RATE_LIMIT;
  return ERROR_CODES.AUTH.UNKNOWN;
}

/** Map a sign-up service failure to a user-facing SignUpResult. */
export function mapSignUpError(error: unknown): SignUpResult {
  if (error instanceof EmailAlreadyExistsError) {
    return { success: false, showEmailExistsModal: true };
  }
  const msg = (error as any)?.message ?? "";
  if (msg.includes("Password")) {
    return { success: false, error: "Password does not meet requirements. Please check and try again." };
  }
  return { success: false, error: msg || "Account creation failed. Please try again." };
}

/** Map a sign-in service failure to a user-facing SignInResult. */
export function mapSignInError(error: unknown): SignInResult {
  if (error instanceof InvalidCredentialsError) {
    return { success: false, error: "Invalid email or password. Please try again." };
  }
  if (error instanceof UserNotFoundError) {
    return { success: false, error: "No account found with this email. Please sign up first." };
  }
  const msg = (error as any)?.message ?? "";
  return { success: false, error: msg || "Sign in failed. Please try again." };
}

// ============================================================================
// PRE-FLIGHT HELPERS — validate inputs + check rate limits
//
// Pattern: returns { ready: true, sanitizedEmail } on pass, or
//          { ready: false, result } for early-exit with a user-facing result.
// auth-manager calls these before touching auth-service.
// ============================================================================

type PrepOk      = { ready: true; sanitizedEmail: string };
type PrepFail<T> = { ready: false; result: T };

export async function prepareSignUp(
  email: string,
  password: string,
): Promise<PrepOk | PrepFail<SignUpResult>> {
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return { ready: false, result: { success: false, error: "Please enter a valid email address." } };
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return { ready: false, result: { success: false, error: "Password does not meet security requirements." } };
  }

  const sanitizedEmail = emailValidation.sanitized;
  const guard = await checkAuthGuard(sanitizedEmail, "signup");
  if (!guard.allowed) {
    const retrySeconds = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 1000) : undefined;
    return {
      ready: false,
      result: {
        success: false,
        error: retrySeconds
          ? `Too many sign up attempts. Try again in ${retrySeconds} seconds.`
          : "Too many sign up attempts. Please wait before trying again.",
      },
    };
  }

  return { ready: true, sanitizedEmail };
}

export async function prepareSignIn(
  email: string,
): Promise<PrepOk | PrepFail<SignInResult>> {
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return { ready: false, result: { success: false, error: "Please enter a valid email address." } };
  }

  const sanitizedEmail = emailValidation.sanitized;
  const guard = await checkAuthGuard(sanitizedEmail, "signin");
  if (!guard.allowed) {
    const retrySeconds = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 1000) : undefined;
    return {
      ready: false,
      result: {
        success: false,
        error: retrySeconds
          ? `Too many sign in attempts. Try again in ${retrySeconds} seconds.`
          : "Too many sign in attempts. Please wait before trying again.",
      },
    };
  }

  return { ready: true, sanitizedEmail };
}

export async function prepareResetPassword(
  email: string,
): Promise<PrepOk | PrepFail<ResetPasswordResult>> {
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return { ready: false, result: { success: false, error: "Please enter a valid email address." } };
  }

  const sanitizedEmail = emailValidation.sanitized;
  const guard = await checkAuthGuard(sanitizedEmail, "reset");
  if (!guard.allowed) {
    const retrySeconds = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 1000) : undefined;
    return {
      ready: false,
      result: {
        success: false,
        error: retrySeconds
          ? `Too many reset attempts. Try again in ${retrySeconds} seconds.`
          : "Too many reset attempts. Please wait before trying again.",
      },
    };
  }

  return { ready: true, sanitizedEmail };
}

export async function prepareUpdatePassword(
  password: string,
): Promise<{ ready: true } | PrepFail<AuthOperationResult>> {
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return { ready: false, result: { success: false, error: "Password does not meet security requirements." } };
  }
  return { ready: true };
}

export async function prepareResendConfirmation(
  email: string,
): Promise<PrepOk | PrepFail<ResendResult>> {
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) {
    return { ready: false, result: { success: false, error: "Please enter a valid email address." } };
  }

  const sanitizedEmail = emailValidation.sanitized;
  const guard = await checkAuthGuard(sanitizedEmail, "reset");
  if (!guard.allowed) {
    const retryAfterMs = guard.retryAfterMs ?? 60_000;
    return {
      ready: false,
      result: {
        success: false,
        error: "Please wait before requesting another confirmation email.",
        retryAfterMs,
      },
    };
  }

  return { ready: true, sanitizedEmail };
}

// ============================================================================
// RECORD OUTCOME — track success/failure for rate limiting
// ============================================================================

export async function recordAuthAttempt(
  email: string,
  scope: "signup" | "signin" | "reset",
  success: boolean,
): Promise<void> {
  try {
    if (success) {
      await recordAuthSuccess(email, scope);
    } else {
      await recordAuthFailure(email, scope);
    }
  } catch (error) {
    logger.category("auth").warn("Failed to record auth attempt:", error);
  }
}

// ============================================================================
// CREDENTIAL VALIDATION — lightweight input check (no service call)
// ============================================================================

/**
 * Validate email + password format only (no rate limit, no service call).
 * Used by account operations needing to verify inputs before calling auth-manager.
 */
export function validateCredentialInputs(
  email: string,
  password: string,
): { valid: true } | { valid: false; error: string } {
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) return { valid: false, error: "Please enter a valid email address." };

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) return { valid: false, error: "Password is invalid." };

  return { valid: true };
}

// Suppress unused import warning — NetworkError kept for completeness of error class imports
void NetworkError;
