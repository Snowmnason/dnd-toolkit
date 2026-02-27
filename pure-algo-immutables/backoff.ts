/**
 * Backoff Utilities for Job Retry Logic
 *
 * Exponential backoff with jitter to prevent thundering herd and ensure
 * resilient retry behavior across app restarts and network flaps.
 */

/**
 * Calculate exponential backoff delay with jitter
 *
 * Formula:
 * - Base delay: baseDelayMs * (2 ^ retryCount)
 * - Max delay: capped at ~32 seconds (32000ms)
 * - Jitter: ±20% random variance added to final delay
 *
 * @param retryCount - Number of retries attempted so far (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000ms)
 * @returns Delay in milliseconds for this retry
 *
 * @example
 * calculateBackoffDelay(0, 1000) // ~1000ms ±200ms
 * calculateBackoffDelay(1, 1000) // ~2000ms ±400ms
 * calculateBackoffDelay(2, 1000) // ~4000ms ±800ms
 * calculateBackoffDelay(5, 1000) // ~32000ms ±6400ms (capped)
 */
import { ERROR_CODES } from '../maps/ERROR_CODES';

export function calculateBackoffDelay(
  retryCount: number,
  baseDelayMs: number = 1000,
): number {
  // Exponential: 2^retryCount
  const exponentialDelay = baseDelayMs * Math.pow(2, retryCount);

  // Cap at 32 seconds to prevent unreasonably long waits
  const cappedDelay = Math.min(exponentialDelay, 32000);

  // Add ±20% jitter to avoid thundering herd
  const jitterPercent = 0.2;
  const jitterAmount = cappedDelay * jitterPercent;
  const jitter = (Math.random() - 0.5) * 2 * jitterAmount; // Random between -jitterAmount and +jitterAmount

  const finalDelay = Math.max(0, cappedDelay + jitter);

  return Math.round(finalDelay);
}

/**
 * Calculate next retry timestamp based on current time and backoff delay
 *
 * @param retryCount - Number of retries so far
 * @param baseDelayMs - Base delay in milliseconds
 * @param now - Current timestamp (Date.now(), default: current time)
 * @returns Timestamp when the job should be retried
 *
 * @example
 * const retryAt = calculateNextRetryTime(1, 1000);
 * // Returns roughly Date.now() + 2000ms ±400ms
 */
export function calculateNextRetryTime(
  retryCount: number,
  baseDelayMs: number = 1000,
  now: number = Date.now(),
): number {
  const backoffDelay = calculateBackoffDelay(retryCount, baseDelayMs);
  return now + backoffDelay;
}

/**
 * Check if an error is retryable based on common HTTP status codes and patterns
 *
 * Retryable errors:
 * - Network errors (connection timeout, socket hang up)
 * - 5xx Server errors (500, 502, 503, 504)
 * - 429 Rate limit (with longer backoff)
 *
 * Non-retryable errors:
 * - 400 Bad Request
 * - 401 Unauthorized
 * - 403 Forbidden
 * - 404 Not Found
 *
 * @param error - Error or error-like object to classify
 * @returns true if error should trigger a retry, false otherwise
 *
 * @example
 * isRetryable(new Error('ECONNREFUSED')) // true
 * isRetryable({ message: 'Unauthorized', code: 401 }) // false
 */
export function isRetryable(error: any): boolean {
  if (!error) return false;

  // Extract error code/status
  const code = error.code || error.status || error.statusCode;
  const message = String(error.message || error).toLowerCase();

  // Non-retryable HTTP status codes
  const nonRetryableCodes = [
    ERROR_CODES.HTTP.BAD_REQUEST,
    ERROR_CODES.HTTP.UNAUTHORIZED,
    ERROR_CODES.HTTP.FORBIDDEN,
    ERROR_CODES.HTTP.NOT_FOUND,
  ];
  if (nonRetryableCodes.includes(code)) {
    return false;
  }

  // Retryable HTTP status codes (5xx, 429)
  const retryableCodes = [
    ERROR_CODES.HTTP.RATE_LIMITED,
    ERROR_CODES.HTTP.INTERNAL_SERVER_ERROR,
    ERROR_CODES.HTTP.BAD_GATEWAY,
    ERROR_CODES.HTTP.SERVICE_UNAVAILABLE,
    ERROR_CODES.HTTP.GATEWAY_TIMEOUT,
  ];
  if (retryableCodes.includes(code)) {
    return true;
  }

  // Network error patterns (retryable) — lowercase message matching against known OS codes
  const networkPatterns = [
    ERROR_CODES.NETWORK.RAW.ECONNREFUSED.toLowerCase(),
    ERROR_CODES.NETWORK.RAW.ECONNRESET.toLowerCase(),
    ERROR_CODES.NETWORK.RAW.ETIMEDOUT.toLowerCase(),
    ERROR_CODES.NETWORK.RAW.ENETRESET.toLowerCase(),
    'socket hang up',
    'network error',
    'offline',
  ];
  if (networkPatterns.some((pattern) => message.includes(pattern))) {
    return true;
  }

  // Default: treat as retryable (safe default for unknown errors)
  return true;
}

/**
 * Format a delay for human-readable logging
 *
 * @param delayMs - Delay in milliseconds
 * @returns Human-readable string (e.g., "1.5s", "2m30s")
 *
 * @example
 * formatDelay(1500) // "1.5s"
 * formatDelay(150000) // "2m30s"
 */
export function formatDelay(delayMs: number): string {
  if (delayMs < 1000) {
    return `${(delayMs / 1000).toFixed(2)}s`;
  }

  const seconds = Math.floor(delayMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m${remainingSeconds}s`;
}
