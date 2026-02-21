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

import { validateEmail, validatePassword } from '@/lib/auth/validation';
import { logger } from '@/lib/utils/logger';

/**
 * Session data returned by auth provider.
 * Provider-agnostic; contains only essential fields for app-level state management.
 */
export interface Session {
  userId: string;
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
  signUp(email: string, password: string): Promise<AuthResult>;

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
   * Get current session (if authenticated).
   *
   * **Returns:**
   * - Session object if user is authenticated
   * - null if no active session
   *
   * **Provider Responsibilities:**
   * - Check token validity
   * - Return session with userId and token fields
   */
  getSession(): Promise<Session | null>;

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
}

/**
 * Base error class for all auth errors.
 * Provides normalization and PII redaction for logging.
 */
export class AuthError extends Error {
  public readonly original?: any; // Original provider error
  public readonly code?: string; // Provider-specific error code
  public readonly timestamp: number = Date.now();

  constructor(message: string, original?: any, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.original = original;
    this.code = code;
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  /**
   * Return a safe log representation with PII redacted.
   * Include enough context for debugging without exposing sensitive data.
   */
  toLog(): Record<string, any> {
    return {
      type: this.name,
      message: this.message,
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
  constructor(message = 'Invalid credentials', original?: any) {
    super(message, original, 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}

/**
 * Network error (timeout, no connection, etc.).
 */
export class NetworkError extends AuthError {
  constructor(message = 'Network error', original?: any) {
    super(message, original, 'NETWORK_ERROR');
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * User not found (during sign in or reset password).
 */
export class UserNotFoundError extends AuthError {
  constructor(message = 'User not found', original?: any) {
    super(message, original, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

/**
 * Email already registered/exists.
 */
export class EmailAlreadyExistsError extends AuthError {
  constructor(message = 'Email already exists', original?: any) {
    super(message, original, 'EMAIL_ALREADY_EXISTS');
    this.name = 'EmailAlreadyExistsError';
    Object.setPrototypeOf(this, EmailAlreadyExistsError.prototype);
  }
}

/**
 * Provider initialization or configuration error.
 */
export class ProviderInitializationError extends AuthError {
  constructor(message = 'Provider initialization failed', original?: any) {
    super(message, original, 'PROVIDER_INIT_ERROR');
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
        logger.warn(
          'auth',
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
        logger.warn(
          'auth',
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
        logger.warn(
          'auth',
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
      logger.debug(
        'auth',
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
        logger.warn('auth', 'ValidatedAuthProvider.signIn: missing required fields');
        return { success: false, error };
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        const error = new InvalidCredentialsError(
          'Invalid email format',
          undefined
        );
        logger.warn(
          'auth',
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
        logger.warn('auth', 'ValidatedAuthProvider.signIn: invalid password input');
        return { success: false, error };
      }

      // === DELEGATE TO UNDERLYING PROVIDER (Validated Input Only) ===
      logger.debug(
        'auth',
        'ValidatedAuthProvider.signIn: validation passed, delegating to provider',
        {
          email: emailValidation.sanitized.trim(),
        }
      );
      return provider.signIn(emailValidation.sanitized, password);
    },

    async resetPassword(email: string): Promise<{ success: boolean; message?: string }> {
      // === INPUT VALIDATION (Defensive Layer) ===
      // Check for null/undefined
      if (!email) {
        logger.warn('auth', 'ValidatedAuthProvider.resetPassword: missing email');
        return {
          success: false,
          message: 'Email is required',
        };
      }

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        logger.warn(
          'auth',
          'ValidatedAuthProvider.resetPassword: invalid email format',
          {
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
      logger.debug(
        'auth',
        'ValidatedAuthProvider.resetPassword: validation passed, delegating to provider',
        {
          email: emailValidation.sanitized.trim(),
        }
      );
      return provider.resetPassword(emailValidation.sanitized);
    },

    async getSession(): Promise<Session | null> {
      return provider.getSession();
    },

    onAuthStateChange(
      callback: (session: Session | null) => void
    ): () => void {
      return provider.onAuthStateChange(callback);
    },

    async signOut(): Promise<void> {
      return provider.signOut();
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
    logger.debug('auth', 'Registering auth provider (async factory)');
    registeredProvider = provider;
    providerInstance = null;
    providerPromise = null;
  } else {
    logger.debug('auth', 'Registering auth provider (instance)', {
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
 * @throws ProviderInitializationError if provider not initialized
 */
export async function getAuthProvider(): Promise<AuthProvider> {
  if (!registeredProvider) {
    const error = new ProviderInitializationError(
      'No auth provider registered. Call registerAuthProvider() during app bootstrap.'
    );
    logger.error('auth', error.message);
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
          logger.debug('auth', 'Instantiating auth provider from factory...');
          const provider = await registeredProvider();
          providerInstance = provider;
          logger.debug('auth', 'Auth provider factory instantiated', {
            providerType: provider.constructor.name,
          });
          return provider;
        } catch (error) {
          logger.error('auth', 'Auth provider factory failed:', error);
          throw error;
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
