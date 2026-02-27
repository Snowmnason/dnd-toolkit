/**
 * Typed Application Error with Error Code
 *
 * All errors thrown in the app should use this class to ensure:
 * - Type-safe error codes (not arbitrary strings)
 * - Consistent error metadata (category, severity, recoverable)
 * - Better error handling and logging
 * - Easier Sentry integration
 *
 * @example
 * ```typescript
 * throw new AppError(ERROR_CODES.NETWORK.TIMEOUT, 'Request took too long');
 * throw new AppError(ERROR_CODES.AUTH.INVALID_CREDENTIALS, 'Email or password is incorrect', originalError);
 * ```
 */

import { ERROR_CODES, ERROR_CODES_METADATA, type ErrorCodeType } from '../maps/ERROR_CODES';

/**
 * Application Error with typed error code and metadata
 * Extends Error to be compatible with standard error handling
 */
export class AppError extends Error {
  readonly code: ErrorCodeType;
  readonly category: string;
  readonly severity: 'warning' | 'error' | 'critical';
  readonly recoverable: boolean;
  readonly retryStrategy?: 'exponential-backoff' | 'linear' | 'none';
  readonly originalError?: Error;
  readonly timestamp: number;

  constructor(
    code: ErrorCodeType,
    message: string,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = Date.now();

    // Get metadata for this error code
    const metadata = ERROR_CODES_METADATA[code as keyof typeof ERROR_CODES_METADATA];
    if (!metadata) {
      // Fallback for unknown codes
      this.category = 'unknown';
      this.severity = 'error';
      this.recoverable = false;
    } else {
      this.category = metadata.category;
      this.severity = metadata.severity;
      this.recoverable = metadata.recoverable;
      this.retryStrategy = metadata.retryStrategy;
    }

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Get user-friendly message from metadata (if available)
   */
  getUserMessage(): string {
    const metadata = ERROR_CODES_METADATA[this.code as keyof typeof ERROR_CODES_METADATA];
    return metadata?.userMessage || this.message;
  }

  /**
   * Serialize for logging/Sentry
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      recoverable: this.recoverable,
      retryStrategy: this.retryStrategy,
      timestamp: this.timestamp,
      stack: this.stack,
      originalError: this.originalError ? {
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
    };
  }
}

/**
 * Type guard: check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert any error to AppError
 * If already AppError, returns as-is
 * If unknown error, maps to UNKNOWN code with original error attached
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      ERROR_CODES.UNKNOWN.UNCLASSIFIED,
      error.message,
      error
    );
  }

  return new AppError(
    ERROR_CODES.UNKNOWN.UNCLASSIFIED,
    String(error),
    undefined
  );
}
