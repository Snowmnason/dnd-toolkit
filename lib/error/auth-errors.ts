/**
 * Auth-specific error classes
 *
 * Centralized domain errors for authentication operations.
 * These are used throughout lib/auth and imported by components/hooks.
 */

/**
 * Base class for all auth errors.
 */
export class AuthError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly timestamp: number;

  constructor(
    message: string,
    original?: any,
    code: string = 'AUTH_ERROR',
    userMessage: string = 'An authentication error occurred. Please try again.'
  ) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.userMessage = userMessage;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  toJSON() {
    const redactedMessage = this.message
      .replace(/password[^,]*/gi, 'password=***')
      .replace(/token[^,]*/gi, 'token=***')
      .replace(/Bearer[^,]*/gi, 'Bearer***');

    return {
      type: this.name,
      message: redactedMessage,
      code: this.code,
      timestamp: this.timestamp,
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
  public readonly retryAfterSeconds?: number;

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
