# Offline Foundation — Testing Guide (LWW — v1)

Purpose

This concise guide explains how QA or a non-developer can validate the app's offline behavior now that v1 uses a single conflict policy: Last-Write-Wins (LWW). No modal-based conflict resolution exists in v1 — conflicts are resolved automatically.

What this verifies

- The app accepts and persists user changes while offline.
- Offline changes sync automatically when connectivity returns.
- Sync notifications and retry flows are visible and actionable.
- LWW conflict behavior: newer write wins automatically (no user modal).

Preconditions

- Use a test account with at least one world and some user-owned items (notes, characters, shops).
- Run the app on a device/emulator with a way to toggle network (Airplane Mode, emulator controls, or browser DevTools Offline).
- Notifications (toasts/snackbars) should be visible; TopBar shows offline indicator.

How to toggle network

- Mobile (device): enable Airplane Mode or disable Wi‑Fi + Cellular.
- Emulator/Simulator: use the emulator's network controls.
- Web: DevTools → Network → Offline.

Quick checklist

- Ensure you're logged in to the test account.
- Confirm TopBar offline dot appears when you go offline.
- Make a small edit and verify immediate local persistence.

Test Cases (focused, LWW-aware)

1. Basic Offline Edit → Auto-Sync

- Steps:
  1. Start online and log in.
  2. Open a user-owned item (note/character).
  3. Go offline.
  4. Make an edit and save.
  5. Go online.
- Observations / Expected:
  - App accepts the edit offline and shows no hard error.
  - A toast appears: "Syncing 1 change...", then "✓ 1 change synced.".
  - Server reflects the local edit after sync.

2. Multiple Offline Edits (ordering / last-write wins semantics)

- Steps:
  1. While offline, make Edit A, then Edit B on the same item.
  2. Go online.
- Expected:
  - Mutations are applied in order; final server state equals the last local edit (Edit B).

3. Offline Create → Sync

- Steps:
  1. While offline, create a new note/character/shop.
  2. Go online.
- Expected:
  - Creation syncs and the new item appears in server-backed lists.

4. Conflict — Server Newer vs Local Newer (LWW behavior)

- Important: v1 resolves conflicts automatically with LWW. There is NO modal.
- Two quick scenarios:
  A) Server newer (server should win):
  - Make a change on Server A (or Device A) and save.
  - On Device B, while offline, make a conflicting change and then go online.
  - Expected: Server version is newer → the offline mutation will be discarded and server state remains.

  B) Local newer (local should win):
  - While offline on Device B, make a change and ensure its timestamp is newer than server's.
  - Go online.
  - Expected: Local write wins and is applied to the server (mutation retried).

- Pass criteria:
  - Behavior matches LWW semantics: newer timestamp wins; no modal appears.

5. Sync Failure & Retry

- Steps:
  1. Simulate flaky network so sync fails (toggle quickly or use network filters).
  2. Observe snackbar offering "Retry".
  3. Tap Retry while stable network is available.
- Expected: Retry triggers a new sync attempt that succeeds when network is stable.

6. App Restart With Pending Queue

- Steps:
  1. Make edits while offline.
  2. Kill the app before going online.
  3. Relaunch and go online.
- Expected: Queue persists and sync resumes; pending items sync.

7. Large Queue / Batch Processing

- Steps:
  1. Perform 10–50 small offline edits.
  2. Go online.
- Expected: App processes the backlog in batches without timing out; final server state reflects last local edits.

8. Auth Expiry During Sync

- Steps:
  1. Revoke or expire the test token (server side) while device has a pending queue.
  2. Go online.
- Expected: Sync pauses and app prompts for re-auth (or reauths automatically if supported); after valid session, sync resumes.

UX / Visual Expectations (v1)

- TopBar shows offline indicator when disconnected.
- Toasts: "You are offline", "You are back online", "Syncing X changes...", "✓ X changes synced.".
- Snackbar on failures with "Retry".
- NO conflict modal in v1 — conflicts are handled automatically via LWW.

Bug report checklist

- Exact steps to reproduce, device/OS, app build/version.
- Time of test, network toggles used, and whether a second device/server made concurrent changes.
- Screenshots of toasts/snackbar and any relevant logs.
- Server evidence if available (item state or logs).

Pass/Fail Template

- Test case: <name>
- Date/time:
- Device/OS:
- App version/build:
- Steps performed:
- Expected result:
- Actual result:
- Pass/Fail:
- Notes / Attachments:

Support

If tests fail consistently, open a bug and tag `@dev-team` and `@qa`. Attach screenshots and logs. If a non-developer needs help toggling network or capturing logs, ask a developer for a short demo.

—

This guide is focused and LWW-aware for v1. If you'd like, I can also:

- Produce a printable checklist version, or
- Convert these into automated E2E templates (Cypress/TestCafe).
