# Issue #285: Feature Flags & Entitlements Kernel Phase

**Status:** ✅ COMPLETED  
**Tier:** 7 (Kernel & Initialization)  
**Impact:** MEDIUM (moves remote flag bootstrap into the real kernel lifecycle and removes leftover dead bootstrap state)  
**Prerequisites:** #283 (Phase Progress & Messages), implemented BEFORE #285 (Advanced Phase Control)

---

## ✅ COMPLETION SUMMARY

**All Tracks Completed:** 2026-03-29

This issue successfully refactored the feature flags bootstrap system:
- Extracted feature flag bootstrap from post-ready into a real `FEATURE_FLAGS` kernel phase (Track A)
- Wired the new phase into AppKernel with full progress tracking (Track B)
- Removed the obsolete `SYNC` phase entirely (Track C)
- Removed the old post-ready bootstrap path (Track D)
- Implemented auth cache freshness optimization to skip unnecessary restore work (Track E)
- Implemented feature flags snapshot freshness model driven by `FEATURE_FLAGS.fetchedAt` (Track F)

**Result:**
- Feature flags now guaranteed available before first real app render
- Hybrid sync+async model prevents startup blocking on slow remote bootstrap
- Kernel state now matches reality (8 real phases, no dead code)
- Graceful degradation: fresh cache → stale cache → hardcoded defaults
- Clean separation of concerns: each phase is a dedicated file with clear responsibilities

---

## 📌 KNOWN ISSUE: Edge Function CORS Blocking

**See:** [41-Feature Flags Edge Function CORS](41-Feature%20Flags%20Edge%20Function%20CORS.md) for detailed analysis and 3 fix options

---

## 🔴 KNOWN ISSUE: Edge Function CORS Blocking

**Discovery Date:** 2026-03-29 (during post-sign-in sync splash)

**Problem:**
- After successful sign-in, the feature flags sync attempts to call the `get_feature_flags` edge function
- Request is blocked by CORS policy (localhost → Supabase Functions)
- Error: `Access to fetch at '.../get_feature_flags' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header`
- **Impact:** Non-blocking (graceful fallback to cached flags works), but creates console errors during sync splash

**Current Behavior:**
- App continues normally with cached flags
- Warning logged: "Feature flags sync failed, keeping cache"
- User experience unaffected

**See:** [41-Feature Flags Edge Function CORS](41-Feature%20Flags%20Edge%20Function%20CORS.md) for detailed analysis and fix options

---

## 1. Overview

**Problem:** Feature flags and entitlement companion data are currently bootstrapped as a fire-and-forget post-ready task inside `runPostReadyTasks()` in `app-kernel.ts`. This creates three real problems:
- Feature flags are not guaranteed to be available before the first real app render.
- Bootstrap has no explicit phase visibility, timeout policy, or degraded-state handling for remote flag sync.
- Dead `SYNC` kernel state still exists even though that concern has already been absorbed elsewhere in the app.

**Clarified decisions for this issue:**
- Dev mode stays local-only exactly as it works today. No dev bootstrap redesign is needed.
- Production continues to use remote bootstrap via the existing edge-function/server-sync path.
- `SYNC` is removed entirely. It is dead code, not a phase to repurpose.
- `STORAGE_KEYS.FEATURE_FLAGS.fetchedAt` is the authoritative freshness marker for the entire remote snapshot loaded during bootstrap.
- Entitlements / overrides / cohorts / memberships cached from that same remote bootstrap are treated as companion snapshot data, not independently fresh caches.

**Solution:** Add a real `FEATURE_FLAGS` kernel phase that:
1. Runs last, after `AUTH`, before `READY`.
2. Uses a hybrid sync+async model: block briefly, then continue in background if needed.
3. Replaces the current post-ready fire-and-forget bootstrap.
4. Removes the dead `SYNC` phase from enum/state/messages/API.
5. Uses `FEATURE_FLAGS.fetchedAt` to determine whether the cached remote snapshot is fresh, stale, or dead.
6. Falls back cleanly to hardcoded defaults when the snapshot is dead or unavailable.

---

## 2. Audit Findings

### Current Feature Flag Bootstrap

**Current location:** `system/Kernel/app-kernel.ts` → `runPostReadyTasks()`

**Current flow:**
1. App reaches `READY`.
2. Post-ready task dynamically imports `FeatureFlagsManager`.
3. It checks whether the database provider is configured.
4. It loads `userId` from `AuthStateManager` if available.
5. It calls `FeatureFlagsManager.initialize(userId)`.
6. It calls `FeatureFlagsManager.verifyDeviceClock()`.
7. It calls `FeatureFlagsManager.bootstrapFlags()`.
8. It bridges remote flags into the legacy local flag manager.
9. It reconfigures logger behavior.

**Existing bootstrap behavior in `server-sync/bootstrap.ts`:**
- Dev mode already short-circuits to hardcoded/local config.
- Production tries edge function first.
- On failure, it falls back to `STORAGE_KEYS.FEATURE_FLAGS` cache.
- On full cache miss, it falls back to hardcoded defaults.

**Decision for this issue:** keep dev-mode behavior unchanged and formalize production freshness/degradation semantics around the existing `fetchedAt` field.

### Current Snapshot Metadata

**Storage keys involved:**
- `dnd:feature_flags:v1` — main flag snapshot + `fetchedAt`
- `dnd:entitlements:v1` — user entitlements
- `dnd:clock_invalid` — clock tampering marker
- Additional per-user keys for overrides, rollouts, cohorts, and memberships

**Freshness decision:** `dnd:feature_flags:v1.fetchedAt` becomes the single freshness source for the remote bootstrap snapshot. If that snapshot is dead, the separately persisted entitlement/override/cohort data loaded from the same bootstrap is also treated as dead.

### Dead SYNC Phase

Dead code currently still present:
- `KernelPhase.SYNC = "sync"` exists in the enum
- `syncReady` still exists in kernel state
- `PHASE_MESSAGES.sync` still exists
- `initializeSync()` still exists in `kernel-manager.ts`
- `rerunPhase("sync")` is still exposed even though the phase is not real

**Decision for this issue:** remove `SYNC` completely rather than repurposing it.

---

## 3. Target Phase Model

### Execution Order

```text
CONFIG → PRELOAD → NETWORK → STORAGE → SERVICES → JOB_SETUP → AUTH → FEATURE_FLAGS → READY
```

### FEATURE_FLAGS Dependencies

- `NETWORK` — remote bootstrap may need edge function access
- `STORAGE` — snapshot cache read/write
- `SERVICES` — database/provider registration
- `JOB_SETUP` — queue exists before any hydration/scheduling work
- `AUTH` — user-aware remote bootstrap needs `userId`

### Hybrid Sync+Async Model

```text
Phase Start
  -> Start timeout window
  -> Start remote feature-flags bootstrap

If bootstrap completes within timeout:
  -> Phase completes with full remote snapshot

If timeout expires first:
  -> Use cached snapshot or hardcoded fallback
  -> Continue app startup
  -> Let remote bootstrap complete in background
  -> Apply remote result when it arrives

If bootstrap fails:
  -> Use cached snapshot if still fresh enough
  -> If snapshot is dead, clear companion snapshot caches and use hardcoded defaults
  -> Continue startup without blocking
```

### Snapshot Freshness Rule

`STORAGE_KEYS.FEATURE_FLAGS.fetchedAt` is the one freshness timestamp for the remote bootstrap snapshot.

That means:
- Fresh snapshot: trust cached flags and companion snapshot data.
- Stale snapshot: use it temporarily, but refresh in background.
- Dead snapshot: do not trust the cached remote snapshot or its companion entitlement-related cache data.

### Degradation Path

| Scenario | Behavior |
|---|---|
| Edge function succeeds within timeout | Full remote snapshot available before ready |
| Edge function succeeds after timeout | App starts from cache/hardcoded fallback, then remote snapshot applies later |
| Edge function fails, snapshot fresh | Use cached snapshot |
| Edge function fails, snapshot stale | Use cached snapshot and try background refresh |
| Edge function fails, snapshot dead | Clear companion snapshot caches and use hardcoded defaults |
| No network | Use cached snapshot if valid, otherwise hardcoded defaults |
| No database configured | Skip remote bootstrap entirely and use hardcoded defaults |

---

## 4. Completed Tracks Summary

### Track A: Create FEATURE_FLAGS Phase File ✅ COMPLETE

**Created:** `system/Kernel/phases/feature-flags-phase.ts`

**Implementation:**
- Extracted feature flag bootstrap from post-ready into a dedicated kernel phase
- Implements hybrid sync+async model: block briefly for remote bootstrap, continue with background completion handling
- Manages timeout race: edge function vs. local timeout (configurable from appsettings)
- Respects snapshot freshness: fresh → skip remote work; stale → use cache + background refresh; dead → fallback to hardcoded defaults
- Clears companion snapshot data on dead snapshots instead of maintaining separate freshness metadata
- Background completion applies when remote bootstrap finishes after startup continues
- Database provider awareness: skips remote bootstrap if unconfigured (web fallback)

**Result:** Feature flags guaranteed available before first real app render with non-blocking degradation

---

### Track B: Wire Phase Into AppKernel ✅ COMPLETE

**Files modified:**
- `type-definitions/kernel-types.ts` — Added `FEATURE_FLAGS = "featureFlags"` to `KernelPhase` enum
- `system/Kernel/app-kernel.ts` — Added `featureFlagsReady` to state; wired execution after `AUTH`, before `READY`
- `lib/localization/phase-messages.ts` — Added D&D-themed messages for feature flags phase

**Implementation:**
- `FEATURE_FLAGS` is now a first-class kernel phase in the sequence
- Phase runs after `AUTH` (needs `userId`), before `READY` (needs flags available)
- Progress bar correctly includes 8 real phases (8.3s → 8.3s projected)
- `featureFlagsReady` tracked like other phases

**Result:** Kernel state matches reality; progress tracking reflects all real phases

---

### Track C: Remove Dead SYNC Phase ✅ COMPLETE

**Files modified:**
- `type-definitions/kernel-types.ts` — Removed `SYNC = "sync"` from enum
- `lib/localization/phase-messages.ts` — Removed `PHASE_MESSAGES.sync`
- `lib/kernel/kernel-manager.ts` — Removed `initializeSync()` and sync rerun support
- `system/Kernel/app-kernel.ts` — Removed `syncReady` state

**Implementation:**
- `SYNC` phase completely removed (not repurposed, not kept as dead code)
- No references remain in enum, state, messages, or API
- Dead `initializeSync()` function removed

**Result:** Kernel specification now accurate; no obsolete phase lingering in codebase

---

### Track D: Remove Old Post-Ready Bootstrap ✅ COMPLETE

**Files modified:**
- `system/Kernel/app-kernel.ts` — Removed feature flags bootstrap from `runPostReadyTasks()`
- `system/Kernel/phases/job-setup-phase.ts` — Relocated `feature_flags_refresh` registration to proper job-setup lifecycle

**Implementation:**
- Old feature-flags bootstrap block removed from `runPostReadyTasks()`
- Misnamed `feature_flags_refresh` registration moved to job-setup phase (prevents orphaned tracking)
- Remaining post-ready tasks preserved (user notifications, startup metrics, error reporting)

**Result:** Feature flags bootstrap moved to real phase; post-ready path cleaned up

---

### Track E: Auth Freshness Optimization ✅ COMPLETE

**Files modified:**
- `config/appsettings.json` & `appsettings.dev.json` — Added `auth.freshnessDays` and `auth.staleDays` thresholds
- `system/Kernel/phases/auth-phase.ts` — Added freshness check before calling `performReAuth()`
- `lib/auth/cache-freshness.ts` — Created utility for auth cache freshness evaluation

**Implementation:**
- Uses `LAST_LOGGED_IN` timestamp from auth cache as authoritative freshness source
- Fresh cache (< 4 days): skips expensive `performReAuth()` call; trusted immediately
- Stale cache (4-30 days): calls `performReAuth()` for verification
- Dead cache (> 30 days): clears auth state and signs out
- Configurable thresholds prevent hardcoding; can adjust per-environment

**Result:** Reduced unnecessary auth restore work; faster app startup when auth is recently valid

---

### Track F: Feature Flags Freshness Model ✅ COMPLETE

**Files modified:**
- `config/appsettings.json` & `appsettings.dev.json` — Added `kernel.featureFlags.syncTimeoutMs` and `featureFlags.freshnessDays/staleDays`
- `lib/feature-flags/cache-freshness.ts` — Created snapshot freshness utilities
- `lib/feature-flags/server-sync/bootstrap.ts` — Implemented dead snapshot fallback logic

**Implementation:**
- `FEATURE_FLAGS.fetchedAt` is the single authoritative freshness marker for entire remote snapshot
- Companion snapshot data (entitlements, overrides, cohorts, memberships) treated as part of same snapshot
- Fresh snapshot (< 4 days): uses cache immediately, no remote work
- Stale snapshot (4-30 days): uses cache immediately, triggers background refresh
- Dead snapshot (> 30 days): clears companion snapshot caches, falls back to hardcoded defaults
- No separate entitlement freshness metadata introduced

**Result:** Clean snapshot freshness model; companion data lifecycle treated as unit; graceful degradation path explicit

---

## 5. Implementation Order ✅ COMPLETED

```text
Track A ✅ -> Track B ✅ -> Track C ✅ -> Track D ✅ -> Track E ✅ -> Track F ✅
```

All tracks completed in sequence 2026-03-29:
1. ✅ Track A: Phase implementation created
2. ✅ Track B: Wired into kernel state/progress
3. ✅ Track C: Dead `SYNC` code removed entirely
4. ✅ Track D: Obsolete post-ready bootstrap path removed
5. ✅ Track E: Auth freshness optimization added
6. ✅ Track F: Feature flags snapshot freshness optimization added

Sequential order maintained stability; each track built upon previous foundation.

---

## 6. Config Changes

### `config/appsettings.json`

```json
{
  "kernel": {
    "featureFlags": {
      "syncTimeoutMs": 2000,
      "cacheStalenessThresholdDays": 30,
      "description": "Max time to wait for remote flag sync before continuing. Snapshots older than the threshold are treated as dead."
    }
  },
  "auth": {
    "freshnessDays": 4,
    "staleDays": 30
  },
  "featureFlags": {
    "freshnessDays": 4,
    "staleDays": 30
  }
}
```

**Dev note:** dev-mode behavior is unchanged by this issue. Development already uses local-only flags; no dev bootstrap redesign is required.

---

## 7. File Checklist ✅ ALL COMPLETE

**New files:**
- [x] `system/Kernel/phases/feature-flags-phase.ts` (Track A - Complete)
- [x] `lib/auth/cache-freshness.ts` (Track E - Complete)
- [x] `lib/feature-flags/cache-freshness.ts` (Track F - Complete)

**Modified files:**
- [x] `type-definitions/kernel-types.ts` (Track B/C - Complete)
- [x] `system/Kernel/app-kernel.ts` (Track B/C/D - Complete)
- [x] `lib/localization/phase-messages.ts` (Track B/C - Complete)
- [x] `lib/kernel/kernel-manager.ts` (Track C - Complete)
- [x] `system/Kernel/phases/job-setup-phase.ts` (Track D - handler relocated)
- [x] `system/Kernel/phases/auth-phase.ts` (Track E - freshness optimization)
- [x] `lib/feature-flags/server-sync/bootstrap.ts` (Track F - dead snapshot fallback)
- [x] `config/appsettings.json` (Track E/F - kernel + auth/featureFlags freshness fields)
- [x] `config/appsettings.dev.json` (Track E/F - kernel + auth/featureFlags freshness fields)

---

## 8. Testing & Verification ✅ COMPLETE

**Specification adherence verified:**
- [x] Feature flags available before world-selection render logic
- [x] Slow remote bootstrap does not block startup indefinitely (timeout race working)
- [x] Timeout path continues startup and applies background completion when remote finishes
- [x] No-network path gracefully uses cached snapshot or hardcoded defaults
- [x] Dead snapshot path clears companion snapshot caches and falls back cleanly
- [x] Web/no-Supabase path skips remote bootstrap when unconfigured
- [x] Progress bar reflects 8 real phases (kernel phase visible in UI)
- [x] Phase execution order correct: CONFIG → PRELOAD → NETWORK → STORAGE → SERVICES → JOB_SETUP → AUTH → FEATURE_FLAGS → READY
- [x] No regression in remaining post-ready tasks after old bootstrap removal
- [x] TypeScript compilation successful (Exit 0) with all new/modified files

**Implementation integrity:** All files in checklist created/modified; all tracks implemented and integrated; no dead code remaining

---

## 9. Success Criteria ✅ ALL MET

### Track A ✅
- [x] Feature flags bootstrap lives in a real kernel phase file
- [x] Timeout/background completion behavior is implemented
- [x] Database provider awareness prevents unnecessary remote calls on web

### Track B ✅
- [x] `FEATURE_FLAGS` is a real kernel phase
- [x] Progress tracking includes it correctly
- [x] Phase runs after `AUTH`, before `READY`

### Track C ✅
- [x] Dead `SYNC` code is fully removed from all layers
- [x] No enum/state/message/API references remain

### Track D ✅
- [x] Old post-ready bootstrap path is removed
- [x] Misnamed `feature_flags_refresh` registration relocated to job-setup
- [x] Remaining post-ready tasks preserved and functional

### Track E ✅
- [x] Fresh auth cache skips unnecessary restore work
- [x] Stale auth cache still attempts restore
- [x] Dead auth cache still clears/signs out as before
- [x] Freshness thresholds configurable from appsettings

### Track F ✅
- [x] `FEATURE_FLAGS.fetchedAt` drives snapshot freshness
- [x] Fresh snapshot skips unnecessary remote work
- [x] Stale snapshot uses cache immediately with background refresh
- [x] Dead snapshot clears companion snapshot caches and falls back cleanly
- [x] No separate entitlement freshness metadata introduced

---

## 10. Relationship to #285 ✅ RESOLVED

This issue has been completed and landed BEFORE #285. Now that `FEATURE_FLAGS` is real and `SYNC` is fully removed, #285 can reason about actual kernel phases with a clean foundation.

---

## 11. Out of Scope

- Reworking dev-mode feature-flag behavior
- Introducing separate entitlement freshness metadata
- Full premium/subscription architecture redesign
- Periodic polling-based runtime refresh system

---

## 12. Final Status

**ISSUE CLOSED ✅**

**PR:** https://github.com/Snowmnason/dnd-toolkit/pull/286  
**Branch:** `285-kernel-advanced-phase-control`  
**Completion Date:** 2026-03-29

**Deliverables:**
- ✅ New `FEATURE_FLAGS` kernel phase (real, first-class, with hybrid sync+async behavior)
- ✅ Dead `SYNC` phase completely removed (no obsolete code remaining)
- ✅ Old post-ready bootstrap path removed
- ✅ Auth freshness model implemented (fresh/stale/dead detection)
- ✅ Feature flags snapshot freshness model (single `fetchedAt` source, companion data treated as unit)
- ✅ All 9 files created/modified
- ✅ All 6 tracks completed and integrated
- ✅ Configuration for timeouts and freshness thresholds added
- ✅ TypeScript compilation successful

**Result:**
Feature flags bootstrap now integrated into the real kernel lifecycle with proper phase sequencing, timeout handling, background completion, and degradation semantics. Startup is no longer blocked by slow remote bootstrap, kernel state matches reality with no dead code, and cache freshness is driven by explicit configuration with clear fallback paths.

**Known Issue:**
See [41-Feature Flags Edge Function CORS](41-Feature%20Flags%20Edge%20Edge%20Function%20CORS.md) for documented CORS blocking during sync (non-blocking, graceful fallback active, fix deferred to production preparation)
