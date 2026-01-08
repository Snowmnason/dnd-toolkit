/**
 * Error Categorization
 * Standardizes error types for analytics and debugging
 */

export type ErrorCategory = 
  | 'network'     // Network failures, timeouts, offline
  | 'auth'        // Auth failures, token expiry, permission denied
  | 'validation'  // Input validation, constraint violations
  | 'timeout'     // Request/operation timeout
  | 'unknown';    // Uncategorized

export function categorizeError(error: any): ErrorCategory {
  if (!error) return 'unknown';

  const message = typeof error.message === 'string' ? error.message : '';
  const name = typeof error.name === 'string' ? error.name : '';
  const code = error.code;

  // Network
  if (message.includes('Network') || message.includes('fetch') || 
      message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') ||
      name === 'NetworkError' || code === 'NETWORK_ERROR') {
    return 'network';
  }

  // Auth
  if (message.includes('auth') || message.includes('unauthorized') || 
      message.includes('forbidden') || message.includes('401') || 
      message.includes('403') || name === 'AuthError' || code === 'AUTH_ERROR') {
    return 'auth';
  }

  // Timeout
  if (message.includes('timeout') || message.includes('Timeout') || 
      code === 'ETIMEDOUT' || code === 'TIMEOUT') {
    return 'timeout';
  }

  // Validation
  if (message.includes('validation') || message.includes('invalid') || 
      message.includes('required') || code === 'VALIDATION_ERROR') {
    return 'validation';
  }

  return 'unknown';
}
