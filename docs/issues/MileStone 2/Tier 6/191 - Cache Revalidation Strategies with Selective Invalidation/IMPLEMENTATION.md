# Selective Cache Revalidation with Background Refresh Strategies - Implementation Guide

This guide provides detailed technical implementation information for the selective cache revalidation system, including architecture, data flows, and extension points.

## Architecture Overview

The cache revalidation system consists of three main components:

```
useQuery Hook (hooks/storage/use-query.ts)
    ↓
QueryCache (lib/middleware/storage/helpers/query-cache.ts)
    ↓
FastCache (system/Storage/FastCache.ts)
```

### Core Components

- **useQuery Hook**: React hook providing declarative data fetching with caching strategies
- **QueryCache**: Centralized cache management with invalidation and revalidation logic
- **FastCache**: Underlying storage backend for cache persistence

## Revalidation Strategies

### 'immediate' Strategy

**Behavior**: Block UI until fresh data is available
**Use Case**: User-initiated actions requiring confirmation
**Flow**:
1. Invalidate cache entry
2. Set `isLoading = true`, `isRevalidating = true`
3. Execute fetch function
4. Update cache with fresh data
5. Set `isLoading = false`, `isRevalidating = false`

**Code Path**:
```typescript
// In useQuery effect
if (strategy === 'immediate' && isStale) {
  setState({ isLoading: true, isRevalidating: true });
  const freshData = await fetcher();
  updateCache(key, freshData);
  setState({ data: freshData, isLoading: false, isRevalidating: false });
}
```

### 'background' Strategy (Stale-While-Revalidate)

**Behavior**: Return stale data immediately, fetch fresh data in background
**Use Case**: Page loads, background sync operations
**Flow**:
1. Return cached data immediately (`isLoading = false`)
2. Start background fetch (`isRevalidating = true`)
3. Update UI when fresh data arrives
4. Set `isRevalidating = false`

**Code Path**:
```typescript
if (strategy === 'background' && isStale) {
  setState({ isRevalidating: true });
  // Return stale data immediately
  fetcher().then(freshData => {
    updateCache(key, freshData);
    setState({ data: freshData, isRevalidating: false });
  });
}
```

### 'keep-stale' Strategy

**Behavior**: Keep stale data without auto-refetch
**Use Case**: Offline mode, manual control scenarios
**Flow**:
1. Keep existing stale data
2. No automatic refetch
3. Only refetch on explicit `refetch()` call

**Code Path**:
```typescript
if (strategy === 'keep-stale') {
  // No auto-refetch logic
  // Only manual refetch() triggers update
}
```

## Selective Invalidation

### Predicate-Based Filtering

**Mechanism**: Iterate through all cache entries, apply predicate function

```typescript
async selectiveInvalidate(
  predicate: (key: string, entry: CacheEntry) => boolean,
  options?: InvalidateOptions
): Promise<void> {
  const entries = await FastCache.getAllEntries();
  const toInvalidate = entries.filter(([key, entry]) => predicate(key, entry));

  for (const [key, entry] of toInvalidate) {
    await FastCache.remove(key);
    // Trigger revalidation based on strategy
  }

  // Increment global version for subscribers
  globalVersion++;
}
```

### Common Predicate Patterns

```typescript
// By key pattern
(key) => key.includes('world:123')

// By tag
(key, entry) => entry.tags?.includes('users')

// By age
(key, entry) => Date.now() - entry.timestamp > 24 * 60 * 60 * 1000

// Complex conditions
(key, entry) => key.startsWith('user:') && entry.data.status === 'active'
```

## Conditional Revalidation

### Implementation

**Check Function**: Executed before auto-revalidation
**Failure Behavior**: Skip refetch, keep stale data
**Override**: Manual `refetch()` always executes regardless of condition

```typescript
// In useQuery
const shouldRefetch = await revalidationCondition?.(entry);
if (!shouldRefetch) {
  return; // Keep stale data
}
// Proceed with revalidation
```

### Common Conditions

```typescript
// Network availability
revalidationCondition: async () => NetworkDetection.isOnline()

// User permission
revalidationCondition: async () => await checkUserPermission('read')

// Time-based
revalidationCondition: async (entry) =>
  Date.now() - entry.timestamp > 5 * 60 * 1000 // 5 minutes

// Feature flag
revalidationCondition: async () => featureFlags.isEnabled('auto_refresh')
```

## State Management

### State Transitions

| Scenario | isLoading | isRevalidating | data |
|----------|-----------|----------------|------|
| Initial load | true | false | undefined |
| Cache hit, fresh | false | false | cached |
| Cache hit, stale + immediate | true | true | cached |
| Cache hit, stale + background | false | true | cached |
| Background fetch complete | false | false | fresh |
| Manual refetch | true | false | current |

### State Update Logic

```typescript
function updateQueryState(newData?: T, isRefetch = false) {
  const hasData = newData !== undefined;
  const wasLoading = state.isLoading;

  setState({
    data: newData,
    isLoading: !hasData,
    isRevalidating: hasData && isRefetch,
    error: undefined
  });
}
```

## Cache Invalidation Patterns

### Tag-Based Invalidation

**Mechanism**: Entries store tag arrays, invalidation matches any tag

```typescript
interface CacheEntry {
  data: T;
  tags: string[];
  // ... other metadata
}

// Invalidate all user-related queries
await QueryCache.invalidateByTags(['users']);

// Invalidate specific user
await QueryCache.invalidateByTags(['user:123']);
```

### Global Version Bumping

**Purpose**: Notify all subscribers of cache changes
**Mechanism**: Increment global version counter
**Effect**: All useQuery hooks check if their data is still valid

```typescript
let globalVersion = 0;

async function invalidateByTags(tags: string[]): Promise<void> {
  // Remove matching entries
  // ...
  globalVersion++; // Triggers re-evaluation
}
```

## Integration Points

### With React Suspense

```typescript
// Future enhancement: Suspense boundaries
<Suspense fallback={<Loading />}>
  <WorldList />
</Suspense>

// In component
const worlds = useQuery('worlds', fetchWorlds, {
  suspense: true // Throw promise for Suspense
});
```

### With React Query (Migration Path)

The implementation provides a migration path from React Query:

```typescript
// React Query style
const { data, isLoading, refetch } = useQuery('worlds', fetchWorlds, {
  staleTime: 5 * 60 * 1000,
  cacheTime: 10 * 60 * 1000
});

// Our implementation
const { data, isLoading, isRevalidating, refetch } = useQuery('worlds', fetchWorlds, {
  staleTime: 5 * 60 * 1000,
  cacheTime: 10 * 60 * 1000,
  revalidationStrategy: 'background'
});
```

### With Offline Queue

**Integration**: Cache invalidation triggers offline sync checks

```typescript
// After invalidation
await QueryCache.invalidateByTags(['worlds']);

// Check for pending offline mutations
const pending = await OfflineQueue.getPendingMutations();
if (pending.some(m => m.affects('worlds'))) {
  await OfflineSync.processQueue();
}
```

## Performance Optimizations

### Batching Invalidations

**Problem**: Multiple sequential invalidations increment version multiple times
**Solution**: Detect burst invalidations within same event loop tick

```typescript
let pendingVersionBump = false;

async function invalidateByTags(tags: string[]): Promise<void> {
  // Invalidation logic...

  if (!pendingVersionBump) {
    pendingVersionBump = true;
    await Promise.resolve(); // Next tick
    globalVersion++;
    pendingVersionBump = false;
  }
}
```

### Lazy Revalidation

**Problem**: All stale queries refetch simultaneously
**Solution**: Stagger revalidation with random delays

```typescript
// Add jitter to prevent thundering herd
const delay = Math.random() * 1000; // 0-1s random delay
await new Promise(resolve => setTimeout(resolve, delay));
await refetch();
```

### Memory Management

**Cleanup**: Remove expired entries automatically

```typescript
// Background cleanup task
setInterval(() => {
  const now = Date.now();
  const entries = FastCache.getAllEntries();

  for (const [key, entry] of entries) {
    if (now - entry.timestamp > entry.cacheTime) {
      FastCache.remove(key);
    }
  }
}, 60 * 1000); // Every minute
```

## Error Handling

### Network Failures

**Background Strategy**: Log error, keep stale data
**Immediate Strategy**: Show error state, allow retry
**Keep-Stale Strategy**: No auto-retry, manual refetch required

```typescript
try {
  const freshData = await fetcher();
  updateCache(key, freshData);
} catch (error) {
  if (strategy === 'immediate') {
    setState({ error, isLoading: false });
  } else {
    logger.warn('Background refetch failed:', error);
    // Keep stale data
  }
}
```

### Cache Corruption

**Detection**: JSON parse errors during cache reads
**Recovery**: Remove corrupted entry, trigger refetch

```typescript
try {
  const entry = JSON.parse(cachedString);
  return entry;
} catch (error) {
  await FastCache.remove(key);
  return null; // Trigger fresh fetch
}
```

## Testing Strategy

### Unit Tests

- **Strategy Logic**: Test each revalidation strategy independently
- **Predicate Filtering**: Test selectiveInvalidate with various predicates
- **State Transitions**: Verify correct isLoading/isRevalidating states
- **Conditional Logic**: Test revalidationCondition evaluation

### Integration Tests

- **Full Query Flow**: Mount component → cache hit → invalidation → refetch
- **Concurrent Invalidations**: Multiple invalidations in same tick
- **Network Conditions**: Test with online/offline scenarios
- **Error Scenarios**: Network failures, cache corruption

### Performance Tests

- **Invalidation Speed**: Time for selectiveInvalidate with 1000+ entries
- **Memory Usage**: Monitor cache size under various strategies
- **Concurrent Loads**: Multiple useQuery hooks with different strategies

## Extension Points

### Custom Revalidation Strategies

```typescript
// Add new strategy
type RevalidationStrategy = 'immediate' | 'background' | 'keep-stale' | 'custom';

// Implement logic
if (strategy === 'custom') {
  // Custom revalidation behavior
}
```

### Custom Cache Backends

```typescript
// Abstract FastCache interface
interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  getAllEntries(): Promise<Array<[string, CacheEntry]>>;
}

// Allow injection
const cache = new QueryCache(customBackend);
```

### Cache Analytics

```typescript
// Track cache performance
const metrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  revalidations: 0
};

// Hook into operations
await QueryCache.invalidateByTags(['users']);
metrics.invalidations++;
```

## Migration Guide

### From Legacy Cache

1. **Replace Direct FastCache Calls**
   ```typescript
   // Old
   await FastCache.set('worlds', JSON.stringify(data));

   // New
   await QueryCache.set('worlds', data, { tags: ['worlds'] });
   ```

2. **Update Invalidation Logic**
   ```typescript
   // Old
   await FastCache.clear();

   // New
   await QueryCache.invalidateByTags(['worlds'], { strategy: 'background' });
   ```

3. **Add Strategy Declarations**
   ```typescript
   // Old
   const { data, loading } = useCustomQuery('worlds', fetchWorlds);

   // New
   const { data, isLoading, isRevalidating } = useQuery('worlds', fetchWorlds, {
     revalidationStrategy: 'background'
   });
   ```

### Breaking Changes

- **`isValidating` → `isRevalidating`**: Renamed for clarity
- **New Required Parameters**: All invalidation calls need explicit strategy
- **State Structure**: `isRevalidating` added, `isValidating` removed

## Troubleshooting

### Common Issues

- **Stale Data Not Updating**: Check revalidationCondition returns true
- **Multiple Refetches**: Ensure strategies are correctly set
- **Memory Leaks**: Verify cacheTime is set appropriately
- **Race Conditions**: Use selectiveInvalidate for precise control

### Debug Tools

```typescript
// Inspect cache state
const entries = await FastCache.getAllEntries();
console.log('Cache entries:', entries);

// Monitor invalidations
QueryCache.onInvalidate = (tags) => {
  console.log('Invalidated tags:', tags);
};

// Check revalidation
const { isRevalidating } = useQuery('debug', fetcher);
console.log('Currently revalidating:', isRevalidating);
```