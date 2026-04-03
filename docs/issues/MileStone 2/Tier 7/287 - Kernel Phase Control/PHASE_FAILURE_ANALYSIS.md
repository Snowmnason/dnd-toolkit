# Kernel Phase Failure Analysis

**Issue**: #287 - Kernel Advanced Phase Control  
**Milestone**: 2 (Tier 7)  
**Status**: Planning  

---

## Overview

This document maps all kernel bootstrap phases to their failure scenarios and degradation paths. Each phase is categorized as **CRITICAL** (must succeed or app crashes) or **NON-CRITICAL** (can fail with graceful degradation).

For **NON-CRITICAL** phases, we identify specific failure modes—both full and partial—and determine whether each failure is recoverable or forces offline mode.

---

## Critical Phases

These phases have **no degradation path**. Failure = error splash screen + error boundary.

### Phase 0: Config
- **Responsibility**: Load and validate application configuration (appsettings.json)
- **Failure**: Configuration missing or invalid
- **Behavior**: App cannot proceed → **ERROR SPLASH SCREEN**

### Phase 1: Preload
- **Responsibility**: Load critical fonts and UI images
- **Failure**: Fonts missing, images missing, or load fails
- **Behavior**: App UI cannot render properly → **ERROR SPLASH SCREEN**
- **Decision**: Making this CRITICAL (not degrading to fallback fonts) to ensure consistent UX

### Phase 3: Storage
- **Responsibility**: Initialize SecureStorage, cache system, offline queue
- **Failure**: Storage unavailable (permissions, disk full, corruption)
- **Behavior**: App cannot persist state or use cache → **ERROR SPLASH SCREEN**
- **Decision**: Cannot run in-memory only—core UX depends on storage. No degradation.

### Phase 5: Job Setup
- **Responsibility**: Initialize background job queue infrastructure
- **Failure**: Job queue infrastructure setup fails
- **Behavior**: Auto-save, background sync, reminders all fail → **ERROR SPLASH SCREEN**
- **Decision**: Jobs are shipped with app. If they fail, something is fundamentally broken.

---

## Non-Critical Phases

These phases can fail with graceful degradation. Specific failure modes determine the degradation path.

### Phase 2: Network

**Responsibility**: Initialize network detection, health checks, telemetry

**Possible Failures**:

| # | Failure Mode | Type | Degradation Path | Status |
|---|---|---|---|---|
| 1 | `NetworkDetection.initialize()` throws (full init fails) | Full | Use constructor defaults (online) while treating connectivity as unknown; app runs in offline-capable mode until detection is available | ✅ Built — constructor defaults to online; `useNetworkDetection()` hook + subscription exists |
| 2 | Web periodic ping fails (backend unreachable, CORS, DNS) | Partial | Mark offline if was online; latency data empty; quality defaults to GOOD | ✅ Built — ping has try/catch; `NetworkStateManager` transitions to OFFLINE |
| 3 | Battery tracking init fails (`navigator.getBattery()` missing or throws) | Partial | Battery data stays null; `isExpensive` stays false; no impact on UX | ✅ Built — try/catch in `setupBattery()`; null is safe default |
| 4 | Native NetInfo import fails (package not installed) | Partial | Fall back to web-style detection or constructor defaults | ✅ Built — dynamic import with catch; falls back to web detection |
| 5 | `NetworkStateManager.transitionTo()` fails on initial state | Partial | State machine stays at default; network status stale but functional | ✅ Built — state machine has default state (GOOD) |
| 6 | Network telemetry init fails (`initializeNetworkTelemetry()`) | Partial | No quality-change tracking or health-check telemetry; zero user impact | ✅ Built — independent try/catch; telemetry is fire-and-forget |

**Notes**:
- Every sub-operation has independent error handling — one failure doesn't cascade
- Full failure defaults to "assume online" (constructor default)
- Future: adaptive payload based on network speed test / ping latency results
- App is fully functional offline

---

### Phase 4: Services

**Responsibility**: Register auth provider, error tracker, analytics, database provider

**Possible Failures**:

| # | Failure Mode | Type | Criticality | Degradation Path | Status |
|---|---|---|---|---|---|
| 1 | Database provider fails to initialize | Partial | Non-skippable | Registers `NoOpDatabaseProvider` fallback; **degrade to offline mode** | ⚠️ Has flag — `NoOpDatabaseProvider` built + `updateServiceStatus('database','failed')` sets flag; but **no runtime subscription** to trigger offline mode |
| 2 | Auth provider fails to initialize | Partial | Non-skippable | Currently **throws and kills phase**; **degrade to offline mode** | 🔴 Needs flag + building — auth re-throws killing phase; no flag, no offline trigger |
| 3 | Error tracker (Sentry) fails to initialize | Partial | Skippable | Registers `NoOpErrorTracker`; dev-only impact | ✅ Built — `NoOpErrorTracker` registered; `updateServiceStatus` set; silent fallback |
| 4 | Analytics exporter fails to initialize | Partial | Skippable | Analytics disabled; dev-only impact | ✅ Built — catches error; analytics disabled; no impact |
| 5 | Performance baseline service fails (currently **uncaught**) | Partial | Skippable | **BUG**: Currently bubbles up and kills phase; should be caught and ignored | 🔴 Needs building — no try/catch exists (bug) |
| 6 | All services fail | Full | Non-skippable | **Degrade to offline mode** | 🔴 Needs flag + building — no centralized "all services failed → offline" trigger |

**Current Code Behavior**:
- Database: catches errors internally, registers NoOp fallback, does NOT re-throw
- Auth: catches errors and **re-throws** (only service that kills the phase)
- Error tracker: catches errors internally, registers NoOp, does NOT re-throw
- Analytics: catches errors internally, does NOT re-throw
- Performance baseline: **no try/catch** — will kill phase if it throws (bug)

**Notes**:
- If only analytics/error tracking fail: log and continue (no impact on user experience)
- If auth or database fail: cannot authenticate users or sync data → offline mode
- `areCriticalServicesReady()` checks only `database` + `auth` status
- Service status has 4 levels: `ready`, `degraded`, `failed`, `disabled`
- `degraded` counts as ready; `failed`/`disabled` do not

---

### Phase 6: Auth

**Responsibility**: Evaluate session staleness, restore persisted session

**Possible Failures**:

| # | Failure Mode | Type | Criticality | Degradation Path | Status |
|---|---|---|---|---|---|
| 1 | `StorageManager.getRaw(LAST_LOGGED_IN)` fails (storage read error) | Partial | Recoverable | Treat as no previous login; redirect to login via useAuthGuard | ✅ Built — try/catch in phase; `useAuthGuard` redirects unauthenticated users |
| 2 | Staleness evaluation logic throws | Partial | Skippable | Log warning; continue as unauthenticated | ✅ Built — inner try/catch catches; outer catch continues as unauthenticated |
| 3 | DEAD session: individual storage key deletion fails | Partial | Skippable | Log per-key warning; continue clearing remaining keys | ✅ Built — per-key try/catch in DEAD path |
| 4 | DEAD session: offline mutation queue clear fails | Partial | Skippable | Log warning; stale queue data may persist but won't execute | ✅ Built — try/catch around queue clear |
| 5 | DEAD session: query cache clear fails | Partial | Skippable | Log warning; stale cache data may persist | ✅ Built — try/catch around cache clear |
| 6 | STALE session: `AuthStateManager.markSyncRequired()` fails | Partial | Skippable | Log warning; sync-splash may not trigger re-auth automatically | ⚠️ Has flag — `markSyncRequired` exists and sync-splash reads it; but if the write fails, sync-splash won't know |
| 7 | FRESH session: `AuthStateManager.getUserId()` fails | Partial | Recoverable | Log warning; continue without userId (useAuthGuard handles redirect) | ✅ Built — `useAuthGuard` handles missing userId by redirecting |
| 8 | FRESH session: `SessionAdapter.restoreSession()` fails (web) | Partial | Recoverable | Mark sync required; sync-splash handles re-auth at runtime | ✅ Built — catch block calls `markSyncRequired()`; sync-splash triggers |
| 9 | FRESH session: refresh token expired/invalid/revoked (web) | Partial | Recoverable | Mark sync required; useAuthGuard redirects to login on first protected route | ✅ Built — catch treats as stale; `useAuthGuard` enforces at route level |
| 10 | FRESH session: background token refresh fails (fire-and-forget) | Partial | Skippable | Token still has days of validity; next API call triggers re-auth if needed | ✅ Built — fire-and-forget pattern; token lifetime handles gap |
| 11 | Auth phase outer catch (entire phase throws) | Full | Skippable | Log warning; continue as unauthenticated; useAuthGuard redirects to login | 🔴 Needs flag + building — outer catch exists, BUT `runPhase()` re-throws, crashing kernel instead of skipping |

**Notes**:
- Auth phase has **two nested try/catch levels** — inner staleness eval + outer phase wrapper
- Most partial failures are recoverable because auth provider is initialized (SERVICES phase ran first)
- Network errors on session restore are expected in offline mode
- Dependency graph ensures auth provider exists before this phase runs
- sync-splash handles runtime re-auth for stale sessions
- DEAD path (>30 days) clears keys individually with per-key error handling

---

### Phase 7: Feature Flags

**Responsibility**: Bootstrap feature flags from cache or hardcoded defaults

**Possible Failures**:

| # | Component | Failure Mode | Type | Criticality | Degradation Path | Status |
|---|---|---|---|---|---|---|
| 1 | **All** | Outer catch triggers (entire phase throws) | Full | Skippable | Load hardcoded defaults in catch block; bootstrap completes | 🔴 Needs flag + building — phase has catch, BUT `runPhase()` re-throws crashing kernel; hardcoded defaults loaded inside phase catch but kernel doesn't skip |
| 2 | **All** | Database provider not configured | N/A | Expected path | Load hardcoded defaults; return early (not a failure) | ✅ Built — early return path with hardcoded defaults |
| 3 | **Freshness** | `evaluateSnapshotFreshness()` fails | Partial | Skippable | Falls to outer catch → hardcoded defaults | ✅ Built — try/catch inside phase loads defaults on failure |
| 4 | **Flags (fresh)** | `seedManagerFromCache()` returns false (cache read fails) | Partial | Recoverable | Load hardcoded defaults as fallback | ✅ Built — false return triggers hardcoded defaults path |
| 5 | **Flags** | Flag definitions cache unreadable | Partial | Recoverable | Use hardcoded flag config | ✅ Built — individual cache reads have error handling |
| 6 | **Entitlements** | Entitlements cache unreadable | Partial | Skippable | Use hardcoded defaults | ✅ Built — individual cache reads have error handling |
| 7 | **Overrides** | User overrides cache unreadable | Partial | Skippable | Ignore overrides; use base flags | ✅ Built — individual cache reads have error handling |
| 8 | **Cohorts** | Cohort info cache unreadable | Partial | Skippable | Ignore cohorts; use hardcoded defaults | ✅ Built — individual cache reads have error handling |
| 9 | **Cohort Memberships** | Membership data unreadable | Partial | Skippable | Use deterministic bucketing (no DB needed) | ✅ Built — fallback to `isInRollout()` hash-based bucketing |
| 10 | **Clock** | `verifyDeviceClock()` fails | Partial | Skippable | Premium features may be restricted; log warning | ✅ Built — try/catch; logs warning; premium gating is safe default |
| 11 | **Realtime** | `subscribeToRealtimeUpdates()` fails | Partial | Skippable | No live flag updates; flags stay at bootstrap values until next sign-in sync | ✅ Built — try/catch; realtime is optional enhancement |
| 12 | **Validation** | `validateFlagDependencies()` throws | Partial | Skippable | Falls to outer catch → hardcoded defaults | ✅ Built — catch block loads hardcoded defaults |

**Notes**:
- Hardcoded defaults **always** available as final fallback (loaded in catch block too)
- Intended: no component failure should block appReady once non-critical skipping is wired; today a phase-level throw still blocks because `runPhase()` re-throws
- At login, feature-flags-sync-job fetches fresh data from server
- Individual component failures do not cascade
- Clock integrity failure only affects premium feature gating

---

### Phase 8: Registration

**Responsibility**: Register job handlers and activate subscriptions

**Possible Failures**:

| # | Failure Mode | Type | Criticality | Degradation Path | Status |
|---|---|---|---|---|---|
| 1 | `CORE_JOBS` or `SUBSCRIPTIONS` import fails | Full | Skippable | No handlers or subs registered; log and continue | 🔴 Needs flag + building — `runPhase()` re-throws; import failure kills kernel |
| 2 | `getJobQueue()` fails (queue not initialized) | Full | Skippable | No handlers registered; log and continue | 🔴 Needs flag + building — `runPhase()` re-throws; no skip logic |
| 3 | `sync-orchestrator` job fails to register | Partial | Per-job | No background sync; data syncs only on manual triggers | ✅ Built — per-job try/catch in registration-phase; logs and continues |
| 4 | `network-recovery-retry` job fails to register | Partial | Per-job | No automatic retry on network recovery; user must refresh | ✅ Built — per-job try/catch in registration-phase; logs and continues |
| 5 | `storage-health-check` job fails to register | Partial | Per-job | No periodic storage health monitoring | ✅ Built — per-job try/catch in registration-phase; logs and continues |
| 6 | `feature-flags-refresh` job fails to register | Partial | Per-job | Feature flags won't auto-refresh; stay at bootstrap values | ✅ Built — per-job try/catch in registration-phase; logs and continues |
| 7 | `analytics-network-integration` subscription fails | Partial | Per-sub | Analytics won't auto-flush on network reconnect | ✅ Built — per-subscription try/catch; logs and continues |
| 8 | All handlers + subscriptions fail | Full | Skippable | Log and continue (no background work, but app boots) | 🔴 Needs flag + building — if phase-level throw occurs, `runPhase()` crashes kernel |

**Current Registered Jobs** (from `lib/jobs/registry.ts`):
- `sync-orchestrator` — Background data sync
- `network-recovery-retry` — Retry failed requests on network recovery
- `storage-health-check` — Periodic storage health validation
- `feature-flags-refresh` — Refresh subscription/feature flags

**Current Registered Subscriptions** (from `lib/subscriptions/registry.ts`):
- `analytics-network-integration` — Flush analytics buffer on reconnect

**Notes**:
- Each handler/subscription is independent; failures don't cascade
- All current jobs are "nice to have" at bootstrap — none are critical for initial render
- Failed handlers are logged with name; app continues to appReady
- As more jobs are added, some may need per-job criticality decisions

---

## Degradation Status Summary

### Status Legend

| Icon | Meaning |
|---|---|
| ✅ Built | Infrastructure exists and works today — degradation path is fully implemented |
| ⚠️ Has Flag | Access point/flag/type exists but implementation is incomplete or not subscribed to |
| 🔴 Needs Flag + Building | Nothing exists — need both the flag/subscription and the implementation |

### Per-Phase Summary

| Phase | Total Failures | ✅ Built | ⚠️ Has Flag | 🔴 Needs Building |
|---|---|---|---|---|
| Network (2) | 6 | 6 | 0 | 0 |
| Services (4) | 6 | 2 | 1 | 3 |
| Auth (6) | 11 | 9 | 1 | 1 |
| Feature Flags (7) | 12 | 11 | 0 | 1 |
| Registration (8) | 8 | 5 | 0 | 3 |
| **Totals** | **43** | **33** | **2** | **8** |

### Critical Blocker

**`runPhase()` in `app-kernel.ts` re-throws ALL errors.** Non-critical phases crash the kernel identically to critical ones. This is the #1 blocker — until `runPhase()` can skip non-critical failures, most degradation paths are unreachable even when the underlying fallback code exists.

See: `DEGRADATION_FRAMEWORK.md` for the full audit of what exists, what has flags, and what needs building.

---

## Phase Dependency Reference

For context on why certain failures are recoverable:

```
config → (all others depend on this)
services + network → auth (can't auth without providers + network detected)
storage + preload → jobSetup (infrastructure depends on storage init)
auth + jobSetup + network + storage → featureFlags (safe to load flags)
featureFlags + services → registration (handlers ready after flags available)
```

---

## Implementation Checklist

- [ ] **#1 BLOCKER**: Update `runPhase()` in `app-kernel.ts` to skip non-critical phases instead of re-throwing
- [ ] Wire `PhaseState` interface (already defined) into `runPhase()` return values
- [ ] Wire `classifyPhaseError()` (already built) into `runPhase()` catch block
- [ ] Wire `adaptive-phase-executor` (already built) into `runPhase()` for timeout handling
- [ ] Fix BUG: Add try/catch around `performanceBaselineService` in `services-phase.ts`
- [ ] Fix: Stop auth provider from re-throwing in `service-initializer.ts` (use NoOp pattern)
- [ ] Add centralized degradation mode flag/subscription system (see `DEGRADATION_FRAMEWORK.md`)
- [ ] Add per-phase error tracking to kernel state (replace single `error: KernelError | null`)
- [ ] Connect safe mode triggers to non-critical phase failures
- [ ] Wire recovery action handlers in `app/_layout.tsx` (currently stubbed)
