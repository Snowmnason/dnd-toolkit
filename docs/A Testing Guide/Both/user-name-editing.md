# User Name Editing — Test Guide

## Overview

- **Purpose:** Verify that users can edit their display name / profile information and changes are saved and reflected everywhere
- **What we're testing:** Editing user name, saving changes, validation (invalid characters, name length), changes reflected across worlds, changes persisted after logout/login

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:** One account with an existing display name
- **Test data:**
  - Current name: something to change from (e.g., "TestUser")
  - New name: something to change to (e.g., "NewName")
- **Optional:** A second account to verify name changes are visible to others

## How User Name Editing Works

Users have a display name (or profile name) that identifies them in the app. They can edit this from their profile/settings screen. The new name should:

1. Be saved to the server
2. Appear everywhere the name is displayed (member lists, world headers, chat, etc.)
3. Be visible to other users in shared worlds
4. Persist after logout/login

Why this matters: If name changes don't sync or get lost, collaboration becomes confusing (who is that?).

## Test Cases

### ✓ Test 1: Edit User Name

**Scenario:** Open settings, change your display name, and save it

**Steps:**

1. Sign in to your account
2. Navigate to **Settings** or **Profile** (often found in a menu or user icon)
3. Find the **Display Name** or **User Name** field
4. Clear the current name
5. Type a new name (e.g., "NewName")
6. Click **Save** or **Update**
7. Wait for confirmation (may be a success message or automatic save)

**Expected Outcome:**

- ✅ No error appears (or if validation error, it clearly states why)
- ✅ Confirmation appears (e.g., "Name updated" toast/message)
- ✅ New name appears in the profile/settings view
- ✅ Changes are visible immediately without refreshing

**How to Record a Pass:**

- [ ] Screenshot showing the old name
- [ ] Screenshot showing the save action (e.g., clicked Save button)
- [ ] Screenshot showing the new name is now displayed
- [ ] Note: "Successfully changed name from 'TestUser' to 'NewName'"

---

### ✓ Test 2: Name Change Persists After Logout/Login

**Scenario:** Change your name, log out, log back in, and verify the name stuck

**Steps:**

1. Edit your name to something new (from Test 1)
2. Verify the new name is saved
3. Sign out of your account
4. Sign back in with the same account
5. Navigate to **Settings** or **Profile**
6. Check your display name

**Expected Outcome:**

- ✅ Your new name is still there (not reverted to old name)
- ✅ No "pending changes" or "unsaved" indicator
- ✅ Name appears in all places (profile, member lists, etc.)

**How to Record a Pass:**

- [ ] Screenshot after sign-in showing the new name persisted
- [ ] Note: "Name change persisted after logout/login"

---

### ✓ Test 3: Name Change Visible to Other Users

**Scenario:** You change your name; another user in a shared world sees the new name

**Steps:**

1. Account A: Change your display name to "NewName"
2. Account B (in the same world): Open the members list or world view
3. Account B should see Account A as "NewName" (not the old name)

**Expected Outcome:**

- ✅ Account B sees the updated name immediately (may take 1-2 seconds to sync)
- ✅ No need for Account B to refresh or restart the app
- ✅ Old name is gone (no "NewName (formerly OldName)" or similar)

**How to Record a Pass:**

- [ ] Screenshot of Account B's view showing the updated name from Account A
- [ ] Note: "Name change visible to other users in shared world"

---

### ✗ Test 4: Name Validation (Invalid Characters or Length)

**Scenario:** Try to set a name with invalid characters or wrong length

**Steps:**

1. Navigate to **Settings** or **Profile**
2. Try to save a name that is:
   - **Too short:** Empty or 1 character (if there's a minimum)
   - **Too long:** 100+ characters (if there's a maximum)
   - **Invalid characters:** Special characters like `<`, `>`, `@`, `/` (if not allowed)
   - **Empty:** Try to save with a blank field
3. Click **Save**

**Expected Outcome:**

- ✅ The app either:
  - Rejects the input with a clear error (e.g., "Name must be 1-50 characters")
  - Silently corrects it (e.g., trims whitespace, removes special characters)
  - Shows a validation message before saving
- ✅ Invalid name is NOT saved
- ✅ User is guided on what's allowed (e.g., "Letters, numbers, spaces only")

**How to Record a Pass:**

- [ ] Screenshot of the attempted invalid name
- [ ] Screenshot of the validation error or rejection
- [ ] Note: "Invalid name rejected with error: [error text]"

---

### ✓ Test 5: Edit Name Multiple Times

**Scenario:** Change your name twice in a row to ensure repeated edits work

**Steps:**

1. Edit name to "Name1"
2. Verify it's saved
3. Edit name to "Name2"
4. Verify it's saved
5. Edit name to "Name3"
6. Verify it's saved

**Expected Outcome:**

- ✅ Each change saves without errors
- ✅ Each new name overwrites the previous one (no duplication or stale data)
- ✅ No lag or delays between edits
- ✅ Final name ("Name3") is persisted

**How to Record a Pass:**

- [ ] Screenshot after each save showing the progression
- [ ] Note: "Successfully edited name 3 times; final name is 'Name3'"

---

### ⚡ Test 6: Name Change Across Platforms

**Scenario:** Change name on one platform, verify it appears on another

**Steps:**

1. On **Web**: Account A changes name to "WebName"
2. On **App**: Account A can see the new name
3. On **App**: Account A changes name to "AppName"
4. On **Web**: Account A can see the new name

**Expected Outcome:**

- ✅ Name changes sync across platforms
- ✅ No delays or stale data between web and app
- ✅ Latest name always appears

**How to Record a Pass:**

- [ ] Screenshot from web showing name change
- [ ] Screenshot from app showing it updated
- [ ] Note: "Name changes sync correctly across web and app"

---

### ⚡ Test 7: Name Change While Offline (if supported)

**Scenario:** If the app supports offline changes, try to edit name while offline

**Steps:**

1. Disable network (airplane mode)
2. Edit your name to something new
3. Try to save
4. Re-enable network

**Expected Outcome:**

- ✅ App either:
  - Queues the name change (shows "Pending" or similar) and syncs when online
  - Blocks the action with "Can't save while offline"
- ✅ No silent failure or data loss
- ✅ Clear feedback on what happened

**How to Record a Pass:**

- [ ] Screenshot showing offline name edit attempt and result
- [ ] Note: "Offline name edit: [queued / blocked]"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Settings may be in a menu (hamburger icon ☰), user profile icon, or dedicated Settings screen
- Name changes may take 1-2 seconds to sync if network is slow

### Web

- Settings usually in a user menu (avatar icon, top right)
- Name changes typically instant due to fast network

---

## Troubleshooting

| Issue                                                    | Solution                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Click Save but nothing happens**                       | Wait 3 seconds (may be saving in background). If still nothing, refresh the page/app.                |
| **Error: "Name is invalid"**                             | Check the character restrictions (letters, numbers, spaces only?). Try a simpler name.               |
| **Name reverts to old name after saving**                | Refresh the page/app. If it reverts again, that's a sync bug—report it.                              |
| **Can't find the name field**                            | It may be under Settings, Profile, Account, or User Info. Check all menu options.                    |
| **Changed name but others don't see it**                 | Wait 2-3 seconds, then ask the other user to refresh. If they still don't see it, that's a sync bug. |
| **Name change works on web but not app (or vice versa)** | Try restarting the app. If it still doesn't sync, that's a platform-specific bug.                    |

---

## Success Criteria ✅

- ✅ User can edit display name from Settings/Profile
- ✅ New name is saved without errors
- ✅ Name persists after logout/login
- ✅ Name change is visible to other users in shared worlds
- ✅ Invalid names are rejected with clear error messages
- ✅ Repeated edits work correctly
- ✅ Name changes sync across web and app platforms
- ✅ Offline name edits are queued or blocked gracefully
