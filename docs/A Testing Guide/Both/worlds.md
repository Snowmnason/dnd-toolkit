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

> Note: Invite flows may only work on Web currently — if testing on App, confirm with devs whether invite links are enabled for your build.

### Test Case — Denied access redirects to selection

- Goal: Users without membership who navigate to a `world-required` page are redirected appropriately.
- Steps:
  1. Navigate to a `world-required` page for `world-denied`.
  2. Observe navigation and any user-facing message.
- Expected result:
  - Redirect to world selection; recommended: show a toast explaining denial.
- Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Create world (both)

- Goal: Creating a new world updates the server and local cache, and appears in the connected worlds list.
- Steps:
  1. From the Worlds UI, choose "Create world" and fill required fields (name, description).
  2. Submit the create action.
  3. Confirm the new world appears in the worlds list and is present on the server.
- Expected result:
  - The new world is visible in the UI immediately (after optimistic update or refresh) and persists after reload.
  - Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Edit world (both)

- Goal: Editing world metadata updates cache and server and is reflected in the UI.
- Steps:
  1. Open an existing world you own/are permitted to edit.
  2. Change a visible field (e.g., name or description) and save.
  3. Confirm the change appears in lists and the world detail view.
- Expected result:
  - Edited fields update on the server and local cache; UI shows new values without stale data.
  - Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Delete world (both)

- Goal: Deleting a world removes it from the user's worlds list and server.
- Steps:
  1. From a world you own (or in a staging test account), select delete and confirm the destructive action.
  2. Verify the world no longer appears in the connected worlds list and server-side queries.
- Expected result:
  - World is removed locally and on server; any attempts to open its pages redirect to world-selection.
  - Pass / Fail: [ ] Pass [ ] Fail

## Suggestions (both)

- Add an explicit log entry when `refreshAllWorldsCache()` runs noting initiator (manual vs. automatic).
- Provide a dev-only retry button for failed verifications across both Web and App.

## Mutations exercised by these tests

- The Create / Edit / Delete test cases exercise the corresponding server mutations (createWorld, updateWorld, deleteWorld) and their UI flows. The delete/edit actions typically use a modal confirmation — include confirm and cancel paths when testing to validate both the happy path and cancellation handling.

## Related Files

- `lib/auth/auth-state.ts`
- `lib/database/worlds.ts`
- `lib/storage/update-storage-cache.ts`
