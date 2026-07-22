# Analytics Manager Gateway

This issue moves analytics emission behind a single manager entry point, wires consent into shared state, and removes the old lib-level gateway path.

## File Changes

| Area | Files | What changed |
| --- | --- | --- |
| Core gateway | `managers/analytics/analytics-manager.ts`, `managers/analytics/analytics-helpers.ts` | Added the public analytics entry point and the private helpers used for sanitization and dispatch. |
| Shared consent state | `type-definitions/analytics-types.ts`, `lib/analytics/consent/consent.ts` | Added `currentConsentLevel` for fast reads and kept it synchronized from the consent pipeline. |
| Domain analytics | `managers/analytics/feature-analytics-manager.ts`, `managers/navigation/navigationManager.ts` | Moved feature, variant, and navigation analytics behind manager-owned APIs. |
| Callsite migration | `hooks/analytics/*`, `hooks/feature/use-premium-feature.ts`, `hooks/utils/use-variant-tracking.ts`, `components/SplashScreen/SafeModeScreen.tsx`, `system/API/request-analytics.ts`, `system/Kernel/app-kernel.ts` | Repointed consumers to the manager gateway and the shared consent state. |
| Dead code removal | `lib/analytics/feature-tracking.ts`, `lib/analytics/modules/nav-analytics.ts`, `lib/analytics/index.ts`, `managers/analytics/analytics-network-manager.ts` | Removed replaced or orphaned analytics code. |
| Bootstrap fix | `system/Services/service-initializer.ts` | Registered the Sentry adapter so the active analytics send path receives events. |

## Validation

- `npm run lint`
- Grep checks confirmed the old `@/lib/analytics/analytics-manager` import path was removed.
- Smoke checks confirmed the manager gateway and consent state were wired before analytics emission.

## Notes

- The implementation keeps `lib/analytics/` as the lower-level analytics foundation and moves public callers to `managers/analytics/analytics-manager.ts`.
- The closeout docs in this folder summarize the behavior and the intended follow-up boundaries for nearby work.