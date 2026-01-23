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

### Recommended script specs (create one spec per script; do not commit runnable scripts yet):

- Passing script — expected to pass
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
