# Analytics Consent Gating — Test Guide

## Overview

- Purpose: Verify that analytics events and breadcrumbs are consistently gated by user consent according to the centralized rules in `lib/analytics/consent-gating.ts`.
- What we're testing: event → consent-category mapping, gate behavior at `dispatchEvent()` and `breadcrumbQueue.enqueue()`, unmapped-event defaults, and breadcrumb persistence behavior on consent changes.

## Environments

- App: Desktop and Mobile (Expo) — preferred for integration checks
- Web: for fast unit/manual verification

## Prerequisites

- Test accounts: one regular user (any) with ability to toggle analytics consent in app settings.
- Feature flags/config: `config/appsettings.*.json` should allow analytics features (or use dev config). By default `analytics.consent.defaultLevel` = `basic` in repo config.
- Setup steps:
  1. Start app in test mode (or run node test harness) with dev config.
  2. Ensure exporters are mocked (Sentry/exporter mocks) for manual verification so events don't go to production.

---

## How Analytics Consent Gating Works

- The code maps named events and breadcrumb categories to a consent category (`essential`, `performance`, `usage`).
- `getConsentCategoryForEvent()` looks up runtime overrides first, then the `DEFAULT_EVENT_CONSENT_MAPPING`.
- `shouldEmitEvent(category, consentLevel)` applies the 3-tier rules:
  - `essential`: always allowed
  - `performance`: allowed for `basic` and `full`
  - `usage`: allowed only for `full`
- `dispatchEvent()` and `breadcrumbQueue.enqueue()` call the gate before exporting or persisting.
- Unmapped events default to `essential` (fail-safe) and should log a warning.

---

## Test Cases

### ✓ Test 1: Mapping Sanity — Ensure mapping covers known events

**Scenario:** Confirm every event type used in code is present in the mapping (or intentionally unmapped).

**Steps:**
1. Open `lib/analytics/event-consent-mapping.ts` and `lib/analytics/consent-gating.ts`.
2. Grep the codebase for analytics event names (calls to `dispatchEvent`, `Analytics.track`, `breadcrumbQueue.enqueue`) and list event names.
3. Verify each name exists in `DEFAULT_EVENT_CONSENT_MAPPING` or is registered at runtime (via `registerEventConsentMapping`).

**Expected Outcome:**
- ✅ All production event names are explicitly mapped or intentionally documented as unmapped.

**How to Record a Pass:**
- [ ] A checklist or spreadsheet row marking each event mapped or explained.

---

### ✓ Test 2: Per-Event Gating — Validate gate behavior across consent levels (manual + automated)

**Scenario:** Verify which events are emitted for `none`, `basic`, and `full` consent.

**Steps (automated unit check):**
1. Run the unit tests for gating:

```bash
npx vitest __tests__/analytics/consent-gating.unit.test.ts --run
```

**Steps (manual integration):**
1. Start the app with exporter mocks (or run integration harness).
2. In app settings, set consent = `none`. Emit one example event for each category (`essential`, `performance`, `usage`).
3. Observe exporter mocks and logs — only `essential` events should arrive.
4. Repeat for consent = `basic` — `essential` + `performance` should arrive; `usage` should be dropped.
5. Repeat for consent = `full` — all events should arrive.

**Expected Outcome:**
- ✅ `none`: only `essential` reaches exporters
- ✅ `basic`: `essential` + `performance` reach exporters
- ✅ `full`: `essential` + `performance` + `usage` reach exporters

---

### ✗ Test 3: Unmapped Events — Safe default and warning

**Scenario:** An event name is not in mapping and should be treated safely.

**Steps:**
1. Emit an event with a random unique name (e.g., `qa_unmapped_event_12345`).
2. With consent = `basic`, verify `dispatchEvent()` allows it (default to `essential`) and that a developer warning was logged.

**Expected Outcome:**
- ✅ Event is emitted (safe default), and a warning appears in logs noting unmapped event.

---

### ✗ Test 4: Breadcrumb Gating & Persistence — Verify enqueue respects consent

**Scenario:** Breadcrumbs for `usage` categories should not be persisted when consent disallows them.

**Steps:**
1. Ensure exporter/provider mocks are installed and `breadcrumbQueue` is initialized.
2. Set consent = `none` in app settings.
3. Call `breadcrumbQueue.enqueue()` for several categories (`ui`, `http`, `error`).
4. Restart the app (or re-initialize `breadcrumbQueue`) and inspect persisted storage (`STORAGE_KEYS.BREADCRUMB_QUEUE`).

**Expected Outcome:**
- ✅ Breadcrumbs mapped to `usage` are dropped and not persisted when consent disallows them.
- ✅ `essential` breadcrumbs (errors) may still be persisted depending on mapping.

---

### ⚡ Test 5: Regression Events — Ensure performance regressions respect consent

**Scenario:** `regression_detected` or similar performance alerts should be categorized as `performance` and only sent for `basic`+ consent.

**Steps:**
1. Set consent = `none` and trigger a regression detection path (or simulate via service). Assert no export occurs.
2. Set consent = `basic` and repeat — assert export occurs.

**Expected Outcome:**
- ✅ Regression alerts are dropped at `none` and allowed at `basic` or `full`.

---

## Platform-Specific Notes

### App (Desktop/Mobile)
- Use exporter mocks to avoid sending events to production Sentry. Confirm persistence via `SecureStorage` keys.

### Web
- Use quick unit runs for mapping and gating checks; integration may use a local harness to mock exporters.

---

## Troubleshooting

| Issue | Solution |
| ---- | ---- |
| Events dropped unexpectedly | Confirm consent level used by test (in-memory vs persisted). Use `AnalyticsConsent.setLevel('full')` in test harness if needed. |
| No warning for unmapped events | Ensure logging for `analytics` category is enabled in test config or use console-level mocks. |

---

## Success Criteria ✅

- ✅ Unit tests for `consent-gating` pass.
- ✅ Manual verification shows only allowed categories reach exporters for each consent level.
- ✅ Breadcrumb persistence honors consent settings.

## Risk / Known Issues

- Breadcrumb queue previously persisted all categories; ensure `breadcrumbQueue.enqueue()` is wired to `shouldEmitEvent()` (it is in current branch).
- Debounced persistence means some tests may need a short wait or to stub `_persist()` for deterministic assertions.

## Related Files

- `lib/analytics/consent-gating.ts` — gate implementation
- `lib/analytics/event-consent-mapping.ts` — default mapping
- `lib/analytics/breadcrumb-queue.ts` — enqueue/persistence (gating applied)
- `lib/analytics/consent.ts` — `AnalyticsConsent` manager
- `__tests__/analytics/consent-gating.unit.test.ts` — unit tests
- `__tests__/analytics/breadcrumb-queue.unit.test.ts` — breadcrumb unit tests

## Reporting

- Preferred: open a GitHub issue referencing this guide and include: steps taken, consent level, exporter mock logs, and persisted storage snapshot.

## Quick checklist for maintainers

- [ ] Guide updated in `docs/A Testing Guide` (this file)
- [ ] Unit tests exist for `consent-gating` and `breadcrumb-queue`
- [ ] Exporter mocks used in integration/manual tests to avoid external telemetry
- [ ] Notified QA channel about the guide and any test-only helpers
