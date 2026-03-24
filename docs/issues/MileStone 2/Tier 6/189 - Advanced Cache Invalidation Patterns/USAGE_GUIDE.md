# Advanced Cache Invalidation Patterns - Usage Guide

## Overview

The QueryCache system provides four advanced invalidation patterns that solve complex cache management scenarios in React Native and web applications. These patterns work together to provide intelligent, efficient cache invalidation with automatic capacity management.

## When to Use Each Pattern

### Cascading Invalidation
**Use when:** You have hierarchical data relationships where updating a parent should automatically invalidate related children.

**Examples:**
- World → Members, Notes, Characters
- User → Profile, Settings, Preferences
- Organization → Teams, Projects, Members

### Conditional Invalidation
**Use when:** You need to invalidate cache entries based on their content or metadata, not just keys.

**Examples:**
- Invalidate entries with version < current
- Clear cache for users with expired sessions
- Remove entries with corrupted data

### Transactional Invalidation
**Use when:** Multiple invalidations must succeed or fail together to maintain data consistency.

**Examples:**
- User deletion (profile + settings + data)
- World transfer (ownership + access permissions)
- Bulk operations with rollback requirements

### Deferred Invalidation
**Use when:** You want to debounce rapid updates or schedule cleanup operations.

**Examples:**
- Search results during typing
- Real-time data updates
- Background cleanup operations

## Basic Setup

### Configuration

Add cache capacity settings to `appsettings.json`:

```json
{
  "cacheCapacity": {
    "hardMaxBytes": 10485760,        // 10MB mobile, 50MB+ desktop
    "softThreshold": 0.9,            // Evict at 90% capacity
    "targetAfterEviction": 0.7       // Target 70% after cleanup
  }
}
```

### Initialization

The cache invalidation system initializes automatically during app bootstrap via `system/Kernel/phases/storage-phase.ts`. No manual setup required.

## Pattern Usage Examples

### Cascading Invalidation

#### Register Dependencies

```typescript
import { QueryCache } from "@/lib/middleware/storage";

// Register cascade relationships
await QueryCache.registerCascade('world:123', [
  'world:123:members',
  'world:123:notes',
  'world:123:characters',
  'world:123:settings'
]);

// User profile cascades
await QueryCache.registerCascade('user:456', [
  'user:456:profile',
  'user:456:preferences',
  'user:456:sessions'
]);
```

#### Automatic Cascade on Invalidation

```typescript
// Single invalidation cascades to all children
await QueryCache.invalidate('world:123');

// This automatically invalidates:
// - world:123:members
// - world:123:notes
// - world:123:characters
// - world:123:settings
```

#### Debugging Cascades

```typescript
// Check what will be invalidated
const dependencies = await QueryCache.getCascadeDependencies('world:123');
console.log('Will invalidate:', dependencies);
// Output: ['world:123:members', 'world:123:notes', ...]
```

### Conditional Invalidation

#### Version-Based Invalidation

```typescript
// Invalidate worlds with old schema versions
await QueryCache.invalidateIfMatches(
  'world:*',
  (key, entry) => entry.version < 3
);
```

#### Time-Based Invalidation

```typescript
// Invalidate stale sessions
await QueryCache.invalidateIfMatches(
  'session:*',
  (key, entry) => {
    const age = Date.now() - entry.timestamp;
    return age > 24 * 60 * 60 * 1000; // 24 hours
  }
);
```

#### Content-Based Filtering

```typescript
// Invalidate corrupted entries
await QueryCache.invalidateIfMatches(
  'user:*',
  (key, entry) => !entry.data || typeof entry.data !== 'object'
);
```

### Transactional Invalidation

#### User Deletion

```typescript
const result = await QueryCache.transaction(async (tx) => {
  // Invalidate all user-related data atomically
  tx.invalidate('user:123:profile');
  tx.invalidate('user:123:settings');
  tx.invalidate('user:123:sessions');
  tx.invalidateMany([
    'user:123:worlds',
    'user:123:characters',
    'user:123:notes'
  ]);
});

// Check result
if (result.success) {
  console.log(`Invalidated ${result.invalidatedCount} entries`);
} else {
  console.error('Transaction failed:', result.invalidationErrors);
}
```

#### World Transfer

```typescript
const result = await QueryCache.transaction(async (tx) => {
  // Transfer world ownership
  tx.invalidate('world:456:owner');
  tx.invalidate('world:456:permissions');
  tx.invalidate('user:old:worlds');
  tx.invalidate('user:new:worlds');
});
```

### Deferred Invalidation

#### Search Debouncing

```typescript
// Debounce search invalidation during typing
let cancelPreviousSearch: (() => void) | undefined;

function handleSearchInput(query: string) {
  // Cancel previous deferred invalidation
  cancelPreviousSearch?.();

  // Schedule new search after delay
  const { cancelFn } = await QueryCache.invalidateAfter(300, ['search:*']);
  cancelPreviousSearch = cancelFn;

  // Perform search...
}
```

#### Background Cleanup

```typescript
// Schedule cleanup of temporary data
await QueryCache.invalidateAfter(
  5 * 60 * 1000, // 5 minutes
  ['temp:*', 'draft:*']
);
```

## Advanced Usage Patterns

### Combining Patterns

#### Cascade + Transaction

```typescript
// Register cascades
await QueryCache.registerCascade('world:123', ['world:123:*']);

// Use transaction for safety
const result = await QueryCache.transaction(async (tx) => {
  tx.invalidate('world:123'); // Cascades to all world:123:* entries
});
```

#### Conditional + Deferred

```typescript
// Deferred conditional invalidation
const { cancelFn } = await QueryCache.invalidateAfter(1000, [], {
  // Custom executor with conditional logic
  executor: async (patterns) => {
    const result = await QueryCache.invalidateIfMatches(
      'notification:*',
      (key, entry) => entry.priority === 'low'
    );
    return result;
  }
});
```

### Capacity Management

#### Monitoring Usage

```typescript
// Check current capacity status
const capacity = await QueryCache.getLRUCapacityStats();
if (capacity.approaching) {
  console.warn('Cache approaching capacity limit');
}

// Get detailed stats
const stats = await QueryCache.getLRUStats();
console.log(`Cache: ${stats.entryCount} entries, ${stats.totalSize} bytes`);
```

#### Proactive Cleanup

```typescript
// Check before large operations
if (await QueryCache.isApproachingCapacity()) {
  // Perform cleanup or warn user
  await QueryCache.clear(); // Or selective cleanup
}
```

### Error Handling

#### Transaction Error Recovery

```typescript
try {
  const result = await QueryCache.transaction(async (tx) => {
    tx.invalidate('critical:data');
    // ... operations that might fail
  });

  if (!result.success) {
    // Handle partial failures
    console.error('Some invalidations failed:', result.invalidationErrors);
    // Cache is automatically restored to pre-transaction state
  }
} catch (error) {
  // Handle transaction setup failures
  console.error('Transaction failed to start:', error);
}
```

#### Cascade Error Handling

```typescript
try {
  await QueryCache.registerCascade('parent', ['child1', 'child2']);
} catch (error) {
  if (error instanceof CacheInvalidationError) {
    if (error.code === 'INVALID_PARAMS') {
      console.error('Invalid cascade parameters:', error.details);
    }
  }
}
```

## Performance Considerations

### Pattern Selection Guidelines

- **Cascading**: Use for stable hierarchical relationships
- **Conditional**: Use when you need content-based filtering (higher overhead)
- **Transactional**: Use when consistency is critical (snapshot overhead)
- **Deferred**: Use for debouncing (memory overhead for timers)

### Optimization Tips

#### Batch Operations

```typescript
// Instead of multiple calls
await QueryCache.invalidate('key1');
await QueryCache.invalidate('key2');
await QueryCache.invalidate('key3');

// Use transaction for batching
await QueryCache.transaction(async (tx) => {
  tx.invalidateMany(['key1', 'key2', 'key3']);
});
```

#### Pattern Specificity

```typescript
// Prefer specific patterns over wildcards
await QueryCache.invalidate('world:123:members'); // Fast
// vs
await QueryCache.invalidate('world:*:members');   // Slower
```

#### Capacity Awareness

```typescript
// Check capacity before large operations
if (await QueryCache.isApproachingCapacity()) {
  // Use selective invalidation instead of clear()
  await QueryCache.invalidateOlderThan(24 * 60 * 60 * 1000); // 24h
}
```

## Integration with React Hooks

### useQuery Integration

```typescript
import { useQuery } from "@/hooks/storage";

function WorldList() {
  const { data: worlds, isLoading } = useQuery(
    'worlds:list',
    fetchWorlds,
    {
      // Automatic revalidation strategies
      revalidationStrategy: 'background', // or 'immediate', 'keep-stale'
      tags: ['worlds']
    }
  );

  return (
    <div>
      {worlds?.map(world => (
        <WorldItem key={world.id} world={world} />
      ))}
    </div>
  );
}
```

### Optimistic Updates

```typescript
function createWorld(name: string) {
  // Optimistic update
  const rollback = QueryCache.applyOptimisticUpdate(
    (prev: World[]) => [...prev, { id: 'temp', name, status: 'creating' }],
    { tags: ['worlds'] }
  );

  try {
    const newWorld = await api.createWorld(name);
    // Success - optimistic update becomes permanent
    await QueryCache.set(`world:${newWorld.id}`, newWorld, {
      tags: ['worlds']
    });
  } catch (error) {
    // Failure - rollback optimistic update
    rollback();
    throw error;
  }
}
```

## Troubleshooting

### Common Issues

#### Cascade Not Working

```typescript
// Check if cascade is registered
const deps = await QueryCache.getCascadeDependencies('world:123');
if (deps.length === 0) {
  console.error('No cascade registered for world:123');
}
```

#### Transaction Rolling Back

```typescript
const result = await QueryCache.transaction(async (tx) => {
  // Debug: check what operations are queued
  console.log('Queued:', tx.getQueuedInvalidations());

  tx.invalidate('key1');
  tx.invalidate('key2'); // If this fails, all rollback
});

console.log('Errors:', result.invalidationErrors);
```

#### Capacity Issues

```typescript
// Monitor capacity
const capacity = await QueryCache.getLRUCapacityStats();
console.log('Capacity usage:', (capacity.currentSize / capacity.hardMaxBytes) * 100 + '%');

// Force cleanup if needed
if (capacity.approaching) {
  await QueryCache.clear(); // Or selective cleanup
}
```

### Debugging Tools

#### Enable Storage Logging

```json
// In appsettings.dev.json
{
  "featureFlags": {
    "loggerCategories": {
      "storage": true
    }
  }
}
```

#### Cache Inspection

```typescript
// Get all cache stats
const cacheStats = QueryCache.getStats();
const lruStats = await QueryCache.getLRUStats();
const capacityStats = await QueryCache.getLRUCapacityStats();

console.log('Cache inspection:', {
  cacheStats,
  lruStats,
  capacityStats
});
```

## Best Practices

### Pattern Selection

1. **Start with basic invalidation** (`invalidate(key)`)
2. **Add cascading** for hierarchical data
3. **Use conditional** for content-based filtering
4. **Wrap in transactions** for consistency-critical operations
5. **Apply deferred** for debouncing scenarios

### Performance

1. **Monitor capacity** regularly
2. **Use specific patterns** over wildcards
3. **Batch operations** with transactions
4. **Clean up deferred operations** when components unmount
5. **Test with realistic data sizes**

### Error Handling

1. **Always check transaction results**
2. **Handle cascade registration failures**
3. **Monitor for circular dependencies**
4. **Implement fallbacks** for critical operations
5. **Log errors** for debugging

### Maintenance

1. **Review cascade registrations** periodically
2. **Monitor cache capacity usage**
3. **Update conditional predicates** as data schemas evolve
4. **Test transaction rollback scenarios**
5. **Profile performance** in production</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\Tier 6\189 - Advanced Cache Invalidation Patterns\USAGE_GUIDE.md