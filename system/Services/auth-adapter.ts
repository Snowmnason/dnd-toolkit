/**
 * Auth Provider Interface & Registration API
 *
 * This module provides the core abstraction for pluggable authentication backends.
 * Implementations (Supabase, Firebase, custom) should implement `AuthProvider`.
 *
 * Error handling:
 * - Errors are normalized to semantic types (InvalidCredentialsError, NetworkError, etc.)
 * - Each error retains the original provider error on `.original` for debugging
 * - Errors implement a `toLog()` method that redacts PII before logging
 *
 * Registration:
 * - Call `registerAuthProvider()` during app bootstrap (before auth guards run)
 * - Support both instances and async factories for flexibility
 * - `getAuthProvider()` throws if called before registration
 */

import { isDevelopment } from '@/config';
import { logger } from '@/lib/utils';
import { RedactionManager } from "@/pure-algo-immutables";
import { validateEmail, validatePassword } from '@/validation/validation';

/**
 * Session data returned by auth provider.
 * Provider-agnostic; contains only essential fields for app-level state management.
 */
export interface Session {
  userId: string;
  email?: string;       // User email — populated by providers that have it (e.g. Supabase)
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  raw?: any; // Provider-specific payload (opaque to app)
}

/**
 * Result wrapper for auth operations (sign up, sign in).
 * Matches the pattern: either { success: true; data } or { success: false; error }
 */
export type AuthResult<T = Session> =
  | { success: true; data: T }
  | { success: false; error: AuthError };

/**
 * Core auth provider interface.
 * Any backend (Supabase, Firebase, custom) should implement this.
 *
 * **Security Expectations:**
 * Implementations should assume inputs are **already validated by the caller** (app layer).
 * Input validation (email format, password strength, SQL injection prevention) is responsibility of the app/AuthStateManager.
 * Providers should focus on backend-specific security: token handling, session persistence, error normalization.
 *
 * **Error Handling:**
 * All methods should map backend errors to normalized AuthError types before returning.
 * Preserve original error on `.original` field for debugging (never log raw provider errors).
 * Redact PII from error messages returned to app.
 */
export interface AuthProvider {
  /**
   * Sign up a new user with email and password.
   *
   * **Input Expectations:**
   * - email: Already validated (format, length, no SQL keywords, no control chars)
   * - password: Already validated (strength, length, no dangerous patterns)
   * - options: Optional provider-specific options (e.g., emailRedirectTo for email confirmation)
   *
   * **Returns:**
   * - { success: true; data: Session } on successful registration
   * - { success: false; error: AuthError } on failure (mapped to normalized error type)
   *
   * **Provider Responsibilities:**
   * - Create user account in backend
   * - Generate and return session tokens if applicable
   * - Map backend errors (e.g., email already exists) to AuthError types
   */
  signUp(email: string, password: string, options?: Record<string, any>): Promise<AuthResult>;

  /**
   * Sign in an existing user with email and password.
   *
   * **Input Expectations:**
   * - email: Already validated (format, length, no SQL keywords, no control chars)
   * - password: Already validated (no dangerous patterns)
   *
   * **Returns:**
   * - { success: true; data: Session } on successful authentication
   * - { success: false; error: AuthError } on failure (mapped to normalized error type)
   *
   * **Provider Responsibilities:**
   * - Verify credentials against backend
   * - Generate and return session tokens
   * - Map backend errors (invalid credentials, user not found, etc.) to AuthError types
   */
  signIn(email: string, password: string): Promise<AuthResult>;

  /**
   * Initiate OAuth sign-in flow (OAuth 2.0 with provider redirect).
   *
   * For web: Returns a URL that should be opened in a browser or redirect.
   * For mobile: May initiate native flow or return a URL to open with a browser library.
   *
   * **Input:**
   * - provider: 'google', 'apple', etc.
   * - options: Provider-specific options (redirectTo, skipBrowserRedirect, queryParams, etc.)
   *
   * **Returns:**
   * - { url: string } if browser flow needed (open in browser, then handle callback)
   * - { session: Session } if native flow completed immediately
   * - Throws error on failure
   *
   * **Provider Responsibilities:**
   * - Initiate OAuth flow with provider
   * - Return URL for browser redirect (most common case)
   * - Map provider errors to AuthError types
   */
  signInWithOAuth(
    provider: string,
    options?: Record<string, any>
  ): Promise<{ url?: string; session?: Session }>;

  /**
   * Sign in using an ID token (typically from native authentication libraries).
   *
   * Used after native sign-in flows (Apple, Google) that return ID tokens.
   *
   * **Input:**
   * - provider: 'apple', 'google', etc.
   * - token: ID token from native authentication library
   * - options: Optional provider-specific options (e.g., access_token code)
   *
   * **Returns:**
   * - { success: true; data: Session } on successful authentication
   * - { success: false; error: AuthError } on failure
   *
   * **Provider Responsibilities:**
   * - Validate ID token with provider
   * - Exchange token for session if needed
   * - Map provider errors to AuthError types
   */
  signInWithIdToken(
    provider: string,
    token: string,
    options?: Record<string, any>
  ): Promise<AuthResult>;

  /**
   * Initiate password reset flow (email link or code).
   *
   * **Input Expectations:**
   * - email: Already validated (format, length, no SQL keywords, no control chars)
   *
   * **Returns:**
   * - { success: true; message?: "Reset email sent" } on successful initiation
   * - { success: false; message?: "Error details" } on failure
   *
   * **Provider Responsibilities:**
   * - Queue reset email/code delivery
   * - Don't expose whether email exists (for security)
   * - Return user-friendly message only
   */
  resetPassword(email: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Resend a confirmation email (for signup confirmation or email verification).
   *
   * **Input Expectations:**
   * - email: Already validated (format, length, no SQL keywords, no control chars)
   *
   * **Returns:**
   * - { success: true; message?: "Confirmation email sent" } on successful resend
   * - { success: false; message?: "Error details" } on failure
   *
   * **Provider Responsibilities:**
   * - Queue confirmation email delivery
   * - Don't expose whether email exists (for security)
   * - Return user-friendly message only
   * - Handle rate limiting gracefully
   */
  resend(email: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Update the authenticated user's password.
   *
   * Called after password reset flow when user has active reset token session.
   * Requires an authenticated session (typically from password reset link).
   *
   * **Input:**
   * - newPassword: The new password (already validated by caller)
   *
   * **Returns:**
   * - { success: true } on successful password update
   * - { success: false; error?: string } on failure
   *
   * **Provider Responsibilities:**
   * - Update password in backend
   * - Validate that user has valid session/reset token
   * - Return user-friendly error messages
   * - Maintain session after password update (don't log user out)
   */
  updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Get current session from local cache (if authenticated).
   *
   * **Returns:**
   * - Session object if user is authenticated
   * - null if no active session
   *
   * **Provider Responsibilities:**
   * - Return locally cached session (no network call)
   * - Use for general auth checks, route guards, and display logic
   * - For security-critical operations (write guards, account deletion), prefer getUser()
   */
  getSession(): Promise<Session | null>;

  /**
   * Validate the current user with the server (live network call).
   *
   * Unlike getSession() which returns from local cache, this method makes a
   * round-trip to the auth server to verify the token is still valid.
   *
   * **Returns:**
   * - Session object if the token is valid (userId + raw provider user)
   * - null if token is expired, revoked, or user no longer exists
   *
   * **Provider Responsibilities:**
   * - Make a network call to the auth backend
   * - Validate token freshness server-side
   * - Return session with userId and raw user data (email accessible via session.raw?.user?.email)
   *
   * **When to use:**
   * - Security-critical write guards (validateUserForWrite)
   * - Account deletion
   * - Password changes
   * - Any operation where a stale local cache would be dangerous
   */
  getUser(): Promise<Session | null>;

  /**
   * Subscribe to auth state changes.
   *
   * **Callback Behavior:**
   * - Called with Session on login/token refresh
   * - Called with null on logout or session expiry
   * - Should fire on provider's native state change events
   *
   * **Returns:**
   * - Unsubscribe function to clean up listener
   */
  onAuthStateChange(
    callback: (session: Session | null) => void
  ): () => void;

  /**
   * Sign out the current user.
   *
   * **Provider Responsibilities:**
   * - Invalidate tokens
   * - Clear session
   * - Don't throw on errors (logout should always succeed gracefully)
   */
  signOut(): Promise<void>;

  /**
   * Restore a previously saved session during app bootstrap.
   *
   * Called when restoring a user's session from encrypted storage after app restart.
   * The provider implementation should set the session in the provider's session state
   * (e.g., for Supabase, call auth.setSession()).
   *
   * **Input:**
   * - rawSession: The raw session object previously saved by the provider
   *
   * **Returns:**
   * - true if restore was successful and session is valid
   * - false if the session is invalid/expired (caller should clear stale session)
   *
   * **Provider Responsibilities:**
   * - Set the session in provider's internal state
   * - Validate token expiry if applicable
   * - Return false for expired/invalid sessions so caller clears stale data
   * - Don't throw; return false for any restoration failures
   */
  restoreSession(rawSession: any): Promise<boolean>;
}

/**
 * Base error class for all auth errors.
 * Provides normalization, PII redaction for logging, and user-facing messages.
 */
export class AuthError extends Error {
  public readonly original?: any; // Original provider error
  public readonly code?: string; // Provider-specific error code
  public readonly timestamp: number = Date.now();
  /**
   * User-facing message safe to display in UI.
   * Redacts sensitive details but explains what went wrong.
   */
  public readonly userMessage: string;

  constructor(message: string, original?: any, code?: string, userMessage?: string) {
    super(message);
    this.name = 'AuthError';
    this.original = original;
    this.code = code;
    this.userMessage = userMessage || 'An authentication error occurred. Please try again.';
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  /**
   * Return a safe log representation with PII redacted.
   * Uses RedactionManager to remove sensitive fields (email, tokens, passwords, etc.)
   * Safe to log to console, error tracking, or analytics without exposing user data.
   */
  toLog(): Record<string, any> {
    const redactedMessage = RedactionManager.redactObject({
      message: this.message,
    })?.message || this.message;

    return {
      type: this.name,
      message: redactedMessage,
      code: this.code,
      timestamp: this.timestamp,
      // Note: do NOT log .original or raw provider error
    };
  }
}

/**
 * User provided invalid email or password.
 */
export class InvalidCredentialsError extends AuthError {
  constructor(
    message = 'Invalid credentials',
    original?: any,
    userMessage = 'Please check your email and password and try again.'
  ) {
    super(message, original, 'INVALID_CREDENTIALS', userMessage);
    this.name = 'InvalidCredentialsError';
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}

/**
 * Network error (timeout, no connection, etc.).
 */
export class NetworkError extends AuthError {
  constructor(
    message = 'Network error',
    original?: any,
    userMessage = 'The server took too long to respond. Please check your connection and try again.'
  ) {
    super(message, original, 'NETWORK_ERROR', userMessage);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * User not found (during sign in or reset password).
 */
export class UserNotFoundError extends AuthError {
  constructor(
    message = 'User not found',
    original?: any,
    userMessage = 'No account found with that email. Please sign up first.'
  ) {
    super(message, original, 'USER_NOT_FOUND', userMessage);
    this.name = 'UserNotFoundError';
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

/**
 * Email already registered/exists.
 */
export class EmailAlreadyExistsError extends AuthError {
  constructor(
    message = 'Email already exists',
    original?: any,
    userMessage = 'An account with that email already exists. Please sign in or use a different email.'
  ) {
    super(message, original, 'EMAIL_ALREADY_EXISTS', userMessage);
    this.name = 'EmailAlreadyExistsError';
    Object.setPrototypeOf(this, EmailAlreadyExistsError.prototype);
  }
}

/**
 * Rate limit exceeded (too many auth attempts).
 * Indicates provider-side throttling (e.g., 429 response).
 * User should wait before retrying.
 */
export class RateLimitError extends AuthError {
  public readonly retryAfterSeconds?: number; // Seconds to wait before retry

  constructor(
    message = 'Too many authentication attempts',
    original?: any,
    retryAfterSeconds?: number,
    userMessage = 'Too many attempts. Please try again in a few minutes.'
  ) {
    super(message, original, 'RATE_LIMIT', userMessage);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Provider initialization or configuration error.
 */
export class ProviderInitializationError extends AuthError {
  constructor(
    message = 'Provider initialization failed',
    original?: any,
    userMessage = 'Authentication service is temporarily unavailable. Please try again later.'
  ) {
    super(message, original, 'PROVIDER_INIT_ERROR', userMessage);
    this.name = 'ProviderInitializationError';
    Object.setPrototypeOf(this, ProviderInitializationError.prototype);
  }
}

/**
 * Create a validated auth provider wrapper.
 *
 * Wraps any AuthProvider with comprehensive input validation for signUp, signIn, and resetPassword.
 * This ensures **all** providers (Supabase, Firebase, custom, etc.) get the same validation layer
 * before the underlying provider is invoked.
 *
 * Validation rules:
 * - signUp/signIn: Email format, password strength, no SQL injection, no control characters
 * - resetPassword: Email format only
 * - All validation failures logged without hitting the provider
 *
 * **Benefits of wrapper approach:**
 * - Works with ANY provider (not just those extending a class)
 * - Can't be bypassed or forgotten
 * - Validation logic centralized and easy to maintain
 * - Provider implementations stay lightweight
 *
 * @param provider - Any AuthProvider instance
 * @returns A new AuthProvider that validates inputs before delegating
 *
 * @example
 * ```ts
 * const supabaseProvider = new SupabaseAuthProvider(supabaseClient);
 * const validatedProvider = createValidatedAuthProvider(supabaseProvider);
 * await registerAuthProvider(validatedProvider);
 * ```
 */
export function createValidatedAuthProvider(
  provider: AuthProvider
): AuthProvider {
  return {
    async signUp(email: string, password: string): Promise<AuthResult> {
      // === INPUT VALIDATION (Defensive Layer) ===
      // Check for null/undefined
      if (!email || !password) {
        const error = new AuthError(
          'Email and password are required',
          undefined,
          'MISSING_REQUIRED_FIELDS'
        );
        logger.category('auth').warn(
          'ValidatedAuthProvider.signUp: missing required fields'
        );
        return { success: false, error };
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        const error = new InvalidCredentialsError(
          'Invalid email format',
          undefined
        );
          logger.category('auth').warn(
            'ValidatedAuthProvider.signUp: invalid email format',
          {
            reasons: {
              isValidFormat: emailValidation.isValidFormat,
              hasValidLength: emailValidation.hasValidLength,
              hasNoSqlKeywords: emailValidation.hasNoSqlKeywords,
              hasNoControlChars: emailValidation.hasNoControlChars,
            },
          }
        );
        return { success: false, error };
      }

      // Validate password
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        const error = new InvalidCredentialsError(
          'Password does not meet security requirements',
          undefined
        );
        logger.category('auth').warn(
          'ValidatedAuthProvider.signUp: invalid password strength',
          {
            strength: passwordValidation.strength,
            criteria: {
              minLength: passwordValidation.minLength,
              maxLength: passwordValidation.maxLength,
              hasUppercase: passwordValidation.hasUppercase,
              hasLowercase: passwordValidation.hasLowercase,
              hasNumber: passwordValidation.hasNumber,
              hasSpecialChar: passwordValidation.hasSpecialChar,
              hasNoSqlKeywords: passwordValidation.hasNoSqlKeywords,
              hasNoControlChars: passwordValidation.hasNoControlChars,
            },
          }
        );
        return { success: false, error };
      }

      // === DELEGATE TO UNDERLYING PROVIDER (Validated Input Only) ===
      logger.category('auth').warn(
        'ValidatedAuthProvider.signUp: validation passed, delegating to provider',
        {
          email: emailValidation.sanitized.trim(),
        }
      );
      return provider.signUp(emailValidation.sanitized, password);
    },

    async signIn(email: string, password: string): Promise<AuthResult> {
      // === INPUT VALIDATION (Defensive Layer) ===
      // Check for null/undefined
      if (!email || !password) {
        const error = new AuthError(
          'Email and password are required',
          undefined,
          'MISSING_REQUIRED_FIELDS'
        );
        logger.category('auth').warn('ValidatedAuthProvider.signIn: missing required fields');
        return { success: false, error };
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        const error = new InvalidCredentialsError(
          'Invalid email format',
          undefined
        );
        logger.category('auth').warn(
          'ValidatedAuthProvider.signIn: invalid email format',
          {
            reasons: {
              isValidFormat: emailValidation.isValidFormat,
              hasValidLength: emailValidation.hasValidLength,
              hasNoSqlKeywords: emailValidation.hasNoSqlKeywords,
              hasNoControlChars: emailValidation.hasNoControlChars,
            },
          }
        );
        return { success: false, error };
      }

      // Basic password check (existence, no obvious malicious patterns)
      if (typeof password !== 'string' || password.length < 1) {
        const error = new InvalidCredentialsError(
          'Invalid password',
          undefined
        );
        logger.category('auth').warn('ValidatedAuthProvider.signIn: invalid password input');
        return { success: false, error };
      }

      // === DELEGATE TO UNDERLYING PROVIDER (Validated Input Only) ===
      logger.category('auth').debug(
        'ValidatedAuthProvider.signIn: validation passed, delegating to provider',
        {
          email: emailValidation.sanitized.trim(),
        }
      );
      return provider.signIn(emailValidation.sanitized, password);
    },

    async signInWithOAuth(
      provider_: string,
      options?: Record<string, any>
    ): Promise<{ url?: string; session?: Session }> {
      // === INPUT VALIDATION (Defensive Layer) ===
      if (!provider_) {
        logger.category('auth').warn('ValidatedAuthProvider.signInWithOAuth: missing provider');
        throw new AuthError('Provider is required', undefined, 'MISSING_REQUIRED_FIELDS');
      }

      if (typeof provider_ !== 'string') {
        logger.category('auth').warn('ValidatedAuthProvider.signInWithOAuth: invalid provider type');
        throw new AuthError('Provider must be a string', undefined, 'INVALID_PROVIDER');
      }

      // === DELEGATE TO UNDERLYING PROVIDER ===
      logger.category('auth').debug('ValidatedAuthProvider.signInWithOAuth: delegating to provider', {
        provider: provider_,
      });
      return provider.signInWithOAuth(provider_, options);
    },

    async signInWithIdToken(
      provider_: string,
      token: string,
      options?: Record<string, any>
    ): Promise<AuthResult> {
      // === INPUT VALIDATION (Defensive Layer) ===
      if (!provider_ || !token) {
        const error = new AuthError(
          'Provider and token are required',
          undefined,
          'MISSING_REQUIRED_FIELDS'
        );
        logger.category('auth').warn('ValidatedAuthProvider.signInWithIdToken: missing required fields');
        return { success: false, error };
      }

      if (typeof provider_ !== 'string' || typeof token !== 'string') {
        const error = new AuthError('Provider and token must be strings', undefined, 'INVALID_INPUT');
        logger.category('auth').warn('ValidatedAuthProvider.signInWithIdToken: invalid input types');
        return { success: false, error };
      }

      // === DELEGATE TO UNDERLYING PROVIDER ===
      logger.category('auth').debug('ValidatedAuthProvider.signInWithIdToken: delegating to provider', {
        provider: provider_,
      });
      return provider.signInWithIdToken(provider_, token, options);
    },

    async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
      // === INPUT VALIDATION (Defensive Layer) ===
      // Check for null/undefined
      if (!email) {
        logger.category('auth').warn('ValidatedAuthProvider.resetPassword: missing email');
        return {
          success: false,
          message: 'Email is required',
        };
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        logger.category('auth').warn('ValidatedAuthProvider.resetPassword: invalid email format', {
          reasons: {
            isValidFormat: emailValidation.isValidFormat,
              hasValidLength: emailValidation.hasValidLength,
              hasNoSqlKeywords: emailValidation.hasNoSqlKeywords,
              hasNoControlChars: emailValidation.hasNoControlChars,
            },
          }
        );
        return {
          success: false,
          message: 'Invalid email format',
        };
      }

      // === DELEGATE TO UNDERLYING PROVIDER (Validated Input Only) ===
      logger.category('auth').debug('ValidatedAuthProvider.resetPassword: validation passed, delegating to provider', {
        email: emailValidation.sanitized.trim(),
      });
      return provider.resetPassword(emailValidation.sanitized);
    },

    async resend(email: string): Promise<{ success: boolean; message?: string }> {
      // === INPUT VALIDATION (Defensive Layer) ===
      // Check for null/undefined
      if (!email) {
        logger.category('auth').warn('ValidatedAuthProvider.resend: missing email');
        return {
          success: false,
          message: 'Email is required',
        };
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        logger.category('auth').warn('ValidatedAuthProvider.resend: invalid email format', {
          reasons: {
            isValidFormat: emailValidation.isValidFormat,
            hasValidLength: emailValidation.hasValidLength,
            hasNoSqlKeywords: emailValidation.hasNoSqlKeywords,
            hasNoControlChars: emailValidation.hasNoControlChars,
          },
        });
        return {
          success: false,
          message: 'Invalid email format',
        };
      }

      // === DELEGATE TO UNDERLYING PROVIDER (Validated Input Only) ===
      logger.category('auth').debug('ValidatedAuthProvider.resend: validation passed, delegating to provider', {
        email: emailValidation.sanitized.trim(),
      });
      return provider.resend(emailValidation.sanitized);
    },

    async getSession(): Promise<Session | null> {
      return provider.getSession();
    },

    async getUser(): Promise<Session | null> {
      return provider.getUser();
    },

    onAuthStateChange(
      callback: (session: Session | null) => void
    ): () => void {
      return provider.onAuthStateChange(callback);
    },

    async signOut(): Promise<void> {
      return provider.signOut();
    },

    async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
      // No validation needed - provider handles password complexity validation
      return provider.updatePassword(newPassword);
    },

    async restoreSession(rawSession: any): Promise<boolean> {
      // No validation needed for restore - provider handles session schema validation
      // Just delegate to underlying provider
      return provider.restoreSession(rawSession);
    },
  };
}

/**
 * Internal registry for the currently registered auth provider.
 * Support both instances and async factories.
 */
let registeredProvider: AuthProvider | (() => Promise<AuthProvider>) | null =
  null;
let providerInstance: AuthProvider | null = null;
let providerPromise: Promise<AuthProvider> | null = null;

/**
 * Register an auth provider (instance or factory).
 * Can be called multiple times to replace the current provider.
 *
 * @param provider - AuthProvider instance or async factory function
 */
export async function registerAuthProvider(
  provider: AuthProvider | (() => Promise<AuthProvider>)
): Promise<void> {
  if (typeof provider === 'function') {
    logger.category('auth').debug('Registering auth provider (async factory)');
    registeredProvider = provider;
    providerInstance = null;
    providerPromise = null;
  } else {
    logger.category('auth').debug('Registering auth provider (instance)', {
      providerType: provider.constructor.name,
    });
    registeredProvider = provider;
    providerInstance = provider;
    providerPromise = null;
  }
}

/**
 * Get the registered auth provider.
 * If a factory was registered, instantiate it on first call.
 * Throws if no provider has been registered yet.
 *
 * **Dev-only Warning:** In development, logs a detailed message if provider is not initialized,
 * suggesting to check that `registerAuthProvider()` was called during app bootstrap.
 *
 * @throws ProviderInitializationError if provider not initialized
 */
export async function getAuthProvider(): Promise<AuthProvider> {
  if (!registeredProvider) {
    const debugHint = isDevelopment()
      ? 'Did you call registerAuthProvider() during app bootstrap? Check: lib/services/service-initializer.ts → initializeServices() → initializeAuthProvider()'
      : 'Please restart the app and contact support if the problem persists.';
    const error = new ProviderInitializationError(
      `No auth provider registered. ${debugHint}`,
      undefined,
      'Authentication service is not available. Please restart the app.'
    );
    logger.category('auth').error('No auth provider registered', error.toLog());
    throw error;
  }

  // If already instantiated, return immediately
  if (providerInstance) {
    return providerInstance;
  }

  // If factory, instantiate once and cache
  if (typeof registeredProvider === 'function') {
    if (!providerPromise) {
      providerPromise = (async () => {
        try {
          logger.category('auth').debug('Instantiating auth provider from factory...');
          const provider = await registeredProvider();
          providerInstance = provider;
          logger.category('bootstrap').info('Auth provider factory instantiated', {
            providerType: provider.constructor.name,
          });
          return provider;
        } catch (error) {
          const err = error as Error;
          logger.category('bootstrap').error(`Auth provider factory failed: ${err.message}`);
          throw new ProviderInitializationError(
            `Auth provider initialization failed: ${err.message}`,
            error,
            'Authentication service failed to initialize. Please contact support if the problem persists.'
          );
        }
      })();
    }
    return providerPromise;
  }

  // Should not reach here, but return as fallback
  return registeredProvider as AuthProvider;
}

/**
 * Get synchronously if provider is already instantiated.
 * Useful for checking if provider is ready without awaiting.
 * Returns null if not instantiated yet.
 */
export function getAuthProviderSync(): AuthProvider | null {
  return providerInstance || null;
}

/**
 * List registered provider info (for debugging).
 * Returns provider type and readiness status.
 */
export function getProviderDebugInfo(): {
  isRegistered: boolean;
  isFactory: boolean;
  isInstantiated: boolean;
  providerType?: string;
} {
  return {
    isRegistered: !!registeredProvider,
    isFactory: typeof registeredProvider === 'function',
    isInstantiated: !!providerInstance,
    providerType: providerInstance?.constructor.name,
  };
}
