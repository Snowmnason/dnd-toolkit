# Pagination & Optimization Implementation Guide

This guide documents the architecture and implementation of pagination, request deduplication, and optimistic updates for data loading optimization in the dnd-toolkit app.

## Architecture Overview

The optimization system uses **two complementary layers**:

### 1. QueryCache Layer (SWR - Stale-While-Revalidate)
**For READ operations:**
- **Request deduplication** via `fetchWithDedupe()` - Prevents duplicate concurrent API calls
- **SWR caching** with configurable stale and cache times
- **Tag-based invalidation** - Invalidate related queries when data changes
- **Optimistic updates** - Show changes instantly before server response
- **Automatic subscription** - Components re-render when cache updates

Used by: `useQuery()` hook → consumed by data hooks (`useWorldsQuery`, `useCurrentUserQuery`)

### 2. RequestManager Layer (Retries & Error Handling)
**For WRITE operations:**
- **Retry logic** with exponential backoff (default 3 retries)
- **Rate limiting** via token bucket algorithm
- **Timeout handling** (default 15 seconds for writes)
- **Error reporting** to Sentry
- **Fail-open mode** for graceful degradation

Used by: Direct database writes (`worldsDB.create()`, `usersDB.update()`, etc.)

## When to Use Each System

```
Is this a READ operation? 
├─ YES → Use via useQuery() hook (QueryCache handles it automatically)
│        Example: useWorldsQuery(), useCurrentUserQuery()
└─ NO (WRITE) → Wrap in RequestManager.fetch()
               Example: worldsDB.create(), usersDB.update()
```

## Implementation Patterns

### Pattern 1: Read Operations (QueryCache + SWR)

✅ **CORRECT - Read operation through useQuery hook:**
```typescript
export function useWorldsQuery(options: { page?: number; limit?: number } = {}) {
  const { data, error, isLoading } = useQuery(
    `worlds:list:${options.page || 1}:${options.limit || 20}`,
    () => worldsDB.getMyWorldsPaginated(undefined, options),
    {
      staleTime: 2 * 60 * 60 * 1000,  // 2 hours
      cacheTime: 4 * 60 * 60 * 1000,  // 4 hours
      tags: ['worlds'],                // For cache invalidation
    }
  );

  return {
    worlds: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}
```

### Pattern 2: Write Operations (RequestManager)

✅ **CORRECT - Write operation with RequestManager:**
```typescript
async create(worldData: CreateWorldData): Promise<World> {
  return RequestManager.fetch(
    `worlds:create:${Date.now()}`,  // Unique key per write
    async () => {
      // Validate before write
      const currentUser = await validateUserForWrite();
      
      // Perform database write
      const { data, error } = await supabase
        .from('worlds')
        .insert({ ...worldData, owner_id: currentUser.id })
        .select()
        .single();
      
      if (error) throw new Error(error.message);
      
      // Invalidate related cache on success
      await QueryCache.invalidateByTags(['worlds', `user:${currentUser.id}`]);
      
      return data;
    },
    {
      dedupe: false,      // Never dedupe writes
      retries: 3,         // Retry up to 3 times
      timeout: 15000,     // 15 second timeout
    }
  );
}
```

### Pattern 3: Optimistic Updates (Instant UI Feedback)

✅ **CORRECT - Optimistic update in mutation:**
```typescript
export function useCreateWorldMutation() {
  const { mutate, isLoading, error } = useMutation<World, CreateWorldData>(
    (variables: any) => worldsDB.create(variables as CreateWorldData),
    {
      invalidateTags: ['worlds'],
      optimisticUpdate: (variables: any) => {
        // Return updater function that transforms cached data
        if (variables.optimisticWorld) {
          return (prevData: any) => {
            // Handle both paginated and non-paginated formats
            if (prevData?.items) {
              return {
                ...prevData,
                items: [variables.optimisticWorld, ...prevData.items],
                total: prevData.total + 1,
              };
            }
            return prevData;
          };
        }
        return undefined;
      },
      optimisticTags: ['worlds'],  // Only update 'worlds' tagged entries
    },
  );

  return { mutate, isLoading, error };
}
```

## Pagination Implementation

### Database Layer: getMyWorldsPaginated()

Handles role merging logic at application layer:

```typescript
async getMyWorldsPaginated(
  userId?: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ items: WorldWithAccess[]; total: number }> {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  // STEP 1: Get world IDs from both world_access and owned worlds
  // STEP 2: Collect all unique IDs and build role mapping (owner > member)
  // STEP 3: Cache the ID list (5min TTL) to avoid re-fetching for each page
  // STEP 4: Fetch paginated worlds using collected IDs
  // STEP 5: Map worlds with their roles
  
  return { items: paginatedWorlds, total: totalWorlds };
}
```

**Why this approach?**
- Merges owner + member roles (owner takes precedence)
- SQL can't easily handle this precedence logic
- World ID caching (5min TTL) makes page 2+ queries 50% faster
- Works well for typical users with <100 worlds

**When to optimize further:**
- If users commonly have 1000+ worlds
- Create database view that handles role precedence
- Implement cursor-based pagination on server

### Hook Layer: useWorldsQuery()

Provides flexible pagination interface:

```typescript
// Get all worlds (no pagination)
const { worlds, isLoading } = useWorldsQuery();

// Get paginated worlds
const { worlds, total, isLoading } = useWorldsQuery({ page: 2, limit: 20 });

// Handle pagination in UI
{total && <Text>Page 1 of {Math.ceil(total / limit)}</Text>}
```

## Performance Optimizations

### 1. Request Deduplication
**What:** Multiple simultaneous requests for same data return same result
```typescript
// These both call getMyWorldsPaginated once:
useWorldsQuery({ page: 1 });  // First call
useWorldsQuery({ page: 1 });  // Reuses first call's result
```

### 2. Cache Invalidation by Tags
**What:** Group related queries and invalidate together
```typescript
// Invalidate all 'worlds' queries when world changes
await QueryCache.invalidateByTags(['worlds']);

// Invalidate specific user's worlds
await QueryCache.invalidateByTags([`user:${userId}`]);
```

### 3. Optimistic Updates Filtering
**What:** Only update relevant cache entries
```typescript
// Only update 'worlds' tagged entries (ignore others)
applyOptimisticUpdate(updater, { tags: ['worlds'] });

// Only update cache keys matching pattern
applyOptimisticUpdate(updater, { keyPattern: /^worlds:/ });
```

### 4. World ID Caching
**What:** Cache the ID list separately to reuse across pagination
```typescript
// Subsequent page requests reuse cached IDs (5min TTL)
const page1 = await getMyWorldsPaginated(userId, { page: 1 });  // Fetches IDs
const page2 = await getMyWorldsPaginated(userId, { page: 2 });  // Reuses cached IDs
```

## Database Operations Coverage

### Worlds Operations

| Operation | Uses | Status |
|-----------|------|--------|
| `getMyWorlds()` | QueryCache via useQuery | ✅ Optimized |
| `getMyWorldsPaginated()` | QueryCache via useQuery | ✅ Optimized |
| `create()` | RequestManager | ✅ Implemented |
| `update()` | RequestManager | ✅ Implemented |
| `updateName()` | RequestManager | ✅ Implemented |
| `delete()` | RequestManager | ✅ Implemented |
| `addUserToWorld()` | RequestManager | ✅ Implemented |
| `removeUserFromWorld()` | RequestManager | ✅ Implemented |
| `getById()` | RequestManager (direct API) | ✅ Existing |
| `getWorldMembers()` | RequestManager (direct API) | ✅ Existing |

### Users Operations

| Operation | Uses | Status |
|-----------|------|--------|
| `getCurrentUser()` | RequestManager (read) | ✅ Optimized |
| `useCurrentUserQuery()` | QueryCache via useQuery | ✅ Optimized |
| `create()` | RequestManager | ✅ Implemented |
| `update()` | RequestManager | ✅ Implemented |
| `delete()` | RequestManager | ✅ Implemented |

## Troubleshooting

### Problem: Cache not invalidating after mutation
**Solution:** Ensure mutation has correct `invalidateTags`:
```typescript
// ✅ CORRECT
useMutation(dbFn, {
  invalidateTags: ['worlds'],  // Matches tags in useQuery
});

// ❌ WRONG
useMutation(dbFn, {
  invalidateTags: ['items'],   // Doesn't match
});
```

### Problem: Optimistic update not showing
**Solution:** Ensure optimisticTags match query tags:
```typescript
// useQuery uses tags: ['worlds']
useQuery('worlds:list', fn, { tags: ['worlds'] });

// useMutation must target same tags
useMutation(fn, { optimisticTags: ['worlds'] });
```

### Problem: Duplicate API calls
**Solution:** Use QueryCache or RequestManager deduplication:
```typescript
// ✅ CORRECT - Handled by useQuery
const { data } = useQuery('key', fetcher, { tags: ['worlds'] });

// ❌ WRONG - Direct Supabase calls bypass deduplication
const data = await supabase.from('worlds').select();
```

## Best Practices

1. **Always use hooks for reads** - Let `useQuery` handle caching
2. **Wrap writes with RequestManager** - Adds retry logic for reliability
3. **Use proper tags** - Makes cache invalidation predictable
4. **Optimize updates filter** - Use `optimisticTags` to target specific entries
5. **Test pagination** - Verify data consistency across pages
6. **Monitor error rates** - RequestManager reports all errors to Sentry

## Related Documentation

- [QueryCache Strategy](../MileStone%201/101%20-%20Query%20Cache/CACHE_STRATEGY.md)
- [Request Manager](../MileStone%201/035%20-%20Api%20RequestLayer/REQUEST_MANAGER.md)
- [Central Storage](../MileStone%201/082%20-%20Central%20Storage/SECURE_STORAGE.md)
