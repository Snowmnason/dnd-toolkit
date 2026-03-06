/**
 * Storage Manager — Orchestration Hub for all storage operations
 *
 * This is the ONLY entry point for lib modules to read/write storage.
 * No lib module should import from system/Storage or middleware/storage directly.
 *
 * Manager Responsibilities:
 * 1. Validate data (type checks, size limits, key format)
 * 2. Inject metadata (timestamps, version tags)
 * 3. Call middleware (storage-service for routing, health, versioning)
 * 4. Coordinate cache invalidation (QueryCache tag/pattern invalidation)
 * 5. Notify subscribers (storage change events)
 * 6. Provide semantic operations (saveSession, cacheQueryResult, etc.)
 *
 * Architecture:
 *   lib modules (auth, database, analytics, etc.)
 *     → storage-manager (validate, metadata, invalidate, notify)
 *       → middleware/storage/storage-service (privacy route, health, versioning, errors)
 *         → system/Storage (SecureStorage, FastCache)
 *
 * Does NOT:
 * - Decide which backend to use (middleware handles privacy routing)
 * - Handle storage I/O (system handles it)
 * - Classify errors (middleware handles it)
 */

import {
    checkStorageServiceHealth,
    persistRawValue,
    persistValue,
    removeValue,
    retrieveRawValue,
    retrieveValue,
    type StorageGracefulResult,
    type StorageHealthReport,
    type StorageReadOptions,
    type StorageWriteOptions
} from '@/lib/middleware/storage/storage-service';
import { logger } from '@/lib/utils/logger';
import type { CacheSchema } from '@/system/Storage/versioning/cache-versioning';

// Lazy-load QueryCache to break circular dependency
let _queryCache: any = null;
function getQueryCache() {
  if (!_queryCache) {
    _queryCache = require('@/lib/middleware/storage/helpers/query-cache').QueryCache;
  }
  return _queryCache;
}

// Re-export types for consumers
export type { CacheSchema, StorageGracefulResult, StorageHealthReport };

// ─── Types ─────────────────────────────────────────────────────────

type StorageSubscriber = (key: string, value: any) => void;

export interface StorageManagerWriteOptions extends StorageWriteOptions {
  /** Tags for QueryCache invalidation when this key changes */
  invalidateTags?: string[];
  /** Pattern for QueryCache invalidation when this key changes */
  invalidatePattern?: string | RegExp;
  /** Notify subscribers about this change (default: true) */
  notify?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StorageManagerReadOptions extends StorageReadOptions {
  // Extensible for future manager-level read options
}

// ─── Validation ────────────────────────────────────────────────────

/** Maximum key length to prevent abuse */
const MAX_KEY_LENGTH = 512;

/** Maximum value size (5MB) to prevent quota issues */
const MAX_VALUE_SIZE = 5 * 1024 * 1024;

/**
 * Validate a storage key before operations.
 */
function validateKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('[storage-manager] Key must be a non-empty string');
  }

  if (key.length > MAX_KEY_LENGTH) {
    throw new Error(`[storage-manager] Key too long (${key.length} chars, max ${MAX_KEY_LENGTH})`);
  }

  // Check for control characters (potential injection)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(key)) {
    throw new Error('[storage-manager] Key contains invalid control characters');
  }
}

/**
 * Validate a value before writing.
 * Checks serialized size to prevent quota issues.
 */
function validateValue(value: any, key: string): void {
  if (value === undefined) {
    throw new Error(`[storage-manager] Cannot store undefined for key: ${key}`);
  }

  // Check serialized size
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (serialized.length > MAX_VALUE_SIZE) {
      throw new Error(
        `[storage-manager] Value too large for key "${key}" (${serialized.length} bytes, max ${MAX_VALUE_SIZE})`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('[storage-manager]')) {
      throw error; // Re-throw our own errors
    }
    throw new Error(`[storage-manager] Value is not serializable for key "${key}": ${error}`);
  }
}

// ─── Subscriber System ─────────────────────────────────────────────

const subscribers: Map<string, Set<StorageSubscriber>> = new Map();
const globalSubscribers: Set<StorageSubscriber> = new Set();

/**
 * Subscribe to changes on a specific storage key.
 * Returns an unsubscribe function.
 */
export function onKeyChange(key: string, callback: StorageSubscriber): () => void {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key)!.add(callback);

  return () => {
    const subs = subscribers.get(key);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) subscribers.delete(key);
    }
  };
}

/**
 * Subscribe to ALL storage changes (for debugging or cross-cutting concerns).
 * Returns an unsubscribe function.
 */
export function onAnyChange(callback: StorageSubscriber): () => void {
  globalSubscribers.add(callback);
  return () => { globalSubscribers.delete(callback); };
}

/**
 * Notify subscribers about a storage change.
 */
function notifyChange(key: string, value: any): void {
  // Key-specific subscribers
  const subs = subscribers.get(key);
  if (subs) {
    subs.forEach(cb => {
      try { cb(key, value); } catch (e) {
        logger.category('storage').warn('Subscriber error', { key, error: String(e) });
      }
    });
  }

  // Global subscribers
  globalSubscribers.forEach(cb => {
    try { cb(key, value); } catch (e) {
      logger.category('storage').warn('Global subscriber error', { key, error: String(e) });
    }
  });
}

// ─── Core Operations ───────────────────────────────────────────────

/**
 * Store a JSON-serializable value.
 *
 * 1. Validates key and value
 * 2. Persists through middleware (privacy routing, versioning, error handling)
 * 3. Invalidates related cache tags if specified
 * 4. Notifies subscribers
 */
export async function set<T = any>(
  key: string,
  value: T,
  options: StorageManagerWriteOptions = {},
): Promise<StorageGracefulResult<T>> {
  // 1. Validate
  validateKey(key);
  validateValue(value, key);

  // 2. Persist through middleware
  const result = await persistValue<T>(key, value, {
    backend: options.backend,
    schema: options.schema,
    fallback: options.fallback,
  });

  // 3. Post-write: invalidate related cache
  if (result.success) {
    await invalidateRelated(options);
  }

  // 4. Notify subscribers
  if (result.success && options.notify !== false) {
    notifyChange(key, value);
  }

  return result;
}

/**
 * Store a raw string value (no JSON serialization).
 */
export async function setRaw(
  key: string,
  value: string,
  options: StorageManagerWriteOptions = {},
): Promise<StorageGracefulResult<string>> {
  validateKey(key);
  validateValue(value, key);

  const result = await persistRawValue(key, value, {
    backend: options.backend,
    fallback: options.fallback,
  });

  if (result.success) {
    await invalidateRelated(options);
  }

  if (result.success && options.notify !== false) {
    notifyChange(key, value);
  }

  return result;
}

/**
 * Retrieve a JSON value from storage.
 *
 * 1. Validates key
 * 2. Reads through middleware (privacy routing, versioning, migration)
 * 3. Returns data or fallback
 *
 * Returns the data directly (not wrapped in StorageGracefulResult) for simple API.
 * Errors are handled gracefully with fallback values.
 */
export async function get<T = any>(
  key: string,
  options: StorageManagerReadOptions = {},
): Promise<T | null> {
  validateKey(key);

  const result = await retrieveValue<T>(key, {
    backend: options.backend,
    schema: options.schema,
    fallback: options.fallback,
  });

  // Return data directly, using fallback if operation failed and fallback provided
  return result.success ? (result.data ?? null) : (result.fallback ?? null);
}

/**
 * Retrieve a raw string value from storage.
 *
 * Returns the data directly (not wrapped in StorageGracefulResult) for simple API.
 * Errors are handled gracefully with fallback values.
 */
export async function getRaw(
  key: string,
  options: StorageManagerReadOptions = {},
): Promise<string | null> {
  validateKey(key);

  const result = await retrieveRawValue(key, {
    backend: options.backend,
    fallback: options.fallback,
  });

  return result.success ? (result.data ?? null) : (result.fallback ?? null);
}

/**
 * Remove a value from storage.
 *
 * 1. Validates key
 * 2. Removes through middleware
 * 3. Invalidates related cache
 * 4. Notifies subscribers (value = null)
 */
export async function remove(
  key: string,
  options: StorageManagerWriteOptions = {},
): Promise<StorageGracefulResult<void>> {
  validateKey(key);

  const result = await removeValue(key, {
    backend: options.backend,
  });

  if (result.success) {
    await invalidateRelated(options);
  }

  if (result.success && options.notify !== false) {
    notifyChange(key, null);
  }

  return result;
}

// ─── Cache Coordination ────────────────────────────────────────────

/**
 * Invalidate QueryCache entries related to a storage change.
 * Called automatically after successful writes/removes.
 */
async function invalidateRelated(options: StorageManagerWriteOptions): Promise<void> {
  try {
    const cache = getQueryCache();

    if (options.invalidateTags?.length) {
      await cache.invalidateByTags(options.invalidateTags);
    }

    if (options.invalidatePattern) {
      await cache.invalidate(options.invalidatePattern);
    }
  } catch (error) {
    // Non-critical: log but don't fail the storage operation
    logger.category('storage').warn('Cache invalidation failed (non-critical)', {
      error: String(error),
    });
  }
}

// ─── Health ────────────────────────────────────────────────────────

/**
 * Run a full storage health check.
 * Delegates to middleware health check which tests both backends.
 */
export async function checkHealth(): Promise<StorageHealthReport> {
  return checkStorageServiceHealth();
}

// ─── Convenience Namespace ─────────────────────────────────────────

/**
 * StorageManager namespace — provides a clean import pattern for lib modules.
 *
 * Usage:
 * ```ts
 * import { StorageManager } from '@/lib/storage';
 *
 * await StorageManager.set(STORAGE_KEYS.USER_DATA, userData);
 * const result = await StorageManager.get(STORAGE_KEYS.USER_DATA);
 * ```
 */
export const StorageManager = {
  set,
  setRaw,
  get,
  getRaw,
  remove,
  checkHealth,
  onKeyChange,
  onAnyChange,
} as const;

export default StorageManager;
