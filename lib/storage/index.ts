/**
 * Storage Module
 *
 * Centralized storage access for all app data.
 *
 * All storage goes through SecureStorage which respects STORAGE_BACKEND_CONFIG:
 * - localStorage: Persistent auth/user data (sensitive, encrypted via EncryptedStorage)
 * - sessionStorage: Ephemeral query cache and metadata (faster, unencrypted)
 * - secure: Encrypted backend (default for sensitive data)
 *
 * Usage:
 * ```ts
 * import { SecureStorage, STORAGE_KEYS, getPrivacyStorageBackend } from '@/lib/storage';
 *
 * // Store data (backend routing is automatic)
 * await SecureStorage.setItem(STORAGE_KEYS.CONNECTED_WORLDS, worldIds);
 *
 * // Or route backend manually based on privacy classification
 * const backend = getPrivacyStorageBackend(STORAGE_KEYS.THEME_PREFERENCE);
 * await backend.setItem(STORAGE_KEYS.THEME_PREFERENCE, 'classic');
 *
 * // Store JSON
 * await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, { theme: 'dark' });
 *
 * // Retrieve data
 * const worldIds = await SecureStorage.getItem(STORAGE_KEYS.CONNECTED_WORLDS);
 * const prefs = await SecureStorage.getJSON(STORAGE_KEYS.USER_PREFERENCES);
 * ```
 *
 * Storage routing is defined in:
 * - STORAGE_BACKEND_CONFIG (storage-config.ts) - low-level backend routing
 * - DATA_CLASSIFICATIONS (data-classification.ts) - privacy-based routing (use this for app code)
 *
 * Add new keys to DATA_CLASSIFICATIONS when extending storage.
 */


export { FastCache } from "./cache/FastCache";
export {
  classifyKey,
  clearAllUserData,
  getKeysBySensitivity,
  getStorageBackend as getPrivacyStorageBackend,
  getRetentionInfo,
  getSensitiveKeys,
  isSensitiveData,
  shouldUseSecureStorage
} from "./privacy";
export { SecureStorage } from "./SecureStorage";
export {
  batchStorageOperation,
  checkStorageHealth,
  classifyStorageError,
  handleStorageErrorGracefully,
  isStorageError,
  logStorageError,
  safeStorageGet,
  safeStorageGetJSON,
  safeStorageRemove,
  safeStorageSet,
  safeStorageSetJSON,
  shouldServeFallbackOnStorageError,
  type BatchStorageResult,
  type StorageErrorInfo,
  type StorageGracefulResult,
  type StorageOperation,
  type StorageOperationOptions
} from "./utilites/storage-error-handling";

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

// Registry API
export {
  BUCKET_OPS,
  clearBucketOperationRegistry,
  executeBucketOperation,
  getBucketOperation,
  getRegisteredBucketOperations,
  isBucketOperationRegistered,
  registerBucketOperation, type BucketOperation, type BucketOpName, type DeleteFileInput,
  type DeleteFileOutput,
  type DownloadFileInput,
  type DownloadFileOutput,
  type GetPublicUrlInput,
  type GetPublicUrlOutput,
  type ListFilesInput,
  type ListFilesOutput,
  type UploadImageInput,
  type UploadImageOutput
} from './buckets/registry';

// Operations
export {
  deleteImage,
  getImageUrl,
  listFiles,
  uploadProfileImage
} from './buckets/operations';

export { QueryCache } from './cache/query-cache';
export type { CacheEntry, CacheOptions, QueryCacheConfig } from './cache/query-cache';

