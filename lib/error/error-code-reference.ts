/**
 * Error Code Reference for Documentation & Discovery
 *
 * Provides machine-readable documentation about each error code:
 * - Description of when the error is thrown
 * - Locations in code where this error is thrown
 * - Recovery strategies and how to handle
 * - Related error codes
 *
 * Used by:
 * - Documentation generators
 * - Error code search/discovery tools
 * - Decision trees for error handling
 * - Error code statistics/analytics
 *
 * @example
 * // Find all places that throw NETWORK_TIMEOUT
 * const ref = ERROR_CODE_REFERENCE[ERROR_CODES.NETWORK.TIMEOUT];
 * console.log(`NETWORK_TIMEOUT thrown in: ${ref.throwLocations.join(', ')}`);
 *
 * // OR generate markdown documentation
 * Object.entries(ERROR_CODE_REFERENCE).forEach(([code, ref]) => {
 *   console.log(`## ${ref.name}`);
 *   console.log(`Description: ${ref.description}`);
 *   console.log(`Recovery: ${ref.recoveryStrategy}`);
 * });
 */

import { ERROR_CODES } from '../utils/ERROR_CODES';

export interface ErrorCodeReference {
  /** Display name (e.g., "Invalid Credentials") */
  name: string;

  /** When/why this error is thrown */
  description: string;

  /** Files/functions that throw this error */
  throwLocations: string[];

  /** How to handle the error / best practices */
  recoveryStrategy: string;

  /** Related error codes (if any) */
  relatedCodes?: string;
}

/**
 * Machine-readable error code reference
 * Used for documentation generation, discovery, and analysis
 */
export const ERROR_CODE_REFERENCE: Record<string, ErrorCodeReference> = {
  // ========================================================================
  // AUTH ERRORS
  // ========================================================================

  [ERROR_CODES.AUTH.INVALID_CREDENTIALS]: {
    name: 'Invalid Credentials',
    description: 'User provided incorrect email or password during sign-in',
    throwLocations: [
      'lib/services/supabase/supabase-auth-provider.ts',
      'lib/auth/auth-operations.ts',
    ],
    recoveryStrategy:
      'Show sign-in form again with error message. User must correct and retry. ' +
      'Do NOT auto-retry. Consider "Forgot password?" link.',
  },

  [ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS]: {
    name: 'Email Already Exists',
    description: 'User attempted to sign up with an email that already has an account',
    throwLocations: [
      'lib/services/supabase/supabase-auth-provider.ts',
      'lib/auth/authService.ts',
    ],
    recoveryStrategy:
      'Show modal suggesting user sign in instead or use different email. ' +
      'Provide "Sign In" and "Close" buttons.',
  },

  [ERROR_CODES.AUTH.USER_NOT_FOUND]: {
    name: 'User Not Found',
    description: 'No user account exists with the provided email',
    throwLocations: [
      'lib/services/supabase/supabase-auth-provider.ts',
    ],
    recoveryStrategy:
      'Treat similarly to INVALID_CREDENTIALS (don\'t reveal whether email exists). ' +
      'Show generic "No account found" message with "Sign Up" option.',
  },

  [ERROR_CODES.AUTH.EMAIL_NOT_CONFIRMED]: {
    name: 'Email Not Confirmed',
    description: 'User signed up but has not yet confirmed their email address',
    throwLocations: [
      'lib/services/supabase/supabase-auth-provider.ts',
    ],
    recoveryStrategy:
      'Show message: "Please check your email for a confirmation link". ' +
      'Offer "Resend confirmation email" button.',
    relatedCodes: ERROR_CODES.AUTH.RATE_LIMIT,
  },

  [ERROR_CODES.AUTH.WEAK_PASSWORD]: {
    name: 'Weak Password',
    description: 'Password does not meet security requirements (length, complexity, etc)',
    throwLocations: [
      'lib/auth/validation.ts',
      'lib/auth/authService.ts',
    ],
    recoveryStrategy:
      'Show password requirements alongside the sign-up form. ' +
      'Real-time validation to indicate when requirements are met.',
  },

  [ERROR_CODES.AUTH.SESSION_EXPIRED]: {
    name: 'Session Expired',
    description: 'User\'s authentication session has expired or become invalid',
    throwLocations: [
      'lib/api/default-strategies.ts',
      'lib/api/request-manager.ts',
    ],
    recoveryStrategy:
      'Clear session, redirect to sign-in page. Preserve intent (remember where user was). ' +
      'Show message: "Your session expired. Please sign in again."',
  },

  [ERROR_CODES.AUTH.PERMISSION_DENIED]: {
    name: 'Permission Denied',
    description: 'User lacks permissions to perform the requested action (RLS policy denial)',
    throwLocations: [
      'lib/database/worlds.ts',
      'lib/services/supabase/supabase-database-provider.ts',
    ],
    recoveryStrategy:
      'Show error message: "You do not have permission to perform this action". ' +
      'Log for security team (may indicate privilege escalation attempt).',
  },

  [ERROR_CODES.AUTH.RATE_LIMIT]: {
    name: 'Auth Rate Limit',
    description: 'Too many auth attempts (sign-up, sign-in, reset) from this user',
    throwLocations: [
      'lib/auth/auth-attempt-guard.ts',
    ],
    recoveryStrategy:
      'Show message: "Too many attempts. Try again in X seconds". ' +
      'Disable submit button with countdown timer.',
    relatedCodes: ERROR_CODES.NETWORK.RATE_LIMIT,
  },

  [ERROR_CODES.AUTH.UNKNOWN]: {
    name: 'Auth Unknown Error',
    description: 'Catch-all for unclassified auth failures',
    throwLocations: [
      'lib/utils/ERROR_CODES.ts (mapAuthErrorToCode fallback)',
    ],
    recoveryStrategy:
      'Log full error details. Show generic message: "An error occurred. Please try again." ' +
      'Escalate to error tracking (Sentry).',
  },

  // ========================================================================
  // NETWORK ERRORS
  // ========================================================================

  [ERROR_CODES.NETWORK.TIMEOUT]: {
    name: 'Network Timeout',
    description: 'HTTP request took longer than timeout threshold (usually 30s)',
    throwLocations: [
      'lib/api/request-manager.ts',
      'lib/services/supabase/supabase-auth-provider.ts',
    ],
    recoveryStrategy:
      'Auto-retry with exponential backoff (1s, 2s, 4s, 8s, ...). ' +
      'Show "Retrying..." UI on first attempt. ' +
      'After 3-5 retries, show manual retry button.',
  },

  [ERROR_CODES.NETWORK.OFFLINE]: {
    name: 'Network Offline',
    description: 'Device is offline (no network connection detected)',
    throwLocations: [
      'lib/network/network-detection.ts',
    ],
    recoveryStrategy:
      'Queue mutation for later. Show: "You\'re offline. Changes will sync when online." ' +
      'If query, serve stale cache if available.',
    relatedCodes: ERROR_CODES.NETWORK.TIMEOUT,
  },

  [ERROR_CODES.NETWORK.UNREACHABLE]: {
    name: 'Network Unreachable',
    description: 'Server is unreachable (connection refused, host unreachable)',
    throwLocations: [
      'lib/api/request-manager.ts',
    ],
    recoveryStrategy:
      'Auto-retry with exponential backoff. Check if service is degraded via status page. ' +
      'Show: "Unable to reach server. Retrying..."',
  },

  [ERROR_CODES.NETWORK.FETCH_FAILED]: {
    name: 'Fetch Failed',
    description: 'Fetch API call failed (browser-level error, not HTTP error)',
    throwLocations: [
      'lib/api/request-manager.ts',
    ],
    recoveryStrategy:
      'Auto-retry. May indicate CORS issue, missing internet, or browser issue. ' +
      'Check browser console.',
  },

  [ERROR_CODES.NETWORK.DNS_RESOLUTION_FAILED]: {
    name: 'DNS Resolution Failed',
    description: 'Could not resolve domain name to IP address',
    throwLocations: [
      'lib/api/request-manager.ts (Node.js/Electron)',
    ],
    recoveryStrategy:
      'Auto-retry. May indicate DNS issues or domain misconfiguration. ' +
      'Check network connectivity.',
  },

  [ERROR_CODES.NETWORK.CONNECTION_REFUSED]: {
    name: 'Connection Refused',
    description: 'Server is not listening on the target port',
    throwLocations: [
      'lib/api/request-manager.ts (Node.js/Electron)',
    ],
    recoveryStrategy:
      'Auto-retry. Likely means service is down or not running. ' +
      'Check service health.',
  },

  [ERROR_CODES.NETWORK.RATE_LIMIT]: {
    name: 'Network Rate Limit',
    description: 'Server returned 429 Too Many Requests (rate limit exceeded)',
    throwLocations: [
      'lib/api/request-manager.ts',
    ],
    recoveryStrategy:
      'Auto-retry with linear backoff, respecting Retry-After header. ' +
      'Show cooldown timer. Implement client-side rate limiting to prevent.',
    relatedCodes: ERROR_CODES.AUTH.RATE_LIMIT,
  },

  // ========================================================================
  // DATABASE ERRORS
  // ========================================================================

  [ERROR_CODES.DATABASE.NOT_FOUND]: {
    name: 'Database Not Found',
    description: 'Requested row/record does not exist in database',
    throwLocations: [
      'lib/database/*.ts (entity files)',
      'lib/services/supabase/supabase-error-translation.ts',
    ],
    recoveryStrategy:
      'Return null/undefined or empty list. Do NOT retry. ' +
      'May need to redirect if user was trying to access deleted resource.',
  },

  [ERROR_CODES.DATABASE.UNIQUE_VIOLATION]: {
    name: 'Unique Constraint Violation',
    description: 'Attempted to insert duplicate value in unique column (e.g., duplicate email)',
    throwLocations: [
      'lib/database/*.ts (create/insert operations)',
      'lib/services/supabase/supabase-error-translation.ts',
    ],
    recoveryStrategy:
      'Do NOT retry. Show user-friendly message: "This [field] already exists." ' +
      'Provide correction form.',
    relatedCodes: ERROR_CODES.DATABASE.CONSTRAINT_VIOLATION,
  },

  [ERROR_CODES.DATABASE.CONSTRAINT_VIOLATION]: {
    name: 'Constraint Violation',
    description: 'Foreign key, check, or other database constraint violation',
    throwLocations: [
      'lib/database/*.ts',
      'lib/services/supabase/supabase-error-translation.ts',
    ],
    recoveryStrategy:
      'Do NOT retry. Show generic error: "Invalid data. Please check and try again." ' +
      'Log full error for debugging.',
  },

  [ERROR_CODES.DATABASE.PERMISSION_DENIED]: {
    name: 'Database Permission Denied',
    description: 'Row-level security (RLS) policy denies the operation',
    throwLocations: [
      'lib/database/*.ts',
      'lib/services/supabase/supabase-database-provider.ts',
    ],
    recoveryStrategy:
      'Do NOT retry. May indicate security issue. Show: "Not authorized to perform this action." ' +
      'Log for security review.',
  },

  [ERROR_CODES.DATABASE.TIMEOUT]: {
    name: 'Database Timeout',
    description: 'Query execution exceeded timeout (usually 30s for Supabase)',
    throwLocations: [
      'lib/services/supabase/supabase-error-translation.ts',
    ],
    recoveryStrategy:
      'Retry with backoff. May indicate slow query or overloaded database. ' +
      'Escalate if recurring.',
  },

  [ERROR_CODES.DATABASE.UNKNOWN]: {
    name: 'Database Unknown Error',
    description: 'Unclassified database error',
    throwLocations: [
      'lib/services/supabase/supabase-database-provider.ts (fallback)',
    ],
    recoveryStrategy:
      'Log full error. Don\'t retry automatically unless it\'s clearly transient. ' +
      'Show generic message: "A database error occurred. Please try again."',
  },

  // ========================================================================
  // STORAGE ERRORS
  // ========================================================================

  [ERROR_CODES.STORAGE.QUOTA_EXCEEDED]: {
    name: 'Storage Quota Exceeded',
    description: 'Local device storage (SecureStorage) is full',
    throwLocations: [
      'lib/storage/SecureStorage.ts',
      'lib/storage/cache/storage-error-handling.ts',
    ],
    recoveryStrategy:
      'CRITICAL: Data loss risk. Show alert: "Device storage full. Some data may not be saved." ' +
      'Suggest clearing cache/old data. Don\'t silently fail.',
  },

  [ERROR_CODES.STORAGE.ENCRYPTION_FAILED]: {
    name: 'Encryption Failed',
    description: 'Failed to encrypt data before storing',
    throwLocations: [
      'lib/storage/SecureStorage.ts',
    ],
    recoveryStrategy:
      'CRITICAL: Do not store unencrypted. Clear attempted data. Show error: ' +
      '"Could not securely save data." Restart app.',
  },

  [ERROR_CODES.STORAGE.DECRYPTION_FAILED]: {
    name: 'Decryption Failed',
    description: 'Failed to decrypt stored data (corruption, wrong key, etc)',
    throwLocations: [
      'lib/storage/SecureStorage.ts',
    ],
    recoveryStrategy:
      'CRITICAL: Data is corrupted. Skip this value. Log for analysis. ' +
      'May trigger cache invalidation or fresh sync.',
  },

  [ERROR_CODES.STORAGE.PARSE_ERROR]: {
    name: 'Storage Parse Error',
    description: 'Stored data is not valid JSON or expected format',
    throwLocations: [
      'lib/storage/cache/storage-error-handling.ts',
    ],
    recoveryStrategy:
      'Data is corrupted. Skip/delete this entry. Refetch from server. ' +
      'Log schema version mismatch for debugging.',
  },

  // ========================================================================
  // VALIDATION ERRORS
  // ========================================================================

  [ERROR_CODES.VALIDATION.INVALID_EMAIL]: {
    name: 'Invalid Email',
    description: 'Email address does not match expected format',
    throwLocations: [
      'lib/auth/validation.ts',
    ],
    recoveryStrategy:
      'Show error on form field in real-time. Do NOT submit. ' +
      'Provide example: "user@example.com"',
  },

  [ERROR_CODES.VALIDATION.WEAK_PASSWORD]: {
    name: 'Weak Password',
    description: 'Password does not meet strength requirements',
    throwLocations: [
      'lib/auth/validation.ts',
    ],
    recoveryStrategy:
      'Show requirements checklist alongside input. Real-time validation. ' +
      'Highlight which requirements are met.',
  },

  // ========================================================================
  // UNKNOWN ERRORS
  // ========================================================================

  [ERROR_CODES.UNKNOWN.GENERAL]: {
    name: 'Unknown Error',
    description: 'Catch-all for unclassified errors',
    throwLocations: [
      'lib/error/app-error.ts (fallback)',
    ],
    recoveryStrategy:
      'Log full error stack. Show generic message: "An unexpected error occurred. ' +
      'Please try again or contact support."',
  },

  [ERROR_CODES.UNKNOWN.UNCLASSIFIED]: {
    name: 'Unclassified Error',
    description: 'Error that could not be mapped to a known error code',
    throwLocations: [
      'lib/error/app-error.ts (toAppError conversion)',
    ],
    recoveryStrategy:
      'Preserve original error. Log for analysis. Try to classify after collection. ' +
      'Add new error code if pattern emerges.',
  },
};
