# lib/storage/cache

Infrastructure layer for caching backends. Contains low-level cache implementations that provide storage for higher-level caching systems like QueryCache.

## When to Use This Module

**Use this module if you need to:**

- Implement a new caching backend (ephemeral, persistent, distributed)
- Access low-level cache storage directly (FastCache, SecureStorage)
- Understand cache infrastructure architecture
- Extend caching capabilities with new storage types

**Do NOT use this module for:**

- High-level caching logic (use `lib/cache` QueryCache instead)
- General application data storage (use `lib/storage` instead)
- API response caching (use `lib/cache` instead)
- Real-time data (use `lib/realtime` instead)

## Architecture & Data Flow

```
Higher-Level Cache (lib/cache/QueryCache)
  ↓
Cache Backend Interface
  ↓
Storage Implementation (lib/storage/cache/*)
  ↓
Platform Storage (sessionStorage, AsyncStorage, etc.)
```

## Core Components

### FastCache

High-performance, unencrypted ephemeral cache for non-sensitive data.

**Platform Support:**
- **Web**: `sessionStorage` (synchronous, ~2-5ms access, cleared on session end)
- **Native**: `AsyncStorage` (asynchronous, ~5-10ms access)

**Performance:** 5-10x faster than SecureStorage due to no encryption overhead.

**Use Cases:**
- Query results and API cache (refetchable on demand)
- Non-sensitive user preferences
- Temporary session data

**Don't Use For:**
- Auth tokens, passwords, encryption keys
- Sensitive user data or permissions
- Any data requiring persistence or security

**Features:**
- Per-item TTL (time-to-live) support
- Storage quota monitoring (5MB limit)
- Prefix-based operations
- Batch operations for efficiency
- Automatic expiration cleanup
- Subscription system for cache changes

### SecureStorage

Encrypted persistent storage for sensitive data. Moved from `lib/storage/` for better organization.

**Platform Support:**
- **All Platforms**: AES-256-CTR encryption + HMAC-SHA256
- **Web**: `localStorage` (fallback with encryption)
- **Native**: `EncryptedStorage` or secure keychain

**Use Cases:**
- Authentication tokens
- User credentials
- Sensitive application data
- Encrypted persistent cache

**Features:**
- Automatic encryption/decryption
- Cross-platform secure storage
- Data classification enforcement
- Migration support for schema changes

## API Reference

### FastCache

```typescript
class FastCacheService {
  // Core operations
  setItem(key: string, value: string, ttl?: number): Promise<void>
  getItem(key: string): Promise<string | null>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>

  // Batch operations
  setItems(items: Record<string, string>): Promise<void>
  getItems(keys: string[]): Promise<Record<string, string | null>>

  // Prefix operations
  getItemsByPrefix(prefix: string): Promise<Record<string, string>>
  removeItemsByPrefix(prefix: string): Promise<void>

  // TTL management
  setTTL(key: string, ttl: number): Promise<void>
  getTTL(key: string): Promise<number | null>

  // Storage monitoring
  getStats(): Promise<StorageStats>
  getQuotaUsage(): Promise<number> // percentage

  // Subscriptions
  subscribe(key: string, callback: (data: any) => void): () => void
  unsubscribe(key: string, callback: (data: any) => void): void
}
```

### SecureStorage

```typescript
// Main API (from lib/storage/index.ts)
setItem(key: string, value: string): Promise<void>
getItem(key: string): Promise<string | null>
removeItem(key: string): Promise<void>
clear(): Promise<void>

// Classification-aware operations
setItemWithClassification(key: string, value: string, classification: DataClassification): Promise<void>
```

## Usage Examples

### FastCache Basic Operations

```typescript
import { FastCache } from '@/lib/storage/cache';

// Store with TTL (1 hour)
await FastCache.setItem('user-preferences', JSON.stringify(prefs), 60 * 60 * 1000);

// Retrieve
const prefs = JSON.parse(await FastCache.getItem('user-preferences') || '{}');

// Batch operations
await FastCache.setItems({
  'query:users': JSON.stringify(users),
  'query:posts': JSON.stringify(posts),
});
```

### FastCache Subscriptions

```typescript
import { FastCache } from '@/lib/storage/cache';

// Subscribe to cache changes
const unsubscribe = FastCache.subscribe('user-preferences', (newPrefs) => {
  console.log('Preferences updated:', newPrefs);
  // Update UI
});

// Later
unsubscribe();
```

### SecureStorage

```typescript
import { SecureStorage } from '@/lib/storage';

// Store sensitive data
await SecureStorage.setItem('auth-token', token);

// Retrieve
const token = await SecureStorage.getItem('auth-token');
```

## Data Classification

All storage operations respect data classification levels:

| Level | Storage | Encryption | Retention |
|-------|---------|------------|-----------|
| PUBLIC | FastCache | No | Session |
| NON_SENSITIVE | SecureStorage | Yes | Persistent |
| SENSITIVE | SecureStorage | Yes | On logout |
| PII | SecureStorage | Yes | On logout |

## Storage Stats & Monitoring

```typescript
import { FastCache } from '@/lib/storage/cache';

// Get storage statistics
const stats = await FastCache.getStats();
console.log(`Items: ${stats.itemCount}, Size: ${stats.estimatedSize} bytes`);

// Check quota usage
const usagePercent = await FastCache.getQuotaUsage();
if (usagePercent > 80) {
  console.warn('Cache quota usage high:', usagePercent + '%');
}
```

## Error Handling

Cache operations handle platform-specific failures gracefully:

```typescript
try {
  await FastCache.setItem('key', 'value');
} catch (error) {
  if (error.message.includes('quota')) {
    // Storage quota exceeded
  } else {
    // Platform-specific error
  }
}
```

## File Structure

```
lib/storage/cache/
├── index.ts                    # Barrel exports
├── FastCache.ts                # Ephemeral cache implementation
├── SecureStorage.ts            # Encrypted storage (moved from lib/storage/)
├── data-classification.ts      # Data sensitivity levels
├── privacy.ts                  # Privacy utilities
├── storage-error-handling.ts   # Error handling utilities
└── storage-health-monitor.ts   # Storage health monitoring
```

## Dependencies

- **Internal**: `lib/utils/logger`, `lib/config`, `lib/storage/storage-config`
- **External**: `@react-native-async-storage/async-storage`, `react-native`

## Future Enhancements

- Distributed cache support (Redis, etc.)
- Cache compression
- Advanced eviction policies (LRU, LFU)
- Cache warming strategies
- Metrics and monitoring
- Cross-device synchronization</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\lib\storage\cache\README.md