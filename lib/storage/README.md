# lib/storage

**Enterprise-grade, cross-platform, encrypted storage and cache system for all persistent and ephemeral app data.**

---

## When to Use This Module

**Use this module if you need:**

- Secure, persistent storage for all user/app data (auth tokens, preferences, world access, offline queue)
- Automatic encryption of all data at rest (AES-256-CTR + HMAC-SHA256 on all platforms: web, native, desktop)
- High-performance, ephemeral cache for query results and session state without persistence
- Schema versioning and automatic migration of stored data across app updates
- Robust error handling with graceful fallback when storage is unavailable or corrupted
- Centralized, type-safe key management with backend routing (localStorage on web, secure-store on native)
- Support for multiple storage backends (secure, sessionStorage, localStorage, AsyncStorage)

**Do NOT use this module for:**

- Direct `localStorage` / `sessionStorage` / `AsyncStorage` / `EncryptedStorage` calls (always route through `SecureStorage`)
- Purely in-memory, session-scoped state (use React state or ephemeral [lib/cache's FastCache](../cache/README.md#fastcache-ephemeral-in-memory-cache) instead)
- Large binary data (encryption adds 5-10% overhead; consider external blob storage)
- Analytics or event logs (should use their own storage; see [lib/analytics](../analytics/README.md) instead)
- Real-time data (use [lib/cache](../cache/README.md) with SWR pattern instead)
- Distributed/multi-user state (this is local device storage; use [lib/database](../database/README.md) or [lib/api](../api/README.md) for server sync)

---

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

### Key Components

- **SecureStorage**: Main async API for all persistent and sensitive data. Handles backend routing, encryption, schema validation, and error handling.
- **FastCache**: In-memory/session cache for ephemeral, high-frequency data (e.g., query cache, world access flags). TTL, batch, and prefix support.
- **EncryptedStorage**: Underlying encryption layer (AES-256-CTR + HMAC-SHA256) for all persistent data, even on web.
- **STORAGE_BACKEND_CONFIG**: Central routing table for all keys. Controls which backend (localStorage, sessionStorage, secure) is used for each key.
- **cache-versioning.ts**: Handles schema validation and migration for all stored data. Prevents breakage after deployments.
- **storage-error-handling.ts**: Provides robust, category-based error handling and graceful fallback for all storage operations.
- **world-access-cache.ts**: Centralizes world access flag sync and metadata updates.
- **update-storage-cache.ts**: Orchestrates cache refresh from database (used by auth-state, settings, etc.)

### Platform Abstraction

- **Web**: Uses localStorage/sessionStorage with selective encryption.
- **Native (iOS/Android)**: Uses expo-secure-store + AsyncStorage, always encrypted.
- **Desktop (Electron)**: Same as web (localStorage/sessionStorage, encrypted).

### Security Model

- **All persistent data is encrypted** (AES-256-CTR + HMAC-SHA256) except ephemeral session cache.
- **No raw key access**: All keys are centrally defined and routed. Never use string keys directly.
- **No secrets in code**: Encryption keys are managed securely and never hardcoded.

---

## Deep-Dive: Component Responsibilities

### SecureStorage

- Async API for all persistent/sensitive data
- Routes keys to correct backend (encrypted, ephemeral, or secure)
- Handles JSON serialization, schema validation, and migration
- All methods are async for cross-platform consistency
- Category-based logging for all operations

### FastCache

- High-performance, ephemeral cache for query results and session data
- Uses sessionStorage (web) or AsyncStorage (native)
- Supports TTL, batch operations, prefix-based cleanup, and quota monitoring
- Not for sensitive data (unencrypted)

### EncryptedStorage

- AES-256-CTR + HMAC-SHA256 encryption for all persistent data
- Used by SecureStorage for all sensitive keys
- Never accessed directly by app code

### STORAGE_BACKEND_CONFIG

- Central routing table for all keys (see storage-config.ts)
- Supports wildcards/prefixes for pattern-based routing
- All new keys must be added here for correct backend/encryption

### cache-versioning.ts

- Handles schema validation and migration for all stored data
- Prevents breakage after deployments or schema changes
- All versioned entries validated on load; migration or reset on mismatch

### storage-error-handling.ts

- Category-based error handling for all storage operations
- Graceful fallback on quota, corruption, encryption, or platform errors
- Batch and safe operation helpers for robust error handling

### world-access-cache.ts

- Centralizes SecureStorage updates for world access flags after mutations
- Non-throwing, always logs errors (never breaks DB operations)

### update-storage-cache.ts

- Orchestrates cache refresh from database (used by auth-state, settings, etc.)
- Handles world access cache refresh and user/world data updates

---

## API Reference & Usage Patterns

### SecureStorage (default export)

The main async API for all persistent and sensitive data. Routes to encrypted or ephemeral backends based on `STORAGE_BACKEND_CONFIG`.

#### `SecureStorage.setItem(key, value): Promise<void>`

Store a string value.

**Parameters:**

- `key`: string — Storage key from `STORAGE_KEYS` (e.g., `STORAGE_KEYS.USER_DATA`)
- `value`: string — Value to store

**Returns:** Promise<void>

**Throws:** If backend routing fails or storage quota exceeded

**Example:**

```ts
import { SecureStorage, STORAGE_KEYS } from "@/lib/storage";

await SecureStorage.setItem(STORAGE_KEYS.USER_DATA, "user-123");
```

**Behavior:**

- `localStorage` key → Routes to EncryptedStorage → AES-256-CTR encrypted → localStorage
- `sessionStorage` key → Routes to sessionStorage directly (unencrypted, fast)
- `secure` key → Routes to EncryptedStorage → AES-256-CTR encrypted

#### `SecureStorage.getItem(key): Promise<string | null>`

Retrieve a string value.

**Parameters:**

- `key`: string — Storage key

**Returns:** Promise<string | null> — Value if exists, null if not found or error

**Example:**

```ts
const userData = await SecureStorage.getItem(STORAGE_KEYS.USER_DATA);
// Returns: "user-123" or null
```

**Behavior:**

- Returns null on any error (never throws)
- Logs warnings on retrieval failures
- Uses correct backend based on key routing

#### `SecureStorage.setJSON<T>(key, value): Promise<void>`

Store a JSON-serializable object.

**Parameters:**

- `key`: string — Storage key
- `value`: T — Any JSON-serializable object

**Returns:** Promise<void>

**Throws:** If JSON serialization fails or storage quota exceeded

**Example:**

```ts
await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, {
  theme: "dark",
  language: "en",
});
```

#### `SecureStorage.getJSON<T>(key): Promise<T | null>`

Retrieve and parse a JSON object.

**Parameters:**

- `key`: string — Storage key

**Returns:** Promise<T | null> — Parsed object or null

**Example:**

```ts
const prefs = await SecureStorage.getJSON<UserPreferences>(
  STORAGE_KEYS.USER_PREFERENCES,
);
// Returns: { theme: "dark", language: "en" } or null
```

**Behavior:**

- Returns null if key not found or JSON parse fails
- Never throws (logs warnings instead)

#### `SecureStorage.removeItem(key): Promise<void>`

Remove a value from storage.

**Parameters:**

- `key`: string — Storage key

**Returns:** Promise<void>

**Throws:** If removal fails

**Example:**

```ts
await SecureStorage.removeItem(STORAGE_KEYS.PENDING_INVITE);
```

#### `SecureStorage.clear(): Promise<void>`

Clear all storage (both encrypted and ephemeral).

**Returns:** Promise<void>

**Throws:** If clearing fails

**⚠️ WARNING:** Irreversible operation. Used for logout and app reset.

```ts
await SecureStorage.clear(); // Logs: ⚠️ All storage cleared
```

#### `SecureStorage.hasItem(key): Promise<boolean>`

Check if a key exists in storage.

**Parameters:**

- `key`: string — Storage key

**Returns:** Promise<boolean>

**Example:**

```ts
if (await SecureStorage.hasItem(STORAGE_KEYS.USER_DATA)) {
  // User data exists
}
```

#### `SecureStorage.getAllKeys(): Promise<string[]>`

Get all keys in storage (for debugging/migration).

**Returns:** Promise<string[]>

**Example:**

```ts
const keys = await SecureStorage.getAllKeys();
// Returns: ['dnd:auth:user_data', 'dnd:auth:has_account', ...]
```

#### `SecureStorage.getValidatedJSON<T>(key, schema): Promise<T | null>`

Retrieve, validate, and optionally migrate a versioned JSON entry.

**Parameters:**

- `key`: string — Storage key
- `schema`: CacheSchema<T> — Validation schema
  - `version`: number — Current version
  - `validate`: (data: any) => boolean — Validation function
  - `migrate?`: (oldData: any, oldVersion: number) => T | null — Migration function

**Returns:** Promise<T | null> — Validated data, migrated data, or null

**Example:**

```ts
const schema = {
  version: 2,
  validate: (data) => typeof data === "object" && data.userId,
  migrate: (oldData, oldVersion) => {
    if (oldVersion === 1) {
      return { ...oldData, role: "user" }; // Add role field
    }
    return null; // Can't migrate
  },
};

const data = await SecureStorage.getValidatedJSON(
  STORAGE_KEYS.USER_DATA,
  schema,
);
// Returns: Validated/migrated data or null if migration failed
```

**Behavior:**

- Validates against schema
- If valid: returns data
- If invalid and migration available: attempts migration, updates storage, returns migrated data
- If invalid and no migration: clears entry and returns null
- Logs all validation/migration events

#### `SecureStorage.setVersionedJSON<T>(key, value, version): Promise<void>`

Store a versioned JSON entry with schema version.

**Parameters:**

- `key`: string — Storage key
- `value`: T — Data to store
- `version`: number — Schema version (usually from schema.version)

**Returns:** Promise<void>

**Example:**

```ts
await SecureStorage.setVersionedJSON(
  STORAGE_KEYS.USER_DATA,
  { userId: "123", role: "user" },
  2, // version
);
```

---

### FastCache

High-performance, ephemeral cache for session-specific and frequently-accessed data.

#### `FastCache.set(key, value, ttl?): Promise<void>`

Store a value in fast cache.

**Parameters:**

- `key`: string — Cache key (pattern: `query_cache_*`)
- `value`: string — Value to cache
- `ttl?`: number — Time-to-live in milliseconds (optional)

**Returns:** Promise<void>

**Example:**

```ts
import { FastCache } from "@/lib/storage";

await FastCache.set("query_cache_worlds:user:current", JSON.stringify(worlds));

// With TTL (expires after 5 minutes)
await FastCache.set("world_access_123", "true", 5 * 60 * 1000);
```

**Behavior:**

- Stores in sessionStorage (web) or AsyncStorage (native)
- Unencrypted (fast, ephemeral data only)
- Monitors quota; warns if approaching limit

#### `FastCache.get(key): Promise<string | null>`

Retrieve a value from fast cache.

**Parameters:**

- `key`: string — Cache key

**Returns:** Promise<string | null> — Value or null if expired/not found

**Example:**

```ts
const cached = await FastCache.get("query_cache_worlds:user:current");
// Returns: JSON string or null
```

#### `FastCache.remove(key): Promise<void>`

Remove a value from fast cache.

**Parameters:**

- `key`: string — Cache key

**Returns:** Promise<void>

#### `FastCache.clear(): Promise<void>`

Clear all fast cache entries.

**Returns:** Promise<void>

#### `FastCache.getStats(): StorageStats`

Get cache statistics (item count, estimated size, quota percentage).

**Returns:** StorageStats

```ts
{
  itemCount: number;
  estimatedSize: number; // in bytes
  quotaPercentage: number; // 0-100
}
```

**Example:**

```ts
const stats = await FastCache.getStats();
if (stats.quotaPercentage > 80) {
  logger.warn("storage", "FastCache quota 80% full");
}
```

---

### Cache Versioning

Schema validation and migration for stored data.

#### `validateCacheEntry<T>(entry, schema): CacheValidationResult`

Validate a cache entry against a schema.

**Parameters:**

- `entry`: unknown — Cached entry
- `schema`: CacheSchema<T> — Validation schema

**Returns:** CacheValidationResult

```ts
{
  valid: boolean;
  reason?: 'version_mismatch' | 'parse_error' | 'schema_invalid' | 'missing_fields';
  oldVersion?: number;
  currentVersion?: number;
  shouldMigrate?: boolean;
  shouldReset?: boolean;
}
```

**Example:**

```ts
import { validateCacheEntry } from "@/lib/storage/cache-versioning";

const validation = validateCacheEntry(storedData, schema);
if (!validation.valid && validation.shouldMigrate) {
  // Attempt migration
}
```

#### `handleCacheMigration<T>(entry, schema): T | null`

Migrate a cache entry from old version to new version.

**Parameters:**

- `entry`: VersionedCacheEntry — Cached entry with version
- `schema`: CacheSchema<T> — Schema with migrate function

**Returns:** T | null — Migrated data or null if migration failed

**Example:**

```ts
import { handleCacheMigration } from "@/lib/storage/cache-versioning";

const migrated = handleCacheMigration(oldEntry, newSchema);
if (migrated) {
  await SecureStorage.setVersionedJSON(key, migrated, newSchema.version);
}
```

---

### Error Handling Utilities

Graceful error handling for all storage operations.

#### `safeStorageSet(options): Promise<StorageGracefulResult<void>>`

Safe storage set with fallback and error handling.

**Parameters:**

- `options`: StorageOperationOptions
  - `operation`: 'set'
  - `key`: string
  - `value`: string
  - `fallbackValue?`: any
  - `onError?`: (error: StorageErrorInfo) => void
  - `retry?`: boolean
  - `timeout?`: number

**Returns:** Promise<StorageGracefulResult<void>>

```ts
{
  success: boolean;
  error?: StorageErrorInfo;
  fallback?: any;
}
```

**Example:**

```ts
import { safeStorageSet } from "@/lib/storage";

const result = await safeStorageSet({
  operation: "set",
  key: STORAGE_KEYS.USER_DATA,
  value: JSON.stringify(userData),
  fallbackValue: "{}",
  onError: (err) => logger.error("storage", "Failed to save user data:", err),
});

if (!result.success) {
  showErrorNotification("Failed to save preferences");
}
```

#### `safeStorageGet(options): Promise<StorageGracefulResult<string>>`

Safe storage get with fallback.

**Parameters:** Same as `safeStorageSet` but with `operation: 'get'`

**Returns:** Promise<StorageGracefulResult<string>>

#### `batchStorageOperation(operations): Promise<BatchStorageResult>`

Batch multiple storage operations with partial failure handling.

**Parameters:**

- `operations`: Array of { operation, key, value?, ... }

**Returns:** BatchStorageResult

```ts
{
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  errors: StorageErrorInfo[];
}
```

**Example:**

```ts
import { batchStorageOperation } from "@/lib/storage";

const result = await batchStorageOperation([
  { operation: "set", key: STORAGE_KEYS.USER_DATA, value: "..." },
  { operation: "set", key: STORAGE_KEYS.CONNECTED_WORLDS, value: "..." },
  { operation: "set", key: STORAGE_KEYS.THEME_PREFERENCE, value: "dark" },
]);

if (result.failed > 0) {
  logger.warn("storage", `${result.failed} operations failed in batch`);
}
```

---

### World Access Cache

Helpers for syncing world access flags after mutations.

#### `worldAccessCache.updateAccessFlag(worldId, hasAccess, source): Promise<void>`

Update world access flag and metadata.

**Parameters:**

- `worldId`: string — World identifier
- `hasAccess`: boolean — Whether user has access
- `source`: 'create' | 'add' | 'remove' | 'delete' — Mutation source

**Returns:** Promise<void> (never throws)

**Example:**

```ts
import { worldAccessCache } from "@/lib/storage";

// After user creates a world
await worldAccessCache.updateAccessFlag(worldId, true, "create");

// After user removes access
await worldAccessCache.updateAccessFlag(worldId, false, "remove");
```

**Behavior:**

- Non-throwing; logs errors instead
- Updates both access flag and metadata (timestamp, source)
- Used by auth-state after DB mutations

#### `worldAccessCache.clearWorldAccess(worldId): Promise<void>`

Clear all access flags and metadata for a world.

**Parameters:**

- `worldId`: string — World identifier

**Returns:** Promise<void> (never throws)

---

## Error Handling & Edge Cases

### Quota Exceeded

- **Behavior:** `SecureStorage` and `FastCache` both monitor quota and fail gracefully when full.
- **FastCache quota:** 5MB (configurable). When exceeded, logs warning and returns null on get.
- **localStorage quota:** Browser-specific (typically 5-10MB). SecureStorage catches `QuotaExceededError` and returns gracefully.
- **Recovery:** Manual cleanup by user (clear cache, remove unused keys) or automatic trimming of oldest entries.

**Example:**

```ts
const result = await safeStorageSet({
  operation: "set",
  key: STORAGE_KEYS.USER_DATA,
  value: data,
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
- **Logging:** All corruption detected is logged with category `'storage'` and level `'warn'` or `'error'`.

**Example:**

```ts
// If stored data is corrupted JSON:
const data = await SecureStorage.getJSON(key);
// Returns: null, logs warning about JSON parse error

// If version mismatch:
const data = await SecureStorage.getValidatedJSON(key, schema);
// Attempts migration, clears entry if migration fails, returns null
```

### Version Mismatch

- **Trigger:** `CURRENT_CACHE_VERSION` incremented or schema.version changed.
- **Detection:** On load via `validateCacheEntry()` or `getValidatedJSON()`.
- **Resolution:**
  - If schema provides `migrate`: Attempts migration, updates storage with migrated data
  - If no migration: Clears entry and returns null
- **User impact:** Transparent; old preferences are lost (migration should provide defaults)

**Example:**

```ts
// Schema version bumped from 1 to 2
const schema = { version: 2, validate: ..., migrate: (old) => ({ ...old, newField: "default" }) };

// Stored data is version 1
const data = await SecureStorage.getValidatedJSON(key, schema);
// Automatically migrates, returns: { ...oldData, newField: "default" }
```

### Platform-Specific Failures

- **Web:** localStorage might be disabled, in private mode, or full. SecureStorage catches and logs.
- **Native (iOS):** expo-secure-store might fail if device is locked. AsyncStorage is fallback.
- **Desktop (Electron):** localStorage works like web. EncryptedStorage uses same logic.
- **Behavior:** All platform failures are caught, logged, and gracefully degrade to null/fallback.

**Example:**

```ts
// On iOS with device locked:
const data = await SecureStorage.getItem(key);
// Returns: null, logs error about secure store access failure

// Graceful degradation:
const prefs = (await SecureStorage.getJSON(key)) ?? { theme: "light" };
// Uses default if storage fails
```

### Encryption/Decryption Errors

- **Trigger:** Invalid cipher data, corrupted encryption metadata, wrong encryption key (should not happen).
- **Behavior:** Caught during `getItem()` or `getJSON()`, logged, returns null/graceful default.
- **Security:** Errors never leak key material or plaintext in logs.

### Stale World Access Cache

- **Trigger:** World access flags in storage are 2+ hours old.
- **Detection:** Metadata timestamp compared against current time in `verifyWorldAccessWithDatabase()`.
- **Resolution:** Automatic refresh from Supabase; fresh data cached locally.
- **User impact:** Transparent; brief delay on sensitive screens (settings).

---

## Performance & Scalability Analysis

### SecureStorage Operations

#### `setItem()` / `getItem()` Cost

- **Encrypted backend (localStorage):** ~2-5ms (includes AES-256-CTR encryption/decryption, HMAC)
- **Ephemeral backend (sessionStorage):** ~100-500µs (unencrypted, synchronous)
- **Batch operations:** Linear; ~2-5ms per encrypted item

**Recommendation:** Safe for moderate-frequency writes (< 100/sec). For high-frequency updates, use FastCache.

#### `setJSON()` / `getJSON()` Cost

- JSON serialization: ~1-2ms per 100KB of data
- JSON parsing: ~1-2ms per 100KB of data
- Encryption overhead: ~2-5ms (constant, regardless of size)
- **Total for 10KB object:** ~4-7ms

**Recommendation:** Suitable for app state snapshots. Not suitable for streaming large datasets.

### FastCache Operations

#### `set()` / `get()` Cost

- **sessionStorage (web):** ~50-200µs (synchronous, no encryption)
- **AsyncStorage (native):** ~1-5ms (async, no encryption)
- **TTL expiration check:** ~100ns per entry
- **Quota monitoring:** ~500ns (single calculation)

**Recommendation:** Can be called in render loops on web. Use for high-frequency cache updates.

### Encryption Overhead

#### AES-256-CTR + HMAC-SHA256

- **Encryption cost:** ~1µs per KB of data
- **Decryption cost:** ~1µs per KB of data
- **Key derivation (on first use):** ~50-100ms (amortized on startup)

**Scalability:** Encryption is the dominant cost. For large objects (>1MB), consider:

- Splitting into multiple keys
- Using FastCache + lazy decryption
- Compressing before encryption (add ~1-2ms but often saves 50-70%)

### Storage Quota Management

#### Browser localStorage Quota

- **Typical limit:** 5-10MB per origin
- **Actual available:** Variable (OS, browser, user settings)
- **Checking quota:** O(1) (browser API call)
- **Cleanup strategy:** LRU (least recently used) eviction when quota exceeded

#### SessionStorage Quota

- **Typical limit:** Same as localStorage (5-10MB)
- **Lifecycle:** Cleared on session end (browser close/tab close)
- **Monitoring:** `FastCache.getStats()` returns current usage

### Cache Versioning Overhead

#### `validateCacheEntry()` Cost

- **Valid schema:** ~100ns (version check + validation function)
- **Invalid schema:** ~1-2ms (error handling, logging)

#### `handleCacheMigration()` Cost

- **Simple migration:** ~1-2ms (object copying, field additions)
- **Complex migration:** Depends on migrate function (~10-100ms for large datasets)

**Recommendation:** Run versioning during app initialization or batch operations, not in hot paths.

### Memory Usage

#### SecureStorage

- **Per-key overhead:** ~100-200 bytes (metadata, encryption state)
- **Typical app:** 20-50 keys = 2-10KB overhead

#### FastCache

- **In-memory cache:** ~1-2MB typical (query results, session data)
- **Memory vs. quota:** Monitor with `getStats()` to avoid bloat

#### EncryptedStorage

- **Key material:** ~32 bytes (AES key)
- **Cipher instances:** Reused, minimal memory

### Scalability Limits

- **Total keys stored:** Thousands (limited by browser quota, not by code)
- **Average key size:** Recommend < 100KB per key (large objects should be split)
- **Concurrent operations:** Safe; all operations are serialized internally
- **Performance degradation:** Linear with number of keys (O(n) for iteration, O(1) for access)

- **All methods async** for cross-platform consistency
- **FastCache** for high-frequency, ephemeral data
- **EncryptedStorage** is optimized for batch operations
- **No blocking UI**: All storage is non-blocking
- **Quota monitoring**: FastCache and SecureStorage monitor usage and warn on quota approach
- **Batch operations**: Supported for efficient multi-key updates

---

## Related Modules & Integration Points

- `lib/auth/encrypted-storage` – Encryption implementation
- `lib/cache` – QueryCache (uses FastCache for ephemeral data)
- `lib/network` – Network error handling (complements storage error handling)
- `lib/database` – Uses SecureStorage for persistent user/world data
- `lib/offline` – Uses SecureStorage for offline mutation queue

---

## File Breakdown

| File                      | Purpose                                      | Lines |
| ------------------------- | -------------------------------------------- | ----- |
| SecureStorage.ts          | Main API, backend routing, encryption        | ~400  |
| FastCache.ts              | In-memory/session cache                      | ~100  |
| cache-versioning.ts       | Versioning, migration, schema validation     | ~200  |
| storage-config.ts         | Key routing, backend config                  | ~140  |
| storage-error-handling.ts | Error handling, graceful fallback            | ~500  |
| world-access-cache.ts     | World access flag sync, non-throwing helpers | ~80   |
| update-storage-cache.ts   | Cache update orchestration (see file)        | ~50   |
| index.ts                  | Barrel export, key constants                 | ~100  |

---

## Testing

### Manual Testing Checklist

- [ ] Store and retrieve string and JSON values
- [ ] Remove and clear keys
- [ ] Simulate quota exceeded (dev tools) and verify fallback
- [ ] Simulate corrupted data and verify reset/migration
- [ ] Test version mismatch and migration
- [ ] Test world access cache update and removal
- [ ] Test error logging on all failures
- [ ] Test batch operations and fallback logic

### Automated Testing (future)

- [ ] Unit tests for SecureStorage, FastCache, error handling
- [ ] Integration tests for schema migration and cache refresh

---

## Future Enhancements

- **Encrypted batch operations** – Optimize for large data sets (bulk import/export)
- **Key rotation** – Support for rotating encryption keys without data loss
- **Remote backup/restore** – Optional encrypted cloud backup for user data
- **Selective cache persistence** – Allow some FastCache entries to persist across sessions
- **Storage usage analytics** – Track storage usage and quota for debugging
- **Admin UI for storage inspection** – Debug tool for viewing/editing storage keys (dev only)

---
