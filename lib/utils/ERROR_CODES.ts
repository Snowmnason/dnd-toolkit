import {
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    NetworkError,
    RateLimitError,
    UserNotFoundError,
} from '@/lib/services';

/**
 * Canonical auth error codes used across the app for normalized handling.
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Map an AuthError (or unknown) to a canonical `AuthErrorCode` used by the app.
 */
export function mapAuthErrorToCode(error: unknown): AuthErrorCode {
  if (error instanceof InvalidCredentialsError) return AuthErrorCode.INVALID_CREDENTIALS;
  if (error instanceof EmailAlreadyExistsError) return AuthErrorCode.EMAIL_ALREADY_EXISTS;
  if (error instanceof UserNotFoundError) return AuthErrorCode.USER_NOT_FOUND;
  if (error instanceof NetworkError) return AuthErrorCode.NETWORK_ERROR;
  if (error instanceof RateLimitError) return AuthErrorCode.RATE_LIMIT;

  // Default fallback
  return AuthErrorCode.UNKNOWN;
}

/**
 * Friendly default messages for each code. UI should prefer localization layers
 * but this provides a safe default.
 */
export function getFriendlyAuthMessage(code: AuthErrorCode): string {
  switch (code) {
    case AuthErrorCode.INVALID_CREDENTIALS:
      return 'Invalid email or password. Please try again.';
    case AuthErrorCode.EMAIL_ALREADY_EXISTS:
      return 'An account with this email already exists.';
    case AuthErrorCode.USER_NOT_FOUND:
      return 'No account found with this email.';
    case AuthErrorCode.NETWORK_ERROR:
      return 'Network error. Check your connection and try again.';
    case AuthErrorCode.RATE_LIMIT:
      return 'Too many attempts. Please wait and try again later.';
    case AuthErrorCode.PERMISSION_DENIED:
      return 'You do not have permission to perform this action.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
