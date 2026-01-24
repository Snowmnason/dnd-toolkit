# Sign-In & Authentication — Test Guide (App: Desktop & Mobile)

## Overview

- **Purpose:** Verify that sign-in works correctly and protects screens that require authentication
- **What we're testing:** User login, session management, sign-out, access permissions, error handling

## Environments

- Desktop (Electron app)
- Mobile (iOS/Android via Expo)

## Prerequisites

- **App installed** on test device or emulator
- **Test accounts** provided by developer:
  - Email and password for testing
  - Know if you're testing staging or production
- **Clear app cache** before starting (optional but recommended for clean testing)

## Test Data Setup

Your developer should provide:

| Item          | Example               | Notes                                  |
| ------------- | --------------------- | -------------------------------------- |
| Test email    | `qa-test@example.com` | The account to sign in with            |
| Test password | `[from dev]`          | Keep this safe; don't share            |
| Environment   | staging.app.com       | Ask which server the build connects to |

## Test Cases

### ✓ Test 1: Basic Sign-In

**Scenario:** A new user signs in with correct credentials

**Steps:**

1. Open the app
2. Enter your test email
3. Enter your test password
4. Tap "Sign In"
5. Wait for the screen to load (5-15 seconds typical)
6. Observe where the app takes you

**Expected Outcome:**

- ✅ Sign-in succeeds within 15 seconds
- ✅ App displays the main screen or world selector
- ✅ You do NOT see the sign-in screen anymore
- ✅ Menu shows your email/account name

**How to Record a Pass:**

- [ ] Success screenshot (main screen or world selector)
- [ ] Note: "Signed in successfully with [email]"

**How to Record a Fail:**

- [ ] Error screenshot (error message visible)
- [ ] Note: "Sign-in failed with error: [message]"

---

### ✓ Test 2: Session Persists After App Restart

**Scenario:** After closing and reopening the app, you stay signed in

**Steps:**

1. Sign in (from Test 1)
2. Once on the main screen, completely close the app
3. Wait 3 seconds
4. Reopen the app
5. Check what screen appears

**Expected Outcome:**

- ✅ App skips the sign-in screen
- ✅ You land directly on the main screen (or where you left off)
- ✅ No need to re-enter your credentials

**How to Record a Pass:**

- [ ] Screenshot of main screen after reopening
- [ ] Note: "No sign-in required after app restart"

**How to Record a Fail:**

- [ ] Screenshot showing sign-in screen after restart
- [ ] Note: "App forgot session after close/reopen"

---

### ✗ Test 3: Reject Wrong Password

**Scenario:** Signing in with the correct email but wrong password

**Steps:**

1. Open the app (sign out if needed)
2. Enter the correct test email
3. Enter an intentionally wrong password (`BadPassword123`)
4. Tap "Sign In"
5. Observe the response

**Expected Outcome:**

- ✅ Sign-in fails within 10 seconds
- ✅ A clear error appears (e.g., "Invalid credentials")
- ✅ You remain on the sign-in screen to retry
- ✅ App does NOT crash

**How to Record a Pass:**

- [ ] Screenshot of the error message
- [ ] Note: "Error clearly shown: [exact message]"

**How to Record a Fail:**

- [ ] Screenshot if it doesn't fail gracefully
- [ ] Note: "Sign-in succeeded despite wrong password" or "App crashed"

---

### ✗ Test 4: Reject Non-Existent Email

**Scenario:** Signing in with an email that doesn't exist

**Steps:**

1. Open the app (sign out if needed)
2. Enter a fake email that doesn't exist (`fakeemail-{timestamp}@example.com`)
3. Enter any password
4. Tap "Sign In"
5. Observe the response

**Expected Outcome:**

- ✅ Sign-in fails within 10 seconds
- ✅ Clear error message appears
- ✅ You stay on the sign-in screen
- ✅ App does NOT crash

**How to Record a Pass:**

- [ ] Screenshot of the error message
- [ ] Note: "Unknown account properly rejected"

---

### ✗ Test 5: Sign Out Clears Session

**Scenario:** After signing out, protected screens become inaccessible

**Steps:**

1. Sign in (from Test 1)
2. Navigate to Settings (or find the sign-out button)
3. Tap "Sign Out"
4. Wait for the app to return to the sign-in screen
5. Try to navigate back to the main screen (if possible)

**Expected Outcome:**

- ✅ Sign-out completes within 5 seconds
- ✅ App returns to the sign-in screen
- ✅ All user data is cleared (you can't see your account info)
- ✅ Trying to access protected screens redirects to sign-in

**How to Record a Pass:**

- [ ] Screenshot of sign-in screen after sign-out
- [ ] Note: "Sign-out successful; session cleared"

**How to Record a Fail:**

- [ ] Screenshot if protected screens still show user data
- [ ] Note: "User data visible after sign-out"

---

### ⚡ Test 6: Network Error Handling

**Scenario:** Network is unavailable during sign-in

**Steps:**

1. Turn off Wi-Fi/cellular (airplane mode is easiest)
2. Open the app
3. Attempt to sign in
4. Observe the response

**Expected Outcome:**

- ✅ Sign-in attempt fails within 15 seconds
- ✅ A clear "network" or "connection" error appears
- ✅ You can retry once network is restored

**How to Record a Pass:**

- [ ] Screenshot of network error message
- [ ] Note: "Clear network error message shown"

**How to Record a Fail:**

- [ ] Screenshot if error is unclear
- [ ] Note: "Unclear error or app hangs"

---

## Platform-Specific Notes

### Mobile (iOS/Android):

- No developer console available
- Testing is purely through the UI
- If the developer asks for logs, they should provide an in-app export option

### Desktop (Electron):

- Same UI-based testing as mobile
- Developers can check logs via app menu if needed

---

## Troubleshooting

| Issue                                        | Solution                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| "Sign-in never completes (stuck on loading)" | Wait 30 seconds, then try again. If still stuck, restart app and check network. |
| "Network error even with Wi-Fi on"           | The staging server might be down. Wait 1 minute and try again.                  |
| "Error message is confusing"                 | Take a screenshot and report the exact error text to the developer.             |
| "Forgot my test password"                    | Ask your developer for a new test account.                                      |
| "Can't find the sign-out button"             | Check the app menu or Settings screen. Ask your developer if needed.            |

---

## Success Criteria ✅

All tests pass when:

- ✅ Sign-in works with correct credentials
- ✅ Session persists across app restarts
- ✅ Wrong credentials are rejected with a clear error
- ✅ Non-existent accounts are rejected
- ✅ Sign-out completely clears the session
- ✅ Network errors are handled gracefully
