# API Reference: Pagination & Optimization

## QueryCache API

### useQuery Hook

**Location:** `lib/cache/use-query.ts`

```typescript
function useQuery<T>(
  key: string,                    // Cache key (unique identifier)
  fetcher: (key: string) => Promise<T>,  // Fetch function
  options?: UseQueryOptions
): UseQueryState<T>
```

**Options:**
```typescript
interface UseQueryOptions {
  staleTime?: number;             // Milliseconds until data is stale (default: 7200000 = 2h)
  cacheTime?: number;             // Milliseconds to keep in cache (default: 14400000 = 4h)
  revalidateOnFocus?: boolean;    // Auto-refetch if stale when window regains focus (default: true)
  disabled?: boolean;             // Disable this query (default: false)
  tags?: string[];               // Tags for cache invalidation
  onSuccess?: (data: T) => void;  // Callback on successful fetch
  onError?: (error: Error) => void; // Callback on error
}
```

**Return Value:**
```typescript
interface UseQueryState<T> {
  data: T | undefined;            // Cached data
  isLoading: boolean;             // True during initial load
  isValidating: boolean;          // True during background revalidation
  error: Error | undefined;       // Current error
  refetch: () => Promise<void>;   // Manually refetch
  invalidate: () => Promise<void>; // Manually invalidate and refetch
}
```

**Usage Examples:**

```typescript
// Basic read
const { data, isLoading, error } = useQuery(
  'worlds:list',
  () => worldsDB.getMyWorlds(),
  { tags: ['worlds'] }
);

// With options
const { data, isValidating } = useQuery(
  'users:current',
  () => usersDB.getCurrentUser(),
  {
    staleTime: 60 * 60 * 1000,      // 1 hour
    cacheTime: 4 * 60 * 60 * 1000,  // 4 hours
    revalidateOnFocus: true,
    tags: ['users'],
    onSuccess: (data) => console.log('User loaded:', data),
    onError: (err) => console.error('Load failed:', err),
  }
);

// Pagination support
const { data: paginatedWorlds } = useQuery(
  `worlds:list:${page}:${limit}`,
  () => worldsDB.getMyWorldsPaginated(undefined, { page, limit }),
  { tags: ['worlds'] }
);
```

### QueryCache API

**Location:** `lib/cache/query-cache.ts`

```typescript
// Get cached data
async get<T>(key: string): Promise<T | null>

// Set cached data with options
async set<T>(
  key: string,
  data: T,
  options?: CacheOptions,
  requestVersion?: number
): Promise<void>

// Check if cached data is stale
async isStale(key: string): Promise<boolean>

// Fetch with deduplication
async fetchWithDedupe<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T>

// Apply optimistic update to cache
applyOptimisticUpdate(
  updater: (prev: any) => any,
  options?: { tags?: string[]; keyPattern?: RegExp }
): () => void  // Returns revert function

// Invalidate by tags
async invalidateByTags(tags: string[]): Promise<void>

// Invalidate by pattern
async invalidate(pattern: string | RegExp): Promise<void>

// Clear all cache
async clear(): Promise<void>

// Subscribe to cache updates
subscribe(key: string, callback: (key: string, data: any) => void): () => void

// Get debug stats
getStats(): { cacheSize: number; subscribers: number; keys: string[] }
```

**Usage Examples:**

```typescript
import { QueryCache } from '@/lib/cache';

// Direct cache access
const cachedData = await QueryCache.get('worlds:list');
await QueryCache.set('worlds:list', newData, { tags: ['worlds'] });

// Deduplication
const result = await QueryCache.fetchWithDedupe('key', async () => {
  return await expensiveOperation();
});

// Invalidation by tags
await QueryCache.invalidateByTags(['worlds', 'user:123']);

// Invalidation by pattern
await QueryCache.invalidate(/^worlds:/);  // Invalidate all worlds queries
await QueryCache.invalidate('worlds:list'); // Exact match

// Subscribe to updates
const unsubscribe = QueryCache.subscribe('worlds:list', (key, data) => {
  console.log(`Cache updated for ${key}`, data);
});
unsubscribe();  // Stop listening

// Debug
console.log(QueryCache.getStats());
// { cacheSize: 5, subscribers: 2, keys: ['worlds:list', 'user:123', ...] }
```

## useMutation Hook

**Location:** `lib/cache/use-mutation.ts`

```typescript
function useMutation<TData = unknown, TError = Error>(
  mutationFn: (variables: unknown) => Promise<TData>,
  options?: UseMutationOptions<TData, TError>
): UseMutationState<TData, TError>
```

**Options:**
```typescript
interface UseMutationOptions<TData, TError> {
  onSuccess?: (data: TData) => void;
  onError?: (error: TError) => void;
  invalidateTags?: string[];                          // Tags to invalidate after success
  invalidatePatterns?: (string | RegExp)[];          // Patterns to invalidate
  optimisticUpdate?: (variables: unknown) => ((prev: any) => any) | undefined;  // Optimistic updater
  optimisticTags?: string[];                         // Tags to target for optimistic updates
  optimisticKeyPattern?: RegExp;                     // Key pattern to target for optimistic updates
}
```

**Return Value:**
```typescript
interface UseMutationState<TData, TError> {
  data: TData | undefined;
  isLoading: boolean;
  error: TError | undefined;
  mutate: (variables: unknown) => Promise<TData>;
  reset: () => void;
}
```

**Usage Examples:**

```typescript
// Basic mutation
const { mutate, isLoading, error } = useMutation(
  (data) => worldsDB.create(data),
  {
    onSuccess: (result) => console.log('Created:', result),
    onError: (err) => console.error('Failed:', err),
  }
);

// Mutation with cache invalidation
const { mutate } = useMutation(
  (data) => worldsDB.update(data.worldId, data),
  {
    invalidateTags: ['worlds'],  // Invalidate all worlds queries
  }
);

// Mutation with optimistic update
const { mutate } = useMutation(
  (data) => worldsDB.create(data),
  {
    invalidateTags: ['worlds'],
    optimisticUpdate: (variables: any) => {
      // Return updater function
      return (prevData) => {
        if (prevData?.items) {
          return {
            ...prevData,
            items: [variables.optimisticWorld, ...prevData.items],
            total: prevData.total + 1,
          };
        }
        return prevData;
      };
    },
    optimisticTags: ['worlds'],  // Only update worlds cache
  }
);

// Execute mutation
await mutate({ name: 'New World', description: '...' });

// Reset state
reset();
```

## RequestManager API

**Location:** `lib/api/request-manager.ts`

```typescript
async fetch<T>(
  key: string,                    // Unique request key
  fetcher: () => Promise<T>,      // Fetch function
  options?: RequestOptions
): Promise<T>
```

**Options:**
```typescript
interface RequestOptions {
  dedupe?: boolean;               // Prevent duplicate concurrent requests (default: true)
  retries?: number;               // Number of retries on failure (default: 3)
  timeout?: number;               // Request timeout in milliseconds (default: 30000)
  failOpen?: boolean;             // Return null on failure instead of throwing (default: false)
}
```

**Usage Examples:**

```typescript
import { RequestManager } from '@/lib/api/request-manager';

// Write operation with retries
const newWorld = await RequestManager.fetch(
  `worlds:create:${Date.now()}`,
  async () => {
    const user = await validateUserForWrite();
    const { data, error } = await supabase
      .from('worlds')
      .insert({ ...worldData, owner_id: user.id })
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    
    await QueryCache.invalidateByTags(['worlds']);
    return data;
  },
  {
    dedupe: false,  // Never dedupe writes
    retries: 3,
    timeout: 15000,
  }
);

// Read operation with deduplication
const worldId = await RequestManager.fetch(
  `world:detail:${worldId}`,
  async () => {
    const { data, error } = await supabase
      .from('worlds')
      .select('*')
      .eq('world_id', worldId)
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },
  {
    dedupe: true,   // Reuse concurrent requests
    retries: 2,
    timeout: 10000,
  }
);

// Fail-open mode for offline support
const data = await RequestManager.fetch(
  'optional:operation',
  async () => somethingThatMightFail(),
  { failOpen: true }  // Returns null instead of throwing
);

if (!data) {
  console.log('Operation failed, showing cached data');
}
```

## Data Hooks

### useWorldsQuery

**Location:** `hooks/use-worlds-query.tsx`

```typescript
function useWorldsQuery(options?: { page?: number; limit?: number })

interface UseWorldsQueryResult {
  worlds: WorldWithAccess[];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}
```

**Usage:**

```typescript
// Get all worlds
const { worlds, isLoading } = useWorldsQuery();

// Get paginated worlds
const { worlds, total, isLoading } = useWorldsQuery({ page: 2, limit: 20 });

// Render with pagination
const totalPages = Math.ceil(total / 20);
{total && <Text>Page 1 of {totalPages}</Text>}

// Manual refresh
const { refetch } = useWorldsQuery();
await refetch();
```

### useCurrentUserQuery

**Location:** `hooks/use-users-query.tsx`

```typescript
function useCurrentUserQuery()

interface UseCurrentUserQueryResult {
  user: User | null;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
}
```

**Usage:**

```typescript
const { user, isLoading, error } = useCurrentUserQuery();

if (isLoading) return <Loading />;
if (!user) return <NotAuthenticated />;

return <UserProfile user={user} />;
```

### useCreateWorldMutation

**Location:** `hooks/use-worlds-mutation.tsx`

```typescript
function useCreateWorldMutation()

interface UseCreateWorldMutationResult {
  mutate: (data: CreateWorldData & { optimisticWorld?: World }) => Promise<World>;
  world: World | null;
  isLoading: boolean;
  error: string | null;
}
```

**Usage:**

```typescript
const { mutate, isLoading, error } = useCreateWorldMutation();

const optimisticWorld: World = {
  world_id: 'temp-' + Date.now(),
  owner_id: userId,
  name: 'New World',
  // ... other fields
};

await mutate({
  name: 'New World',
  description: 'A great adventure',
  system: 'dnd5e',
  is_dm: true,
  optimisticWorld,  // For instant UI feedback
});
```

### useUpdateUserMutation

**Location:** `hooks/use-users-mutation.tsx`

```typescript
function useUpdateUserMutation()

interface UseUpdateUserMutationResult {
  mutate: (data: UpdateUserData) => Promise<User>;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}
```

**Usage:**

```typescript
const { mutate, isLoading } = useUpdateUserMutation();

await mutate({ username: 'newusername' });
```
