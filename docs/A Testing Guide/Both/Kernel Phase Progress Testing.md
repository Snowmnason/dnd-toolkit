# Kernel Phase Progress — Test Guide

## Overview

- **Purpose:** Verify the Kernel phase progress UX and underlying logic during app bootstrap: themed phase messages, progress percent calculation, and minimum display timing.
- **What we're testing:** message mapping, progress percentage math, min-display enforcement, provider wiring, and visual acceptance (splash visibility and progress bar behavior).

## Environments

- Web
- App (iOS / Android emulators)

## Prerequisites

- **Test accounts:** standard test user account (no special permissions required).
- **Test data:** a connected world or account that exercises normal bootstrap flows.
- **Setup steps:**
  1. Start the app (web or emulator).
  2. For visual checks on web, open DevTools and enable network throttling (Slow 3G).

---

## How Kernel Phase Progress Works

Brief explanation for QA testers (non-technical):

- The app initializes through ordered kernel phases (fonts, network, session, etc.). Each phase can publish a themed message and advance a progress indicator. The LoadingBlocker (splash) is displayed while key phases run and must remain visible for a configured minimum duration to avoid flashing.

---

## Test Cases

### ✓ Test 1: Phase messages — Positive scenario

**Scenario:** Verify each kernel phase has at least one themed message and a message is visible during bootstrap.

**Steps:**
1. Start the app with a test account.
2. Observe the splash/loading area during bootstrap.
3. (Unit) Call `getPhaseMessage(phase)` and confirm the return value exists in `PHASE_MESSAGES[phase]`.

**Expected Outcome:**
- ✅ Each phase key maps to a non-empty array of messages.
- ✅ The UI shows a readable themed message while the corresponding phase runs.

**How to Record a Pass:**
- [ ] Screenshot of splash showing a themed message.
- [ ] Short note indicating which phase message appeared.

**How to Record a Fail:**
- [ ] Screenshot showing no message or an empty message.
- [ ] Note: "Missing or blank phase message".

---

### ✗ Test 2: Progress math — Edge & negative cases

**Scenario:** Ensure progress percentage calculation clamps and handles edge indices.

**Steps:**
1. Run unit tests for `calculateProgressPercent(index, total)`.
2. Assert behavior for: negative index, index == 0, index == total - 1, index >= total.

**Expected Outcome:**
- ✅ Results are clamped to 0..100.
- ✅ Negative indices return 0; indices >= total return 100.

**How to Record a Pass:**
- [ ] Unit test output shows all assertions passing.

**How to Record a Fail:**
- [ ] Test output with failing assertions and stack traces.

---

### ⚡ Test 3: Min-display enforcement — Visual timing

**Scenario:** Verify LoadingBlocker respects the configured minimum display time to avoid flashing.

**Steps:**
1. Unit/integration: use fake timers and call `enforceMinDisplayDelay(actualMs, minMs)` to assert delay values.
2. Manual/E2E: run the app with a very fast bootstrap (no throttling) and confirm the splash does not flash briefly.

**Expected Outcome:**
- ✅ When actualMs < minMs the function returns a positive ms delay.
- ✅ In UI, the blocker remains visible for at least minMs even if phases complete sooner.

**How to Record a Pass:**
- [ ] Unit/integration assertions pass.
- [ ] Short screencast or screenshots showing blocker visible for the expected duration.

---

## Platform-Specific Notes

### App (Desktop/Mobile)

- Use emulator network controls to simulate slow networks and capture video when possible.

### Web

- Use browser DevTools for network throttling and console log capture.

---

## Troubleshooting

| Issue | Solution |
| ---- | -------- |
| LoadingBlocker never appears | Ensure `AppKernelProvider` is mounted and kernel phases are starting; check console for provider initialization errors. |
| Message is blank | Confirm `PHASE_MESSAGES` contains entries and `getPhaseMessage()` has a fallback. |
| Progress percent not updating | Verify kernel emits phase-complete events and that tests use the kernel mock helper to trigger listeners. |

---

## Success Criteria ✅

- ✅ Unit tests for message mapping and progress math pass.
- ✅ Integration tests (wiring) show LoadingBlocker mounts and progress attributes update on phase triggers.
- ✅ Manual visual checks show the blocker respects min-display timing and messages are readable with no console errors.

## Related Files

- `hooks/kernel/use-app-kernel.tsx`
- `components/LoadingBlocker.tsx`
- `contexts/LoadingContext.tsx`
- `lib/localization/phase-messages.ts`
- `lib/kernel/phase-progress-utils.ts`

## Reporting

- Preferred reporting flow: open a GitHub issue with steps, expected vs actual, screenshots, and console logs.
- Required fields: platform, network throttling, screenshots, test logs, reproduction steps.

## Quick checklist for maintainers

- [ ] Title includes platform (App/Web/Both)
- [ ] Overview is 1–2 sentences understandable by QA
- [ ] At least 3 test cases (positive, negative, edge)
- [ ] Each test case includes clear expected outcomes and pass/fail recording guidance
