/**
 * Error Code Validation & Type Guards
 *
 * Validates that errors use recognized error codes from the centralized registry.
 * Helps catch typos and usage errors at development time.
 *
 * Dev-only validation can warn when invalid codes are used, helping developers
 * discover issues early before they reach production.
 */

import { ERROR_CODES, ERROR_CODES_METADATA, type ErrorCodeType } from '../../maps/ERROR_CODES';
import { logger } from '../utils/logger';

/**
 * Check if a string is a valid error code
 * @param code - String to validate
 * @returns true if code exists in ERROR_CODES or ERROR_CODES_METADATA
 *
 * @example
 * if (isValidErrorCode(ERROR_CODES.NETWORK.TIMEOUT)) { // true
 *   // safe to use
 * }
 * if (isValidErrorCode('UNKNOWN_ERROR_CODE')) { // false
 *   logger.category('error').warn('Invalid error code used');
 * }
 */
export function isValidErrorCode(code: unknown): code is ErrorCodeType {
  if (typeof code !== 'string') {
    return false;
  }

  // Check if this code exists in the metadata registry
  return code in ERROR_CODES_METADATA;
}

/**
 * Assert that a code is valid; throw if not
 * @param code - Code to validate
 * @throws Error if code is not valid
 *
 * @example
 * assertValidErrorCode(ERROR_CODES.AUTH.INVALID_CREDENTIALS); // passes
 * assertValidErrorCode('FAKE_CODE'); // throws
 */
export function assertValidErrorCode(code: unknown): asserts code is ErrorCodeType {
  if (!isValidErrorCode(code)) {
    throw new Error(`Invalid error code: ${code}`);
  }
}

/**
 * Dev-only validation: warn if an error code is invalid
 * Should only be called in development; disabled in production
 *
 * @param code - Code to validate
 * @param context - Optional context (where the code was used)
 *
 * @example
 * // In error handler:
 * function handleError(error: AppError) {
 *   validateErrorCodeDev(error.code, 'RequestManager.handleError');
 *   // ... rest of handling
 * }
 */
export function validateErrorCodeDev(code: unknown, context?: string): void {
  // Skip in production
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return;
  }

  if (!isValidErrorCode(code)) {
    const ctxStr = context ? ` in ${context}` : '';
    logger.category('error').warn(
      `Unrecognized error code used${ctxStr}: "${code}"\n` +
      `This error code is not registered in ERROR_CODES_METADATA. ` +
      `Add it to lib/utils/ERROR_CODES.ts to make it discoverable.`
    );
  }
}

/**
 * Get all valid error codes (for reference, documentation, validation)
 * @returns Array of all registered error code strings
 *
 * @example
 * const allCodes = getAllErrorCodes();
 * const hasNetworkTimeout = allCodes.includes(ERROR_CODES.NETWORK.TIMEOUT);
 */
export function getAllErrorCodes(): ErrorCodeType[] {
  return Object.keys(ERROR_CODES_METADATA).filter(code => {
    // Exclude raw networking codes (NETWORK.RAW.*) as they're for detection, not throwing
    return code !== ERROR_CODES.NETWORK.RAW.NETWORK_ERROR &&
           code !== ERROR_CODES.NETWORK.RAW.FETCH_ERROR &&
           code !== ERROR_CODES.NETWORK.RAW.TIMEOUT &&
           code !== ERROR_CODES.NETWORK.RAW.ENOTFOUND &&
           code !== ERROR_CODES.NETWORK.RAW.ECONNREFUSED &&
           code !== ERROR_CODES.NETWORK.RAW.ECONNRESET &&
           code !== ERROR_CODES.NETWORK.RAW.ETIMEDOUT &&
           code !== ERROR_CODES.NETWORK.RAW.ENETRESET;
  }) as ErrorCodeType[];
}

/**
 * Get all error codes in a specific category
 * @param category - Category name (e.g., 'network', 'auth')
 * @returns Array of error codes in that category
 *
 * @example
 * const networkErrors = getErrorCodesByCategory('network');
 * // Returns: [NETWORK_TIMEOUT, NETWORK_OFFLINE, ...]
 */
export function getErrorCodesByCategory(category: string): ErrorCodeType[] {
  return getAllErrorCodes().filter(
    (code) => ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA]?.category === category
  );
}

/**
 * Check if an error code is recoverable (safe to retry)
 * @param code - Error code to check
 * @returns true if the error is temporary and should trigger a retry
 *
 * @example
 * const code = ERROR_CODES.NETWORK.TIMEOUT;
 * if (isRecoverableError(code)) {
 *   // schedule retry
 * }
 */
export function isRecoverableError(code: unknown): boolean {
  if (!isValidErrorCode(code)) {
    return false;
  }
  return ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA]?.recoverable ?? false;
}

/**
 * Get retry strategy for an error code
 * @param code - Error code to check
 * @returns Retry strategy name, or undefined if not recoverable
 *
 * @example
 * const strategy = getRetryStrategy(ERROR_CODES.NETWORK.TIMEOUT);
 * // Returns: 'exponential-backoff'
 */
export function getRetryStrategy(code: unknown): 'exponential-backoff' | 'linear' | 'none' | undefined {
  if (!isValidErrorCode(code)) {
    return undefined;
  }
  return ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA]?.retryStrategy;
}

/**
 * Get severity level for an error code
 * @param code - Error code to check
 * @returns Severity: 'warning', 'error', or 'critical'
 *
 * @example
 * const severity = getErrorSeverity(ERROR_CODES.STORAGE.ENCRYPTION_FAILED);
 * // Returns: 'critical'
 */
export function getErrorSeverity(code: unknown): 'warning' | 'error' | 'critical' | undefined {
  if (!isValidErrorCode(code)) {
    return undefined;
  }
  return ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA]?.severity;
}

/**
 * Get category for an error code
 * @param code - Error code to check
 * @returns Category: 'auth', 'network', 'database', etc.
 *
 * @example
 * const category = getErrorCategory(ERROR_CODES.NETWORK.TIMEOUT);
 * // Returns: 'network'
 */
export function getErrorCategory(code: unknown): string | undefined {
  if (!isValidErrorCode(code)) {
    return undefined;
  }
  return ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA]?.category;
}

/**
 * Get user-friendly message for an error code
 * Returns the pre-composed message if available, or undefined if not defined
 * (UI should prefer a proper Text/Localization system for user messages)
 *
 * @param code - Error code to check
 * @returns User message, or undefined if not set
 *
 * @example
 * const message = getErrorUserMessage(ERROR_CODES.AUTH.INVALID_CREDENTIALS);
 * // Returns: 'Invalid email or password. Please try again.'
 */
export function getErrorUserMessage(code: unknown): string | undefined {
  if (!isValidErrorCode(code)) {
    return undefined;
  }
  return ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA]?.userMessage;
}
