# Network Error Recovery — Test Guide

## Overview

- **Purpose:** Verify that the app handles network disconnections gracefully and recovers properly when the connection returns
- **What we're testing:** Error messages during network loss, app stability without internet, recovery when network returns, retry mechanisms, error states

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:** One active account signed in
- **Test data:** Load a world with some data (characters, items, etc.)
- **Tools needed:**
  - A way to disable/enable network:
    - **Mobile**: Airplane mode toggle
    - **Desktop**: WiFi toggle or airplane mode
    - **Web**: Browser DevTools Network tab (can throttle or disable)
  - Or unplug your router / disable network adapter

## How Network Errors Work

When the app loses internet connection, it can't send or receive data. The app should:

1. Detect the loss quickly
2. Show a clear error message (not crash)
3. Prevent broken or incomplete actions
4. Automatically retry when connection returns
5. Resume normal operation without manual refresh (ideally)

Why this matters: Users lose wifi constantly (spotty connections, switching networks, going offline). If the app crashes or gets stuck, data corruption or bad UX results.

## Test Cases

### ✓ Test 1: App Detects Network Loss

**Scenario:** While using the app, network disconnects; the app notifies you

**Steps:**

1. Sign in and load a world with data visible
2. Disable network (airplane mode or disable WiFi)
3. Wait 2-3 seconds
4. Try to interact with the app (scroll, tap a button, navigate)

**Expected Outcome:**

- ✅ App detects the network is gone within a few seconds
- ✅ Error message appears (e.g., "No internet connection", "Connection lost", or a banner/toast)
- ✅ App does not crash or freeze
- ✅ App remains responsive (you can still navigate/scroll)
- ✅ Cached data (what was already loaded) is still visible

**How to Record a Pass:**

- [ ] Screenshot showing the network error message
- [ ] Screenshot showing the app is still responsive (not frozen/crashed)
- [ ] Note: "Network loss detected in [X] seconds"

---

### ✓ Test 2: Cannot Perform Actions While Offline

**Scenario:** You try to perform an action (create, edit, delete) while offline; the app blocks it or shows an error

**Steps:**

1. Network is disabled (from Test 1)
2. Try to:
   - Create a new character (or item, note, etc.)
   - Edit an existing entity
   - Delete something
   - Invite a user
3. Observe what happens

**Expected Outcome:**

- ✅ App either:
  - Blocks the action and shows "Can't perform action while offline"
  - Queues the action for later (shows "Pending" or "Syncing" state)
  - Shows a clear error explaining the action requires internet
- ✅ Action does NOT silently fail or appear to succeed locally without notice
- ✅ App does NOT crash or leave data in a broken state
- ✅ Clear error message guides the user (e.g., "Reconnect to save changes")

**How to Record a Pass:**

- [ ] Screenshot of attempted action and error message
- [ ] Note: "Offline action properly rejected with message: [error text]"

---

### ✓ Test 3: App Recovers When Network Returns

**Scenario:** Network was offline, you re-enable it; the app automatically resumes normal operation

**Steps:**

1. Network is disabled (from Test 1)
2. You see the network error message and app is offline
3. Re-enable network (airplane mode off, WiFi on, etc.)
4. Wait 2-3 seconds
5. The app should automatically recover

**Expected Outcome:**

- ✅ Error message disappears
- ✅ App automatically reconnects (no manual refresh needed, ideally)
- ✅ App resumes normal behavior
- ✅ You can now perform actions again
- ✅ If there was a pending action, it might retry automatically

**How to Record a Pass:**

- [ ] Screenshot showing error message before reconnecting
- [ ] Screenshot showing normal state after reconnecting
- [ ] Note: "App recovered when network returned; no manual refresh needed"

---

### ✓ Test 4: Pending Actions Sync After Reconnection

**Scenario:** You queue an action while offline; it syncs when network returns

**Steps:**

1. Disable network
2. Try to perform an action (e.g., add a new character) that the app queues
3. (Ideally, the app shows a "Pending" or "Syncing" state)
4. Re-enable network
5. Wait 2-3 seconds and check if the action syncs

**Expected Outcome:**

- ✅ If the app queued the action, it auto-retries after reconnecting
- ✅ The action completes and the pending state clears
- ✅ No manual refresh required
- ✅ Data is consistent (you see the new character in the list)

**How to Record a Pass:**

- [ ] Screenshot showing "Pending" state while offline
- [ ] Screenshot showing the action completed after reconnecting
- [ ] Note: "Pending action synced automatically after reconnection"

---

### ⚡ Test 5: Network Flakiness (Rapid On/Off)

**Scenario:** Network rapidly connects and disconnects; app handles it gracefully

**Steps:**

1. Turn network off
2. Wait 1 second
3. Turn network on
4. Wait 1 second
5. Turn network off again
6. Repeat 3-4 times rapidly

**Expected Outcome:**

- ✅ App does not crash, freeze, or enter a stuck state
- ✅ Error messages update but don't spam the screen (coalesced or debounced)
- ✅ No data corruption (pending data is not duplicated or lost)
- ✅ App remains responsive throughout

**How to Record a Pass:**

- [ ] Screenshot showing app stable after flaky network (no crash/freeze)
- [ ] Note: "App handled rapid network on/off without crashing"

---

### ⚡ Test 6: Offline Mode on App (Read-Only Access)

**Scenario:** App supports offline mode; you can view cached data but not modify

**Steps:**

1. Load a world and view some data while online
2. Disable network
3. Try to view the same data (should be cached)
4. Try to create/edit/delete something (should be blocked or queued)

**Expected Outcome:**

- ✅ Cached data is visible (characters, items, notes, etc.)
- ✅ You cannot perform write actions offline
- ✅ Clear error or "offline mode" indicator shows
- ✅ Data is not corrupted or lost

**How to Record a Pass:**

- [ ] Screenshot of cached data visible while offline
- [ ] Screenshot of attempted write action blocked with error
- [ ] Note: "Offline mode: read access yes, write access no"

---

### ✗ Test 7: Stale Data Handling (Edge Case)

**Scenario:** You were viewing data, went offline, then someone else modified that data online; when you reconnect, you get the latest version

**Steps:**

1. Account A and Account B are in the same world
2. Account A: Load a character (e.g., "Barbarian", health = 10)
3. Account A: Go offline
4. Account B: Edit the same character (health = 8)
5. Account A: Reconnect to network
6. Account A: Refresh or wait for sync, then view the character again

**Expected Outcome:**

- ✅ Account A sees the updated health (8, not stale 10)
- ✅ No data conflict (app doesn't ask which version to keep, or picks the server version)
- ✅ App automatically fetches fresh data after reconnecting

**How to Record a Pass:**

- [ ] Screenshot showing Account B's edit (character health = 8)
- [ ] Screenshot showing Account A's view after reconnecting (updated to 8)
- [ ] Note: "Stale data refreshed after reconnection"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Use airplane mode to test (quickest method)
- Offline error messages should appear in-app
- Watch for loading spinners that spin infinitely (sign of a stuck request—reload if needed)

### Web

- Use browser DevTools Network tab to simulate offline (throttle to "Offline")
- Or disable WiFi directly
- Network errors may appear as browser-level notifications or in-app toasts

---

## Troubleshooting

| Issue                                                 | Solution                                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Network disabled but app still claims it's online** | Restart the app. Network detection may have stale state.                                                                                |
| **Offline but can still perform actions**             | The app may not have real offline support. Check if actions are actually syncing. If they sync instantly, something is wrong—report it. |
| **Action stuck in "Pending" after reconnecting**      | Wait 10 seconds, then restart the app. Retry may be failing silently. Check with the developer.                                         |
| **Reconnected but data is stale**                     | Manually refresh the screen (pull-to-refresh on mobile, F5 on web). If data is still stale, report it.                                  |
| **App crashed during network toggle**                 | Take a screenshot of the crash or error. This is a bug—report it.                                                                       |
| **Cannot disable network for testing**                | Ask the developer for alternative testing methods (e.g., throttling in DevTools, blocking the backend API).                             |

---

## Success Criteria ✅

- ✅ App detects network loss within a few seconds
- ✅ Clear error message displayed when offline
- ✅ App remains responsive and doesn't crash
- ✅ Write actions (create/edit/delete) are blocked or queued offline
- ✅ App automatically recovers when network returns
- ✅ Pending actions sync automatically after reconnection
- ✅ Cached data is visible while offline
- ✅ No data corruption or loss during network flakiness
- ✅ Stale data is refreshed after reconnecting
