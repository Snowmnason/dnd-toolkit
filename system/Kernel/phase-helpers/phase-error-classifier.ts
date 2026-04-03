/**
 * Phase Error Classifier
 *
 * Maps errors to failure types:
 * - 'unreachable': Network/connectivity errors (can skip phase safely)
 * - 'timeout': Operation exceeded timeout (can skip phase safely)
 * - 'non-recoverable': System/storage/logic errors (should halt bootstrap)
 *
 * Used by app-kernel to route failures to appropriate handlers.
 */

export type FailureType = "unreachable" | "timeout" | "non-recoverable";

/**
 * Classify a phase error into one of three failure types
 *
 * @param error The error to classify
 * @returns 'unreachable' | 'timeout' | 'non-recoverable'
 *
 * @example
 * try {
 *   await executePhase('network', { timeout: 1750 });
 * } catch (error) {
 *   const failureType = classifyPhaseError(error);
 *   if (failureType === 'unreachable') {
 *     // Skip phase, enter offline mode
 *   } else if (failureType === 'timeout') {
 *     // Skip phase but mark for retry
 *   } else {
 *     // Crash: non-recoverable
 *     throw error;
 *   }
 * }
 */
export function classifyPhaseError(error: unknown): FailureType {
  // Extract error code if it's an Error object
  const code = extractErrorCode(error);

  // Network/connectivity unreachable errors
  if (
    [
      "ENOTFOUND",      // DNS resolution failed
      "EHOSTUNREACH",   // Host unreachable
      "ECONNREFUSED",   // Connection refused
      "ENETUNREACH",    // Network unreachable
      "ECONNRESET",     // Connection reset by peer
      "ENETDOWN",       // Network is down
    ].includes(code)
  ) {
    return "unreachable";
  }

  // Timeout errors
  if (
    [
      "ETIMEDOUT",           // Operation timed out
      "DEADLINE_EXCEEDED",   // Deadline exceeded (gRPC)
      "ERR_HTTP_REQUEST_TIMEOUT",
    ].includes(code)
  ) {
    return "timeout";
  }

  // Storage/system errors = non-recoverable
  if (
    [
      "EACCES",       // Permission denied
      "EISDIR",       // Is a directory
      "ENOENT",       // File not found
      "ENOSPC",       // No space left on device
      "ENOTDIR",      // Not a directory
      "EMFILE",       // Too many open files
    ].includes(code)
  ) {
    return "non-recoverable";
  }

  // Default: anything else is non-recoverable
  return "non-recoverable";
}

/**
 * Extract error code from various error types
 *
 * Handles:
 * - Native Error objects (error.code, error.message)
 * - Axios errors (error.response?.status, error.code)
 * - Custom AppError objects
 * - Plain strings
 *
 * @param error The error to extract code from
 * @returns Error code string or empty string if not found
 */
function extractErrorCode(error: unknown): string {
  if (!error) return "";

  // Handle Error objects with code property
  if (error instanceof Error) {
    const errWithCode = error as Error & { code?: string; errno?: number };
    if (errWithCode.code) return errWithCode.code;

    // Try to parse error message: "Error: ENOTFOUND: ..."
    const match = errWithCode.message.match(/^(\w+):/);
    if (match) return match[1];

    return "";
  }

  // Handle plain objects (Axios errors, custom errors)
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === "string") return obj.code;
    if (typeof obj.errno === "number") return String(obj.errno);
    if (obj.response && typeof obj.response === "object") {
      const resp = obj.response as Record<string, unknown>;
      if (typeof resp.status === "number" && resp.status >= 500) {
        return `HTTP_${resp.status}`;
      }
    }
  }

  // Handle string errors
  if (typeof error === "string") {
    const match = error.match(/^(\w+):/);
    if (match) return match[1];
  }

  return "";
}

/**
 * Check if a failure type means the phase can be skipped safely
 *
 * @param failureType The classified failure type
 * @returns true if phase can be skipped, false if should crash
 */
export function isSkippable(failureType: FailureType): boolean {
  return failureType === "unreachable" || failureType === "timeout";
}

/**
 * Check if a failure type indicates a timeout
 * (used to set retriable flag on phase state)
 *
 * @param failureType The classified failure type
 * @returns true if timeout, false otherwise
 */
export function isTimeout(failureType: FailureType): boolean {
  return failureType === "timeout";
}
