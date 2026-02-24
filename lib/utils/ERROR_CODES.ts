import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  NetworkError,
  RateLimitError,
  UserNotFoundError,
} from '@/lib/services';

// ============================================================================
// CENTRAL ERROR CODE REGISTRY
// ============================================================================
// All error codes used across the app live here. App code must reference
// ERROR_CODES.* instead of hardcoded strings.
//
// Structure:
//   AUTH     — authentication/authorization failures
//   NETWORK  — connectivity and transport failures
//   DATABASE — provider-agnostic database failures (map Supabase → these)
//   STORAGE  — local encrypted storage failures
//   HTTP     — canonical HTTP status codes
//   VALIDATION — input validation failures
//   RETRY    — retry strategy classification
//   UNKNOWN  — unclassified catch-all
// ============================================================================

export const ERROR_CODES = {
  // --------------------------------------------------------------------------
  // AUTH — authentication / session / identity failures
  // --------------------------------------------------------------------------
  AUTH: {
    INVALID_CREDENTIALS:  'AUTH_INVALID_CREDENTIALS',
    EMAIL_ALREADY_EXISTS: 'AUTH_EMAIL_ALREADY_EXISTS',
    USER_NOT_FOUND:       'AUTH_USER_NOT_FOUND',
    EMAIL_NOT_CONFIRMED:  'AUTH_EMAIL_NOT_CONFIRMED',
    WEAK_PASSWORD:        'AUTH_WEAK_PASSWORD',
    SESSION_EXPIRED:      'AUTH_SESSION_EXPIRED',
    PERMISSION_DENIED:    'AUTH_PERMISSION_DENIED',
    RATE_LIMIT:           'AUTH_RATE_LIMIT',
    UNKNOWN:              'AUTH_UNKNOWN',
  },

  // --------------------------------------------------------------------------
  // NETWORK — connectivity / transport / socket failures
  // --------------------------------------------------------------------------
  NETWORK: {
    // Internal canonical classification codes (what we report internally)
    UNREACHABLE:           'NETWORK_UNREACHABLE',
    OFFLINE:               'NETWORK_OFFLINE',
    TIMEOUT:               'NETWORK_TIMEOUT',
    FETCH_FAILED:          'NETWORK_FETCH_FAILED',
    DNS_RESOLUTION_FAILED: 'NETWORK_DNS_RESOLUTION_FAILED',
    CONNECTION_REFUSED:    'NETWORK_CONNECTION_REFUSED',
    CONNECTION_RESET:      'NETWORK_CONNECTION_RESET',
    SOCKET_HANG_UP:        'NETWORK_SOCKET_HANG_UP',
    RATE_LIMIT:            'NETWORK_RATE_LIMIT',

    // Raw OS/runtime codes — used for detection from external error sources
    // (Node.js, browsers, Supabase client). Values intentionally match the
    // strings those systems emit; do NOT change them.
    RAW: {
      NETWORK_ERROR: 'NETWORK_ERROR',
      FETCH_ERROR:   'FETCH_ERROR',
      TIMEOUT:       'TIMEOUT',
      ENOTFOUND:     'ENOTFOUND',
      ECONNREFUSED:  'ECONNREFUSED',
      ECONNRESET:    'ECONNRESET',
      ETIMEDOUT:     'ETIMEDOUT',
      ENETRESET:     'ENETRESET',
    },
  },

  // --------------------------------------------------------------------------
  // DATABASE — provider-agnostic DB failures
  // Supabase codes (PGRST*, 23xxx, etc.) must be translated to these values
  // before reaching app code. See lib/services/supabase/supabase-error-translation.ts
  // --------------------------------------------------------------------------
  DATABASE: {
    UNIQUE_VIOLATION:    'DATABASE_UNIQUE_VIOLATION',
    NOT_FOUND:           'DATABASE_NOT_FOUND',
    PERMISSION_DENIED:   'DATABASE_PERMISSION_DENIED',
    CONSTRAINT_VIOLATION:'DATABASE_CONSTRAINT_VIOLATION',
    CONFLICT:            'DATABASE_CONFLICT',
    CONNECTION_FAILED:   'DATABASE_CONNECTION_FAILED',
    QUERY_FAILED:        'DATABASE_QUERY_FAILED',
    SYNTAX_ERROR:        'DATABASE_SYNTAX_ERROR',
    TIMEOUT:             'DATABASE_TIMEOUT',
    UNKNOWN:             'DATABASE_UNKNOWN',
  },

  // --------------------------------------------------------------------------
  // STORAGE — local encrypted storage (SecureStorage) failures
  // --------------------------------------------------------------------------
  STORAGE: {
    QUOTA_EXCEEDED:   'STORAGE_QUOTA_EXCEEDED',
    PARSE_ERROR:      'STORAGE_PARSE_ERROR',
    VALIDATION_ERROR: 'STORAGE_VALIDATION_ERROR',
    ENCRYPTION_FAILED:'STORAGE_ENCRYPTION_FAILED',
    DECRYPTION_FAILED:'STORAGE_DECRYPTION_FAILED',
    PERMISSION_DENIED:'STORAGE_PERMISSION_DENIED',
    NOT_FOUND:        'STORAGE_NOT_FOUND',
    WRITE_FAILED:     'STORAGE_WRITE_FAILED',
    UNKNOWN:          'STORAGE_UNKNOWN',
  },

  // --------------------------------------------------------------------------
  // HTTP — canonical HTTP status codes (numeric)
  // --------------------------------------------------------------------------
  HTTP: {
    BAD_REQUEST:           400,
    UNAUTHORIZED:          401,
    FORBIDDEN:             403,
    NOT_FOUND:             404,
    RATE_LIMITED:          429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY:           502,
    SERVICE_UNAVAILABLE:   503,
    GATEWAY_TIMEOUT:       504,
  },

  // --------------------------------------------------------------------------
  // VALIDATION — input / schema validation failures
  // --------------------------------------------------------------------------
  VALIDATION: {
    INVALID_EMAIL:  'VALIDATION_INVALID_EMAIL',
    WEAK_PASSWORD:  'VALIDATION_WEAK_PASSWORD',
    REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
    INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  },

  // --------------------------------------------------------------------------
  // RETRY — retry-strategy classification codes (reason strings)
  // --------------------------------------------------------------------------
  RETRY: {
    TRANSIENT_NETWORK_FAILURE: 'RETRY_TRANSIENT_NETWORK_FAILURE',
    RATE_LIMIT_EXCEEDED:       'RETRY_RATE_LIMIT_EXCEEDED',
    PERMANENT_FAILURE:         'RETRY_PERMANENT_FAILURE',
    UNKNOWN:                   'RETRY_UNKNOWN',
  },

  // --------------------------------------------------------------------------
  // UNKNOWN — unclassified fallback
  // --------------------------------------------------------------------------
  UNKNOWN: {
    GENERAL:       'UNKNOWN_GENERAL',
    UNCLASSIFIED:  'UNKNOWN_UNCLASSIFIED',
  },
} as const;

// ============================================================================
// DERIVED TYPES
// ============================================================================

export type AuthErrorCode       = typeof ERROR_CODES.AUTH[keyof typeof ERROR_CODES.AUTH];
export type NetworkErrorCode    = typeof ERROR_CODES.NETWORK[keyof typeof ERROR_CODES.NETWORK];
export type DatabaseErrorCode   = typeof ERROR_CODES.DATABASE[keyof typeof ERROR_CODES.DATABASE];
export type StorageErrorCode    = typeof ERROR_CODES.STORAGE[keyof typeof ERROR_CODES.STORAGE];
export type HttpStatusCode      = typeof ERROR_CODES.HTTP[keyof typeof ERROR_CODES.HTTP];
export type ValidationErrorCode = typeof ERROR_CODES.VALIDATION[keyof typeof ERROR_CODES.VALIDATION];
export type RetryErrorCode      = typeof ERROR_CODES.RETRY[keyof typeof ERROR_CODES.RETRY];

/** Union of all string error codes (excludes HTTP numeric codes). */
export type AnyErrorCode =
  | AuthErrorCode
  | NetworkErrorCode
  | DatabaseErrorCode
  | StorageErrorCode
  | ValidationErrorCode
  | RetryErrorCode;

// ============================================================================
// AUTH HELPERS
// ============================================================================

/**
 * Map a normalized AuthError instance to a canonical `AuthErrorCode`.
 */
export function mapAuthErrorToCode(error: unknown): AuthErrorCode {
  if (error instanceof InvalidCredentialsError) return ERROR_CODES.AUTH.INVALID_CREDENTIALS;
  if (error instanceof EmailAlreadyExistsError)  return ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS;
  if (error instanceof UserNotFoundError)        return ERROR_CODES.AUTH.USER_NOT_FOUND;
  if (error instanceof NetworkError)             return ERROR_CODES.AUTH.UNKNOWN; // auth context — use AUTH.UNKNOWN
  if (error instanceof RateLimitError)           return ERROR_CODES.AUTH.RATE_LIMIT;
  return ERROR_CODES.AUTH.UNKNOWN;
}

/**
 * Friendly default messages for each auth code.
 * UI should prefer a proper text/localization layer over this.
 */
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

// ============================================================================
// ERROR CODE METADATA REGISTRY
// ============================================================================
// Provides structured information about each error code for:
// - Error categorization and filtering (Sentry, logs)
// - Retry strategy determination
// - User message lookup
// - Severity/priority classification
// - Recovery automation

export interface ErrorCodeMetadata {
  category: string; // 'auth', 'network', 'database', 'storage', 'validation', 'unknown'
  severity: 'warning' | 'error' | 'critical'; // For Sentry/logging
  recoverable: boolean; // Should this error trigger a retry?
  retryStrategy?: 'exponential-backoff' | 'linear' | 'none'; // How to retry (if recoverable)
  userMessage?: string; // Pre-composed user-friendly message (optional; prefer Text System)
}

export const ERROR_CODES_METADATA: Record<string, ErrorCodeMetadata> = {
  // AUTH codes
  [ERROR_CODES.AUTH.INVALID_CREDENTIALS]: {
    category: 'auth',
    severity: 'error',
    recoverable: false,
    userMessage: 'Invalid email or password. Please try again.',
  },
  [ERROR_CODES.AUTH.EMAIL_ALREADY_EXISTS]: {
    category: 'auth',
    severity: 'error',
    recoverable: false,
    userMessage: 'An account with this email already exists.',
  },
  [ERROR_CODES.AUTH.USER_NOT_FOUND]: {
    category: 'auth',
    severity: 'error',
    recoverable: false,
    userMessage: 'No account found with this email.',
  },
  [ERROR_CODES.AUTH.EMAIL_NOT_CONFIRMED]: {
    category: 'auth',
    severity: 'warning',
    recoverable: false,
    userMessage: 'Please verify your email address before signing in.',
  },
  [ERROR_CODES.AUTH.WEAK_PASSWORD]: {
    category: 'auth',
    severity: 'warning',
    recoverable: false,
    userMessage: 'Your password does not meet security requirements.',
  },
  [ERROR_CODES.AUTH.SESSION_EXPIRED]: {
    category: 'auth',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'none', // User must re-authenticate
    userMessage: 'Your session has expired. Please sign in again.',
  },
  [ERROR_CODES.AUTH.PERMISSION_DENIED]: {
    category: 'auth',
    severity: 'error',
    recoverable: false,
    userMessage: 'You do not have permission to perform this action.',
  },
  [ERROR_CODES.AUTH.RATE_LIMIT]: {
    category: 'auth',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'linear',
    userMessage: 'Too many attempts. Please wait and try again later.',
  },
  [ERROR_CODES.AUTH.UNKNOWN]: {
    category: 'auth',
    severity: 'error',
    recoverable: false,
  },

  // NETWORK codes
  [ERROR_CODES.NETWORK.TIMEOUT]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.NETWORK.OFFLINE]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'none', // Queued until online
  },
  [ERROR_CODES.NETWORK.UNREACHABLE]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.NETWORK.FETCH_FAILED]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.NETWORK.DNS_RESOLUTION_FAILED]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.NETWORK.CONNECTION_REFUSED]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.NETWORK.CONNECTION_RESET]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.NETWORK.SOCKET_HANG_UP]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.NETWORK.RATE_LIMIT]: {
    category: 'network',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'linear',
  },

  // DATABASE codes
  [ERROR_CODES.DATABASE.UNIQUE_VIOLATION]: {
    category: 'database',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATABASE.NOT_FOUND]: {
    category: 'database',
    severity: 'warning',
    recoverable: false,
  },
  [ERROR_CODES.DATABASE.PERMISSION_DENIED]: {
    category: 'database',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATABASE.CONSTRAINT_VIOLATION]: {
    category: 'database',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATABASE.CONFLICT]: {
    category: 'database',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATABASE.CONNECTION_FAILED]: {
    category: 'database',
    severity: 'error',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.DATABASE.QUERY_FAILED]: {
    category: 'database',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.DATABASE.SYNTAX_ERROR]: {
    category: 'database',
    severity: 'critical',
    recoverable: false,
  },
  [ERROR_CODES.DATABASE.TIMEOUT]: {
    category: 'database',
    severity: 'warning',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.DATABASE.UNKNOWN]: {
    category: 'database',
    severity: 'error',
    recoverable: false,
  },

  // STORAGE codes
  [ERROR_CODES.STORAGE.QUOTA_EXCEEDED]: {
    category: 'storage',
    severity: 'critical',
    recoverable: false,
  },
  [ERROR_CODES.STORAGE.PARSE_ERROR]: {
    category: 'storage',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.STORAGE.VALIDATION_ERROR]: {
    category: 'storage',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.STORAGE.ENCRYPTION_FAILED]: {
    category: 'storage',
    severity: 'critical',
    recoverable: false,
  },
  [ERROR_CODES.STORAGE.DECRYPTION_FAILED]: {
    category: 'storage',
    severity: 'critical',
    recoverable: false,
  },
  [ERROR_CODES.STORAGE.PERMISSION_DENIED]: {
    category: 'storage',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.STORAGE.NOT_FOUND]: {
    category: 'storage',
    severity: 'warning',
    recoverable: false,
  },
  [ERROR_CODES.STORAGE.WRITE_FAILED]: {
    category: 'storage',
    severity: 'error',
    recoverable: true,
    retryStrategy: 'exponential-backoff',
  },
  [ERROR_CODES.STORAGE.UNKNOWN]: {
    category: 'storage',
    severity: 'error',
    recoverable: false,
  },

  // VALIDATION codes
  [ERROR_CODES.VALIDATION.INVALID_EMAIL]: {
    category: 'validation',
    severity: 'warning',
    recoverable: false,
  },
  [ERROR_CODES.VALIDATION.WEAK_PASSWORD]: {
    category: 'validation',
    severity: 'warning',
    recoverable: false,
  },
  [ERROR_CODES.VALIDATION.REQUIRED_FIELD]: {
    category: 'validation',
    severity: 'warning',
    recoverable: false,
  },
  [ERROR_CODES.VALIDATION.INVALID_FORMAT]: {
    category: 'validation',
    severity: 'warning',
    recoverable: false,
  },

  // UNKNOWN code
  [ERROR_CODES.UNKNOWN.GENERAL]: {
    category: 'unknown',
    severity: 'error',
    recoverable: false,
  },
  [ERROR_CODES.UNKNOWN.UNCLASSIFIED]: {
    category: 'unknown',
    severity: 'error',
    recoverable: false,
  },
};

/**
 * Type-safe type for all error codes (string union)
 */
export type ErrorCodeType = AnyErrorCode | typeof ERROR_CODES.UNKNOWN.GENERAL;
