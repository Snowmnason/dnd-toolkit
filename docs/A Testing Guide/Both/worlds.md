# Worlds — Test Guide (Both: Web & App)

## Overview

- Purpose: Platform-independent guide for world listing, invites, membership verification, and cache refresh behavior that applies to both Web and App QA.
- Scope: `lib/auth/auth-state.ts`, `lib/database/worlds.ts`, `hooks/use-worlds-query.tsx`, `lib/storage/update-storage-cache.ts`.

## Environments

- Web (desktop browsers)
- App (Electron and Expo)

## Prerequisites

- Test accounts with and without world membership
- Test world IDs for invites and membership checks

## Test Data

- `world-allowed`, `world-denied`, `world-invite-pending`

## Test Cases

### Test Case — Connected worlds cache displays fast then refreshes

- Goal: Cached connected worlds display immediately; `refreshAllWorldsCache()` updates list.
- Steps:
  1. Seed `SecureStorage`/local storage with `CONNECTED_WORLDS` entries.
  2. Launch the app (web or app) and confirm list loads quickly.
  3. Trigger cache refresh and confirm list updates.
- Expected result:
  - Fast initial load from cache, then updated list after refresh; logs show cache refresh events.
- Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Invite acceptance updates local cache and server

- Goal: Accepting an invite reflects in local cache and server membership.
- Steps:
  1. Send invite to test user for `world-invite-pending`.
  2. As invitee, accept invite via UI (web or app).
  3. Confirm membership via `worlds` list and server query.
- Expected result:
  - Local cache and server show membership.
- Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Denied access redirects to selection

- Goal: Users without membership who navigate to a `world-required` page are redirected appropriately.
- Steps:
  1. Navigate to a `world-required` page for `world-denied`.
  2. Observe navigation and any user-facing message.
- Expected result:
  - Redirect to world selection; recommended: show a toast explaining denial.
- Pass / Fail: [ ] Pass [ ] Fail

## Suggestions (both)

- Add an explicit log entry when `refreshAllWorldsCache()` runs noting initiator (manual vs. automatic).
- Provide a dev-only retry button for failed verifications across both Web and App.

## Related Files

- `lib/auth/auth-state.ts`
- `lib/database/worlds.ts`
- `lib/storage/update-storage-cache.ts`
