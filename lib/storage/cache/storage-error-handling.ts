/**
 * Storage Error Handling Utilities
 * 
 * Provides graceful error handling for all SecureStorage operations.
 * Complements network error handling with robust storage layer defense.
 * 
 * Strategy: Fail gracefully at storage layer so app doesn't crash on:
 * - Storage quota exceeded
 * - Encryption/decryption errors
 * - Corrupted data
 * - Platform-specific storage failures
 */

import { ERROR_CODES, StorageErrorCode } from '../../../maps/ERROR_CODES';
import { logger } from '../../utils/logger';

// ==========================================
// Types
// ==========================================

/**
 * Storage operation types
 */
export type StorageOperation = 'get' | 'set' | 'remove' | 'clear' | 'validate';

/**
 * Storage error classification
 */
export interface StorageErrorInfo {
  operation: StorageOperation;
  key?: string;
  message: string;
  code?: StorageErrorCode; // Canonical error code
  isRecoverable: boolean; // Can we retry?
  isCritical: boolean; // Will cause data loss?
  originalError: Error;
}

/**
 * Result of graceful storage operation
 */
export interface StorageGracefulResult<T = any> {
  success: boolean;
  data?: T;
  error?: StorageErrorInfo;
  fallback?: T; // Fallback value if operation failed
}

/**
 * Storage operation options
 */
export interface StorageOperationOptions<T = any> {
  operation: StorageOperation;
  key?: string;
  fallbackValue?: T; // Return if storage fails
  onError?: (error: StorageErrorInfo) => void; // Called on error
  retry?: boolean; // Retry operation?
  timeout?: number; // Timeout in ms (default 5000)
}

// ==========================================
// Error Classification
// ==========================================

/**
 * Classify storage error
 */
export function classifyStorageError(error: unknown, operation: StorageOperation): StorageErrorInfo {
  const message = error instanceof Error ? error.message : String(error);

  // Check for specific error patterns
  const isQuotaExceeded =
    message.includes('QuotaExceeded') || 
    message.includes('quota') ||
    message.includes('storage full') ||
    message.includes('out of memory');

  const isCorruptedData =
    message.includes('Invalid JSON') ||
    message.includes('parse') ||
    message.includes('validation') ||
    message.includes('SyntaxError');

  const isEncryptionError =
    message.includes('encrypt') ||
    message.includes('decrypt') ||
    message.includes('cipher') ||
    message.includes('padding');

  const isNetworkError =
    message.includes('Network') ||
    message.includes('offline') ||
    message.includes('timeout');

  const isPermissionError =
    message.includes('Permission') ||
    message.includes('denied') ||
    message.includes('access');

  // Determine canonical error code
  let code: StorageErrorCode = ERROR_CODES.STORAGE.UNKNOWN;
  if (isQuotaExceeded) code = ERROR_CODES.STORAGE.QUOTA_EXCEEDED;
  else if (isCorruptedData) code = ERROR_CODES.STORAGE.PARSE_ERROR;
  else if (isEncryptionError && message.includes('encrypt')) code = ERROR_CODES.STORAGE.ENCRYPTION_FAILED;
  else if (isEncryptionError && message.includes('decrypt')) code = ERROR_CODES.STORAGE.DECRYPTION_FAILED;
  else if (isPermissionError) code = ERROR_CODES.STORAGE.PERMISSION_DENIED;
  else if (isNetworkError) code = ERROR_CODES.STORAGE.UNKNOWN; // Network errors aren't storage-specific

  // Determine recoverability
  const isRecoverable =
    !isQuotaExceeded && // Quota usually requires cleanup
    !isPermissionError && // Permissions rarely change
    (isNetworkError || isCorruptedData || isEncryptionError); // Most others can retry

  // Determine criticality (will cause data loss?)
  const isCritical =
    operation === 'set' && (isQuotaExceeded || isEncryptionError);

  return {
    operation,
    code,
    message,
    isRecoverable,
    isCritical,
    originalError: error instanceof Error ? error : new Error(message),
  };
}

/**
 * Check if error is a storage error (vs network, crypto, etc)
 */
export function isStorageError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('storage') ||
    msg.includes('persist') ||
    msg.includes('cache') ||
    msg.includes('quota') ||
    msg.includes('AsyncStorage') ||
    msg.includes('SecureStore')
  );
}

// ==========================================
// Error Handling
// ==========================================

/**
 * Log storage error with context
 */
export function logStorageError(errorInfo: StorageErrorInfo, context?: Record<string, any>): void {
  const level = errorInfo.isCritical ? 'error' : 'warn';
  
  /* eslint-disable-next-line security/detect-object-injection */
  logger[level](
    'storage',
    `${errorInfo.operation} failed for key: ${errorInfo.key || 'unknown'}`,
    {
      operation: errorInfo.operation,
      key: errorInfo.key,
      message: errorInfo.message,
      isRecoverable: errorInfo.isRecoverable,
      isCritical: errorInfo.isCritical,
      ...context,
    }
  );
}

/**
 * Decide whether to serve fallback data on storage error
 */
export function shouldServeFallbackOnStorageError(
  errorInfo: StorageErrorInfo,
  options?: { hasCache?: boolean; hasMemoryData?: boolean }
): boolean {
  // If operation is a read and we have fallback data, use it
  if (errorInfo.operation === 'get' && (options?.hasCache || options?.hasMemoryData)) {
    return true;
  }

  // If operation is set and it's not critical, we can continue without persisting
  if (errorInfo.operation === 'set' && !errorInfo.isCritical) {
    return true;
  }

  // If operation failed but is recoverable, try fallback
  if (errorInfo.isRecoverable) {
    return true;
  }

  return false;
}

/**
 * Handle storage error gracefully
 * 
 * Returns operation result with fallback and error info
 */
export async function handleStorageErrorGracefully<T = any>(
  error: unknown,
  options: StorageOperationOptions<T>
): Promise<StorageGracefulResult<T>> {
  const errorInfo = classifyStorageError(error, options.operation);
  
  logStorageError(errorInfo, { key: options.key });

  // Call error callback if provided
  if (options.onError) {
    options.onError(errorInfo);
  }

  // Decide if we should use fallback
  const useFallback = shouldServeFallbackOnStorageError(errorInfo);

  if (useFallback && options.fallbackValue !== undefined) {
    logger.category('storage').warn(
      `Serving fallback data for ${options.operation} on key: ${options.key}`,
      { hasRecovery: !!options.fallbackValue }
    );

    return {
      success: false,
      data: options.fallbackValue,
      error: errorInfo,
      fallback: options.fallbackValue,
    };
  }

  return {
    success: false,
    error: errorInfo,
  };
}

// ==========================================
// Safe Wrapper Functions
// ==========================================

/**
 * Safely get item from storage with graceful fallback
 */
export async function safeStorageGet<T = string>(
  key: string,
  storage: { getItem(key: string): Promise<T | null> },
  options?: { fallback?: T }
): Promise<StorageGracefulResult<T | null>> {
  try {
    const data = await storage.getItem(key);
    return {
      success: true,
      data,
    };
  } catch (error) {
    return handleStorageErrorGracefully(error, {
      operation: 'get',
      key,
      fallbackValue: options?.fallback ?? null,
    });
  }
}

/**
 * Safely set item to storage with graceful failure
 */
export async function safeStorageSet<T = any>(
  key: string,
  value: T,
  storage: { setItem(key: string, value: any): Promise<void> },
  options?: { fallback?: T }
): Promise<StorageGracefulResult<T>> {
  try {
    await storage.setItem(key, value);
    return {
      success: true,
      data: value,
    };
  } catch (error) {
    return handleStorageErrorGracefully(error, {
      operation: 'set',
      key,
      fallbackValue: options?.fallback ?? value,
    });
  }
}

/**
 * Safely remove item from storage
 */
export async function safeStorageRemove(
  key: string,
  storage: { removeItem(key: string): Promise<void> }
): Promise<StorageGracefulResult<void>> {
  try {
    await storage.removeItem(key);
    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    return handleStorageErrorGracefully(error, {
      operation: 'remove',
      key,
    });
  }
}

/**
 * Safely get JSON from storage
 */
export async function safeStorageGetJSON<T = any>(
  key: string,
  storage: { getItem(key: string): Promise<string | null> },
  options?: { fallback?: T }
): Promise<StorageGracefulResult<T | null>> {
  try {
    const raw = await storage.getItem(key);
    if (!raw) {
      return {
        success: true,
        data: null,
      };
    }

    try {
      const data = JSON.parse(raw) as T;
      return {
        success: true,
        data,
      };
    } catch (parseError) {
      // Data is corrupted - log and return fallback
      const errorInfo = classifyStorageError(parseError, 'validate');
      logStorageError(errorInfo, { key, reason: 'corrupt_data' });

      if (options?.fallback !== undefined) {
        return {
          success: false,
          data: options.fallback,
          error: errorInfo,
          fallback: options.fallback,
        };
      }

      return {
        success: false,
        error: errorInfo,
      };
    }
  } catch (error) {
    return handleStorageErrorGracefully(error, {
      operation: 'get',
      key,
      fallbackValue: options?.fallback ?? null,
    });
  }
}

/**
 * Safely set JSON to storage
 */
export async function safeStorageSetJSON<T = any>(
  key: string,
  value: T,
  storage: { setItem(key: string, value: any): Promise<void> },
  options?: { fallback?: T }
): Promise<StorageGracefulResult<T>> {
  try {
    const serialized = JSON.stringify(value);
    await storage.setItem(key, serialized);
    return {
      success: true,
      data: value,
    };
  } catch (error) {
    return handleStorageErrorGracefully(error, {
      operation: 'set',
      key,
      fallbackValue: options?.fallback ?? value,
    });
  }
}

// ==========================================
// Batch Operations
// ==========================================

/**
 * Result of batch storage operation
 */
export interface BatchStorageResult {
  successful: number;
  failed: number;
  errors: Map<string, StorageErrorInfo>;
}

/**
 * Safely perform batch storage operations
 */
export async function batchStorageOperation(
  operations: {
    type: 'get' | 'set' | 'remove';
    key: string;
    value?: any;
    storage: any;
  }[],
  options?: {
    continueOnError?: boolean;
  }
): Promise<BatchStorageResult> {
  const result: BatchStorageResult = {
    successful: 0,
    failed: 0,
    errors: new Map(),
  };

  for (const op of operations) {
    try {
      switch (op.type) {
        case 'get':
          await op.storage.getItem(op.key);
          result.successful++;
          break;

        case 'set':
          await op.storage.setItem(op.key, op.value);
          result.successful++;
          break;

        case 'remove':
          await op.storage.removeItem(op.key);
          result.successful++;
          break;
      }
    } catch (error) {
      result.failed++;
      const errorInfo = classifyStorageError(error, op.type);
      result.errors.set(op.key, errorInfo);

      logStorageError(errorInfo, { key: op.key, type: op.type });

      if (!options?.continueOnError) {
        break;
      }
    }
  }

  return result;
}

// ==========================================
// Storage Health Check
// ==========================================

/**
 * Check storage health and available quota
 */
export async function checkStorageHealth(
  storage: any
): Promise<{
  isHealthy: boolean;
  available: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Test basic operations
  const testKey = 'dnd:health:check';
  const testValue = { timestamp: Date.now() };

  try {
    // Test write
    await storage.setItem(testKey, JSON.stringify(testValue));

    // Test read
    const stored = await storage.getItem(testKey);
    if (!stored) {
      errors.push('Write failed: Data not readable after storage');
    }

    // Test delete
    await storage.removeItem(testKey);

    return {
      isHealthy: errors.length === 0,
      available: true,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      isHealthy: false,
      available: false,
      errors,
    };
  }
}

export default {
  classifyStorageError,
  isStorageError,
  logStorageError,
  shouldServeFallbackOnStorageError,
  handleStorageErrorGracefully,
  safeStorageGet,
  safeStorageSet,
  safeStorageRemove,
  safeStorageGetJSON,
  safeStorageSetJSON,
  batchStorageOperation,
  checkStorageHealth,
};
