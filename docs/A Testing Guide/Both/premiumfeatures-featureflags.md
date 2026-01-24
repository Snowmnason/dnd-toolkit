# Premium Features & Feature Flags — Test Guide

## Overview

- **Purpose:** Verify that premium features are properly gated, feature flags work correctly, and users see appropriate upgrade prompts
- **What we're testing:** Premium user access to features, free user lock icons, upgrade button behavior, feature flag toggling, flag consistency across platforms

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:**
  - Free user account (no premium)
  - Premium user account (with premium access)
- **Test data:**
  - A world with premium features available (if applicable)
- **Tools (Web only):**
  - Browser DevTools console (for feature flag toggling, if available)

## How Premium & Feature Flags Work

Premium features are locked behind a subscription. Users with premium access can use them; free users see:

1. A lock icon (🔒)
2. An "Upgrade" or "Buy Premium" button
3. A message explaining the feature is premium-only

Feature flags are on/off switches controlled by developers to test or roll out features gradually. Both premium status and feature flags affect what users see.

Why this matters: If premium gating breaks, users get free access to paid features, or premium users can't use what they paid for. Feature flags need to work so developers can test safely.

## Test Cases

### ✓ Test 1: Premium User Sees Feature

**Scenario:** Premium user can access a premium feature

**Steps:**

1. Sign in as a **premium user account**
2. Navigate to a premium feature (e.g., advanced character options, custom world settings, or a feature marked as "premium" in the app)
3. Try to use the feature

**Expected Outcome:**

- ✅ Feature is visible and usable (no lock icon)
- ✅ No "upgrade" prompt
- ✅ Feature works as expected
- ✅ No error messages

**How to Record a Pass:**

- [ ] Screenshot showing the premium feature is accessible
- [ ] Screenshot showing no lock icon or upgrade button
- [ ] Note: "Premium user can access [feature name]"

---

### ✓ Test 2: Free User Sees Lock & Upgrade Prompt

**Scenario:** Free user tries to access a premium feature and sees the lock

**Steps:**

1. Sign in as a **free user account**
2. Navigate to the same premium feature from Test 1
3. Look for a lock icon or "upgrade" prompt

**Expected Outcome:**

- ✅ Feature is visible but locked (lock icon 🔒 or "upgrade" label)
- ✅ Feature is not usable (button is disabled or clicking shows a prompt)
- ✅ Clear upgrade button or "Buy Premium" link is visible
- ✅ Message explains why it's locked (e.g., "This feature is premium-only")

**How to Record a Pass:**

- [ ] Screenshot showing the locked feature with lock icon
- [ ] Screenshot showing the upgrade button/message
- [ ] Note: "Free user sees lock and upgrade prompt for [feature name]"

---

### ✓ Test 3: Upgrade Button Navigates to Upgrade Flow

**Scenario:** Clicking the upgrade button starts the upgrade process

**Steps:**

1. Sign in as a **free user**
2. Click on a locked premium feature
3. Click the **Upgrade** or **Buy Premium** button

**Expected Outcome:**

- ✅ Button click navigates to:
  - Upgrade/payment screen, OR
  - Premium information page, OR
  - App store / payment provider page (depending on platform)
- ✅ Navigation works without errors
- ✅ Clear messaging about what premium includes

**How to Record a Pass:**

- [ ] Screenshot showing the upgrade button
- [ ] Screenshot showing the upgrade/payment flow started
- [ ] Note: "Upgrade button navigates to upgrade flow"

---

### ✗ Test 4: Free Features Work for Both Users

**Scenario:** Verify that non-premium features work for both free and premium users

**Steps:**

1. Identify a feature that is NOT premium (e.g., basic character creation, world navigation, messaging)
2. Test as **free user** → feature should work
3. Test as **premium user** → feature should work

**Expected Outcome:**

- ✅ Free user can use the feature (no lock icon)
- ✅ Premium user can use the feature
- ✅ Both see identical behavior
- ✅ No locks or upgrade prompts on free features

**How to Record a Pass:**

- [ ] Screenshot of free user using the feature
- [ ] Screenshot of premium user using the same feature
- [ ] Note: "Free feature works identically for both user types"

---

### ✓ Test 5: Feature Flag Toggling (Web Only)

**Scenario:** If feature flags are controllable in web console, toggle one and verify it works

**Steps:**

1. (Web only) Open DevTools → Console
2. Look for a command or function to toggle features (e.g., `featureFlags.toggle('feature_name')` or similar—ask developer)
3. Toggle a feature on/off
4. Refresh the page or wait for the UI to update
5. Verify the feature appears or disappears

**Expected Outcome:**

- ✅ Feature flag toggle works (if function exists)
- ✅ Feature appears when flag is ON
- ✅ Feature disappears or shows "not available" when flag is OFF
- ✅ No errors in console

**How to Record a Pass:**

- [ ] Screenshot of DevTools console with flag toggle command
- [ ] Screenshot showing feature with flag ON
- [ ] Screenshot showing feature with flag OFF
- [ ] Note: "Feature flag toggle works; feature visibility matches flag state"

---

### ⚡ Test 6: Premium Status Changes Reflected in Real-Time

**Scenario:** If an account is upgraded (or downgraded), verify the change is reflected without restarting

**Steps:**

1. Sign in as a **free user**
2. See a locked premium feature
3. (Developer action) Upgrade the account in the backend / admin panel
4. Wait 2-3 seconds or refresh the page
5. Check if the feature is now unlocked

**Expected Outcome:**

- ✅ Feature unlock is reflected without app restart (or minimal delay)
- ✅ Lock icon disappears
- ✅ Feature becomes usable

**How to Record a Pass:**

- [ ] Screenshot showing feature locked as free user
- [ ] Screenshot showing feature unlocked after upgrade
- [ ] Note: "Premium status change reflected in [X] seconds"

---

### ⚡ Test 7: Feature Flag & Premium Status Consistency Across Platforms

**Scenario:** Same feature behaves the same on web and app for the same user

**Steps:**

1. On **Web**: Premium user accesses a premium feature → should be unlocked
2. On **App**: Same premium user accesses the same feature → should be unlocked
3. On **Web**: Feature flag is ON
4. On **App**: Same feature should respect the same flag

**Expected Outcome:**

- ✅ Premium status is consistent (same on web and app)
- ✅ Feature flags are consistent (same on web and app)
- ✅ Both platforms show the same locks/unlocks

**How to Record a Pass:**

- [ ] Screenshot from web showing feature state
- [ ] Screenshot from app showing the same feature state
- [ ] Note: "Premium features consistent across web and app"

---

### ⚡ Test 8: Edge Case - Feature Flagged Off for Everyone

**Scenario:** A feature is behind a feature flag that is OFF; everyone (premium or free) cannot access it

**Steps:**

1. (Developer) Turn OFF a feature flag
2. Sign in as a **premium user**
3. Try to access the feature
4. Sign in as a **free user** and try to access the same feature

**Expected Outcome:**

- ✅ Feature is hidden/disabled for both (flag takes precedence)
- ✅ No lock icon for premium user (feature doesn't exist, not locked)
- ✅ Clear message or unavailable state
- ✅ Upgrade button doesn't appear (you can't upgrade to a feature that's turned off)

**How to Record a Pass:**

- [ ] Screenshot from premium user showing feature is unavailable (no lock, just gone)
- [ ] Screenshot from free user showing same unavailable state
- [ ] Note: "Flagged-off features hidden from all users (flag takes precedence over premium)"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Premium features may be tied to in-app purchases or subscription status
- Feature flags may not be toggleable in-app (ask developer)
- Premium status reflects account data from backend

### Web

- Feature flags may be toggleable via DevTools console
- Premium information may be visible in browser storage (encrypted)
- Payment flow typically redirects to payment provider website

---

## Troubleshooting

| Issue                                                  | Solution                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **See a lock icon but account should be premium**      | Verify the account is actually upgraded in the backend. Refresh the app. If still locked, that's a bug. |
| **Premium user sees upgrade button**                   | Refresh the page/app. If it persists, check account status in backend.                                  |
| **Feature flag toggle doesn't work**                   | Ask the developer if feature flags are exposed in console. May not be available in production.          |
| **Free and premium users see different free features** | This shouldn't happen. Check if a feature flag is ON/OFF. If not, that's a bug.                         |
| **Feature appears on web but not app (or vice versa)** | Feature flags or premium status may be inconsistent. Refresh both. If persists, report as bug.          |

---

## Success Criteria ✅

- ✅ Premium users can access premium features
- ✅ Free users see locks and upgrade prompts on premium features
- ✅ Free features work identically for both user types
- ✅ Upgrade button navigates to upgrade flow
- ✅ Feature flags toggle feature visibility correctly
- ✅ Premium status changes reflected without app restart
- ✅ Behavior consistent across web and app platforms
- ✅ Flagged-off features hidden from all users (flag takes precedence)
- ✅ No contradictory states (lock + upgrade on free features, or premium features unlocked when they shouldn't be)
