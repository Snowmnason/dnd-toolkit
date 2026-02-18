# Cache Module

In-memory + persistent caching with Stale-While-Revalidate (SWR) pattern, tag-based invalidation, optimistic mutations, deduplication, and automatic cleanup. Works with lib/api for response caching and with lib/storage for persistence across app restarts.

## When to Use This Module

**Use this module if you need to:**

- Cache API responses with SWR pattern (return stale data immediately, revalidate in background)
- Deduplicate concurrent identical requests
- Invalidate related cached data by tags (e.g., invalidate all `world:123:*` queries)
- Apply optimistic updates for instant UI feedback on mutations
- Subscribe to cache changes for real-time UI synchronization
- Persist cache across app restarts

**Do NOT use this module for:**

- Raw request deduplication without caching (use lib/api RequestManager instead)
- Persistent validated storage (use lib/storage)
- Transactional data operations (use database)

## Architecture & Data Flow

```
useQuery { cacheKey }
        ↓
    [Check In-Memory Cache]
        ├─ Hit & not stale → return immediately (SWR)
        ├─ Hit & stale → return stale, revalidate in background (SWR)
        ├─ Miss → continue
        ↓
    [Deduplication]
        ├─ In-flight request for this key? → return same promise
        └─ No → continue
        ↓
    [Fetch via Fetcher]
        ├─ Success → cache result
        └─ Error → notify subscribers
        ↓
    [Persist to Cache]
        ├─ In-memory Map (O(1) lookup)
        └─ FastCache storage (survives app restarts)
        ↓
    [Notify Subscribers]
        └─ Trigger React re-renders

useMutation { mutationFn, invalidateTags }
        ↓
    [Optimistic Update] (if configured)
        └─ Apply changes to matching cache entries
        ↓
    [Execute Mutation]
        ├─ Success → invalidate tags, notify subscribers
        └─ Error → revert optimistic update
```

**Key Principles:**

- **Stale-While-Revalidate**: Return stale cached data immediately; background revalidation ensures freshness without blocking UX
- **Multi-layered**: In-memory Map for speed O(1); FastCache for persistence (survives app restarts)
- **Deduplication**: Multiple `useQuery` calls with same key coalesce into one fetch (prevents thundering herd)
- **Tag-based invalidation**: Bulk invalidate related queries (e.g., `invalidateTags(['world:123', 'world:123:members'])`)
- **Pattern invalidation**: Regex-based invalidation for complex matching (e.g., `/^world:123:.*/` to clear all world:123 data)
- **Optimistic updates**: Apply changes immediately; revert on mutation error for better UX
- **Race-condition safe**: Version tracking prevents stale writes from requests that started before invalidation
- **Automatic cleanup**: Expired entries removed hourly; max 500 entries with LRU-style eviction

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

Returns current global version number. Increments on every `invalidateByTags()` or `invalidate()` call. Used internally for race condition prevention.

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

**Cache Priority Strategies:**

| Strategy | Behavior | Use When |
| --- | --- | --- |
| `'balanced'` (default) | Return cache immediately; revalidate if stale | Standard data fetching |
| `'cacheFirst'` | Strongly prefer cache, no auto-revalidation | Stable, rarely-changing data |
| `'networkFirst'` | Always try to fetch; fallback to cache on error | Real-time data, fast updates needed |
| `'offlineFirst'` | When offline, use cache even if stale; don't revalidate | Critical offline-first features |

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

- **`lib/api` (RequestManager)** – Works with lib/api for response caching; shares deduplication concepts (works with lib/api)
- **`lib/storage` (FastCache)** – Persistent cache backend; survives app restarts (works with lib/storage)
- **`lib/utils/logger`** – Cache operation logging (cache category)
- **`lib/network`** – `cachePriority: 'offlineFirst'` integrates with network state detection

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


