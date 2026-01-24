# Analytics Tracking — Test Guide

## Overview

- **Purpose:** Verify that user actions are tracked correctly for analytics and are not over/under-counted
- **What we're testing:** Event logging, event accuracy, no duplicate events, event consistency across platforms, analytics does not impact app performance

## Environments

- App (Desktop & Mobile)
- Web
- All platforms

## Prerequisites

- **Test accounts:** One active account
- **Test data:** Load a world with some content
- **Tools needed:**
  - Browser DevTools (web only; can view network requests and console logs)
  - App logs (may need developer help to access)
  - Access to analytics dashboard (if available) or backend logging

## How Analytics Tracking Works

Analytics track user actions (sign-in, world creation, character edit, page view, etc.) to understand how users interact with the app. Events should be:

1. Sent to an analytics server
2. Not duplicated (one action = one event)
3. Accurate (correct event name, properties, timestamps)
4. Not blocking (analytics failures shouldn't break the app)

Why this matters: Bad analytics misrepresents user behavior, leading to wrong product decisions. Duplicate events corrupt data.

## Test Cases

### ✓ Test 1: Analytics Event Fired on User Action

**Scenario:** Perform an action and verify an event is sent to analytics

**Steps:**

1. Open the app and sign in (if not already)
2. Load a world
3. Perform an action (e.g., open a character, create a note, navigate to settings)
4. (Web only) Open DevTools → Network tab
5. (Web only) Filter for "analytics" or "mixpanel" or "segment" (depending on provider)
6. Look for a network request to an analytics service
7. (App) Ask the developer how to view analytics logs in the app

**Expected Outcome:**

- ✅ Event is sent to analytics service (network request visible on web)
- ✅ Event includes:
  - Action name (e.g., "character_opened", "note_created")
  - Timestamp
  - User ID
  - World ID (if applicable)
- ✅ No error in sending the event

**How to Record a Pass:**

- [ ] Screenshot of DevTools Network tab showing the analytics request (web)
- [ ] Screenshot showing event details (expand the request to see payload)
- [ ] Note: "Analytics event fired for [action]: [event name]"

---

### ✓ Test 2: Event Not Duplicated

**Scenario:** Perform an action once and verify only one event is sent

**Steps:**

1. (Web) Open DevTools → Network tab, clear the log
2. Perform one action (e.g., click a button, navigate to a page)
3. Count how many analytics requests appear
4. Note the count

**Expected Outcome:**

- ✅ Exactly 1 event is sent (or expected number if the action triggers multiple events)
- ✅ No duplicate events for the same action
- ✅ If multiple events are sent, each should be for a different action (e.g., page_view + button_click)

**How to Record a Pass:**

- [ ] Screenshot of DevTools showing 1 event (or documented expected count)
- [ ] Note: "Single action triggered 1 event (no duplicates)"

---

### ✓ Test 3: Multiple Actions Generate Multiple Events

**Scenario:** Perform 5 different actions and verify 5 events are sent

**Steps:**

1. (Web) Clear DevTools Network log
2. Perform action 1 (e.g., navigate to world settings)
3. Perform action 2 (e.g., edit world name)
4. Perform action 3 (e.g., close settings)
5. Perform action 4 (e.g., navigate to character list)
6. Perform action 5 (e.g., open a character)
7. Count analytics events

**Expected Outcome:**

- ✅ 5 events are sent (or similar count depending on which actions are tracked)
- ✅ Each event corresponds to the action taken
- ✅ Events appear in order (action 1 first, action 5 last)

**How to Record a Pass:**

- [ ] Screenshot of DevTools showing 5 events with names
- [ ] Note: "5 actions generated 5 events; no gaps or duplicates"

---

### ✓ Test 4: Event Payload Contains Required Fields

**Scenario:** Examine an event to ensure it contains all required data

**Steps:**

1. Perform an action
2. (Web) DevTools → Network → analytics request → Preview or Response tab
3. View the JSON payload sent to analytics
4. Check for fields like:
   - Event name / type
   - User ID
   - Timestamp
   - World ID (if in a world)
   - User role / premium status (if tracked)

**Expected Outcome:**

- ✅ Event contains identifying information:
  - Event name is descriptive (e.g., "character_created", not "action")
  - User ID is present (not empty or null)
  - Timestamp is recent (close to when you performed the action)
- ✅ No obvious missing fields (e.g., user_id should not be empty)

**How to Record a Pass:**

- [ ] Screenshot of the event JSON payload
- [ ] Note: "Event payload complete: contains name, user_id, timestamp, world_id"

---

### ✓ Test 5: Analytics Works Across Platforms

**Scenario:** Perform the same action on web and app; verify both send events

**Steps:**

1. On **Web**: Perform an action (e.g., navigate to characters)
2. (Web) DevTools shows the event sent
3. On **App**: Perform the same action
4. (App) Check if an event is logged (ask developer how to view)
5. Compare: both platforms should send similar events

**Expected Outcome:**

- ✅ Both platforms send analytics events
- ✅ Event names are the same (or consistent) across platforms
- ✅ Event data is similar (user_id, timestamp, action)

**How to Record a Pass:**

- [ ] Screenshot of web analytics event
- [ ] Screenshot of app analytics (or developer log confirmation)
- [ ] Note: "Analytics events sent on both web and app platforms"

---

### ⚡ Test 6: Analytics Does Not Block App

**Scenario:** Verify that analytics failures don't crash or freeze the app

**Steps:**

1. Perform an action normally
2. (Web) Simulate network failure for analytics:
   - DevTools → Network → Throttle (make analytics request fail)
   - Or block analytics domain in DevTools
3. Perform another action
4. App should still work normally

**Expected Outcome:**

- ✅ Action completes successfully even if analytics fails
- ✅ App does not crash or freeze
- ✅ No error message to user (analytics failures are silent)
- ✅ UI remains responsive

**How to Record a Pass:**

- [ ] Screenshot showing action completed despite analytics failure
- [ ] Note: "Analytics failure did not block app or user action"

---

### ⚡ Test 7: Event Timestamps Are Accurate

**Scenario:** Check that event timestamps match when actions were performed

**Steps:**

1. Note the current time
2. Perform an action
3. (Web) View the analytics event in DevTools
4. Check the timestamp in the event payload
5. Compare to actual time

**Expected Outcome:**

- ✅ Event timestamp is close to when you performed the action (within 1-2 seconds)
- ✅ Timestamps are in a valid format (ISO 8601 or Unix timestamp)
- ✅ Not old timestamps (not from hours/days ago)

**How to Record a Pass:**

- [ ] Screenshot of event timestamp
- [ ] Note: "Event timestamp accurate; matches action time within 1 second"

---

### ⚡ Test 8: Analytics on Offline Mode

**Scenario:** Perform actions while offline; verify they're queued or handled gracefully

**Steps:**

1. Disable network (airplane mode)
2. Perform an action (navigation, edit, etc.)
3. Re-enable network
4. Check if the offline action's event was sent

**Expected Outcome:**

- ✅ One of these occurs:
  - Event is queued and sent when reconnected
  - Event is dropped silently (acceptable for non-critical tracking)
  - App explicitly tells the user ("Analytics queued; will sync when online")
- ✅ No error or crash

**How to Record a Pass:**

- [ ] Screenshot showing offline action completed
- [ ] Screenshot showing event sent after reconnecting (if queued)
- [ ] Note: "Offline analytics: [queued / dropped]"

---

### ⚡ Test 9: No Sensitive Data in Events

**Scenario:** Verify that events don't contain passwords, API keys, or sensitive information

**Steps:**

1. Perform an action that involves sensitive data (e.g., sign-in, password change)
2. (Web) DevTools → Network → View the analytics event payload
3. Search the payload for:
   - Passwords (should NOT be there)
   - API keys (should NOT be there)
   - Email addresses (should be hashed or absent, not plain)
   - Personal details (names, addresses, etc.—should be absent or hashed)

**Expected Outcome:**

- ✅ No passwords or API keys in events
- ✅ Personally identifiable information is absent or hashed (not plain text)
- ✅ Event is safe to store and share with analytics team

**How to Record a Pass:**

- [ ] Screenshot of analytics event payload
- [ ] Note: "No sensitive data in analytics events"

---

## Platform-Specific Notes

### App (Electron / Mobile)

- Analytics logs may not be visible in UI; ask developer for app logs
- Analytics may be sent via background job (may not be instant)
- No browser DevTools, so rely on developer tools or logs

### Web

- Analytics easily visible in DevTools Network tab
- Can simulate network failures or throttling to test resilience
- Events can be viewed in real-time

---

## Troubleshooting

| Issue                                           | Solution                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Don't see any analytics events**              | Verify analytics is enabled (may be feature-flagged). Ask the developer if analytics is active in this environment. |
| **Analytics events are sending but look wrong** | Document the incorrect field and show the developer.                                                                |
| **Duplicate events appearing**                  | Note which action caused duplicates. This is a bug—report it with reproduction steps.                               |
| **Analytics request is failing**                | Check DevTools Network tab for error status codes. If analytics endpoint is down, ask the developer.                |
| **Can't access analytics dashboard**            | Ask the developer how to view analytics data (may require special access).                                          |
| **Timestamp seems very wrong**                  | Check system time (may be set incorrectly). Verify analytics server time matches.                                   |

---

## Success Criteria ✅

- ✅ Analytics events are sent for user actions
- ✅ No duplicate events for the same action
- ✅ Multiple actions generate multiple events (correct count)
- ✅ Event payloads contain required fields (name, user_id, timestamp)
- ✅ Event timestamps are accurate
- ✅ Analytics works consistently across web and app
- ✅ Analytics failures don't block the app
- ✅ Offline actions are handled gracefully (queued or dropped)
- ✅ No sensitive data in event payloads
- ✅ Events are meaningful and can be used to understand user behavior
