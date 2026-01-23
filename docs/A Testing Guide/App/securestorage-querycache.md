# SecureStorage & QueryCache — Test Guide

## Overview

- Purpose: Verify persistence, freshness, and mutation interactions for local storage and query cache on App (mobile / Electron).
- Scope: `lib/storage/SecureStorage.ts`, `lib/storage/FastCache.ts`, `lib/cache/query-cache.ts`, `lib/storage/update-storage-cache.ts`.

## Environments

- Desktop app (Electron)
- Mobile app (Expo / iOS / Android)

## Prerequisites

- Test user account signed in
- A world with at least one item/list that populates the query cache (e.g., Worlds list)
- Device/emulator where you can restart the app

## Test Data

- Test user credentials
- World ID(s) used by QA (use staging/test world)

## Test Cases

### Test Case — Persistence after restart

- Goal: Confirm SecureStorage persists key UI state across app restart.
- Steps:
  1.  Sign in as test user.
  2.  Navigate to a world (or set theme preference) that writes a `STORAGE_KEYS` entry (e.g., connected world, theme).
  3.  Close the app completely and reopen it.
- Expected result:
  - The app restores the same world selection / theme without requiring re-login or re-selection.
- Pass / Fail: [ ] Pass [ ] Fail
- Evidence:
  - Screenshots before closing and after reopening showing same UI state.

### Test Case — Clear-on-logout

- Goal: Confirm logout removes sensitive stored keys.
- Steps:
  1.  Sign in and ensure `CONNECTED_WORLDS` or user data exists in storage (visible in UI).
  2.  Perform logout from Settings.
  3.  Reopen app or check returned UI state.
- Expected result:
  - App displays signed-out UI and world-related/identity state is cleared.
- Evidence: UI screenshots; optional `getAllKeys()` export if available.

### Test Case — Cache freshness & offline read (QueryCache)

- Goal: Cached query results are shown immediately when offline; stale entries revalidate when forced.
- Steps:
  1.  Ensure worlds/list has been opened recently (so cache exists).
  2.  Toggle device to airplane mode and open the same screen.
  3.  Verify list appears immediately (from cache) without an error.
  4.  Simulate a stale cache by updating the stored `timestamp` (see Test Helpers) or waiting > staleTime, then open screen with network on and verify revalidation network call occurs (UI updates if changed).
- Expected result:
  - While offline, cached UI is visible.
  - When cache is stale and network available, a revalidation request is performed and UI updates.
- Evidence:
  - Screenshots of cached UI while offline.
  - Network-log excerpt or brief note showing the revalidation request (if available).

### Test Case — Mutation invalidation

- Goal: Creating/updating/deleting a world or updating user profile invalidates cache and refreshes UI.
- Steps:
  1.  From UI, create or update a world or change username in Settings (use `useUpdateUserMutation` flow).
  2.  Observe whether the list or profile UI reflects the change without manual refresh.
- Expected result:
  - UI updates to show new/updated data; QueryCache invalidation is performed (`invalidateByTags(['users','worlds'])`).
- Evidence:
  - Before/after screenshots and any visible in-app success message. Optional logger excerpt showing `Invalidated` message.

### Test Case — Failure & recovery

- Goal: App recovers gracefully when storage is corrupted or removed.
- Steps:
  1.  (Test-only) Overwrite a versioned storage entry with malformed JSON (see Test Helpers).
  2.  Restart or open affected screen.
- Expected result:
  - App does not crash; the invalid entry is cleared and app falls back to safe defaults.
- Evidence:
  - Screenshots and brief notes.

## Test Helpers (how to force stale / update timestamps)

- Web console (for debug builds):

```js
// Example: mark a query cache entry stale by setting an old timestamp
const key = "query_cache_worlds:list";
const raw = sessionStorage.getItem(key);
if (raw) {
  const entry = JSON.parse(raw);
  entry.timestamp = Date.now() - 1000 * 60 * 60 * 24; // 24h ago
  sessionStorage.setItem(key, JSON.stringify(entry));
}

// For SecureStorage (versioned JSON), write a manual entry if EncryptedStorage exposes get/set
// Example JSON shape: { version: 1, data: { ... }, timestamp: 123456789 }
```

- App (mobile / Electron):
  - App currently has no dev console by default. To test timestampping you can:
    - Add a temporary debug screen that calls `SecureStorage.setItem(key, jsonString)` with modified `timestamp`.
    - Or add a short, test-only function in `scripts/debug.tsx` and run via a dev build.

Include minimal helper code only in staging/dev builds and remove before shipping.

## Scripts (if applicable)

- Suggestion: small CI/dev script to inject stale timestamps into `FastCache` or `EncryptedStorage` for automated freshness tests. Keep destructive scripts limited to staging.

## Risk / Known Issues

- EncryptedStorage on native platforms may prevent easy plaintext inspection; prefer UI-state checks.
- QueryCache uses in-memory + FastCache; restarting the app clears the in-memory cache but FastCache may persist depending on backend.

- Clock tampering / timestamp integrity: timestamps used for versioned entries and cache freshness rely on `Date.now()` (device clock). If a tester or attacker manually changes the device clock (set far forward or back) it can make cache entries appear artificially fresh or stale. QA checks:
  - Test: change device clock ahead (e.g., +10 years), perform cache write, revert clock to correct time, and reopen app — verify app does not accept a restored-local time as authoritative for freshness-sensitive flows.
  - Expected mitigation: app should treat timestamps conservatively (never accept a timestamp older than the stored entry) or re-verify with the server when clock anomalies are detected.
  - Engineering note: consider storing `lastKnownServerTime` when online and compare on startup; for critical verification use a server-side timestamp check instead of relying solely on local clocks.

## Related Files

- `lib/storage/SecureStorage.ts`
- `lib/storage/FastCache.ts`
- `lib/cache/query-cache.ts`
- `lib/storage/update-storage-cache.ts`
