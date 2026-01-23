# Users — Query Test Guide (App)

## Overview

- Purpose: Verify `useCurrentUserQuery` and `useUserQuery` on App (mobile/Electron): storage fallback, offline behavior, and graceful failures.
- Scope: `hooks/use-users-query.tsx`, `lib/database/users.ts`, `lib/storage/AuthStateManager`.

## Environments

- Desktop app (Electron)
- Mobile app (Expo / iOS / Android)

## Prerequisites

- Test user account signed in (staging)

## Test Data

- Test usernames and any admin test accounts you control

## Test Cases

### Test Case — Load current user (storage fallback)

- Goal: Confirm profile loads from `AuthStateManager` storage when available and falls back to DB when not.
- Steps:
  1.  Sign in as test user and open Profile to populate local storage.
  2.  Restart the app and open Profile.
- Expected result:
  - UI shows profile without waiting for a DB call (fast restore) or shows a loader briefly while refreshing.
- Evidence: Before/after screenshots.

### Test Case — Offline behavior

- Goal: When offline, profile should use stored data and not crash.
- Steps:
  1.  Ensure profile is cached locally.
  2.  Turn device to airplane mode and open Profile.
- Expected result:
  - Stored profile appears; app remains usable.
- Evidence: Screenshot of profile while offline.

### Test Case — Invalid stored data recovery

- Goal: App handles corrupted stored user JSON gracefully.
- Steps:
  1.  (Staging/dev) Overwrite stored user JSON with invalid JSON via a debug helper.
  2.  Restart app and open Profile.
- Expected result:
  - App does not crash; stored entry is cleared and user is asked to re-authenticate or data is re-fetched.
- Evidence: Screenshots and brief notes.

## Test Helpers

- App has no built-in dev console: use a temporary staging-only debug route or function to set storage values (e.g., `SecureStorage.setItem(key, json)`), then restart app.

## Related Files

- `hooks/use-users-query.tsx`
- `lib/database/users.ts`
