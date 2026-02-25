# Feature Flags Sync System - RFC

**Issue**: [#054 - Sync System Features](../../../issues.md)  
**Status**: DESIGN (ready for implementation)  
**Date**: February 2, 2026  
**Tier**: 2 (integrates with APIClient, Offline Queue, Network Recovery)

---

## Scope

**IN SCOPE** (Phase 1):

- Client-side flag/entitlement retrieval, caching, and TTL logic
- Offline-safe behavior with graceful degradation
- Sync mechanism (refresh from server when online/reconnected)
- Integration with Tier 2 infrastructure (AuthLayer, CircuitBreaker, NetworkRecoveryManager)
- Clock manipulation detection for security

**OUT OF SCOPE** (Phase 2+ or separate initiative):

- Supabase Edge Function server-side implementation (design contract now, build later)
- Admin tools for managing flags
- Advanced rollout strategies, A/B testing, feature gates
- Rollout percentages or user targeting rules

**Assumption**: Edge Function contract is defined here; server implementation comes later when requested.

---

## Overview

Implement a lightweight, secure sync mechanism for runtime feature flags and premium entitlements so changes made server-side (or via admin tools) propagate across user sessions and devices. The system integrates with Tier 2 offline foundations (QueryCache, SecureStorage, NetworkRecoveryManager) and supports efficient change detection (ETag/version).

### Goals

- ✅ Server-driven feature flags and entitlements (not just config file)
- ✅ Efficient syncing (ETag/version to avoid full payloads)
- ✅ Offline-safe with TTL/staleness rules
- ✅ Auth-aware (via AuthLayer, respects auth strategies)
- ✅ Circuit breaker integration to prevent retry storms
- ✅ Ready for background job integration (Phase 2+)

---

## Architecture

### Data Flow

```
User Opens App / Reconnects
    ↓
AppKernel.appReady (Phase 1)
    ↓
FeatureFlagsManager.refreshFromServer() [async, non-blocking]
    ↓
    ├─ Call Supabase Edge Function (with AuthLayer token injection)
    ├─ Check ETag/version (circuit breaker blocks if endpoint failing)
    ├─ Parse response (flags + entitlements)
    ├─ Validate entitlements TTL/expiry
    ├─ Store flags to FastCache (dnd:feature_flags:v1)
    ├─ Store entitlements to SecureStorage (dnd:entitlements:v1)
    └─ Notify subscribers of updates
```

### Storage Strategy

**Flags** (FastCache):

- Key: `dnd:feature_flags:v1`
- Content: `{ flags, fetchedAt, ttlMs, etag, version }`
- TTL per flag: `fetchedAt + ttlMs` (respect server-provided staleness)
- Fast on startup (unencrypted, in-memory with FastCache)

**Entitlements** (SecureStorage):

- Key: `dnd:entitlements:v1`
- Content: `{ entitlements, fetchedAt, expiresAt, lastVerifiedAt }`
- Encrypted at rest (sensitive: grants, expiry dates)
- Persists across restarts
- Versioned (see `lib/storage/cache-versioning.ts`)
- **Security**: `lastVerifiedAt` used to detect clock manipulation (see Clock Manipulation Detection)

### State Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Flag State Lifecycle                                     │
└─────────────────────────────────────────────────────────┘

  FRESH (within TTL)
    ↓
    Use cached value immediately
    Optionally: revalidate in background (stale-while-revalidate)

  STALE (beyond TTL)
    ↓
    Online: Refresh from server
    Offline: Use cached value (degrade gracefully)

  EXPIRED (no cached value)
    ↓
    Online: Fetch from server
    Offline: Use fallback (safe default: disabled)

┌─────────────────────────────────────────────────────────┐
│ Entitlement State Lifecycle                              │
└─────────────────────────────────────────────────────────┘

  GRANTED (expiresAt > now)
    ↓
    Feature accessible

  EXPIRING SOON (expiresAt - now < 7 days)
    ↓
    UI shows "renew soon" warning
    Attempt refresh on next network event

  EXPIRED (expiresAt <= now)
    ↓
    UI shows expiration warning
    Feature degraded to free tier (app shows paywall/upsell)
    Require new purchase or auth refresh
```

---

## Client API Design

### Core Methods

#### `refreshFromServer(): Promise<void>`

Fetch and sync flags + entitlements from server. Non-blocking (runs in background); does not throw on network errors.

```typescript
import { FeatureFlagsManager } from "@/lib/feature-flags";

// Call on app start, reconnect, or manual refresh
await FeatureFlagsManager.refreshFromServer();

// Subscriber is notified of updates
FeatureFlagsManager.subscribe((flags) => {
  console.log("Flags updated:", flags);
});
```

**Behavior**:

- Validates auth via `AuthLayer` (injects token from auth strategy)
- Checks `ETag` / `version` to skip unnecessary downloads
- Respects circuit breaker (skips request if endpoint is failing)
- Stores flags to `FastCache`, entitlements to `SecureStorage`
- Emits updates to subscribers
- Returns silently on error (does not disrupt user experience)

#### `getFlag(name: string, fallback?: boolean): boolean`

Get feature flag value, respecting TTL and offline state.

```typescript
import { useFeatureFlags } from '@/hooks/use-feature-flags'; // TBD

export function MyFeature() {
  const { getFlag } = useFeatureFlags();

  if (!getFlag('premiumUI', false)) {
    return <FreeUI />;
  }

  return <PremiumUI />;
}
```

**Behavior**:

- Return cached value if fresh (within TTL)
- Return stale cache if offline
- Return `fallback` (default: `false` for safety) if no cached value

#### `getEntitlement(name: string): { granted: boolean, expiresAt?: number }`

Check if entitlement is granted, not expired, and device clock is legitimate.

```typescript
import { useEntitlements } from '@/hooks/use-entitlements'; // TBD

export function PremiumFeature() {
  const { getEntitlement } = useEntitlements();
  const premium = getEntitlement('premium');

  if (!premium.granted) {
    return <Paywall />;
  }

  if (premium.expiresAt && Date.now() + 7 * 24 * 60 * 60 * 1000 > premium.expiresAt) {
    return (
      <div>
        {<PremiumFeature />}
        <RenewalPrompt expiresAt={premium.expiresAt} />
      </div>
    );
  }

  return <PremiumFeature />;
}
```

**Behavior**:

- Read from `SecureStorage`
- **Security Check**: Verify device clock hasn't been manipulated backward (see Clock Manipulation Detection section)
- Check `expiresAt` against current time
- Return `{ granted: false }` if expired, missing, or clock is invalid

---

## Sync Triggers

### 1. **App Startup**

```typescript
// In AppKernelProvider or lib/kernel/app-kernel.ts
async function initializeAppKernel() {
  // ... other bootstrap

  // After appReady phase, refresh flags
  kernel.phases.appReady = true;
  await FeatureFlagsManager.refreshFromServer(); // non-blocking
}
```

### 2. **Network Recovery Completion**

Integrate with Tier 2 `NetworkRecoveryManager`:

```typescript
// In lib/api/network-recovery.ts (existing recovery hooks)
networkStateMachine.onSpecificTransition("RECOVERING", "GOOD", async () => {
  // ... existing sync + cache invalidation

  // NEW: Also refresh flags/entitlements with fresh auth
  await FeatureFlagsManager.refreshFromServer();
});
```

### 3. **Manual Refresh**

```typescript
// In dev settings or user-triggered refresh
export function SettingsPage() {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await FeatureFlagsManager.refreshFromServer();
    setLoading(false);
    showToast("Flags refreshed");
  };

  return <Button onPress={handleRefresh}>Refresh Flags</Button>;
}
```

### 4. **Optional: Periodic Background Sync** (Phase 2+)

```typescript
// Register with Job Queue (future enhancement)
BackgroundJobQueue.registerHandler("feature_flags_sync", async () => {
  await FeatureFlagsManager.refreshFromServer();
});

// Trigger every 4 hours (configurable in appsettings)
BackgroundJobQueue.scheduleRecurring("feature_flags_sync", {
  intervalMs: 4 * 60 * 60 * 1000,
});
```

---

## Supabase Edge Function Contract

### Endpoint Design

```
Function: get_feature_flags
Method: POST or GET
Auth: Requires authenticated user session
URL: /functions/v1/get_feature_flags
```

### Request

```typescript
// Client calls via AuthLayer to inject token
const response = await supabase.functions.invoke("get_feature_flags", {
  headers: {
    Authorization: `Bearer ${token}`, // Injected by AuthLayer
  },
  // Optional: minimal body
  body: {
    version: lastKnownVersion, // For version check
    etag: lastKnownEtag, // For ETag check
  },
});
```

### Response (Success 200)

```json
{
  "flags": {
    "premiumUI": {
      "enabled": true,
      "ttlMs": 2592000000
    },
    "betaFeatures": {
      "enabled": false,
      "ttlMs": 604800000
    }
  },
  "entitlements": {
    "premium": {
      "granted": true,
      "expiresAt": "2026-03-02T00:00:00Z"
    },
    "pro": {
      "granted": false,
      "expiresAt": null
    }
  },
  "fetchedAt": 1706745600000,
  "version": "v1.2.3",
  "etag": "W/\"abc123def456\""
}
```

### Response (Not Modified 304)

If ETag or version matches, server can return 304 to skip payload:

```json
{ "status": 304, "message": "Not Modified" }
```

Client should continue using cached values.

### Error Handling

```
401 Unauthorized → AuthLayer should refresh token, retry
403 Forbidden → User not authorized (downgrade flags)
429 Rate Limited → Circuit breaker blocks, use cache
500 Server Error → Circuit breaker opens, use cache
503 Service Unavailable → Circuit breaker opens, use cache
```

---

## Integration with Tier 2

### AuthLayer (Token Injection)

```typescript
// FeatureFlagsManager internally uses AuthLayer
async refreshFromServer() {
  try {
    // AuthLayer validates auth strategy and injects token
    const token = await authLayer.getToken('user'); // or 'admin'

    const response = await fetch('/functions/v1/get_feature_flags', {
      headers: { Authorization: `Bearer ${token}` },
    });

    // ... handle response
  } catch (error) {
    logger.category('feature_flag').warn('Flag refresh failed (using cache)', error);
  }
}
```

### CircuitBreaker (Prevent Retry Storms)

```typescript
// Check CB state before calling function
const key = 'feature_flags:endpoint';
if (CircuitBreakerManager.isOpen(key)) {
  logger.category('feature_flag').debug('Flags endpoint circuit open, using cache');
  return; // Skip refresh
}

try {
  const response = await fetch('/functions/v1/get_feature_flags', ...);
  CircuitBreakerManager.recordSuccess(key);
  // ... update cache
} catch (error) {
  CircuitBreakerManager.recordFailure(key);
  // ... use cache
}
```

### QueryCache (Avoid Duplicate Requests)

```typescript
// Use QueryCache to deduplicate concurrent refresh calls
const cacheKey = "feature_flags:refresh";
const existing = await QueryCache.get(cacheKey);
if (existing) {
  return existing; // Return in-flight promise
}

const promise = (async () => {
  const response = await fetch("...");
  return response.json();
})();

await QueryCache.set(cacheKey, promise, {
  staleTime: 0, // Always fresh (one-time cache)
  cacheTime: 60000, // Keep for 60s to deduplicate
});

return promise;
```

### NetworkRecoveryManager (Integration Hook)

```typescript
// In registerNetworkRecoveryHooks() from lib/api/network-recovery.ts
networkStateMachine.onSpecificTransition("RECOVERING", "GOOD", async () => {
  // Existing recovery steps...

  // NEW: Refresh flags with fresh auth
  try {
    await FeatureFlagsManager.refreshFromServer();
    logger.category('feature_flag').info("Flags refreshed on recovery");
  } catch (error) {
    logger.category('feature_flag').warn("Flags refresh failed on recovery", error);
    // Use cache (non-blocking)
  }
});
```

---

## Staleness & TTL Behavior

### Per-Flag TTL

Each flag from server includes optional `ttlMs`:

```json
{
  "flags": {
    "betaFeature": {
      "enabled": true,
      "ttlMs": 604800000 // 7 days
    }
  },
  "fetchedAt": 1706745600000
}
```

**Calculation**:

- Fresh until: `fetchedAt + ttlMs`
- Stale after: `fetchedAt + ttlMs`
- In cache: up to configurable `cacheTime` (default: 30 days)

### Entitlement Expiry

Entitlements include absolute `expiresAt`:

```json
{
  "entitlements": {
    "premium": {
      "granted": true,
      "expiresAt": "2026-03-02T00:00:00Z"
    }
  }
}
```

**Degradation**:

- `expiresAt > now` → Feature accessible
- `expiresAt - now < 7 days` → Show renewal prompt
- `expiresAt <= now` → Feature degraded (paywall shown)

---

## Offline Behavior

### Flags When Offline

- Fresh flag cached? **Use it** (UX not disrupted)
- Stale flag cached? **Use it** (better than nothing)
- No flag cached? **Use fallback** (safe default: `false`)

### Entitlements When Offline

- Not expired? **Grant access** (entitlements are time-bound)
- Expired? **Degrade feature** (force reauth/purchase)
- No cached entitlement? **Degrade feature** (fail safe)

### Storage Persistence

Both flags and entitlements survive app restart via:

- `FastCache` → fast, in-memory with fallback to disk
- `SecureStorage` → encrypted, persistent

---

## Clock Manipulation Detection ⚠️ Security

**Problem**: User manipulates system clock backward to extend expired entitlements or delay premium degradation.

**Solution**: Track `lastVerifiedAt` timestamp; fail-secure if clock goes backward.

### Implementation

#### Entitlement Verification Logic

```typescript
const CLOCK_SKEW_TOLERANCE = 60000; // 1 minute tolerance for honest drift

getEntitlement(name: string): { granted: boolean, expiresAt?: number } {
  const entitlement = SecureStorage.read('dnd:entitlements:v1');

  if (!entitlement) {
    return { granted: false };
  }

  const now = Date.now();
  const lastVerified = entitlement.lastVerifiedAt || entitlement.fetchedAt;

  // Security: Detect clock manipulation (backward clock)
  if (lastVerified && now < lastVerified - CLOCK_SKEW_TOLERANCE) {
    logger.category('security').warn('Clock manipulation detected', {
      lastVerified,
      now,
      skew: lastVerified - now,
    });

    // Fail-secure: Deny access immediately
    // Do NOT allow offline access if clock is wrong
    return { granted: false };
  }

  // Normal expiry check
  const entitlementData = entitlement.entitlements[name];
  if (!entitlementData) {
    return { granted: false };
  }

  if (entitlementData.expiresAt) {
    const expiryTime = new Date(entitlementData.expiresAt).getTime();
    if (now >= expiryTime) {
      return { granted: false };
    }
  }

  return { granted: true, expiresAt: entitlementData.expiresAt };
}
```

#### AppKernel Bootstrap Check

Add early in `AppKernelProvider` bootstrap sequence (before features are evaluated):

```typescript
// In lib/kernel/app-kernel.ts or similar
async function verifyDeviceClock(): Promise<boolean> {
  const entitlements = SecureStorage.read("dnd:entitlements:v1");

  if (!entitlements?.lastVerifiedAt) {
    return true; // No baseline, allow
  }

  const lastVerified = entitlements.lastVerifiedAt;
  const now = Date.now();
  const skew = lastVerified - now;

  if (skew > CLOCK_SKEW_TOLERANCE) {
    // Clock was set backward
    logger.category("security").error("Device clock appears manipulated", { skew });

    // Lock out premium features
    await SecureStorage.set("dnd:clock_invalid", {
      detected: now,
      skew,
    });

    return false; // Clock invalid
  }

  return true; // Clock valid
}
```

### Behavior

- **Fresh entitlement + Valid clock**: Grant access ✅
- **Fresh entitlement + Invalid clock** (backward): Deny access 🔒
- **Expired entitlement + Any clock**: Deny access 🔒
- **Offline + Valid clock + Not expired**: Grant access (offline mode) ✅
- **Offline + Invalid clock**: Deny access (fail-secure) 🔒

### Testing Checklist

- [ ] Entitlement granted, clock set backward 2 days → Access denied
- [ ] Entitlement granted, clock set backward 30 seconds → Access granted (within tolerance)
- [ ] Entitlement expired, clock set backward → Access denied
- [ ] Offline + valid entitlement + valid clock → Access granted
- [ ] Offline + invalid clock → Access denied
- [ ] After valid sync, `lastVerifiedAt` updated

---

## Testing Strategy

### Unit Tests

- ✅ `refreshFromServer()` with mocked Edge Function (success, 304, error)
- ✅ `getFlag()` respects TTL (fresh, stale, expired)
- ✅ `getEntitlement()` validates expiry
- ✅ Circuit breaker blocks refresh if endpoint failing
- ✅ AuthLayer token injection
- ✅ Offline fallback behavior

### Integration Tests

- ✅ App startup → refresh flags → subscribers notified
- ✅ Network recovery → refresh flags + entitlements
- ✅ Flag stale but cached → use cache, revalidate background
- ✅ Entitlement expired → feature degrades
- ✅ Offline with stale cache → use cache

### QA Checklist

- [ ] Flags sync on app open
- [ ] Flags sync on network reconnect
- [ ] Entitlements expire after server-set date
- [ ] Premium UI unavailable when entitlement expired
- [ ] Circuit breaker prevents retry storms (simulate 5xx errors)
- [ ] Offline + cached flags → feature works
- [ ] Offline + no cached flags → feature degraded

---

## Acceptance Criteria

**Core Functionality**:

- ✅ `FeatureFlagsManager.refreshFromServer()` implemented
- ✅ App calls refresh on startup (AppKernelProvider) after `appReady` phase
- ✅ App calls refresh on network recovery (NetworkRecoveryManager hook)
- ✅ Flags cached to `FastCache` with per-flag TTL
- ✅ Entitlements cached to `SecureStorage` with expiry checking
- ✅ Circuit breaker respects `isOpen()` state
- ✅ AuthLayer injects token in Edge Function call
- ✅ ETag/version checks avoid full payload downloads

**Offline & Degradation**:

- ✅ Offline: use cached flags/entitlements with safe fallbacks
- ✅ Expired entitlements: app degrades features automatically
- ✅ Tests cover fresh, stale, expired, offline scenarios

**Security** ⚠️:

- ✅ Clock manipulation detection implemented in `getEntitlement()`
- ✅ `lastVerifiedAt` stored in SecureStorage and checked on every access
- ✅ AppKernel bootstrap verifies device clock validity early
- ✅ Tests cover clock backward scenarios (various skew ranges)
- ✅ Fail-secure: invalid clock = denied premium access (even offline)
- ✅ Clock skew tolerance configurable (default: 60 seconds)

**Documentation**:

- ✅ RFC documented and approved before implementation

---

## Files to Create / Edit

### Create

- `lib/feature-flags/remote.ts` – Edge Function client
- `hooks/use-feature-flags.ts` – Hook for flags in components (TBD)
- `hooks/use-entitlements.ts` – Hook for entitlements in components (TBD)

### Edit

- `lib/feature-flags.ts` – Add `refreshFromServer()`, persistence helpers, `getEntitlement()` with clock check
- `lib/feature-flags/index.ts` – Export new functions
- `lib/api/network-recovery.ts` – Add flags refresh hook in recovery
- `lib/kernel/use-app-kernel.tsx` – Call refresh on appReady (after phase setup)
- `lib/kernel/app-kernel.ts` – Add `verifyDeviceClock()` bootstrap check (early phase)
- `lib/storage/index.ts` – Add `STORAGE_KEYS.FEATURE_FLAGS`, `STORAGE_KEYS.ENTITLEMENTS`, `STORAGE_KEYS.CLOCK_INVALID`
- `config/appsettings.*.json` – Document feature flags schema, TTL defaults, and `clockSkewTolerance` (default: 60s)

---

## Timeline

- **Phase 1 (Tier 2)**: Feature flags + entitlements API, persistence (no background sync yet)
- **Phase 2+**: Periodic background sync via Job Queue, advanced rollout strategies

---

## Related Issues & Documentation

- Issue: [#054 - Sync System Features](../../../issues.md)
- Tier 2 Infrastructure: [#186 - Structured API Clients](../../../issues.md)
- Network Recovery: [lib/api/network-recovery.ts](../../../../lib/api/network-recovery.ts)
- Auth Layer: [lib/api/auth-layer.ts](../../../../lib/api/auth-layer.ts)
- Circuit Breaker: [lib/api/circuit-breaker.ts](../../../../lib/api/circuit-breaker.ts)
