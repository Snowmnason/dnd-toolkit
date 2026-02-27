/**
 * HTTP Status Code → Error Code Mapper
 *
 * Converts HTTP status codes (4xx, 5xx) to standardized `ERROR_CODES.HTTP.*` entries.
 * Used by request handlers and API clients to provide consistent error categorization.
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetch('/api/users');
 *   if (!response.ok) {
 *     const code = statusToErrorCode(response.status);
 *     throw new AppError(code, `HTTP ${response.status}`);
 *   }
 * } catch (error) {
 *   // error.code will be ERROR_CODES.HTTP.* (UNAUTHORIZED, NOT_FOUND, etc.)
 * }
 * ```
 */

import { ERROR_CODES, type HttpStatusCode } from './ERROR_CODES';

/**
 * Map HTTP status code (number) to canonical HTTP error code (number from ERROR_CODES.HTTP)
 * Returns the status code itself as the error code (since HTTP codes are numeric)
 *
 * For 2xx (success) status codes, returns null or should not be called.
 * For 3xx (redirect) status codes, returns null (should be handled at fetch layer).
 * For 4xx, 5xx, returns the status code mapped to ERROR_CODES.HTTP entry.
 *
 * @param status - HTTP status code (e.g., 404, 500)
 * @returns HttpStatusCode from ERROR_CODES.HTTP (e.g., 404, 500), or INTERNAL_SERVER_ERROR as fallback
 *
 * @example
 * statusToErrorCode(404)  // returns ERROR_CODES.HTTP.NOT_FOUND (404)
 * statusToErrorCode(401)  // returns ERROR_CODES.HTTP.UNAUTHORIZED (401)
 * statusToErrorCode(429)  // returns ERROR_CODES.HTTP.RATE_LIMITED (429)
 * statusToErrorCode(599)  // returns ERROR_CODES.HTTP.INTERNAL_SERVER_ERROR (500) as fallback
 */
export function statusToErrorCode(status: number): HttpStatusCode {
  const statusMap: Record<number, HttpStatusCode> = {
    [ERROR_CODES.HTTP.BAD_REQUEST]: ERROR_CODES.HTTP.BAD_REQUEST, // 400
    [ERROR_CODES.HTTP.UNAUTHORIZED]: ERROR_CODES.HTTP.UNAUTHORIZED, // 401
    [ERROR_CODES.HTTP.FORBIDDEN]: ERROR_CODES.HTTP.FORBIDDEN, // 403
    [ERROR_CODES.HTTP.NOT_FOUND]: ERROR_CODES.HTTP.NOT_FOUND, // 404
    [ERROR_CODES.HTTP.RATE_LIMITED]: ERROR_CODES.HTTP.RATE_LIMITED, // 429
    [ERROR_CODES.HTTP.INTERNAL_SERVER_ERROR]: ERROR_CODES.HTTP.INTERNAL_SERVER_ERROR, // 500
    [ERROR_CODES.HTTP.BAD_GATEWAY]: ERROR_CODES.HTTP.BAD_GATEWAY, // 502
    [ERROR_CODES.HTTP.SERVICE_UNAVAILABLE]: ERROR_CODES.HTTP.SERVICE_UNAVAILABLE, // 503
    [ERROR_CODES.HTTP.GATEWAY_TIMEOUT]: ERROR_CODES.HTTP.GATEWAY_TIMEOUT, // 504
  };

  // eslint-disable-next-line security/detect-object-injection
  return statusMap[status] ?? ERROR_CODES.HTTP.INTERNAL_SERVER_ERROR;
}

/**
 * Get human-readable HTTP status message
 * @param status - HTTP status code
 * @returns Description (e.g., "Bad Request", "Unauthorized")
 *
 * @example
 * getStatusMessage(404) // "Not Found"
 * getStatusMessage(500) // "Internal Server Error"
 */
export function getStatusMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Rate Limited',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  // eslint-disable-next-line security/detect-object-injection
  return messages[status] ?? `HTTP ${status}`;
}

/**
 * Check if status code indicates client error (4xx)
 */
export function isClientError(status: number): boolean {
  return status >= 400 && status < 500;
}

/**
 * Check if status code indicates server error (5xx)
 */
export function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

/**
 * Check if status code indicates a temporary/transient error (can retry)
 */
export function isTransientError(status: number): boolean {
  // 408 = Request Timeout (can retry)
  // 429 = Too Many Requests (can retry with backoff)
  // 5xx = Server errors (can retry)
  return status === 408 || status === 429 || isServerError(status);
}

/**
 * Check if status code indicates a permanent error (should not retry)
 */
export function isPermanentError(status: number): boolean {
  return isClientError(status) && status !== 408 && status !== 429;
}
