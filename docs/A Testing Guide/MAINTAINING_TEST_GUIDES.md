# Maintaining & Creating Test Guides

This document helps developers write clear, non-technical test guides for QA testers.

## When to Create or Update a Guide

Create a **new test guide** when you:

- Add a public feature or hook that users interact with (navigation, auth, worlds, characters, etc.)
- Add a new `lib/` API surface that affects user-visible behavior
- Change URLs, permissions, or feature availability
- Implement error handling that QA should verify

Update an **existing guide** when you:

- Change how a feature works or what it displays
- Add new validation rules or error messages
- Modify authentication or permission requirements
- Add/remove premium feature gates

---

## Where to Put Guides

Place guides in one of these folders:

| Folder  | Purpose                                   | Examples                                                        |
| ------- | ----------------------------------------- | --------------------------------------------------------------- |
| `App/`  | Desktop (Electron) & Mobile (iOS/Android) | Sign-in, offline access, app-specific behavior                  |
| `Web/`  | Web browser only                          | Browser navigation, URL bookmarking, console access             |
| `Both/` | Any platform                              | Premium features, analytics, feature flags that work everywhere |

**Naming:** Use simple, descriptive names: `auth-signin.md`, `offline-access.md`, `premiumfeatures-featureflags.md`

---

## Guide Structure (Required)

Every guide MUST follow this structure. See `TEMPLATE.md` for a complete template:

```markdown
# <Feature Name> — Test Guide

## Overview

- **Purpose:** [One sentence describing what users will test]
- **What we're testing:** [List of behaviors/components]

## Environments

- App (Desktop / Mobile / Both)
- Web
- List all applicable platforms

## Prerequisites

- **Test accounts:** [What accounts are needed]
- **Test data:** [Any setup required]

## How [Feature] Works

Brief, non-technical explanation for QA

## Test Cases

### ✓ Test 1: [Positive Scenario]

**Scenario:** [User's goal]
**Steps:**

1. [Clear action steps]
   **Expected Outcome:**

- ✅ [What should happen]
  **How to Record a Pass:**
- [ ] Screenshot
- [ ] Note: "[Brief description]"

### ✗ Test 2: [Negative Scenario]

...

## Platform-Specific Notes

[Any platform differences]

## Troubleshooting

| Issue | Solution |
...

## Success Criteria ✅

- ✅ [Criterion 1]
```

---

## Writing Tips for Developers

### 1. Write for QA, Not Developers

❌ **Bad:** "Verify that `useAuthGuard()` hook correctly validates `world_access_*` flags from `SecureStorage`."

✅ **Good:** "Verify that after signing in, you can access the world you own. Try signing in with different accounts to see who can access which worlds."

### 2. Use Simple Language

❌ **Bad:** "Ensure the fetch operation completes before calling `handleConflictResolution()`."

✅ **Good:** "Wait for the data to load (you'll see a loading indicator). Once it appears, verify it's correct."

### 3. Tell QA What to Look For

❌ **Bad:** "Test error handling."

✅ **Good:** "Try to create a world with an empty name. You should see a red error message saying 'World name is required.' Verify you can't submit the form until you enter a name."

### 4. Provide Clear Outcomes

❌ **Bad:** "Verify the system behaves as expected."

✅ **Good:** "Expected: App returns to sign-in screen. You see your email/account name is cleared. You cannot access Main or Settings without signing in again."

### 5. Include Error Cases

Every guide should have at least one test for what **should fail gracefully**:

- Wrong credentials
- Offline scenarios
- Invalid input
- Missing data

### 6. Give Context for Non-obvious Tests

If a test is "weird," explain why it matters:

❌ **Bad:** "Turn off network and try to create a world. It should fail."

✅ **Good:** "Turn off network and try to create a world. This tests that the app prevents accidental data loss—we don't want users to think they created a world when they're actually offline and the creation never reached the server."

---

## Test Case Format Guide

### Use Checkboxes for Pass/Fail

QA will replace `[ ]` with `[x]` when tests pass:

```markdown
**How to Record a Pass:**

- [ ] Screenshot of successful outcome
- [ ] Note: "Feature worked as expected"

**How to Record a Fail:**

- [ ] Screenshot of error/unexpected behavior
- [ ] Note: "[What went wrong]"
```

### Expected Outcomes Should Be Specific

✅ **Good:**

- ✅ Click the button and wait for loading to complete
- ✅ You land on the Main screen
- ✅ Your email is shown in the top menu

❌ **Bad:**

- ✅ Works correctly
- ✅ Data loads
- ✅ No errors

---

## Common Test Patterns

### Authentication Test

```markdown
### ✓ Test: Sign In with Valid Credentials

**Steps:**

1. Open the app
2. Enter test email
3. Enter test password
4. Press "Sign In"
5. Wait for the screen to load

**Expected Outcome:**

- ✅ Sign-in succeeds within 15 seconds
- ✅ You land on the main screen
- ✅ Your email is shown in the menu
```

### Offline Test

```markdown
### ✓ Test: View Cached Data Offline

**Steps:**

1. Load data while online (navigate to a screen)
2. Turn off network (airplane mode)
3. Navigate back to that screen

**Expected Outcome:**

- ✅ Data loads from cache
- ✅ No network error message
```

### Premium Feature Test

```markdown
### ✓ Test: Free User Sees Premium Lock

**Steps:**

1. Sign in as free user
2. Find a premium feature
3. Try to use it

**Expected Outcome:**

- ✅ Feature is locked or shows "Premium Only"
- ✅ An "Upgrade" button appears
```

### Error Handling Test

```markdown
### ✗ Test: Reject Wrong Password

**Steps:**

1. Enter correct email + wrong password
2. Press "Sign In"

**Expected Outcome:**

- ✅ Error message appears (e.g., "Invalid credentials")
- ✅ You stay on sign-in screen to retry
- ✅ App doesn't crash
```

---

## Platform-Specific Guidance

### App (Desktop/Mobile)

- No console access for QA
- Focus on UI behavior and user interactions
- Mention if network toggle is needed (Wi-Fi, airplane mode)
- If logs are needed, provide a built-in export option

### Web

- QA may have console access for specific tests (e.g., feature flag toggling)
- Can use browser back/forward buttons for navigation tests
- Address bar URL changes are valid test scenarios
- Bookmarking and history are important

---

## Checklist: Before Publishing a Guide

- [ ] Title includes platform (App/Web/Both)
- [ ] "Overview" section is 1-2 sentences a non-dev can understand
- [ ] All prerequisites are listed (accounts, setup, knowledge)
- [ ] At least 3 test cases (positive, negative, edge case)
- [ ] Every test case has clear "Expected Outcome"
- [ ] Every test case explains how to record Pass/Fail with checkboxes
- [ ] No code snippets or technical jargon (except where unavoidable)
- [ ] "Troubleshooting" section covers common issues
- [ ] "Success Criteria" is clear and testable
- [ ] Use emoji/symbols for clarity: ✓ ✗ ⚡ ❌ ✅

---

## Example: Complete Test Guides

See these for reference:

- `App/auth-signin.md` – Authentication flow
- `App/offline-access.md` – Offline functionality
- `Both/premiumfeatures-featureflags.md` – Premium features
- `Web/navigation.md` – Web navigation

---

## When QA Feedback Indicates a Guide is Unclear

If QA says "I don't understand what to test," the guide needs improvement:

1. **Rewrite the "Scenario"** – Make the user goal crystal clear
2. **Add an extra sentence** to "How [Feature] Works" explaining why this matters
3. **Simplify the steps** – Break into smaller, more granular actions
4. **Add a Troubleshooting entry** – If QA got stuck, others will too

---

## Review Checklist for Other Developers

If reviewing a guide written by another dev:

- [ ] Can a non-programmer understand the test?
- [ ] Are steps actionable (button names, field names visible)?
- [ ] Is the expected outcome testable (not vague)?
- [ ] Does it cover happy path + error cases + edge cases?
- [ ] Are platform differences noted?
- [ ] Would I know if it failed without developer help?
- [ ] Is there context explaining _why_ each test matters?

---

## Quick Status

Current guides (13 total):

- **App/** – auth-signin.md, offline-access.md
- **Both/** – premiumfeatures-featureflags.md, world-selection.md, world-sharing-invites.md, network-error-recovery.md, user-name-editing.md, world-deleting-editing.md, deleting-account.md, sync-conflict.md, analytics-tracking.md
- **Web/** – navigation.md, secure-storage.md

Guides still needed:

- Character creation and management
- Character editing
- World creation (if not yet implemented)
- Data queries and mutations
- Accessibility features
- Mobile-specific gesture interactions
- Permission / role-based access control
- Import/export functionality (if applicable)
- Performance and load time testing

---

## Questions?

If you're unsure how to write a test guide:

1. Check existing guides for examples
2. Ask QA what would be most helpful
3. Start simple – 3-5 clear test cases
4. Can always expand later based on feedback
