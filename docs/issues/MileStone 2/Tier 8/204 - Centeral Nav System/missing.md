# Deferred: requiresAuthorized Field

**Status:** Skipped (YAGNI) — Defer until feature flags/entitlements route integration is designed

## What We Skipped

We considered adding a `requiresAuthorized?: boolean` field to `RouteConfig` to gate routes based on:
- Feature flags (enable/disable routes per flag)
- Entitlements (premium features, subscriptions)
- Organization-level permissions (future extensibility)

## Why We Skipped It (For Now)

1. **No concrete use case yet** — Current app doesn't gate routes on feature flags or entitlements
2. **Unclear integration pattern** — We don't know how feature flags/entitlements will interact with routes
3. **Risk of over-engineering** — Building infrastructure for a problem we haven't fully understood
4. **YAGNI principle** — Add when we have a real need and understand the design

## When to Revisit

**Add `requiresAuthorized` when:**
- Feature flags system gains route-level integration (`lib/feature-flags/`)
- Entitlements system needs route-level checks
- We understand the full data model and guard logic

## Future Design Considerations

When revisiting, consider:
- Single unified guard vs. separate feature-flag-check and entitlement-check guards
- How to pass flag/entitlement context to guards (via route config, params, or context)
- Whether overrides apply (e.g., `forceFeatureAvailable` for development/testing)
- Integration with existing `requiresPermission` and `requiresAdmin` guards

## Related Systems

- `lib/feature-flags/` — Feature flag evaluation engine
- `lib/premium/` (or similar) — Entitlements/subscription system
- `lib/navigation/policy-engine.ts` — Route policy verdict engine (where new guard would integrate)

---

# Deferred: Advanced Navigation Source Detection

**Status:** Partially Implemented (Basic) — Defer advanced granularity until analytics shows value

## What We Built

✅ **Basic back button detection** — Route observer now detects back button vs. deep-link navigation by tracking route history:
- Route history stack maintained in `routeHistoryRef`
- Back button: navigating to earlier route in history (`currentIndex < previousIndex`)
- Deep-link/URL edit: navigating to new or later route in history
- Sets `triggeredBy: 'back'` or `triggeredBy: 'deep-link'` in NavigationContext

## What We're Deferring

❌ **Granular source type detection** — Distinguishing between:
- URL bar edits vs. deep links (both currently marked as 'deep-link')
- Programmatic navigation from code vs. user-initiated (would require wrapper layer)
- Mobile back button swipe vs. Android hardware/iOS gesture (platform-specific detection)
- Browser back button vs. programmatic router.back() calls

❌ **Enhanced navigation telemetry**:
- `platform` detection (web back vs. native back gestures)
- `userInitiated` vs. `programmatic` flag
- Gesture type (swipe, button press, keyboard shortcut)

## Why We Deferred

1. **Simple implementation is 80% useful** — Basic back detection captures most analytical value
2. **Analytics data shows no current need** — No evidence that granular source detection matters for feature decisions
3. **Platform complexity** — Web, iOS, and Android have different back navigation mechanisms
4. **Requires wrapper infrastructure** — Programmatic nav detection would need routing interceptors
5. **YAGNI principle** — Add complexity when data shows it's needed

## Data Currently Available

With basic back button detection, analytics now captures:
- `triggeredBy: 'back'` — User pressed back button
- `triggeredBy: 'deep-link'` — User navigated via link, URL bar, or programmatic nav
- Time to decision (`decisionTimeMs`)
- Guard execution count
- User throttling behavior

This is sufficient for current feature flag decisions and A/B testing.

## When to Revisit

Revisit granular source detection when:
- Analytics data shows correlation between source type and user friction/conversion
- Product needs to differentiate UX based on navigation method
- Mobile app requires gesture-specific telemetry
- A/B testing needs per-platform source tracking

**Implementation Plan (When Ready):**
1. Add platform-specific back detection (`useBackHandler` for native, `popstate` for web)
2. Extend NavigationContext with `sourceType: 'back_button' | 'url_edit' | 'link' | 'programmatic'`
3. Update route observer to track browser history stack (distinct from app route stack)
4. Add event-consent mappings for new source types if PII implications exist
5. Update analytics.md with new telemetry fields

## Related Systems

- `hooks/navigation/use-route-change-observer.ts` — Basic back button detection (implemented)
- `lib/analytics/nav-analytics.ts` — Navigation event tracking
- `lib/middleware/navigation/nav-service.ts` — Analytics dispatch point
- `type-definitions/navigation-decision.ts` — NavigationContext (has basic `triggeredBy` field)

