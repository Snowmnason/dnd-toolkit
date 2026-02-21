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
 */
export interface AuthProvider {
  /**
   * Sign up a new user with email and password.
   * Returns user session on success or error on failure.
   */
  signUp(email: string, password: string): Promise<AuthResult>;

  /**
   * Sign in an existing user with email and password.
   * Returns user session on success or error on failure.
   */
  signIn(email: string, password: string): Promise<AuthResult>;

  /**
   * Initiate password reset flow (email link or code).
   * Returns success status and optional message.
   */
  resetPassword(email: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Get current session (if authenticated).
   * Returns null if no active session.
   */
  getSession(): Promise<Session | null>;

  /**
   * Subscribe to auth state changes.
   * Returns unsubscribe function to clean up listener.
   */
  onAuthStateChange(
    callback: (session: Session | null) => void
  ): () => void;

  /**
   * Sign out the current user.
   * Clears session and tokens.
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
