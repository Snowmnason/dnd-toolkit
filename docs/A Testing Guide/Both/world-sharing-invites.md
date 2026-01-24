# World Sharing & Invites — Test Guide

## Overview

- **Purpose:** Verify that users can invite others to their worlds, accept invitations, and share worlds correctly
- **What we're testing:** Sending invites, accepting invites, shared world access, permissions for shared worlds, rejecting/revoking invites

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:**
  - Account A (world owner—will send invite)
  - Account B (new member—will receive invite)
  - Account C (optional, for additional invite scenarios)
- **Test data:**
  - World X: created by Account A (owner)
  - Email for Account B: needed to send invite
- **Setup:** Accounts should be able to receive/send emails or see invites in the app (depending on implementation)

## How World Sharing Works

Owners of a world can invite other users by their email address. The invited user receives an invitation (via email or in-app notification) and can accept or decline. Once accepted, they join the world and can access its data (with permissions set by the owner). If the owner revokes access, the shared user loses access.

Why this matters: Collaboration is core to the app—if invites break, users can't play together.

## Test Cases

### ✓ Test 1: Send an Invite to Another User

**Scenario:** World owner sends an invite to another email address

**Steps:**

1. Sign in as Account A (world owner)
2. Open World X (the world to share)
3. Find the "Invite" or "Share" option (likely in settings, menu, or a "Members" screen)
4. Enter the email address for Account B
5. Send the invite
6. (Optional: wait a few seconds for email/notification to arrive)

**Expected Outcome:**

- ✅ Invite send succeeds (no error, confirmation message appears)
- ✅ Invite shows up in the app's invite list or pending members list
- ✅ Account B receives an invitation (email or in-app notification depending on implementation)
- ✅ Invite shows the world name and Account A's name as the inviter

**How to Record a Pass:**

- [ ] Screenshot showing "Invite sent" confirmation
- [ ] Screenshot showing the invite in the pending invites list
- [ ] Note: "Successfully sent invite to [Account B email]"

---

### ✓ Test 2: Accept an Invite

**Scenario:** Invited user receives and accepts an invitation

**Steps:**

1. Receive the invite as Account B (email or in-app)
2. Click the invite link or find the "Accept Invite" button in the app
3. If prompted, sign in as Account B
4. Navigate to the world list or the shared world

**Expected Outcome:**

- ✅ Invite is accepted without errors
- ✅ Account B now appears in the world's member list
- ✅ Account B can see and access World X
- ✅ World X appears in Account B's world list on next login
- ✅ Account B can see World X's data (characters, settings, etc.) as appropriate for their role

**How to Record a Pass:**

- [ ] Screenshot showing "Invite accepted" confirmation
- [ ] Screenshot of Account B's world list showing World X
- [ ] Screenshot of Account B viewing World X (e.g., character list)
- [ ] Note: "Successfully accepted invite and accessed shared world"

---

### ✗ Test 3: Decline or Cancel an Invite

**Scenario:** Invited user declines an invitation or owner cancels it before it's accepted

**Steps:**

1. Send an invite from Account A to a new email (or Account C)
2. Before accepting, find a "Decline" or "Cancel" option
3. Decline/cancel the invite
4. Verify the invite is gone

**Expected Outcome:**

- ✅ Invite is cancelled or rejected
- ✅ Invite no longer appears in the invites list
- ✅ If declined by the invited user, the invite disappears from Account C's inbox
- ✅ If cancelled by the owner, the invite disappears from the pending list
- ✅ No error messages

**How to Record a Pass:**

- [ ] Screenshot showing "Invite declined" or "Invite cancelled" message
- [ ] Screenshot showing the invites list is now empty (or no longer shows that invite)
- [ ] Note: "Successfully declined/cancelled invite"

---

### ✓ Test 4: Revoke Access for a Shared Member

**Scenario:** World owner removes a user from the shared world

**Steps:**

1. Sign in as Account A (world owner)
2. Open World X
3. Find the members list or permissions screen
4. Find Account B in the member list
5. Click "Remove" or "Revoke Access" (exact wording varies)
6. Confirm removal
7. Sign in as Account B and try to access World X

**Expected Outcome:**

- ✅ Account B is removed from the members list
- ✅ Account A sees a confirmation (e.g., "Member removed")
- ✅ When Account B tries to access World X, they get a "You don't have access" error or World X disappears from their world list
- ✅ Account B can still see other worlds they have access to (removal doesn't affect other worlds)

**How to Record a Pass:**

- [ ] Screenshot of Account B removed from members list
- [ ] Screenshot of Account B getting access denied when trying to view World X
- [ ] Note: "Successfully revoked member access"

---

### ⚡ Test 5: Invite the Same Email Twice (Edge Case)

**Scenario:** Owner tries to send two invites to the same email (or invites someone who is already a member)

**Steps:**

1. Sign in as Account A
2. Send an invite to Account B
3. Try to send another invite to Account B (same email)

**Expected Outcome:**

- ✅ The app either:
  - Prevents the duplicate invite (error: "Already invited") OR
  - Shows that Account B is already a member and skips the invite
- ✅ No silent failure or duplicate invites
- ✅ Clear message explaining why the action didn't proceed

**How to Record a Pass:**

- [ ] Screenshot of error message or prevention (e.g., "User already invited")
- [ ] Note: "Duplicate invite properly handled"

---

### ⚡ Test 6: Verify Permissions for Shared Members

**Scenario:** Shared members have appropriate permissions (e.g., can view but not delete world, or specific role limits)

**Steps:**

1. Account A (owner) shares World X with Account B
2. Account B accepts and joins World X
3. As Account B, try to:
   - View characters, settings (should work)
   - Edit world settings (may or may not work, depending on role)
   - Delete the world (should NOT work—only owners can delete)
   - Invite other users (may or may not work, depending on role)
4. Document what Account B can and cannot do

**Expected Outcome:**

- ✅ Account B can view World X's data
- ✅ Account B cannot delete World X (only the owner can)
- ✅ Permissions are enforced consistently
- ✅ If Account B tries to perform a restricted action, they get a clear error message (e.g., "Only the world owner can delete the world")

**How to Record a Pass:**

- [ ] Screenshot showing Account B accessing World X data (success)
- [ ] Screenshot showing Account B blocked from deleting the world (error)
- [ ] Note: "Permissions enforced correctly for shared member [Account B]"

---

### ⚡ Test 7: Platform Consistency for Invites

**Scenario:** Invites work the same on web and app

**Steps:**

1. On **Web**: Account A sends an invite to Account B
2. Account B accepts on **App**
3. Account B can access World X on both **Web** and **App**
4. On **App**: Account A revokes access
5. Account B cannot access World X on either platform

**Expected Outcome:**

- ✅ Invites sent on web work on app (and vice versa)
- ✅ Revoked access takes effect on both platforms
- ✅ Shared member can access the world on all platforms

**How to Record a Pass:**

- [ ] Screenshot of invite sent on web
- [ ] Screenshot of invite accepted on app
- [ ] Screenshot of World X accessible on web after acceptance
- [ ] Note: "Invites consistent across platforms"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Invite notification may appear as an in-app alert or badge
- Members list may be in a dedicated "Members" screen or within world settings
- Email invites may open the app directly when clicked

### Web

- Invites may be shown in a dashboard or notification area
- Can copy invite links to share manually if email delivery is not used
- Members list visible in world settings or a dedicated page

---

## Troubleshooting

| Issue                                                   | Solution                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Invite never arrives for Account B**                  | Check email spam folder, or verify the app has notification settings enabled. Ask the developer if email invites are enabled in staging. |
| **Accept invite but World X doesn't appear in my list** | Try logging out and back in; the world list may need to refresh. If it still doesn't appear, that's a bug.                               |
| **Tried to revoke access but user still has it**        | Refresh the world or restart the app. If the user still has access, that's a bug.                                                        |
| **Can't find the invite/members menu**                  | It may be under Settings, Members, World Settings, or a share icon (⬆️ or 👥). Ask the developer where to find it.                       |
| **Invited user is not the intended recipient**          | Double-check the email address you entered. Resend to the correct address.                                                               |

---

## Success Criteria ✅

- ✅ World owner can send invites to other users
- ✅ Invited users receive notifications and can accept
- ✅ Accepted invites add the user to the world and appear in their world list
- ✅ Owners can revoke member access
- ✅ Revoked members lose access to the world immediately
- ✅ Duplicate invites are handled gracefully
- ✅ Shared members have appropriate permissions (can view, cannot delete)
- ✅ Invites work consistently across web and app platforms
