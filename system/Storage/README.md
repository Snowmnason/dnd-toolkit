# System Storage Module

Low-level storage abstraction providing encrypted persistence, multiple storage backends, and data versioning. Handles cross-platform storage APIs, encryption, and storage bucket management. Pure storage layer with no business logic.

## When to Use This Module

**Use this module for:**

- Persistent data storage with encryption
- Cross-platform storage abstraction
- Multiple storage backends (SecureStorage, FastCache, etc.)
- Data versioning and migration
- Storage bucket organization

**Don't use this module for:**

- Business logic data management (belongs in lib modules)
- Cache invalidation policies (belongs in lib/cache)
- UI storage status (belongs in hooks)
- Data transformation (belongs in lib modules)

## Architecture & Data Flow

```
Data → Encryption → Storage Backend → Persistence
                                      ↓
Retrieval → Decryption → Version Check → Data
```

**Key Components:**

- **SecureStorage**: Encrypted persistent storage
- **Storage Backends**: Multiple storage implementations
- **Buckets**: Organized storage namespaces
- **Versioning**: Data migration and compatibility

## API Reference

### Secure Storage

#### `SecureStorage.setItem(key: string, value: string): Promise<void>`

Store encrypted data.

```typescript
import { SecureStorage } from '@/system/Storage';

await SecureStorage.setItem('user-token', token);
```

#### `SecureStorage.getItem(key: string): Promise<string | null>`

Retrieve decrypted data.

```typescript
const token = await SecureStorage.getItem('user-token');
```

### Storage Backends

#### `StorageRouter.getBackend(key: string): StorageBackend`

Get appropriate backend for key.

```typescript
const backend = StorageRouter.getBackend('user:profile');
await backend.setItem('user:profile', data);
```

## Dependencies

### External

- **`expo-secure-store`** – Secure storage on mobile
- **`@react-native-async-storage/async-storage`** – Async storage

### Internal

- **`lib/utils/logger`** – Storage operation logging

## Error Handling & Edge Cases

### Storage Unavailable

Graceful fallback to memory storage.

### Encryption Failures

Data remains unencrypted with warnings.

### Quota Exceeded

Old data evicted automatically.

### Corruption

Invalid data ignored; fresh data requested.

## Performance Notes

- **Encryption**: AES-256-CTR for security
- **Caching**: FastCache for performance
- **Batching**: Operations batched when possible
- **Memory**: Minimal memory footprint

## Related Modules

- **`lib/storage`** – Business logic storage management
- **`hooks/storage`** – UI storage status hooks
- **`system/Kernel`** – Bootstrap storage initialization

## File Breakdown

| File | Purpose |
| --- | --- |
| `SecureStorage.ts` | Encrypted storage implementation |
| `buckets/` | Storage bucket management |
| `cache/` | Cache storage backends |
| `versioning/` | Data versioning and migration |
| `index.ts` | Barrel export |