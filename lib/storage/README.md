# Storage Module

Enterprise-grade, cross-platform, encrypted storage and cache system for all persistent and ephemeral app data.

## When to Use This Module

**Use this module if you need:**

- Secure, persistent storage for all user/app data (auth tokens, preferences, world access, offline queue)
- Automatic encryption of all data at rest (AES-256-CTR + HMAC-SHA256 on all platforms: web, native, desktop)
- High-performance, ephemeral cache for query results and session state without persistence
- Schema versioning and automatic migration of stored data across app updates
- Robust error handling with graceful fallback when storage is unavailable or corrupted
- Centralized, type-safe key management with backend routing (localStorage on web, secure-store on native)

**Do NOT use this module for:**

- Direct `localStorage` / `sessionStorage` / `AsyncStorage` / `EncryptedStorage` calls (always route through `SecureStorage`)
- Purely in-memory, session-scoped state (use React state or [lib/storage/cache/FastCache](../cache/README.md#fastcache-ephemeral-in-memory-cache))
- Large binary data (encryption adds 5-10% overhead)
- Analytics or event logs (use [lib/analytics](../analytics/README.md) instead)
- Real-time data (use [lib/realtime](../realtime/README.md) instead)
- Distributed/multi-user state (this is local device storage)

## Data Classification & Privacy Levels

All data stored here is classified by sensitivity level to determine encryption, retention, and logging.

| Level             | Sensitivity | Storage       | Encryption    | Retention  | Example                      |
| ----------------- | ----------- | ------------- | ------------- | ---------- | ---------------------------- |
| **PUBLIC**        | None        | FastCache     | No            | Session    | App version, feature flags   |
| **NON_SENSITIVE** | Low         | SecureStorage | Yes (AES-256) | Persistent | Theme, UI scale              |
| **SENSITIVE**     | High        | SecureStorage | Yes (AES-256) | On logout  | User world list, characters  |
| **PII**           | Critical    | SecureStorage | Yes (AES-256) | On logout  | Email, session tokens        |

**For developers:** Register new keys in `DATA_CLASSIFICATIONS` (data-classification.ts). Use `getStorageBackend(key)` for automatic routing. For PII redaction, use the centralized `RedactionManager` (see `lib/utils/redaction-manager.ts`).

Full policy: [docs/issues/MileStone 2/168 - Privacy PII Data/PRIVACY_POLICY.md](../../docs/issues/MileStone%202/168%20-%20Privacy%20PII%20Data/PRIVACY_POLICY.md)

## Compression & Storage Optimization

The storage system includes automatic compression for large cache entries to optimize memory usage and storage efficiency.

### Compression Configuration

Compression is configured globally in `appsettings.json`:

```json
{
  "compression": {
    "enabled": true,
    "algorithm": "gzip",
    "threshold": 1024,
    "maxBytesPerEntry": 10485760
  },
  "cacheSecurityLimits": {
    "hardMaxBytes": 524288000,
    "hardMaxEntries": 5000,
    "rejectOversizedEntries": false
  }
}
```

### Automatic Compression

- **Threshold-based**: Only entries > 1KB are compressed by default
- **Platform-aware**: Uses Web Compression API on web, zlib on native platforms
- **Transparent**: Compression/decompression happens automatically
- **Versioned**: Includes version flags for future algorithm changes

### Storage Limits

- **Hard limits**: 500MB total cache size, 5000 entries maximum
- **Per-entry limits**: 10MB maximum per entry — oversized entries stored uncompressed with a warning
- **Graceful handling**: Oversized entries are never rejected; compression is skipped gracefully

### Compression Performance Notes

- **Decompression cost**: Large entries (>1MB) may add 5-50ms decompression latency on mobile devices. For hot-path data accessed every render, consider shorter TTLs or in-memory caching to avoid repeated decompression.
- **Base64 overhead**: Compressed data is stored as base64 (~33% size increase over raw bytes) for JSON round-trip safety. Stats report `totalStoredBytes` which includes this overhead, so `bytesSaved` reflects real savings.
- **Memory during decompression**: Both the compressed and decompressed copies exist briefly in memory. For very large entries (>5MB), this could spike memory on constrained devices.
- **Sampling**: Compression logs use probabilistic sampling (default 10%) to reduce noise. Tune via `compression.stats.sampleRate` in appsettings.
- **Periodic stats reset**: Call `startPeriodicReset()` (default 24h) to prevent long-running averages from masking recent compression trends.

### Compression Statistics

Track compression effectiveness:

```typescript
import { getCompressionStats } from '@/middleware/storage/compression/compression-middleware';

const stats = getCompressionStats();
// Returns: totalOperations, bytesCompressed, bytesSaved, avgCompressionRatio
```

## Architecture & Data Flow

```
App Code
    ↓
SecureStorage API
    ↓
Compression Middleware (automatic)
    ↓
Backend Routing
    ↓
[EncryptedStorage | FastCache | Platform Storage]
    ↓
Physical Storage
```

**Key Principles:**

- **Automatic encryption**: All sensitive data encrypted with AES-256-CTR + HMAC-SHA256 across all platforms
- **Backend abstraction**: Single API routes to appropriate storage backend based on data classification
- **Graceful degradation**: Storage failures never crash the app, always provide fallbacks
- **Schema versioning**: Automatic migration and validation of stored data across app updates

## API Reference

### SecureStorage (default export)

Main async API for all persistent and sensitive data.

#### `SecureStorage.setItem(key, value): Promise<void>`

Store a string value.

**Example:**
```ts
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";

await SecureStorage.setItem(STORAGE_KEYS.USER_DATA, "user-123");
```

#### `SecureStorage.getItem(key): Promise<string | null>`

Retrieve a string value. Returns null on not found or error (never throws).

**Example:**
```ts
const userData = await SecureStorage.getItem(STORAGE_KEYS.USER_DATA);
```

#### `SecureStorage.setJSON<T>(key, value): Promise<void>`

Store a JSON-serializable object.

**Example:**
```ts
await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, {
  theme: "dark",
  language: "en",
});
```

#### `SecureStorage.getJSON<T>(key): Promise<T | null>`

Retrieve and parse a JSON object. Returns null on parse errors.

**Example:**
```ts
const prefs = await SecureStorage.getJSON<UserPreferences>(
  STORAGE_KEYS.USER_PREFERENCES,
);
```

#### `SecureStorage.removeItem(key): Promise<void>`

Remove a value from storage.

#### `SecureStorage.clear(): Promise<void>`

Clear all storage (both encrypted and ephemeral). **Irreversible—used for logout.**

#### `SecureStorage.hasItem(key): Promise<boolean>`

Check if a key exists in storage.

#### `SecureStorage.getAllKeys(): Promise<string[]>`

Get all keys in storage (for debugging/migration).

#### `SecureStorage.getValidatedJSON<T>(key, schema): Promise<T | null>`

Retrieve, validate, and optionally migrate a versioned JSON entry.

**Parameters:**
- `key`: string — Storage key
- `schema`: CacheSchema<T> — Validation schema with version and optional migrate function

**Example:**
```ts
const schema = {
  version: 2,
  validate: (data) => data && typeof data === 'object',
  migrate: (oldData, oldVersion) => ({ ...oldData, newField: "default" }),
};

const data = await SecureStorage.getValidatedJSON(STORAGE_KEYS.USER_DATA, schema);
// Returns: Validated/migrated data or null
```

#### `SecureStorage.setVersionedJSON<T>(key, value, version): Promise<void>`

Store a versioned JSON entry with schema version.

**Example:**
```ts
await SecureStorage.setVersionedJSON(STORAGE_KEYS.USER_DATA, userData, 2);
```

### FastCache

High-performance, ephemeral cache for session-specific data.

#### `FastCache.set(key, value, ttl?): Promise<void>`

Store a value in fast cache.

**Example:**
```ts
import { FastCache } from "@/lib/storage";

await FastCache.set("query_cache_worlds:user:current", JSON.stringify(worlds));

// With TTL (expires after 5 minutes)
await FastCache.set("world_access_123", "true", 5 * 60 * 1000);
```

#### `FastCache.get(key): Promise<string | null>`

Retrieve a value from fast cache. Returns null if expired or not found.

#### `FastCache.remove(key): Promise<void>`

Remove a value from fast cache.

#### `FastCache.clear(): Promise<void>`

Clear all fast cache entries.

#### `FastCache.getStats(): StorageStats`

Get cache statistics (item count, estimated size, quota percentage).

**Example:**
```ts
const stats = await FastCache.getStats();
  if (stats.quotaPercentage > 80) {
  logger.category('storage').warn("FastCache quota 80% full");
}
```

### QueryCache

Centralized query result cache with invalidation strategies and selective revalidation.

#### `QueryCache.set<T>(key, data, options?): Promise<void>`

Store query result in cache with metadata.

**Parameters:**
- `key`: string — Unique cache key
- `data`: T — Query result data
- `options`: `{ staleTime?: number, cacheTime?: number, tags?: string[] }` — Cache options

**Example:**
```ts
import { QueryCache } from "@/lib/storage";

await QueryCache.set("worlds:user:123", worldsData, {
  staleTime: 5 * 60, // 5 minutes (seconds)
  tags: ["worlds", "user:123"]
});
```

#### `QueryCache.get<T>(key): Promise<CacheEntry<T> | null>`

Retrieve cached query result with metadata.

**Returns:** CacheEntry with data, timestamp, and staleness info.

#### `QueryCache.invalidateByTags(tags, options?): Promise<void>`

Invalidate all cache entries with matching tags.

**Parameters:**
- `tags`: string[] — Tag array to match
- `options`: InvalidateOptions — Revalidation strategy

**Example:**
```ts
// Invalidate all world-related queries, refetch in background
await QueryCache.invalidateByTags(["worlds"], { strategy: "background" });
```

#### `QueryCache.selectiveInvalidate(predicate, options?): Promise<number>`

Invalidate cache entries matching a predicate function and return the number of entries invalidated.

**Parameters:**
- `predicate`: `(key: string, entry: CacheEntry) => boolean` — Filter function
- `options`: InvalidateOptions — Revalidation strategy

**Returns:** `Promise<number>` — number of entries invalidated (0 if none matched).

**Example:**
```ts
// Invalidate only specific world, refetch immediately
const removed = await QueryCache.selectiveInvalidate(
  (key) => key.includes(`world:123`),
  { strategy: "immediate" }
);
console.log('invalidated entries', removed);
```

#### `QueryCache.clear(): Promise<void>`

Clear all cached query results.

### Compression API

Automatic compression utilities for storage optimization.

#### `getCompressionStats(): CompressionStats`

Get compression effectiveness statistics.

**Returns:** Object with `totalOperations`, `bytesCompressed`, `bytesSaved`, `avgCompressionRatio`.

**Example:**
```ts
import { getCompressionStats } from "@/middleware/storage/compression/compression-middleware";

const stats = getCompressionStats();
console.log(`Compressed ${stats.bytesCompressed} bytes, saved ${stats.bytesSaved} bytes`);
```

#### `compressData(data, options?): Promise<CompressedData>`

Manually compress data for storage.

**Parameters:**
- `data`: string | Uint8Array — Data to compress
- `options`: `{ algorithm?: 'gzip' | 'deflate', level?: number }` — Compression options

**Returns:** CompressedData with `data`, `originalSize`, `compressedSize`, `algorithm`.

**Example:**
```ts
import { compressData } from "@/middleware/storage/compression/compression-middleware";

const compressed = await compressData(largeJsonString, { algorithm: 'gzip' });
await SecureStorage.setItem(key, compressed.data);
```

#### `decompressData(compressedData, algorithm?): Promise<string | Uint8Array>`

Manually decompress previously compressed data.

**Parameters:**
- `compressedData`: string | Uint8Array — Compressed data
- `algorithm`: 'gzip' | 'deflate' — Compression algorithm used

**Returns:** Original uncompressed data.

**Example:**
```ts
const compressed = await SecureStorage.getItem(key);
if (compressed) {
  const original = await decompressData(compressed, 'gzip');
}
```

#### `isCompressionEnabled(): boolean`

Check if compression is enabled globally.

**Example:**
```ts
if (isCompressionEnabled()) {
  // Use compression-aware storage
}
```

### Query Caching

Integration with `hooks/storage/useQuery` for declarative data fetching with caching strategies.

#### Revalidation Strategies

Control how cached data behaves when invalidated:

- **`'immediate'`**: Block UI, wait for fresh data (default for mutations)
- **`'background'`**: Show stale data, refetch in background (SWR pattern)
- **`'keep-stale'`**: Keep stale data without auto-refetch (manual control)

**Example:**
```ts
import { useQuery } from "@/hooks/storage";

// Page load: Show stale data while fetching fresh
const { data, isLoading, isRevalidating } = useQuery(
  "worlds",
  fetchWorlds,
  { revalidationStrategy: "background" }
);

// User action: Wait for confirmation
const { data, refetch } = useQuery(
  "world:new",
  createWorld,
  { revalidationStrategy: "immediate" }
);
```

#### Conditional Revalidation

Only refetch if conditions are met:

```ts
const { data } = useQuery("users", fetchUsers, {
  revalidationCondition: async () => NetworkDetection.isOnline(),
  revalidationStrategy: "background"
});
```

#### State Tracking

- **`isLoading`**: True during initial fetch (no cached data)
- **`isRevalidating`**: True during background refresh (stale data shown)

### Cache Versioning

#### `validateCacheEntry<T>(entry, schema): CacheValidationResult`

Validate a cache entry against a schema. Returns result with `valid`, `shouldMigrate`, `shouldReset` flags.

#### `handleCacheMigration<T>(entry, schema): T | null`

Migrate a cache entry from old version to new version.

**Example:**
```ts
import { handleCacheMigration } from "@/lib/storage/cache-versioning";

const migrated = handleCacheMigration(oldEntry, newSchema);
if (migrated) {
  await SecureStorage.setVersionedJSON(key, migrated, newSchema.version);
}
```

### Error Handling Utilities

#### `safeStorageSet(options): Promise<StorageGracefulResult<void>>`

Safe storage set with fallback and error handling.

**Example:**
```ts
import { safeStorageSet } from "@/lib/storage";

const result = await safeStorageSet({
  operation: "set",
  key: STORAGE_KEYS.USER_DATA,
  value: userData,
  fallbackValue: "{}",
  onError: (err) => logger.category('storage').error("Failed to save:", err),
});

if (!result.success) {
  showErrorNotification("Failed to save preferences");
}
```

#### `safeStorageGet(options): Promise<StorageGracefulResult<string>>`

Safe storage get with fallback.

#### `batchStorageOperation(operations): Promise<BatchStorageResult>`

Batch multiple storage operations with partial failure handling.

**Returns:** Object with `success`, `failed`, `skipped`, and `errors` array.

**Example:**
```ts
import { batchStorageOperation } from "@/lib/storage";

const result = await batchStorageOperation([
  { operation: "set", key: STORAGE_KEYS.USER_DATA, value: "..." },
  { operation: "set", key: STORAGE_KEYS.THEME_PREFERENCE, value: "dark" },
]);

  if (result.failed > 0) {
  logger.category('storage').warn(`${result.failed} operations failed`);
}
```

### World Access Cache

#### `worldAccessCache.updateAccessFlag(worldId, hasAccess, source): Promise<void>`

Update world access flag and metadata after mutations. Never throws (logs errors instead).

**Parameters:**
- `worldId`: string — World identifier
- `hasAccess`: boolean — Whether user has access
- `source`: 'create' | 'add' | 'remove' | 'delete' — Mutation source

**Example:**
```ts
import { worldAccessCache } from "@/lib/storage";

// After user creates a world
await worldAccessCache.updateAccessFlag(worldId, true, "create");

// After user removes access
await worldAccessCache.updateAccessFlag(worldId, false, "remove");
```

#### `worldAccessCache.clearWorldAccess(worldId): Promise<void>`

Clear all access flags and metadata for a world. Never throws.

## Dependencies

### External Packages

- **`expo-secure-store`** – Encrypted storage on iOS/Android
- **`@react-native-async-storage/async-storage`** – Fallback storage on native platforms

### Internal Dependencies

- **`lib/auth`** – Encrypted storage implementation for sensitive auth data
- **`lib/cache`** – FastCache integration for ephemeral data storage
- **`lib/network`** – Network error handling patterns
- **`lib/middleware/storage/helpers`** – QueryCache implementation for query result caching
- **`lib/middleware/storage/compression`** – Automatic compression middleware for storage optimization
- **`hooks/storage`** – useQuery hook integration with revalidation strategies

## Error Handling & Edge Cases

### Quota Exceeded

- **FastCache quota:** 5MB (configurable). When exceeded, logs warning and returns null on get.
- **localStorage quota:** Browser-specific (typically 5-10MB). SecureStorage catches `QuotaExceededError` and fails gracefully.
- **Recovery:** Manual cleanup by user (clear cache, remove unused keys) or automatic trimming of oldest entries.

**Example:**
```ts
const result = await safeStorageSet({
  operation: "set",
  key,
  value,
  fallbackValue: "{}",
});

if (!result.success && result.error?.message.includes("quota")) {
  showNotification("Storage full. Please clear app data.");
}
```

### Corrupted Data

- **Detection:** JSON parse errors, version mismatch, schema validation failure.
- **Recovery:** Automatic reset or migration (if schema provides migrate function).
- **Behavior:** `getValidatedJSON()` detects corruption, attempts migration, clears entry if migration fails.
- **Logging:** All corruption is logged with category `'storage'`.

### Version Mismatch

- **Trigger:** `CURRENT_CACHE_VERSION` incremented or schema.version changed.
- **Resolution:** If schema provides `migrate`, attempts migration; otherwise clears entry and returns null.

**Example:**
```ts
// Schema version bumped from 1 to 2
const schema = { 
  version: 2, 
  validate: ..., 
  migrate: (old) => ({ ...old, newField: "default" }) 
};

// Stored data is version 1
const data = await SecureStorage.getValidatedJSON(key, schema);
// Automatically migrates, returns: { ...oldData, newField: "default" }
```

### Platform-Specific Failures

- **Web:** localStorage might be disabled, in private mode, or full. SecureStorage catches and logs.
- **Native (iOS):** expo-secure-store might fail if device locked. AsyncStorage is fallback.
- **Desktop (Electron):** localStorage works like web. EncryptedStorage uses same logic.
- **Behavior:** All failures caught, logged, and gracefully degrade to null/fallback.

### Encryption/Decryption Errors

- **Trigger:** Invalid cipher data, corrupted encryption metadata.
- **Behavior:** Caught during `getItem()` or `getJSON()`, logged, returns null/graceful default.
- **Security:** Errors never leak key material or plaintext in logs.

### Stale World Access Cache

- **Trigger:** World access flags in storage are 2+ hours old.
- **Detection:** Metadata timestamp compared against current time in `verifyWorldAccessWithDatabase()`.
- **Resolution:** Automatic refresh from Supabase; fresh data cached locally.
- **User impact:** Transparent; brief delay on sensitive screens (settings).

## Performance Notes

### SecureStorage Operations

- **Encrypted backend (localStorage):** ~2-5ms (includes AES-256-CTR encryption/decryption, HMAC)
- **Ephemeral backend (sessionStorage):** ~100-500µs (unencrypted, synchronous)
- **setJSON/getJSON cost:** ~4-7ms for 10KB object (JSON serialization ~1-2ms, encryption ~2-5ms)
- **Batch operations:** Linear; ~2-5ms per encrypted item

**Recommendation:** Safe for moderate-frequency writes (< 100/sec). For high-frequency updates, use FastCache.

### FastCache Operations

- **sessionStorage (web):** ~50-200µs (synchronous, no encryption)
- **AsyncStorage (native):** ~1-5ms (async, no encryption)
- **TTL expiration check:** ~100ns per entry
- **Quota monitoring:** ~500ns (single calculation)

**Recommendation:** Can be called in render loops on web. Use for high-frequency cache updates.

### Encryption Overhead

- **AES-256-CTR + HMAC-SHA256:** ~1µs per KB of data
- **Key derivation (one-time):** ~50-100ms (amortized on startup)
- **Scalability:** For large objects (>1MB), consider splitting into multiple keys or using FastCache + lazy decryption

### Compression Overhead

- **Gzip compression:** ~5-20µs per KB (depends on data compressibility)
- **Deflate compression:** ~3-15µs per KB (faster but less compression)
- **Threshold check:** ~50ns (negligible)
- **Memory impact:** 2-3x temporary memory during compression/decompression
- **Typical savings:** 60-80% for JSON data, 20-40% for already-compressed data

**Recommendation:** Enabled by default for entries >1KB. Disable for pre-compressed data (images, videos).

### Cache Versioning

- **validateCacheEntry():** ~100ns (valid schema) or ~1-2ms (invalid schema with error handling)
- **handleCacheMigration():** ~1-2ms (simple migration) to ~10-100ms (large datasets)

**Recommendation:** Run during initialization or batch operations, not in hot paths.

## Related Modules

- **`lib/auth`** – Uses SecureStorage for encrypted auth tokens and session data
- **`lib/cache`** – Integrates FastCache for query result caching
- **`lib/database`** – Stores persistent user and world data through SecureStorage
- **`lib/offline`** – Uses SecureStorage for offline mutation queue persistence
- **`lib/middleware/storage/helpers`** – QueryCache for centralized query result management
- **`lib/middleware/storage/compression`** – Automatic compression middleware for storage optimization
- **`hooks/storage`** – useQuery hook with revalidation strategies and conditional fetching

## File Breakdown

| File | Purpose |
|------|---------|
| `SecureStorage.ts` | Main API for encrypted persistent storage with backend routing |
| `FastCache.ts` | In-memory session cache for ephemeral high-frequency data |
| `cache-versioning.ts` | Schema validation and automatic migration for stored data |
| `storage-config.ts` | Key routing configuration and backend selection logic |
| `storage-error-handling.ts` | Graceful error handling and fallback mechanisms |
| `world-access-cache.ts` | World access flag synchronization and caching |
| `update-storage-cache.ts` | Cache update orchestration and coordination |
| `storage-health-monitor.ts` | Background health checks and monitoring |
| `data-classification.ts` | Data sensitivity levels and privacy classification |
| `compression.ts` | Automatic compression middleware for storage optimization |
| `index.ts` | Barrel exports and storage key constants |
