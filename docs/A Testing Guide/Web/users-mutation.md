# Users — Mutation Test Guide (Web)

## Overview

- Purpose: Verify `useUpdateUserMutation` and `useDeleteAccountMutation` on Web: validation, optimistic updates, cache invalidation, error handling, and offline failure modes.
- Scope: `hooks/use-users-mutation.tsx`, `lib/database/users.ts`, `lib/cache/query-cache.ts`, `lib/storage/AuthStateManager`.

## Environments

- Web (desktop, staging)

## Prerequisites

- Signed-in test user with editable profile

## Test Data

- New valid username values
- Invalid username inputs (special chars, too long)

## Test Cases

### Test Case — Update username (happy path)

- Goal: Updating the username persists server-side, invalidates cache, and updates local storage.
- Steps:
  1. Open Settings/Profile screen.
  2. Change username to a valid new value and submit.
  3. Wait for success confirmation.
- Expected result:
  - Profile UI shows new username.
  - `QueryCache.invalidateByTags(['users'])` runs (engineers can confirm via logs).
  - `AuthStateManager.saveUserData` updated local storage with new username.
- Evidence:
  - Before/after screenshots of profile.
  - Network request/response in DevTools showing update succeeded.

### Test Case — Invalid username (client validation)

- Goal: UI rejects invalid usernames and mutation is not called.
- Steps:
  1. Enter invalid username (e.g., spaces-only, disallowed chars) and submit.
- Expected result:
  - UI shows a validation error; no network call to update user.
- Evidence: Screenshot of validation error and no network request.

### Test Case — Mutation optimistic UI (if used)

- Goal: If UI applies optimistic updates, confirm revert behavior on failure.
- Steps:
  1. Trigger an update while engineering toggles a staged failure in backend (or use network throttle to simulate failure).
  2. Observe UI: optimistic change applied then reverted on error.
- Expected result:
  - UI briefly shows optimistic value, then reverts and displays error notification.
- Evidence: Screen recording or sequential screenshots.

### Test Case — Offline / network failure behavior

- Goal: Confirm mutation fails gracefully when offline and does not corrupt local cache.
- Steps:
  1. Put browser offline (simulate in DevTools) and attempt username update.
  2. Observe error UI and subsequent storage state.
- Expected result:
  - Mutation surfaces an error; local cache is not left in an inconsistent state.
- Evidence: Screenshot of error and profile unchanged.

### Test Case — Delete account (end-to-end)

- Goal: Account deletion calls server-side function and clears local caches.
- Steps:
  1. From Settings, choose Delete Account and confirm.
  2. Observe app behavior (sign-out, redirects) after server confirms deletion.
- Expected result:
  - User is signed out and local caches cleared; deletion succeeded server-side.
- Evidence: Screenshots, network call showing edge function invoked, UI signed-out state.

## Test Helpers

- Use DevTools Network tab to confirm requests and responses.
- To force failures in staging, engineering can add a temporary flag to the update endpoint to return 500.

## Related Files

- `hooks/use-users-mutation.tsx`
- `lib/database/users.ts`
- `lib/cache/query-cache.ts`
