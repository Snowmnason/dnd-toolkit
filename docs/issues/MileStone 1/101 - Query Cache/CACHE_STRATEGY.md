# Phase 4: Cache Key Strategy & Best Practices

## Overview

This phase establishes conventions for cache keys, tags, and staleness across the application. Consistent naming enables efficient invalidation, prevents cache collisions, and makes the cache layer predictable and maintainable.

---

## 1. Cache Key Naming Convention

### Hierarchical Pattern: `domain:entity:action:identifier`

Cache keys should be hierarchical and specific, following this pattern:

```
domain       : cache domain (worlds, notes, users, invites, etc.)
entity       : entity type or specific identifier
action       : optional action/property (details, members, list, etc.)
identifier   : optional resource ID
```

### Examples

**✅ Good Cache Keys** (hierarchical, specific)

```typescript
// World queries
'worlds:list'                      // All worlds for current user
'worlds:list:owned'                // Only owned worlds
'world:abc123:details'             // Specific world details
'world:abc123:members'             // Members of a world
'world:abc123:invites'             // Invite links for a world
'world:abc123:notes'               // Notes in a world
'world:abc123:note:xyz789'         // Specific note in world

// User queries
'users:current'                    // Current user profile
'user:abc123'                      // Specific user profile
'user:abc123:preferences'          // User preferences

// Character queries
'world:abc123:characters'          // All characters in world
'world:abc123:character:xyz'       // Specific character in world

// Session/temporary data
'session:active-world'             // Currently active world
'session:draft:world-create'       // Draft for world creation
```

**❌ Bad Cache Keys** (ambiguous, non-hierarchical)

```typescript
'getWorlds'                        // Verb-based, unclear scope
'worldData'                        // Too generic
'currentUser'                      // State-dependent, unclear timing
'data'                             // Not descriptive
'worlds_for_user_123'              // Inconsistent format
```

### Key Naming Rules

1. **Use colons (`:`) as separators** - consistent, easy to parse
2. **Start with domain** - groups related queries
3. **Avoid user IDs in main key** - use tags instead for user-specific queries
4. **Be specific** - distinguish `list` from `details`
5. **Lowercase with colons** - follows Redis conventions

### Dynamic Keys with User Context

For user-specific data, include user ID in the key:

```typescript
// ✅ Good: User ID in key makes it query-specific
const key = `worlds:user:${userId}`;
await QueryCache.set(key, worlds, { tags: ['worlds', `user:${userId}`] });

// ✅ Good: Current user uses special marker
const key = 'worlds:user:current';
await QueryCache.set(key, worlds, { tags: ['worlds', 'current-user'] });

// ❌ Avoid: Relying only on component state
const key = 'worlds'; // Which user? Ambiguous!
```

---

## 2. Tag Strategy

Tags enable efficient bulk invalidation without key patterns. Use tags to group related queries logically.

### Tag Hierarchy

```typescript
// Top-level domains
['worlds']                         // Any world query
['users']                          // Any user query
['notes']                          // Any note query

// Entity-specific
['worlds', 'world:abc123']         // All queries for world abc123
['users', 'user:xyz789']           // All queries for user xyz789

// User-scoped
['worlds', 'user:123']             // Worlds visible to user 123
['worlds', 'user:123:owned']       // Worlds owned by user 123

// Feature-specific
['worlds', 'members']              // Queries involving world members
['users', 'profiles']              // User profile queries
```

### Tag Usage Examples

```typescript
// Creating a world invalidates all world lists
async create(worldData: CreateWorldData): Promise<World> {
  const world = await supabase.from('worlds').insert(worldData).single();
  await QueryCache.invalidateByTags(['worlds']);  // All world queries stale
  return world;
}

// Updating a world invalidates specific world + lists
async update(worldId: string, updates: Partial<World>): Promise<World> {
  const world = await supabase.from('worlds').update(updates).single();
  await QueryCache.invalidateByTags(['worlds', `world:${worldId}`]);
  return world;
}

// Adding user to world invalidates member + user-specific queries
async addMember(worldId: string, userId: string): Promise<void> {
  await supabase.from('world_access').insert({ world_id: worldId, user_id: userId });
  await QueryCache.invalidateByTags([
    `world:${worldId}:members`,
    `user:${userId}:worlds`,
  ]);
}

// Deleting user account invalidates all their data
async deleteAccount(userId: string): Promise<void> {
  await supabase.rpc('delete_user_and_data', { user_id: userId });
  await QueryCache.invalidateByTags([`user:${userId}`]);  // All user queries
}
```

### Tag Naming Rules

1. **Use domain:entity format** - matches cache key structure
2. **Keep tags simple** - 1-3 words, lowercase with colons
3. **Enable efficient filtering** - use tags that group logically
4. **Document tag meaning** - what gets invalidated?

---

## 3. Staleness Guidelines

Staleness determines when background revalidation occurs. Different data types have different update frequencies and consistency requirements.

### Staleness Tiers

| Tier | Data Type | Stale Time | Rationale |
|------|-----------|-----------|-----------|
| **Realtime** | Presence, chat, active sessions | 30 seconds | Users need immediate updates |
| **Near-realtime** | Character positions, health | 5-15 seconds | Used in active play, needs accuracy |
| **User-generated** | Notes, character data, world settings | 5-30 minutes | Changes less frequently, eventual consistency OK |
| **Metadata** | World names, descriptions, ownership | 1-2 hours | Rarely changes, users don't expect instant updates |
| **Reference** | Maps, system definitions, static content | 24 hours | Changes very rarely or never during session |

### Implementation Examples

```typescript
// Realtime: Active session data
useQuery('session:active-position', fetchPosition, {
  staleTime: 30 * 1000,        // 30 seconds
  cacheTime: 5 * 60 * 1000,    // 5 minutes
  tags: ['session', 'realtime'],
});

// Near-realtime: Character state during play
useQuery(`character:${charId}:state`, fetchCharacterState, {
  staleTime: 10 * 1000,        // 10 seconds
  cacheTime: 1 * 60 * 1000,    // 1 minute
  tags: ['characters', `character:${charId}`],
});

// User-generated: Notes and character data
useQuery(`world:${worldId}:notes`, fetchNotes, {
  staleTime: 15 * 60 * 1000,   // 15 minutes
  cacheTime: 1 * 60 * 60 * 1000, // 1 hour
  tags: ['notes', `world:${worldId}`],
});

// Metadata: World lists and details
useQuery('worlds:list', fetchWorlds, {
  staleTime: 2 * 60 * 60 * 1000,  // 2 hours
  cacheTime: 4 * 60 * 60 * 1000,  // 4 hours
  tags: ['worlds'],
});

// Reference: Static data (rare updates)
useQuery('systems:definitions', fetchSystemDefs, {
  staleTime: 24 * 60 * 60 * 1000,  // 24 hours
  cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  tags: ['reference', 'systems'],
});
```

### Staleness Decision Tree

```
Does data change during a user session?
├─ YES (every minute or faster)
│  └─ Use 30-60 second staleTime (realtime)
├─ YES (every few minutes)
│  └─ Use 5-15 minute staleTime (near-realtime)
├─ SOMETIMES (user-generated, can change anytime)
│  └─ Use 15-30 minute staleTime (eventual consistency)
├─ RARELY (world names, ownership, metadata)
│  └─ Use 1-2 hour staleTime (stable)
└─ NEVER (system definitions, maps)
   └─ Use 24 hour staleTime (reference)
```

---

## 4. Cache Time vs Stale Time

**Don't confuse these:**

- **`staleTime`** - When does background revalidation start?
  - If `isStale()` returns true, fetch fresh data in background
  - User sees old data while fresh data is fetching
  - Stale-While-Revalidate pattern
  
- **`cacheTime`** - When is data completely removed from cache?
  - If age > cacheTime, data is deleted
  - User gets "loading" state if no cached data
  - Safety valve for preventing unbounded cache growth

**Rule of thumb:**
- `cacheTime` should be 2-4x `staleTime`
- Provides buffer for background revalidation to complete
- Ensures user always sees something (old data or loading)

```typescript
// Example: 15-minute user-generated content
{
  staleTime: 15 * 60 * 1000,      // Revalidate after 15 min
  cacheTime: 60 * 60 * 1000,      // Remove after 1 hour
  // Gap: 45 minutes for background revalidation
}

// Example: Metadata (rare changes)
{
  staleTime: 2 * 60 * 60 * 1000,   // Revalidate after 2 hours
  cacheTime: 4 * 60 * 60 * 1000,   // Remove after 4 hours
  // Gap: 2 hours for background revalidation
}
```

---

## 5. Common Query Patterns

### Pattern 1: World List Query

```typescript
// In database layer
async getMyWorlds(userId?: string): Promise<WorldWithAccess[]> {
  // ... fetch logic ...
}

// In hook layer
export function useWorldsQuery() {
  return useQuery(
    'worlds:list',
    () => worldsDB.getMyWorlds(),
    {
      staleTime: 2 * 60 * 60 * 1000,
      cacheTime: 4 * 60 * 60 * 1000,
      tags: ['worlds'],
    }
  );
}

// In component
function WorldsList() {
  const { worlds, isLoading } = useWorldsQuery();
  // ...
}

// When creating a world
async function handleCreateWorld(data: CreateWorldData) {
  const newWorld = await worldsDB.create(data);
  // Invalidates: worlds:list query revalidates in background
  // Users see old list + background fetch for new list
}
```

### Pattern 2: Specific Entity Query (with Patterns)

```typescript
// In hook
export function useWorldDetailsQuery(worldId: string) {
  return useQuery(
    `world:${worldId}:details`,
    () => worldsDB.getWorld(worldId),
    {
      staleTime: 2 * 60 * 60 * 1000,
      tags: ['worlds', `world:${worldId}`],
    }
  );
}

// When updating that world
async function handleUpdateWorld(worldId: string, updates: Partial<World>) {
  const updated = await worldsDB.update(worldId, updates);
  // Invalidates all queries matching world:worldId:*
  await QueryCache.invalidate(`world:${worldId}:*`);
}
```

### Pattern 3: User-Scoped Query

```typescript
// In hook
export function useUserWorldsQuery(userId: string) {
  return useQuery(
    `worlds:user:${userId}`,
    () => worldsDB.getWorldsForUser(userId),
    {
      staleTime: 2 * 60 * 60 * 1000,
      tags: ['worlds', `user:${userId}`],
    }
  );
}

// When user is removed from world
async function removeUserFromWorld(worldId: string, userId: string) {
  await worldsDB.removeUserFromWorld(worldId, userId);
  // Invalidates only that user's world list
  await QueryCache.invalidateByTags([`user:${userId}`]);
}
```

---

## 6. Anti-Patterns to Avoid

### ❌ Overly Broad Keys

```typescript
// BAD: Same key for different operations
const key = 'world:data';
// Later...
const key2 = 'world:data'; // Is this the same data? Unknown!

// GOOD: Specific keys
const listKey = 'world:list';
const detailsKey = `world:${id}:details`;
const membersKey = `world:${id}:members`;
```

### ❌ Inconsistent Invalidation

```typescript
// BAD: Sometimes invalidate, sometimes don't
async update(id: string, data: any) {
  const result = await db.update(id, data);
  // Forgot to invalidate!
  return result;
}

// GOOD: Always invalidate after mutations
async update(id: string, data: any) {
  const result = await db.update(id, data);
  await QueryCache.invalidateByTags(['items', `item:${id}`]);
  return result;
}
```

### ❌ Relying Only on Patterns

```typescript
// OKAY but less efficient (regex matching all keys)
await QueryCache.invalidate(/^world:.*/);

// BETTER: Use tags for efficiency
await QueryCache.invalidateByTags(['worlds']);
```

### ❌ TTL Without Invalidation

```typescript
// BAD: Relying on cache expiration for mutations
async create(item: Item) {
  const result = await db.insert(item);
  // Wait for cache to expire in 2 hours? No!
  return result;
}

// GOOD: Invalidate immediately
async create(item: Item) {
  const result = await db.insert(item);
  await QueryCache.invalidateByTags(['items']);
  return result;
}
```

---

## 7. Monitoring & Debugging

### Cache Stats Hook

```typescript
import { QueryCache } from '@/lib/cache';

export function useCacheStats() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // Get cache stats
    const cacheStats = QueryCache.getStats();
    setStats(cacheStats);

    logger.category('cache').debug('Cache stats:', cacheStats);
  }, []);

  return stats;
}
```

### Logging Best Practices

```typescript
// Log cache hits vs misses
logger.category('cache').debug('Cache hit:', { key, age: Date.now() - entry.timestamp });
logger.category('cache').debug('Cache miss:', { key, revalidating: true });

// Log invalidations
logger.category('cache').info('Invalidated by tags:', { tags, affectedKeys: count });

// Log errors
logger.category('cache').error('Failed to fetch fresh data:', { key, error });
```

### DevTools Integration (Future)

Future versions can include:
- Visual cache browser
- Hit/miss rate graphs
- Staleness timeline
- Invalidation audit log

---

## Summary

| Aspect | Best Practice |
|--------|----------------|
| **Key Format** | `domain:entity:action:id` (hierarchical, specific) |
| **Tags** | Group logically by domain and entity |
| **Stale Time** | 30sec-2h depending on data update frequency |
| **Cache Time** | 2-4x stale time for revalidation buffer |
| **Invalidation** | Always on mutations, use tags over patterns |
| **Monitoring** | Log cache operations for debugging |

This establishes a predictable, maintainable cache layer that scales with the application.
