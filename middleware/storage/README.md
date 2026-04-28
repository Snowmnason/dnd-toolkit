# Storage Middleware Module

Advanced storage middleware layer providing query caching, compression, and intelligent invalidation patterns for React Native and web applications. Bridges application logic with low-level storage systems while adding caching, optimization, and data management capabilities.

## When to Use This Module

**Use this module for:**

- Caching expensive API calls and database queries with advanced invalidation
- Managing complex cache invalidation scenarios (parent-child relationships, conditional updates)
- Implementing optimistic updates with rollback capabilities
- Automatic storage optimization and compression
- Debouncing rapid cache updates (user typing, real-time data)
- Platform-aware cache size management with automatic LRU eviction
- Cache subscriptions for reactive UI updates

**Do NOT use this module for:**

- Simple key-value storage (use `SecureStorage` or `FastCache` directly)
- Analytics or event data (use dedicated analytics system)
- Real-time data streams (use WebSocket/SSE connections)
- Large binary data (use dedicated file storage)
- Session-only data (use React state or `FastCache`)

## Architecture & Data Flow

```
Application Code
    ↓
Storage Middleware (lib/middleware/storage/)
├── QueryCache Class (Advanced caching with invalidation patterns)
│   ↓
│   QueryCacheInternals (shared state + LRU eviction)
│   ↓
│   Modular Operations:
│   ├── query-cache-core.ts      (get/set/dedupe/optimistic/subscriptions)
│   ├── query-cache-invalidation.ts (pattern/tag/age-based invalidation)
│   ├── query-cache-persistence.ts   (persistence-level filtering)
│   └── query-cache-stats.ts         (stats/eviction/manual cleanup)
│   ↓
│   CacheInvalidationOrchestrator (system/storage/cache-invalidation/)
│   ↓
│   Specialized Managers:
│   ├── CascadeManager           (parent → child dependencies)
│   ├── ConditionalFilter        (predicate-based filtering)
│   ├── TransactionCoordinator   (atomic batch operations)
│   ├── DeferredQueue            (scheduled invalidations)
│   └── LRUEvictionManager       (capacity management)
│
├── Compression Middleware (automatic storage optimization)
└── Storage Services (analytics, performance, secure storage bridging)
    ↓
System Storage Layer (system/storage/)
```

**Key Design Principles:**

- **Modular Architecture**: Each invalidation pattern is isolated in dedicated managers
- **Centralized Orchestration**: Single entry point validates inputs and coordinates operations
- **Platform-Aware Capacity**: Mobile (5-10MB) vs desktop (50+MB) limits with automatic eviction
- **Transactional Safety**: Atomic operations with snapshot/restore for consistency
- **Performance Monitoring**: Built-in stats tracking and capacity warnings
- **Transparent Optimization**: Compression and optimization happen automatically

## API Reference

### Query Cache (Primary API)

#### `QueryCache.get<T>(key: string): Promise<T | null>`

Retrieve cached data by key.

```typescript
const worlds = await QueryCache.get<World[]>('worlds:list');
// Returns: cached data or null if not found/expired
```

#### `QueryCache.set<T>(key: string, data: T, options?): Promise<void>`

Store data in cache with optional metadata.

**Parameters:**
- `key`: string — Unique cache key
- `data`: T — Data to cache
- `options`: `{ staleTime?: number, cacheTime?: number, tags?: string[] }` — Cache options

```typescript
await QueryCache.set('worlds:user:123', worldsData, {
  staleTime: 5 * 60 * 1000, // 5 minutes
  tags: ['worlds', 'user:123']
});
```

#### `QueryCache.invalidate(pattern, options?): Promise<void>`

Invalidate cache entries matching a pattern.

```typescript
// Invalidate specific key
await QueryCache.invalidate('worlds:user:123');

// Invalidate by pattern (supports glob)
await QueryCache.invalidate('worlds:user:*');
```

#### `QueryCache.clear(): Promise<void>`

Clear all cache entries.

### Advanced Invalidation Patterns

#### Cascading Invalidation

Define parent-child relationships where invalidating a parent automatically invalidates children.

```typescript
// Register cascade dependency
await QueryCache.registerCascade('world:123', [
  'world:123:members',
  'world:123:notes',
  'world:123:characters'
]);

// Invalidating parent cascades to children
await QueryCache.invalidate('world:123');
// → Automatically invalidates members, notes, characters
```

#### Conditional Invalidation

Invalidate only entries matching a predicate function.

```typescript
// Invalidate worlds with version < current
await QueryCache.invalidateIfMatches(
  'world:*',
  (key, entry) => entry.version < currentVersion
);
```

#### Transactional Invalidation

Execute multiple invalidations atomically with rollback on failure.

```typescript
const result = await QueryCache.transaction(async (tx) => {
  tx.invalidate('world:123');
  tx.invalidateMany(['members:world:123', 'notes:world:123']);

  // If any operation fails, all are rolled back
});

// Result: { success: true, invalidatedCount: 3, ... }
```

#### Deferred Invalidation

Schedule invalidations with delay for debouncing.

```typescript
// Debounce search invalidation
const { cancelFn } = await QueryCache.invalidateAfter(500, ['search:*']);

// Cancel if user types again
cancelFn();
```

### Capacity Management

#### `QueryCache.getLRUStats(): Promise<LRUStats>`

Get current LRU statistics.

```typescript
const stats = await QueryCache.getLRUStats();
// Returns: { totalSize: 2048576, entryCount: 45, ... }
```

#### `QueryCache.getLRUCapacityStats(): Promise<CapacityStats>`

Get capacity limits and usage.

```typescript
const capacity = await QueryCache.getLRUCapacityStats();
// Returns: { hardMaxBytes: 10485760, currentSize: 2048576, approaching: false }
```

#### `QueryCache.isApproachingCapacity(): Promise<boolean>`

Check if cache is near capacity limit.

```typescript
if (await QueryCache.isApproachingCapacity()) {
  // Trigger cleanup or warn user
}
```

### Compression API

#### `getCompressionStats(): CompressionStats`

Get compression effectiveness statistics.

```typescript
import { getCompressionStats } from "@/middleware/storage/compression";

const stats = getCompressionStats();
// Returns: totalOperations, bytesCompressed, bytesSaved, avgCompressionRatio
```

#### `compressData(data, options?): Promise<CompressedData>`

Manually compress data for storage.

```typescript
import { compressData } from "@/middleware/storage/compression";

const compressed = await compressData(largeJsonString, { algorithm: 'gzip' });
```

### Storage Services

#### Analytics Storage Service

```typescript
import { analyticsStorageService } from "@/middleware/storage";

await analyticsStorageService.storeEvent('user_action', eventData);
```

#### Performance Storage Service

```typescript
import { performanceStorageService } from "@/middleware/storage";

await performanceStorageService.recordMetric('api_response_time', duration);
```

## Dependencies

### External Packages

- **None** — Pure TypeScript implementation

### Internal Dependencies

- **`system/storage/cache-invalidation/`** — Advanced invalidation managers
- **`system/storage/`** — Low-level storage backends
- **`type-definitions/cache-invalidation.ts`** — Shared type definitions
- **`lib/utils/logger`** — Structured logging
- **`config/appsettings.json`** — Capacity and compression configuration

## Error Handling & Edge Cases

### Validation Errors

All invalidation operations validate inputs and throw `CacheInvalidationError`:

```typescript
try {
  await QueryCache.registerCascade('', []); // Invalid
} catch (error) {
  if (error instanceof CacheInvalidationError) {
    // Handle: INVALID_PARAMS, EXECUTION_FAILED, VALIDATION_FAILED
  }
}
```

### Transaction Failures

Transactions automatically rollback on any failure:

```typescript
const result = await QueryCache.transaction(async (tx) => {
  tx.invalidate('world:123');
  throw new Error('Network failure'); // Transaction fails
});
// result.success = false, cache restored to pre-transaction state
```

### Capacity Limits

Automatic eviction when approaching limits:

```typescript
// Configured in appsettings.json
{
  "cacheCapacity": {
    "hardMaxBytes": 10485760,     // 10MB mobile
    "softThreshold": 0.9,         // Evict at 90%
    "targetAfterEviction": 0.7    // Target 70% after cleanup
  }
}
```

### Circular Dependencies

Cascade registration detects and prevents infinite loops:

```typescript
await QueryCache.registerCascade('A', ['B']);
await QueryCache.registerCascade('B', ['A']); // Throws CacheInvalidationError
```

### Compression Failures

Compression errors are handled gracefully with fallbacks:

```typescript
// Automatic fallback to uncompressed storage
const result = await safeStorageSet({
  operation: "set",
  key,
  value,
  onError: (err) => {
    if (err.message.includes("compression")) {
      // Handle compression failure
    }
  }
});
```

## Performance Notes

### Operation Costs

- **get()**: ~1-5ms (memory lookup + deserialization)
- **set()**: ~2-10ms (serialization + LRU tracking)
- **invalidate()**: ~5-50ms (pattern matching + cascade resolution)
- **transaction()**: ~10-100ms (snapshot + batch execution)
- **LRU eviction**: ~50-200ms (size calculation + selective removal)
- **Compression**: ~5-20µs per KB (depends on data compressibility)

### Capacity Management

- **Memory limits**: Mobile (5-10MB), Desktop (50-100MB)
- **Eviction threshold**: 90% of capacity triggers cleanup
- **Target after eviction**: 70% to prevent immediate re-eviction
- **Entry size tracking**: Automatic calculation for all operations

### Compression Performance

- **Gzip compression**: ~5-20µs per KB (depends on data compressibility)
- **Deflate compression**: ~3-15µs per KB (faster but less compression)
- **Threshold check**: ~50ns (negligible)
- **Memory impact**: 2-3x temporary memory during compression/decompression
- **Typical savings**: 60-80% for JSON data, 20-40% for already-compressed data

### Optimization Strategies

- **Batch operations**: Use transactions for multiple invalidations
- **Pattern specificity**: Prefer specific patterns over wildcards
- **Capacity monitoring**: Check `isApproachingCapacity()` before large operations
- **Deferred scheduling**: Use for debouncing rapid updates
- **Enable compression**: For JSON/text data >1KB, disable for pre-compressed binary data

## File Breakdown

| File/Directory | Purpose |
|----------------|---------|
| `index.ts` | Barrel exports for all storage middleware |
| `helpers/` | Query cache implementation |
| `├── query-cache.ts` | Main QueryCache class with method orchestration |
| `├── internals.ts` | Shared state management and LRU eviction logic |
| `├── query-cache-core.ts` | get/set/dedupe/optimistic updates/subscriptions |
| `├── query-cache-invalidation.ts` | Pattern/tag/age-based invalidation logic |
| `├── query-cache-persistence.ts` | Persistence-level filtering and resolution |
| `└── query-cache-stats.ts` | Statistics tracking and manual eviction |
| `compression/` | Automatic compression middleware |
| `analytics-storage-service.ts` | Analytics event storage bridging |
| `performance-storage-service.ts` | Performance metrics storage |
| `secure-storage-service.ts` | Secure storage bridging |
| `storage-service.ts` | General storage service utilities |

## Testing

Unit tests cover all invalidation patterns and edge cases:

```bash
npm run test -- __tests__/storage/cascade-manager.test.ts
npm run test -- __tests__/storage/conditional-filter.test.ts
npm run test -- __tests__/storage/transaction-coordinator.test.ts
npm run test -- __tests__/storage/deferred-queue.test.ts
npm run test -- __tests__/storage/lru-eviction.test.ts
npm run test -- __tests__/storage/query-cache.test.ts
npm run test -- __tests__/storage/compression-middleware.test.ts
```

Integration tests validate end-to-end scenarios with realistic data patterns.

## Future Enhancements

- **Cache compression**: Automatic compression for large entries (in progress)
- **Distributed invalidation**: Cross-device cache coordination
- **Predictive prefetching**: ML-based cache warming
- **Cache analytics**: Usage patterns and optimization suggestions
- **Hierarchical caching**: Multi-level cache with different TTLs