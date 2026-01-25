# Safe Mode Testing Guide

## Overview

This guide covers manual and automated testing procedures for the Safe Mode resilience system.

## Test Environment Setup

### Prerequisites

- App built and running on target platform (web, iOS, Android)
- Access to Settings screen (for dev testing tools)
- Network connectivity (for some tests)

### Dev Testing Tools

**Location:** Settings → Safe Mode Testing

Three buttons to trigger safe mode states:
- **Enter Degraded Mode** – Triggers DEGRADED state
- **Enter Safe Mode** – Triggers SAFE state  
- **Enter Recovery Mode** – Triggers RECOVERY state

Each button also logs entry to console for verification.

---

## Test Cases

### TC-001: Safe Mode Entry (DEGRADED)

**Objective:** Verify SafeModeScreen displays correctly for DEGRADED state

**Steps:**
1. Navigate to Settings → Safe Mode Testing
2. Tap "Enter Degraded Mode"
3. Verify screen displays:
   - Safe mode icon/header
   - Description: "Your app data cannot be read right now. This is usually temporary."
   - Affected features list
   - "Back to Navigation" button

**Expected Result:** ✅ Screen renders without errors, all text visible, button tappable

**Verification:**
- Console: Check for "safe_mode_entered" event in analytics logs
- UI: All elements render, no layout issues

---

### TC-002: Safe Mode Entry (SAFE)

**Objective:** Verify SafeModeScreen displays correctly for SAFE state

**Steps:**
1. Navigate to Settings → Safe Mode Testing
2. Tap "Enter Safe Mode"
3. Verify screen displays same UI as DEGRADED
4. Verify description text: "Your app data may be corrupted..."

**Expected Result:** ✅ Screen renders, different message for SAFE reason

**Verification:**
- Console: "safe_mode_entered" event with level: "safe"
- UI: Correct message displayed

---

### TC-003: Safe Mode Entry (RECOVERY)

**Objective:** Verify SafeModeScreen displays recovery options for RECOVERY state

**Steps:**
1. Navigate to Settings → Safe Mode Testing
2. Tap "Enter Recovery Mode"
3. Verify screen displays:
   - Critical warning icon/header
   - Message: "Your app encountered a critical issue..."
   - Recovery action buttons (Clear Cache, Reset Auth, Contact Support, Reinstall)

**Expected Result:** ✅ All recovery buttons visible and tappable

**Verification:**
- Console: "safe_mode_entered" event with level: "recovery"
- UI: All 4 buttons render (RESTORE_BACKUP may not show if always disabled)

---

### TC-004: Back to Navigation (DEGRADED/SAFE)

**Objective:** Verify user can return to normal navigation from DEGRADED/SAFE state

**Steps:**
1. Enter Degraded Mode (TC-001)
2. Tap "Back to Navigation" button
3. Verify navigation back to previous screen (likely Settings or home)
4. Verify safe mode UI is gone

**Expected Result:** ✅ Returns to normal app navigation

**Verification:**
- Console: "safe_mode_action" event
- Analytics: action: "navigate_home"
- UI: Normal app layout restored

---

### TC-005: Clear Cache Recovery Action

**Objective:** Verify CLEAR_CACHE recovery action

**Steps:**
1. Enter Recovery Mode (TC-003)
2. Tap "Clear Cache & Restart" button
3. Wait for action to complete (should be quick)
4. Verify navigation to /select/world-selection

**Expected Result:** ✅ Cache cleared, app navigates to world selection

**Verification:**
- Console: 
  - "safe_mode_recovery_action_selected" event (action: "clear_cache")
  - "safe_mode_recovery_action_succeeded" event
- Navigation: Should be at world selection screen
- Query Cache: Should be empty

---

### TC-006: Reset Auth Recovery Action

**Objective:** Verify RESET_AUTH recovery action

**Steps:**
1. Enter Recovery Mode (TC-003)
2. If first button is "Clear Cache", tap it first to proceed to next action
3. Tap "Reset & Log In Again" button
4. Wait for action to complete
5. Verify navigation to /login/sign-in

**Expected Result:** ✅ Auth cleared, app navigates to login screen

**Verification:**
- Console:
  - "safe_mode_recovery_action_selected" event (action: "reset_auth")
  - "safe_mode_recovery_action_succeeded" event
- Navigation: Should be at login/sign-in screen
- Auth State: Should have no active session

---

### TC-007: Contact Support Recovery Action

**Objective:** Verify CONTACT_SUPPORT opens email client

**Steps:**
1. Enter Recovery Mode (TC-003)
2. Tap "Contact Support" button
3. Wait for email client to open

**Expected Result:** ✅ Email client opens with:
- To: support@example.com (or configured email)
- Subject: "D&D Toolkit - Safe Mode Recovery"
- Body: Diagnostic information (reason, affected features, timestamp, app version)

**Verification:**
- Console:
  - "safe_mode_recovery_action_selected" event
  - "safe_mode_recovery_action_succeeded" event (if email opened)
  - "safe_mode_recovery_action_failed" event (if email client unavailable)
- UI: Email client appears (platform-dependent)

---

### TC-008: Reinstall Guidance Recovery Action

**Objective:** Verify REINSTALL shows guidance

**Steps:**
1. Enter Recovery Mode (TC-003)
2. Tap "Reinstall App" button
3. Verify guidance message displays

**Expected Result:** ✅ Shows clear instructions to manually uninstall/reinstall

**Verification:**
- Console: "safe_mode_recovery_action_succeeded" event
- UI: Message guides user to device settings/app store

---

### TC-009: Restore Backup Recovery Action (Future)

**Objective:** Verify RESTORE_BACKUP shows deferred message

**Steps:**
1. Enter Recovery Mode (TC-003)
2. Look for "Restore from Backup" button
3. If available, tap it

**Expected Result:** ❌ Not yet available (feature deferred)

**Verification:**
- Console: "safe_mode_recovery_action_failed" event with appropriate message
- UI: Error message: "Backup restore is not yet available..."

---

### TC-010: Multiple Safe Mode Triggers

**Objective:** Verify safe mode state updates if triggered while already in safe mode

**Steps:**
1. Enter Degraded Mode (TC-001)
2. Navigate back to Settings → Safe Mode Testing
3. Tap "Enter Recovery Mode"
4. Verify screen updates to RECOVERY (not stuck on DEGRADED)

**Expected Result:** ✅ State transitions to RECOVERY, new event sent

**Verification:**
- Console: New "safe_mode_entered" event with level: "recovery"
- UI: Screen shows recovery buttons now

---

## Platform-Specific Tests

### Web

**TC-W-001: Email Client**
- Steps: TC-007 (Contact Support)
- Expected: mailto: link opens in browser's default email handler or shows mail apps

**TC-W-002: Responsive UI**
- Resize browser window while in safe mode
- Verify UI remains readable at all sizes

### iOS

**TC-I-001: Email Client**
- Steps: TC-007 (Contact Support)
- Expected: Mail app opens with email draft

**TC-I-002: Safe Mode Persistence**
- Enter recovery mode
- Backgrounded app
- Return to app
- Verify safe mode screen is still displayed

### Android

**TC-A-001: Email Client**
- Steps: TC-007 (Contact Support)
- Expected: Email/Gmail app opens with email draft

**TC-A-002: System Navigation**
- Enter recovery mode
- Tap system back button
- Expected: Behavior depends on implementation (may block back or navigate home)

---

## Automated Test Scenarios

### Scenario 1: Storage Failure Recovery

```
1. Mock SecureStorage to throw error
2. Verify app enters RECOVERY state
3. User taps CLEAR_CACHE
4. Verify SecureStorage error resolved
5. Verify navigation to world selection
```

### Scenario 2: Auth Failure Recovery

```
1. Mock AuthStateManager to return invalid session
2. Verify app enters SAFE/RECOVERY state
3. User taps RESET_AUTH
4. Verify session cleared
5. Verify navigation to login
```

### Scenario 3: Kernel Timeout Recovery

```
1. Delay kernel bootstrap beyond timeout
2. Verify app enters RECOVERY state
3. Verify timeout reason shown to user
4. User taps CLEAR_CACHE
5. Verify recovery succeeds
```

---

## Analytics Verification

### Event Checklist

**For each test case, verify console shows:**

- [ ] `safe_mode_entered` – When entering safe mode
  - Properties: level, reason, affected_features, recovery_options_count
- [ ] `safe_mode_action` – When tapping "Back to Navigation"
  - Properties: action (navigate_home), level, reason
- [ ] `safe_mode_recovery_action_selected` – When tapping recovery button
  - Properties: action, level, reason
- [ ] `safe_mode_recovery_action_succeeded` – When recovery succeeds
  - Properties: action
- [ ] `safe_mode_recovery_action_failed` – When recovery fails
  - Properties: action, reason, error_message

### Performance Metrics

- [ ] `safe_mode_degraded` – Duration (should be < 60s if user navigates back quickly)
- [ ] `safe_mode_recovery` – Duration (should be < 60s if user recovers quickly)
- [ ] `recovery_action:clear_cache` – Duration (should complete in < 5s)
- [ ] `recovery_action:reset_auth` – Duration (should complete in < 5s)

---

## Regression Testing

**Before release, verify:**

1. ✅ App starts normally in NORMAL state (no false safe mode triggers)
2. ✅ Settings screen loads (safe mode test buttons available)
3. ✅ All test cases TC-001 through TC-009 pass
4. ✅ All platforms tested (web, iOS, Android)
5. ✅ Analytics events firing correctly
6. ✅ No console errors during any test case

---

## Debugging Checklist

**If safe mode tests fail:**

- [ ] Check console for errors (look for stack traces)
- [ ] Check analytics events firing (open browser DevTools → Network/Console)
- [ ] Verify safe mode state in kernel (inspect AppKernel.state.safeMode)
- [ ] Verify recovery handlers executing (check logs from recovery-actions.ts)
- [ ] Check platform-specific issues:
  - **Web:** Browser cache, console errors
  - **iOS:** Check system logs, Mail app availability
  - **Android:** Check Logcat, email app availability

---

## Test Coverage Summary

| Area | Test Cases | Status |
|------|-----------|--------|
| Safe Mode Entry | TC-001, TC-002, TC-003 | ✅ Manual |
| Navigation | TC-004 | ✅ Manual |
| Recovery Actions | TC-005, TC-006, TC-007, TC-008 | ✅ Manual |
| State Transitions | TC-010 | ✅ Manual |
| Platform-Specific | TC-W-001, TC-I-001, TC-A-001 | ⏳ Manual |
| Automated Scenarios | 3 scenarios | ⏳ Unit/E2E |
| Analytics | Event verification | ✅ Manual |

---

## Related

- [lib/error/README.md](../../../../lib/error/README.md) – Safe Mode architecture
- [docs/issues/MileStone 2/173 - Safe Mode Implementation/SAFE_MODE.md](./SAFE_MODE.md) – Usage guide
- [app/settings/safe-mode-test.tsx](../../../../app/settings/safe-mode-test.tsx) – Dev testing tools
