/**
 * Error Enrichment Abstraction
 *
 * Provides a centralized way to enrich errors with error codes and metadata
 * before sending to Sentry, logger, or other observability systems.
 *
 * Philosophy: Abstract away error code lookups and metadata extraction
 * so that all error tracking code follows a consistent pattern.
 *
 * Usage:
 *   // Enrich error with code before tracking/logging
 *   const enriched = enrichError(error, ERROR_CODES.NETWORK.TIMEOUT);
 *   getErrorTracker().captureException(enriched.originalError, { breadcrumbs: [enriched.toBreadcrumb()] });
 *   // Use category-chaining API for logging:
 *   logger.category(enriched.category as any).error(enriched.message, enriched.toLogMetadata());
 */

import { ERROR_CODES_METADATA, type ErrorCodeType } from '@/maps/ERROR_CODES';
import { isAppError } from '@/pure-algo-immutables/app-error';

/**
 * Structured error enrichment with metadata from ERROR_CODES registry
 * Can be converted to different formats (Sentry breadcrumb, logger metadata, etc.)
 */
export interface EnrichedError {
  // Original error info
  originalError: Error;
  message: string;
  code: ErrorCodeType;

  // Metadata from ERROR_CODES_METADATA
  category: string;
  severity: 'warning' | 'error' | 'critical';
  recoverable: boolean;
  retryStrategy?: 'exponential-backoff' | 'linear' | 'none';
  userMessage?: string;

  // Context (optional, user-provided)
  context?: Record<string, any>;

  // Format methods for different systems
  toBreadcrumb(): { message: string; data: Record<string, any> };
  toLogMetadata(): Record<string, any>;
  toJSON(): Record<string, any>;
}

/**
 * Enrich an error with error code metadata
 *
 * Looks up metadata from ERROR_CODES_METADATA and returns a structured object
 * that can be formatted for Sentry breadcrumbs, logging, or other systems.
 *
 * @param error - The error to enrich
 * @param code - The error code (from ERROR_CODES)
 * @param context - Optional additional context (endpoint, retries, etc.)
 * @returns EnrichedError with all metadata and formatter methods
 *
 * @example
 * // In request-manager.ts:
 * try {
 *   const response = await fetch(url);
 * } catch (error) {
 *   const enriched = enrichError(error as Error, ERROR_CODES.NETWORK.TIMEOUT, {
 *     endpoint: url,
 *     retries: attemptCount
 *   });
 *   getErrorTracker().captureException(enriched.originalError, {
 *     breadcrumbs: [enriched.toBreadcrumb()]
 *   });
 * }
 */
export function enrichError(
  error: Error | unknown,
  code: ErrorCodeType,
  context?: Record<string, any>,
): EnrichedError {
  const originalError = error instanceof Error ? error : new Error(String(error));
  const message = originalError.message || String(error);

  // Look up metadata
  const metadata = ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA];

  if (!metadata) {
    // Fallback for unknown codes
    return {
      originalError,
      message,
      code,
      category: 'unknown',
      severity: 'error',
      recoverable: false,
      context,

      toBreadcrumb() {
        return {
          message,
          data: {
            errorCode: code,
            category: 'unknown',
            severity: 'error',
            recoverable: false,
            ...context,
          },
        };
      },

      toLogMetadata() {
        return {
          code,
          category: 'unknown',
          severity: 'error',
          recoverable: false,
          ...context,
        };
      },

      toJSON() {
        return {
          originalError: {
            message: originalError.message,
            stack: originalError.stack,
          },
          message,
          code,
          category: 'unknown',
          severity: 'error',
          recoverable: false,
          context,
        };
      },
    };
  }

  // Full metadata available
  return {
    originalError,
    message,
    code,
    category: metadata.category,
    severity: metadata.severity,
    recoverable: metadata.recoverable,
    retryStrategy: metadata.retryStrategy,
    userMessage: metadata.userMessage,
    context,

    /**
     * Format as Sentry breadcrumb
     * Can be passed directly to getErrorTracker().captureException() options
     */
    toBreadcrumb() {
      return {
        message: `${this.category.toUpperCase()}: ${message}`,
        data: {
          errorCode: code,
          category: metadata.category,
          severity: metadata.severity,
          recoverable: metadata.recoverable,
          retryStrategy: metadata.retryStrategy,
          userMessage: metadata.userMessage,
          ...context,
        },
      };
    },

    /**
     * Format as logger metadata
     * Can be passed directly to logger.category("other").error(message, metadata)
     */
    toLogMetadata() {
      return {
        code,
        category: metadata.category,
        severity: metadata.severity,
        recoverable: metadata.recoverable,
        retryStrategy: metadata.retryStrategy,
        userMessage: metadata.userMessage,
        ...context,
      };
    },

    /**
     * Full JSON serialization for storage/debugging
     */
    toJSON() {
      return {
        originalError: {
          message: originalError.message,
          stack: originalError.stack,
        },
        message,
        code,
        category: metadata.category,
        severity: metadata.severity,
        recoverable: metadata.recoverable,
        retryStrategy: metadata.retryStrategy,
        userMessage: metadata.userMessage,
        context,
      };
    },
  };
}

/**
 * Extract error code from AppError if present
 * Useful for conditionally enriching errors
 *
 * @param error - Possibly an AppError with a code property
 * @returns Error code if found, undefined otherwise
 *
 * @example
 * const code = extractErrorCode(error);
 * if (code) {
 *   const enriched = enrichError(error, code);
 *   // ... track enriched error
 * }
 */
export function extractErrorCode(error: unknown): ErrorCodeType | undefined {
  if (isAppError(error)) {
    return error.code;
  }
  return undefined;
}

/**
 * Batch enrichment: process multiple errors at once
 * Useful for queuing multiple errors before sending to Sentry
 *
 * @param errors - Array of [error, code] tuples
 * @returns Array of EnrichedError objects
 *
 * @example
 * const enriched = enrichErrors([
 *   [error1, ERROR_CODES.NETWORK.TIMEOUT],
 *   [error2, ERROR_CODES.AUTH.SESSION_EXPIRED],
 * ]);
 * // All enriched errors ready for Sentry
 */
export function enrichErrors(
  errors: [Error | unknown, ErrorCodeType, Record<string, any>?][],
): EnrichedError[] {
  return errors.map(([error, code, context]) => enrichError(error, code, context));
}

/**
 * Type guard: check if an object is an EnrichedError
 */
export function isEnrichedError(obj: unknown): obj is EnrichedError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'originalError' in obj &&
    'code' in obj &&
    'toBreadcrumb' in obj &&
    'toLogMetadata' in obj
  );
}
