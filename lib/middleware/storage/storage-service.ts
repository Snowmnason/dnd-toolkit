/**
 * Storage Service — Middleware for all storage operations
 *
 * This middleware sits BETWEEN the storage-manager and system/Storage.
 * It handles infrastructure concerns:
 * - Privacy routing (SecureStorage vs FastCache decision)
 * - Storage health validation (is storage working?)
 * - Error classification & graceful fallbacks
 * - Query cache coordination (SWR, tag invalidation)
 *
 * Delegates to system/Storage for:
 * - Versioning & validation (SecureStorage.getValidatedJSON, setVersionedJSON)
 * - Raw I/O (getItem, setItem, getJSON, setJSON)
 * - Platform abstraction (web vs mobile)
 *
 * Does NOT:
 * - Know about domain data (worlds, sessions, users) — that's the manager
 * - Know about subscriber notifications — that's the manager
 * - Duplicate validation/migration logic — system/Storage owns that
 *
 * Architecture:
 *   storage-manager (validate, hooks, metadata)
 *     → storage-service (privacy route, health check, error handling)
 *       → system/Storage (SecureStorage, FastCache, versioning)
 */

import { logger } from '@/lib/utils/logger';
import {
    type CacheSchema,
} from '@/system/Storage/versioning/cache-versioning';
import {
    classifyKey,
    getPrivacyStorageBackend,
    shouldUseSecureStorage,
    type PrivacyStorageBackend,
} from './helpers/privacy';
import {
    handleStorageErrorGracefully,
    type StorageErrorInfo,
    type StorageGracefulResult,
} from './helpers/storage-error-handling';

// Re-export types for manager convenience
export type { CacheSchema, StorageErrorInfo, StorageGracefulResult };

// ─── Types ─────────────────────────────────────────────────────────

export type StorageBackendType = 'secure' | 'fast' | 'auto';

export interface StorageWriteOptions {
  /** Override backend selection (default: 'auto' uses privacy routing) */
  backend?: StorageBackendType;
  /** Schema for versioned writes (wraps data with version metadata) */
  schema?: CacheSchema;
  /** Fallback value to return if write fails */
  fallback?: any;
}

export interface StorageReadOptions {
  /** Override backend selection (default: 'auto' uses privacy routing) */
  backend?: StorageBackendType;
  /** Schema for versioned reads (validates + migrates) */
  schema?: CacheSchema;
  /** Fallback value if read fails or data is invalid */
  fallback?: any;
}

export interface StorageRemoveOptions {
  /** Override backend selection (default: 'auto' uses privacy routing) */
  backend?: StorageBackendType;
}

export interface StorageHealthReport {
  secureStorageHealthy: boolean;
  fastCacheHealthy: boolean;
  errors: string[];
}

// ─── Lazy Backend Access ───────────────────────────────────────────

let _secureStorage: any = null;
let _fastCache: PrivacyStorageBackend | null = null;

function getSecureStorage() {
  if (!_secureStorage) {
    _secureStorage = require('@/system/Storage').SecureStorage;
  }
  return _secureStorage;
}

function getFastCache(): PrivacyStorageBackend {
  if (!_fastCache) {
    _fastCache = require('@/system/Storage').FastCache as PrivacyStorageBackend;
  }
  return _fastCache;
}

// ─── Backend Resolution ────────────────────────────────────────────

/**
 * Resolve the storage backend for a given key and options.
 * Priority: explicit backend override > privacy-based routing
 */
function resolveBackend(key: string, backendOverride?: StorageBackendType): PrivacyStorageBackend {
  if (backendOverride === 'secure') return getSecureStorage();
  if (backendOverride === 'fast') return getFastCache();

  // 'auto' or undefined → use privacy routing
  return getPrivacyStorageBackend(key);
}

/**
 * Get a human-readable label for the resolved backend (for logging).
 */
function getBackendLabel(key: string, backendOverride?: StorageBackendType): string {
  if (backendOverride === 'secure') return 'SecureStorage';
  if (backendOverride === 'fast') return 'FastCache';
  return shouldUseSecureStorage(key) ? 'SecureStorage (auto)' : 'FastCache (auto)';
}

// ─── Core Operations ───────────────────────────────────────────────

/**
 * Persist a value to storage through privacy routing and error handling.
 *
 * If a schema is provided, delegates to SecureStorage.setVersionedJSON(),
 * which wraps the value with version metadata for validation on future reads.
 * For non-versioned writes, uses raw setJSON().
 */
export async function persistValue<T = any>(
  key: string,
  value: T,
  options: StorageWriteOptions = {},
): Promise<StorageGracefulResult<T>> {
  const backendLabel = getBackendLabel(key, options.backend);

  try {
    const backend = resolveBackend(key, options.backend);

    // If schema provided AND using SecureStorage, delegate to setVersionedJSON
    if (options.schema && shouldUseSecureStorage(key)) {
      const secureStorage = getSecureStorage();
      // SecureStorage has setVersionedJSON method that handles versioning
      await (secureStorage as any).setVersionedJSON(key, value, options.schema.version);
      logger.category('storage').debug(
        `Storage write (versioned): ${key} → ${backendLabel}`,
      );
    } else {
      // Raw write (no versioning)
      if (typeof value === 'string') {
        await backend.setItem(key, value);
      } else {
        await backend.setJSON(key, value);
      }
      logger.category('storage').debug(
        `Storage write: ${key} → ${backendLabel}`,
      );
    }

    return { success: true, data: value };
  } catch (error) {
    logger.category('storage').warn(
      `Storage write failed: ${key} → ${backendLabel}`,
      { error: String(error) },
    );

    return handleStorageErrorGracefully<T>(error, {
      operation: 'set',
      key,
      fallbackValue: options.fallback,
    });
  }
}

/**
 * Retrieve a value from storage through privacy routing and error handling.
 *
 * If a schema is provided, delegates to SecureStorage.getValidatedJSON(),
 * which handles validation, migration, and automatic schema updates.
 * For non-versioned reads, uses raw getJSON().
 */
export async function retrieveValue<T = any>(
  key: string,
  options: StorageReadOptions = {},
): Promise<StorageGracefulResult<T | null>> {
  const backendLabel = getBackendLabel(key, options.backend);

  try {
    // If schema provided AND using SecureStorage, delegate to getValidatedJSON
    if (options.schema && shouldUseSecureStorage(key)) {
      const secureStorage = getSecureStorage();
      // SecureStorage.getValidatedJSON handles validation, migration, and storage updates
      const data = await secureStorage.getValidatedJSON(key, options.schema) as T | null;
      
      if (data === null) {
        logger.category('storage').debug(
          `Storage read (versioned, not found): ${key} ← ${backendLabel}`,
        );
        return { success: true, data: options.fallback ?? null };
      }

      logger.category('storage').debug(
        `Storage read (versioned): ${key} ← ${backendLabel}`,
      );
      return { success: true, data };
    }

    // Raw read (no versioning)
    const backend = resolveBackend(key, options.backend);
    const raw = await backend.getJSON<T>(key);

    if (raw === null || raw === undefined) {
      return { success: true, data: null };
    }

    logger.category('storage').debug(
      `Storage read: ${key} ← ${backendLabel}`,
    );
    return { success: true, data: raw };
  } catch (error) {
    logger.category('storage').warn(
      `Storage read failed: ${key} ← ${backendLabel}`,
      { error: String(error) },
    );

    return handleStorageErrorGracefully<T | null>(error, {
      operation: 'get',
      key,
      fallbackValue: options.fallback ?? null,
    });
  }
}

/**
 * Retrieve a raw string value (no JSON parsing, no versioning).
 */
export async function retrieveRawValue(
  key: string,
  options: StorageReadOptions = {},
): Promise<StorageGracefulResult<string | null>> {
  const backendLabel = getBackendLabel(key, options.backend);

  try {
    const backend = resolveBackend(key, options.backend);
    const value = await backend.getItem(key);

    logger.category('storage').debug(
      `Storage read (raw): ${key} ← ${backendLabel}`,
    );
    return { success: true, data: value };
  } catch (error) {
    logger.category('storage').warn(
      `Storage read (raw) failed: ${key} ← ${backendLabel}`,
      { error: String(error) },
    );

    return handleStorageErrorGracefully<string | null>(error, {
      operation: 'get',
      key,
      fallbackValue: options.fallback ?? null,
    });
  }
}

/**
 * Persist a raw string value (no JSON serialization, no versioning).
 */
export async function persistRawValue(
  key: string,
  value: string,
  options: StorageWriteOptions = {},
): Promise<StorageGracefulResult<string>> {
  const backendLabel = getBackendLabel(key, options.backend);

  try {
    const backend = resolveBackend(key, options.backend);
    await backend.setItem(key, value);

    logger.category('storage').debug(
      `Storage write (raw): ${key} → ${backendLabel}`,
    );
    return { success: true, data: value };
  } catch (error) {
    logger.category('storage').warn(
      `Storage write (raw) failed: ${key} → ${backendLabel}`,
      { error: String(error) },
    );

    return handleStorageErrorGracefully<string>(error, {
      operation: 'set',
      key,
      fallbackValue: options.fallback,
    });
  }
}

/**
 * Remove a value from storage.
 */
export async function removeValue(
  key: string,
  options: StorageRemoveOptions = {},
): Promise<StorageGracefulResult<void>> {
  const backendLabel = getBackendLabel(key, options.backend);

  try {
    const backend = resolveBackend(key, options.backend);
    await backend.removeItem(key);

    logger.category('storage').debug(
      `Storage remove: ${key} ← ${backendLabel}`,
    );
    return { success: true, data: undefined };
  } catch (error) {
    logger.category('storage').warn(
      `Storage remove failed: ${key} ← ${backendLabel}`,
      { error: String(error) },
    );

    return handleStorageErrorGracefully<void>(error, {
      operation: 'remove',
      key,
    });
  }
}

// ─── Health Check ──────────────────────────────────────────────────

/**
 * Run a health check against both storage backends.
 * Tests basic write/read/delete cycle on each.
 */
export async function checkStorageServiceHealth(): Promise<StorageHealthReport> {
  const errors: string[] = [];
  const testKey = '__storage_service_health__';
  const testValue = `health_${Date.now()}`;

  // Check SecureStorage
  let secureHealthy = false;
  try {
    const secure = getSecureStorage();
    await secure.setItem(testKey, testValue);
    const read = await secure.getItem(testKey);
    await secure.removeItem(testKey);
    secureHealthy = read === testValue;
    if (!secureHealthy) {
      errors.push('SecureStorage: write/read mismatch');
    }
  } catch (e) {
    errors.push(`SecureStorage: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Check FastCache
  let fastHealthy = false;
  try {
    const fast = getFastCache();
    await fast.setItem(testKey, testValue);
    const read = await fast.getItem(testKey);
    await fast.removeItem(testKey);
    fastHealthy = read === testValue;
    if (!fastHealthy) {
      errors.push('FastCache: write/read mismatch');
    }
  } catch (e) {
    errors.push(`FastCache: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (errors.length > 0) {
    logger.category('storage').warn('Storage health check found issues', { errors });
  }

  return {
    secureStorageHealthy: secureHealthy,
    fastCacheHealthy: fastHealthy,
    errors,
  };
}

// ─── Utility ───────────────────────────────────────────────────────

/**
 * Get the classification info for a storage key (for debugging/logging).
 */
export function getKeyInfo(key: string) {
  return {
    key,
    classification: classifyKey(key),
    usesSecureStorage: shouldUseSecureStorage(key),
    backend: shouldUseSecureStorage(key) ? 'SecureStorage' : 'FastCache',
  };
}
