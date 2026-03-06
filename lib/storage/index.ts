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
 * await StorageManager.set(STORAGE_KEYS.USER_DATA, userData);
 *
 * // Retrieve data
 * const result = await StorageManager.get(STORAGE_KEYS.USER_DATA);
 * if (result.success) { ... }
 *
 * // With cache invalidation on write
 * await StorageManager.set(STORAGE_KEYS.CONNECTED_WORLDS, worlds, {
 *   invalidateTags: ['worlds'],
 * });
 *
 * // Subscribe to changes
 * const unsub = StorageManager.onKeyChange(STORAGE_KEYS.USER_DATA, (key, value) => { ... });
 * ```
 *
 * Architecture:
 *   lib modules → StorageManager (validate, metadata, cache invalidation, subscribers)
 *     → middleware/storage/storage-service (privacy routing, versioning, health, errors)
 *       → system/Storage (SecureStorage, FastCache)
 */

// ─── Manager (primary API for lib modules) ──────────────────────────
export { StorageManager } from './storage-manager';
export type {
  CacheSchema, StorageGracefulResult,
  StorageHealthReport, StorageManagerReadOptions, StorageManagerWriteOptions
} from './storage-manager';

// ─── Domain-specific storage (app data structures) ──────────────────
export { updateStorageCache } from "./sync/update-storage-cache";
export { worldAccessCache } from "./sync/world-access-cache";

/**
 * Bucket Storage Module - Barrel Export
 *
 * Central location for bucket (file storage) abstractions.
 * Supports multiple backend implementations: Supabase, Firebase Cloud Storage, S3, Cloudinary, etc.
 *
 * Architecture:
 * - registry.ts — registry pattern for mapping semantic operation names to backend implementations
 * - helpers.ts — utility functions (naming, validation, URL normalization)
 * - operations.ts — high-level wrappers combining registry + helpers
 */

// Operations
export {
  deleteImage,
  getImageUrl,
  listFiles,
  uploadProfileImage
} from './buckets/operations';

