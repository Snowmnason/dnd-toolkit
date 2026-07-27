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
Presentation (Components/Screens/Hooks) — PUBLIC
    ↓ (can import managers)
    ↓
Managers (Orchestration, Business Rules, Coordination) — PUBLIC
    ├─ Own when/why to call other services
    ├─ Implement domain consent/validation rules
    ├─ ONLY layer that imports lib modules directly
    └─ Route through Middleware for infrastructure
    ↓
Lib (Domain Logic) — PRIVATE
    ├─ Reusable business logic
    ├─ Cannot import managers (no upward calls)
    ├─ Cannot import middleware (no sibling calls)
    ├─ Cannot import system (routes through middleware)
    └─ Can import shared utilities (config, types, maps, etc.)
    ↓
Managers (Again to prevent lib to middleware calls)
    ↓
Middleware (Preconditions & Adaptation) — PUBLIC
    ├─ Service readiness checks
    ├─ Network/system preconditions
    ├─ Transport adaptation (API, storage, etc.)
    └─ Route to System for actual work
    ↓
System (Portable Infrastructure Only) — PRIVATE
    ├─ HTTP requests, database, files
    ├─ Must remain app-agnostic
    ├─ Cannot import lib or middleware
    └─ Can import shared utilities (config, types, etc.)

Shared Support Directories — EXEMPT FROM RULES
    ├─ config/, type-definitions/, maps/, validation/
    ├─ pure-algo-immutables/, localization/
    └─ Can be imported by any layer (no hierarchical rules)
```

**Core principles:**
1. **Unidirectional flow** — Hooks → Managers → Middleware → System (never backwards)
2. **Single entry point per domain** — One manager, zero lib-to-lib shortcuts
3. **Public vs. Private layers** — Managers/Middleware are entry points; Lib/System are implementation details
4. **Shared utilities exempt** — Global directories break hierarchy rules freely (they're infrastructure)
5. **No upward calls** — Lib cannot import managers; System cannot import lib

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
- **JobsManager:** Audit coordination; add batching, dedup, rate-limit backoff, generic tasks; unify offline handling
- **NetworkManager:** Audit direct network calls; establish manager entry point
- **FeatureFlagsManager:** Audit direct flag evaluation; ensure manager ownership
- Create consistent entry point interfaces for each

**Issue:** [Jobs Manager Gateway - Phase 2](../../../suggestions/Jobs%20Manager%20Gateway%20-%20Phase%202.md) — Detailed child issue with 6 implementation phases

**Outcome:** All managers follow consistent pattern; orchestration layer clear; unified async/offline infrastructure.

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

### Phase 6: Foundation Portability (Post-Milestone 2)
**Goal:** Extract and document foundation for reuse in new apps.

**Scope:**
- Document which files are portable (system, lib, shared) vs. app-specific
- Create templates for managers, middleware, jobs, bootstrap
- Extract foundation package for reuse
- Write setup guide for new projects (<30 min bootstrap)
- Validate across contexts

**Issue:** [Manager Gateway Foundation - Portable Package](../../../suggestions/Manager%20Gateway%20Foundation%20-%20Portable%20Package.md)

**Outcome:** New apps can bootstrap Manager Gateway pattern in <30 min; foundation reusable.

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

## Implementation Patterns (Learned from Analytics Phase 1)

### Manager Structure Options

**Option A: Single API** — All operations as methods on manager object (StorageManager, JobsManager)
```typescript
export const JobsManager = {
  enqueue(...) { ... },
  getJob(...) { ... },
  subscribe(...) { ... },
};
```

**Option B: Two-API Split** — Separate APIs for different consumer contexts (AnalyticsManager)
```typescript
// analytics-tracker.ts — UI/Hooks API (simple, no consent complexity)
export function track(event, props) { ... }

// analytics-orchestrator.ts — Lib API (business logic, consent gates)
export async function trackWithConsent(category, event, props) { ... }
```

Choose based on:
- If APIs share identical responsibility → Single object (JobsManager)
- If APIs serve different concerns (UI vs. business logic) → Two files (AnalyticsManager)

### Optimization Patterns

**Batching & Deduplication:**
- Group high-volume events into single requests (analytics, breadcrumbs)
- Skip duplicate items within time window (prevent quota waste)
- Implement in transport layer (job queue, middleware) not managers

**Consent Gating:**
- Always check before emitting (in manager or orchestrator, not callers)
- Separate "consent-free" API from "consent-gated" API when needed
- Prevent duplicated consent checks across modules

**Rate-Limit Backoff:**
- Block entire job type (not individual items) when provider rate-limits
- Parse `retryAfterMs` from error responses
- Implement in job queue/middleware, not managers

### Testing Strategy

- **Manager tests:** Mock middleware; verify orchestration logic
- **Middleware tests:** Mock system; verify preconditions and normalization
- **System tests:** Verify transport and data flow (integration)
- **Call-site tests:** Verify manager is called (not direct lib imports)

---

## Notes

- This is a **strategic architectural refactor**, not a bug fix. Changes are high-confidence but wide-reaching.
- Pattern is already proven by StorageManager; applying broadly is low-risk.
- Each phase can be reviewed independently; phased rollout reduces review burden.
- Each manager is a separate issue for clarity; children can be reviewed in parallel.
- Analytics Phase 1 established the pattern; Jobs Phase 4 refines and extends it.
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
