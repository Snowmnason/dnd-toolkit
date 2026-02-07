# Event-Driven Feature Flags Architecture

**Overview:** Feature flags, entitlements, and overrides use Supabase Realtime for instant server-side updates instead of polling or restarting.

**Related Implementation Docs:**
- [CLIENT_IMPLEMENTATION.md](../../issues/MileStone%202/Tier%203/223%20-%20Event-Driven%20Feature%20Flags%20Architecture/CLIENT_IMPLEMENTATION.md) - Complete API reference for FeatureFlagsManager
- [EDGE_FUNCTION_GUIDE.md](../../issues/MileStone%202/Tier%203/223%20-%20Event-Driven%20Feature%20Flags%20Architecture/EDGE_FUNCTION_GUIDE.md) - Edge Function deployment and API

## Overview

Instead of polling or waiting for app restart, the client subscribes to database changes via Supabase Realtime. When an admin changes a flag, revokes an entitlement, or creates an override in Supabase, the client receives and applies the change **instantly** (no app restart needed, no polling delay).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ App Startup (Bootstrap)                                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. Edge Function: get_feature_flags                             │
│    - Fetches flags, entitlements, overrides (one call)         │
│    - Returns consolidated data with JWT auth                   │
│ 2. Cache to SecureStorage (offline fallback)                   │
│ 3. Setup Realtime subscriptions                                │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ Runtime (After Bootstrap)                                       │
├─────────────────────────────────────────────────────────────────┤
│ Realtime Channels:                                              │
│                                                                 │
│ 1. feature_flags table changes                                 │
│    Event: Any user changes a flag value                        │
│    Action: Update currentFlags Map + notify subscribers        │
│                                                                 │
│ 2. entitlements table changes (user-specific filter)           │
│    Event: Admin grants/revokes user entitlement                │
│    Action: Update entitlement cache                            │
│                                                                 │
│ 3. feature_flag_overrides table changes (user-specific)        │
│    Event: Admin creates/updates/deletes override for user      │
│    Action: Update remoteOverrides Map immediately              │
│                                                                 │
│ Off Chance of Offline: Use cached bootstrap data               │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│ Logout/Clear                                                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Unsubscribe from all Realtime channels                      │
│ 2. Clear all caches (flags, entitlements, overrides)           │
│ 3. Reset internal state                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Bootstrap (One-time)

```typescript
bootstrapFlags() {
  1. if (development mode) {
       Use local appsettings config only
       Return
     }

  2. // Production: Fetch from server
     const data = await invokeGetFeatureFlagsFunction()
     // Returns: { flags, entitlements, overrides, fetchedAt, version }

  3. // Load into memory
     currentFlags = Map<name, flag>
     remoteOverrides = Map<name, override>

  4. // Cache for offline
     SecureStorage.setJSON(STORAGE_KEYS.FEATURE_FLAGS, data)

  5. // Setup Realtime
     subscribeToRealtimeUpdates()
}
```

### Realtime Updates (Continuous)

```typescript
// When admin changes a flag in Supabase
Supabase (postgres_changes event)
  ↓
subscribeToRealtimeUpdates() catches event
  ↓
handleFlagChange(payload)
  ├─ Update currentFlags Map
  ├─ Cache to SecureStorage
  ├─ Notify subscribers
  └─ Done (no getFlag() call needed)

// When flag is called during app lifetime
getFlag("myFlag") {
  1. Check remoteOverrides (per-user, highest priority)
  2. Check userOverrides (admin testing)
  3. Check currentFlags (from server OR last cached)
  4. Check hardcoded fallback
}
```

## Priority Order (Unchanged)

**For flags:**

1. Remote override (per-user, server-controlled)
2. Local override (admin testing)
3. Server flag value
4. Hardcoded fallback

**For entitlements:**

1. Local override (admin testing)
2. Cached entitlement (from most recent check)
3. Fresh check (on `getEntitlement()` call)

## Security Benefits

1. **Logic Centralized in Supabase**
   - Client receives only the decisions (true/false)
   - Can't be reverse-engineered from shipped code
   - Supabase functions are not included in app bundles

2. **Server Controls Updates**
   - Admin revokes an override → client gets notified immediately
   - Entitlement expires → client cache updated
   - No client-side polling or timing logic

3. **Reduced Attack Surface**
   - Client can't access raw database
   - Can't modify stored procedures
   - JWT verification on Edge Function prevents unauthorized access

## Implementation Details

### Subscriptions

**Feature Flags (all users):**

```typescript
channel("public:feature_flags").on(
  "postgres_changes",
  { event: "*", table: "feature_flags" },
  handleFlagChange,
);
```

No filter - all users see global flag changes.

**Entitlements (user-specific):**

```typescript
channel("public:entitlements:user.eq.${userId}").on(
  "postgres_changes",
  { event: "*", table: "entitlements", filter: `user_id=eq.${userId}` },
  handleEntitlementChange,
);
```

Filtered to user - only their entitlements are streamed.

**Overrides (user-specific):**

```typescript
channel("public:feature_flag_overrides:user.eq.${userId}").on(
  "postgres_changes",
  {
    event: "*",
    table: "feature_flag_overrides",
    filter: `user_id=eq.${userId}`,
  },
  handleOverrideChange,
);
```

Filtered to user - only their overrides are streamed.

### Cleanup

```typescript
clearCache() {
  // Unsubscribe from all Realtime channels
  for (const channel of realtimeSubscriptions.values()) {
    await supabaseClient.removeChannel(channel)
  }
  realtimeSubscriptions.clear()

  // Clear all data
  currentFlags.clear()
  remoteOverrides.clear()
  // ... etc
}
```

Call this on logout to prevent ghost subscriptions.

## Offline Behavior

If network drops during app lifetime:

1. Realtime subscriptions pause (Supabase retries automatically)
2. `getFlag()` continues returning last known values from `currentFlags`
3. `getEntitlement()` tries fresh check, falls back to cache if offline
4. When network returns → Realtime reconnects automatically

On app restart with no network:

```
Edge Function call fails
  ↓
Load cached data from bootstrapFlags
  ↓
Skip Realtime setup (optional: could retry on network return)
  ↓
App works offline
```

## Testing

### Unit Tests

- Mock Supabase Realtime channels
- Simulate `postgres_changes` events
- Verify state updates and cache writes
- Test offline fallback behavior

### Integration Tests

- Start Supabase locally
- Create actual database changes
- Verify client receives updates
- Test cleanup on logout

## Future Enhancements

1. **Reconnection Logic**
   - Auto-retry Realtime setup if network becomes available
   - Detect stale Realtime data vs. fresh

2. **Conflict Resolution**
   - If client has local override but server revoked → show dialog?
   - Merge strategy for competing updates

3. **Analytics**
   - Track Realtime update latency
   - Monitor subscription uptime
   - Alert on channel failures

4. **Rate Limiting**
   - Batch multiple flag changes before notifying
   - Debounce Realtime updates (e.g., max 1 update per 500ms)

## Comparison: Old vs. New

| Aspect            | Old (polling)                                      | New (event-driven)                        |
| ----------------- | -------------------------------------------------- | ----------------------------------------- |
| **Bootstrap**     | Fetch flags + overrides + entitlements (3 queries) | Fetch consolidated data (1 Edge Function) |
| **Runtime**       | None (stale until logout)                          | Realtime (instant updates)                |
| **Admin Control** | Limited (can only change at next bootstrap)        | Full (changes push immediately)           |
| **Network Calls** | Many (if polling) or stale (if not)                | Only on actual changes                    |
| **Offline**       | Works (cached)                                     | Works (cached)                            |
| **Security**      | Logic in client/database                           | Logic in Supabase (more hidden)           |
| **Latency**       | Minutes (next poll)                                | <50ms (Realtime)                          |

## Deployment Checklist

Before deploying to production:

- [ ] Deploy Edge Function: `get_feature_flags`
- [ ] Verify JWT secret is set in Supabase environment
- [ ] Enable Realtime for these tables: `feature_flags`, `entitlements`, `feature_flag_overrides`
- [ ] Test subscription with user accounts
- [ ] Monitor Realtime latency in staging
- [ ] Verify offline behavior works
- [ ] Test cleanup on logout (no ghost subscriptions)
- [ ] Update admin docs: "Changes now push in real-time"

## Code Locations

- **Client Manager**: `lib/feature-flags/server-sync.ts` (FeatureFlagsManager singleton)
  - See [CLIENT_IMPLEMENTATION.md](../../issues/MileStone%202/Tier%203/223%20-%20Event-Driven%20Feature%20Flags%20Architecture/CLIENT_IMPLEMENTATION.md) for complete API reference

- **Edge Function**: `supabase/functions/get_feature_flags/`
  - See [EDGE_FUNCTION_GUIDE.md](../../issues/MileStone%202/Tier%203/223%20-%20Event-Driven%20Feature%20Flags%20Architecture/EDGE_FUNCTION_GUIDE.md) for deployment and API

- **Tests**: `__tests__/feature-flags/`
  - All tests updated to mock Realtime responses

## Documentation Guide

Use these docs based on your task:

| Goal | Read This |
| --- | --- |
| Understand how Realtime works | **REALTIME_ARCHITECTURE.md** (this file) |
| Integrate FeatureFlagsManager in code | **CLIENT_IMPLEMENTATION.md** |
| Deploy Edge Function to Supabase | **EDGE_FUNCTION_GUIDE.md** |
| Configure Realtime subscriptions | **REALTIME_ARCHITECTURE.md** (Subscriptions section) |
