# Secure Storage — Test Guide

## Overview

- **Purpose:** Verify that sensitive user data is stored securely on the device (encrypted, not readable in plain text)
- **What we're testing:** Data encryption, secure storage vs. insecure storage, no plain-text passwords/tokens, data persistence with encryption, browser storage security

## Environments

- Web (browser-based testing only)

## Prerequisites

- **Test accounts:** One active account
- **Tools needed:**
  - Browser DevTools (F12 or right-click → Inspect)
  - Ability to access browser storage (Local Storage, Session Storage, IndexedDB)
- **Note:** This test is technical; best suited for developers or technically-minded QA

## How Secure Storage Works

The app stores sensitive data (session tokens, preferences, etc.) on the device. This data should be:

1. **Encrypted** – not readable if someone accesses the device storage
2. **Secure** – not stored in plain-text Local Storage or Session Storage
3. **Protected** – only accessible to the app (via Secure Storage API)
4. **Persistent** – survives page reload and browser restart

On web, "secure storage" means avoiding plain-text browser storage and using encrypted methods.

Why this matters: If sensitive data is stored in plain-text, anyone with browser access can read tokens, passwords, or preferences.

## Test Cases

### ✓ Test 1: Tokens Are Not in Plain-Text Local Storage

**Scenario:** Verify that auth tokens are NOT visible in browser Local Storage

**Steps:**

1. Sign in to the app
2. Open DevTools (F12)
3. Go to **Storage** tab (or **Application** tab on Chrome)
4. Click **Local Storage**
5. Find the current website (e.g., `http://localhost:3000` or your app URL)
6. Look through all stored keys and values
7. Search for suspicious plain-text values that look like tokens (long random strings, JWT, API keys, etc.)

**Expected Outcome:**

- ✅ Auth tokens are NOT visible in plain text
- ✅ No values that look like session tokens, API keys, or passwords
- ✅ If there are values, they are encrypted (unreadable gibberish) or just non-sensitive data (user preferences, theme, etc.)

**How to Record a Pass:**

- [ ] Screenshot of Local Storage showing no plain-text tokens
- [ ] Note: "Local Storage contains no plain-text auth tokens"

---

### ✓ Test 2: Tokens Are Not in Session Storage

**Scenario:** Verify that tokens are not stored in browser Session Storage (also insecure)

**Steps:**

1. Open DevTools
2. Go to **Storage** tab
3. Click **Session Storage**
4. Find the app's URL
5. Examine all stored values
6. Search for auth tokens or API keys

**Expected Outcome:**

- ✅ No plain-text auth tokens in Session Storage
- ✅ Any values are non-sensitive (preferences, temporary UI state, etc.)

**How to Record a Pass:**

- [ ] Screenshot of Session Storage showing no auth tokens
- [ ] Note: "Session Storage contains no plain-text tokens"

---

### ✓ Test 3: Sensitive Data Is Encrypted (if visible)

**Scenario:** If the app stores encrypted data, verify it's unreadable

**Steps:**

1. Open DevTools → Storage → Local Storage / IndexedDB
2. Look for stored data
3. If you see long strings that look encrypted (random characters, not readable words), note them
4. Try to decode one:
   - Copy the value
   - Try a base64 decoder (online or CLI: `echo [value] | base64 -d`)
   - If it decodes but is still gibberish, it's probably encrypted (good)

**Expected Outcome:**

- ✅ Encrypted data is not readable (even if you try to decode)
- ✅ Or data is stored in IndexedDB (not visible in plain-text storage)
- ✅ No plain-text sensitive values

**How to Record a Pass:**

- [ ] Screenshot of stored encrypted data (gibberish)
- [ ] Note: "Sensitive data is encrypted; not readable in storage"

---

### ✓ Test 4: No Passwords Stored in Browser

**Scenario:** Verify that passwords are never stored in the app

**Steps:**

1. Sign in to the app
2. Open DevTools
3. Search Local Storage and Session Storage for the password you used
4. Also check IndexedDB (Storage tab → IndexedDB)

**Expected Outcome:**

- ✅ Passwords are NEVER stored anywhere
- ✅ Searching for your password returns no results
- ✅ This is correct; passwords should only exist in memory during login

**How to Record a Pass:**

- [ ] Screenshot of DevTools with no password values visible
- [ ] Note: "No passwords found in browser storage"

---

### ✓ Test 5: Data Persists Across Page Reload

**Scenario:** Verify that secure data survives page reload (encryption is maintained)

**Steps:**

1. Sign in and load a world
2. Note something that's stored (user ID, world ID, preferences, etc.)
3. Press F5 to reload the page
4. Wait for the app to load
5. Verify the app is still signed in and data is loaded

**Expected Outcome:**

- ✅ App is still signed in after reload (auth token persisted securely)
- ✅ User data is available (not lost)
- ✅ No need to sign in again (token was securely stored and retrieved)

**How to Record a Pass:**

- [ ] Screenshot after reload showing user is still signed in
- [ ] Note: "Data persisted across page reload; app still authenticated"

---

### ✓ Test 6: Logout Clears Sensitive Data

**Scenario:** After logout, verify that tokens and sensitive data are deleted

**Steps:**

1. Sign in to the app
2. Open DevTools → Storage
3. Note what's stored (tokens, user data, etc.)
4. Sign out of the app
5. Go back to Storage and check what's left

**Expected Outcome:**

- ✅ Auth tokens are removed from storage
- ✅ User ID or session data is cleared
- ✅ Non-sensitive data (preferences, theme) may remain (optional)
- ✅ Signing out is complete; no leftover secrets

**How to Record a Pass:**

- [ ] Screenshot of storage BEFORE logout
- [ ] Screenshot of storage AFTER logout showing tokens removed
- [ ] Note: "Logout successfully cleared auth tokens and sensitive data"

---

### ⚡ Test 7: Browser Security Features Not Bypassed

**Scenario:** Verify the app doesn't disable or bypass browser security

**Steps:**

1. Open DevTools → Console
2. Try to manually access stored data (attempt to read Local Storage):
   - Type: `localStorage.getItem("auth_token")` (or similar key name)
3. If the app uses Secure Storage API, this should NOT return sensitive data
4. If it does, that's a red flag

**Expected Outcome:**

- ✅ Browser security is intact; can't access tokens from console
- ✅ Local Storage either returns null or encrypted/non-sensitive data
- ✅ Secure Storage API is used (not bypassed)

**How to Record a Pass:**

- [ ] Screenshot of console trying to access storage
- [ ] Note: "Browser security intact; tokens not accessible via console"

---

### ⚡ Test 8: Cross-Site Request Forgery (CSRF) Protection

**Scenario:** Verify that sensitive requests are protected against CSRF

**Steps:**

1. Sign in to the app
2. Open DevTools → Network tab
3. Perform a sensitive action (edit world, change settings, delete something)
4. Look at the request:
   - Does it include a CSRF token or require a specific header?
   - Is the request using POST (not GET) for sensitive actions?

**Expected Outcome:**

- ✅ Sensitive requests are POST (not GET)
- ✅ Request includes a CSRF token or SameSite cookie protection
- ✅ Request is not a simple GET that could be triggered by a malicious website

**How to Record a Pass:**

- [ ] Screenshot of Network tab showing a sensitive request with protections
- [ ] Note: "Sensitive requests include CSRF protections"

---

### ⚡ Test 9: No Sensitive Data in Cookies

**Scenario:** Verify that auth tokens are not stored in plain-text cookies

**Steps:**

1. Open DevTools → Storage → Cookies
2. Find the cookie for your app's domain
3. Look at all cookies
4. Search for plain-text tokens or API keys

**Expected Outcome:**

- ✅ If cookies are used for auth, they are marked as:
  - **HttpOnly** (not accessible to JavaScript, preventing XSS theft)
  - **Secure** (only sent over HTTPS)
  - **SameSite** (protected against CSRF)
- ✅ No plain-text tokens in cookies
- ✅ Cookie values are either encrypted or used for sessions

**How to Record a Pass:**

- [ ] Screenshot of cookies showing security flags (HttpOnly, Secure, SameSite)
- [ ] Note: "Auth cookies secured with HttpOnly, Secure, SameSite flags"

---

## Platform-Specific Notes

### Web

- Use DevTools Storage tab for inspection
- Can use Console to probe storage APIs
- Cookies visible in DevTools → Cookies section
- This is the only platform where secure storage is user-testable

### App (Electron / Mobile)

- Secure storage is handled internally by the OS (not testable via browser)
- Skip this guide for app testing

---

## Troubleshooting

| Issue                                             | Solution                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Find a plain-text token in Local Storage**      | That's a security bug. Report it immediately—tokens should never be stored in plain-text.                                                      |
| **Don't know if a stored value is encrypted**     | Try to decode it (base64, etc.). If it remains gibberish, it's likely encrypted (good). If it decodes to readable text, it's plain-text (bad). |
| **Can't find where tokens are stored**            | They may be in IndexedDB (less obvious). Ask the developer where sessions are stored.                                                          |
| **DevTools shows storage but can't read cookies** | Some cookies are HttpOnly (by design—you shouldn't see them). This is actually a good sign.                                                    |
| **Find passwords in storage**                     | This is a critical security bug. Report it—passwords should never be stored.                                                                   |

---

### ✓ Test 10: Privacy Data Classification Respected

**Scenario:** Verify that data is stored/cleared according to privacy classification (SENSITIVE, PII, NON_SENSITIVE, PUBLIC)

**Steps:**

1. Sign in to the app
2. Open DevTools → Storage → Local Storage / Session Storage
3. Note what's stored (watch for theme, preferences, tokens, etc.)
4. Sign out of the app
5. Check storage again for what remains

**Expected Outcome:**

- ✅ **SENSITIVE/PII data cleared:** Auth tokens, user email, refresh tokens removed
- ✅ **NON_SENSITIVE data cleared:** Theme preferences, selected world ID removed on logout
- ✅ **PUBLIC data may remain:** Query caches, non-sensitive UI state (optional)
- ✅ User cannot see what they were doing before logout (privacy reset)

**How to Record a Pass:**

- [ ] Screenshot showing what's stored BEFORE logout
- [ ] Screenshot showing what's cleared AFTER logout
- [ ] Note: "Privacy classification respected; SENSITIVE/PII/NON_SENSITIVE data cleared on logout"

---

### ✓ Test 11: Logout Resets Theme to Default

**Scenario:** Verify that theme is reset to "classic" dark mode after logout (clean slate for next user)

**Steps:**

1. Sign in to the app
2. Change theme to something other than "classic" (e.g., "cyberpunk", "light mode")
3. Take note of the theme
4. Sign out
5. Observe the theme—it should be back to "classic" dark mode
6. Reload the page and verify it stays as default

**Expected Outcome:**

- ✅ After logout, theme immediately reverts to "classic" dark mode
- ✅ Next user does not see previous user's theme choice
- ✅ Reloading page maintains default theme (data was saved)

**How to Record a Pass:**

- [ ] Screenshot of app with custom theme before logout
- [ ] Screenshot of app with default theme after logout
- [ ] Note: "Theme correctly reset to classic/dark mode on logout"

---

### ✓ Test 12: PII Not Visible in Browser Console Logs

**Scenario:** Verify that sensitive data (emails, tokens, user IDs) is redacted in browser logs

**Steps:**

1. Sign in to the app with an account
2. Open DevTools → Console tab
3. Perform various actions (navigate, load world, etc.)
4. Search the console logs for:
   - Email address used to sign in
   - Auth token (if visible anywhere)
   - User ID
   - Session ID

**Expected Outcome:**

- ✅ Email is NOT visible in logs (or shows as `[REDACTED]`)
- ✅ Auth tokens are NOT visible in logs (or show as `[REDACTED]`)
- ✅ User IDs are NOT visible in logs (or show as `[REDACTED]`)
- ✅ Session IDs are NOT visible in logs (or show as `[REDACTED]`)
- ✅ General log messages are still readable (not excessively redacted)

**How to Record a Pass:**

- [ ] Screenshot of browser console showing logs
- [ ] Search results showing PII is redacted or absent
- [ ] Note: "Console logs do not expose PII; sensitive data is redacted"

---

## Success Criteria ✅

- ✅ Auth tokens are not in plain-text Local Storage or Session Storage
- ✅ Passwords are never stored in browser
- ✅ Sensitive data is encrypted or stored securely (not readable)
- ✅ Data persists across page reload (encryption allows recovery)
- ✅ Logout clears all auth tokens and sensitive data
- ✅ Tokens are not accessible via browser console
- ✅ Sensitive requests include CSRF protections
- ✅ Auth cookies are marked with security flags (HttpOnly, Secure, SameSite)
- ✅ No plain-text API keys or secrets in storage
- ✅ Browser security features are not disabled or bypassed
- ✅ Privacy classification respected (SENSITIVE/PII/NON_SENSITIVE/PUBLIC data cleared appropriately)
- ✅ Theme reset to default ("classic" dark mode) on logout
- ✅ PII not visible in browser console logs (redacted or absent)
