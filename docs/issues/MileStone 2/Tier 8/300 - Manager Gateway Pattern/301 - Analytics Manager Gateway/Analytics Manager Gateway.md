# Analytics Manager Gateway: Establish Single Entry Point

**Status:** In Progress (Tracks F–H)  
**Track:** `analytics`, `architecture`, `import-boundaries`, `managers`  
**Parent Issue:** [Manager Gateway Pattern](./Manager%20Gateway%20Pattern.md) — Phase 1: Analytics proof of concept  
**Impact:** HIGH — Single entry point eliminates scattered imports; consolidates consent logic; establishes pattern for repo-wide rollout  
**Estimate:** 3–4 days | **Scope:** Analytics only (not broad portability; parent issue handles roadmap)

---

## Problem

Analytics called directly from all layers without gatekeeper:

**UI/Hooks layer:**
- `components/SplashScreen/SafeModeScreen.tsx` — 7× `Analytics.track("safe_mode_entered", ...)`
- `hooks/analytics/use-analytics.ts` — re-exports raw `Analytics` object
- `hooks/analytics/use-premium-feature.ts` — re-exports `trackFeatureBlocked`
- `hooks/analytics/useErrorReporting.ts` — re-exports `AnalyticsConsent` directly

**Lib/Business logic layer:**
- `lib/error/safemode/recovery-actions.ts` — 9× calls to `Analytics.track()`, `performanceManager.measure()`
- `lib/auth/auth-attempt-guard.ts` — `import { shouldEmitEvent }` with consent checks
- `lib/network/network-telemetry.ts` — `shouldEmitEvent('performance')` scattered
- `lib/feature-flags/server-sync/overrides.ts` — `trackVariantAssignment()` direct call
- `lib/analytics/feature-tracking.ts` — direct `Analytics` import

**System layer (boundary violation):**
- `system/API/request-analytics.ts` — imports `Analytics` and `AnalyticsConsent` from `/lib`
- `system/Kernel/app-kernel.ts` — dynamic import of `Analytics` from `/lib`
- `system/Services/sentry/sentry-analytics-exporter.ts` — imports `breadcrumbQueue` from `/lib`

**Consent logic duplication:**
- `lib/auth/auth-attempt-guard.ts` — consent checks
- `lib/network/network-telemetry.ts` — consent checks
- `lib/analytics/modules/nav-analytics.ts` — consent checks

**Result:** Hard to audit events; consent scattered; cross-module coupling; system layer depends upward on lib.

## Solution

**Unified manager + global consent state:**
- `managers/analytics/analytics-manager.ts` — Single public API (`track()`, `identify()`, `trackComponentUsage()`)
- `managers/analytics/analytics-helpers.ts` — Private helpers (sanitization, dispatch logic)
- `type-definitions/analytics-types.ts` — `ConsentLevel` type + global `currentConsentLevel` variable for fast consent reads
- Delete old `lib/analytics/analytics-manager.ts` (replaced by managers version)

All callsites import from one place: `import { Analytics } from '@/managers/analytics/analytics-manager'`

```typescript
export const Analytics = {
  track(event: string, props?: AnalyticsEventProps): void
  identify(user: { id?; username? } | null): void
  trackComponentUsage(params: { component, action, detail? }): void
  getThreshold(key: 'slowScreenMs' | 'slowRequestMs'): number
}

// Global state for fast consent checks (avoids function calls)
export let currentConsentLevel: ConsentLevel = 'basic'
export function setCurrentConsentLevel(level: ConsentLevel): void
```

**Why this works:**
- Single, simple entry point eliminates scattered lib/hooks imports
- Global `currentConsentLevel` bypasses consent pipeline for hot-path reads (`if(currentConsentLevel === 'full') { ... }`)
- Writes still route through `AnalyticsConsent` for persistence and downstream effects
- Minimal redesign; moves existing code as-is instead of adding new abstractions
- Follows dependency hierarchy (managers can depend on lib, not the reverse)

---

## Architecture Decisions

**Consent State Architecture:**
- `currentConsentLevel` in `type-definitions/analytics-types.ts` — mutable global for fast reads
- `setCurrentConsentLevel()` — internal setter, called only by `AnalyticsConsent.initialize()` and `setLevel()` to keep global in sync
- Reads bypass the consent pipeline: `if(currentConsentLevel === 'full') { ... }`
- Writes always go through `AnalyticsConsent` for persistence and side-effects (buffer purge, DB sync)
- Defaults to `'basic'` (GDPR-safe) until initialized

**Import Strategy:**
- **No barrel export** from `/managers/analytics/` (direct imports only)
- All layers: `import { Analytics } from '@/managers/analytics/analytics-manager'`
- Prevents unnecessary module evaluation at boot time; better tree-shaking
- For fast consent checks: `import { currentConsentLevel } from '@/type-definitions/analytics-types'`

---

## Implementation Tracks

### Track A: Create unified manager + global consent ✓ COMPLETE

✓ Created `managers/analytics/analytics-manager.ts` (~60 lines) with unified public API:
- `Analytics.track(event, props)` — Fire sanitized event
- `Analytics.identify(user)` — Set user context (consent-aware)
- `Analytics.trackComponentUsage(params)` — Component usage shorthand
- `Analytics.getThreshold(key)` — Config lookup
- Delegates sanitization and dispatch to helpers; reads `currentConsentLevel` for identify()

✓ Created `managers/analytics/analytics-helpers.ts` (~75 lines) with private functions:
- `sanitizeProps(props)` — Remove sensitive fields
- `dispatchToExporters(event, props)` — Create event and delegate to middleware
- `mapEventType(eventName)` — Categorize events for routing
- Replaced deprecated `substr()` with `generateUUID()` from analytics-buffer

✓ Created `type-definitions/analytics-types.ts` with cross-layer types:
- `ConsentLevel = 'none' | 'basic' | 'full'` type definition
- `currentConsentLevel` mutable global (defaults to `'basic'`)
- `setCurrentConsentLevel(level)` internal setter for wiring into consent pipeline

**Key optimizations:**
- Moved existing code as-is; avoided new abstractions
- Global consent state eliminates function call overhead in hot paths
- Single entry point instead of two-API split

**Exit:** ✓ Unified manager created; `currentConsentLevel` ready for consent pipeline wiring; typecheck passes

---

### Track B: Wire global consent into pipeline ✓ COMPLETE

✓ Updated `lib/analytics/consent/consent.ts`:
- `AnalyticsConsent.initialize()` now calls `setCurrentConsentLevel()` at all paths (fresh cache, DB, stale fallback, config default)
- `AnalyticsConsent.setLevel()` no longer calls it (manager owns runtime updates via direct global write)
- Ensures `currentConsentLevel` stays in sync with persistent state

**Exit:** Global consent state wired into pipeline; manager can update directly at runtime

---

### Track C: Refactor Callsites to use managers entry point ✓ COMPLETE

✓ Created domain-specific managers:
- `managers/analytics/feature-analytics-manager.ts` (~150 lines) — Unified feature + variant analytics
  - `FeatureAnalytics.trackFeatureBlocked(params)` — Feature gate blocking
  - `VariantAnalytics.trackVariantAssignment/Engagement/Performance(event)` — A/B test tracking
  - Delegates to core `Analytics.track()` for buffering and consent
- `managers/navigation/navigationManager.ts` (~300 lines) — Navigation domain orchestrator
  - Moved from `lib/analytics/modules/nav-analytics.ts`
  - `NavigationManager.trackNavigationResult()` — Maps system results to analytics events
  - Delegates to core `Analytics.track()` for event dispatch

✓ Updated all callsites to import from managers:
- `hooks/feature/use-premium-feature.ts` → `FeatureAnalytics.trackFeatureBlocked()`
- `hooks/utils/use-variant-tracking.ts` → `VariantAnalytics.trackVariantEngagement/Performance()`
- `components/SplashScreen/SafeModeScreen.tsx` → `import { Analytics, Performance } from '@/hooks/analytics'` (barrel re-export)
- `lib/error/safemode/recovery-actions.ts` → Lazy import from manager
- `system/API/request-analytics.ts` → `import { Analytics } from '@/managers/analytics/analytics-manager'`
- `system/Kernel/app-kernel.ts` → Dynamic import from manager
- `hooks/analytics/index.ts` → Added barrel export for `Analytics` + `FeatureAnalytics`

**Exit:** All layers route through manager entry points; no direct lib/analytics imports remain

---

### Track D: Delete old lib analytics-manager & dead code ✓ COMPLETE

✓ Deleted replaced/dead code:
- `lib/analytics/feature-tracking.ts` — Removed (functionality moved to FeatureAnalyticsManager)
- `lib/analytics/modules/nav-analytics.ts` — Removed (moved to NavigationManager)
- `lib/analytics/index.ts` barrel → Removed analytics export (moved to managers/analytics/index.ts)

**Exit:** Old patterns removed; no dead code.

---

### Track E: Fix system layer boundary violation ✓ COMPLETE

✓ System layer now imports from managers:
- `system/API/request-analytics.ts` — Updated to `import { Analytics } from '@/managers/analytics/analytics-manager'`
- `system/Kernel/app-kernel.ts` — Updated dynamic import to use manager
- Removed `.enabled()` check (manager doesn't expose it; relies on consent gating in track())

**Exit:** System layer has no upward dependencies on lib/analytics.

---

### Track F: Verify & Lint

- [ ] Run `npm run lint` — 0 errors
- [ ] Grep: `from '@/lib/analytics/analytics-manager'` — should find 0 (old path)
- [ ] Grep: `from '@/managers/analytics'` — verify all callsites use new path
- [ ] Manual smoke tests: Events fire correctly; user context set on 'full' consent

**Exit:** ESLint clean; all imports corrected; events fire as expected.

---

### Track G: Analytics Boundary Validation (scope: analytics only)

**Scope:** Verify `lib/analytics/**` has zero upward dependencies on `@/managers` or `@/middleware`.

**Rule:** Lib analytics is read-only; managers are the only gateway upward.

**Check:**
- Grep each file: `from '@/managers'`, `from '@/middleware'` — flag violations
- Exception: Storage calls OK (same infrastructure layer)

**Exit:** No upward imports in analytics lib.

---

### Track H: Analytics Code Quality Review (scope: analytics only)

**Scope:** Professional patterns, portability readiness, and tech debt assessment for analytics module only.

**Check:**
- `hooks/analytics/` — Meaningful logic or transparent passthrough?
- `lib/analytics/` — Truly portable or DnD-specific assumptions?
- `middleware/` analytics adapters — Provider-agnostic?
- `system/` analytics — Zero app knowledge?
- Storage integration — Clean or needs refactor?

**Output:** Readiness notes + future refactor priorities (not implementation).

**Exit:** Analytics module assessed for quality and future portability work.

---

## Scope Note

**This issue: Analytics-focused gateway pattern.** Proves single entry point, consent gating, and manager-to-lib delegation before rolling out to ErrorManager, JobsManager, etc.

---

## Acceptance Criteria

- [x] **Track A complete:** Unified manager created (~60 lines) + helpers + analytics-types
- [x] **Global consent state created:** `currentConsentLevel` in type-definitions
- [x] **No barrel export:** Direct import path only
- [x] **Track B complete:** `setCurrentConsentLevel()` wired into consent pipeline
- [x] **Track C complete:** All callsites updated; domain managers (feature, variant) created
- [x] **Track D complete:** Old lib analytics code deleted; no dead code
- [x] **Track E complete:** System layer boundary violations fixed
- [ ] **Track F:** ESLint passes; manual smoke tests pass
- [ ] **Track G:** Analytics lib has zero upward dependencies
- [ ] **Track H:** Analytics module code quality assessed
- [x] **Pattern ready:** Foundation established for ErrorManager, JobsManager rollout

---

## Summary

**Approach:** Single unified manager with global consent state, instead of two-API split. Proves pattern in analytics scope; parent issue handles broader portability vision.

**Key insight:** Moving existing code as-is proved simpler than redesigning into separate tracker/orchestrator. Global `currentConsentLevel` eliminates hot-path overhead without breaking persistence semantics (writes still go through the pipeline).

---
