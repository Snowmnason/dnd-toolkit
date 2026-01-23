# Analytics & RenderTracker — Test Guide

## Overview

- Purpose: Verify analytics instrumentation and render/performance tracking behavior (Sentry + internal performance marks).
- Scope: `lib/analytics/index.ts`, `hooks/use-render-tracker.tsx`, `lib/analytics/session.ts`.

## Environments

- Web (desktop) — for Sentry DSN testing in debug/staging builds
- Desktop app (Electron) / Mobile app — Sentry may be enabled depending on environment variables

## Prerequisites

- Staging environment with `EXPO_PUBLIC_SENTRY_DSN` configured (or feature flag `sentryEnabled`) for tests that require Sentry.
- Test user(s) and permission to view analytics breadcrumbs in Sentry (or logs exported by engineering).

## Test Data

- Test user IDs

## Test Cases

### Test Case — Analytics enabled/disabled

- Goal: Analytics respects feature flag and DSN availability.
- Steps:
  1.  With sentry disabled in config, perform an action that triggers `Analytics.track` (e.g., open a screen).
  2.  Enable `sentryEnabled` in staging build and repeat the action.
- Expected result:
  - With disabled config, no breadcrumbs sent; with enabled and DSN present, breadcrumbs appear in Sentry (or are logged locally).
- Evidence: Sentry breadcrumb list or log excerpt.

### Test Case — Render tracker behavior

- Goal: Verify `useRenderTracker` increments render counts when `devTools.enablePerformanceLogger` is on (dev-only).
- Steps:
  1.  Enable `devTools.enablePerformanceLogger` in staging config.
  2.  Open a busy component that uses `useRenderTracker` and interact to cause re-renders.
- Expected result:
  - Render counts are logged to the console (web) or to development log output.
- Evidence: Console log excerpt or debug log file.

### Test Case — Performance measurements

- Goal: Verify `Performance` marks produce breadcrumbs and warnings for slow screens.
- Steps:
  1.  Trigger a measured screen load that intentionally takes longer than `slowScreenMs` threshold (test-only instrumentation).
  2.  Observe logs and Sentry breadcrumbs if enabled.
- Expected result:
  - A performance breadcrumb is created and a `performance` warning is logged.
- Evidence: Sentry breadcrumb, logger entry.

## Scripts / Test Helpers

- For Sentry verification: run staging build with `EXPO_PUBLIC_SENTRY_DSN` and reproduce flows; view breadcrumbs in Sentry under the test release.
- For render-tracker: enable the devTools flag in `appsettings.staging.json` or local `appsettings.*` and reproduce.

## Risk / Known Issues

- Analytics may redact sensitive fields; tests should not rely on raw error messages.

## Related Files

- `lib/analytics/index.ts`
- `hooks/use-render-tracker.tsx`
- `lib/analytics/session.ts`
