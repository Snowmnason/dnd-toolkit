# Implementation Plan: Degradation Framework

**Related**: #287 - Kernel Advanced Phase Control  
**Status**: Tracks 1-4 Complete, Track 5/5.5 Ready (Verification Audit Done)  
**Complexity**: 10 tracks, Medium-High  

---

## Overview

Implement a centralized **Degradation Manager** system that allows phases to fail gracefully by setting capability flags, which are then observed by kernel, UI, and middleware to adapt app behavior at runtime.

Key principle: **Multiple systems emit → Degrade Manager aggregates → UI/Kernel subscribe** (not the reverse).

---

## Track 1: Create `system/Degrade/` Foundation

**Goal**: Build portable degradation infrastructure at system layer

**Files to create**:
- `system/Degrade/types.ts` — Enums and interfaces
- `system/Degrade/app-degrade.ts` — Core flag store + subscribe/notify (singleton, like AppKernel)
- `system/Degrade/index.ts` — Barrel export

**Acceptance Criteria**:
- [ ] `DegradeCapability` enum with all capability flags (database, auth, sync, connectivity, storage, backgroundJobs, premium, etc.)
- [ ] `DegradeCapabilityState` interface: `{ value: boolean, reason: string, source: string, updatedAt: number }`
- [ ] `DegradeState` interface: `{ capabilities: Record<DegradeCapability, DegradeCapabilityState>, timestamp }`
- [ ] `DegradeManager` class (exported as `appDegrade` singleton) with methods:
  - `set(capability, value, { source, reason })` — update flag with source tracking
  - `subscribe(callback) → unsubscribe()` — standard subscription pattern
  - `getState() → DegradeState` — synchronous read (includes per-capability metadata)
  - `isCapable(capability) → boolean` — single flag read (true only if no sources report false)
- [ ] Exports via barrel: `export { DegradeManager, DegradeCapability, DegradeState, DegradeCapabilityState }`
- [ ] Singleton instance exported: `export const appDegrade = new DegradeManager()`

**Notes**:
- Per-capability has `{ value, reason, source, updatedAt }` — tracks which system disabled it and why
- Reference counting logic: capability is `true` only when no sources report it as `false`
- Prevents last-writer-wins bugs: network recovery won't incorrectly enable if services still degraded
- Follow same subscribe pattern as kernel/network/offline systems
- No integration yet, just foundation

---

## Track 2: Define All Degradation Flags

**Goal**: Complete enumeration of all capabilities that can degrade

**File**: `system/Degrade/types.ts` → `DegradeCapability` enum

**Acceptance Criteria**:
- [ ] Flag for each failure mode that can occur mid-phase (8 total):
  - Phase-level: `database`, `auth`, `sync`, `storage`, `backgroundJobs`
  - Network: `connectivity` (online/offline)
  - Optional services: `analytics`, `errorTracking`, `premiumFeatures`
- [ ] Each flag has JSDoc explaining when it's set, which source sets it, and what it disables
- [ ] Per-capability metadata includes: `{ value: boolean, reason: string, source: string, updatedAt: number }`
- [ ] Complete list documented in `DegradeCapability` enum with full metadata shape

**Example structure**:
```typescript
export enum DegradeCapability {
  DATABASE = "database",                    // Data sync/queries disabled (sources: services, sync)
  AUTH = "auth",                            // Session/auth disabled (sources: auth, services)
  SYNC = "sync",                            // Offline queue/auto-sync disabled (sources: registration, offline)
  CONNECTIVITY = "connectivity",            // Network unavailable (sources: network-detection)
  STORAGE = "storage",                      // Local storage unavailable (sources: storage-phase)
  BACKGROUND_JOBS = "backgroundJobs",       // No auto-refresh/retry jobs (sources: registration)
  ANALYTICS = "analytics",                  // Telemetry disabled (sources: services)
  ERROR_TRACKING = "errorTracking",         // Error reporting disabled (sources: services)
  PREMIUM_FEATURES = "premiumFeatures",     // Premium gating locked (sources: entitlements)
}
```

**Notes**:
- Don't implement anything yet, just flags
- No callers yet, so this won't break anything

---

## Track 3: Wire Flags to Degradation Paths

**Goal**: Route phase failures → degrade manager flag updates

**Approach**: Either write NEW methods that set flags, OR refactor EXISTING paths

**Files affected**:
- `system/Kernel/phases/network-phase.ts` → on failure: `appDegrade.set('connectivity', false)`
- `system/Kernel/phases/services-phase.ts` → on failure: `appDegrade.set('database', false)` | `appDegrade.set('auth', false)`
- `system/Kernel/phases/storage-phase.ts` → on failure: `appDegrade.set('storage', false)`
- `system/Kernel/phases/auth-phase.ts` → on failure: `appDegrade.set('auth', false)`
- `system/Kernel/phases/registration-phase.ts` → job/subscription failures: `appDegrade.set('backgroundJobs', false)`
- `lib/offline/sync-manager.ts` → cascade detected: `appDegrade.set('sync', false)`

**Acceptance Criteria**:
- [ ] Each phase catch block calls `appDegrade.set(capability, false, { source: phaseName, reason: errorMessage })`
- [ ] Legacy error handling paths REFACTORED (no backwards compat)
- [ ] Fallback behavior PRESERVED (e.g., feature flags phase's safe defaults, auth phase's storage fallback)
- [ ] Redundant logging/re-throws DELETED — consolidate all degradation signaling into `appDegrade.set()`
- [ ] All phase failures now set flags instead of scattered warning logs
- [ ] Offline cascade detector sets `sync` flag when threshold hit

**Decision per file**:
- If OLD code is simple logging: replace with `appDegrade.set()`
- If OLD code has complex recovery logic: KEEP recovery, but ADD `appDegrade.set()` call BEFORE recovery
- If OLD code re-throws: wrap in try/catch, set flag, don't re-throw to kernel

**Notes**:
- Distinction: preserve fallback behavior (the feature you want to keep), delete legacy structure (old catch/log/throw patterns)
- Example: feature flags phase has built-in fallback to empty flags — keep that logic intact, just add `appDegrade.set('premiumFeatures', false)`
- Flags set during bootstrap, but also accessible at runtime for recovery

---

## Track 3.5: Define Degradation Response Paths

**Goal**: Document what ACTUALLY happens when each capability degrades — the behavior change in the app

**This is NOT implementation, just specification.** We're locking in the degradation responses so tracks 4+ know what to build.

**Principle**: Response logic lives in `system/Degrade/handlers/` (fault-handlers.ts, crash-handlers.ts) so it's:
- Centralized (not scattered in UI/middleware/kernel)
- App-agnostic (portable to any app using this framework)
- Easy to modify without touching phase code

---

### Response Path Definitions

| Capability | When Degraded | Response | Logic Location | Interaction Notes |
|------------|---------------|----------|-----------------|-------------------|
| **`connectivity`** | Network initialization fails OR Network goes offline at runtime | **FULL OFFLINE MODE**: Show offline banner, queue all mutations, disable real-time features, use cached data | `system/Degrade/handlers/fault-handlers.ts:handleConnectivityDegraded()` | Interacts with `database`: If both offline, everything is read-only. If connectivity down but DB available (partial offline), queue mutations. |
| **`connectivity` (partial)** | Network connection quality degrades (slow network, intermittent) | ADAPTIVE PAYLOADS: Reduce image quality, compress data, disable maps preview, use stale cache longer | `system/Degrade/handlers/fault-handlers.ts:handleAdaptivePayload()` | If `sync` also degraded, don't mark stale data as auto-syncable. |
| **`database`** | Database provider init fails OR DB connection lost at runtime | If `connectivity = true`: PARTIAL OFFLINE (queue mutations locally, show "data unavailable" on mutations). If `connectivity = false`: Already in full offline mode. | `system/Degrade/handlers/fault-handlers.ts:handleDatabaseDegraded()` | Check connectivity status first. Response depends on both flags. |
| **`auth`** | Auth provider init fails OR Session becomes invalid at runtime | LOCKED: Show login screen, disable mutations, block premium features. Allow read-only mode with cached data. | `system/Degrade/handlers/fault-handlers.ts:handleAuthDegraded()` | If coupled with `connectivity = false`, user is stuck offline + unauthenticated (expected). |
| **`sync`** | Cascade detector triggers (3+ consecutive sync failures) | PAUSED: Stop background sync jobs (auto-refresh, background-sync), queue mutations, show sync-paused indicator. Local-only jobs continue (storage health, feature flag refresh). | `system/Degrade/handlers/fault-handlers.ts:handleSyncDegraded()` | Does NOT pause all background jobs — only data sync jobs. Other background work (health checks, premium refresh) continues. |
| **`backgroundJobs`** | Job queue initialization fails | DEGRADED: Background jobs disabled, show "offline/limited" indicator. Queued mutations stay in queue but won't auto-process. User can manual-sync or retry manually. | `system/Degrade/handlers/fault-handlers.ts:handleBackgroundJobsDegraded()` | Subset of full offline. Still can read data if DB/auth OK. Mutations just won't auto-sync. |
| **`analytics`** | Analytics exporter initialization fails | SILENT: No telemetry sent (fire-and-forget events discarded). Zero user-facing impact. | `system/Degrade/handlers/fault-handlers.ts:handleAnalyticsDegraded()` | Independent of other capabilities. Does not affect app functionality. |
| **`errorTracking`** | Error tracker (Sentry) initialization fails | SILENT: Errors logged locally only, not reported to Sentry. Zero user-facing impact. | `system/Degrade/handlers/fault-handlers.ts:handleErrorTrackingDegraded()` | Independent. Error boundary still works, just doesn't report to backend. |
| **`premiumFeatures`** | Feature-flags load fails OR premium entitlements unavailable | STAGED: Try serving cached offline premium state (if available). Otherwise, feature-lock behind "upgrade" paywall. | `system/Degrade/handlers/fault-handlers.ts:handlePremiumFeaturesDegraded()` | Check offline cache first. If no cache, lock features gracefully. |
| **`storage`** | SecureStorage unavailable (permissions, disk full, corruption) | **CRASH**: Show error splash screen, enable error boundary, offer recovery actions (clear cache, reinstall). **Unrecoverable — no degradation.** | `system/Degrade/handlers/crash-handlers.ts:reportStorageCrash()` | This is a CRASH, not a degrade. Must be kept separate for future error-system extraction. |

---

### Multi-Capability Scenarios (AND Logic)

These define what happens when multiple capabilities are degraded simultaneously:

| Scenario | Flags | Result | Why |
|----------|-------|--------|-----|
| Network + Database both down | `connectivity = false`, `database = false` | **FULL OFFLINE**: Read-only with cached data, queue mutations locally, no real-time features | Both critical. User is stuck offline. Read-only ensures data integrity. |
| Network down, Database OK | `connectivity = false`, `database = true` | **PARTIAL OFFLINE**: Mutations queue locally, show "queued" indicator, no network features (maps preview, real-time search) | User can still read from cache/DB, just can't sync yet. |
| Database down, Network OK | `connectivity = true`, `database = false` | **PARTIAL OFFLINE**: Queue mutations, show "data unavailable", disable read operations on that entity | Network works for other systems. Only that data entity is unavailable. |
| Sync paused (cascade) | `sync = false`, others OK | **SYNC PAUSED**: Mutations don't auto-sync, show "sync paused — manual retry available", local jobs continue | Transient failure. User can still queue work, just won't auto-process. |
| All critical systems down | `connectivity = false`, `database = false`, `auth = false` | **FULL OFFLINE LOCKED**: Read-only with session data cached, no mutations, no re-auth until connectivity recovers | Worst case. User data is safe, can review cached data, can't make changes. |

---

### Response Handler Structure in `system/Degrade/`

Handlers are organized by category:

```typescript
// system/Degrade/handlers/fault-handlers.ts
export function handleConnectivityDegraded(isOnline: boolean): void {
  // Check database status
 * if (appDegrade.isCapable('database')) {
    // DB up, connectivity down → PARTIAL OFFLINE
    notifyUI('partial-offline', { mode: 'queue-mutations', cached: true });
  } else {
    // Both down → FULL OFFLINE
    notifyUI('full-offline', { mode: 'read-only', cached: true });
  }
}

export function handleDatabaseDegraded(isAvailable: boolean): void {
  if (appDegrade.isCapable('connectivity')) {
    // Connected, DB down → PARTIAL OFFLINE for that entity
    notifyUI('partial-offline-database', { mode: 'queue-mutations', entity: 'data' });
  }
  // If also offline, already in FULL OFFLINE from connectivity handler
}

export function handleSyncDegraded(isSyncing: boolean): void {
  // Only pause data-sync jobs, not all background jobs
  pauseSelectiveJobs(['sync-orchestrator', 'network-recovery-retry']);
  notifyUI('sync-paused', { canRetryManually: true });
}

export function handlePremiumFeaturesDegraded(): void {
  const cached = getOfflineCacheForPremium();
  if (cached) {
    notifyUI('premium-using-cache', { stalenessWarning: true });
  } else {
    notifyUI('premium-locked', { upgradeRequired: true });
  }
}

// system/Degrade/handlers/crash-handlers.ts
export function reportStorageCrash(reason: string): void {
  notifyErrorBoundary('Storage Unavailable', {
    level: 'CRASH',
    recovery: ['CLEAR_CACHE', 'REINSTALL'],
    reason
  });
}
```

---

### UI/Kernel Integration Points

Once handlers are written, UI and kernel will:

1. **Subscribe to appDegrade** — `appDegrade.subscribe((state) => { handleCapabilityChange(state); })`
2. **Call matching handler** — When capability changes, handler executes the response
3. **UI observes state** — Hooks like `useDegraded('connectivity')`, `useDegraded('sync')`, `useOfflineMode()` read appDegrade state and render accordingly
4. **No scattered logic** — All degradation responses routed through handlers, not inline

---

## Manager Design Pattern Overview

**The Problem We're Solving**:

Without a centralized manager, degradation logic gets scattered:
- Middleware detects error → calls appDegrade.set() directly (boundary violation)
- Runtime errors → direct setSafeMode() calls (scattered, hard to trace)
- Multiple errors → UI flickers between different capability states (confusing)
- Recovery → no clear way to know if recovery unfixes something else (cascading missed)

**The Solution: Priority-Ordered Error Queue in Manager**

```
┌─────────────────────────────────────────────────────────────────┐
│ Application Error Occurs                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
            ┌────────▼──────────┐
            │ Report to Manager │
            └────────┬──────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    ▼                ▼                ▼
middleware      runtime         recovery signal
reportFault()  reportCrash()   reportRecovery()
    │                │                │
    └────────────────┼────────────────┘
                     │
         ┌───────────▼────────────┐
         │ Manager Error Queue    │
         │ ┌─────────────────┐    │
         │ │ Priority: 0     │    │  Sorted by priority map:
         │ │ connectivity    │    │  Network > Auth > Storage >
         │ │ reason: offline │    │  Sync > Jobs > Analytics
         │ ├─────────────────┤    │
         │ │ Priority: 3     │    │
         │ │ sync            │    │
         │ │ reason: cascade │    │
         │ └─────────────────┘    │
         └───────────┬────────────┘
                     │
    ┌────────────────▼──────────────┐
    │ Degradation Service           │
    │ (Precondition Checks)         │
    │ - Network ready?              │
    │ - Consent OK?                 │
    │ - Service initialized?        │
    └────────────────┬──────────────┘
                     │
         ┌───────────▼────────────┐
         │ appDegrade.set()       │
         │ (State Machine)        │
         │ Update capability flag │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │ Handlers Execute       │
         │ (Business Logic)       │
         │ handleConnectivity()   │
         │ handleAuth()           │
         │ etc.                   │
         └───────────┬────────────┘
                     │
         ┌───────────▼────────────┐
         │ UI/Kernel Observe      │
         │ Show single reason:    │
         │ "Offline" (not 5 msgs) │
         └───────────────────────┘
```

**Key Properties**:

1. **Single Entry Point**: ALL errors go through manager (`reportFault`, `reportCrash`, `reportRecovery`)
2. **Priority Queue**: Only highest-priority error is "active" at any moment (prevents UI flickering)
3. **Cascading**: When top error recovers, next error auto-processes (may also recover)
4. **Boundary Enforcement**: Middleware ≠ Manager ≠ System/Degrade (no cross-calling)
5. **Observable**: UI hooks into manager state, not appDegrade directly (semantic layer)

**Why This Pattern**:
- **Clarity**: One source of truth for all degradation decisions
- **Predictability**: Priority map is explicit and unchanging
- **Minimal flickering**: UI sees one error reason at a time
- **Cascading handling**: Network recovery can auto-fix sync and analytics
- **Testability**: Manager can be tested independently of appDegrade

---

## Track 4: Bring into `lib/Degrade/` with Manager + Middleware

**Goal**: Create domain-level wrapper layer with error history & priority-based orchestration

**Architecture Pattern**:
```
Middleware detects error → reportFault(capability, error) → Manager
  ├─ Stores error in priority queue
  ├─ Sorts by priority: Network > Auth > Storage > Sync > Analytics/ErrorTracking
  ├─ Calls degradationService.updateDegradation(nextError)
  └─ Service calls appDegrade.set() [NEVER direct manager→appDegrade]

Key insight: Middleware cannot call appDegrade directly (boundary violation).
Manager owns priority logic. Service owns precondition checks.
System/Degrade stays focused on state machine only.
```

**Files to create**:
- `lib/error/degrade/degrade-manager.ts` — error history + priority orchestration (CENTRAL HUB)
- `lib/middleware/degrade/degradation-service.ts` — precondition checks only (NO business logic duplication)
- `lib/error/index.ts` — barrel re-export for manager

**Manager Responsibilities**:
- **Error History**: Store errors in priority queue `{ capability, error, priority, timestamp }`
- **Priority Ordering**: Sort by capability (Network > Auth > Storage > Sync > Analytics > ErrorTracking)
- **Cascading Logic**: When resolving error X, auto-check if this fixes error Y (e.g., network recovery cascades to database)
- **Middleware Coordination**: Call `degradationService.updateDegradation(nextError)` to update appDegrade state
- **Observation Pattern**: Provide `subscribeToDegradation(callback)` for hooks/UI

**Degradation Service Responsibilities** (Middleware Layer):
- **Precondition Checks**: Is network online? Is consent OK? Is service initialized?
- **No Duplication**: Don't reproduce business logic from fault handlers; just validate preconditions
- **Safe Calls**: Call `appDegrade.set()` after all preconditions pass (never before)

**Manager API**:
```typescript
reportFault(capability: DegradeCapability, reason: string, context?: any): void
reportCrash(capability: DegradeCapability, reason: string, context?: any): void
reportRecovery(capability: DegradeCapability, reason?: string): void
getDegradationState(): DegradeState
isCapableOf(capability: DegradeCapability): boolean
subscribeToDegradation(callback: (state: DegradeState) => void): () => void
```

**Acceptance Criteria**:
- [ ] Manager stores error history with priority map: `{ network: 0, auth: 1, storage: 2, sync: 3, analytics: 4, errorTracking: 5 }`
- [ ] `reportFault()` adds to queue, sorts, and calls `degradationService.updateDegradation()`
- [ ] `reportRecovery()` clears error from history and re-processes queue (may fix cascading errors)
- [ ] Degradation service calls NO system/Degrade functions directly — only `appDegrade.set()`
- [ ] Manager provides query API: `isCapableOf()`, `getDegradationState()`, `subscribeToDegradation()`
- [ ] Exports via `lib/error/index.ts` for use in middleware + hooks
- [ ] ZERO direct middleware→appDegrade calls (all routed through manager)

**Priority Queuing Logic**:
```typescript
// Inside manager.reportFault()
this.errors.push({ capability, error, priority: PRIORITY_MAP[capability], timestamp });
this.errors.sort((a, b) => a.priority - b.priority); // Network first, analytics last

// Get highest-priority error
const nextError = this.errors[0];
degradationService.updateDegradation(nextError); // Service handles preconditions + appDegrade.set()
```

**Cascading Example**:
- User offline (network down, sync paused, database queued)
- Network reconnects → `reportRecovery('connectivity')`
- Manager clears connectivity error from queue
- Manager processes next error in queue (sync cascade → triggers handler)
- Handler sees network OK now → resumes sync
- If sync recovers → cascade clears → database queries resume

**Notes**:
- Manager is a NEUTRAL ORCHESTRATOR — doesn't call appDegrade directly, doesn't import system/Degrade
- Middleware stays SIMPLE — only precondition checks, no duplication of business logic
- Handlers in system/Degrade/ stay FOCUSED — just state machine, no priority logic
- This pattern prevents UI flickering (priority queue guarantees one error at a time to UI)

---

## Track 5: Centralize Bootstrap-Time Degradation in Existing lib Files

**Goal**: Wire middleware precondition checks to report degradation via centralized manager. Previously, these paths just logged warnings or threw errors — now they route through manager for priority-ordered processing.

**Pattern**: Middleware detects fault → calls `Manager.reportFault()` → manager queues by priority → degradationService updates appDegrade

**Scope**: Bootstrap-time patterns only (middleware init checks, service readiness). See "Track 5 Refactoring Checklist" in the Verification Audit section for exact line-level changes.

**Files affected (8 edits)**:
- `lib/middleware/services/database-service.ts` → `getDatabase()` + `getDatabaseWithAuth()` → call `degradeManager.reportFault('database', error)`
- `lib/middleware/services/auth-service.ts` → `ensureAuthReady()` → call `degradeManager.reportFault('auth', error)`
- `lib/middleware/services/error-service.ts` → `canReport()` → call `degradeManager.reportFault('errorTracking', error)`
- `lib/middleware/services/analytics-service.ts` → `canSendAnalytics()` → call `degradeManager.reportFault('analytics', error)`
- `lib/analytics/exporters/exporter-registry.ts` → dispatch with 0 exporters → call `degradeManager.reportFault('analytics', error)`
- `lib/feature-flags/feature-flags-manager.ts` → `getEntitlement()` catch → call `degradeManager.reportFault('premiumFeatures', error)`

**Acceptance Criteria**:
- [ ] Each middleware check that detects a system fault calls `degradeManager.reportFault(capability, error, context)`
- [ ] Manager receives report → queues by priority → calls degradationService → appDegrade.set() updates
- [ ] Existing behavior PRESERVED (logs, throws, fallbacks unchanged, only adds manager notification)
- [ ] `appDegrade` state reflects actual system health after bootstrap
- [ ] Import degradeManager from `@/lib/error/degrade` (NOT direct system/Degrade imports in lib files)

**Integration Example**:
```typescript
// Before: lib/middleware/services/database-service.ts
try {
  const db = await initDatabase();
} catch (error) {
  logger.warn('Database unavailable');  // ← Only logs
  throw error;
}

// After:
try {
  const db = await initDatabase();
} catch (error) {
  logger.warn('Database unavailable');
  degradeManager.reportFault('database', error.message);  // ← NEW: routes to priority queue
  throw error;
}
```

**Notes**:
- Manager API `reportFault()` is the single entry point for all middleware errors
- Priority queue ensures Network errors take precedence (cascades to everything else)
- Each file just calls the manager; manager handles orchestration

---

## Track 5.5: Centralize Runtime Degradation & Replace Inline setSafeMode Calls

**Goal**: Replace scattered inline `setSafeMode()` calls with centralized manager `reportCrash()`. Manager internally sets the degrade flag AND triggers safe mode, keeping all degradation logic in one place.

**Pattern**: Runtime error detected → calls `Manager.reportCrash()` → manager queues as critical (highest priority) → safe mode triggered

**Scope**: Runtime patterns (post-bootstrap). See "Track 5.5 Refactoring Checklist" in the Verification Audit section for exact line-level changes.

**Files affected (4 edits)**:
- `lib/offline/sync-manager.ts` → Replace `setSafeMode(NETWORK_CASCADE)` with `degradeManager.reportCrash('sync', 'cascade', cascadeDetails)`
- `lib/auth/health/auth-health-monitor.ts` → Replace `setSafeMode(AUTH_EXPIRED)` with `degradeManager.reportCrash('auth', 'session-expired')`
- `lib/middleware/storage/helpers/storage-health-monitor.ts` → Replace `AppKernel.setSafeMode(STORAGE_UNREADABLE)` with `degradeManager.reportCrash('storage', 'unreadable', storageError)`

**Manager API for Runtime**:
- `reportCrash(capability: DegradeCapability, reason: string, context?: any)` — Critical runtime failure (triggers safe mode + queues with highest priority)
- `reportRecovery(capability: DegradeCapability, reason?: string)` — Signal recovery from previous crash (clears from queue, checks cascading errors)

**Acceptance Criteria**:
- [ ] ZERO inline `setSafeMode()` calls in lib/ (except `kernel-manager.ts` which IS the authoritative API)
- [ ] All runtime degradation flows go through centralized `degradeManager.reportCrash()`
- [ ] Safe mode still triggers correctly (behavior preserved, just routed through manager)
- [ ] `appDegrade` state updated BEFORE safe mode triggers (UI sees reason before redirect)
- [ ] Recovery paths call `degradeManager.reportRecovery()` when applicable
- [ ] Manager queues crash as highest-priority item (always processes first)

**Integration Example**:
```typescript
// Before: lib/offline/sync-manager.ts
if (cascadeDetected) {
  setSafeMode(NETWORK_CASCADE);  // ← Direct call to kernel
}

// After:
if (cascadeDetected) {
  degradeManager.reportCrash('sync', 'cascade-detected', { 
    failureCount: 3, 
    lastAttempt: now 
  });  // ← Routes through manager, safe mode triggered internally
}
```

**Cascading Recovery Flow**:
```typescript
// When network reconnects (Track 7):
degradeManager.reportRecovery('connectivity');
  ├─ Removes connectivity from error queue
  ├─ Manager processes next error (e.g., sync cascade from earlier)
  ├─ If sync now recovers → reportRecovery('sync')
  └─ Error queue empty → safe mode auto-clears (if no other critical errors)
```

**Notes**:
- `reportCrash()` is for unrecoverable errors (need safe mode intervention)
- `reportFault()` is for degradable errors (middleware level, no safe mode yet)
- `reportRecovery()` is called by Track 7 recovery actions
- Storage crash: handler replaces direct `AppKernel.setSafeMode()` import (boundary violation fix)

---

## Track 5.7: Error Priority Documentation

**Goal**: Lock in the priority ordering that governs error queue processing in the manager

**Priority Map** (lower number = higher priority = processes first):

| Priority | Capability | Reason | Cascades To |
|----------|------------|--------|-------------|
| 0 | `connectivity` | Network is foundation; all other systems depend on it. Down connectivity = full offline | database, sync, analytics, errorTracking |
| 1 | `auth` | Authentication is critical for data sync. Down auth = locked account | database, sync, premiumFeatures |
| 2 | `storage` | Local storage failure blocks all persistence (crash-level) | database (queued mutations can't be stored) |
| 3 | `sync` | Sync cascade is transient; data is safe locally but won't push | analytics (events queue instead of fire-and-forget) |
| 4 | `backgroundJobs` | Background job failure is degradable; foreground operations work | analytics (some jobs disabled) |
| 5 | `analytics` | Analytics is optional; zero user-facing impact | N/A |
| 6 | `errorTracking` | Error tracking is informational only; app still functions | N/A |
| 99 | `premiumFeatures` | Premium is optional; app core works without it | N/A |

**Cascading Logic Rules**:

1. **When Network recovers** → check if database/sync can now resume
   - Network down + sync paused → Network up: sync cascade may auto-clear
   - Network down + analytics offline → Network up: analytics resumes

2. **When Auth recovers** → check if data operations can resume
   - Auth invalid + database queued → Auth refreshed: database queries resume
   - Auth invalid + sync paused → Auth refreshed: sync resumes

3. **When Sync recovers** → check if analytics buffering can flush
   - Sync paused + analytics buffering → Sync resumed: analytics fire off queued events

4. **When Storage recovers** → NO cascading (storage was crash, now recovered)
   - Storage crash is unrecoverable at runtime; app reload needed

**Manager Implementation**:
```typescript
// Pseudo-code inside manager
const PRIORITY_MAP = {
  connectivity: 0,
  auth: 1,
  storage: 2,
  sync: 3,
  backgroundJobs: 4,
  analytics: 5,
  errorTracking: 6,
  premiumFeatures: 99,
};

reportFault(capability, reason, context) {
  this.errors.push({ capability, reason, context, priority: PRIORITY_MAP[capability] });
  this.errors.sort((a, b) => a.priority - b.priority);
  
  if (this.errors.length > 0) {
    const nextError = this.errors[0];  // Always process highest priority
    degradationService.updateDegradation(nextError);  // Calls appDegrade.set()
  }
}

reportRecovery(capability, reason) {
  this.errors = this.errors.filter(e => e.capability !== capability);
  
  if (this.errors.length > 0) {
    const nextError = this.errors[0];  // Check if recovery unblocked something
    degradationService.updateDegradation(nextError);  // Re-process queue
  } else {
    degradationService.clearAllDegradation();  // All errors cleared, resume normal
  }
}
```

**Why This Order Matters**:
- Network errors must process first so UI shows "offline" not "database unavailable"
- Auth errors must process second so account-locked message appears before database messages
- Storage is crash-level but low priority because it won't degrade other systems (already dead on arrival)
- Analytics/ErrorTracking are last because they never block core functionality
- PremiumFeatures last because they're optional enhancements

**Notes**:
- Priority is FIXED and baked into manager (never changed at runtime)
- Cascading is AUTOMATIC (manager re-checks queue on recovery)
- UI receives ONE error reason at a time (the highest-priority one) for clarity

---

## Track 6: Create Hooks

**Goal**: React bridge for degradation flags

**Files to create**:
- `hooks/kernel/useDegradation.ts` — full state subscription
- `hooks/kernel/useCapability.ts` — single capability check (with dependency array option)
- `hooks/kernel/index.ts` — re-export

**Acceptance Criteria**:
- [ ] `useDegradation()` returns `{ capabilities: Record<string, boolean>, timestamp }`
- [ ] `useCapability(capability)` returns `boolean`
- [ ] Both follow standard subscription pattern (unsubscribe on unmount)
- [ ] Exported from `hooks/kernel/index.ts`

**Usage**:
```typescript
// Component wants to show different UI based on database availability
const { database } = useDegradation().capabilities;
// or
const canQuery = useCapability('database');
```

**Notes**:
- Hooks don't do logic, just subscribe to manager and return state
- Components can now react to degradation at runtime

---

## Track 6.5: Audit & Plan Bootstrap Cleanup

**Goal**: Identify all bootstrap-level subscriptions and ensure Track 7 doesn't leave dangling listeners

**Acceptance Criteria**:
- [ ] Audit existing bootstrap subscriptions in `system/Kernel/app-kernel.ts`:
  - `bootstrapTimeoutUnsubscribe` (kernel state, cleared in `destroy()`) ✅
  - `networkUnsubscribe` (network detection, cleared in `destroy()`) ✅
  - Analytics network integration (cleaned via `cleanupAnalyticsNetworkIntegration()` in `destroy()`) ✅
- [ ] Identify which subscriptions Track 7 will ADD and map cleanup strategy:
  - Network detection for degradation manager → REUSE existing `networkUnsubscribe` OR create new tracked unsubscriber
  - Job recovery subscriptions → track unsubscribers in `appDegrade` or kernel state
  - Sync recovery subscriptions → track unsubscribers in `appDegrade` or kernel state
  - Service health checks → track unsubscribers or tie into existing service status polling
- [ ] Document decision per subscription: "reuse existing" vs "new unsubscriber"
- [ ] If new unsubscribers created, add cleanup calls to `AppKernel.destroy()` or `appDegrade.cleanup()`

**Notes**:
- **Reuse strategy**: Network detection is already subscribed to during network-phase bootstrap; degrade-manager can listen to existing kernel network state updates instead of creating a NEW subscription
- **New strategy**: Job/sync/service recovery signals may not have existing subscriptions; create tracked unsubscribers
- Prevents memory leaks: all subscriptions must be cleaned up on app shutdown or full reset
- Bootstrap subscriptions live in `AppKernel` lifetime; runtime subscriptions from Track 7 should too

---

## Track 7: Wire into Runtime Updates (Early + Post-Registration)

**Goal**: Runtime changes (network recovery, service restart) update degradation flags reactively

**Files**: 
- Early: `system/Kernel/app-kernel.ts` (after network phase completes)
- Post-registration: `system/Kernel/phases/registration-phase.ts`

**Acceptance Criteria**:

**Early/Runtime (not gated on registration)**:
- [ ] After network-phase completes, subscribe to network detection changes
- [ ] Network reconnects → `appDegrade.set('connectivity', true, { source: 'network-detection', reason: 'back online' })`
- [ ] Network disconnects → `appDegrade.set('connectivity', false, { source: 'network-detection', reason: 'offline' })`
- [ ] Don't wait for registration; update immediately with live subscription

**Post-Registration**:
- [ ] After all jobs/subscriptions are registered, subscribe to their recovery signals
- [ ] Job success → `appDegrade.set(capability, true, { source: 'job-recovery', reason: 'retry succeeded' })`
- [ ] Sync recovery → `appDegrade.set('sync', true, { source: 'sync-manager', reason: 'queue drained' })`
- [ ] Service health check pass → `appDegrade.set('database', true, { source: 'service-health', reason: 'service ready' })`
- [ ] Similar for auth, storage, background jobs

**Integration Points**:
- Early: Network detection subscription (already exists, just wire to degrade manager)
- Post-registration: Job/subscription recovery signals, service health checks, sync success events

**Notes**:
- Split into two phases: connectivity updates immediately, other recovery updates after registration
- Prevents delaying connectivity updates unnecessarily if registration is slow/optional
- Existing event/subscription systems already emit these signals — just tie them to degradation manager

---

## Track 8: Implement Error Handling in Phase Execution

**Goal**: Wire the phase error classifier and phase state into `runPhase()`, with explicit phase-to-capability mapping

**Files affected**:
- `system/Kernel/app-kernel.ts` → `runPhase()` method + phase mapping table
- `system/Kernel/phase-error-classifier.ts` → already exists, use it
- `type-definitions/kernel-types.ts` → `PhaseState` already defined, use it

**Acceptance Criteria**:
- [ ] Create explicit `PHASE_CAPABILITY_MAP` table:
  ```typescript
  const PHASE_CAPABILITY_MAP: Record<PhaseName, DegradeCapability[]> = {
    'config': [],                              // Critical: no degradation allowed
    'preload': [],                             // Critical: no degradation allowed
    'network': ['connectivity'],               // Non-critical: network can degrade
    'storage': ['storage'],                    // Critical: but maps to storage cap for clarity
    'services': ['database', 'auth', 'analytics', 'errorTracking'],
    'jobSetup': [],                            // Critical: no degradation allowed
    'auth': ['auth'],                          // Non-critical
    'featureFlags': ['premiumFeatures'],       // Non-critical
    'registration': ['backgroundJobs', 'sync'],// Non-critical
  }
  ```
- [ ] `runPhase()` imports `classifyPhaseError()` and uses mapping table
- [ ] On catch: call `classifyPhaseError(error)` → get `'unreachable' | 'timeout' | 'non-recoverable'`
- [ ] Non-critical phases (network, auth, featureFlags, registration):
  - `'unreachable'` → set degradation flags from map, skip phase, continue bootstrap
  - `'timeout'` → set degradation flags from map, skip phase, continue bootstrap
  - `'non-recoverable'` → CRASH (error splash screen)
- [ ] Critical phases (config, preload, storage, jobSetup):
  - ALL errors → CRASH (error splash screen)
- [ ] Per-phase error tracking: update kernel state with which phase(s) failed
- [ ] Use `PhaseState` interface for structured errors (optional: migrate from boolean flags to full phase state)

**Example logic**:
```typescript
private async runPhase(phaseName: PhaseName, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    const failureType = classifyPhaseError(error);
    const capabilities = PHASE_CAPABILITY_MAP[phaseName];
    
    if (CRITICAL_PHASES.includes(phaseName)) {
      // Always crash
      throw error;
    }
    
    // Non-critical: decide to skip or crash
    if (failureType === 'non-recoverable') {
      throw error; // Crash
    }
    
    // Set degradation flags for all capabilities this phase affects
    capabilities.forEach(cap => {
      appDegrade.set(cap, false, { 
        source: phaseName, 
        reason: `${phaseName} failed: ${failureType}` 
      });
    });
    
    // Skip phase and continue
    logger.warn(`${phaseName} skipped due to ${failureType}`, 
      { capabilities, durationMs: performance.now() });
    return;
  }
}
```

**Notes**:
- This is the #1 blocker from the audit — currently ALL phases crash equally
- After this, non-critical phases can fail gracefully
- Degradation flags allow app to adapt behavior instead of just crashing

---

## Dependency Order

**Must complete in this order** (dependencies between tracks):

```
Track 1 (Foundation) ✅
    ↓
Track 2 (Define flags) ✅ — depends on Track 1
    ↓
Track 3 (Wire flags to kernel phases) ✅ — depends on Tracks 1 & 2
    ↓
Track 3.5 (Define response paths) ✅ — depends on Track 3
    ↓
Track 4 (lib manager + middleware) ✅ — depends on Tracks 1, 2, 3
    ↓
Track 5 (Bootstrap lib refactoring) — depends on Track 4
    ↓
Track 5.5 (Runtime lib refactoring) — depends on Track 5
    ↓
Track 6 (Hooks) — depends on Tracks 4 & 5
    ↓
Track 6.5 (Cleanup audit) — depends on Track 6 (plan subscriptions before wiring)
    ↓
Track 7 (Runtime recovery) — depends on Track 6.5 (knows what to subscribe/cleanup)
    ↓
Track 8 (Error handling in runPhase) — depends on Tracks 3 & 7
```

Tracks 1-4 are COMPLETE. Track 5 and 5.5 are next (lib refactoring).
Track 5 and 5.5 are separated to keep bootstrap vs runtime refactoring focused.

---

## Testing Strategy

**Per track**:
- Track 1-2: TypeScript compilation (types are correct)
- Track 3-5: Verify flags set during phase execution (add logging, inspect manager state)
- Track 6: Hook renders correctly, updates on degradation state change
- Track 6.5: Code review of bootstrap subscriptions list + cleanup plan document (no code changes)
- Track 7: Network change → flag updates; job recovery → flag updates; no memory leaks on destroy
- Track 8: Non-critical phase failure → flag set, phase skipped, bootstrap continues

**Memory leak tests** (for Track 6.5/7):
- Create app, run to appReady, call `kernel.destroy()` → all subscriptions cleaned
- Inspect `networkUnsubscribe`, degradation subscriptions are null after destroy
- No console warnings about "unsubscribed twice" or "null reference" errors

**Manual tests**:
- Network disconnects during bootstrap → `connectivity` flag set → app continues
- Database query fails during service init → `database` flag set → app continues
- Auth expires mid-app → `auth` flag set → UI shows unauthenticated state
- Service recovers → flag reset → UI returns to normal
- App destroy → all subscriptions cleaned up, no dangling listeners

---

## Success Criteria (After All Tracks)

- [ ] Phases can fail gracefully without crashing app
- [ ] Degradation flags centrally tracked and subscribed to (8 capabilities with per-source metadata)
- [ ] UI can react to capability changes in real-time
- [ ] Bootstrap completes even if non-critical phases fail
- [ ] Service recovery updates flags reactively
- [ ] No backwards compatibility code (all old error paths refactored)
- [ ] All 8 capability flags wired and tested (database, auth, sync, connectivity, storage, backgroundJobs, analytics, errorTracking, premiumFeatures)
- [ ] Zero new errors related to phase execution (if any phase fails now, it's graceful)
- [ ] **Zero memory leaks**: All bootstrap subscriptions AND runtime subscriptions cleaned up in `AppKernel.destroy()`
- [ ] Cleanup audit completed: all subscriptions categorized (reuse vs new tracker)

---

## Degradation Handler Audit

Audit of all error handlers that should wire into `appDegrade`. Categorized by capability flag.

**Legend:**
- **Location** — Where the error handling currently lives
- **Move to Degrade?** — Can the handler logic be centralized in `system/Degrade/` or `lib/Degrade/`?
- **Phase Error?** — Is this a bootstrap phase error (B) or runtime error (R) or both (B+R)?
- **Subscribed After Bootstrap?** — Does this need to stay listening after bootstrap completes?

### Connectivity

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `connectivity` | Network detection fails to initialize | `system/Kernel/phases/network-phase.ts` catch block (line ~60) | YES — handler just logs + continues, can centralize | B | NO — init is one-shot |
| `connectivity` | Network status changes (online↔offline) | `system/Kernel/app-kernel.ts` `setupNetworkSubscription()` (line ~346) via `NetworkDetection.subscribe()` | YES — subscribe once in degrade handler, update flag reactively | B+R | **YES** — network changes at runtime |
| `connectivity` | Network telemetry init fails | `system/Kernel/phases/network-phase.ts` inner catch (line ~55) | NO — telemetry failure doesn't degrade connectivity, just skip | B | NO |

### Database

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `database` | Database provider fails to initialize | `system/Services/service-initializer.ts` `initializeDatabaseProvider()` — 6 `updateServiceStatus('database', 'failed/degraded')` calls | YES — handler registers NoOp fallback + sets status. Degrade handler reads status after services-phase | B | NO — init is one-shot |
| `database` | Database not configured (no env vars) | `system/Services/service-initializer.ts` `initializeDatabaseProvider()` — disabled/No config paths | YES — same pattern, just read service status | B | NO |

### Auth

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `auth` | Auth provider fails to initialize | `system/Services/service-initializer.ts` `initializeAuthProvider()` — 8 `updateServiceStatus('auth', 'failed')` calls | YES — read service status after services-phase | B | NO — init is one-shot |
| `auth` | Auth session dead (>30 days) | `system/Kernel/phases/auth-phase.ts` DEAD path (line ~85) | NO — this clears storage + exits early, not a "degraded" state. User just needs to re-login. useAuthGuard handles redirect. | B | NO |
| `auth` | Auth session stale (4-30 days) | `system/Kernel/phases/auth-phase.ts` STALE path | NO — deferred to sync-splash for re-auth, not a degrade event. Auth still works locally. | B | NO |

### Storage

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `storage` | Storage phase initialization fails | `system/Kernel/phases/storage-phase.ts` catch block (line ~84) | YES — handler just logs, can flag storage as degraded | B | NO — init is one-shot |
| `storage` | SecureStorage read/write failures at runtime | Scattered catch blocks in `lib/auth/auth-state.ts`, `lib/storage/` | NO — these are individual operation failures. Storage itself is not gone, just one key failed. Retry/log handles it. | R | N/A |

### Sync

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `sync` | Network cascade detected (repeated sync failures) | `lib/offline/sync-manager.ts` (line ~285) — calls `setSafeMode(NETWORK_CASCADE)` | YES — perfect candidate. Handler detects cascade + triggers safe mode. Centralize in degrade. | R | **YES** — cascade can happen anytime during runtime |
| `sync` | Offline mutation sync fails | `lib/offline/sync-manager.ts` catch block (line ~280) | NO — individual sync failure feeds into cascade detector. Only cascade is degrade-worthy. | R | N/A |

### Background Jobs

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `backgroundJobs` | Job queue infrastructure fails to initialize | `system/Kernel/phases/job-setup-phase.ts` catch block (line ~55) | YES — handler just logs, can centralize flag | B | NO — init is one-shot |
| `backgroundJobs` | Job handler registration fails | `system/Kernel/phases/registration-phase.ts` per-job catch (line ~50) | PARTIAL — individual handler failures don't mean ALL jobs are gone. Only flag if entire registration-phase outer catch fires. | B | NO — registration is one-shot |

### Analytics

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `analytics` | Analytics exporter fails to initialize | `system/Services/service-initializer.ts` `initializeSentryExporter()` — sets `updateServiceStatus('analytics', 'failed/degraded')` | YES — read service status after services-phase | B | NO — init is one-shot |
| `analytics` | Analytics disabled in config | `system/Services/service-initializer.ts` — sets `updateServiceStatus('analytics', 'disabled')` | YES — read config flag, set degrade flag | B | NO |

### Error Tracking

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `errorTracking` | Error tracker fails to initialize | `system/Services/service-initializer.ts` `initializeErrorTracker()` — registers NoOp fallback + sets `updateServiceStatus('errorTracker', 'failed/degraded')` | YES — read service status after services-phase | B | NO — init is one-shot |
| `errorTracking` | Both error provider and analytics disabled | `system/Services/service-initializer.ts` — sets `updateServiceStatus('errorTracker', 'disabled')` | YES — read config, set flag | B | NO |

### Premium Features

| Flag | Error Handler | Current Location | Move to Degrade? | Phase? | Subscribed After Bootstrap? |
|------|--------------|------------------|-------------------|--------|----------------------------|
| `premiumFeatures` | Feature flags phase fails | `system/Kernel/phases/feature-flags-phase.ts` catch block (line ~100+) | YES — handler falls back to hardcoded defaults. flag premium as degraded. | B | NO — loads defaults as fallback |
| `premiumFeatures` | Feature flags cache stale/dead | `system/Kernel/phases/feature-flags-phase.ts` freshness check | NO — stale/dead loads hardcoded defaults. This is a fallback, not degradation. Sign-in refreshes. | B | NO |

---

### Audit Summary

| Capability | Total Handlers | Move to Degrade | Stay Inline | Subscribed After Bootstrap |
|-----------|---------------|-----------------|-------------|---------------------------|
| `connectivity` | 3 | 2 | 1 | **1 (network status changes)** |
| `database` | 2 | 2 | 0 | 0 |
| `auth` | 3 | 1 | 2 | 0 |
| `storage` | 2 | 1 | 1 | 0 |
| `sync` | 2 | 1 | 1 | **1 (cascade detection)** |
| `backgroundJobs` | 2 | 1 | 1 | 0 |
| `analytics` | 2 | 2 | 0 | 0 |
| `errorTracking` | 2 | 2 | 0 | 0 |
| `premiumFeatures` | 2 | 1 | 1 | 0 |
| **TOTAL** | **20** | **13** | **7** | **2** |

### Key Findings

1. **13 of 20 handlers can be centralized** into `system/Degrade/` or `lib/Degrade/`
2. **Only 2 need runtime subscriptions** after bootstrap:
   - `connectivity` — NetworkDetection status changes (online/offline)
   - `sync` — Network cascade detection (repeated sync failures)
3. **7 should stay inline** — they're either not degrade-worthy (individual operation failures) or have complex local logic (auth session staleness evaluation)
4. **Most bootstrap handlers** just need to READ service status after services-phase completes — centralized degrade handler can poll `getAllServiceStatuses()` once after services phase
5. **Overlap with existing KernelCapabilities** — `app-kernel.ts` already detects `storage`, `network`, `auth`, `analytics`, `backend` capabilities during `detectCapabilities()`. Degrade system should REPLACE this (not duplicate it)

### Cleanup Opportunity

The existing `KernelCapabilities` in `app-kernel.ts` (`detectCapabilities()`) does similar work to what appDegrade would do. During implementation, we should:
- Have appDegrade be the single source of truth for capability state
- Remove or thin out `detectCapabilities()` to just detect platform
- Wire `kernel.state.capabilities` to read from appDegrade instead of maintaining its own copy

---

## Runtime Degradation Audit

The bootstrap audit above covers phase failures during startup. This section covers **runtime error paths** — what happens when a capability fails AFTER the app is running. The goal is to identify where `appDegrade` should be called, how (subscription vs on-demand function), and where the logic should live.

### Design Principles

1. **Always-listening subscriptions** — Only for systems where state can flip at any time (network). Immediate degradation needed.
2. **On-demand functions** — For call-driven systems (database, auth, analytics). Only degrade when the app actually tries to use the capability and it fails. Saves memory, no wasted listeners.
3. **All handler logic lives in `lib/Degrade/handlers/`** — Centralized, not scattered inline. Even on-demand functions are defined in degrade module and called from middleware.
4. **Crash-worthy vs degrade-worthy** — Storage failure = crash (unrecoverable). Auth token expiry = degrade (recoverable). Both live in degrade module but logically separated for future extraction.

### Subscription Model

| Capability | Type | Rationale |
|---|---|---|
| `connectivity` | **SUBSCRIPTION** | Network state flips anytime. App needs instant awareness. `NetworkDetection.subscribe()` exists. |
| `sync` | **SUBSCRIPTION** | Network cascade detection (repeated sync failures). `SyncManager.recordFailure()` already tracks failures. Subscribe to cascade events, degrade immediately when threshold exceeded. |
| `backgroundJobs` | **SUBSCRIPTION** | If jobs start failing repeatedly, we should know ASAP to avoid wasting work. `jobQueue.subscribe()` exists for job events. **Handling strategy TBD** — currently no graceful fallback for permanent job failures (future: exponential backoff, user notification, or recovery mode). |
| `database` | **ON-DEMAND** | Only matters when app makes a DB call. Middleware checks `isDatabaseReady()` + `isNetworkAvailable()` before each call. Wire degrade on failure path. |
| `auth` | **ON-DEMAND** | Only matters during auth operations. Middleware `ensureAuthReady()` checks provider + network. Wire degrade on provider-missing or repeated failures. |
| `analytics` | **ON-DEMAND** | Only matters during event dispatch. Exporter registry checks `getEnabledExporters()`. Wire degrade if no exporters available. |
| `errorTracking` | **ON-DEMAND** | Only matters when reporting errors. Middleware `canReport()` checks provider + consent. Wire degrade if tracker not ready. |
| `storage` | **ON-DEMAND (CRASH)** | Storage health monitor already runs via job queue every 5 min. If storage fails, triggers safe mode. Wire degrade BEFORE safe mode for visibility. |
| `premiumFeatures` | **ON-DEMAND** | Only checked when accessing premium feature. Feature flag check determines availability. Wire degrade if entitlement check fails. |

### Runtime Error Paths — Detailed Audit

#### 1. CONNECTIVITY (Subscription)

| Item | Details |
|---|---|
| **Current location** | `lib/middleware/network/network-integration.ts` — `subscribeToNetworkStatus()` wraps `NetworkDetection.subscribe()` |
| **Existing API** | `NetworkDetection.subscribe(callback)` returns unsubscribe function |
| **What fires** | Callback with `{ isOnline, connectionQuality, type }` on every status change |
| **Degrade handler** | `lib/Degrade/handlers/connectivity-handler.ts` — Subscribe during bootstrap, stays active forever |
| **Logic** | `appDegrade.set('connectivity', status.isOnline, { source: 'network-detection', reason: status.isOnline ? 'online' : 'offline' })` |
| **Stays subscribed** | YES — network can change anytime |

#### 2. BACKGROUND_JOBS (Subscription)

| Item | Details |
|---|---|
| **Current location** | `system/Jobs/background-job-queue.ts` — `subscribe(subscriber)` fires on job completion/failure events |
| **Existing API** | `jobQueue.subscribe(event => ...)` returns unsubscribe function. Events: `JobCompletedEvent`, `JobFailedEvent` |
| **What fires** | `JobFailedEvent` with `{ jobId, type, error, retryCount, maxRetries }` when a job permanently fails |
| **Degrade handler** | `lib/Degrade/handlers/background-jobs-handler.ts` — Subscribe during bootstrap, listens for repeated permanent failures |
| **Logic** | Track permanent failure count. If N jobs fail permanently within time window → `appDegrade.set('backgroundJobs', false, { source: 'job-cascade', reason: 'N jobs failed permanently in X minutes' })`. Reset on success. |
| **Stays subscribed** | YES — jobs run throughout app lifetime |
| **Handling Strategy** | **TBD** — Currently no graceful fallback for permanent job failures. When `backgroundJobs` flag is false, app shows "background tasks disabled" in UI and queues work manually. Recovery: exponential backoff + notification, manual retry UI, or read-only mode. Implementation deferred to future track. |

#### 3. DATABASE (On-Demand)

| Item | Details |
|---|---|
| **Current location** | `lib/middleware/services/database-service.ts` — `isDatabaseReady()` + `isNetworkAvailable()` checked before every DB call |
| **Existing checks** | `isDatabaseReady()` → `isServiceReady('database')`. `isNetworkAvailable()` → `NetworkDetection.getStatus()` |
| **Error paths** | 1. Provider not ready → logs warning, returns NoOp provider (queries will throw). 2. Network offline → logs debug, returns provider anyway (request-manager queues). 3. RPC/query throws → caught in entity files |
| **Degrade handler** | `lib/Degrade/handlers/database-handler.ts` — Exports `checkDatabaseHealth()` function |
| **Logic** | Called from `getDatabase()` and `getDatabaseWithAuth()` error paths. If provider not ready OR repeated query failures → `appDegrade.set('database', false, { source: 'middleware', reason })`. If provider comes back → `appDegrade.set('database', true, ...)` |
| **Stays subscribed** | N/A — on-demand function, no subscription |

#### 4. AUTH (On-Demand)

| Item | Details |
|---|---|
| **Current location** | `lib/middleware/services/auth-service.ts` — `ensureAuthReady()` checks network + provider before every auth op |
| **Existing checks** | 1. `NetworkDetection.getStatus()` → throws `AppError(NETWORK.OFFLINE)` if offline. 2. `rawGetAuthProviderSync()` + `isServiceReady('auth')` → throws `AppError(AUTH.UNKNOWN)` if no provider |
| **Error paths** | `ensureAuthReady()` throws typed errors. Manager catches and returns `{ success: false, error: message }`. Individual op failures (sign-in, sign-out) return error results. |
| **Degrade handler** | `lib/Degrade/handlers/auth-handler.ts` — Exports `checkAuthHealth()` function |
| **Logic** | Called when `ensureAuthReady()` fails with provider-missing (not network-offline, that's connectivity's job). `appDegrade.set('auth', false, { source: 'auth-middleware', reason: 'provider not available' })` |
| **Stays subscribed** | N/A — on-demand |
| **Note** | Individual sign-in failures are NOT degrade-worthy (user error). Provider-missing IS degrade-worthy (system broken). |

#### 5. ANALYTICS (On-Demand)

| Item | Details |
|---|---|
| **Current location** | `lib/analytics/exporters/exporter-registry.ts` — `getEnabledExporters()` / `getExportersForEventType()` checked on dispatch |
| **Existing checks** | `dispatchSingleWithTimeout()` gets exporters → if 0 exporters, logs debug and skips. Consent check also gates. |
| **Error paths** | Silent drop if no exporters. Individual exporter failures logged but isolated (`Promise.allSettled`). |
| **Degrade handler** | `lib/Degrade/handlers/analytics-handler.ts` — Exports `checkAnalyticsHealth()` function |
| **Logic** | If `exporterRegistry.getEnabledExporters().length === 0` AND analytics is supposedly enabled in config → `appDegrade.set('analytics', false, { source: 'exporter-registry', reason: 'no enabled exporters' })` |
| **Stays subscribed** | N/A — on-demand |

#### 6. ERROR_TRACKING (On-Demand)

| Item | Details |
|---|---|
| **Current location** | `lib/middleware/services/error-service.ts` — `canReport()` checks consent + provider readiness |
| **Existing checks** | 1. Consent level check (drop if 'none'). 2. `isServiceReady('errorTracker')` → drop if not ready. |
| **Error paths** | Silent drop and debug log. No throwing. |
| **Degrade handler** | `lib/Degrade/handlers/error-tracking-handler.ts` — Exports `checkErrorTrackingHealth()` function |
| **Logic** | If `!isServiceReady('errorTracker')` and config says it should be enabled → `appDegrade.set('errorTracking', false, { source: 'error-middleware', reason: 'tracker not ready' })` |
| **Stays subscribed** | N/A — on-demand |

#### 7. STORAGE (On-Demand / CRASH category)

| Item | Details |
|---|---|
| **Current location** | `lib/middleware/storage/helpers/storage-health-monitor.ts` — `validateStorageHealth()` runs at boot + every 5 min via job queue |
| **Existing checks** | Write test key → read it back → compare. If mismatch: attempt recovery (clear QueryCache). If recovery fails: trigger `SafeMode(STORAGE_UNREADABLE)`. |
| **Error paths** | Recovery attempt → if fails → `AppKernel.setSafeMode(safeMode)` (hard crash to safe mode). |
| **Degrade handler** | `lib/Degrade/handlers/storage-handler.ts` — Exports `checkStorageHealth()` function |
| **Logic** | Wire BEFORE safe mode trigger: `appDegrade.set('storage', false, { source: 'storage-health-monitor', reason: 'storage unreadable, recovery failed' })`. Then safe mode triggers normally. Degrade flag provides visibility before crash. |
| **Stays subscribed** | N/A — called by storage health job (every 5 min). Job subscription handles scheduling. |
| **CRASH category** | YES — storage failure is unrecoverable. Keep logically separate in handlers for future error-system extraction. |

#### 8. SYNC (Subscription)

| Item | Details |
|---|---|
| **Current location** | `lib/offline/sync-manager.ts` — `NetworkCascadeDetector.recordFailure()` tracks consecutive sync failures |
| **Existing checks** | Cascade threshold: if N consecutive failures → enters DEGRADED safe mode |
| **Subscription API** | `SyncManager` should emit cascade events when threshold crossed. Subscribe to these events during bootstrap. |
| **Degrade handler** | `lib/Degrade/handlers/sync-handler.ts` — Subscribe to cascade events and degradation recovery |
| **Logic** | **On cascade detected:** `appDegrade.set('sync', false, { source: 'cascade-detector', reason: 'N consecutive sync failures' })`. **On cascade cleared (queue drained):** `appDegrade.set('sync', true, { source: 'cascade-detector', reason: 'sync queue cleared' })` |
| **Stays subscribed** | YES — sync runs throughout app lifetime, cascade can happen anytime |

#### 9. PREMIUM_FEATURES (On-Demand)

| Item | Details |
|---|---|
| **Current location** | `lib/feature-flags/` — Feature flag evaluation checks entitlements |
| **Existing checks** | `isEnabled()` / `isEnabledForUser()` evaluates flag + cohort + conditions |
| **Error paths** | Defaults to disabled if flag load fails. Config-based fallback. |
| **Degrade handler** | `lib/Degrade/handlers/premium-handler.ts` — Exports `checkPremiumAccess()` function |
| **Logic** | If feature flag service fails to load AND premium features are expected → `appDegrade.set('premiumFeatures', false, { source: 'feature-flags', reason: 'flag service unavailable' })` |
| **Stays subscribed** | N/A — on-demand |

### Summary: Handler File Structure

```
lib/Degrade/handlers/
├── connectivity-handler.ts      ← SUBSCRIPTION (always-listening)
├── background-jobs-handler.ts   ← SUBSCRIPTION (always-listening)
├── database-handler.ts          ← ON-DEMAND function
├── auth-handler.ts              ← ON-DEMAND function
├── analytics-handler.ts         ← ON-DEMAND function
├── error-tracking-handler.ts    ← ON-DEMAND function
├── storage-handler.ts           ← ON-DEMAND function (CRASH category)
├── sync-handler.ts              ← ON-DEMAND function
└── premium-handler.ts           ← ON-DEMAND function
```

### Integration Points (Where middleware calls degrade handlers)

| Middleware File | Calls Handler | When |
|---|---|---|
| `lib/middleware/network/network-integration.ts` | `connectivity-handler` | Initialized during bootstrap, stays active |
| `lib/middleware/jobs/job-service.ts` | `background-jobs-handler` | Initialized during bootstrap, stays active |
| `lib/middleware/services/database-service.ts` | `database-handler.checkDatabaseHealth()` | When `isDatabaseReady()` returns false |
| `lib/middleware/services/auth-service.ts` | `auth-handler.checkAuthHealth()` | When `ensureAuthReady()` throws provider-missing |
| `lib/middleware/services/error-service.ts` | `error-tracking-handler.checkErrorTrackingHealth()` | When `canReport()` returns false (tracker not ready) |
| `lib/analytics/exporters/exporter-registry.ts` | `analytics-handler.checkAnalyticsHealth()` | When `getEnabledExporters()` returns empty |
| `lib/middleware/storage/helpers/storage-health-monitor.ts` | `storage-handler.checkStorageHealth()` | When `validateStorageHealth()` recovery fails (BEFORE safe mode) |
| `lib/offline/sync-manager.ts` | `sync-handler.reportSyncFailure()` | When `cascadeDetector.recordFailure()` exceeds threshold |
| `lib/feature-flags/` | `premium-handler.checkPremiumAccess()` | When entitlement check fails |

### Corrections from Bootstrap Audit

| Change | Reason |
|---|---|
| `sync` changed from SUBSCRIPTION → ON-DEMAND | Sync = database + network + jobs. No independent state to listen to. Cascade detector already tracks failures on-demand. |
| `backgroundJobs` added as SUBSCRIPTION | Job queue has `subscribe()` API for failure events. Repeated permanent failures should trigger immediate awareness. Better use of subscription than sync. |

---

## Lib-Level Verification Audit (Pre-Track 5/5.5)

**Purpose**: Verify ACTUAL inline degradation/fault/crash logic in lib files against our theoretical audit. Identifies every piece of inline code that Track 5 (bootstrap refactoring) and Track 5.5 (runtime refactoring) need to centralize.

**Methodology**: Read every relevant lib/ file. For each inline pattern found, classify as:
- **FAULT** — Recoverable degradation (retry/fallback available)
- **CRASH** — Unrecoverable failure (safe mode / error boundary)
- **CHECK** — Precondition/readiness check that should report to appDegrade
- **SAFE** — Already correct, no refactoring needed

### Track 5 Scope: Bootstrap-Time Patterns

These patterns are called during kernel bootstrap phases. Track 5 centralizes them.

#### File: `lib/middleware/services/database-service.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `isDatabaseReady()` | CHECK | Returns `isServiceReady('database')` boolean | **Wire to appDegrade**: When `getDatabase()` sees `!isDatabaseReady()` → call `reportDatabaseFault()` |
| `isNetworkAvailable()` | CHECK | Checks `NetworkDetection.getStatus().connectionQuality !== OFFLINE` | **SAFE** — Connectivity is already handled by connectivity-handler subscription |
| `getDatabase()` warning path | FAULT | Logs warning if `!isDatabaseReady()`, returns NoOp provider | **Wire**: After log, call `reportDatabaseFault('Database provider not initialized')` |
| `getDatabaseWithAuth()` throw | FAULT | Throws if `!isServiceReady('auth')` | **Wire**: Before throw, call `reportAuthFault('Auth provider not ready for DB operation')` |

#### File: `lib/middleware/services/auth-service.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `ensureAuthReady()` network check | CHECK+THROW | Throws `AppError(NETWORK.OFFLINE)` | **SAFE** — Network=connectivity, handled by connectivity-handler |
| `ensureAuthReady()` provider check | CHECK+THROW | Throws `AppError(AUTH.UNKNOWN)` if provider missing | **Wire**: Before throw, call `reportAuthFault('Auth provider not initialized')` |
| `isAuthConfigured()` | CHECK | Returns boolean for guard checks | **SAFE** — This is a query, not a fault path. Used by auth-state, auth-health-monitor |
| `getAuthSync()` not-ready | CHECK | Returns null if not ready | **SAFE** — Callers handle null (no fault to report) |

#### File: `lib/middleware/services/error-service.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `canReport()` consent=none | CHECK | Drops report, logs debug | **SAFE** — Consent-based, not a system fault |
| `canReport()` consent module failure | FAULT | Catches require() error, defaults to allowing report | **Wire**: Call `reportErrorTrackingFault('Consent module failed to load')` |
| `canReport()` tracker not ready | CHECK | Drops report, logs debug | **Wire**: Call `reportErrorTrackingFault('Error tracker not ready')` |

#### File: `lib/middleware/services/analytics-service.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `canSendAnalytics()` consent=none | CHECK | Drops data, logs debug | **SAFE** — Consent-based, not a system fault |
| `canSendAnalytics()` provider not ready | CHECK | Drops data, logs debug | **Wire**: Call `reportAnalyticsFault('Analytics provider not ready')` |
| `getBreadcrumbProvider()` not registered | FAULT | Logs warning, returns null | **Wire**: Call `reportAnalyticsFault('Provider not registered: <name>')` |
| `sendBreadcrumbs()` failure | FAULT | Logs warning, returns null | **SAFE** — Individual send failure, not system degradation |

### Track 5.5 Scope: Runtime Patterns

These patterns run after bootstrap, during normal app operation. Track 5.5 centralizes them.

#### File: `lib/offline/sync-manager.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| L278 `NetworkCascadeDetector.recordSuccess()` | RECOVERY | Resets cascade counter on sync success | **Wire**: Also call `reportSyncRecovery('sync success')` to clear SYNC degrade flag |
| L284-296 `NetworkCascadeDetector.recordFailure()` + `setSafeMode()` | CRASH | Cascaded: records failure → checks threshold → triggers DEGRADED safe mode | **Replace**: Call `reportSyncCascade(failures)` which internally: (1) sets SYNC degrade flag, (2) triggers safe mode. Removes inline `setSafeMode()` call. |
| `onNetworkStatusChanged()` | CHECK | Checks `isOnline`, triggers sync when online | **SAFE** — This is sync trigger logic, not degradation |

#### File: `lib/auth/health/auth-health-monitor.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| L74-77 `isAuthConfigured()` check | CHECK | Skips health check if auth not configured | **SAFE** — Correct behavior, nothing to degrade |
| L93-106 `!isAuthenticated` + `hadPreviousAccount` | FAULT→CRASH | Triggers `setSafeMode(AUTH_EXPIRED)` | **Replace**: Call `reportAuthSessionExpired()` which internally: (1) sets AUTH degrade flag, (2) triggers safe mode. Removes inline `setSafeMode()`. |

#### File: `lib/middleware/storage/helpers/storage-health-monitor.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| L84-93 write/read mismatch recovery | FAULT | Attempts recovery (clears QueryCache) | **SAFE** — Recovery logic stays inline |
| L98-111 recovery failed → safe mode | CRASH | `AppKernel.setSafeMode(STORAGE_UNREADABLE)` | **Replace**: Call `reportStorageHealthCrash(reason)` which internally: (1) sets STORAGE degrade flag, (2) triggers safe mode. Removes direct `AppKernel.setSafeMode()` call. |

#### File: `lib/auth/auth-state.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `getAuthState()` catch | FAULT | Returns `{ hasAccount: false }` | **SAFE** — Storage read failure with local fallback (not auth degradation) |
| `setHasAccount()` catch | FAULT | Logs error, continues | **SAFE** — Individual write failure, non-critical |
| `clearAuthState()` FastCache catch | FAULT | Logs warning, continues | **SAFE** — Explicitly non-critical per comment |
| `clearAuthState()` world access catch | FAULT | Logs warning, continues | **SAFE** — Explicitly non-critical per comment |
| `isAuthenticated()` timeout | FAULT | Falls back to local auth state after 2s | **SAFE** — Graceful fallback, not degradation (auth is still "available", just slow) |

#### File: `lib/auth/auth-manager.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `signInUser()` catch (timeout/fetch) | FAULT | Returns `{ success: false, error: message }` | **SAFE** — User-facing error, not system degradation |
| `verifyCredentials()` catch | FAULT | Returns `{ success: false, error }` | **SAFE** — Same pattern |
| `signUpUser()` catch | FAULT | Returns `{ success: false, error }` | **SAFE** — Same pattern |
| All other catch blocks | FAULT | Return error results to caller | **SAFE** — These are user operations returning error results, not system faults |

#### File: `lib/error/network-cascade-detector.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `recordFailure()` threshold check | CHECK | Returns `true` when cascade detected | **SAFE** — This is the detector itself. sync-manager acts on the return value (covered above). |
| `recordSuccess()` reset | RECOVERY | Resets counter | **SAFE** — This is the detector's own logic. |

#### File: `lib/analytics/exporters/exporter-registry.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `getEnabledExporters()` returns empty | CHECK | Filter returns 0 results | **Wire**: When dispatch finds 0 enabled exporters, call `reportAnalyticsFault('no enabled exporters')` |

#### File: `lib/error/safemode/recovery-actions.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `handleClearCache()` | RECOVERY | Clears QueryCache + app data | **Future**: After successful recovery, call `reportStorageRecovery()` and `reportSyncRecovery()` etc. |
| `handleResetAuth()` | RECOVERY | Clears session, redirects to login | **Future**: After recovery, call `reportAuthRecovery()` |

#### File: `lib/database/database-manager.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `isDatabaseConfigured()` | CHECK | Wraps middleware `isDatabaseConfigured()` | **SAFE** — Query function, already wired via middleware |
| `validateCurrentUser()` null return | CHECK | Returns null if user validation fails | **SAFE** — Caller-side handling, not a system fault |
| `validateUserForWrite()` cache failure | FAULT | Logs warning, continues | **SAFE** — Non-critical per comment |

#### File: `lib/feature-flags/feature-flags-manager.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `verifyDeviceClock()` catch | FAULT | Returns `true` (assume safe) on error | **SAFE** — Defensive, no degradation needed |
| `getEntitlement()` catch | FAULT | Returns `{ granted: false, source: 'error' }` on failure | **Wire**: Call `reportPremiumFault('entitlement check failed')` when server check fails |

#### File: `lib/kernel/kernel-manager.ts`

| Line(s) | Pattern | Classification | Current Behavior | Proposed Centralization |
|---------|---------|---------------|-----------------|------------------------|
| `setSafeMode()` / `clearSafeMode()` | N/A | Facade for `AppKernel.setSafeMode()` | **SAFE** — This IS the centralized safe mode API. Not a fault pattern. |

### Verification Summary

| Category | Count | Action |
|----------|-------|--------|
| **Wire to appDegrade** (Track 5 bootstrap) | 8 | Add fault report calls to middleware precondition checks |
| **Replace inline setSafeMode** (Track 5.5 runtime) | 3 | Replace `setSafeMode()` calls with centralized degrade handlers that internally trigger safe mode |
| **Wire recovery** (Track 5.5 runtime) | 2 | Add recovery reports when operations succeed after prior failure |
| **SAFE (no change needed)** | 25+ | Already correct: user-facing errors, consent checks, local fallbacks, non-critical catches |
| **Future (deferred)** | 2 | Recovery-action → degrade recovery path (needs recovery wiring first) |

### Track 5 Refactoring Checklist

Bootstrap-time changes (init/precondition paths):

- [ ] `lib/middleware/services/database-service.ts` → `getDatabase()` warn path: add `reportDatabaseFault()`
- [ ] `lib/middleware/services/database-service.ts` → `getDatabaseWithAuth()` throw path: add `reportAuthFault()` before throw
- [ ] `lib/middleware/services/auth-service.ts` → `ensureAuthReady()` provider-missing path: add `reportAuthFault()` before throw
- [ ] `lib/middleware/services/error-service.ts` → `canReport()` consent-module-failure: add `reportErrorTrackingFault()`
- [ ] `lib/middleware/services/error-service.ts` → `canReport()` tracker-not-ready: add `reportErrorTrackingFault()`
- [ ] `lib/middleware/services/analytics-service.ts` → `canSendAnalytics()` provider-not-ready: add `reportAnalyticsFault()`
- [ ] `lib/analytics/exporters/exporter-registry.ts` → dispatch with 0 exporters: add `reportAnalyticsFault()`
- [ ] `lib/feature-flags/feature-flags-manager.ts` → `getEntitlement()` catch: add `reportPremiumFault()`

### Track 5.5 Refactoring Checklist

Runtime changes (replace inline setSafeMode, add recovery):

- [ ] `lib/offline/sync-manager.ts` L284-296 → Replace inline `setSafeMode(NETWORK_CASCADE)` with call to centralized `reportSyncCascade()` handler
- [ ] `lib/offline/sync-manager.ts` L278 → After `NetworkCascadeDetector.recordSuccess()`, call `reportSyncRecovery()`
- [ ] `lib/auth/health/auth-health-monitor.ts` L93-106 → Replace inline `setSafeMode(AUTH_EXPIRED)` with call to centralized `reportAuthSessionExpired()` handler
- [ ] `lib/middleware/storage/helpers/storage-health-monitor.ts` L98-111 → Replace inline `AppKernel.setSafeMode(STORAGE_UNREADABLE)` with call to centralized `reportStorageHealthCrash()` handler
- [ ] `lib/error/safemode/recovery-actions.ts` → After successful `handleClearCache()` and `handleResetAuth()`, integrate degrade recovery calls (deferred to Track 7)
