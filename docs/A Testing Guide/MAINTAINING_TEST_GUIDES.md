# Maintaining Test Guides

Purpose: Explain when and how to add or update test guides so QA docs stay accurate as the codebase changes.

## When to create or update a guide

- Add a new test guide when you add a public hook, a new `lib/` API surface, or any feature that affects app behavior testers will interact with (navigation, auth, storage, caching, rate-limiting).
- Update an existing guide when you change URLs, params, API responses, storage schemas, or feature flags that affect user-visible behavior.

## File location

- Place guides in `docs/A Testing Guide`.
- Name guides with the feature/hook name, e.g. `auth-guard.md`, `navigation.md`, `request-manager.md`.

## Required structure (template)

Each guide must use this structure and headings exactly (H1 + `##` sections and `###` for test cases):

# <Feature / Hook Name> — Test Guide

## Overview

- Purpose: one-line description
- Scope: files and behaviors covered

## Environments

- Web (desktop)
- Desktop app (Electron)

## Prerequisites

- Test accounts, admin flags, world IDs, feature flags
- Base URL(s) to use

## Test Data

- Test user(s) and roles
- World IDs and payloads

## Test Cases

### Test Case — Descriptive name

- Goal: one-line expected behavior
- Steps:
  1. Step-by-step actions (non-dev friendly)
  2. ...
- Expected result:
  - Exact URL or UI text
  - API outcome if applicable
- Pass / Fail: [ ] Pass [ ] Fail
- Evidence:
  - Screenshot: (attach or paste link)
  - Console logs: (paste area)
  - Notes / edge cases

(repeat `###` blocks for each test)

## Scripts (if applicable)

- Purpose: brief statement of what the script validates (performance, correctness, error-handling, timeouts, etc.).
- Execution constraints: admin-only (Supabase flag) when required; indicate where to run (desktop app terminal, web dev console, CI job) and any required environment variables or test accounts.
- Observability / Logs: specify which logs to capture (renderer console, server logs, request IDs, timestamps). Instruct testers to paste full logs (or a trimmed excerpt with timestamps) into the report and remove any secrets.

Recommended script specs (create one spec per script; do not commit runnable scripts yet):

### Passing script — expected to pass

- Purpose: Validate nominal behavior for the happy path.
- Inputs: precise parameters, test user/world IDs, payload sizes, concurrency level.
- Duration / timing: expected runtime and acceptable variance.
- Expected logs/output: list of success messages, HTTP status codes, metrics (e.g., latency < X ms).
- Pass criteria: how the tester decides this script passed (exact messages, absence of errors).
- Evidence: paste console logs, success metrics, and a screenshot of the UI if applicable.

### Failing script — expected to fail gracefully

- Purpose: Force a known error path to confirm graceful handling (validation errors, auth failure, quota exceeded).
- Inputs: parameters that trigger the error (bad token, malformed payload, permissionless user).
- Expected error/logs: exact error text or status codes to look for and any UI error messages or fallback screens.
- Pass criteria: the system fails in the documented way (clear error, no crash, no sensitive data leak).
- Evidence: paste error logs and screenshots.

### Realistic simulation script — end-to-end behavior

- Purpose: Simulate a real event sequence (user actions/events that occur in production) to validate end-to-end flow.
- Inputs: ordered sequence of API calls or UI actions, realistic timings between calls, and any background tasks expected to run.
- Expected outcome: final state, intermediate state transitions, and logs showing the sequence executed correctly.
- Pass criteria: final state matches expected, no unexpected retries, and observability shows correct sequencing.

### Chaos / Edge-case script — interruptions & timing violations

- Purpose: Test resilience to interruptions (pause mid-execution, network drop, longer-than-allowed duration).
- Examples to spec:
  - A task intended to run for 5s is extended to 6s — expect graceful timeout or safe rollback.
  - Pause/resume mid-function (simulate thread/process pause) — expect consistent state or safe retry.
  - Sudden network disconnect during critical request — expect retry policy or user-facing error.
- Expected logs: timeouts, retries, rollback messages, or clear error markers.
- Pass criteria: no data corruption, sensible error message, and recoverable state.

## How to write a script spec

- Give the script a clear name and short description.
- Provide exact inputs, environment, and the command or pseudo-command to run (if applicable).
- Provide sample log lines that demonstrate expected success or failure so testers know what to look for.
- Mark whether the script is destructive and include safety checks (run only in staging or with test accounts).

## Console-log capture guidance

- Capture full console output with timestamps where possible. If large, trim to the relevant range but keep timestamps.
- Remove secrets (API keys, tokens) before pasting logs into reports.
- Paste logs in the issue body or attach as `.log` file; include the test script name and environment.

## Quick checklist for script specs

- [ ] Specified purpose and execution constraints
- [ ] Provided exact inputs and environment
- [ ] Included pass/fail criteria and sample log lines
- [ ] Marked destructive scripts and safety notes

## Risk / Known Issues

- Notes about likely failure modes and root-cause hints

## Related Files

- `hooks/<name>.tsx`
- `lib/...` (list related files)

## Quick hook → lib mapping (snapshot)

This mapping is a short, temporary reference to help authors and QA know which `lib/` areas a hook exercises. Update or remove as the codebase evolves — this is intentionally a snapshot.

- `use-analytics-navigation.tsx` → `lib/analytics`
- `use-feature-flag.ts` → `lib/feature-flags`
- `use-premium-feature.ts` → `lib/analytics`, `lib/premium`, `lib/utils/logger`
- `use-render-tracker.tsx` → `lib/config`
- `use-splash-screen.tsx` → `lib/feature-flags`, `lib/kernel`, `lib/utils/logger`
- `use-users-query.tsx` → `lib/cache`, `lib/database/users`
- `use-users-mutation.tsx` → `lib/database/users`, `lib/cache`, `lib/utils/logger`

UI-only / local hooks (minimal testing required):

- `use-auth-context.tsx`, `use-image-cache.tsx`, `use-notifications.tsx`, `use-panel-navigation.tsx`, `use-viewport-tracking.tsx`, `useScale.ts`, `useThemeSwitcher.ts`

If a `lib/` folder is not listed above (for example `lib/offline`, `lib/network`, `lib/storage`, `lib/api`), create a short guide describing how to exercise it directly (scripts or targeted UI flows), since it may not be reachable via hooks alone.

## Reporting

- Preferred reporting flow: open a GitHub issue, or add to the QA spreadsheet (manager choice)
- Required report fields: steps, expected, actual, screenshots, console logs, environment

## Quick checklist for maintainers

- [ ] Created/updated test guide in `docs/A Testing Guide`
- [ ] Added `Scripts` section if feature introduces scriptable behavior
- [ ] Credited required test accounts and feature flags
- [ ] Notified QA channel (Slack/Teams) about new/updated guide

---

If you want, I can now:

- Add the template as a starter file `docs/A Testing Guide/TEMPLATE.md`, or
- Begin drafting specific guides (auth-guard, navigation, worlds).
