# Offline — Test Guide (App: Electron / Mobile)

## Overview

- Purpose: Explain the minimal "offline" behavior in the app: the app persists minimal auth state in `SecureStorage` so users can navigate to allowed screens while offline. There is no automatic offline write-sync or background queue processing for data edits.
- Scope: `lib/auth/auth-state.ts`, `lib/storage/SecureStorage.ts`, `lib/offline/index.ts` (reference only).

## Environments

- Desktop (Electron) and Mobile (Expo)

## Prerequisites

- App dev build installed on a device or emulator
- A test account that was used to sign in at least once on the device (so `hasAccount` may be present)

## Key behavior to test

- The offline support is intentionally small: it allows navigation and read-only access to screens that do not require a live server session by relying on stored auth flags.
- The app does NOT queue and later sync user-created content; actions that require the server should show an offline message or be disabled.

## Test Cases (QA-friendly)

### Test Case — Navigate while offline using stored auth

- Goal: Verify that a previously-signed-in user can open certain protected screens while offline.
- Steps:
  1. Ensure a test device has been signed in previously (ask dev to seed the device if needed).
  2. Turn off network (airplane mode or disable Wi‑Fi/cellular).
  3. Open the app and try to navigate to main/protected screens.
- Expected result:
  - The app allows navigation to screens that are safe to view offline (read-only or cached views). If a screen requires live server data, the app shows a clear offline message.
  - Pass / Fail: [ ] Pass [ ] Fail
  - Evidence: Screenshot of the screen or offline message and a short note of the account used.

### Test Case — Persistence of auth state across restarts

- Goal: `hasAccount` (or equivalent) persists and still allows offline navigation after app restart.
- Steps:
  1. As above, sign in on device, then go offline.
  2. Close/terminate the app and restart it while still offline.
  3. Attempt to open protected screens.
- Expected result:
  - The app behaves the same as before restart (screens accessible or show offline message accordingly).
  - Pass / Fail: [ ] Pass [ ] Fail
  - Evidence: Screenshot and short note of steps.

### Test Case — Server-write actions are disabled or show offline notice

- Goal: Confirm the app does not silently queue edits for later sync; server-write operations should present an offline notice or be disabled.
- Steps:
  1. While offline, attempt an action that normally writes to the server (create world, save changes, etc.).
  2. Observe the UI response.
- Expected result:
  - The app shows a clear offline message or disables the action. No silent local queue should appear in normal QA flows.
  - Pass / Fail: [ ] Pass [ ] Fail
  - Evidence: Screenshot of the UI message and the attempted action.

## Suggestions (for developer follow-up)

- Add a simple QA/dev menu (dev-only) to show whether `hasAccount` is set on the device — this helps testers confirm setup without developer logs.
- Provide clear, user-facing offline messaging for any action that requires a live server.

## Related Files (for maintainers)

- `lib/auth/auth-state.ts`
- `lib/storage/SecureStorage.ts`
- `lib/offline/index.ts` (reference)
