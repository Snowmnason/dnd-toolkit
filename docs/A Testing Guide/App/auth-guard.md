# Auth Guard — Test Guide (App: Electron / Mobile)

## Overview

- Purpose: App-only tests for `useAuthGuard` behavior: subscription readiness, `SecureStorage`, and deep-link handling via platform schemes.
- Scope: `lib/auth/useAuthGuard.ts`, `lib/auth/auth-state.ts`, `lib/storage/SecureStorage.ts`.

## Environments

- Desktop (Electron) and Mobile (Expo)

## Prerequisites

- App dev build installed on a device, emulator, or desktop (Electron).
- A test account (confirmed) and at least one test world ID (allowed and denied cases).

## Test Data

- Test users: `user_confirmed`, `user_no_session` (if available)
- Worlds: `world-allowed`, `world-denied`

## Test Cases (QA-focused, non-technical)

### Test Case — App start with existing session

- Goal: If the user already has a valid session, they should be allowed into protected pages without extra steps.
- Steps:
  1. Install and open the app.
  2. Use the test account that is expected to be signed in on the staging environment (ask dev to ensure the session exists if unsure).
  3. Open a protected screen (Examples: Main, Settings) from the app menu.
- Expected result:
  - The protected screen loads and the user can interact with it.
  - Pass / Fail: [ ] Pass [ ] Fail
  - Evidence: Screenshot of the protected screen and short note about which account was used.

### Test Case — Local-account fallback (no network)

- Goal: When the device has no network, the app should use the stored account flag to allow basic access where appropriate.
- Steps:
  1. Turn off network (airplane mode or disable Wi-Fi/cellular).
  2. Open the app using a device that previously had `hasAccount` set (ask dev to seed a test device if needed).
  3. Try to reach a protected screen.
- Expected result:
  - The app should either allow access (if local state permits) or show a clear message directing the user to re-login or select a world. No developer console is required.
  - Pass / Fail: [ ] Pass [ ] Fail
  - Evidence: Screenshot of the screen and the message shown, plus a short note of steps taken.

## Notes for testers (non-technical)

- You do not need to open a console or developer logs for these tests. If developers ask you to capture logs, they should provide a simple method or tool to do so.
- If a test requires a session or seeded storage value, ask the developer to prepare the device or provide a test build labeled for QA.

## Suggestions (for developer follow-up)

- Add a small QA/dev menu (dev-only) to show whether `hasAccount` and `world_access_*` are set for the current device; this simplifies testing without exposing technical details to QA.

## Related Files (for maintainers)

- `lib/auth/useAuthGuard.ts`
- `lib/auth/auth-state.ts`
- `lib/storage/SecureStorage.ts`
