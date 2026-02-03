# Feature Flags Sync — Developer Usage Guide

Purpose

Quick reference for developers: how to use the server-driven feature flags/entitlements implementation and how to make small edits safely.

Quick summary

- Runtime manager: `FeatureFlagsManager` (server-sync) — lives in `lib/feature-flags/server-sync.ts`.
- Remote client: `lib/feature-flags/remote.ts` calls the Supabase Edge Function `get_feature_flags` using `AuthLayer`.
- Storage: flags → `FastCache` key `STORAGE_KEYS.FEATURE_FLAGS`; entitlements → `SecureStorage` key `STORAGE_KEYS.ENTITLEMENTS`.
- Bootstrap hooks: initialized in `lib/kernel/app-kernel.ts` (after appReady). Recovery refresh wired in `lib/api/network-recovery.ts`.

How to use (runtime)

- Initialize (already wired in AppKernel):
  - `FeatureFlagsManager.initialize(getSupabaseClient())` — called by kernel on startup.
- Manual refresh (UI/Dev):
  - `await import('@/lib/feature-flags/server-sync').then(m => m.FeatureFlagsManager.refreshFromServer())`
- Read a flag:
  - `const enabled = await FeatureFlagsManager.getFlag('flagName', false);`
- Read an entitlement:
  - `const { granted, expiresAt } = await FeatureFlagsManager.getEntitlement('premium');`
- Subscribe to flag updates:
  - `const unsubscribe = FeatureFlagsManager.subscribe(flags => { /* react to new flags */ });`

Where it lives (code paths)

- Core manager: `lib/feature-flags/server-sync.ts`
- Edge function client: `lib/feature-flags/remote.ts`
- Barrel exports + legacy API: `lib/feature-flags/index.ts` and `lib/feature-flags/feature-flags.ts` (legacy config-driven toggles)
- Storage keys: `lib/storage/index.ts` (look for `STORAGE_KEYS.FEATURE_FLAGS`, `STORAGE_KEYS.ENTITLEMENTS`, `STORAGE_KEYS.CLOCK_INVALID`)
- Bootstrap wiring: `lib/kernel/app-kernel.ts` (initialize + verifyDeviceClock + refresh)
- Recovery hook: `lib/api/network-recovery.ts` (RECOVERING→GOOD calls refresh)

Editing guidance (small edits)

- Change clock tolerance: `CLOCK_SKEW_TOLERANCE_MS` is defined in `server-sync.ts` (default 60_000). Increase to 3600_000 for 1 hour if needed.
- Add/rename storage keys: edit `lib/storage/index.ts` and update migrations if necessary (see `lib/storage/cache-versioning.ts`).
- Change Edge Function payload: update `lib/feature-flags/remote.ts` request/response types and adjust `server-sync.ts` parsing; keep ETag/version logic intact.
- Circuit breaker thresholds: change defaults in `lib/api/circuit-breaker.ts` or pass a custom key/threshold to circuit calls.

Testing

- Unit tests: add tests under `__tests__/feature-flags/` using Vitest. Use `vi.mock()` for Supabase and AuthLayer.

Essential tests to add:

- `refreshFromServer()`
  - success payload: asserts FastCache and SecureStorage updated and subscribers called
  - 304 response: ensures cache preserved
  - error path: circuit breaker recorded failure and no crash
- `getFlag()` TTL behavior: fresh, stale, missing

# Feature Flags Sync — Developer Usage Guide

Purpose

This page is a concise, developer-focused guide explaining how to use, inspect, and safely modify the server-driven feature flags and entitlement sync implementation (Phase 1).

Quick summary

- Runtime manager: `FeatureFlagsManager` — implemented in `lib/feature-flags/server-sync.ts`.
- Remote client: `lib/feature-flags/remote.ts` — calls the Supabase Edge Function `get_feature_flags` with `AuthLayer` token injection.
- Storage: flags → `FastCache` under `STORAGE_KEYS.FEATURE_FLAGS`; entitlements → `SecureStorage` under `STORAGE_KEYS.ENTITLEMENTS`.
- Bootstrap hooks: manager initialized and refreshed after `appReady` in `lib/kernel/app-kernel.ts`. Network recovery refresh added in `lib/api/network-recovery.ts`.

Quick start (runtime)

- The kernel wires initialization automatically; developers rarely need to call `initialize()` manually.
- Manual refresh (for testing or a settings button):

```ts
await import("@/lib/feature-flags/server-sync").then((m) =>
  m.FeatureFlagsManager.refreshFromServer(),
);
```

- Read a flag (safe, returns fallback when unknown):

```ts
const enabled = await FeatureFlagsManager.getFlag("premiumUI", false);
```

- Read an entitlement (includes expiry and clock-safety checks):

```ts
const { granted, expiresAt } =
  await FeatureFlagsManager.getEntitlement("premium");
if (granted) {
  /* allow premium UI */
}
```

- Subscribe to updates (useful for dev tools or live refresh UIs):

```ts
const unsubscribe = FeatureFlagsManager.subscribe((flags) => {
  // flags: FeatureFlagsData snapshot
});
// later: unsubscribe();
```

Where it lives (code map)

- Core manager: `lib/feature-flags/server-sync.ts` — main runtime logic and API.
- Edge function client: `lib/feature-flags/remote.ts` — HTTP/Edge Function contract and token injection.
- Legacy/local toggles: `lib/feature-flags/feature-flags.ts` (kept for dev console / config toggles).
- Barrel export: `lib/feature-flags/index.ts` exports both APIs.
- Storage keys: `lib/storage/index.ts` (see `STORAGE_KEYS.FEATURE_FLAGS`, `STORAGE_KEYS.ENTITLEMENTS`, `STORAGE_KEYS.CLOCK_INVALID`).
- Init hook: `lib/kernel/app-kernel.ts` (initializes, verifies clock, triggers refresh).
- Recovery hook: `lib/api/network-recovery.ts` (refresh on RECOVERING→GOOD).

Edit guidance (safe, common changes)

1. Change clock tolerance

- Purpose: control how tolerant the client is to device clock skew before denying entitlements.
- Location: `CLOCK_SKEW_TOLERANCE_MS` in `server-sync.ts` (default 60_000 ms).
- Guidance: Increasing to `3600_000` (1 hour) reduces false positives but weakens protection against clock tampering.

2. Change or extend Edge Function contract

- Location: `lib/feature-flags/remote.ts` defines `GetFeatureFlagsResponse`.
- Steps:
  1. Update `GetFeatureFlagsResponse` type.
  2. Update `getFeatureFlagsFromServer()` parsing and 304 handling.
  3. Ensure `server-sync.ts` uses new fields; keep `version`/`etag` checks for de-dup.

3. Storage schema changes / migrations

- Entitlements are stored via `SecureStorage.setVersionedJSON()` pattern. If you change shape, add migration logic in `lib/storage/cache-versioning.ts` and update schema version when calling `setVersionedJSON()`.

4. Circuit breaker tuning

- `CircuitBreakerManager` has defaults in `lib/api/circuit-breaker.ts`. For endpoint-specific tuning, pass a different `circuitBreakerKey` or adjust thresholds globally.

Testing — what to add (prioritized)

Unit tests (Vitest) to add under `__tests__/feature-flags/`:

- refreshFromServer()
  - success → verifies FastCache and SecureStorage updated, subscribers called.
  - 304 Not Modified → ensures cached values preserved.
  - error path → CircuitBreaker.recordFailure called; method doesn't throw.

- getFlag()
  - fresh (within TTL) returns server value.
  - stale (beyond TTL) still returns cached value (client uses stale-while-revalidate behavior).
  - missing flag returns fallback/default.

- getEntitlement()
  - granted & not expired → returns granted with expiresAt.
  - expired → returns granted=false.
  - backward clock manipulation → returns granted=false and writes `STORAGE_KEYS.CLOCK_INVALID` marker.

Mocking advice

- Mock the Supabase client (`getSupabaseClient()`) or the `supabase.functions.invoke()` call directly.
- Mock `AuthLayer.injectAuthHeader()` to avoid needing an actual auth session.

Example test stub (Vitest)

```ts
import { vi, describe, it, expect } from "vitest";
import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { FastCache, SecureStorage, STORAGE_KEYS } from "@/lib/storage";

vi.mock("@/lib/feature-flags/remote", () => ({
  getFeatureFlagsFromServer: vi.fn(),
}));

// test: refreshFromServer stores data
```

Debugging & QA tips

- Quick inspection: read cached snapshots from a console or test:

```ts
await FastCache.getJSON(STORAGE_KEYS.FEATURE_FLAGS);
await SecureStorage.getJSON(STORAGE_KEYS.ENTITLEMENTS);
```

- If entitlements unexpectedly deny access, check `STORAGE_KEYS.CLOCK_INVALID` to see if clock manipulation was detected.

- Logs: feature_flags category is used for informative logs; increase logger level if you need verbose traces.

Backward compatibility & versioning

- The Edge Function response should provide `version` or `etag` where possible. The client treats 304 as a no-op to avoid overwriting local state.
- If storage schema changes require migrations, update `lib/storage/cache-versioning.ts` and bump the stored version via `setVersionedJSON()`.

Next steps (recommended)

- Add the unit tests above (I can scaffold these for you).
- Add small UI hooks (`useFeatureFlags`, `useEntitlements`) if you want React-friendly access patterns.
- Consider a small admin debug screen that shows cached flags and allows manual refresh (already safe — refresh is non-blocking).

Contact

If you want I can now scaffold the core unit tests for `refreshFromServer()` and `getEntitlement()` to speed review.
