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
- Browser back button vs. programmatic navigate.back() calls

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

---

# Critical: Transport Router Initialization

**Status:** TODO — CRITICAL SYSTEM REQUIREMENT

**What needs to happen:**
- `initializeRouter()` from `system/navigation/adapter/transport-adapter.ts` MUST be called early in bootstrap
- This registers the Expo Router instance globally for centralized execution layer
- **If this fails, the entire navigation system crashes** — no fallback possible

**Why it's critical:**
- All navigation requests depend on router being available in the transport adapter
- Without router initialization, any navigation attempt will throw "Router not initialized"
- Should happen BEFORE kernel.phases.appReady is set

**Current status:**
- ✅ Transport adapter code and JSDoc are complete
- ✅ Types moved to `type-definitions/transport-types.ts`
- ❌ Initialization hook/provider not yet created
- ❌ Bootstrap sequence not yet integrated

**Implementation notes (DO NOT DEFER):**
- Cannot go in system kernel phases (requires React hook `useRouter`)
- MUST go in a React component/hook that wraps the kernel
- Suggested location: Hook in the `AppKernelProvider` BEFORE phases start, or create `useInitializeTransportRouter()` hook
- Should crash immediately if fails (not a graceful degradation scenario)
- Add to bootstrap error tracking/telemetry

**Degrade System Integration (REQUIRED):**
- Add `NAVIGATION_SYSTEM` as a critical capability to the degrade system
- Router initialization failure should trigger hard-crash behavior (no graceful mode)
- Navigation is non-degradable: if transport adapter fails, the entire app is unusable
- Update degrade capability enum to include navigation system as a mandatory capability
- Log all navigation initialization failures to `navigation` category with CRITICAL level

## Related Systems

- `hooks/navigation/use-route-change-observer.ts` — Basic back button detection (implemented)
- `lib/analytics/nav-analytics.ts` — Navigation event tracking
- `lib/middleware/navigation/nav-service.ts` — Analytics dispatch point
- `type-definitions/navigation-decision.ts` — NavigationContext (has basic `triggeredBy` field)
- `system/Kernel/phases/registration-phase.ts` — Router initialization happens here (EXCEPTION to system-layer rules)


## Settings Modal

**Short answer: Yes it can, but it's a more involved refactor because the trigger point is different.**

Here's the key difference:

- **NavModal / TrustModal** — triggered from `useGuardedNavigation` (a hook), which already has all the navigation context needed for their callbacks. `openModal()` is called from within a hook = easy.
- **SettingsModal** — triggered from `ChromeLayer` (a *presentation component*) via `openSettingsMenu`. The action callbacks (`onAccountSettings`, `onReturnToWorldSelection`) need `router` + `AuthStateManager` + `worldId`/`userRole` — context that `ChromeLayer` doesn't have. So currently those callbacks are defined in _layout.tsx and the manual `<SettingsModal>` render wires them together.

**The current state is also slightly inconsistent** — `SettingsModal` has `registerModal('settings', SettingsModal)` at the bottom already, but it's never actually opened via `openModal()`. The registry entry is dead code right now.

**Migration path when you get to it:**
1. Extract the two action callbacks into a `useSettingsActions` hook in navigation (or ui)
2. Have `ChromeLayer` call `openModal('settings', { onAccountSettings, onReturnToWorldSelection, onClose: closeModal })` via `useModal()` instead of `openSettingsMenu`
3. Remove `settingsMenuVisible` / `openSettingsMenu` / `closeSettingsMenu` from `chrome-context`
4. Remove the manual `<SettingsModal>` render from _layout.tsx

Not urgent, but definitely worth doing to clean up the `chrome-context` and kill the _layout.tsx manual render. Worth noting as a follow-up task.
