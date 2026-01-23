# Users — Query Test Guide (Web)

## Overview

- Purpose: Verify `useCurrentUserQuery` and `useUserQuery` on Web (desktop): cache behavior, storage fallback, and error handling.
- Scope: `hooks/use-users-query.tsx`, `lib/database/users.ts`, `lib/storage/AuthStateManager`.

## Environments

- Web (desktop, staging)

## Prerequisites

- Test user account signed in (staging)

## Test Data

- Test usernames and any admin test accounts you control

## Test Cases

### Test Case — Load current user (cache first)

- Goal: Confirm profile loads from local storage (fast) when available and falls back to DB when not.
- Steps:
  1.  Sign in as test user and open Profile/Settings to populate local cache.
  2.  Refresh the page; observe that profile appears quickly (cache) then stabilizes.
- Expected result:
  - UI shows profile immediately; no visible loading spinner after refresh.
- Evidence: Screenshot of Profile immediately after refresh.

### Test Case — Forced refetch (stale handling)

- Goal: Confirm `staleTime` behavior (1h for current user) and that `refetch` updates data.
- Steps:
  1.  Use the Web console to modify stored cache timestamp (see Test Helpers) to make it stale.
  2.  Call `refetch()` via debug or reload the Profile; verify a network call is made and UI updates if server differs.
- Expected result:
  - Network request is performed and UI reflects server data after refetch.
- Evidence: Console network log + before/after screenshots.

### Test Case — Not-authenticated path

- Goal: Hook returns `null` when user is not authenticated.
- Steps:
  1.  Sign out and open Profile route.
- Expected result:
  - UI shows signed-out state or redirect to login.
- Evidence: Screenshot.

## Test Helpers

- Web console snippet to age a `query_cache` entry or `AuthStateManager` stored user JSON (staging/dev only). Example in `Both/users-query-mutation.md`.

## Related Files

- `hooks/use-users-query.tsx`
- `lib/database/users.ts`
