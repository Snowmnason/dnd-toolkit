**Status:** Proposed  
**Track:** `architecture`, `refactor`, `managers`  
**Impact:** HIGH — Eliminates cross-lib calls; reduces duplication; establishes single entry point per domain  
**Estimate:** 3–4 weeks (phased rollout)

---

## Problem

Lib modules call each other directly, creating scattered coupling:
- Analytics: consent checks duplicated in auth, network, feature-flags
- Error: reporting scattered across error-manager, degrade-manager, recovery-actions
- Storage: mostly working via manager, but some direct calls remain
- No single entry point per domain; hard to audit; hard to refactor

## Solution

**Manager Gateway Pattern:** Each domain has ONE manager. All calls go THROUGH it.

```
Hooks (thin UI state)
  ↓
Managers (orchestration: when/why to call, consent gates, decisions)
  ├─ AnalyticsManager, StorageManager, ErrorManager, etc.
  ├─ No direct lib-to-lib calls
  └─ Managers coordinate with each other as needed
  ↓
Middleware (preconditions: is service ready? network status?)
  ↓
System (transport only)
```

**Key Rules:**
- ✅ Managers own orchestration logic
- ✅ Middleware handles preconditions
- ✅ System only handles transport
- ❌ No lib-to-lib imports (go through manager)
- ❌ No system-to-lib imports (system is portable)


## Benefits

- **Single source of truth** — Each manager owns its domain (no duplication)
- **Testable** — Clear interface; easy to mock
- **Maintainable** — Adding features doesn't require hunting through 5 modules
- **Auditable** — "Where does X happen?" → "Go to X Manager"
- **Refactor-safe** — Changing manager internals doesn't ripple through codebase

---

## Architecture Model

Managers sit between UI/Hooks and Infrastructure, with clear responsibilities:

```
Presentation (Components/Screens/Hooks)
    ↓
Managers (Orchestration, Business Rules, Coordination)
    ├─ Own when/why to call other services
    ├─ Implement domain consent/validation rules
    ├─ Never import other lib modules (except via manager pattern)
    └─ Route through Middleware for infrastructure
    ↓
Middleware (Preconditions & Adaptation)
    ├─ Service readiness checks
    ├─ Network/system preconditions
    ├─ Transport adaptation (API, storage, etc.)
    └─ Route to System for actual work
    ↓
System (Portable Infrastructure Only)
    ├─ HTTP requests, database, files
    ├─ Must remain app-agnostic
    └─ Never imports lib or middleware
```

**Core principle:** Unidirectional flow with ONE entry point per domain. No lib-to-lib shortcuts.

---

## Codebase Status

### Already Following Pattern ✅
- **StorageManager** — Single entry point; 14+ lib modules call it; works correctly; proven pattern

### Partially Broken ❌
- **AnalyticsManager** — Exports individual functions; lib modules import directly; consent checks duplicated
- **ErrorManager** — Some modules call `degrade-manager` directly instead of going through error-manager
- **JobsManager** — Mostly follows; some edge cases
- **NetworkManager** — Some direct network service calls
- **FeatureFlagsManager** — Some direct flag evaluation without manager

### System Layer Violations ⚠️
- `system/API/request-analytics.ts` imports from `lib/analytics`
- `system/Kernel/app-kernel.ts` dynamic imports from `lib`
- `system/Services/sentry/` imports lib modules directly

---

## Implementation Roadmap

### Phase 1: Analytics (Proof of Concept)
**Goal:** Establish pattern with two-file structure for different consumption contexts.

**Approach:**
- Two-API split: `analytics-tracker.ts` (UI) and `analytics-orchestrator.ts` (lib)
- Consolidate all analytics exports through managers
- Update 16 files across UI, lib, and system layers
- Delete old `analytics-manager.ts` 

**Issue:** [Analytics Manager Gateway](./Analytics%20Manager%20Gateway.md)

**Outcome:** Zero direct analytics function calls outside managers; system layer no longer imports lib.

---

### Phase 2: Error Domain
**Goal:** Consolidate error reporting through single ErrorManager entry point.

**Scope:**
- Merge or unify `error-manager.ts` and `degrade-manager.ts` under one interface
- Update auth, offline, and other modules to call ErrorManager only
- No direct `reportCrash` / `reportFault` imports

**Outcome:** Error reporting centralized; single entry point; no scattered reporting logic.

---

### Phase 3: Storage Audit
**Goal:** Verify StorageManager is sole entry point (mostly working; audit edge cases).

**Scope:**
- Scan for direct imports from `system/Storage` in lib modules
- Verify all storage access goes through StorageManager
- Prepare ESLint rule foundation

**Outcome:** Storage access enforced through manager; clean for ESLint automation.

---

### Phase 4: Standardize Other Managers
**Goal:** Apply pattern to JobsManager, NetworkManager, FeatureFlagsManager.

**Scope:**
- JobsManager: Consolidate job-service calls
- NetworkManager: Audit direct network calls
- FeatureFlagsManager: Audit direct flag evaluation
- Create consistent entry point interfaces for each

**Outcome:** All managers follow consistent pattern; orchestration layer clear.

---

### Phase 5: ESLint Enforcement
**Goal:** Automate pattern via linting rules; prevent regression.

**Scope:**
- Rule: Prevent direct imports of non-manager exports from lib modules
- Rule: Prevent lib-to-lib imports (except shared utilities, types, validation)
- Rule: Prevent system imports from lib layer
- Enable rules in eslint.config.js

**Outcome:** Pattern enforced by tooling; new lib-to-lib coupling blocked automatically.

---

## Acceptance Criteria

- [ ] Phase 1 (Analytics) complete — two-API pattern established
- [ ] Phase 2 (Error) complete — consolidated entry point
- [ ] Phase 3 (Storage) complete — audit confirms pattern; ready for ESLint
- [ ] Phase 4 (Other managers) complete — all follow consistent interface
- [ ] Phase 5 (ESLint) complete — rules prevent new violations
- [ ] Zero new lib-to-lib coupling can be added
- [ ] Dependency graph shows clean unidirectional flow

---

## Notes

- This is a **strategic architectural refactor**, not a bug fix. Changes are high-confidence but wide-reaching.
- Pattern is already proven by StorageManager; applying broadly is low-risk.
- Each phase can be reviewed independently; phased rollout reduces review burden.
- Expected to improve code quality, reduce duplication, and make future refactors easier.
- See [copilot-instructions.md](../../copilot-instructions.md) for broader dependency boundary rules.

---

## App-Specific Files (Not for NPM Packaging)

These files contain app-bootstrap and provider-specific logic. They stay in the app repo and are **not** packaged for reuse:

- `system/Services/sentry/` — All Sentry bootstrap and adapter registration code
  - `sentry-analytics-exporter.ts` — Sentry-specific envelope formatting
  - `sentry-error-tracker.ts` — Sentry error capture implementation
  - `sentry-provider.ts` — SentryAdapter registration and DSN parsing
  - `sentry-service-initializer.ts` — Service initialization

**Why:** These files contain Sentry SDK hooks, DSN management, and provider-specific response parsing. They're tightly coupled to this app's Sentry configuration and would need customization per new repo.

**Reusable infrastructure (suitable for packaging):**
- `system/Services/analytics-adapter.ts` — Generic factory pattern (zero provider dependencies)
- `type-definitions/breadcrumb-queue-types.ts` — Type contracts
- `managers/analytics/` — Manager orchestration logic
- `lib/analytics/performance/performance-baseline.ts` — Domain logic
