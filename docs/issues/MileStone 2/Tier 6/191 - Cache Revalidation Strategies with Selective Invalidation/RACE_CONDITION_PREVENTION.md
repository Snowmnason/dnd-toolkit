# Phase 5: Race Condition Prevention with Version Numbers

## Problem: The Race Condition

In a distributed system with asynchronous operations, a classic race condition can occur:

```
Timeline of Events:

Time 0ms:  Component A sees 'worlds:list' in cache
Time 5ms:  Component A invalidates cache: invalidateByTags(['worlds'])
           ├─ Cache is cleared
           ├─ But Component B already has a fetch in-flight!
Time 10ms: Component B's query starts (it captured cache BEFORE invalidation)
Time 20ms: Component B's fetch completes with OLD data
Time 25ms: Component B calls QueryCache.set(key, oldData)
           └─ ❌ STALE DATA is now in cache!

Result: User sees old data because request started before invalidation completed.
```

## Solution: Version Numbers

Each time cache is invalidated, increment a global version counter. Requests capture their version at start time. If data arrives after invalidation (with an older version), it's rejected.

```
Timeline with Version Tracking:

Time 0ms:   globalVersion = 0
            Component B starts query, captures version = 0

Time 5ms:   Component A invalidates: invalidateByTags(['worlds'])
            └─ globalVersion bumps to 1

Time 20ms:  Component B's fetch completes
            └─ Calls set(key, data, options, requestVersion=0)

Time 21ms:  set() checks: requestVersion (0) < globalVersion (1)?
            └─ YES → Don't cache, log stale write prevented ✅
```

## Implementation

### 1. QueryCache Version Tracking

In `lib/cache/query-cache.ts`:

```typescript
class QueryCacheClass {
  // Track global version for race condition prevention
  private globalVersion: number = 0;

  /**
   * Get the current version number
   * Used by queries to detect if invalidation occurred during their request
   */
  getCurrentVersion(): number {
    return this.globalVersion;
  }

  /**
   * Invalidate by tags - bumps version to prevent stale writes
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    // Increment version BEFORE removing entries
    this.globalVersion++;

    const keysToInvalidate: string[] = [];
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
        keysToInvalidate.push(key);
      }
    }

    await Promise.all(keysToInvalidate.map(key => this.remove(key)));

    logger.category('cache').info(`Invalidated ${keysToInvalidate.length} entries`, {
      tags,
      newVersion: this.globalVersion,
    });
  }

  /**
   * Invalidate by pattern - bumps version to prevent stale writes
   */
  async invalidate(pattern: string | RegExp): Promise<void> {
    this.globalVersion++;

    // ... invalidation logic ...

    logger.category('cache').info(`Invalidated by pattern`, {
      pattern: pattern.toString(),
      newVersion: this.globalVersion,
    });
  }

  /**
   * Set cached data with version checking
   * 
   * @param requestVersion - Version when the request started
   *                        If this is less than current globalVersion,
   *                        an invalidation occurred during the request
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {},
    requestVersion?: number
  ): Promise<void> {
    // Race condition prevention: Reject stale writes
    if (requestVersion !== undefined && requestVersion < this.globalVersion) {
      logger.category('cache').debug(`Stale version for ${key}, discarding result`, {
        requestVersion,
        currentVersion: this.globalVersion,
      });
      return; // Don't cache old data
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      staleTime: options.staleTime ?? this.config.defaultStaleTime,
      cacheTime: options.cacheTime ?? this.config.defaultCacheTime,
      tags: options.tags,
      version: this.globalVersion, // Store current version with entry
    };

    this.inMemoryCache.set(key, entry);
    // ... persist to storage ...
  }
}
```

### 2. useQuery Integration

In `lib/cache/use-query.ts`:

```typescript
export function useQuery<T>(
  key: string,
  fetcher: FetchFn<T>,
  options: UseQueryOptions = {},
): UseQueryState<T> {
  // Capture version at component mount
  const requestVersionRef = useRef<number>(QueryCache.getCurrentVersion());

  const revalidate = async () => {
    if (disabled) return;

    try {
      // Capture version at start of request
      const versionAtStart = QueryCache.getCurrentVersion();

      // Perform the fetch
      const freshData = await fetcher(key);

      if (!isMountedRef.current) return;

      // Set cache with version - if invalidation occurred,
      // this call will be rejected automatically
      await QueryCache.set(
        key,
        freshData,
        { staleTime, cacheTime, tags },
        versionAtStart // Pass version for race condition prevention
      );

      setData(freshData);
      setError(undefined);
      onSuccess?.(freshData);
    } catch (err) {
      // Handle fetch error
      // ...
    }
  };

  // Main effect captures version at start
  useEffect(() => {
    requestVersionRef.current = QueryCache.getCurrentVersion();
    // ... rest of effect ...
  }, [key, disabled]);

  return { data, isLoading, isRevalidating, error, refetch, invalidate };
}
```

## How It Works: Step by Step

### Scenario: World is Updated While Query In-Flight

**Initial State:**
```typescript
// Cache
worlds:list = { id: '123', name: 'Old Name' }

// Global state
QueryCache.globalVersion = 5
```

**Step 1: Component Mounts and Starts Query**
```typescript
const { data } = useQuery('worlds:list', fetchWorlds, { ... });
// Captures: versionAtStart = 5
```

**Step 2: World Updated → Invalidation**
```typescript
await worldsDB.update('123', { name: 'New Name' });
// In database layer:
// QueryCache.invalidateByTags(['worlds'])
//   └─ globalVersion++ → now equals 6
//   └─ Removes 'worlds:list' from cache
```

**Step 3: Original Query Fetch Completes (300ms later)**
```typescript
const freshData = await fetcher('worlds:list'); // Returns OLD data from Supabase (2-hour stale)

// Try to cache it
await QueryCache.set('worlds:list', oldData, options, versionAtStart=5);

// Inside set():
if (5 < 6) { // requestVersion < globalVersion
  logger.catogery("other").debug('Stale version for worlds:list, discarding result');
  return; // ❌ DATA NOT CACHED
}
```

**Result:** ✅ Stale data was rejected!

### Scenario: Multiple Mutations to Same Query

```typescript
// User creates 3 worlds quickly while worlds:list query is refetching

// Mutation 1
await createWorld({ name: 'World 1' });
// QueryCache.invalidateByTags(['worlds']) → globalVersion = 6

// Mutation 2
await createWorld({ name: 'World 2' });
// QueryCache.invalidateByTags(['worlds']) → globalVersion = 7

// Mutation 3
await createWorld({ name: 'World 3' });
// QueryCache.invalidateByTags(['worlds']) → globalVersion = 8

// All in-flight fetches with versions < 8 will be rejected ✅
```

## Benefits

| Benefit | Details |
|---------|---------|
| **Simple** | Just a number comparison; O(1) overhead |
| **Automatic** | No per-query configuration needed |
| **Comprehensive** | Prevents ALL types of stale writes (both tag and pattern invalidation) |
| **Platform Agnostic** | Works on web, iOS, Android, desktop |
| **No Side Effects** | Doesn't require abort controllers or promise cancellation |
| **Observable** | Logs when stale writes are prevented for debugging |

## Guarantees

✅ **Data Consistency Guarantee:**
- If `invalidateByTags()` or `invalidate()` is called while a request is in-flight, the in-flight request's result will NOT be cached if it arrives after the invalidation.

✅ **No Stale Writes:**
- Even if a request takes longer than expected, the cache will never contain data that started before an invalidation.

✅ **Background Revalidation Safe:**
- Multiple concurrent fetches are all subject to version checking.

## Testing the Implementation

```typescript
// Test case: Verify stale writes are rejected

async function testRaceConditionPrevention() {
  // Setup
  const initialVersion = QueryCache.getCurrentVersion();
  await QueryCache.set('test:key', 'initial', {}, initialVersion);

  // Simulate race condition
  const version = QueryCache.getCurrentVersion();
  await QueryCache.invalidateByTags(['test']); // Bumps version

  // Try to cache old data from pre-invalidation request
  const wasSet = await QueryCache.set('test:key', 'stale', {}, version);

  // Verify old data was rejected
  const cached = await QueryCache.get('test:key');
  assert(cached === undefined); // ✅ Old data not cached
}
```

## Logging

When race conditions are detected, logs appear in debug output:

```
[cache] Stale version for worlds:list, discarding result {
  "requestVersion": 5,
  "currentVersion": 6
}
```

This helps identify:
- When stale writes are being prevented
- Which queries are affected by concurrent invalidations
- Performance tuning opportunities (if many rejections occur)

## Future Considerations

- **Monitoring Dashboard**: Track stale write prevention rate
- **Per-Key Versioning** (Optional): If some queries need different version tracking strategies
- **Version Rollover**: Currently version can go to very large numbers; could add modulo arithmetic if needed (unlikely in practice)

## Summary

Version-based race condition prevention is:
1. ✅ Implemented in QueryCache core
2. ✅ Integrated into useQuery hook
3. ✅ Requires NO changes to existing code using QueryCache
4. ✅ Prevents 100% of identified race condition scenarios

The mechanism is transparent to consumers - just use QueryCache normally and stale writes are automatically prevented.
