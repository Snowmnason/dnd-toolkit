# World Deleting & Editing — Test Guide

## Overview

- **Purpose:** Verify that world owners can edit and delete worlds; members cannot perform these actions; deletions are permanent and affect all members
- **What we're testing:** Editing world settings, deleting worlds, permission checks (only owner can delete), member notifications after deletion, data removal after deletion

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:**
  - Account A (world owner)
  - Account B (world member—optional but recommended)
- **Test data:**
  - World X (owned by Account A, ideally with some members)
  - World Y (separate world for testing deletion—will be deleted, so don't use a production world)
- **Note:** Use a test world for deletion tests; this cannot be undone

## How World Editing & Deletion Works

World owners can edit world settings (name, description, rules, etc.). Owners can also delete the entire world, which:

1. Removes all world data permanently
2. Kicks all members out of the world
3. Prevents access for all members (including the owner)
4. Should notify members (ideally)

Members cannot edit or delete the world (should be blocked).

Why this matters: Accidental deletion could wipe out an entire campaign. This needs solid protection.

## Test Cases

### ✓ Test 1: Owner Can Edit World Settings

**Scenario:** World owner opens world settings and edits the world name or description

**Steps:**

1. Sign in as Account A (world owner)
2. Open World X
3. Find **Settings** or **World Settings** (often in a menu, gear icon, or dedicated screen)
4. Edit the world name (e.g., change from "Campaign 1" to "Campaign 1 - Updated")
5. Edit the description or other settings (if available)
6. Click **Save** or **Update**

**Expected Outcome:**

- ✅ Settings screen opens without errors
- ✅ Owner can edit name, description, and other properties
- ✅ Changes save successfully
- ✅ Confirmation appears (e.g., "World updated")
- ✅ New name/settings appear immediately

**How to Record a Pass:**

- [ ] Screenshot showing the settings form
- [ ] Screenshot showing the saved changes
- [ ] Note: "Successfully edited world name/settings"

---

### ✓ Test 2: Edited World Settings Visible to Members

**Scenario:** Owner edits world settings; members see the updated information

**Steps:**

1. Account A: Edit World X's name to "NewName"
2. Account B (member of World X): Refresh or reload the world list
3. Account B should see the updated world name

**Expected Outcome:**

- ✅ Account B sees the new world name
- ✅ Changes sync within 1-2 seconds
- ✅ No manual refresh required (ideally)
- ✅ All members see the same updated name

**How to Record a Pass:**

- [ ] Screenshot of Account B's world list showing the updated name
- [ ] Note: "World name change visible to members"

---

### ✓ Test 3: Owner Can Delete World

**Scenario:** World owner finds the delete option and deletes a world

**Steps:**

1. Sign in as Account A (world owner)
2. Open World Y (test world—don't use important worlds)
3. Find the **Delete World** or **Remove World** option (likely in settings or a menu)
4. Click the delete option
5. A confirmation prompt should appear (e.g., "Are you sure? This cannot be undone.")
6. Confirm the deletion
7. Wait for confirmation (may show "World deleted" message)

**Expected Outcome:**

- ✅ Delete option is available to the owner
- ✅ Confirmation prompt appears (prevents accidental deletion)
- ✅ Deletion succeeds without errors
- ✅ Confirmation message appears
- ✅ Account A is redirected to the world list or dashboard
- ✅ World Y is no longer in the list

**How to Record a Pass:**

- [ ] Screenshot showing the delete confirmation prompt
- [ ] Screenshot showing "World deleted" confirmation
- [ ] Screenshot showing world list without World Y
- [ ] Note: "Successfully deleted world [World Y]"

---

### ✗ Test 4: Member Cannot Delete World

**Scenario:** Non-owner member tries to access the delete option; it should be blocked

**Steps:**

1. Sign in as Account B (world member, not owner)
2. Open World X (shared world)
3. Navigate to **Settings** or look for a **Delete** option
4. Try to find the delete world option

**Expected Outcome:**

- ✅ Account B does NOT see a "Delete World" option
- ✅ If Account B somehow accesses the delete endpoint (advanced users), it's blocked with an error (e.g., "Only the owner can delete this world")
- ✅ No world is deleted by mistake

**How to Record a Pass:**

- [ ] Screenshot showing Account B's settings (no delete option visible)
- [ ] Note: "Delete option not available to non-owner members"

---

### ✗ Test 5: Member Cannot Edit World Settings (if applicable)

**Scenario:** Non-owner member tries to edit world settings; changes are blocked or not persisted

**Steps:**

1. Sign in as Account B (world member)
2. Open World X
3. Try to access **Settings**
4. If you can access settings, try to edit the name or description
5. Try to save the changes

**Expected Outcome:**

- ✅ Either:
  - Settings are read-only for members (they can view but not edit)
  - Edit attempts are blocked with "Only the owner can edit world settings"
  - Changes are accepted but not persisted to the server (silent rejection)
- ✅ World settings are NOT changed by the member

**How to Record a Pass:**

- [ ] Screenshot showing settings are read-only or blocked
- [ ] Note: "Edit access restricted to owner; members cannot modify settings"

---

### ✓ Test 6: Deleted World Removed from All Members' Lists

**Scenario:** After owner deletes a world, all members lose access and it disappears from their world list

**Steps:**

1. Account A and Account B are both members of World Z
2. Account A: Delete World Z
3. Account B: Check their world list (may need to refresh/reload)
4. Account B should no longer see World Z

**Expected Outcome:**

- ✅ World Z disappears from Account B's world list
- ✅ Account B cannot access World Z (if they try to navigate to it directly, they get "World not found")
- ✅ Removal is visible to all members within a few seconds

**How to Record a Pass:**

- [ ] Screenshot showing World Z in Account B's list (before deletion)
- [ ] Screenshot showing World Z gone from Account B's list (after deletion)
- [ ] Note: "Deleted world removed from all members' access"

---

### ⚡ Test 7: Accidental Deletion Protection

**Scenario:** Verify there are safeguards against accidental deletion

**Steps:**

1. Open World Y (test world)
2. Find the delete option
3. Observe the confirmation flow

**Expected Outcome:**

- ✅ Delete option is clearly marked as dangerous (e.g., "Delete World" in red, or with ⚠️ icon)
- ✅ Confirmation prompt is prominent and includes:
  - Warning text (e.g., "This action cannot be undone")
  - Cancel button (easy to click if you change your mind)
  - Confirm button (usually red or different color to indicate danger)
- ✅ No one-click deletion (at minimum, two steps: click delete + confirm)

**How to Record a Pass:**

- [ ] Screenshot showing the confirmation prompt with warning text
- [ ] Note: "Deletion has appropriate safeguards"

---

### ⚡ Test 8: World Editing & Deletion Across Platforms

**Scenario:** Test editing and deletion work the same on web and app

**Steps:**

1. On **Web**: Account A edits World X → Account B refreshes and sees the change
2. On **App**: Account A edits World X → Account B refreshes and sees the change
3. Create a test World Z
4. On **Web**: Delete World Z
5. On **App**: Verify World Z is gone

**Expected Outcome:**

- ✅ Edits work consistently on both platforms
- ✅ Deletions work on both platforms
- ✅ Changes/deletions sync across platforms
- ✅ No platform-specific differences in behavior

**How to Record a Pass:**

- [ ] Screenshot from web showing edit/deletion
- [ ] Screenshot from app showing the change was synced
- [ ] Note: "World editing and deletion consistent across platforms"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Delete option likely in a menu (☰) or settings screen
- Confirmation prompt should be a modal dialog (not browser-based)
- After deletion, app should return to world list

### Web

- Delete option likely in a settings page or dropdown menu
- Confirmation prompt may be a modal or browser confirm dialog
- After deletion, redirect to dashboard or world list

---

## Troubleshooting

| Issue                                                | Solution                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Can't find settings or delete option**             | Look in the world menu (☰), in a gear icon, or under "Settings". If not found, ask the developer where it is. |
| **Delete button is grayed out**                      | You may not be the world owner. Only owners can delete. Try with the owner account.                            |
| **Clicked delete but nothing happens**               | Wait 3-5 seconds (deletion may be processing). If nothing happens, refresh the page/app.                       |
| **Deleted world but it still appears in the list**   | Refresh the page/app. If it's still there, that's a bug—report it.                                             |
| **Member can see the delete option**                 | That's a bug—they shouldn't have access. Report it.                                                            |
| **Edited world settings but changes didn't save**    | Try again. If it fails repeatedly, that's a bug—report it.                                                     |
| **Deletion worked but members still have the world** | It may take a few seconds for all members' lists to update. Wait 5-10 seconds and refresh.                     |

---

## Success Criteria ✅

- ✅ Owner can edit world settings (name, description, etc.)
- ✅ Edited settings appear in real-time to all members
- ✅ Owner can delete a world with a confirmation prompt
- ✅ Deleted world is removed from all members' access lists
- ✅ Non-owner members cannot delete or edit world settings
- ✅ Deletion has safeguards (confirmation, warning text)
- ✅ Editing and deletion work consistently across web and app
- ✅ No accidental deletions due to UI confusion
