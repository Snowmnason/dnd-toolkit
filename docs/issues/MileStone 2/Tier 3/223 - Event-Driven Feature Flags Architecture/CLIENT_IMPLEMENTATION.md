# Client-Side Feature Flags Implementation

**Location:** `lib/feature-flags/server-sync.ts` (FeatureFlagsManager singleton)

## Overview

The `FeatureFlagsManager` provides runtime access to feature flags and premium entitlements using an event-driven architecture:

1. **Bootstrap (once at app startup)** → Fetches consolidated data from Edge Function
2. **Realtime subscriptions** → Listens for server-side changes
3. **Cache fallback** → Works offline using SecureStorage
4. **Priority merging** → Applies overrides > server values > hardcoded config

## Architecture

```
App Kernel Bootstrap
    ↓
initialize(supabaseClient, userId)
    ↓
bootstrapFlags()
    ├─ Development: Load local config only
    └─ Production:
        ├─ Call Edge Function (one consolidated call)
        ├─ Cache to SecureStorage (offline)
        ├─ Load into Maps (currentFlags, remoteOverrides, cachedEntitlements)
        └─ Subscribe to Realtime (3 channels)
    ↓
Runtime (Realtime events push updates)
    ├─ postgres_changes on feature_flags → updateFlags()
    ├─ postgres_changes on entitlements → updateEntitlements()
    └─ postgres_changes on feature_flag_overrides → updateOverrides()
    ↓
getFlag(name) / getEntitlement(name)
    └─ Read from updated Maps (zero network calls)
    ↓
Logout / App Termination
    └─ clearCache() → unsubscribe + clear Maps + remove storage
```

## Key Types

```typescript
// Flag state in currentFlags Map
FeatureFlagState {
  enabled: boolean
  kind?: string
  description?: string
  source: "server" | "hardcoded" | "override"
}

// Entitlement state in cachedEntitlements Map
CachedEntitlement {
  id: string
  user_id: string
  key: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

// Override state in remoteOverrides Map
FeatureFlagOverrideRow {
  id: string
  user_id: string
  target_type: "flag" | "entitlement"
  target_name: string
  enabled: boolean
  expires_at: string | null
  revoked: boolean
  reason?: string
  created_by?: string | null
  created_at: string
  updated_at: string
}
```

## Core Methods

### `initialize(supabaseClient, userId?)`

Called during app kernel bootstrap. Sets up the manager with:

- `supabaseClient` - For Edge Function calls and Realtime subscriptions
- `userId` - For filtering user-specific data (entitlements, overrides)

```typescript
const kernel = new AppKernel();
await kernel.initialize();
await FeatureFlagsManager.initialize(supabaseClient, userId);
```

### `bootstrapFlags()`

One-time initialization. Fetches all data and sets up listeners.

**Development mode:**

- Uses local `appsettings.*.json` hardcoded config only
- No server calls, no Realtime
- Suitable for local testing without backend

**Production mode:**

```
1. Call Edge Function: invokeGetFeatureFlagsFunction()
   Returns: { flags, entitlements, overrides, fetchedAt, version }

2. Load into memory:
   currentFlags = Map<name, FeatureFlagState>
   remoteOverrides = Map<name, FeatureFlagOverrideRow>
   cachedEntitlements = Map<key, CachedEntitlement>

3. Cache to SecureStorage for offline

4. subscribeToRealtimeUpdates()
   - Channel 1: feature_flags (global, all users)
   - Channel 2: entitlements:user.eq.${userId} (user-specific)
   - Channel 3: feature_flag_overrides:user.eq.${userId} (user-specific)
```

Fails gracefully:

- Edge Function fails → Load from last cached bootstrap
- No cache → Load hardcoded fallback
- Realtime setup fails → App continues with cached data

### `getFlag(name, fallback=false)`

Returns current flag value using priority chain:

**Priority:**

1. **Remote override** - Per-user admin-controlled (highest)
   - Checks `remoteOverrides.get(name)`
   - Validates: not revoked, not expired
2. **Local override** - Admin testing (via `setOverride()`)
   - Checks `userOverrides.get(name)`
3. **Server flag** - From bootstrap or Realtime updates
   - Checks `currentFlags.get(name)`
   - Source: "server", "hardcoded", or "override"
4. **Hardcoded fallback** - From appsettings (lowest)
   - Last resort, only if not bootstrapped yet

Returns: `boolean` (never null, always has a value)

### `getEntitlement(name, userId)`

Returns whether user has an entitlement with security checks.

**Priority:**

1. **Local override** (admin testing)
2. **Check clock validity** (fail-secure on clock manipulation)
3. **Cache hit (not expired)** (zero network, instant)
4. **Cache expired** → Fresh query from `fetchEntitlementsByUserId()`
   - Updates cache with server response
   - Or removes entitlement if no longer exists
5. **No cache** → Fresh query from server
   - Caches result for future calls

Returns:

```typescript
{
  granted: boolean
  source: "cache" | "server" | "override" | "expired_offline" | "server_unavailable"
  expiresAt?: string | null
}
```

**Fail-secure pattern:**

- Expired + offline → `granted: false` (denies access)
- Server unavailable + no cache → `granted: false` (denies access)

### `setOverride(key, value)` / `clearOverride(key)`

Admin testing only. Sets local overrides that bypass server values.

```typescript
// For flags (key = flag name)
FeatureFlagsManager.setOverride("beta_ui", true);

// For entitlements (key = "userId:entitlementName")
FeatureFlagsManager.setOverride("abc-123:premium_feature", true);
```

### `subscribe(callback)`

Subscribe to flag changes for UI reactivity.

```typescript
const unsubscribe = FeatureFlagsManager.subscribe((flags) => {
  console.log("Flags updated:", flags);
  // Update UI, re-render components, etc
});

// Unsubscribe when component unmounts
return () => unsubscribe();
```

### `clearCache()`

Called on logout. Cleans up:

- Unsubscribes from all 3 Realtime channels
- Clears all Maps (flags, overrides, entitlements)
- Removes all SecureStorage entries
- Prevents ghost subscriptions

## Realtime Event Handlers

### `handleFlagChange(payload)`

Processes `postgres_changes` events from `feature_flags` table.

```typescript
// INSERT or UPDATE
if (eventType !== "DELETE") {
  currentFlags.set(flagName, {
    enabled: flagData.enabled,
    kind: flagData.kind,
    description: flagData.description,
    source: "server"
  })
}

// DELETE
if (eventType === "DELETE") {
  currentFlags.delete(flagName)
}

// Always: cache + notify
SecureStorage.setJSON(STORAGE_KEYS.FEATURE_FLAGS, ...)
notifySubscribers(currentFlags)
```

### `handleEntitlementChange(payload)`

Processes `postgres_changes` events from `entitlements` table (user-filtered).

```typescript
// INSERT or UPDATE
if (eventType !== "DELETE") {
  cachedEntitlements.set(entitlementKey, {
    id, user_id, key, expires_at, created_at, updated_at
  })
}

// DELETE (entitlement revoked)
if (eventType === "DELETE") {
  cachedEntitlements.delete(entitlementKey)
}

// Always: cache updates
SecureStorage.setJSON(`${STORAGE_KEYS.ENTITLEMENTS}:${userId}`, ...)
```

### `handleOverrideChange(payload)`

Processes `postgres_changes` events from `feature_flag_overrides` table (user-filtered).

Only tracks `target_type === "flag"` overrides (entitlement overrides are handled separately).

```typescript
// Flag-type INSERT or UPDATE
if (overrideData.target_type === "flag") {
  remoteOverrides.set(targetName, overrideData)
}

// DELETE or entitlement-type
remoteOverrides.delete(targetName)

// Always: cache + notify
SecureStorage.setJSON(`${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${userId}`, ...)
notifySubscribers(currentFlags)
```

## Storage & Caching

### SecureStorage Keys

```typescript
STORAGE_KEYS.FEATURE_FLAGS
  → Contains: { flags: Map, fetchedAt: number }
  → Used for: Offline flag values

STORAGE_KEYS.FEATURE_FLAGS:feature_flag_override:${userId}
  → Contains: Map<string, FeatureFlagOverrideRow>
  → Used for: Offline override values

STORAGE_KEYS.ENTITLEMENTS:${userId}
  → Contains: Map<string, CachedEntitlement>
  → Used for: Offline entitlement values
```

All stored via `SecureStorage` (encrypted on all platforms: web, iOS, Android).

### Offline Behavior

**If app starts offline:**

1. Edge Function call fails
2. Load flags from `STORAGE_KEYS.FEATURE_FLAGS`
3. Load overrides from `STORAGE_KEYS.FEATURE_FLAGS:feature_flag_override:${userId}`
4. Skip Realtime setup
5. App works with cached data

**If network drops after bootstrap:**

1. Realtime subscriptions pause
2. `getFlag()` continues returning cached values
3. `getEntitlement()` fails fresh check, uses cache (or denies if expired)
4. When network returns, Realtime auto-reconnects
5. Cached data refreshes with latest from server

## Integration with App

### Kernel Setup

```typescript
// lib/kernel/use-app-kernel.tsx
const kernel = useAppKernel();

useEffect(() => {
  if (kernel.phases.appReady && userId) {
    FeatureFlagsManager.initialize(supabaseClient, userId);
    await FeatureFlagsManager.bootstrapFlags();
  }
}, [kernel.phases.appReady, userId]);
```

### Component Usage

```typescript
import { FeatureFlagsManager } from "@/lib/feature-flags"

export function MyComponent() {
  const [flags, setFlags] = useState<Record<string, FeatureFlagState>>({})

  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = FeatureFlagsManager.subscribe(setFlags)

    return () => unsubscribe()
  }, [])

  // Check a flag
  const betaEnabled = FeatureFlagsManager.getFlag("beta_ui", false)

  // Check an entitlement
  const [entitlement, setEntitlement] = useState({ granted: false })

  useEffect(() => {
    FeatureFlagsManager.getEntitlement("premium_feature", userId).then(setEntitlement)
  }, [userId])

  return (
    <div>
      {betaEnabled && <BetaFeature />}
      {entitlement.granted && <PremiumFeature expiresAt={entitlement.expiresAt} />}
    </div>
  )
}
```

### Logout Cleanup

```typescript
// In logout handler
async function handleLogout() {
  await FeatureFlagsManager.clearCache();
  // Then redirect to login
}
```

## Clock Manipulation Detection

Security feature: Detects if device clock is tampered with (affects entitlement expiry checks).

```typescript
verifyDeviceClock()
  → Checks if current time vs. last known server time has large skew
  → If skew > tolerance (default 60s):
     → Store STORAGE_KEYS.CLOCK_INVALID
     → getEntitlement() returns granted: false
```

Called periodically during app lifecycle (see `lib/kernel` for integration).

## Development Mode vs. Production Mode

| Aspect            | Development                | Production               |
| ----------------- | -------------------------- | ------------------------ |
| **Config Source** | Local appsettings only     | Edge Function + Realtime |
| **Server Calls**  | None                       | 1 bootstrap call         |
| **Realtime**      | No                         | Yes (3 channels)         |
| **Overrides**     | Only `setOverride()` works | + Server-side overrides  |
| **Testing**       | Fast, no dependencies      | Requires Supabase        |

To force dev mode: `isDevelopment()` checks config, or set `DEVELOPMENT=true` in environment.

## Debugging

Looking for flag issues? Check:

1. **Was bootstrap called?**

   ```typescript
   FeatureFlagsManager.getDebugInfo();
   ```

   Should show: `bootstrapped: true`, flag counts, Realtime subscription count

2. **Is Realtime subscribed?**
   Check browser DevTools → Network → WebSocket for `realtime.supabase.com`

3. **What's the current flag value?**

   ```typescript
   FeatureFlagsManager.getFlag("my_flag");
   ```

4. **Check cache directly**

   ```typescript
   const cached = await SecureStorage.getJSON(STORAGE_KEYS.FEATURE_FLAGS);
   console.log("Cached flags:", cached);
   ```

5. **Check current Maps**
   In browser console:
   ```javascript
   FeatureFlagsManager.currentFlags; // Current flag state
   FeatureFlagsManager.remoteOverrides; // Admin overrides
   FeatureFlagsManager.cachedEntitlements; // User entitlements
   ```
