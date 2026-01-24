# Navigation & Screen Flow — Test Guide (Web: Desktop Browser)

## Overview

- **Purpose:** Verify that users can navigate between screens smoothly and data loads correctly
- **What we're testing:** Page transitions, back/forward buttons, URLs, loading states, error handling

## Environments

- Web (desktop browser) – Chrome, Firefox, Safari, Edge

## Prerequisites

- **Test account** that is signed in
- **Access to at least 2 worlds** (to test navigation between them)
- **Desktop browser** with address bar visible

---

## How Navigation Works

The web version uses standard browser navigation:

- ✅ Forward/Back buttons work
- ✅ URL changes reflect current screen
- ✅ Can bookmark and share URLs
- ✅ Can use browser history

---

## Test Cases

### ✓ Test 1: Navigate Between Main Screens

**Scenario:** User can click between top-level screens

**Steps:**

1. Sign in to the app
2. Look for the main menu or navigation
3. Click different sections (Main, Settings, etc.)
4. Wait for each screen to load
5. Verify the content changes

**Expected Outcome:**

- ✅ All screens load within 5 seconds
- ✅ Content changes when you navigate
- ✅ URL updates (look at address bar)
- ✅ No loading indefinitely

**How to Record a Pass:**

- [ ] Screenshots of 2-3 different screens
- [ ] Note: "Navigation works smoothly between screens"

**How to Record a Fail:**

- [ ] Screenshot if screen doesn't load or hangs
- [ ] Note: "Screen [name] took too long to load"

---

### ✓ Test 2: Browser Back Button Works

**Scenario:** Using the browser's back button returns to the previous screen

**Steps:**

1. Navigate to a screen (e.g., Main)
2. Click to open another screen (e.g., Settings)
3. Note the current URL in the address bar
4. Click the browser's BACK button (← arrow)
5. Observe if you return to the previous screen

**Expected Outcome:**

- ✅ Back button takes you to the previous screen
- ✅ URL changes back to the previous page's URL
- ✅ No errors or blank screens

**How to Record a Pass:**

- [ ] Screenshot of address bar before/after clicking back
- [ ] Note: "Back button works correctly"

**How to Record a Fail:**

- [ ] Screenshot if back button doesn't work
- [ ] Note: "Back button didn't navigate"

---

### ✓ Test 3: World Selection & Navigation

**Scenario:** User can switch between different worlds via navigation

**Steps:**

1. Sign in and verify you're viewing a world
2. Look for a world selector or menu
3. Switch to a different world (if available)
4. Verify the screen updates with that world's data

**Expected Outcome:**

- ✅ World selector is visible and clickable
- ✅ Switching worlds updates the screen within 5 seconds
- ✅ URL reflects the new world
- ✅ Data shown matches the selected world

**How to Record a Pass:**

- [ ] Screenshots of two different worlds' screens
- [ ] Note: "World switching works correctly"

**How to Record a Fail:**

- [ ] Screenshot if world doesn't switch or data is wrong
- [ ] Note: "World switch failed or showed wrong data"

---

### ✓ Test 4: Direct URL Navigation

**Scenario:** You can navigate by changing the URL directly

**Steps:**

1. Look at the current URL in the address bar
2. Find another valid URL (ask developer for an example, e.g., `/main/worlds`)
3. Paste the new URL into the address bar
4. Press Enter
5. Wait for the screen to load

**Expected Outcome:**

- ✅ App navigates to the new URL
- ✅ Correct screen loads with proper data
- ✅ No "404" or error page
- ✅ Data matches the URL

**How to Record a Pass:**

- [ ] Screenshot of the URL in address bar
- [ ] Screenshot of the loaded screen
- [ ] Note: "Direct URL navigation works"

**How to Record a Fail:**

- [ ] Screenshot of error page or blank screen
- [ ] Note: "URL [example] returns error"

---

### ✓ Test 5: Bookmark & Revisit

**Scenario:** User can bookmark a screen and return to it later

**Steps:**

1. Navigate to a specific screen (e.g., a world or settings)
2. Bookmark the page (Ctrl+D or Cmd+D)
3. Confirm the bookmark is saved
4. Navigate away (go to a different screen)
5. Open your bookmarks and click the saved bookmark
6. Verify you return to the original screen

**Expected Outcome:**

- ✅ Bookmark saves without error
- ✅ Clicking bookmark returns you to the same screen
- ✅ Same URL and data load
- ✅ No re-authentication required if still logged in

**How to Record a Pass:**

- [ ] Screenshot of bookmark being created
- [ ] Screenshot of screen after opening bookmark
- [ ] Note: "Bookmark works correctly"

**How to Record a Fail:**

- [ ] Screenshot of error or wrong screen
- [ ] Note: "Bookmark didn't navigate correctly"

---

### ⚡ Test 6: Loading States & Placeholders

**Scenario:** User sees clear feedback while screens are loading

**Steps:**

1. Navigate to a screen that loads data (Main, World Details, etc.)
2. Watch the screen as it loads
3. Look for loading indicators (spinners, placeholders, progress bars)
4. Wait for the data to fully load

**Expected Outcome:**

- ✅ Loading indicator appears immediately
- ✅ Clear feedback that something is loading
- ✅ Data appears within 5-15 seconds
- ✅ No blank white screen with no feedback

**How to Record a Pass:**

- [ ] Screenshot of loading state
- [ ] Screenshot of fully loaded screen
- [ ] Note: "Clear loading feedback provided"

**How to Record a Fail:**

- [ ] Screenshot of blank screen with no loader
- [ ] Note: "No loading indicator shown"

---

### ✗ Test 7: Error Handling on Navigation

**Scenario:** Invalid URLs show a helpful error

**Steps:**

1. Type an invalid URL into the address bar (e.g., `/nonexistent-page`)
2. Press Enter
3. Observe the response

**Expected Outcome:**

- ✅ App shows a clear 404 or error page
- ✅ Error message is helpful (e.g., "Page not found")
- ✅ User can navigate back via back button or menu link
- ✅ App doesn't crash

**How to Record a Pass:**

- [ ] Screenshot of the error page
- [ ] Note: "Invalid URL handled gracefully"

**How to Record a Fail:**

- [ ] Screenshot if app crashes or shows blank page
- [ ] Note: "No error page; blank/crash occurred"

---

## Platform-Specific Notes

### Web Only:

- You can use the browser's developer tools if needed (F12)
- Look at the address bar to verify URLs are changing
- Use browser history (Back/Forward buttons)

---

## Troubleshooting

| Issue                             | Solution                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------- |
| "Navigating takes forever (>15s)" | Staging server might be slow. Try again or check network speed.                   |
| "Back button doesn't work"        | Make sure you're using the browser's back button, not an in-app button.           |
| "URL didn't change"               | It might have changed to a different-looking URL. Compare before/after carefully. |
| "Bookmarks show wrong screen"     | You might still be signed out. Sign in and try again.                             |

---

## Success Criteria ✅

All tests pass when:

- ✅ Can navigate smoothly between screens
- ✅ Browser back button works
- ✅ World switching works with correct data
- ✅ Direct URL navigation works
- ✅ Bookmarks save and work correctly
- ✅ Loading states are clear
- ✅ Errors handled gracefully
