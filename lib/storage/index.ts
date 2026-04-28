/**
 * Storage Module
 *
 * Centralized storage access for all app data.
 *
 * Primary API: StorageManager — the orchestration hub for all storage operations.
 * Lib modules should use StorageManager instead of importing system/Storage directly.
 *
 * Usage:
 * ```ts
 * import { StorageManager } from '@/lib/storage';
 * import { STORAGE_KEYS } from '@/maps/storage-keys';
 *
 * // Store data (backend routing is automatic via privacy middleware)
 * const setResult = await StorageManager.set(STORAGE_KEYS.USER_DATA, userData);
 * if (!setResult.success) { console.error('Write failed'); }
 *
 * // Retrieve data (returns T | null, not a result wrapper)
 * const data = await StorageManager.get(STORAGE_KEYS.USER_DATA);
 * if (data) { console.log('Got data:', data); }
 *
 * // With cache invalidation on write
 * await StorageManager.set(STORAGE_KEYS.CONNECTED_WORLDS, worlds, {
 *   invalidateTags: ['worlds'],
 * });
 *
 * // Subscribe to changes
 * const unsub = StorageManager.onKeyChange(STORAGE_KEYS.USER_DATA, (key, value) => {
 *   console.log('Storage changed:', key, value);
 * });
 * ```
 *
 * Architecture:
 *   lib modules → StorageManager (validate, metadata, cache invalidation, subscribers)
 *     → middleware/storage/storage-service (privacy routing, versioning, health, errors)
 *       → system/Storage (SecureStorage, FastCache)
 */

// ─── Manager (primary API for lib modules) ──────────────────────────
export { StorageManager } from './storage-manager';

// Types only kept here for light re-export (no runtime cost)
export type {
    CacheSchema, StorageGracefulResult,
    StorageHealthReport, StorageManagerReadOptions, StorageManagerWriteOptions
} from './storage-manager';

