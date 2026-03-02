/**
 * Auth Messages
 *
 * Friendly default messages for auth error codes.
 * When a proper i18n/localization layer exists, replace these with translation keys.
 */

import { ERROR_CODES, type AuthErrorCode } from "@/maps/ERROR_CODES";

export function getFriendlyAuthMessage(code: AuthErrorCode): string {
  switch (code) {
    case ERROR_CODES.AUTH.INVALID_CREDENTIALS:
      return 'Invalid email or password. Please try again.';
    case ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS:
      return 'An account with this email already exists.';
    case ERROR_CODES.AUTH.USER_NOT_FOUND:
      return 'No account found with this email.';
    case ERROR_CODES.AUTH.UNKNOWN:
      return 'Network error. Check your connection and try again.';
    case ERROR_CODES.AUTH.RATE_LIMIT:
      return 'Too many attempts. Please wait and try again later.';
    case ERROR_CODES.AUTH.PERMISSION_DENIED:
      return 'You do not have permission to perform this action.';
    case ERROR_CODES.AUTH.EMAIL_NOT_CONFIRMED:
      return 'Please verify your email address before signing in.';
    case ERROR_CODES.AUTH.WEAK_PASSWORD:
      return 'Your password does not meet security requirements.';
    case ERROR_CODES.AUTH.SESSION_EXPIRED:
      return 'Your session has expired. Please sign in again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
