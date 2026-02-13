# World Selection — Test Guide

## Overview

- **Purpose:** Verify that users can switch between worlds and the app loads the correct world data
- **What we're testing:** World list display, world switching, world persistence, navigation between worlds

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:** One account with access to 2+ worlds
- **Test data:**
  - World A: belongs to this account
  - World B: belongs to this account, or account has access through sharing
- **Note:** If you only have 1 world, ask the developer to set up a second one, or create one in the app if world creation is available

## How World Selection Works

The world selector is the first choice you make after signing in. It shows all worlds your account can access (ones you created + ones others shared with you). Clicking a world loads that world's data (characters, settings, etc.) and keeps you in that world until you switch.

Why this matters: If world selection breaks, users get stuck viewing the wrong world's data, or can't switch between their games.

## Test Cases

### ✓ Test 1: World List Displays Correctly

**Scenario:** After signing in, you see all worlds you have access to

**Steps:**

1. Sign in with your test account
2. Navigate to the world selection screen (should appear automatically on first login, or find a "Select World" option in settings/menu)
3. Look at the list of worlds displayed

**Expected Outcome:**

- ✅ You see at least 2 worlds listed (if your account has 2+)
- ✅ Each world shows a name, image/icon, or other identifying info
- ✅ The list is not empty (no "no worlds found" error)
- ✅ Worlds you own appear in the list
- ✅ Worlds shared with you appear in the list (if any)

**How to Record a Pass:**

- [ ] Screenshot showing the world list with 2+ worlds visible
- [ ] Note: "World Selection screen displayed correctly with [X] worlds"

---

### ✓ Test 2: Switch to a Different World

**Scenario:** You select a different world and the app loads that world's data

**Steps:**

1. You are on the world selection screen with 2+ worlds visible
2. Select/click World A
3. Wait for the world to load (should see a loading indicator or smooth transition)
4. Navigate to a screen that shows world-specific data (character list, settings, etc.)
5. Note what you see (e.g., "World A has 3 characters")
6. Return to world selection
7. Select/click World B
8. Wait for the world to load
9. Check the same screen again (character list, settings, etc.)

**Expected Outcome:**

- ✅ World A loads without errors
- ✅ You see World A's specific data (characters, settings, etc.)
- ✅ World B loads without errors when you switch
- ✅ World B's data is different from World A (e.g., different character count or names)
- ✅ No loading errors or crashes during the switch

**How to Record a Pass:**

- [ ] Screenshot of World A's data (e.g., character list)
- [ ] Screenshot of World B's data (e.g., character list)
- [ ] Note: "Switched from World A to World B; data loaded correctly"

---

### ✓ Test 3: World Selection Persists After App Restart

**Scenario:** You select a world, close the app, reopen it, and you're still in that world

**Steps:**

1. From the world selection screen, select World A
2. Wait for World A to fully load and navigate to any screen
3. Close the app completely (don't just minimize; fully exit)
4. Reopen the app
5. Wait for it to load

**Expected Outcome:**

- ✅ The app remembers you were in World A
- ✅ The app automatically loads World A on restart (or shows you the world selection with World A still selected)
- ✅ You don't have to re-select World A
- ✅ World A's data is visible (no "world not found" error)

**How to Record a Pass:**

- [ ] Screenshot after app restart showing World A is loaded/selected
- [ ] Note: "World A persisted after app restart"

---

### ✗ Test 4: Switching to an Inaccessible World (if possible)

**Scenario:** You try to access a world you don't have permission for

**Steps:**

1. (If possible) Try to manually navigate to a world you don't own and haven't been invited to—ask the developer how to do this (e.g., modify URL on web, or try to select a world from another account)
2. Observe what happens

**Expected Outcome:**

- ✅ The app prevents you from accessing the world
- ✅ You see an error message like "You don't have access to this world" or "World not found"
- ✅ You are redirected to world selection, not stuck in a broken state
- ✅ No crash or blank screen

**How to Record a Pass:**

- [ ] Screenshot of the error message or redirect
- [ ] Note: "Inaccessible world properly rejected with error"

---

### ⚡ Test 5: Quick Switch Between Worlds

**Scenario:** You rapidly switch between World A and World B to ensure the app handles quick changes

**Steps:**

1. Start in World A (select it from world selection)
2. Wait for it to fully load
3. Return to world selection
4. Switch to World B
5. Wait for it to fully load
6. Return to world selection
7. Switch back to World A
8. Repeat 2-3 times

**Expected Outcome:**

- ✅ Each switch works without lag or crashes
- ✅ Data loads correctly each time (no stale data showing from previous world)
- ✅ Loading indicator or smooth transition appears each time
- ✅ No "stuck loading" or frozen state

**How to Record a Pass:**

- [ ] Screenshot after final switch showing correct world data
- [ ] Note: "Rapid world switching worked smoothly"

---

### ⚡ Test 6: World Selection on Different Platforms

**Scenario:** World selection works the same on web and app

**Steps:**

1. Test on **Web**: Sign in → go to world selection → select World A → verify it loads
2. Test on **App** (Electron/Mobile): Sign in → go to world selection → select World A → verify it loads

**Expected Outcome:**

- ✅ Both platforms show the same worlds
- ✅ Switching works the same on both platforms
- ✅ Data is consistent (World A shows the same info on web and app)

**How to Record a Pass:**

- [ ] Screenshot from web showing world list
- [ ] Screenshot from app showing world list
- [ ] Note: "World selection consistent across web and app"

---

### ⚡ Test 7: Worlds Load Immediately After Login (No Refresh Needed)

**Scenario:** User logs in and worlds are available immediately without requiring a manual refresh

**Purpose:** Verify that worlds are eagerly fetched during login bootstrap (race condition fix)

**Steps:**

1. **Mobile/App**: Close the app completely
   - Or **Web**: Clear browser cache or open in private/incognito tab
2. Open the app or navigate to the website
3. Sign in with your test account (have 2+ worlds)
4. Observe the world selection screen as it loads **DO NOT REFRESH**
5. Note whether worlds appear immediately or if you see a loading spinner

**Expected Outcome:**

- ✅ After sign-in, you are navigated to world selection screen
- ✅ Worlds appear immediately (within 1 second) without a loading spinner
- ✅ All your worlds are visible in the list
- ✅ No "No worlds found" message appears temporarily
- ✅ **Critical**: You can interact with the world list immediately without needing to refresh
- ✅ Selecting a world works immediately without additional loading

**How to Record a Pass:**

- [ ] Screenshot of world selection screen showing worlds loaded immediately after login
- [ ] Note: "Worlds loaded immediately on login without refresh needed"
- [ ] Confirm you were able to select and open a world without any delays

**How to Record a Fail:**

- [ ] Screenshot showing empty world list or "Loading..." after login
- [ ] Note when forcing a refresh resolves the issue
- [ ] Note how long it took before worlds appeared

**Performance Notes:**

- **Ideal**: Worlds appear instantly (<500ms after screen render)
- **Acceptable**: Worlds appear within 1 second
- **Poor**: Requires manual refresh or back-navigation to populate worlds
- **Broken**: Worlds never appear, or appear with errors

---

## Platform-Specific Notes

### App (Electron / Mobile)

- No browser address bar, so you can't manually type a world ID into the URL
- World selection may appear as a dedicated screen or an in-app menu
- Check settings or menu for "Change World" or "World Selection" option

### Web

- You can see the world ID in the URL (e.g., `/worlds/abc123`)
- Can manually navigate to a world URL to test access control
- Can use browser back button to return to world selection

---

## Troubleshooting

| Issue                                              | Solution                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Only see 1 world, but I should see 2+**          | Make sure your test account has access to multiple worlds. Ask the developer to set up a second world or share one with you.            |
| **Switch to World B but still see World A's data** | The world didn't load completely. Wait 5 seconds and refresh/reload. If it persists, that's a bug—report it.                            |
| **Get a "World not found" error**                  | The world may have been deleted, or your account lost access. Ask the developer to verify the world exists and your account has access. |
| **App crashes when switching worlds**              | Take a screenshot of any error message. This is a bug—report it to the developer.                                                       |
| **World selection screen doesn't appear**          | Check your app's main menu or settings for a "Change World" option. It may not be a dedicated screen.                                   |

---

## Success Criteria ✅

- ✅ World list displays all worlds the account has access to
- ✅ Switching worlds loads the correct world's data
- ✅ World selection persists after app restart
- ✅ Inaccessible worlds are blocked with an error message
- ✅ Rapid world switching works without lag or crashes
- ✅ Behavior is consistent across web and app platforms
