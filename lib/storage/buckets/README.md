# lib/storage/buckets

Registry-based abstraction layer for file storage operations (upload, download, delete, URL generation). Supports swapping storage backends (Supabase Storage, Firebase Storage, S3, Cloudinary, etc.) without changing call sites.

## When to Use This Module

**Use this module if you need to:**

- Upload files (images, documents, assets) to cloud storage
- Download files from cloud storage
- Delete files from cloud storage
- Generate public URLs for stored files
- List files in a storage bucket
- Swap storage backends without changing application code
- Test file operations with mock implementations

**Do NOT use this module for:**

- Local device storage (use `lib/storage/SecureStorage` instead)
- In-memory caching (use `lib/storage/cache/FastCache` instead)
- Database operations (use `lib/database` instead)
- Real-time file synchronization (use `lib/realtime` instead)

## Architecture & Data Flow

```
App Code (uploadProfileImage, etc.)
  ↓
Operations Layer (lib/storage/buckets/operations.ts)
  ↓
Registry Layer (lib/storage/buckets/registry.ts)
  ↓
Backend Implementation (Supabase, Firebase, S3, etc.)
  ↓
Cloud Storage Service
```

## Core Concepts

### Registry Pattern

Bucket operations are registered by semantic name (e.g., `'uploadImage'`, `'deleteFile'`) rather than backend-specific calls. This allows:

- **Backend Agnosticism**: Call sites don't know or care about the underlying storage service
- **Runtime Swapping**: Change storage providers without code changes
- **Testability**: Register mock implementations for testing
- **Type Safety**: Each operation has defined input/output interfaces

### Operation Constants

Use the `BUCKET_OPS` constants instead of raw strings to prevent typos:

```typescript
import { executeBucketOperation, BUCKET_OPS } from '@/lib/storage/buckets';

// ✅ Good
executeBucketOperation(BUCKET_OPS.UPLOAD_IMAGE, input);

// ❌ Bad
executeBucketOperation('uploadImage', input);
```

## API Reference

### Registry Functions

```typescript
// Register an operation implementation
registerBucketOperation(operationName: string, operation: BucketOperation): void

// Execute a registered operation
executeBucketOperation<T>(operationName: string, input: any): Promise<T>

// Check if operation is registered
isBucketOperationRegistered(operationName: string): boolean

// Get all registered operations (for debugging)
getRegisteredBucketOperations(): string[]
```

### Operation Interfaces

```typescript
interface BucketOperation<Input = any, Output = any> {
  handler: (input: Input) => Promise<Output>;
}
```

### Available Operations

| Operation | Input | Output | Description |
|-----------|-------|--------|-------------|
| `UPLOAD_IMAGE` | `UploadImageInput` | `UploadImageOutput` | Upload image file to bucket |
| `DOWNLOAD_FILE` | `DownloadFileInput` | `DownloadFileOutput` | Download file as blob |
| `DELETE_FILE` | `DeleteFileInput` | `DeleteFileOutput` | Delete file from bucket |
| `GET_PUBLIC_URL` | `GetPublicUrlInput` | `GetPublicUrlOutput` | Get public URL for file |
| `LIST_FILES` | `ListFilesInput` | `ListFilesOutput` | List files in bucket |

## Usage Examples

### Basic Operation Execution

```typescript
import { executeBucketOperation, BUCKET_OPS } from '@/lib/storage/buckets';

// Upload an image
const result = await executeBucketOperation(BUCKET_OPS.UPLOAD_IMAGE, {
  bucket: 'avatars',
  file: imageBlob,
  name: 'user-123-avatar.jpg',
  upsert: true,
});

console.log('Uploaded to:', result.path);
console.log('Public URL:', result.publicUrl);
```

### High-Level Operations

```typescript
import { uploadProfileImage } from '@/lib/storage/buckets';

// Upload profile image (handles validation, naming, etc.)
const result = await uploadProfileImage(userId, imageFile);
```

## Backend Registration

Operations are registered during app bootstrap. See `lib/services/supabase/supabase-buckets-adapter.ts` for the Supabase implementation.

```typescript
// In service initialization
import { registerBucketOperation } from '@/lib/storage/buckets';
import { createSupabaseBucketOperations } from '@/lib/services/supabase/supabase-buckets-adapter';

registerBucketOperation(BUCKET_OPS.UPLOAD_IMAGE, createSupabaseBucketOperations().uploadImage);
```

## Error Handling

All operations throw errors for:
- Unregistered operations
- Backend failures
- Invalid inputs
- Permission issues

```typescript
try {
  await executeBucketOperation(BUCKET_OPS.UPLOAD_IMAGE, input);
} catch (error) {
  if (error.message.includes('not registered')) {
    // Operation not implemented
  } else {
    // Backend error
  }
}
```

## Testing

Register mock implementations for testing:

```typescript
import { registerBucketOperation, clearBucketOperationRegistry } from '@/lib/storage/buckets';

describe('MyComponent', () => {
  beforeEach(() => {
    clearBucketOperationRegistry();
    registerBucketOperation(BUCKET_OPS.UPLOAD_IMAGE, {
      handler: jest.fn().mockResolvedValue({ path: 'mock/path.jpg' })
    });
  });
});
```

## File Structure

```
lib/storage/buckets/
├── index.ts           # Barrel exports
├── registry.ts        # Core registry and operation execution
├── operations.ts      # High-level semantic operations
└── helpers.ts         # Utility functions (validation, naming, etc.)
```

## Dependencies

- **Internal**: `lib/utils/logger` for logging
- **External**: None (backend-specific dependencies handled by adapters)

## Future Enhancements

- Image transformation/optimization (resize, format conversion)
- Batch operations
- Progress callbacks for large uploads
- CDN integration for URL generation
- File metadata and tagging
- Signed URLs for private files</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\lib\storage\buckets\README.md