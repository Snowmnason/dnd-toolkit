# Cache Module

Comprehensive caching system with Stale-While-Revalidate (SWR) pattern, tag-based invalidation, optimistic updates, and deduplication. Designed as a foundation for data fetching layers in any application.

## When to Use This Module

**Use this module if you need to:**

- Cache API responses with configurable stale/cache times
- Implement SWR (Stale-While-Revalidate) pattern for better UX
- Deduplicate concurrent identical requests
- Invalidate related cached data via tags or patterns
- Apply optimistic updates for instant UI feedback
- Persist cache across app restarts
- Avoid thundering herd (multiple identical requests)
- Build React hooks for queries and mutations
- Subscribe to cache updates for real-time data synchronization

**Don't use this if:**

- You need ephemeral request deduplication only (use RequestManager's dedupe instead)
- You require persistent, versioned data store (use database)
- You need transactional guarantees (use database/storage)
- You're building a distributed cache (this is in-memory + local storage)

## Architecture & Data Flow

```
User Action (useQuery / useMutation)
        ↓
Check In-Memory Cache (fast, O(1))
        ↓
If cached & not stale: Return immediately
        ↓
If stale or missing: Fetch in background (deduplicated)
        ↓
Deduplication: Multiple requests return same promise
        ↓
Fetch from API (or user's fetcher function)
        ↓
Persist to Cache (in-memory + FastCache storage)
        ↓
Notify Subscribers (trigger React re-renders)
        ↓
Return Result to Component
```

**Key Principles:**

- **Stale-While-Revalidate**: Return cached data immediately, revalidate in background
- **Multi-layered**: In-memory cache (fast) + persistent FastCache (survives restarts)
- **Deduplication**: Multiple requests for same key coalesce into one fetch
- **Tag-based invalidation**: Invalidate related queries (e.g., all "worlds" queries)
- **Pattern invalidation**: Invalidate by regex (e.g., all `world:123:*` queries)
- **Optimistic updates**: Apply changes immediately, revert on error
- **Race-condition safe**: Version tracking prevents stale writes from in-flight requests
- **Observable**: All activity logged and tracked to analytics

## API Reference

### `QueryCache` Object

Core cache manager. Typically used indirectly via `useQuery()` and `useMutation()` hooks.

#### `QueryCache.get<T>(key): Promise<T | null>`

Retrieves cached data. Returns `null` if not found or expired.

```ts
const users = await QueryCache.get<User[]>("users:list");
```

#### `QueryCache.set<T>(key, data, options?, requestVersion?): Promise<void>`

Stores data in cache with options (staleTime, cacheTime, tags).

**Parameters:**

- `key` (string) – Cache key
- `data` (T) – Data to cache
- `options` (CacheOptions) – `{ staleTime?, cacheTime?, tags? }`
- `requestVersion` (number?) – Version when request started (for race condition prevention)

```ts
await QueryCache.set(
  "users:list",
  users,
  {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    tags: ["users"],
  },
  versionAtStart, // Prevents stale writes from old requests
);
```

#### `QueryCache.isStale(key): Promise<boolean>`

Checks if cached data is stale (beyond staleTime, but not expired).

```ts
const isStale = await QueryCache.isStale("users:list");
if (isStale) {
  // Revalidate in background
}
```

#### `QueryCache.fetchWithDedupe<T>(key, fetcher): Promise<T>`

Fetches with deduplication. If another request for this key is in-flight, returns the same promise.

```ts
const users = await QueryCache.fetchWithDedupe("users:list", () =>
  fetch("/api/users"),
);
// If called again while in-flight, both return same promise
```

#### `QueryCache.applyOptimisticUpdate(updater, options?): () => void`

Applies optimistic update to cache and returns revert function.

**Parameters:**

- `updater` – Function that transforms cached data
- `options` – Optional filters: `{ tags?: string[]; keyPattern?: RegExp }`

**Returns:** Revert function to undo the optimistic update

```ts
const revert = QueryCache.applyOptimisticUpdate(
  (prev) => ({ ...prev, status: "loading" }),
  { tags: ["world:123"] },
);

try {
  await updateWorld(data);
} catch {
  revert(); // Revert on error
}
```

#### `QueryCache.remove(key): Promise<void>`

Removes a specific cache entry from both in-memory and persistent storage.

```ts
await QueryCache.remove("users:list");
```

#### `QueryCache.clear(): Promise<void>`

Clears all cache entries.

```ts
await QueryCache.clear();
```

#### `QueryCache.invalidateByTags(tags): Promise<void>`

Invalidates all cache entries with matching tags. Increments global version to prevent stale writes from in-flight requests.

```ts
// Invalidate all user-related queries
await QueryCache.invalidateByTags(["users", "user:123"]);
```

#### `QueryCache.invalidate(pattern): Promise<void>`

Invalidates cache entries by string or regex pattern. Increments global version.

```ts
// Invalidate all world:123 related queries
await QueryCache.invalidate(/^world:123:/);

// Or by exact prefix
await QueryCache.invalidate("world:123");
```

#### `QueryCache.subscribe(key, callback): () => void`

Subscribes to cache updates. Returns unsubscribe function.

```ts
const unsubscribe = QueryCache.subscribe("users:list", (key, data) => {
  console.log(`Cache updated for ${key}`, data);
});

// Later:
unsubscribe();
```

#### `QueryCache.getCurrentVersion(): number`

Returns current global version number. Used for race condition prevention.

#### `QueryCache.getStats(): { cacheSize, subscribers, keys }`

Returns debugging statistics.

---

### `useQuery<T>(key, fetcher, options?): UseQueryState<T>`

React hook for data fetching with SWR pattern.

**Parameters:**

- `key` (string) – Cache key (e.g., `'users:list'`)
- `fetcher` ((key: string) => Promise<T>) – Async function to fetch data
- `options` (UseQueryOptions?) – Configuration

**Returns:** `UseQueryState<T>` object:

```ts
{
  data: T | undefined; // Current cached data
  isLoading: boolean; // First load in progress
  isValidating: boolean; // Background revalidation in progress
  error: Error | undefined; // Error if any
  refetch: () => Promise<void>; // Manual refetch
  invalidate: () => Promise<void>; // Invalidate and refetch
}
```

**Example:**

```ts
const { data, isLoading, error, refetch } = useQuery(
  'worlds:user:123',
  async (key) => {
    const response = await fetch(`/api/worlds?userId=123`);
    return response.json();
  },
  {
    staleTime: 5 * 60,              // 5 minutes (in seconds)
    cacheTime: 30 * 60,             // 30 minutes (in seconds)
    tags: ['worlds', 'user:123'],
    onSuccess: (data) => console.log('Loaded:', data),
    onError: (error) => console.error('Error:', error),
  }
);

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;

return (
  <>
    <WorldsList worlds={data} />
    <button onClick={refetch}>Refresh</button>
  </>
);
```

**Options:**

- `staleTime` (number, seconds) – How long until data is considered stale (default: 2 hours)
- `cacheTime` (number, seconds) – How long to keep data in cache (default: 4 hours)
- `revalidateOnFocus` (boolean) – Revalidate when window regains focus (default: true)
- `disabled` (boolean) – Disable query execution (default: false)
- `tags` (string[]) – Tags for invalidation
- `onSuccess` ((data: T) => void) – Called on successful fetch
- `onError` ((error: Error) => void) – Called on fetch error
- `cachePriority` (string) – Cache priority strategy (default: 'balanced'):
  - `'balanced'`: Use cache if available; revalidate in background if stale (SWR pattern)
  - `'cacheFirst'`: Strongly prefer cache; only revalidate on explicit `refetch()` call
  - `'networkFirst'`: Always try to fetch; use cache as fallback on network error
  - `'offlineFirst'`: When offline, use cache even if very stale; don't force revalidation

**Cache Priority Behavior:**

```ts
// Default: 'balanced' (SWR)
const { data } = useQuery('worlds:list', fetcher);
// Returns cached data immediately if exists
// Revalidates in background if older than staleTime

// cacheFirst: Minimal data refresh
const { data } = useQuery('worlds:list', fetcher, {
  cachePriority: 'cacheFirst',
});
// Returns cached data immediately
// Never revalidates automatically (call refetch() manually)
// Useful for stable, rarely-changing data

// offlineFirst: Offline-aware
const { data } = useQuery('worlds:list', fetcher, {
  cachePriority: 'offlineFirst',
});
// When offline: returns cache even if stale, doesn't try network
// When online: standard SWR behavior
// Useful for critical features that should work offline

// networkFirst: Always fresh if possible
const { data } = useQuery('worlds:list', fetcher, {
  cachePriority: 'networkFirst',
});
// Always attempts to fetch fresh data
// Falls back to cache if network fails
// Useful for frequently-changing data that must be current
```

---

### `useMutation<TData, TError>(mutationFn, options?): UseMutationState<TData, TError>`

React hook for mutations with cache invalidation and optimistic updates.

**Parameters:**

- `mutationFn` ((variables: unknown) => Promise<TData>) – Async function to execute
- `options` (UseMutationOptions?) – Configuration

**Returns:** `UseMutationState<TData, TError>` object:

```ts
{
  data: TData | undefined;        // Mutation result
  isLoading: boolean;             // Mutation in progress
  error: TError | undefined;      // Error if any
  mutate: (variables: unknown) => Promise<TData>;  // Execute mutation
  reset: () => void;              // Reset state
}
```

**Example:**

```ts
const { mutate, isLoading, error } = useMutation(
  async (variables: { worldId: string; name: string }) => {
    const response = await fetch(`/api/worlds/${variables.worldId}`, {
      method: "PUT",
      body: JSON.stringify({ name: variables.name }),
    });
    return response.json();
  },
  {
    invalidateTags: ["worlds", `world:${worldId}`],
    onSuccess: (data) => {
      showSuccessMessage("World updated!");
    },
    onError: (error) => {
      showErrorMessage(error.message);
    },
    optimisticUpdate: (variables) => (prev) => ({
      ...prev,
      name: (variables as any).name,
    }),
    optimisticTags: [`world:${worldId}`],
  },
);

const handleUpdate = async () => {
  try {
    const result = await mutate({ worldId: "123", name: "New Name" });
  } catch (err) {
    console.error("Mutation failed:", err);
  }
};
```

**Options:**

- `onSuccess` ((data: TData) => void) – Called on success
- `onError` ((error: TError) => void) – Called on error
- `invalidateTags` (string[]) – Tags to invalidate after success
- `invalidatePatterns` ((string | RegExp)[]) – Patterns to invalidate after success
- `optimisticUpdate` ((variables: unknown) => (prev: any) => any) – Optimistic update function
- `optimisticTags` (string[]) – Tags to target for optimistic updates
- `optimisticKeyPattern` (RegExp) – Pattern to target for optimistic updates

---

### Cache Keys and Tags

Centralized cache key/tag constants for consistency and easier invalidation.

**`CACHE_KEYS` object:**

```ts
CACHE_KEYS.worlds.list(userId); // 'worlds:user:{userId}'
CACHE_KEYS.worlds.details(worldId); // 'world:{worldId}:details'
CACHE_KEYS.notes.all(worldId); // 'world:{worldId}:notes'
CACHE_KEYS.characters.details(worldId, characterId); // 'world:{worldId}:character:{characterId}:details'
// ... many more
```

**`CACHE_TAGS` object:**

```ts
CACHE_TAGS.worlds; // 'worlds'
CACHE_TAGS.world(worldId); // 'world:{worldId}'
CACHE_TAGS.user(userId); // 'user:{userId}'
// ... many more
```

**Usage:**

```ts
// Query
const { data } = useQuery(CACHE_KEYS.worlds.forUser(userId), fetcher, {
  tags: [CACHE_TAGS.worlds, CACHE_TAGS.user(userId)],
});

// Mutation
useMutation(updateWorld, {
  invalidateTags: [CACHE_TAGS.worlds, CACHE_TAGS.world(worldId)],
});
```

---

## Dependencies

### External Packages

- **`react`** – React hooks (useEffect, useRef, useState, useCallback)
- None others (pure TypeScript/JavaScript cache logic)

### Internal Dependencies

- **`lib/storage` (FastCache)** – Persistent cache storage (fast, unencrypted, survives restarts)
- **`lib/utils/logger`** – Logs cache operations (debug, info, error)

---

## Error Handling & Edge Cases

### Cache Miss

If data not found or expired, `useQuery` calls fetcher. If fetcher fails, error is set and component can display error UI.

### Concurrent Duplicate Requests

Multiple `useQuery` calls with same key coalesce into one fetch via `fetchWithDedupe`. Both hooks receive same data/error.

### Stale Writes from In-Flight Requests

When cache is invalidated via `invalidateByTags()` or `invalidate()`, global version increments. If a request started before invalidation completes after, `requestVersion` check prevents stale data from being cached.

```ts
// Query starts, captures versionAtStart = 1
const versionAtStart = QueryCache.getCurrentVersion();

// Meanwhile, invalidation happens: version becomes 2
await QueryCache.invalidateByTags(["worlds"]);

// Query finishes, but versionAtStart (1) < currentVersion (2)
// so data is NOT cached (stale write prevented)
```

### Optimistic Update Failure

If mutation fails after optimistic update, revert function is called to restore previous data. Mutations that don't provide `optimisticUpdate` simply retry on error.

### Cache Overflow

If in-memory cache exceeds `maxEntries` (default 500), oldest 10% of entries are evicted. Persistent storage also evicted.

### FastCache Storage Failure

If persistent storage (FastCache) fails, cache degrades to in-memory only (data lost on app restart). Logger warns but doesn't throw.

### Race Condition: Invalidation During Fetch

Solved via version tracking. Fetches that complete after invalidation are discarded (not cached).

---

## Performance Notes

### In-Memory Lookup Cost

`QueryCache.get()` is O(1) Map lookup. No storage I/O for cache hits.

### Invalidation Cost

`invalidateByTags()` is O(n) where n = number of cached entries. Typically < 500 entries; negligible.
`invalidate()` with regex is O(n) for pattern matching + O(m) for removal where m = matching entries.

### Deduplication Overhead

Negligible. Single Map check per fetch. Benefits far outweigh cost.

### Subscription Cost

Each `useQuery` subscribes to cache updates. Subscribers stored as Set per key. Notification is O(1) per subscriber.

### Cleanup Cost

Automatic cleanup every 1 hour removes expired entries (O(n) scan). Non-blocking via setInterval.

### Memory Usage

Default max 500 entries × average entry size (~1KB) = ~500KB in-memory cache. Configurable via `QueryCacheConfig.maxEntries`.

---

## Related Modules

- **`lib/storage` (FastCache)** – Persistent cache storage layer
- **`lib/api` (RequestManager)** – Makes HTTP requests; integrates with QueryCache via cache keys
- **`lib/utils/logger`** – Cache operation logging
- **`lib/analytics`** – Can track cache hit/miss rates, performance

---

## File Breakdown

| File              | Purpose                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query-cache.ts`  | Core QueryCache class. In-memory + persistent caching with SWR, deduplication, invalidation (tag/pattern), optimistic updates, cleanup, subscriptions. Singleton exported. |
| `use-query.ts`    | React hook for data fetching. SWR pattern: returns cached data immediately, revalidates in background. Supports stale checking, error handling, manual refetch/invalidate. |
| `use-mutation.ts` | React hook for mutations. Executes async function, applies optimistic updates, invalidates related caches by tags/patterns on success.                                     |
| `keys.ts`         | Centralized cache key constants (CACHE_KEYS, CACHE_TAGS) following hierarchical naming convention (domain:entity:action:identifier). Enables consistent invalidation.      |
| `index.ts`        | Barrel export of public API (QueryCache, useQuery, useMutation, CACHE_KEYS, CACHE_TAGS, etc.).                                                                             |

---

## Testing

Currently, no dedicated test guide exists for this module. When adding tests, create a guide at `docs/A Testing Guide/cache.md` following the repository's testing guide template.

**Manual testing tips:**

- **Cache hit**: Query twice with same key within staleTime → second should use cached data instantly
- **Stale revalidation**: Query, wait past staleTime, access query → should return stale data immediately, revalidate in background
- **Deduplication**: Call same query twice rapidly → both should return same promise
- **Invalidation by tags**: Create multiple queries with same tag, invalidate tag → all queries should refetch
- **Optimistic update**: Mutation with optimisticUpdate → UI updates before request completes; on error → reverts
- **Race condition**: Invalidate cache while query in-flight → completed query should NOT cache stale data
- **Cleanup**: Wait 1+ hour, check in-memory cache size → expired entries should be removed

---

## Future Enhancements

- **LRU Eviction**: Implement Least-Recently-Used eviction instead of oldest-first
- **Time-Travel Debugging**: Keep history of cache state changes for debugging
- **Cache Analytics**: Track hit/miss rates, entry age distribution, access patterns
- **Conditional Requests**: HTTP cache headers (ETag, Last-Modified) to reduce payload
- **Cross-Tab Sync**: Sync cache changes across browser tabs/windows (for web)
- **Custom Storage Backend**: Pluggable storage (IndexedDB, Realm, SQLite, etc.)
