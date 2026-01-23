# Users — Query & Mutation Test Guide

## Overview

- Purpose: Verify fetching and updating the current user's profile, and confirm cache invalidation and storage updates.
- Scope: `hooks/use-users-query.tsx`, `hooks/use-users-mutation.tsx`, `lib/database/users.ts`, `lib/storage/AuthStateManager` (via `AuthStateManager.saveUserData`).

## Environments

- Web (desktop)
- Desktop app (Electron)
- Mobile app (Expo)

## Prerequisites

- Test user account (with profile) signed in

## Test Data

- Test username values for update (valid and invalid cases)

## Test Cases

### Test Case — Fetch current user (happy path)

- Goal: `useCurrentUserQuery` returns the user from storage or DB.
- Steps:
  1.  Sign in as test user.
  2.  Open the Profile or Settings screen that shows username.
- Expected result:
  - Username and profile data are shown (loaded from cache or DB).
- Evidence: Screenshot of profile UI.

### Test Case — Update username (mutation)

- Goal: Updating username via Settings calls `usersDB.updateCurrentUser`, invalidates cache, and updates local storage.
- Steps:
  1.  Open Settings and change username to a valid new value.
  2.  Submit the change and wait for success state.
  3.  Observe profile UI updates and reuses cached value.
- Expected result:
  - UI shows new username, and subsequent visits show updated value without stale data.
- Evidence: Before/after screenshots; note any error messages.

### Test Case — Invalid username (fail gracefully)

- Goal: Validation on username rejects invalid input and surfaces user-friendly error.
- Steps:
  1.  Attempt to set username containing invalid characters (per `validateUsername`).
- Expected result:
  - UI shows a validation error and the mutation does not proceed.
- Evidence: Screenshot of validation error.

### Test Case — Delete account (end-to-end)

- Goal: Deleting account triggers server-side function and invalidates caches.
- Steps:
  1.  Use delete account flow in Settings.
  2.  Confirm deletion and observe returned UI state.
- Expected result:
  - User is signed out and local caches cleared; deletion returns success.
- Evidence: Screenshots and notes.

## Scripts / Automation

- For integration tests, call the `usersDB` endpoints/edge function in staging with a test account and assert DB state plus local storage.

## Related Files

- `hooks/use-users-query.tsx`
- `hooks/use-users-mutation.tsx`
- `lib/database/users.ts`
