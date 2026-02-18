# Offline Mutation Queue — Test Guide

## Overview

- **Purpose:** Verify that changes made while offline are queued, persisted, and synced correctly when connectivity is restored.
- **What we're testing:** Offline queue behaviour, sync order, retry logic, and the in-app sync status indicator.

## Environments

- Both (Web + iOS/Android)

## Prerequisites

- **Test accounts:** Any logged-in account with access to at least one world.
- **Test data:** At least one existing world with editable content (characters, notes, etc.).
- **Setup steps:**
  - Web: Open browser DevTools → Network tab → set throttling to "Offline".
  - iOS/Android: Enable Airplane Mode.

---

## How the Offline Queue Works

When you make a change (create, edit, delete) with no network connection, the app stores it locally rather than losing it. A sync indicator appears in the UI showing pending changes. When connectivity is restored, queued changes sync to the server in the order they were made (oldest first). If the server rejects a change permanently (e.g. a validation error), the change is discarded and the UI is rolled back.

---

## Test Cases

### ✓ Test 1: Create while offline, sync on reconnect

**Scenario:** A user creates a new item while offline and the change syncs after reconnecting.

**Steps:**

1. Go offline (Airplane Mode / DevTools "Offline").
2. Navigate to a world and create a new item (e.g. a character or note).
3. Verify the item appears immediately in the UI.
4. Verify a sync status indicator (e.g. "1 pending change") is visible.
5. Restore connectivity.
6. Wait 5–10 seconds.

**Expected Outcome:**

- ✅ Item appeared in the UI instantly (optimistic update).
- ✅ Sync indicator was visible while offline.
- ✅ After reconnecting, the indicator disappears.
- ✅ The item is still present and confirmed saved.

**How to Record a Pass:**

- [ ] Screenshot of the item appearing while offline with the pending indicator.
- [ ] Screenshot after sync showing the indicator gone and item still visible.

**How to Record a Fail:**

- [ ] Screenshot showing the item missing or the indicator stuck after reconnecting.
- [ ] Note: "[What happened and when]"

---

### ✓ Test 2: Queue persists across app restart

**Scenario:** A user makes offline changes, restarts the app while still offline, and changes are not lost.

**Steps:**

1. Go offline.
2. Make 2–3 edits (e.g. rename a character, add a note).
3. Close and reopen the app without restoring connectivity.
4. Verify the pending sync indicator still shows.
5. Restore connectivity and wait for sync to complete.

**Expected Outcome:**

- ✅ Pending changes survive the app restart.
- ✅ Sync indicator is still present after restart.
- ✅ All edits sync in order (oldest first) after reconnecting.
- ✅ UI reflects the final saved state.

**How to Record a Pass:**

- [ ] Screenshot of pending indicator after restart (still offline).
- [ ] Screenshot after sync completing successfully.

**How to Record a Fail:**

- [ ] Screenshot showing changes missing after restart.
- [ ] Note: "[Which changes were lost and what steps were taken]"

---

### ✓ Test 3: Multiple mutations sync in order

**Scenario:** Several offline changes (create, edit, delete) queue up and sync in the correct order.

**Steps:**

1. Go offline.
2. Perform three distinct actions in order: create an item, edit it, then delete a different item.
3. Note the order of actions.
4. Restore connectivity and wait for sync.

**Expected Outcome:**

- ✅ All three changes sync successfully.
- ✅ The final state reflects actions in the correct sequence (create → edit → delete).
- ✅ No phantom items appear or disappear unexpectedly.

**How to Record a Pass:**

- [ ] Screenshot of world state after sync matches expected outcome.

**How to Record a Fail:**

- [ ] Screenshot showing items in wrong state or out-of-order changes.
- [ ] Note: "[What order changes were visible vs expected]"

---

### ⚡ Test 4: Optimistic update rolls back on permanent server failure

**Scenario:** A change is rejected by the server permanently and the UI rolls back.

**Steps:**

1. Make a change designed to fail server validation (e.g. a name that exceeds the server-enforced character limit or a duplicate unique value).
2. Restore connectivity (or if already online, wait for the sync attempt).

**Expected Outcome:**

- ✅ The app initially shows the change (optimistic update).
- ✅ After server rejection, the item reverts to its previous state.
- ✅ An error message or toast informs the user the change could not be saved.
- ✅ No broken or stuck loading indicator remains.

**How to Record a Pass:**

- [ ] Screenshot of rollback with the error message visible.

**How to Record a Fail:**

- [ ] Screenshot of the rejected change remaining in the UI with no feedback.
- [ ] Note: "[What was the expected rollback and what actually appeared]"

---

### ✓ Test 5: Sync status indicator visibility

**Scenario:** The sync indicator only appears when there are pending changes, and disappears after sync.

**Steps:**

1. With connectivity, verify no sync indicator is visible.
2. Go offline and make one change.
3. Verify the indicator appears.
4. Restore connectivity and wait for sync.
5. Verify the indicator disappears.

**Expected Outcome:**

- ✅ Indicator is hidden when queue is empty and online.
- ✅ Indicator appears as soon as a change is queued while offline.
- ✅ Indicator shows a loading/spinner state while syncing.
- ✅ Indicator disappears once the queue is drained.

**How to Record a Pass:**

- [ ] Screenshot showing no indicator (online, empty queue).
- [ ] Screenshot showing indicator (offline, pending changes).
- [ ] Screenshot showing indicator gone (after sync).

**How to Record a Fail:**

- [ ] Screenshot of stuck indicator or indicator missing when changes are pending.

---

## Platform-Specific Notes

- **Web:** Use browser DevTools → Network tab → set to "Offline". Restore by setting back to "No throttling".
- **iOS/Android:** Use Airplane Mode to cut connectivity. Disable Airplane Mode to restore.

---

## Troubleshooting

- If the sync indicator does not appear after going offline, try navigating to a different screen and back to trigger a UI refresh.
- If changes are lost after restart on iOS/Android, check that the device did not clear app data or that the app is not running in a restricted storage environment.
- If you see a stuck loading spinner after sync, note the exact steps taken and report — this indicates a queue processing issue.
