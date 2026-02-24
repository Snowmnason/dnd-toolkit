# lib/storage

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

## Architecture & Data Flow

```
App Code
  ↓
SecureStorage (API)
  ↓
STORAGE_BACKEND_CONFIG (routes key)
  ↓
[EncryptedStorage | FastCache | AsyncStorage | localStorage | sessionStorage]
  ↓
Physical Storage (platform-specific)
```

**Key Components:**
- **SecureStorage**: Main async API for persistent and sensitive data. Handles backend routing, encryption, validation, error handling.
- **FastCache**: In-memory/session cache for ephemeral, high-frequency data (query cache, world access flags). TTL and prefix support.
- **EncryptedStorage**: Underlying encryption layer (AES-256-CTR + HMAC-SHA256).
- **STORAGE_BACKEND_CONFIG**: Central routing table for all keys.
- **cache-versioning.ts**: Schema validation and migration for stored data.
- **storage-error-handling.ts**: Category-based error handling with graceful fallback.
- **world-access-cache.ts**: Centralizes world access flag sync.

**Platform Abstraction:**
- **Web**: localStorage/sessionStorage with selective encryption
- **Native (iOS/Android)**: expo-secure-store + AsyncStorage, always encrypted
- **Desktop (Electron)**: Same as web (localStorage/sessionStorage, encrypted)

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
  logger.warn("storage", "FastCache quota 80% full");
}
```

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
  onError: (err) => logger.error("storage", "Failed to save:", err),
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
  logger.warn("storage", `${result.failed} operations failed`);
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

### Cache Versioning

- **validateCacheEntry():** ~100ns (valid schema) or ~1-2ms (invalid schema with error handling)
- **handleCacheMigration():** ~1-2ms (simple migration) to ~10-100ms (large datasets)

**Recommendation:** Run during initialization or batch operations, not in hot paths.

## Related Modules & Integration Points

- `lib/auth/encrypted-storage` – Encryption implementation
- `lib/cache` – QueryCache (uses FastCache for ephemeral data)
- `lib/network` – Network error handling (complements storage errors)
- `lib/database` – Uses SecureStorage for persistent user/world data
- `lib/offline` – Uses SecureStorage for offline mutation queue

## File Breakdown

| File                      | Purpose                                       | Lines |
| ------------------------- | --------------------------------------------- | ----- |
| SecureStorage.ts          | Main API, backend routing, encryption         | ~400  |
| FastCache.ts              | In-memory/session cache                       | ~100  |
| cache-versioning.ts       | Versioning, migration, schema validation      | ~200  |
| storage-config.ts         | Key routing, backend configuration            | ~140  |
| storage-error-handling.ts | Error handling, graceful fallback             | ~500  |
| world-access-cache.ts     | World access flag sync, non-throwing helpers  | ~80   |
| update-storage-cache.ts   | Cache update orchestration                    | ~50   |
| storage-health-monitor.ts | Periodic health checks via background jobs    | ~130  |
| data-classification.ts    | Data sensitivity levels, classification rules | ~60   |
| index.ts                  | Barrel export, key constants                  | ~100  |
