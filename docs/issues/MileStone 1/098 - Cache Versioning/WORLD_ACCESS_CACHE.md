# World Access Cache - Storage & Verification

This document explains how world access is cached and verified in the D&D Toolkit.

## Overview

World access is cached locally to provide fast navigation while maintaining security through periodic Supabase verification.

**Key principle:** Cache is fast (<15ms), Supabase is authoritative.

## Cache Strategy

### Why Cache?

- **Speed:** Instant access to worlds user can enter
- **Offline:** Continue playing even with temporary network issues
- **Scale:** Reduce database queries by 95%
- **Security:** Verify periodically to catch access revocations

### Cache Locations

All world access data is stored in `SecureStorage` (encrypted):

```typescript
// Boolean: does user have access to this world?
STORAGE_KEYS.world_access_abc123 = true

// Metadata: when was this cached and where did it come from?
STORAGE_KEYS.world_access_meta_abc123 = {
  timestamp: 1705276800000,    // When cached (milliseconds since epoch)
  source: 'supabase'           // Where data came from
}
```

## Cache Lifecycle

### Population (Writing Cache)

Cache is written when:

1. **Server loads worlds** - When `useWorlds` hook fetches user's worlds:
   ```typescript
   // Server only returns worlds user can access
   // Safe to cache as true immediately
   for (const world of loadedWorlds) {
     await SecureStorage.setJSON(`world_access_${world.id}`, true);
     await SecureStorage.setJSON(`world_access_meta_${world.id}`, {
       timestamp: Date.now(),
       source: 'server_verified'
     });
   }
   ```

2. **User selects world** - When clicking "Open" on a world:
   ```typescript
   addConnectedWorld(worldId);  // Caches the world
   ```

3. **Guard verifies with Supabase** - When accessing a world:
   - If stale (2-4 hours), guard queries Supabase
   - Result is cached with fresh timestamp

### Consumption (Reading Cache)

Cache is read when:

1. **Guard checks world access** - Before rendering main app
2. **Context loads on startup** - Restores user's previous world
3. **Any world verification** - First check before Supabase query

### Expiration (Staleness Detection)

Cache age is checked by comparing timestamp to current time:

```typescript
const CACHE_STALE_THRESHOLD = 2 * 60 * 60 * 1000; // 2 hours
const cacheAge = Date.now() - metadata.timestamp;

if (cacheAge < CACHE_STALE_THRESHOLD) {
  // Fresh: trust cache, no Supabase needed (~15ms)
  return cachedValue;
} else {
  // Stale: verify with Supabase before allowing (~150ms)
  const dbResult = await checkWithSupabase(worldId);
  // Update cache with fresh result
  return dbResult;
}
```

**Age thresholds:**
- **Fresh** (<2 hours): Trust cache, instant access
- **Stale** (2-4 hours): Verify with Supabase, then access
- **Expired** (>4 hours): Force Supabase check (shouldn't happen due to auto-update)

### Auto-Update Cycle

Cache has a 4-hour auto-update cycle. Every 4 hours:
- `AppParamsStableContext` reloads worlds from server
- Cache is refreshed with fresh timestamp
- User never sees "expired" cache in practice

## Verification Process

### Normal Routes (account-only, world-required)

```
User navigates to world X
    ↓
Guard calls verifyWorldAccessWithDatabase(worldId)
    ↓
Check cache for world_access_X
    ├─ Not found → Query Supabase
    │  ├─ Has access? → Cache as true, allow
    │  └─ No access? → Cache as false, redirect
    │
    └─ Found → Check age
       ├─ Fresh (<2h) → Return true immediately
       │  └─ Latency: ~15ms
       │
       └─ Stale (2-4h) → Query Supabase
          ├─ Has access? → Update cache timestamp, allow
          │  └─ Latency: ~150ms
          │
          └─ No access? → Update cache, redirect
             └─ Latency: ~150ms
```

### Sensitive Routes (forceVerification)

```
User navigates to /settings
    ↓
Guard calls verifyWorldAccessWithDatabase(worldId, { forceFresh: true })
    ↓
Skip cache age check
    ↓
Query Supabase directly
    ├─ Has access? → Update cache, allow
    └─ No access? → Update cache, redirect
    └─ Latency: ~150ms (always checks database)
```

## Supabase Query

The guard queries the `world_access` table in Supabase:

```sql
SELECT id 
FROM world_access 
WHERE world_id = 'abc123' 
  AND user_id = 'user-123'
LIMIT 1;
```

**Result codes:**
- **Row found**: User has access
- **No row (PGRST116 error)**: User doesn't have access
- **Database error**: Graceful fallback (see error handling)

## Error Handling

### Network Errors During Verification

If Supabase query fails (timeout, offline, etc.):

**User already in world:**
```
Cache says: true
Supabase: unavailable
Result: Allow (continue with cached data)
Log: Retry verification in background
```

**User trying to enter world:**
```
Cache: miss or unknown
Supabase: unavailable
Result: Deny conservatively
User redirects to /select/world-selection
Log: Error, cache not available
```

**Never:**
- Block user indefinitely on network errors
- Show error modal to user (graceful degradation)
- Kick user out mid-session for network issues

## Performance Characteristics

### Latency

| Scenario | Time | Description |
|----------|------|-------------|
| Fresh cache | ~15ms | No Supabase call |
| Stale cache | ~150ms | Supabase verification included |
| Missing cache | ~150ms | Supabase query needed |
| Force verification | ~150ms | Always Supabase, ignore cache |

### Database Load

**Before caching:** 100% of navigations hit Supabase  
**After caching:** 5% of navigations hit Supabase  
**Reduction:** 95%

**Assumption:** Average session is 30 minutes, cache age threshold is 2 hours

```
User navigates 10 times per session
10 navigations × 30 minute session = within 2-hour fresh window
Result: 1 Supabase query per 100+ navigations
```

## Cache Debugging

### Logging

The verification system logs important events:

```
[VERIFY:START] Verifying world abc123, forceFresh=false
[VERIFY:FRESH] Cache is fresh (45 min old), allowing immediately
[VERIFY:STALE] Cache is stale (2.5 hours old), checking Supabase...
[VERIFY:FORCE] Force fresh check requested, skipping cache
✅ Verification complete - user has access
```

### Checking Cache

To debug cache in development:

```typescript
// In console
import { SecureStorage } from '@/lib/storage';
const cache = await SecureStorage.getJSON('world_access_abc123');
const meta = await SecureStorage.getJSON('world_access_meta_abc123');
console.log('Cache:', cache);
console.log('Meta:', meta, 'Age:', Date.now() - meta.timestamp);
```

### Clearing Cache

To clear all cache:

```typescript
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';

// Clear single world
await SecureStorage.removeItem(STORAGE_KEYS.world_access_abc123);
await SecureStorage.removeItem(STORAGE_KEYS.world_access_meta_abc123);

// Clear all world access
const connectedWorlds = await SecureStorage.getJSON(STORAGE_KEYS.CONNECTED_WORLDS);
for (const worldId of connectedWorlds) {
  await SecureStorage.removeItem(`world_access_${worldId}`);
  await SecureStorage.removeItem(`world_access_meta_${worldId}`);
}
```

## Migration from Old System

If cache structure changes (adding/removing fields, changing timestamps, etc.):

1. Update `CURRENT_CACHE_VERSION` in `lib/storage/cache-versioning.ts`
2. Update migration function in `cache-versioning.ts`
3. Test cache migration works
4. Old cache automatically migrated on app start

See `docs/issues/MileStone 1/098 - Cache Versioning/CACHE_VERSIONING.md` for details.

## Best Practices

✅ **DO:**
- Cache worlds when loaded from server
- Use cache for fast navigation
- Verify cache age before trusting it
- Force verification for sensitive operations
- Handle network errors gracefully
- Log verification results for debugging

❌ **DON'T:**
- Trust cache older than 4 hours (shouldn't exist)
- Block user on network errors
- Store unencrypted world access data
- Hardcode cache keys (use STORAGE_KEYS)
- Skip verification for sensitive pages
- Assume cache is always accurate (verify periodically)

## Future Enhancements

- **Real-time updates:** Use Supabase Realtime to update cache instantly when access changes
- **Offline support:** Pre-populate cache with all user's worlds for offline play
- **Access history:** Track when/how user gained/lost access for audit logs
