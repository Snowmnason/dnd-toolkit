# <Feature / Screen Name> — Test Guide

## Overview

- **Purpose:** One-line description of what users will do (e.g., "Create a new world and verify it appears in the world list")
- **What we're testing:** [Feature name], [behavior], [error handling]

## Environments

- App (Desktop / Mobile / Both)
- Web
- Both

## Prerequisites

- **Test accounts:** Free account, Premium account (if testing premium)
- **Test data:** Any worlds, characters, or other setup needed
- **Setup steps:** Clear instructions if device needs to be in a certain state

---

## How [Feature] Works

Brief explanation for QA testers (not developers):

- What the feature does
- What outcomes to expect
- Any limitations or known behaviors

---

## Test Cases

### ✓ Test 1: [Feature Name] — [Positive Scenario]

**Scenario:** [Describe the user's goal]

**Steps:**

1. Clear action steps (non-technical, user-facing language)
2. "Click the [Button Name] button"
3. "Enter [data] into the [Field Name]"
4. Wait for response

**Expected Outcome:**

- ✅ [Expected result 1]
- ✅ [Expected result 2]
- ✅ [Expected result 3]

**How to Record a Pass:**

- [ ] Screenshot showing the successful outcome
- [ ] Note: "[Brief description of what worked]"

**How to Record a Fail:**

- [ ] Screenshot showing the error or unexpected behavior
- [ ] Note: "[What went wrong]"

---

### ✗ Test 2: [Feature Name] — [Negative Scenario]

**Scenario:** [Describe what should be blocked or rejected]

**Steps:**

1. Action steps to trigger the error condition
2. ...

**Expected Outcome:**

- ✅ Clear error message appears
- ✅ User is prevented from proceeding
- ✅ No data corruption or silent failures

**How to Record a Pass:**

- [ ] Screenshot of error message or blocked action
- [ ] Note: "[Error handled correctly]"

**How to Record a Fail:**

- [ ] Screenshot if error isn't clear
- [ ] Note: "[What went wrong]"

---

### ⚡ Test 3: [Feature Name] — [Edge Case]

**Scenario:** [Less common but important scenario]

**Steps:**

1. ...

**Expected Outcome:**

- ✅ ...

---

## Platform-Specific Notes

### App (Desktop/Mobile):

- [Any platform-specific behavior]

### Web:

- [Any web-specific behavior]

---

## Troubleshooting

| Issue            | Solution     |
| ---------------- | ------------ |
| "[Common issue]" | "[Solution]" |

---

## Success Criteria ✅

All tests pass when:

- ✅ [Criterion 1]
- ✅ [Criterion 2]
- ✅ [Criterion 3]
- Failing script — expected to fail gracefully
- Realistic simulation script — end-to-end behavior
- Chaos / Edge-case script — interruptions & timing violations

## Risk / Known Issues

- Notes about likely failure modes and root-cause hints

## Related Files

- `hooks/<name>.tsx`
- `lib/...` (list related files)

## Reporting

- Preferred reporting flow: open a GitHub issue, or add to the QA spreadsheet (manager choice)
- Required report fields: steps, expected, actual, screenshots, console logs, environment

## Quick checklist for maintainers

- [ ] Created/updated test guide in `docs/A Testing Guide`
- [ ] Added `Scripts` section if feature introduces scriptable behavior
- [ ] Credited required test accounts and feature flags
- [ ] Notified QA channel (Slack/Teams) about new/updated guide
