# Feature Analytics Follow-Ups

Performance and robustness improvements for the FeatureAnalytics manager after MVP implementation.

## Current Status

The core FeatureAnalytics manager is working and integrated with `use-premium-feature.ts`.

- `managers/analytics/feature-analytics-manager.ts` owns `trackFeatureBlocked()`.
- Delegates to core `Analytics` for buffering, consent gating, and offline persistence.
- Simple passthrough pattern: normalizes params → calls `Analytics.track()`.

## What Could Be Enhanced

### Throttling for Repeated Block Events

Currently, if a user repeatedly checks a blocked feature in quick succession, each check fires a separate event.

Possible improvement:

- Add debounce/throttle per feature key to avoid event spam
- Example: "don't fire `feature_blocked` for the same feature more than once per 10 seconds"
- Use a simple in-memory map of `{flagName: lastFiredTime}` with cleanup on unmount

### Automatic Context Enrichment

Events currently only contain feature name and reason.

Could add:

- Component/screen name (passed as optional param)
- Auto-timestamp (already in buffer, but could be explicit)
- User segment or cohort (if available at tracking time)
- Request context (e.g., which screen/flow triggered the block)

### Variant Assignment Tracking

Currently `trackVariantEngagement` and `trackVariantPerformance` live in lib.

Should consider:

- Whether variant tracking should also move to a `VariantAnalyticsManager` for consistency
- Or if A/B test tracking has different ownership rules than feature gates

## Next Steps

No immediate action required. These are quality-of-life improvements for future enhancement.
