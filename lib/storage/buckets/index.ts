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
    registerBucketOperation,
    type BucketOpName,
    type BucketOperation,
    type DeleteFileInput,
    type DeleteFileOutput,
    type DownloadFileInput,
    type DownloadFileOutput,
    type GetPublicUrlInput,
    type GetPublicUrlOutput,
    type ListFilesInput,
    type ListFilesOutput,
    type UploadImageInput,
    type UploadImageOutput
} from './registry';

// Operations
export {
    deleteImage,
    getImageUrl,
    listFiles,
    uploadProfileImage
} from './operations';
