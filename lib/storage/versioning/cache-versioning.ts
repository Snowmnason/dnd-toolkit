import { logger } from '@/lib/utils';

/**
 * Cache Versioning System
 * 
 * Handles schema validation and migration for stored data on app startup.
 * Prevents app breakage after deployments by gracefully handling cache mismatches.
 * 
 * Usage:
 * 1. Define a schema and version for each data type
 * 2. Call validateCacheEntry() on stored data during bootstrap
 * 3. Migrate or reset data based on validation result
 */

// Increment this when you make breaking changes to stored data structures
export const CURRENT_CACHE_VERSION = 1;

/**
 * Represents a cacheable data entry with versioning metadata
 */
export interface VersionedCacheEntry<T = any> {
  version: number;
  data: T;
  timestamp?: number;
}

/**
 * Validation result from cache check
 */
export interface CacheValidationResult {
  valid: boolean;
  reason?: 'version_mismatch' | 'parse_error' | 'schema_invalid' | 'missing_fields';
  oldVersion?: number;
  currentVersion?: number;
  shouldReset?: boolean; // If true, caller should clear this cache entry
  shouldMigrate?: boolean; // If true, caller should attempt migration
}

/**
 * Validation schema for a cache entry
 */
export interface CacheSchema<T = any> {
  version: number;
  validate: (data: any) => boolean;
  migrate?: (oldData: any, oldVersion: number) => T | null; // null = reset
}

/**
 * Validate a cache entry against current version and schema
 */
export function validateCacheEntry<T = any>(
  entry: unknown,
  schema: CacheSchema<T>
): CacheValidationResult {
  // Check if entry is a versioned object
  if (!entry || typeof entry !== 'object') {
    return {
      valid: false,
      reason: 'parse_error',
      currentVersion: schema.version,
      shouldMigrate: !!schema.migrate, // Try migration if available
      shouldReset: !schema.migrate,    // Reset only if no migration path
    };
  }

  const versionedEntry = entry as Partial<VersionedCacheEntry>;

  // Missing version field
  if (versionedEntry.version === undefined) {
    return {
      valid: false,
      reason: 'missing_fields',
      currentVersion: schema.version,
      shouldMigrate: !!schema.migrate, // Try migration if available
      shouldReset: !schema.migrate, // Reset if no migration path
    };
  }

  // Version mismatch
  if (versionedEntry.version !== schema.version) {
    return {
      valid: false,
      reason: 'version_mismatch',
      oldVersion: versionedEntry.version,
      currentVersion: schema.version,
      shouldMigrate: !!schema.migrate,
      shouldReset: !schema.migrate,
    };
  }

  // Validate schema
  if (!schema.validate(versionedEntry.data)) {
    return {
      valid: false,
      reason: 'schema_invalid',
      currentVersion: schema.version,
      shouldMigrate: !!schema.migrate,
      shouldReset: !schema.migrate,
    };
  }

  return { valid: true };
}

/**
 * Handle migration based on validation result
 * Returns migrated data or null if should reset
 */
export async function handleCacheMigration<T = any>(
  oldEntry: any,
  result: CacheValidationResult,
  schema: CacheSchema<T>
): Promise<T | null> {
  // Validation passed, no migration needed
  if (result.valid) {
    // Handle both versioned and unversioned entries
    return (oldEntry as VersionedCacheEntry<T>).data || (oldEntry as T);
  }

  // No migration path available
  if (!result.shouldMigrate || !schema.migrate) {
    logger.category('storage').warn('Cache reset required', {
      reason: result.reason,
      oldVersion: result.oldVersion,
      currentVersion: result.currentVersion,
    });
    return null;
  }

  try {
    logger.category('storage').info('Attempting cache migration', {
      from: result.oldVersion,
      to: result.currentVersion,
      reason: result.reason,
    });

    // For versioned entries, pass oldEntry.data; for unversioned/legacy, pass oldEntry directly
    const dataToMigrate = (oldEntry as VersionedCacheEntry).version !== undefined 
      ? (oldEntry as VersionedCacheEntry).data 
      : oldEntry;

    const migratedData = schema.migrate(dataToMigrate, result.oldVersion || 0);

    if (migratedData === null) {
      logger.category('storage').warn('Cache migration returned null, resetting');
      return null;
    }

    logger.category('storage').info('Cache migration successful', {
      from: result.oldVersion,
      to: result.currentVersion,
    });
    return migratedData;
  } catch (error) {
    logger.category('storage').error('Cache migration failed, resetting', { 
      error: String(error),
      from: result.oldVersion,
      to: result.currentVersion,
    });
    return null;
  }
}

/**
 * Batch validation result for multiple cache entries
 */
export interface BatchValidationResult {
  passed: string[]; // Keys that passed validation
  failed: {
    key: string;
    reason: string;
    shouldReset: boolean;
  }[];
}

/**
 * Validate multiple cache entries
 */
export function validateCacheEntries(
  entries: Record<string, unknown>,
  schemas: Record<string, CacheSchema>
): BatchValidationResult {
  const result: BatchValidationResult = {
    passed: [],
    failed: [],
  };

  for (const [key, entry] of Object.entries(entries)) {
    // eslint-disable-next-line security/detect-object-injection
    const schema = schemas[key];
    if (!schema) continue;

    const validation = validateCacheEntry(entry, schema);
    if (validation.valid) {
      result.passed.push(key);
    } else {
      result.failed.push({
        key,
        reason: validation.reason || 'unknown',
        shouldReset: validation.shouldReset ?? true,
      });
    }
  }

  return result;
}

/**
 * Create a versioned cache entry wrapper
 */
export function createVersionedEntry<T>(
  data: T,
  version: number = CURRENT_CACHE_VERSION
): VersionedCacheEntry<T> {
  return {
    version,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Extract data from a versioned entry (for backwards compat)
 */
export function extractCacheData<T>(entry: VersionedCacheEntry<T>): T {
  return entry.data;
}
