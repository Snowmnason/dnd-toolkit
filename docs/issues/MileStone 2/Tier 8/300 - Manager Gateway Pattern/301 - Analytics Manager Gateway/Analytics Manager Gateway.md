# Analytics Manager Gateway: Establish Single Entry Point

**Status:** Proposed  
**Track:** `analytics`, `architecture`, `import-boundaries`, `managers`  
**Parent Issue:** [Manager Gateway Pattern](./Manager%20Gateway%20Pattern.md) — Phase 1: Analytics proof of concept  
**Impact:** HIGH — Single entry point eliminates scattered imports; consolidates consent logic; establishes pattern for repo-wide rollout  
**Estimate:** 3–4 days

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

### Track B: Wire global consent into pipeline ⏸ PENDING

Need to call `setCurrentConsentLevel()` from `lib/analytics/consent/consent.ts`:
- In `AnalyticsConsent.initialize()` after loading consent from storage
- In `AnalyticsConsent.setLevel()` after persisting to storage
- Ensures `currentConsentLevel` stays in sync with persistent state

**Will complete when:** Ready to move forward with wiring

---

### Track C: Refactor Callsites to use managers entry point

Update all imports to use new manager:
- `hooks/analytics/use-analytics.ts` — Change to re-export from managers: `export { Analytics } from '@/managers/analytics/analytics-manager'`
- `components/SplashScreen/SafeModeScreen.tsx` — Update import path
- `lib/error/safemode/recovery-actions.ts` — Update import path
- Any other direct `lib/analytics/analytics-manager` imports

**Exit:** All layers route through single manager entry point.

---

### Track D: Delete old lib analytics-manager

Remove replaced code:
- Delete `lib/analytics/analytics-manager.ts` (all logic moved to managers version)
- Verify no orphaned imports remain

**Exit:** Old manager removed; no dead code.

---

### Track E: Fix system layer boundary violation

Update system to use middleware instead of importing from lib:
- `system/API/request-analytics.ts` — Remove lib/analytics imports; use middleware
- `system/Kernel/app-kernel.ts` — Initialize consent via middleware, not direct lib import

**Exit:** System layer has no upward dependencies on lib/analytics.

---

### Track F: Verify & Lint

- Run `npm run lint` — 0 errors
- Grep: `from '@/lib/analytics/analytics-manager'` — should find 0 (old path)
- Grep: `from '@/managers/analytics'` — verify all callsites use new path
- Manual smoke tests: Events fire correctly; user context set on 'full' consent

**Exit:** ESLint clean; all imports corrected; events fire as expected.

---

## Acceptance Criteria

- [x] **Track A complete:** Unified manager created (~60 lines) + helpers + analytics-types
- [x] **Global consent state created:** `currentConsentLevel` in type-definitions
- [x] **No barrel export:** Direct import path only
- [ ] **Track B complete:** `setCurrentConsentLevel()` wired into consent pipeline
- [ ] All callsites updated to import from `managers/analytics/analytics-manager`
- [ ] Old `lib/analytics/analytics-manager.ts` deleted
- [ ] System layer boundary violations fixed (no lib imports from system)
- [ ] ESLint passes; manual smoke tests pass
- [ ] Pattern ready for ErrorManager, JobsManager rollout

---

## Summary

**Approach:** Single unified manager with global consent state, instead of two-API split.

**Key insight:** Moving existing code as-is proved simpler than redesigning into separate tracker/orchestrator. Global `currentConsentLevel` eliminates hot-path overhead without breaking persistence semantics (writes still go through the pipeline).

---
