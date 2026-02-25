# SecureStorage: Cross-Platform Encrypted Storage

SecureStorage is the centralized storage system for all app data across web, iOS, Android, and desktop platforms. All data is automatically encrypted using AES-CTR encryption for security.

## Overview

**What it does:**
- Provides a **single, consistent API** for storing and retrieving encrypted data
- Works seamlessly on **all platforms** (web, iOS, Android, desktop)
- **Automatically handles** platform-specific storage backends
- **Encrypts all data** to protect sensitive information

**When to use it:**
- Storing any app data that persists between sessions (connected worlds, user preferences, cache, etc.)
- Any data that a user could theoretically edit to bypass a check

**When NOT to use it:**
- Temporary in-memory state (use React state)
- Runtime-only configuration (use context/hooks)

## Quick Start

### Basic String Storage

```typescript
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';

// Store a value
await SecureStorage.setItem(STORAGE_KEYS.USER_DATA, 'some-sensitive-value');

// Retrieve a value (returns null if not found or on error)
const value = await SecureStorage.getItem(STORAGE_KEYS.USER_DATA);

// Remove a value
await SecureStorage.removeItem(STORAGE_KEYS.USER_DATA);
```

### JSON Storage (Most Common)

```typescript
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';

// Store JSON objects
interface UserPrefs {
  theme: 'light' | 'dark';
  language: string;
}

const prefs: UserPrefs = { theme: 'dark', language: 'en' };
await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, prefs);

// Retrieve JSON (automatically parsed, returns null if not found)
const retrieved = await SecureStorage.getJSON<UserPrefs>(STORAGE_KEYS.USER_PREFERENCES);
```

### Using in Contexts/Hooks

```typescript
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
import { useEffect, useState } from 'react';

export function useConnectedWorlds() {
  const [worldIds, setWorldIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from storage on mount
  useEffect(() => {
    async function load() {
      try {
        const ids = await SecureStorage.getJSON<string[]>(STORAGE_KEYS.CONNECTED_WORLDS);
        setWorldIds(ids || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Save to storage when updated
  const updateWorlds = async (newIds: string[]) => {
    setWorldIds(newIds);
    await SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, newIds);
  };

  return { worldIds, loading, updateWorlds };
}
```

## API Reference

### `SecureStorage.setItem(key: string, value: string): Promise<void>`

Store an encrypted string value.

```typescript
await SecureStorage.setItem('my-key', 'my-value');
```

### `SecureStorage.getItem(key: string): Promise<string | null>`

Retrieve an encrypted string value. Returns `null` if key doesn't exist or on error.

```typescript
const value = await SecureStorage.getItem('my-key');
```

### `SecureStorage.removeItem(key: string): Promise<void>`

Remove a value from storage.

```typescript
await SecureStorage.removeItem('my-key');
```

### `SecureStorage.setJSON<T>(key: string, value: T): Promise<void>`

Store an encrypted JSON object. Automatically stringifies the value.

```typescript
await SecureStorage.setJSON('config', { theme: 'dark', notifications: true });
```

### `SecureStorage.getJSON<T>(key: string): Promise<T | null>`

Retrieve and parse an encrypted JSON object. Returns `null` if key doesn't exist, can't be parsed, or on error.

```typescript
const config = await SecureStorage.getJSON<MyConfigType>('config');
```

### `SecureStorage.hasItem(key: string): Promise<boolean>`

Check if a key exists in storage.

```typescript
if (await SecureStorage.hasItem('user-data')) {
  // Key exists
}
```

### `SecureStorage.clear(): Promise<void>`

Clear all storage (use with caution, typically for logout).

```typescript
await SecureStorage.clear();
```

### `SecureStorage.getAllKeys(): Promise<string[]>`

Get all keys in storage (for debugging/migration). Platform-aware.

```typescript
const keys = await SecureStorage.getAllKeys();
```

## Storage Keys

Always use `STORAGE_KEYS` constants instead of hardcoded strings. Keys are namespaced with `dnd:` prefix for organization.

```typescript
import { STORAGE_KEYS } from '@/lib/storage';

// Available keys:
STORAGE_KEYS.CONNECTED_WORLDS        // dnd:app:connected_worlds
STORAGE_KEYS.HAS_ACCOUNT             // dnd:auth:has_account
STORAGE_KEYS.USER_DATA               // dnd:auth:user_data
STORAGE_KEYS.USER_DATA_TIMESTAMP     // dnd:auth:user_data_timestamp
STORAGE_KEYS.THEME_PREFERENCE        // dnd:user:theme
STORAGE_KEYS.SCALE_PREFERENCE        // dnd:user:scale
STORAGE_KEYS.DEV_MODE                // dnd:dev:mode
```

**Adding new keys:**

1. Add to `STORAGE_KEYS` object in `lib/storage/index.ts`
2. Use the constant everywhere (never hardcode)

```typescript
// In lib/storage/index.ts
export const STORAGE_KEYS = {
  // ... existing keys
  MY_NEW_KEY: 'dnd:domain:my_new_key',
} as const;
```

## How It Works (Platform Details)

### Web
- **Storage backend:** `localStorage` (synchronous but wrapped in async API)
- **Encryption:** AES-CTR with 256-bit key stored in fixed location
- **Access:** Via `window.localStorage`

### iOS/Android
- **Storage backend:** `expo-secure-store` (for encryption keys) + `AsyncStorage` (for encrypted data)
- **Encryption:** AES-CTR with 256-bit key stored in platform secure keychain
- **Access:** Via `@react-native-async-storage/async-storage`

### Desktop (Future)
- **Storage backend:** Electron secure storage or custom file storage
- **Encryption:** AES-CTR (same as other platforms)
- **Access:** Via Electron main process

**Key point:** All platforms use the same AES-CTR encryption and async API. You don't need to worry about platform differences—SecureStorage handles it.

## Error Handling

SecureStorage fails gracefully:

- **Get operations return `null`** if the key doesn't exist, can't be decrypted, or on any error
- **Set operations throw** so you know if storage failed
- **All errors are logged** via the logger (debug/warn/error)

```typescript
try {
  await SecureStorage.setItem('key', 'value');
} catch (error) {
  // Handle storage failure (rare, but possible if storage quota exceeded)
  logger.catogery("storage").error('Failed to save:', error);
}

// Safe to call - returns null on any error
const value = await SecureStorage.getItem('key');
```

## Best Practices

### 1. **Always use STORAGE_KEYS constants**

```typescript
// ✅ Good
await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, prefs);

// ❌ Avoid
await SecureStorage.setJSON('userPrefs', prefs);
```

### 2. **Use JSON helpers for complex data**

```typescript
// ✅ Good - automatic JSON handling
await SecureStorage.setJSON('config', { theme: 'dark' });

// ❌ Less ideal - manual JSON stringify
await SecureStorage.setItem('config', JSON.stringify({ theme: 'dark' }));
```

### 3. **Handle async/await in effects**

```typescript
// ✅ Good - async effect
useEffect(() => {
  async function load() {
    const data = await SecureStorage.getJSON('key');
    setData(data);
  }
  load();
}, []);

// ❌ Wrong - can't use await in effect directly
useEffect(async () => {
  const data = await SecureStorage.getJSON('key');
}, []);
```

### 4. **Load during bootstrap if performance-critical**

For data needed immediately on app startup (like auth tokens), consider loading in `use-app-bootstrap.tsx`:

```typescript
// In use-app-bootstrap.tsx
async function bootstrap() {
  // Load critical data upfront
  const authToken = await SecureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  // Use it for initialization
}
```

### 5. **Provide defaults gracefully**

```typescript
const worldIds = (await SecureStorage.getJSON<string[]>(STORAGE_KEYS.CONNECTED_WORLDS)) || [];
```

## Adding New Storage Keys

When you need to store something new:

1. **Add the key to `STORAGE_KEYS`** in `lib/storage/index.ts`:

```typescript
export const STORAGE_KEYS = {
  // ... existing
  MY_FEATURE_DATA: 'dnd:feature:my_feature_data',
} as const;
```

2. **Import and use it**:

```typescript
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';

await SecureStorage.setJSON(STORAGE_KEYS.MY_FEATURE_DATA, data);
```

## Debugging

### View all stored keys

```typescript
const keys = await SecureStorage.getAllKeys();
console.log('Stored keys:', keys);
```

### Clear all storage (⚠️ development only)

```typescript
// Warning: This clears ALL encrypted storage!
if (__DEV__) {
  await SecureStorage.clear();
}
```

### Check storage logs

SecureStorage logs all operations:
- **Debug:** getItem, setItem, removeItem calls
- **Warn:** Errors on retrieval (key not found is debug, not warning)
- **Error:** Storage failures, initialization errors

See logs in console (web) or Xcode/Android Studio (native).

## Common Patterns

### Connected Worlds Cache

```typescript
// Store list of worlds user has access to
const worldIds = ['world-1', 'world-2'];
await SecureStorage.setJSON(STORAGE_KEYS.CONNECTED_WORLDS, worldIds);

// Later, check if user can access a world
const cached = await SecureStorage.getJSON<string[]>(STORAGE_KEYS.CONNECTED_WORLDS);
if (cached?.includes(worldId)) {
  // Has access
}
```

### User Preferences

```typescript
interface UserPrefs {
  theme: 'light' | 'dark';
  language: 'en' | 'es' | 'fr';
  notifications: boolean;
}

// Save
await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, prefs);

// Load
const prefs = await SecureStorage.getJSON<UserPrefs>(STORAGE_KEYS.USER_PREFERENCES);
```

### Logout (Clear sensitive data)

```typescript
async function handleLogout() {
  // Remove all app data
  await SecureStorage.clear();
  
  // Or remove specific keys
  await SecureStorage.removeItem(STORAGE_KEYS.USER_DATA);
  await SecureStorage.removeItem(STORAGE_KEYS.CONNECTED_WORLDS);
}
```

## FAQ

**Q: Is data really encrypted?**
A: Yes. All data is encrypted with AES-CTR using 256-bit keys before being stored. Web uses a consistent key, native uses platform keychains for better security.

**Q: Can I use it during app initialization?**
A: Yes, but be aware it's async. For critical startup data, load in `use-app-bootstrap.tsx` during the bootstrap phase so UI waits for it.

**Q: What if storage fails?**
A: Get operations return `null`. Set operations throw. Both are logged. Plan for `null` returns gracefully.

**Q: Can I export/backup data?**
A: `getAllKeys()` gets key names. To backup, call `getJSON()` on each key and store externally (or just clear on logout).

**Q: How much can I store?**
A: Web has ~5-10MB, native has device-dependent limits (usually hundreds of MB). Use reasonable amounts.

**Q: Can I disable encryption for development?**
A: Not currently. All data is always encrypted. This is by design for consistency.
