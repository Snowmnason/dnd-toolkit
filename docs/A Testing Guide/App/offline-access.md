# Offline Access & Data Persistence — Test Guide (App: Desktop & Mobile)

## Overview

- **Purpose:** Verify that the app allows basic access when network is unavailable and data persists locally
- **What we're testing:** Offline navigation, cached data access, sync behavior, data loss prevention

## Environments

- Desktop (Electron app)
- Mobile (iOS/Android via Expo)

## Prerequisites

- **App installed** on test device or emulator
- **Test account** previously signed in on the device
- **Ability to disable network** (Wi-Fi toggle or airplane mode)
- **Test world data** should exist in the app (created during online usage)

## How Offline Mode Works

The app is designed to allow **read-only access** to cached data while offline. This means:

- ✅ You CAN view previously loaded screens and data
- ✅ You CAN navigate between cached screens
- ❌ You CANNOT create new content (worlds, characters, etc.)
- ❌ You CANNOT edit existing content
- ❌ Changes will NOT sync when you go back online

---

## Test Cases

### ✓ Test 1: View Cached Screens While Offline

**Scenario:** After loading screens online, you can view them while offline

**Steps:**

1. Sign in to the app (while online)
2. Navigate to Main screen, world details, character list, etc. (load screens)
3. Wait 5 seconds (data loads into cache)
4. Turn OFF network (airplane mode or disable Wi-Fi/cellular)
5. Wait 3 seconds
6. Try to navigate to the screens you just visited

**Expected Outcome:**

- ✅ Previously viewed screens load from cache
- ✅ You can navigate between cached screens
- ✅ Data displays correctly (characters, worlds, etc.)
- ✅ No error message about needing network

**How to Record a Pass:**

- [ ] Screenshot of cached screen while offline
- [ ] Note: "Data displayed correctly from cache"

**How to Record a Fail:**

- [ ] Screenshot if error appears or blank screen
- [ ] Note: "Error: [message] or screen is blank"

---

### ✗ Test 2: Reject Offline Write Actions

**Scenario:** The app prevents you from creating or editing content while offline

**Steps:**

1. Turn OFF network (airplane mode)
2. Try to create a new world (if button available)
3. Try to create a character (if button available)
4. Try to edit existing data (change a name, etc.)
5. Observe what happens

**Expected Outcome:**

- ✅ Create/Edit buttons are disabled OR
- ✅ A clear offline message appears saying "You're offline" or similar
- ✅ Action is prevented (nothing gets created or changed)
- ✅ No silent failures or data corruption

**How to Record a Pass:**

- [ ] Screenshot of disabled button or offline message
- [ ] Note: "Write actions properly blocked while offline"

**How to Record a Fail:**

- [ ] Screenshot if action was attempted anyway
- [ ] Note: "Action allowed offline when it shouldn't be"

---

### ✓ Test 3: Data Persists After App Restart (Offline)

**Scenario:** Cached data survives app closure and reopening while offline

**Steps:**

1. Sign in and load screens (while online)
2. Turn OFF network
3. View a screen with data (e.g., character list)
4. Take a screenshot of the data
5. Completely close the app
6. Reopen the app (still offline)
7. Navigate back to the same screen
8. Compare the data with your screenshot

**Expected Outcome:**

- ✅ Same data appears in the same screen
- ✅ No data loss between app close/open
- ✅ App allows navigation in offline mode again

**How to Record a Pass:**

- [ ] Before screenshot (online, with data loaded)
- [ ] After screenshot (offline, after app restart)
- [ ] Note: "Data persisted correctly across restart"

**How to Record a Fail:**

- [ ] Screenshot if data is missing or different
- [ ] Note: "Data lost after restart"

---

### ✓ Test 4: Sync Resumes After Network Restoration

**Scenario:** Once network comes back, the app can sync data again

**Steps:**

1. Work in offline mode (view cached screens)
2. Turn network back ON (disable airplane mode or reconnect Wi-Fi)
3. Wait 5-10 seconds
4. Navigate to a new screen or refresh the current screen
5. Check if new data loads

**Expected Outcome:**

- ✅ App detects network is back within 10 seconds
- ✅ Can navigate to new screens that require network
- ✅ New data loads from server (not just cache)
- ✅ No errors about "still offline"

**How to Record a Pass:**

- [ ] Screenshot of newly loaded screen after network restore
- [ ] Note: "Sync resumed and new data loaded"

**How to Record a Fail:**

- [ ] Screenshot if app still acts offline
- [ ] Note: "App didn't detect network restoration"

---

### ⚠️ Test 5: No Silent Data Loss When Offline

**Scenario:** If changes were attempted offline, the app doesn't silently discard them

**Steps:**

1. Turn OFF network
2. Try to edit something (if possible—e.g., change a character name)
3. If a save button appears, try pressing it
4. Observe the response (error, success message, etc.)
5. Turn network back ON

**Expected Outcome:**

- ✅ Edit is rejected with a clear message
- ✅ OR edit is queued (but UI clearly shows it's pending)
- ✅ No silent "changes lost" scenario
- ✅ Once online, user can retry or sync queued changes

**How to Record a Pass:**

- [ ] Screenshot of the error/pending message
- [ ] Note: "Clear indication of offline state"

**How to Record a Fail:**

- [ ] Screenshot if change disappeared silently
- [ ] Note: "Change was silently discarded"

---

## Network Toggle Cheat Sheet

| Device        | How to Toggle Network                      |
| ------------- | ------------------------------------------ |
| iPhone        | Settings > Airplane Mode (toggle on)       |
| Android       | Pull-down menu > Airplane Mode (toggle on) |
| Mac           | Wi-Fi menu > toggle off                    |
| Windows/Linux | Network settings > toggle Wi-Fi off        |

**Quick method (all platforms):** Airplane Mode is fastest and most reliable for testing.

---

## Common Scenarios

### "I'm offline and can't access ANY screen"

- This is expected if no screens have been cached yet
- Solution: Go online, navigate to screens to cache them, then go offline again

### "I'm online but still seeing old cached data"

- Pull-down to refresh (if available) or navigate to a new screen
- Close and reopen the app
- If still seeing stale data, report it to the developer

### "The app crashes when I toggle network"

- Close the app completely and reopen it
- Try toggling network more slowly (off, wait 10s, on)
- If crashes persist, report to developer with screenshot

---

## Troubleshooting

| Issue                                                | Solution                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| "Can't figure out how to turn off network"           | Use Airplane Mode—it's the simplest.                                                   |
| "App seems to work perfectly offline—is that right?" | Not necessarily. Make sure you're testing write actions, not just viewing cached data. |
| "How long does it take to detect network is back?"   | Usually 5-10 seconds. If longer than 30s, it might be a bug.                           |

---

## Success Criteria ✅

All tests pass when:

- ✅ Cached screens display correctly offline
- ✅ Write actions are blocked or clearly show error
- ✅ Data persists across app restarts
- ✅ Network restoration is detected quickly
- ✅ No silent data loss
- ✅ User always knows the app is offline (via messaging)
