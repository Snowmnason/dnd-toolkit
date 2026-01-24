# Account Deletion — Test Guide

## Overview

- **Purpose:** Verify that users can permanently delete their account; data is removed; and access to all worlds is revoked
- **What we're testing:** Account deletion flow, confirmation safeguards, data removal, shared world access loss, irrevocability of deletion

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:**
  - Account A (test account to delete—do NOT use your main account)
  - Account B (optional, to verify Account A loses access to shared worlds)
- **Test data:**
  - World X (shared with Account A; owned by Account B)
  - World Y (owned by Account A; optionally shared with Account B)
- **Warning:** Account deletion is permanent. Use a dedicated test account for this guide.

## How Account Deletion Works

When a user deletes their account:

1. All personal data is removed from the server
2. The account can no longer sign in
3. Worlds owned by the user may be deleted or transferred (depends on implementation)
4. Shared worlds show the user as "Deleted User" or similar
5. The deletion is permanent—no recovery

Why this matters: Users should be able to remove their data (privacy), but must be protected from accidents. Shared worlds need to handle the deletion gracefully.

## Test Cases

### ✓ Test 1: Find and Access Account Deletion

**Scenario:** User navigates to account settings and finds the delete account option

**Steps:**

1. Sign in as Account A (test account)
2. Navigate to **Settings** → **Account** or **Profile** (depending on app structure)
3. Look for a **Delete Account**, **Close Account**, or **Remove Account** option (often at the bottom of settings, marked as dangerous)
4. Click the option

**Expected Outcome:**

- ✅ Delete option is visible in account settings
- ✅ It's clearly marked as irreversible (e.g., "Delete Account Permanently" with ⚠️ or red color)
- ✅ Clicking it opens a confirmation screen or modal

**How to Record a Pass:**

- [ ] Screenshot showing the delete account option
- [ ] Screenshot showing the option is clearly marked as dangerous
- [ ] Note: "Account deletion option found in Settings → Account"

---

### ✓ Test 2: Account Deletion Requires Confirmation

**Scenario:** User is prompted to confirm before deletion; confirmation requires active consent

**Steps:**

1. Click the **Delete Account** button (from Test 1)
2. A confirmation screen/modal should appear
3. Read the confirmation prompt

**Expected Outcome:**

- ✅ Confirmation prompt is prominent and includes:
  - Clear warning (e.g., "This will permanently delete your account and all data")
  - Statement that deletion is irreversible ("You cannot recover this account")
  - Acknowledge checkbox (e.g., "I understand this is permanent" or "I accept the risks")
  - Cancel button (easy to click to back out)
  - Confirm Delete button (usually red, prominently marked)
- ✅ Single-click deletion is NOT allowed (at minimum, two steps: click delete + confirm)

**How to Record a Pass:**

- [ ] Screenshot showing the full confirmation prompt
- [ ] Screenshot showing the warning text is clear and visible
- [ ] Note: "Deletion requires confirmation with clear warnings"

---

### ✓ Test 3: Cancel Account Deletion Before Confirmation

**Scenario:** User changes their mind and cancels during deletion flow

**Steps:**

1. Go through account deletion flow up to the confirmation prompt (from Test 2)
2. Click **Cancel** or go back
3. Verify the account is NOT deleted

**Expected Outcome:**

- ✅ Cancel button returns to account settings
- ✅ Account is still active (not deleted)
- ✅ No data is lost
- ✅ User can sign out and back in normally

**How to Record a Pass:**

- [ ] Screenshot showing the cancel action
- [ ] Screenshot showing the account is still active after cancelling
- [ ] Note: "Cancelling deletion prevents account removal"

---

### ✓ Test 4: Complete Account Deletion

**Scenario:** User confirms and completes account deletion

**Steps:**

1. Go through the deletion confirmation flow
2. Click the **Confirm Delete** or **Yes, Delete My Account** button
3. Wait for the deletion to process (may show a loading screen)

**Expected Outcome:**

- ✅ Deletion succeeds (confirmation message appears)
- ✅ User is logged out immediately
- ✅ User is redirected to the login screen or a "Account Deleted" screen
- ✅ Confirmation message clarifies the account is gone

**How to Record a Pass:**

- [ ] Screenshot showing "Account Deleted" or confirmation message
- [ ] Screenshot showing the login screen (user logged out)
- [ ] Note: "Account successfully deleted and user logged out"

---

### ✗ Test 5: Deleted Account Cannot Sign In

**Scenario:** After deletion, the account cannot be used to sign in

**Steps:**

1. Account A has been deleted (from Test 4)
2. Try to sign in with Account A's email and password
3. Attempt should fail

**Expected Outcome:**

- ✅ Sign-in fails with an error
- ✅ Error message says something like "Account not found" or "Invalid email or password"
- ✅ No recovery option is offered (account is truly gone)
- ✅ No sensitive error messages that reveal whether the email exists

**How to Record a Pass:**

- [ ] Screenshot showing the sign-in error
- [ ] Note: "Deleted account cannot sign in"

---

### ✓ Test 6: Deleted Account Removed from Shared Worlds

**Scenario:** Other users in shared worlds no longer see the deleted account

**Steps:**

1. Before deletion: Account B is in a world with Account A; they can see each other in the members list
2. Account A deletes their account
3. Account B refreshes their view of the world or the members list
4. Check how Account A is displayed

**Expected Outcome:**

- ✅ Account B can still access the world (world is not deleted)
- ✅ Account A appears in the members list as:
  - "Deleted User" or
  - "[User Left]" or
  - Simply removed from the list
- ✅ No broken data or error messages in the members list
- ✅ Other members' data is unaffected

**How to Record a Pass:**

- [ ] Screenshot showing Account A in the members list before deletion
- [ ] Screenshot showing Account A marked as deleted/removed after deletion
- [ ] Note: "Deleted account properly handled in shared worlds"

---

### ⚡ Test 7: Worlds Owned by Deleted Account

**Scenario:** Verify the app handles worlds owned by the deleted account

**Steps:**

1. Before deletion: Account A owns World Y (possibly shared with Account B)
2. Account A deletes their account
3. Account B tries to access World Y

**Expected Outcome:**

- ✅ App handles this gracefully:
  - Option 1: World Y is deleted (if no members, or implementation deletes owner's worlds)
  - Option 2: World Y is transferred to another member or kept as "Ownerless"
  - Option 3: Remaining members can access but cannot delete/edit (world is frozen)
- ✅ No error or crash when accessing the world
- ✅ Clear message explaining what happened (if world is inaccessible)

**Expected Outcome for Each Scenario:**

If World Y is deleted:

- ✅ World Y no longer appears in Account B's world list
- ✅ No error when accessing the world list

If World Y is transferred:

- ✅ New owner can edit/delete the world
- ✅ Account B receives notification (ideally)

If World Y is frozen:

- ✅ Members can view but not edit settings
- ✅ Clear message (e.g., "Owner deleted; world is read-only")

**How to Record a Pass:**

- [ ] Screenshot showing World Y's status after Account A's deletion
- [ ] Note: "Worlds owned by deleted account handled as: [option above]"

---

### ⚡ Test 8: Account Deletion Across Platforms

**Scenario:** Account deletion works consistently on web and app

**Steps:**

1. Create a second test account (Account C)
2. On **Web**: Complete account deletion flow
3. Try to sign in on **App** with deleted account credentials

**Expected Outcome:**

- ✅ Deletion on web prevents sign-in on app
- ✅ Sign-in fails with "Account not found" or similar
- ✅ Behavior is consistent across platforms

**How to Record a Pass:**

- [ ] Screenshot of deletion on web
- [ ] Screenshot of failed sign-in on app
- [ ] Note: "Account deletion synced across platforms"

---

### ✗ Test 9: Accidental Deletion Not Reversible

**Scenario:** Confirm that account deletion cannot be undone by any method

**Steps:**

1. Account A is deleted (from Test 4)
2. Try to recover:
   - Ask developer if there's a recovery/undelete API (there shouldn't be)
   - Check if there's a "Restore Account" option (there shouldn't be)
   - Verify no backup or recovery process exists in the app

**Expected Outcome:**

- ✅ No recovery option exists
- ✅ No "Restore Account" button or link
- ✅ Developer confirms deletion is permanent (no backend recovery without manual intervention)
- ✅ This protects users from accidents but means deletions must be taken seriously

**How to Record a Pass:**

- [ ] Confirmation that no recovery mechanism exists
- [ ] Note: "Account deletion is permanent; no recovery option"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Delete account option likely in Settings or Profile
- Deletion may trigger app logout and return to login screen
- Warning: On mobile, account deletion should not require console access or developer tools

### Web

- Delete account usually in Account Settings or Profile
- Deletion may show a confirmation modal before final action
- Browser may offer to save/remember the account (ignore this after deletion)

---

## Troubleshooting

| Issue                                              | Solution                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Can't find the delete account option**           | It may be under Settings → Account, Privacy, or at the bottom of Settings. Check all menu options.      |
| **Confirmation prompt doesn't appear**             | Try again. If the prompt never appears, that's a bug—report it.                                         |
| **Clicked delete but nothing happens**             | Wait 5-10 seconds (deletion may be processing). If still nothing, refresh and try again.                |
| **Deleted account but can still sign in**          | That's a critical bug—report it immediately. The account should be gone.                                |
| **Deleted account still appears in shared worlds** | Other members' worlds may take 10+ seconds to update. Wait and refresh. If still visible, that's a bug. |
| **Don't have a second test account to delete**     | Ask the developer to create one, or use an account you no longer need.                                  |

---

## Success Criteria ✅

- ✅ Account deletion option is clearly accessible in settings
- ✅ Deletion requires confirmation with prominent warning
- ✅ Users can cancel deletion before it completes
- ✅ Deleted account cannot sign in
- ✅ Deleted account is removed from shared worlds gracefully
- ✅ Worlds owned by deleted account are handled appropriately
- ✅ Deletion is permanent (no recovery option)
- ✅ Behavior is consistent across web and app platforms
- ✅ No broken data or errors in shared worlds after deletion
