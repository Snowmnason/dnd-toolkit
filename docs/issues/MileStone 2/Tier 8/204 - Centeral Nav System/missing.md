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

# Deferred: Navigation Source Detection — Remaining Gaps

## Degrade system integration for router initialization

**Status:** Deferred, low priority

Router init failure currently logs an error but does not trigger safe mode. The `FUTURE` comment in `providers/AppKernelProvider.tsx` marks the spot. When a `NAVIGATION_SYSTEM` capability is added to the degrade system, router init failure should route there.

---
