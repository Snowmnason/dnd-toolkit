# Analytics Consent Follow-Ups

Future UX and privacy-control work that remains after the current analytics consent and crash opt-in foundation.

## Current Status

The core system is already active.

- `hooks/analytics/use-analytics-consent.ts` manages persisted consent state.
- `AppScreens/settings/AppSettings.tsx` already exposes a consent control in settings.
- the current settings UI is a `Basic` versus `Full` switch.
- `components/SplashScreen/CrashFallBack.tsx` already uses `useCrashConsentReport()` and exposes opt-in crash-report actions when consent is `none`.

So the repo already supports persisted consent and privacy-first crash opt-in. The missing work is richer user-facing control, not basic infrastructure.

## What Is Still Missing

### Better Consent Selection UI

The current settings screen is still a two-state switch between `basic` and `full`.

That leaves a gap between the underlying consent model and the visible UI:

- the system supports `none`, `basic`, and `full`
- the current settings control only exposes `basic` and `full`

Future follow-up:

- replace the switch with a three-level selector
- explain what each level means in plain language
- keep accessibility and keyboard or screen-reader behavior in mind

### Better Consent Explanations

The current settings copy is brief.

Still missing:

- a clearer explanation of what `none`, `basic`, and `full` each allow
- a more explicit privacy explanation inside the settings flow
- optional deeper links to policy or help content

### Richer Crash Opt-In UX

Crash opt-in already exists in the crash fallback screen, but it is still a minimal action flow.

Possible future improvements:

- dedicated crash-report consent modal copy
- user education around what is sent and what is not

## Analytics Debug Panel (Infrastructure Introspection)

**Status**: Code written but not connected to any screen. Intended for future admin/debug UI.

**What exists**: `hooks/analytics/use-analytics-status.ts` contains two hooks and one helper for inspecting internal analytics state:

- `useAnalyticsBufferStatus()` — React hook that subscribes to real-time event queue status
  - Returns: queue size, flushing status, event types queued, oldest event age, max queue size
  - Implementation: Uses event subscription (reactive, no polling)
  - Purpose: Display pending analytics events in a debug panel
  - Example output: `{ queueSize: 20, isFlushing: false, lastFlushTime: 1234567890, queuedEventTypes: ['pageview', 'error'], maxSize: 100, oldestEventAge: 5000 }`

- `useBreadcrumbQueueStatus()` — React hook for breadcrumb queue state
  - Returns: queue size, oldest breadcrumb time, overflow count, provider name, flushing status
  - Implementation: Polls every 2 seconds (breadcrumb queue doesn't emit events)
  - Purpose: Display pending breadcrumbs alongside event queue
  - Example output: `{ queueSize: 15, oldestBreadcrumbTime: 1234567890, overflowCount: 3, providerName: 'Sentry', isFlushing: false }`

- `getBreadcrumbQueueStatus()` — Synchronous helper (not a hook) for programmatic access
  - Use in logging or conditional logic where hook overhead isn't needed
  - Example: `logger.debug('Queue state:', getBreadcrumbQueueStatus())`

**Why not connected yet**: 
- No admin screen or debug panel built yet to display this data
- Code is scaffolded but incomplete (breadcrumb hook has missing import)
- Infrastructure introspection is nice-to-have, not core app functionality

**To use later**:
1. Create a debug/admin screen component (e.g., `AppScreens/admin/AnalyticsDebug.tsx`)
2. Import `useAnalyticsBufferStatus()` and `useBreadcrumbQueueStatus()`
3. Render queue stats alongside buttons to trigger manual flushes or clear queue
4. Fix missing `breadcrumbQueue` import in the hook (or move breadcrumb stats to a cleaner source)

**Related infrastructure**: `lib/analytics/exporters/analytics-buffer.ts` (active — manages event queue) and `lib/analytics/exporters/analytics-network-integration.ts` (active — flushes queue on network changes)
- optional remembered preference for future crash-report prompts

### Audit And Debug Visibility

The consent system works, but there is no user-facing audit trail or richer debug surface for consent changes.

Potential future value:

- visible history of consent changes
- consent-decision audit logging for support or compliance review
- better visibility into which categories are dropped versus emitted

### Granular Or Time-Limited Consent

The current model is intentionally simple.

Still deferred:

- category-level consent controls
- temporary or time-limited consent
- exporter-specific or destination-specific sharing controls

These are not foundational blockers, but they are the clearest direction if the consent model needs to grow.

## Example Future Settings Shape

```text
Analytics Consent
  None   — no analytics sending by default
  Basic  — errors and essential performance only
  Full   — usage analytics and richer metrics

[Learn what each level includes]
```

## Priority

Medium.

The highest-value near-term follow-up is the settings UI gap: the code supports three levels, but the settings screen currently presents only two.