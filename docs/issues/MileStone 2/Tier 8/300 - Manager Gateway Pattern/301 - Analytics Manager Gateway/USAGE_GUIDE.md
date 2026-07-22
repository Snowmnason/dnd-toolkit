# Analytics Manager Gateway

This issue establishes the single analytics entry point for event tracking, consent gating, and domain-specific telemetry. Public callers now use `managers/analytics/analytics-manager.ts`; lower-level analytics internals remain in `lib/analytics/`.

## Overview

The manager gateway keeps analytics emission in one place and pushes consent checks through the shared analytics state. UI hooks still handle consent and queue visibility, while system and domain code call the manager when they need to emit events.

## How It Fits Together

- Use `Analytics` from `managers/analytics/analytics-manager.ts` for public tracking, identification, and component usage events.
- Use `FeatureAnalytics`, `VariantAnalytics`, and `NavigationManager` for domain-specific analytics flows that sit on top of the core gateway.
- Keep consent reads on `currentConsentLevel` for hot-path checks, and let `AnalyticsConsent` manage persistence and synchronization.
- Leave analytics buffer, breadcrumb queue, and exporter plumbing in `lib/analytics/`.

## Basic Usage

- Import analytics emission code from `managers/analytics/analytics-manager.ts` instead of `lib/analytics`.
- Use `useAnalyticsConsent()` and related hooks from `hooks/analytics/` when a screen needs consent state or queue visibility.
- Keep request/bootstrap instrumentation on the manager gateway so system code does not import analytics internals directly.

## Related Files

- `managers/analytics/analytics-manager.ts`
- `managers/analytics/analytics-helpers.ts`
- `managers/analytics/feature-analytics-manager.ts`
- `managers/navigation/navigationManager.ts`
- `lib/analytics/consent/consent.ts`
- `type-definitions/analytics-types.ts`
- `hooks/analytics/README.md`
- `system/API/README.md`
- `system/Kernel/README.md`

## Troubleshooting

- If events stop reaching Sentry, confirm the Sentry adapter is registered during service initialization.
- If consent reads look stale, verify `AnalyticsConsent.initialize()` ran before the first emission and that `currentConsentLevel` was updated.
- If a consumer still imports `@/lib/analytics/analytics-manager`, update it to `@/managers/analytics/analytics-manager` and remove the old import.