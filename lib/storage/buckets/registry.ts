/**
 * Bucket Operation Registry
 *
 * Manages semantic bucket operations (uploadImage, downloadFile, deleteFile)
 * and routes them to registered backend implementations (Supabase, Firebase, S3, Cloudinary, etc).
 *
 * Architecture mirrors lib/database/edge/registry.ts:
 * - Registry maps operation names to implementations
 * - Operations are backend-agnostic (semantic names: uploadImage, not supabaseUpload)
 * - Implementations registered at app bootstrap
 * - Tests can register mock implementations without touching production code
 */

import { logger } from '@/lib/utils/logger';

// ── Operation name constants ──────────────────────────────────────────────────

/**
 * Canonical bucket operation names.
 * Use these constants at all call sites instead of raw strings to prevent typos.
 *
 * @example
 * executeBucketOperation(BUCKET_OPS.UPLOAD_IMAGE, { bucket: 'avatars', file, name });
 */
export const BUCKET_OPS = {
  UPLOAD_IMAGE: 'uploadImage',
  DOWNLOAD_FILE: 'downloadFile',
  DELETE_FILE: 'deleteFile',
  GET_PUBLIC_URL: 'getPublicUrl',
  LIST_FILES: 'listFiles',
} as const;

export type BucketOpName = (typeof BUCKET_OPS)[keyof typeof BUCKET_OPS];

// ── Typed input/output shapes ─────────────────────────────────────────────────
// Intentionally sparse placeholders — fill in fields as the Supabase Storage
// API is researched (sizes, content types, metadata, transforms, etc.).

export interface UploadImageInput {
  bucket: string;
  file: File;
  name: string;
  upsert?: boolean;
  // TODO: contentType, cacheControl, metadata
}

export interface UploadImageOutput {
  url: string;
  path: string;
  publicUrl?: string;
  // TODO: size, contentType, id
}

export interface DownloadFileInput {
  bucket: string;
  path: string;
}

export interface DownloadFileOutput {
  blob: Blob;
  // TODO: contentType, size
}

export interface DeleteFileInput {
  bucket: string;
  path: string;
}

export interface DeleteFileOutput {
  success: boolean;
}

export interface GetPublicUrlInput {
  bucket: string;
  path: string;
  // TODO: transform options (width, height, format, quality) for image CDN
}

export interface GetPublicUrlOutput {
  publicUrl: string;
  // TODO: signedUrl option for private buckets
}

export interface ListFilesInput {
  bucket: string;
  prefix?: string;
  // TODO: limit, offset, sortBy
}

export interface ListFilesOutput {
  files: {
    name: string;
    path: string;
    size?: number;
    updatedAt?: string;
    // TODO: contentType, metadata
  }[];
}

// ── Operation interface ───────────────────────────────────────────────────────

/**
 * Generic bucket operation interface
 *
 * Note: `name` is intentionally absent. The registry keys by the string passed to
 * registerBucketOperation(). Storing name on the object duplicates the key and
 * risks name/key mismatches. Use getRegisteredBucketOperations() for introspection.
 */
export interface BucketOperation<Input = any, Output = any> {
  handler: (input: Input) => Promise<Output>;
}

/**
 * Service registry for bucket operations
 * Singleton that holds all registered bucket operation implementations
 */
let registeredOperations: Map<string, BucketOperation> = new Map();

/**
 * Register a bucket operation implementation
 *
 * Called during app bootstrap to wire up backend-specific implementations.
 * Can be called multiple times; later registrations override earlier ones.
 *
 * @param operationName - Semantic name (e.g., 'uploadImage', 'deleteFile')
 * @param operation - Implementation with handler function
 *
 * @example
 * registerBucketOperation('uploadImage', supabaseAdapter.createUploadImageOperation());
 */
export function registerBucketOperation(
  operationName: string,
  operation: BucketOperation
): void {
  registeredOperations.set(operationName, operation);
  logger.category('buckets').debug(`Registered bucket operation: ${operationName}`);
}

/**
 * Get a registered bucket operation by name
 *
 * @param operationName - Semantic name (e.g., 'uploadImage')
 * @returns The operation, or undefined if not registered
 */
export function getBucketOperation(operationName: string): BucketOperation | undefined {
  return registeredOperations.get(operationName);
}

/**
 * Check if a bucket operation is registered
 *
 * @param operationName - Semantic name
 * @returns true if the operation has been registered
 */
export function isBucketOperationRegistered(operationName: string): boolean {
  return registeredOperations.has(operationName);
}

/**
 * Get all registered bucket operation names
 *
 * @returns Array of registered operation names
 */
export function getRegisteredBucketOperations(): string[] {
  return Array.from(registeredOperations.keys());
}

/**
 * Execute a registered bucket operation
 *
 * @param operationName - Semantic name (e.g., 'uploadImage')
 * @param input - Parameters to pass to the operation handler
 * @returns Result from the operation handler
 *
 * @throws Error if the operation is not registered
 *
 * @example
 * const result = await executeBucketOperation('uploadImage', {
 *   bucket: 'avatars',
 *   file: imageBlob,
 *   name: 'user-123-avatar.jpg',
 * });
 */
export async function executeBucketOperation<T = any>(
  operationName: string,
  input: any
): Promise<T> {
  const operation = getBucketOperation(operationName);

  if (!operation) {
    logger.category('buckets').error(`Bucket operation not registered: ${operationName}`, {
      operationName,
      availableOperations: getRegisteredBucketOperations(),
    });
    throw new Error(
      `Bucket operation "${operationName}" is not registered. ` +
        `Available operations: ${getRegisteredBucketOperations().join(', ')}`
    );
  }

  try {
    logger.category('buckets').debug(`Executing bucket operation: ${operationName}`, {
      operationName,
    });

    const result = await operation.handler(input);

    logger.category('buckets').debug(`Bucket operation completed: ${operationName}`, {
      operationName,
    });

    return result as T;
  } catch (err) {
    logger.category('buckets').error(`Bucket operation failed: ${operationName}`, {
      operationName,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Clear all registered bucket operations (for testing)
 *
 * @internal
 */
export function clearBucketOperationRegistry(): void {
  registeredOperations.clear();
  logger.category('buckets').debug('Cleared bucket operation registry');
}
