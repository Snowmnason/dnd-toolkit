# Usage & API — Feature Flags & Entitlements (Phase 1)

This document provides quick reference for developers: how to use the runtime feature flags and entitlement APIs, the hooks, and the database helpers.

## Runtime APIs (developer-facing)

### `FeatureFlagsManager` (singleton)

- `initialize(supabaseClient)` — Initialize with Supabase client (called by `AppKernel`).
- `verifyDeviceClock()` — Check device clock; returns `true` if safe (60s tolerance).
- `bootstrapFlags()` — Fetch flags once at startup. Non-blocking.
- `getFlag(name, fallback?)` — Synchronous; returns bootstrapped/cached flag value (override → server → hardcoded → fallback).
- `getEntitlement(name, userId)` — Async; real-time check with expiry handling (override → server → cache → deny).
- `setOverride(key, value)` — Admin testing override (flag or `userId:entitlementKey`).
- `clearOverride(key)` / `clearAllOverrides()` — Remove override(s).
- `subscribe(callback)` — Subscribe to flag updates; callback receives a plain object of flags.

Example:

```ts
import { FeatureFlagsManager } from "@/lib/feature-flags";

const enabled = FeatureFlagsManager.getFlag("darkModeV2", false);

const ent = await FeatureFlagsManager.getEntitlement("premium", userId);
if (ent.granted) {
  /* show premium */
}
```

### React Hooks

- `useFeatureFlags(flagName)` — Synchronous hook returning `{ enabled, loading, error }`. Uses bootstrapped flags.
- `useEntitlement(entitlementName, userId)` — Async hook returning `{ granted, loading, error }`. Always performs fresh server check when online; falls back to cached value when offline.

Example:

```tsx
const { enabled } = useFeatureFlags("darkModeV2");
const { granted, loading } = useEntitlement("premium", userId);
```

## Database helpers (internal)

- `fetchFeatureFlags(supabase): Promise<FeatureFlagRow[]>` — Returns all global flags.
- `fetchEntitlementsByUserId(supabase, userId): Promise<EntitlementRow[]>` — Returns entitlements for a user (includes `expires_at`).
- `hasEntitlement(supabase, userId, key): Promise<boolean>` — Returns `true` if entitlement exists and is not expired.

## Storage keys

- `STORAGE_KEYS.FEATURE_FLAGS` — persisted bootstrapped flags (object for storage)
- `STORAGE_KEYS.ENTITLEMENTS` — per-user cached entitlements with `expiresAt` and timestamp
- `STORAGE_KEYS.CLOCK_INVALID` — flag set when clock manipulation detected

## Debugging tips

- To test overrides in dev console:

```js
FeatureFlagsManager.setOverride("darkModeV2", true);
FeatureFlagsManager.clearOverride("darkModeV2");
```

- To simulate entitlement for a user:

```js
FeatureFlagsManager.setOverride(`${userId}:premium`, true);
```

- If entitlements unexpectedly deny access, check:
  - Device time vs. server time (clock skew)
  - Cached entitlement `expiresAt` in SecureStorage
  - Database row `expires_at` in `entitlements` table

## Backwards compatibility

- Hooks and legacy `FeatureFlags` APIs remain for config-driven flags. Server-driven flags are additive and overwrite config at startup.
