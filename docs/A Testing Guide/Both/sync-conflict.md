# Sync Conflict Resolution — Test Guide

## Overview

- **Purpose:** Verify that the app handles conflicts gracefully when the same data is modified offline and online simultaneously
- **What we're testing:** Conflict detection, resolution strategy, data preservation, user notification, re-sync after conflict

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:** Two accounts in the same world
- **Test data:**
  - Shared world with both Account A and Account B
  - A character, item, or other editable entity that both can access
- **Setup:** Need to be able to test offline-first scenario

## How Sync Conflicts Work

A sync conflict occurs when:

1. User A and User B access the same data
2. User A goes offline and edits the data
3. Meanwhile, User B edits the same data online
4. User A reconnects and tries to sync

The app must decide:

- **Option 1:** Server version wins (User A's offline edits are discarded)
- **Option 2:** Local version wins (User B's online edits are overwritten)
- **Option 3:** User is prompted to choose or merge
- **Option 4:** Changes are combined (field-level merging)
- **Option 5:** Conflict is logged but app picks a strategy (most common)

Why this matters: If conflicts aren't handled, users lose data or see inconsistent state.

## Test Cases

### ✓ Test 1: Detect Conflicting Changes

**Scenario:** Account A makes an offline edit; Account B makes an online edit to the same entity; changes conflict

**Steps:**

1. Account A and Account B both open the same character (e.g., "Barbarian")
2. Account A: Go offline (airplane mode)
3. Account A: Edit character (e.g., change name to "Barbarian Prime")
4. Account A: Save the edit
5. Account B: Edit the same character (e.g., change name to "Barbarian Supreme")
6. Account B: Save the edit
7. Account A: Reconnect to network
8. Wait 2-3 seconds for Account A to sync

**Expected Outcome:**

- ✅ App detects the conflicting changes
- ✅ One of these happens:
  - Conflict notification appears to Account A
  - Server version automatically wins (A's changes discarded)
  - Local version automatically wins (B's changes overwritten)
  - User is prompted to choose
- ✅ No crash or error (app handles gracefully)
- ✅ Data is consistent (not corrupted or partial)

**How to Record a Pass:**

- [ ] Screenshot showing the conflict state or resolution
- [ ] Note: "Conflict detected and handled: [notification or auto-resolution]"

---

### ✓ Test 2: Conflict Resolution Strategy

**Scenario:** Verify what happens when a conflict is detected

**Steps:**

1. Set up a conflict (from Test 1)
2. Wait for the app to handle it
3. Check both Account A and Account B's views
4. Document the result

**Expected Outcome:**

- ✅ One of these occurs:
  - **Server Wins:** Account A sees "Barbarian Supreme" (B's version), not "Barbarian Prime"
  - **Local Wins:** Account B sees "Barbarian Prime" (A's version), not "Barbarian Supreme"
  - **Prompt:** Account A is asked to pick (Select A's or B's version)
  - **Merged:** Some fields from A, some from B
- ✅ App applies the strategy consistently
- ✅ Both users eventually see the same data

**How to Record a Pass:**

- [ ] Screenshot of Account A's view after conflict resolution
- [ ] Screenshot of Account B's view after conflict resolution
- [ ] Note: "Conflict resolved using [strategy]: final name is [result]"

---

### ⚡ Test 3: Multi-Field Conflict

**Scenario:** Account A and B edit different fields of the same entity (less likely to conflict)

**Steps:**

1. Account A: Go offline
2. Account A: Edit character name to "Barbarian Prime"
3. Account A: Save
4. Account B: Edit character health to 50 (while A is offline)
5. Account B: Save
6. Account A: Reconnect and sync

**Expected Outcome:**

- ✅ App merges the changes (name = "Barbarian Prime", health = 50)
- ✅ Or app picks one strategy (server or local wins completely)
- ✅ No data loss from either user

**How to Record a Pass:**

- [ ] Screenshot showing final character state with both changes (if merged)
- [ ] Or screenshot showing the winning version (if one strategy)
- [ ] Note: "Multi-field edit handled: name and health both present or appropriately resolved"

---

### ⚡ Test 4: Conflict with Deleted Entity

**Scenario:** Account A deletes an entity offline; Account B edits it online; they conflict

**Steps:**

1. Account A: Go offline
2. Account A: Delete a character
3. Account A: Save
4. Account B: Edit the same character (add health, change name, etc.)
5. Account B: Save
6. Account A: Reconnect

**Expected Outcome:**

- ✅ App handles the delete/edit conflict:
  - **Option 1:** Deletion wins → Character is gone for both
  - **Option 2:** Edit wins → Character is restored with B's edits
  - **Option 3:** User is prompted
- ✅ No error or crash
- ✅ Character list is consistent (either present or deleted, not both)

**How to Record a Pass:**

- [ ] Screenshot showing the character list after resolution
- [ ] Note: "Delete/edit conflict resolved: character [present/deleted]"

---

### ⚡ Test 5: Multiple Users Editing (3+ Accounts)

**Scenario:** 3+ users edit the same entity; verify conflict handling scales

**Steps:**

1. Account A goes offline, edits character
2. Account B edits the character
3. Account C edits the character
4. Account A reconnects
5. Document what each account sees

**Expected Outcome:**

- ✅ App applies the same strategy (server/local wins, merge, etc.)
- ✅ No cascading conflicts or errors
- ✅ All users eventually see consistent data
- ✅ No data loss or corruption

**How to Record a Pass:**

- [ ] Screenshot showing each account's final view
- [ ] Note: "3-user conflict handled gracefully; all users see consistent data"

---

### ⚡ Test 6: Conflict Notification / User Action Required

**Scenario:** If the app prompts users during conflict, verify the UX is clear

**Steps:**

1. Set up a conflict (from Test 1)
2. If a notification or prompt appears, read it
3. If prompted, try the conflict resolution UI

**Expected Outcome:**

- ✅ If a prompt appears:
  - Message clearly explains the conflict ("Someone else edited this")
  - Both versions are shown (or option to view)
  - User can choose or auto-resolve is explained
  - Cancel or Resolve button
- ✅ If no prompt, app silently resolves and user is not confused

**How to Record a Pass:**

- [ ] Screenshot of any prompt or notification
- [ ] Note: "Conflict UI [present / not present]; if present, is clear and actionable"

---

### ⚡ Test 7: Conflict Recovery is Correct

**Scenario:** After conflict resolution, verify no data is corrupted or lost

**Steps:**

1. Set up a conflict
2. Allow it to resolve
3. Check the entity for:
   - Corrupted fields (e.g., half the old value + half the new value)
   - Missing data (e.g., blank fields)
   - Timestamps (should be updated)
   - Edit history (should show the final state)

**Expected Outcome:**

- ✅ All fields are valid (no partial/corrupted data)
- ✅ No fields are unexpectedly blank
- ✅ Timestamp is current (not stale)
- ✅ Data is consistent with the resolved strategy

**How to Record a Pass:**

- [ ] Screenshot of the final entity showing all fields are valid
- [ ] Note: "No corruption or data loss after conflict resolution"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Offline scenario is easier to test (airplane mode)
- Conflict notifications should appear as in-app messages
- No browser console access for debugging

### Web

- Can use DevTools Network tab to simulate offline
- Conflict notifications may appear as toasts or modals
- Can inspect network requests to verify sync behavior

---

## Troubleshooting

| Issue                                            | Solution                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Hard to set up a conflict**                    | Try synchronizing edits very quickly (seconds apart). Timing matters.                    |
| **Cannot tell which version "won"**              | Compare the final state to what each account edited. Document which change is present.   |
| **Conflict happens but app crashes**             | Take a screenshot of the error. This is a critical bug—report it.                        |
| **Both versions appear (partial merge failure)** | Document what you see (e.g., "name = mix of both values"). This is corruption—report it. |
| **Offline-first scenario is flaky**              | Use airplane mode or disable network via DevTools for more reliable testing.             |
| **Can't reproduce conflict reliably**            | Ask the developer for a conflict reproduction script or guide.                           |

---

## Success Criteria ✅

- ✅ App detects conflicting offline and online changes
- ✅ Conflict is resolved using a consistent strategy (server-wins, local-wins, merge, or prompt)
- ✅ No crash or error during conflict resolution
- ✅ No data corruption or loss (all data remains valid)
- ✅ All users see consistent final state
- ✅ Multi-field edits are handled appropriately
- ✅ Delete/edit conflicts are handled gracefully
- ✅ Conflict notifications (if shown) are clear and actionable
- ✅ Recovered data is uncorrupted and complete
