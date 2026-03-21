# Selective Cache Revalidation with Background Refresh Strategies - Usage Guide

This guide explains how to use the selective cache revalidation system for optimal data fetching and caching in your application.

## Overview

The cache revalidation system provides three strategies for controlling how cached data behaves when it becomes stale:

- **`immediate`**: Block UI until fresh data arrives (best for user actions)
- **`background`**: Show stale data while fetching fresh data (best for page loads)
- **`keep-stale`**: Keep stale data without auto-refresh (best for offline/manual control)

## Basic Usage

### Setting Up Queries

```typescript
import { useQuery } from '@/hooks/storage';
import { QueryCache } from '@/lib/storage';

function WorldList() {
  // Page load: Show cached data immediately, refresh in background
  const { data: worlds, isLoading, isRevalidating, error } = useQuery(
    'worlds',
    fetchWorlds,
    {
      revalidationStrategy: 'background',
      staleTime: 5 * 60, // 5 minutes (seconds)
      cacheTime: 30 * 60, // 30 minutes (seconds)
    }
  );

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {worlds?.map(world => <WorldItem key={world.id} world={world} />)}
      {isRevalidating && <div>Updating...</div>}
    </div>
  );
}
```

### Handling User Actions

```typescript
function CreateWorldForm() {
  const { data, isLoading, refetch } = useQuery(
    'worlds',
    fetchWorlds,
    {
      revalidationStrategy: 'immediate', // Wait for confirmation
    }
  );

  const handleCreate = async (worldData) => {
    await createWorld(worldData);
    // Invalidate and refetch immediately to show new world
    await QueryCache.invalidateByTags(['worlds'], { strategy: 'immediate' });
  };
  {
      revalidationStrategy: 'background',
    }
      {/* Form fields */}
      <button disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create World'}
      </button>
    </form>
  );
}
```

## Revalidation Strategies

### 'immediate' Strategy

**When to Use**:
- User-initiated mutations (create, update, delete)
- Actions requiring immediate confirmation
- Critical data that must be fresh

**User Experience**:
- UI shows loading state during refetch
- User waits for operation to complete
- Clear feedback that action is in progress

**Example**:
```typescript
// User clicks "Save Changes"
const { isLoading } = useQuery('user-profile', fetchProfile, {
  revalidationStrategy: 'immediate'
});

// Shows spinner until save completes
```

### 'background' Strategy (Stale-While-Revalidate)

**When to Use**:
- Page loads and navigation
- Background data synchronization
- Non-critical data updates
- Improving perceived performance

**User Experience**:
- Instant page load with cached data
- Seamless updates in background
- No loading interruptions

**Example**:
```typescript
// Page navigation
const { data, isRevalidating } = useQuery('dashboard', fetchDashboard, {
  revalidationStrategy: 'background'
});

// Shows cached dashboard immediately
// Updates quietly in background
// Shows "Updating..." indicator if needed
```

### 'keep-stale' Strategy

**When to Use**:
- Offline functionality
- Manual refresh controls
- Infrequently changing data
- User preference for control

**User Experience**:
- Data stays as-is until manually refreshed
- Explicit "Refresh" buttons
- Predictable, controlled updates

**Example**:
```typescript
// Settings page
const { data, refetch } = useQuery('settings', fetchSettings, {
  revalidationStrategy: 'keep-stale'
});

return (
  <div>
    <SettingsForm data={data} />
    <button onClick={refetch}>Refresh Settings</button>
  </div>
);
```

## Advanced Features

### Conditional Revalidation

Only refetch when conditions are met:

```typescript
const { data } = useQuery('users', fetchUsers, {
  revalidationStrategy: 'background',
  revalidationCondition: async () => {
    // Only refetch if online
    return await NetworkDetection.isOnline();
  }
});

// Offline: Keeps stale data
// Online: Refetches in background
```

### Selective Invalidation

Invalidate specific cache entries instead of broad sweeps:

```typescript
import { QueryCache } from '@/lib/storage';

// After updating a specific world
await QueryCache.selectiveInvalidate(
  (key) => key.includes(`world:${worldId}`),
  { strategy: 'immediate' }
);

// Only refetches the affected world, not all worlds
```

### Tag-Based Invalidation

Organize cache entries with tags for efficient invalidation:

```typescript
// When fetching data
await QueryCache.set('world:123', worldData, {
  tags: ['worlds', 'world:123', 'user:456']
});

// When user updates world
await QueryCache.invalidateByTags(['world:123']);

// Invalidates only entries tagged with 'world:123'
```

## State Management

### Understanding Loading States

```typescript
const {
  data,
  isLoading,        // True during initial fetch
  isRevalidating,   // True during background refresh
  error,
  refetch
} = useQuery('worlds', fetchWorlds, {
  revalidationStrategy: 'background'
});

// Initial load: isLoading = true, isRevalidating = false
// Cache hit: isLoading = false, isRevalidating = false
// Background refresh: isLoading = false, isRevalidating = true
// Error: isLoading = false, isRevalidating = false, error = Error
```

### Error Handling

```typescript
const { data, error, refetch } = useQuery('worlds', fetchWorlds);

if (error) {
  return (
    <div>
      <ErrorMessage error={error} />
      <button onClick={refetch}>Try Again</button>
    </div>
  );
}
```

## Common Patterns

### Optimistic Updates

```typescript
function LikeButton({ worldId }) {
  const { data: world, refetch } = useQuery(
    `world:${worldId}`,
    () => fetchWorld(worldId),
    { revalidationStrategy: 'keep-stale' }
  );

  const handleLike = async () => {
    // Optimistic update
    const optimisticWorld = { ...world, likes: world.likes + 1 };
    await QueryCache.set(`world:${worldId}`, optimisticWorld);

    try {
      await api.likeWorld(worldId);
      // Invalidate to get real data
      await QueryCache.invalidateByTags([`world:${worldId}`], {
        strategy: 'background'
      });
    } catch (error) {
      // Revert on failure
      await refetch();
    }
  };

  return <button onClick={handleLike}>Like ({world?.likes})</button>;
}
```

### Infinite Scroll with Background Refresh

```typescript
function WorldList() {
  const [page, setPage] = useState(1);

  const { data, isRevalidating } = useQuery(
    `worlds:page:${page}`,
    () => fetchWorlds(page),
    {
      revalidationStrategy: 'background',
      staleTime: 2 * 60, // 2 minutes (seconds)
    }
  );

  return (
    <div>
      {data?.map(world => <WorldItem key={world.id} world={world} />)}
      {isRevalidating && <div>Refreshing...</div>}
      <button onClick={() => setPage(p => p + 1)}>Load More</button>
    </div>
  );
}
```

### Real-time Data with Manual Refresh

```typescript
function ChatMessages({ channelId }) {
  const { data: messages, refetch, isLoading } = useQuery(
    `chat:${channelId}`,
    () => fetchMessages(channelId),
    {
      revalidationStrategy: 'keep-stale',
      staleTime: 30, // 30 seconds (seconds)
    }
  );

  // Manual refresh for real-time feel
  useEffect(() => {
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <div>
      <MessageList messages={messages} />
      <button onClick={refetch} disabled={isLoading}>
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}
```

## Performance Optimization

### Cache Configuration

```typescript
// Fast-changing data
const { data } = useQuery('notifications', fetchNotifications, {
  staleTime: 30,     // Stale after 30s (seconds)
  cacheTime: 5 * 60, // Keep in cache for 5min (seconds)
  revalidationStrategy: 'background'
});

// Slow-changing data
const { data } = useQuery('user-profile', fetchProfile, {
  staleTime: 10 * 60, // Stale after 10min (seconds)
  cacheTime: 60 * 60, // Keep for 1 hour (seconds)
  revalidationStrategy: 'keep-stale'
});
```

### Batching Invalidations

```typescript
// Instead of multiple calls
await QueryCache.invalidateByTags(['worlds']);
await QueryCache.invalidateByTags(['users']);

// Batch them (implementation handles deduplication)
await Promise.all([
  QueryCache.invalidateByTags(['worlds'], { strategy: 'background' }),
  QueryCache.invalidateByTags(['users'], { strategy: 'background' })
]);
```

## Integration with Other Systems

### With Offline Queue

```typescript
const { data } = useQuery('worlds', fetchWorlds, {
  revalidationStrategy: 'background',
  revalidationCondition: async () => {
    // Don't refetch if we have pending changes
    const pending = await OfflineQueue.getPendingMutations('worlds');
    return pending.length === 0;
  }
});
```

### With Feature Flags

```typescript
const { data } = useQuery('advanced-features', fetchFeatures, {
  revalidationStrategy: 'background',
  revalidationCondition: async () => {
    return featureFlags.isEnabled('background_refresh');
  }
});
```

### With Analytics

```typescript
const { data, isRevalidating } = useQuery('dashboard', fetchDashboard, {
  revalidationStrategy: 'background'
});

// Track background refresh performance
useEffect(() => {
  if (isRevalidating) {
    analytics.track('dashboard_refresh_started');
  } else {
    analytics.track('dashboard_refresh_completed');
  }
}, [isRevalidating]);
```

## Migration from Existing Code

### From Direct Cache Usage

```typescript
// Old approach
const cached = await FastCache.get('worlds');
if (!cached) {
  const data = await fetchWorlds();
  await FastCache.set('worlds', JSON.stringify(data));
}

// New approach
const { data } = useQuery('worlds', fetchWorlds, {
  revalidationStrategy: 'background'
});
```

### From Manual Refetch Logic

```typescript
// Old approach
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

const refetch = async () => {
  setLoading(true);
  const newData = await fetchWorlds();
  setData(newData);
  setLoading(false);
};

// New approach
const { data, isLoading, refetch } = useQuery('worlds', fetchWorlds, {
  revalidationStrategy: 'keep-stale'
});
```

## Best Practices

### Strategy Selection Guidelines

| Scenario | Recommended Strategy | Rationale |
|----------|---------------------|-----------|
| Page load | `background` | Instant UI, seamless updates |
| User action | `immediate` | Clear feedback, confirmation |
| Settings page | `keep-stale` | User controls refresh timing |
| Real-time data | `background` | Continuous updates |
| Offline app | `keep-stale` | Respect network conditions |
| Critical data | `immediate` | Ensure freshness |

### Cache Key Patterns

```typescript
// Good: Descriptive and unique
const key = `worlds:user:${userId}:page:${page}`;

// Bad: Too generic
const key = 'data';

// Bad: Not unique enough
const key = `worlds-${userId}`;
```

### Tag Organization

```typescript
// Hierarchical tags
const tags = ['worlds', `world:${worldId}`, `user:${userId}`];

// Allows selective invalidation
await QueryCache.invalidateByTags([`world:${worldId}`]); // Specific
await QueryCache.invalidateByTags(['worlds']); // Broad
```

### Error Boundaries

```typescript
function QueryErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div>
          <p>Something went wrong: {error.message}</p>
          <button onClick={resetError}>Try Again</button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
```

## Troubleshooting

### Data Not Updating

**Problem**: Cache shows stale data
**Solutions**:
- Check `staleTime` is appropriate
- Verify invalidation is called with correct tags
- Use `refetch()` for immediate updates

### Too Many Refetches

**Problem**: Excessive network requests
**Solutions**:
- Increase `staleTime`
- Use `keep-stale` strategy
- Add `revalidationCondition`

### Memory Issues

**Problem**: Cache growing too large
**Solutions**:
- Set appropriate `cacheTime`
- Use selective invalidation
- Clear unused cache entries

### Race Conditions

**Problem**: Multiple updates conflicting
**Solutions**:
- Use `selectiveInvalidate` for precision
- Coordinate invalidations
- Use optimistic updates

## Debug Tools

### Cache Inspection

```typescript
// View all cache entries
const entries = await FastCache.getAllEntries();
console.table(entries.map(([key, entry]) => ({
  key,
  age: Date.now() - entry.timestamp,
  tags: entry.tags?.join(', '),
  size: JSON.stringify(entry.data).length
})));

// Check specific entry
const entry = await QueryCache.get('worlds');
console.log('Entry:', entry);
```

### Revalidation Monitoring

```typescript
const { isRevalidating } = useQuery('debug', fetcher);

useEffect(() => {
  console.log('Revalidating:', isRevalidating);
}, [isRevalidating]);
```

### Invalidation Logging

```typescript
// Add to QueryCache
QueryCache.onInvalidate = (tags, strategy) => {
  console.log(`Invalidated tags: ${tags.join(', ')} with strategy: ${strategy}`);
};
```