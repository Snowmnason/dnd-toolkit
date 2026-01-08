# Analytics & Performance Monitoring

Purpose: add lightweight, low-cost instrumentation for navigation, API timing, and feature gating, while remaining a no-op unless explicitly enabled.

## What We Implemented
- Central analytics wrapper powered by Sentry (breadcrumbs only) that no-ops when disabled.
- Coarse screen view + screen load timing based on Expo Router segments.
- API request durations and slow-request warnings in the centralized Request Manager.
- Feature-gate telemetry for premium blocks; helper for general feature-block events.

## How It Works
- Wrapper and helpers live in [lib/analytics/index.ts](lib/analytics/index.ts):
  - `Analytics.track(event, props)`: Sends a Sentry info-level message with optional context. No-ops if disabled.
  - `Analytics.identify(user)`: Associates `id/username` with Sentry user context.
  - `Analytics.withTiming(label, fn, warnMs?)`: Measures async/sync operations, warns if slow.
  - `Performance.startMeasure()/endMeasure()`: Manual timing markers.
  - `Performance.useScreenLoadTime(screenName)`: React hook to time a screen’s mount → unmount.
  - `trackFeatureBlocked({ feature, reason, userId? })`: Standardized event when a feature is blocked.
  - `Analytics.trackComponentUsage({ component, action, detail? })`: Log component-level usage (e.g., inputs, sliders, feature-specific UI) for future UX analysis.
- Enablement is gated by BOTH of the following:
  - `config/appsettings.*.json` → `features.performanceMonitoring === true`.
  - Presence of a DSN via `EXPO_PUBLIC_SENTRY_DSN` or `app.json` `extra.sentryDsn`.
- When disabled, calls return immediately without side effects or network traffic.

## Where It’s Wired In
- Navigation analytics: [hooks/use-analytics-navigation.tsx](hooks/use-analytics-navigation.tsx) and integrated in [app/_layout.tsx](app/_layout.tsx)
  - Emits `screen_view` and measures coarse time on route.
  - Also identifies the user when `userId` is known (dynamic import to avoid cycles).
- API timings: [lib/api/request-manager.ts](lib/api/request-manager.ts)
  - Emits `api_request` with `{ key, ok, duration_ms }` and warns on slow (>3s).
- Premium gate telemetry: [hooks/use-premium-feature.ts](hooks/use-premium-feature.ts)
  - One-time `feature_blocked` when access is denied due to premium requirement.
- Barrel export for app-wide access: [lib/index.ts](lib/index.ts)

## Why Sentry (and Cost Control)
- We already vendor Sentry and initialize it conditionally in [app/_layout.tsx](app/_layout.tsx).
- We emit info-level messages for analytics events. Without a DSN or with performanceMonitoring disabled, nothing is sent.
- No traces/transactions are enabled by default; you can keep prod cost at zero by leaving the DSN unset or the flag off.
- This meets the requirement to “add and expect nothing from it” until explicitly enabled.

## Usage Examples
- Track a custom event:
  ```ts
  import { Analytics } from '@/lib';
  Analytics.track('clicked_generate_character', { variant: 'quick' });
  ```
- Time an operation:
  ```ts
  const result = await Analytics.withTiming('build_character_sheet', () => buildSheetAsync());
  ```
- Measure a screen load:
  ```ts
  import { Performance } from '@/lib';
  Performance.useScreenLoadTime('CharactersScreen');
  ```
- Feature block (flag/premium/beta):
  ```ts
  import { trackFeatureBlocked } from '@/lib';
  trackFeatureBlocked({ feature: 'campaigns', reason: 'flag_disabled', userId });
  ```
- Component usage:
  ```ts
  import { Analytics } from '@/lib';
  Analytics.trackComponentUsage({ component: 'WeatherSlider', action: 'change', detail: { value } });
  ```

## Enabling (Optional)
- Development (keeps prod cost at zero):
  - Ensure [config/appsettings.dev.json](config/appsettings.dev.json) has `"performanceMonitoring": true` (already true).
  - Provide `EXPO_PUBLIC_SENTRY_DSN` in your dev environment.
- Production:
  - Set [config/appsettings.json](config/appsettings.json) `"performanceMonitoring": true`.
  - Provide `EXPO_PUBLIC_SENTRY_DSN` via prod env configuration.

## Future Extensions
- Add sampled performance events (e.g., send 1–5% of timings as real events).
- Enrich events with non-PII context (worldId/userRole) via safe tagging.
- Optional transition to Sentry Performance (transactions) or swap/augment with Amplitude/Mixpanel via the same `Analytics` surface.
