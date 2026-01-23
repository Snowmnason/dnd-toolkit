# Users — Mutation Test Guide (App)

## Overview

- Purpose: Verify `useUpdateUserMutation` and `useDeleteAccountMutation` on App (mobile/Electron): validation, cache invalidation, storage updates, and offline failure handling without a console.
- Scope: `hooks/use-users-mutation.tsx`, `lib/database/users.ts`, `lib/cache/query-cache.ts`, `lib/storage/AuthStateManager`.

## Environments

- Desktop app (Electron)
- Mobile app (Expo / iOS / Android)

## Prerequisites

- Signed-in test user

## Test Data

- New valid username values
- Invalid username inputs

## Test Cases

### Test Case — Update username (happy path)

- Goal: Updating username updates server, cache, and local storage.
- Steps:
  1. Open Settings/Profile and change username.
  2. Submit and wait for success UI.
- Expected result:
  - Profile shows new username.
  - Query cache invalidation triggers and UI reflects changes without manual refresh.
  - Local stored user data updated via `AuthStateManager.saveUserData`.
- Evidence: Before/after screenshots and any in-app success toast.

### Test Case — Invalid username (client validation)

- Goal: UI prevents invalid username submissions.
- Steps:
  1. Enter invalid username and submit.
- Expected result:
  - UI shows validation message and no network attempt is made.
- Evidence: Screenshot of validation message.

### Test Case — Offline attempt (app without console)

- Goal: Confirm app surfaces failure when attempting mutation offline.
- Steps:
  1. Disable network on device (airplane mode).
  2. Attempt username update.
  3. Observe UI error handling and ensure local cache remains consistent.
- Expected result:
  - User sees an error message; local profile is unchanged.
- Evidence: Screenshot of error message and profile state.

### Test Case — Delete account

- Goal: Deleting account calls the server-edge function and clears local storage and cache.
- Steps:
  1. Use Delete Account flow in Settings and confirm.
  2. Observe resulting UI (signed out) and that sensitive storage keys cleared.
- Expected result:
  - App signs out, caches cleared, and user cannot access protected routes.
- Evidence: Screenshots and brief note of cleared UI state.

## Test Helpers

- App has no dev console; use a staging-only debug screen or a temporary deep link that triggers a test failure or sets `SecureStorage` values.

## Related Files

- `hooks/use-users-mutation.tsx`
- `lib/database/users.ts`
