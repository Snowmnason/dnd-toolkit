# Degradation Framework Audit

**Issue**: #287 - Kernel Advanced Phase Control  
**Milestone**: 2 (Tier 7)  
**Status**: Planning — Audit Complete  
**Related**: `PHASE_FAILURE_ANALYSIS.md` (failure modes + per-row status)

---

## Purpose

Before implementing phase error handling, this document answers:

1. **What degradation infrastructure exists today?** (✅ Built)
2. **What has a flag/hook but needs implementation?** (⚠️ Has Flag)
3. **What needs both a flag AND implementation?** (🔴 Needs Flag + Building)

Then proposes a **centralized Degradation Mode system** using a flag/subscription pattern so phases can trigger degradation and the rest of the app reacts at runtime.

---

## Section 1: What Exists Today (✅ Built)

### 1.1 Safe Mode System

**Files**: `lib/error/safemode/safe-mode.ts`, `lib/error/safemode/recovery-actions.ts`  
**Access**: Subscription via `kernel.subscribe()` → hooks `useSafeMode()`, `useIsSafeMode()`, etc.

| Component | File | What It Does |
|-----------|------|-------------|
| `SafeModeLevel` enum | `lib/error/safemode/safe-mode.ts` | 4 levels: `NORMAL`, `DEGRADED`, `SAFE`, `RECOVERY` |
| `SafeModeReason` enum | same | 13 reasons (storage×3, auth×3, kernel×3, network×3, unknown) |
| `AffectedFeature` enum | same | 7 feature categories that can be disabled |
| `RecoveryAction` enum | same | 5 user actions: clear_cache, reset_auth, restore_backup, contact_support, reinstall |
| `SafeModeState` interface | same | Immutable snapshot: level, reason, affectedFeatures, recoveryOptions, timestamp, details, originalError |
| `createSafeModeState()` | same | Factory: maps reason → level + affected features + recovery options |
| `executeRecoveryAction()` | `recovery-actions.ts` | Executes user-picked recovery (clear cache, reset auth, etc.) — **fully implemented** |
| `SafeModeScreen` UI | `components/SplashScreen/SafeModeScreen.tsx` | Shows reason, affected features, recovery buttons per level |
| `SafeModeErrorBoundary` | `components/layer/SafeModeErrorBoundary.tsx` | Wraps SafeModeScreen; fallback if even SafeModeScreen crashes |

**Hooks** (from `hooks/error/index.ts`):
- `useSafeMode()` — returns `SafeModeState | null` (subscribes to kernel changes)
- `useIsSafeMode()` — boolean
- `useIsDegradedOrSafe()` — boolean
- `useIsInRecovery()` — boolean
- `useIsInSafeModeLevel(level)` — boolean for specific level
- `useIsFeatureAffected(feature)` — checks if a feature is disabled
- `useSetSafeMode()` — returns setter callback
- `useClearSafeMode()` — returns clear callback

**Active Triggers Today** (only 2 of 13 reasons are wired):

| Trigger | Reason | Level | Where |
|---------|--------|-------|-------|
| Kernel bootstrap exceeds timeout | `KERNEL_TIMEOUT` | `RECOVERY` | `system/Kernel/app-kernel.ts` → `setupBootstrapTimeout()` |
| 3+ consecutive sync failures | `NETWORK_CASCADE` | `DEGRADED` | `lib/offline/sync-manager.ts` → `NetworkCascadeDetector` |

**Untriggered Reasons** (defined but never called):
`STORAGE_UNREADABLE`, `STORAGE_CORRUPTED`, `STORAGE_QUOTA_EXCEEDED`, `AUTH_EXPIRED`, `AUTH_INVALID`, `SESSION_LOST`, `KERNEL_PRELOAD_FAILED`, `KERNEL_CONFIG_FAILED`, `NETWORK_SYNC_FAILURES`, `NETWORK_UNAVAILABLE`, `UNKNOWN`

---

### 1.2 Network State System

**Files**: `system/Network/network-detection.ts`, `system/Network/state-machine.ts`, `lib/middleware/network/network-integration.ts`  
**Access**: Subscription via `subscribeToNetworkStatus()` → hook `useNetworkDetection()`

| Component | What It Does |
|-----------|-------------|
| `NetworkDetection` | Cross-platform detection: online/offline, type (wifi/cellular), quality, battery. Periodic ping. |
| `NetworkStateManager` | State machine: `GOOD` ↔ `BAD` ↔ `CELLULAR` ↔ `OFFLINE` ↔ `RECOVERING` |
| `NetworkDetection.subscribe(callback)` | Subscription pattern — fires on every network change |
| `subscribeToNetworkStatus(callback)` | Lib-level wrapper that normalizes raw status to app format |
| `useNetworkDetection()` hook | Returns `{ isOnline, type, isExpensive, connectionQuality, effectiveType }` |

**Runtime-ready**: Any code can subscribe to network changes. Phases already use constructor defaults on failure.

---

### 1.3 Offline Queue + Sync System

**Files**: `lib/offline/sync-manager.ts`, `lib/offline/mutation-queue.ts`, `lib/offline/offline-recovery.ts`  
**Access**: Subscription via `OnlineSyncManager.subscribe()` → hook `useOfflineQueue()`

| Component | What It Does |
|-----------|-------------|
| `OfflineMutationQueue` | FIFO encrypted queue in SecureStorage; dead-letter for permanent failures |
| `OnlineSyncManager` | Auto-syncs on reconnect; debouncing, batching, exponential backoff |
| `NetworkErrorClassifier` | Classifies errors as transient vs permanent |
| `CircuitBreakerReplayManager` | Fail-fast + backoff for repeated failures |
| `NetworkCascadeDetector` | Counts consecutive sync failures → triggers DEGRADED safe mode at threshold (3) |
| `useOfflineQueue()` hook | Returns `{ queueSize, isSyncing, lastSyncedAt, deadLetterCount }` |

**Runtime-ready**: Mutations can be queued, synced on reconnect, and cascade detection triggers safe mode.

---

### 1.4 Service Status Registry

**Files**: `system/Services/service-status.ts`, `system/Services/service-initializer.ts`  
**Access**: **Poll-based only** (function calls, no subscription)

| Function | What It Does |
|----------|-------------|
| `updateServiceStatus(service, status, provider, message?)` | Set status during bootstrap |
| `getServiceStatus()` | Returns `{ database, auth, errorTracker, analytics }` with `ServiceReadiness` values |
| `isServiceReady(service)` | Returns true if `ready` or `degraded` |
| `areCriticalServicesReady()` | `isServiceReady('database') && isServiceReady('auth')` |
| `getAllServiceStatuses()` | Full debug dump |

**ServiceReadiness levels**: `ready`, `degraded`, `failed`, `disabled`

**NoOp Fallbacks Built**:
- `NoOpDatabaseProvider` — registered on database init failure; throws clear error on query
- `NoOpErrorTracker` — registered on Sentry init failure; silent no-op
- `NoOpCompressionProvider` — registered when CompressionStream unavailable; pass-through

**Gap**: Poll-based only. No subscription. No hook. Components can't reactively know when a service degrades at runtime.

---

### 1.5 Phase Error Classifier + Adaptive Executor

**Files**: `system/Kernel/phase-error-classifier.ts`, `system/Kernel/adaptive-phase-executor.ts`  
**Access**: Function calls (imported by adaptive executor only)

| Component | What It Does | Used by `app-kernel.ts`? |
|-----------|-------------|--------------------------|
| `classifyPhaseError(error)` | Returns `'unreachable'` / `'timeout'` / `'non-recoverable'` | **NO** — not imported |
| `isTimeout(error)` | Checks if error is timeout-type | **NO** — not imported |
| `executePhaseWithTimeout()` | Adaptive timeouts using device slowdown + network multiplier; returns `PhaseState` | **NO** — not imported |
| `PhaseState` interface | `{ status, reason, retriable, durationMs, error }` | **NO** — type defined but unused by kernel |

**These are fully built but not wired into `runPhase()`.** The current `runPhase()` just does try/catch → throw on failure.

---

### 1.6 Error Boundary Hierarchy

**Files**: `components/layer/ErrorBoundary.tsx`, `components/layer/RouteErrorBoundary.tsx`, `components/layer/SafeModeErrorBoundary.tsx`

```
AppErrorBoundary          (global — catches all unhandled render errors)
  ↓
RouteErrorBoundary(s)     (per-route — finer granularity)
  ↓
SafeModeErrorBoundary     (wraps SafeModeScreen — fallback if even recovery UI crashes)
  ↓
SafeModeScreen            (DEGRADED/SAFE: info + "Back". RECOVERY: recovery action buttons)
```

**Runtime-ready**: Error boundaries exist at all levels. Safe mode screen renders when `kernel.safeMode` is set.

---

### 1.7 Auth Guards

**Files**: `lib/auth/useAuthGuard.ts`, `lib/routing/AUTH_CONFIG`  
**Access**: Hook `useAuthGuard(appReady, level)`

- Waits for `kernel.phases.appReady` before checking
- Two levels: `'account-only'` (needs auth), `'world-required'` (needs auth + world)
- **Degradation-aware**: In DEGRADED safe mode, skips fresh world verification
- If auth fails, redirects to login — this is the existing "degradation" for unauthenticated state

---

### 1.8 Adaptive Payload

**Files**: `lib/network/adaptive-payload/`  
**Access**: Hook `useAdaptivePayload()`

- Maps 6 network quality tiers to payload options (images, quality, maps, size limits, compression)
- Built and tested (600+ line test suite)
- **Gap**: Server does not yet support quality params (TODO #205). Client sends them; server ignores.

---

### 1.9 Kernel Subscription Pattern

**Files**: `system/Kernel/app-kernel.ts`  
**Access**: `kernel.subscribe(callback)` — fires on ANY state change

- Subscription returns unsubscribe function
- Callbacks receive full `AppKernelState` snapshot
- Used by all kernel hooks (`useAppKernel`, `useSafeMode`, `useAppReady`, etc.)

This is the **foundation pattern** that the degradation system should build on.

---

## Section 2: What Has Flags But Needs Implementation (⚠️ Has Flag)

| # | What Exists | What's Missing | Files |
|---|------------|----------------|-------|
| 1 | `ServiceStatus.database = 'failed'` flag is set when DB init fails, + `NoOpDatabaseProvider` registered | No subscription to react to this. No runtime trigger to enter offline/degraded mode when database fails. UI cannot subscribe to service status changes. | `service-status.ts` |
| 2 | `SafeModeReason.STORAGE_UNREADABLE/CORRUPTED/QUOTA_EXCEEDED` defined in enum | Never triggered. No code calls `setSafeMode()` with these reasons. Storage phase failures crash kernel instead. | `safe-mode.ts`, storage phases |
| 3 | `SafeModeReason.AUTH_EXPIRED/AUTH_INVALID/SESSION_LOST` defined in enum | Never triggered. Auth failures either redirect to login (via useAuthGuard) or crash the kernel. | `safe-mode.ts`, auth phases |
| 4 | `SafeModeReason.KERNEL_PRELOAD_FAILED/KERNEL_CONFIG_FAILED` defined in enum | Never triggered. These phases are CRITICAL and crash to error boundary before safe mode can be set. | `safe-mode.ts` |
| 5 | `SafeModeReason.NETWORK_SYNC_FAILURES/NETWORK_UNAVAILABLE` defined in enum | `NETWORK_UNAVAILABLE` never triggered (only `NETWORK_CASCADE` is, via sync manager). | `safe-mode.ts` |
| 6 | `PhaseState` interface defined with `status/reason/retriable/durationMs/error` | Never used by `app-kernel.ts`. `runPhase()` uses boolean flags only. | `kernel-types.ts` |
| 7 | `classifyPhaseError()` + `executePhaseWithTimeout()` built and tested | Not imported by `app-kernel.ts`. `runPhase()` does raw try/catch → throw. | `phase-error-classifier.ts`, `adaptive-phase-executor.ts` |
| 8 | `KernelErrorCode` enum has 7 codes (CONFIG_FAILED, PRELOAD_FAILED, etc.) | Most errors map to `UNKNOWN_ERROR`. Phase catch blocks don't classify. | `kernel-types.ts` |
| 9 | `AuthStateManager.markSyncRequired()` flag exists for stale sessions | If the write to set this flag fails, sync-splash won't know to re-auth. No fallback. | `auth-state.ts` |
| 10 | Recovery action handlers fully implemented | `app/_layout.tsx` has `onRecoveryAction` wired to `executeRecoveryAction()` — **but only fires when safe mode is RECOVERY level**, which is only triggered by kernel timeout today. | `recovery-actions.ts`, `_layout.tsx` |

---

## Section 3: What Needs Flag AND Building (🔴 Needs Both)

| # | What's Needed | Why | Where It Would Go |
|---|--------------|-----|-------------------|
| 1 | **`runPhase()` skip logic for non-critical phases** | Currently ALL phases crash kernel on failure. This is the #1 blocker. Non-critical phases need to catch, classify, and skip. | `system/Kernel/app-kernel.ts` |
| 2 | **Per-phase error tracking in kernel state** | Currently single `error: KernelError \| null`. If Network fails then Auth fails, only Auth's error is stored. Need `phaseErrors: Record<string, PhaseState>` or similar. | `type-definitions/kernel-types.ts`, `app-kernel.ts` |
| 3 | **Centralized degradation mode flag + subscription** | No central "the app is in offline/degraded mode" reactive flag that components can subscribe to. Service status is poll-only. Safe mode is the closest but is level-based (DEGRADED/SAFE/RECOVERY), not capability-based. | New: see Section 4 proposal |
| 4 | **Service status subscription** | `service-status.ts` is a plain `Map` with no EventEmitter/Observable. Components can't react to service degradation at runtime. | `system/Services/service-status.ts` |
| 5 | **Auth provider NoOp fallback** | Auth provider re-throws on init failure, killing the services phase. Database has `NoOpDatabaseProvider`; auth needs equivalent so it can fail gracefully. | `system/Services/service-initializer.ts` |
| 6 | **Performance baseline try/catch** | Missing try/catch around `performanceBaselineService` in services phase. Bug that can kill the phase. | `system/Kernel/phases/services-phase.ts` |
| 7 | **Phase → Safe Mode mapping** | When a non-critical phase fails, which `SafeModeReason` + `SafeModeLevel` should be triggered? No mapping exists. | `system/Kernel/app-kernel.ts` or new phase-to-safemode mapper |
| 8 | **Offline mode entry point from phase failures** | Network/Services/Auth failures should be able to set an "offline mode" degradation flag that the app reads at runtime. Today only sync cascade triggers degraded state. | New: ties into degradation system |

---

## Section 4: Centralized Degradation Mode — Design Direction

### The Problem

Today, degradation is **scattered**:
- Safe Mode is level-based (`DEGRADED`/`SAFE`/`RECOVERY`) — good for UI screens, not for "is database available?"
- Service Status is poll-based — no subscription, no reactive updates
- Network State has subscriptions — but only for connectivity, not for "what can the app do?"
- Feature Flags have subscriptions — but are for feature rollout, not system health

**No single system answers: "What capabilities does the app have right now?"**

### The Proposal: Flag-Based Subscription Model

Instead of scattered function calls, build a centralized **Degradation Mode Manager** that:

1. **Holds capability flags** — `database`, `auth`, `sync`, `analytics`, `backgroundJobs`, `premium`, etc.
2. **Supports subscription** — any component/hook/lib module can subscribe to capability changes
3. **Phases set flags during bootstrap** — `runPhase()` catch block sets `degradationManager.set('database', false)`
4. **Runtime changes update flags** — network recovery, service restoration, etc.
5. **Ties into existing Safe Mode** — capability flags feed into safe mode level calculation

### Why Flag/Subscription Over Function Calls

| Approach | Bootstrap | Runtime | Components | Testing |
|----------|-----------|---------|------------|---------|
| **Function call** (`isDatabaseAvailable()`) | ✅ Easy | ❌ Must poll | ❌ Must poll on interval | ❌ Mock per-call |
| **Flag/subscription** (`degradation.subscribe()`) | ✅ Easy | ✅ Reactive | ✅ Hook subscribes once | ✅ Set flag, all subscribers update |

Function calls work for bootstrap (check once, continue). But at runtime, when network comes back or a service recovers, we need **reactive notification** — not polling. The subscription model matches what we already have for kernel state, network status, and feature flags.

### Where It Would Live

```
system/ layer (portable infrastructure):
  system/Degrade/degradation-manager.ts    — Flag store + subscribe/notify

lib/ layer (orchestration):
  lib/Degrade/kernel-manager.ts            — Exposes degradation through existing kernel barrel

hooks/ layer (React bridge):
  hooks/Degrade/useDegradation.ts          — React hook wrapping subscription
  hooks/Degrade/useCapability.ts           — Granular: useCapability('database') → boolean
```

### Integration Points

```
bootstrap (runPhase catch)  →  degradationManager.set('database', false)
                                     ↓ notifies subscribers
                              SafeMode recalculates level
                              useDegradation() hooks re-render
                              useCapability('database') returns false

runtime (network recovery)  →  degradationManager.set('database', true)
                                     ↓ notifies subscribers
                              SafeMode clears if all capabilities restored
                              useDegradation() hooks re-render
                              useCapability('database') returns true
```

### Minimum Viable for Phase Error Handling

We need AT LEAST:
1. A flag store (even a simple `Map<string, boolean>` with subscribe)
2. `runPhase()` to set flags instead of crashing
3. Hook to read flags in components

This unblocks phase error handling immediately. The full safe mode integration, recovery flows, and runtime re-initialization can come after.

---

## Section 5: Existing Subscription Patterns (Reusable)

These patterns already exist and the degradation system should follow the same conventions:

| System | Subscribe | Hook | Unsubscribe |
|--------|-----------|------|-------------|
| **Kernel State** | `kernel.subscribe(cb)` | `useAppKernel()`, `useSafeMode()` | Returns `() => void` |
| **Network Status** | `subscribeToNetworkStatus(cb)` | `useNetworkDetection()` | Returns `() => void` |
| **Offline Sync** | `OnlineSyncManager.subscribe(cb)` | `useOfflineQueue()` | Returns `() => void` |
| **Feature Flags** | `FeatureFlagsManager.subscribe(cb)` | `useFeatureFlags()` | Returns `() => void` |
| **Storage Keys** | `StorageManager.onKeyChange(key, cb)` | — | Returns `() => void` |
| **Query Cache** | `cacheSubscribe(key, cb)` | — | Returns `() => void` |

All follow the same pattern: `subscribe(callback) → unsubscribe()`. The degradation system should too.

---

## Summary Table

| Infrastructure | Status | Access Pattern | Subscription? |
|---------------|--------|---------------|---------------|
| Safe Mode (levels + UI + recovery) | ✅ Built | kernel.subscribe → hooks | ✅ Yes |
| Network Detection + State Machine | ✅ Built | subscribe → hook | ✅ Yes |
| Offline Queue + Sync + Cascade | ✅ Built | subscribe → hook | ✅ Yes |
| Adaptive Payload | ✅ Built | hook | ✅ Yes (via network) |
| Error Boundaries (3-layer) | ✅ Built | React tree | N/A |
| Auth Guards | ✅ Built | hook | N/A |
| Recovery Actions | ✅ Built | function call | N/A |
| Service Status Registry | ⚠️ Has Flag | **poll only** (function call) | ❌ No |
| Phase Error Classifier | ⚠️ Has Flag | not wired in | N/A |
| Adaptive Phase Executor | ⚠️ Has Flag | not wired in | N/A |
| PhaseState interface | ⚠️ Has Flag | type only, unused | N/A |
| 11 SafeModeReasons (unused) | ⚠️ Has Flag | enum defined, never triggered | N/A |
| KernelErrorCode (7 codes) | ⚠️ Has Flag | most map to UNKNOWN | N/A |
| **runPhase() skip logic** | 🔴 Needs Both | crashes all phases equally | N/A |
| **Per-phase error tracking** | 🔴 Needs Both | single error only | N/A |
| **Degradation Mode Manager** | 🔴 Needs Both | nothing exists | ❌ No |
| **Service status subscription** | 🔴 Needs Both | poll-only Map | ❌ No |
| **Auth NoOp provider** | 🔴 Needs Both | re-throws, kills phase | N/A |
| **Performance baseline try/catch** | 🔴 Needs Both | uncaught bug | N/A |
| **Phase → SafeMode mapping** | 🔴 Needs Both | no mapping | N/A |

---

## Next Steps

1. **Decide degradation manager design** — discuss flag/subscription API shape
2. **Implement minimum viable degradation manager** — flag store + subscribe + hook
3. **Update `runPhase()`** — classify errors, skip non-critical, set degradation flags
4. **Wire existing infrastructure** — connect `classifyPhaseError()`, `PhaseState`, `adaptive-phase-executor`
5. **Map phases to safe mode reasons** — which failure → which SafeModeReason + level
6. **Fix bugs** — performance baseline try/catch, auth provider re-throw
