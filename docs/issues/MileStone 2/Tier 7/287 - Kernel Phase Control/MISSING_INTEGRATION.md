# Degradation Framework — Missing Integration

Status after audit (April 2026). Two categories: **real unregistered gaps** (code paths that silently no-op) and **deliberately deferred TODOs** (infrastructure work blocked on other features).

---

## 2. DEFERRED TODOs — `system-responses.ts` Infrastructure Actions

**File**: `system/Degrade/responses/system-responses.ts`  
**Status**: All response bodies are `// TODO:` stubs with `console.warn`

These are intentionally deferred — each TODO depends on a system that doesn't exist yet. The handlers ARE called when degradation occurs (registration is wired correctly) — they just don't do anything useful yet.

| Capability | On Degrade TODO | On Recovery TODO | Blocked On |
|---|---|---|---|
| `CONNECTIVITY` | Pause outbound API requests, switch to offline-first (serve from cache, queue writes), stop heartbeat intervals | Drain offline mutation queue, resume polling, trigger stale query refresh | Offline Queue (`Network Offline Queue` in todo list) |
| `DATABASE` | Switch to local-only storage fallback, start buffering mutations for replay | Flush buffered mutations, resume DB ops, re-validate cache freshness | Offline Queue |
| `SYNC` | Pause real-time sync subscriptions, mark local data stale | Re-establish realtime subscriptions, trigger full reconciliation | Sync manager subscription API |
| `BACKGROUND_JOBS` | Pause job queue processing (let running jobs finish) | Resume queue, re-process paused jobs | Job queue pause/resume API |
| `STORAGE` | Switch to in-memory fallback for critical data, stop non-essential writes | Flush in-memory fallback to persistent storage | Safe mode crash path (partly covered) |
| `ANALYTICS` | Buffer locally if space permits | Flush buffered events | Analytics buffer (`Add Local Analytics Buffer` in todo list) |
| `ERROR_TRACKING` | Fall back to console.error, buffer locally | Flush buffered reports | Error tracking buffer |
| `PREMIUM_FEATURES` | Revoke premium system resource access, stop premium-only sync | Restore premium resource access | Premium/entitlements system |

### Note on cache serving when offline

The `CONNECTIVITY` response stub says "switch to offline-first mode (serve from cache)" — this is the "offline cache recovery" gap. When the flag is set, nothing currently tells the API layer to serve from `QueryCache` instead of making network calls. The circuit breaker will handle failing requests, but proactively switching to cache reads is not implemented. This belongs in the `CONNECTIVITY` and `DATABASE` response handlers above, blocked on the offline queue work.

---

## Registration Phase Bootstrap — Missing Items

**Placeholder subscriptions** (not yet implemented, waiting for parent systems):
- `sync-recovery-subscription` — Needs sync manager recovery events API
- `job-recovery-subscription` — Needs job queue retry success events API
- `service-health-subscription` — Needs service health monitoring infrastructure

**Retry logic system** (deferred, needed for Track 7):
- Storage: `lib/kernel/registration-failed-items.ts` — Persist failures to `SecureStorage`
- Auto-retry: `lib/kernel/registration-retry-system.ts` — Subscribe to `appDegrade` recovery, re-attempt failed items
- Manual retry: Button in Settings screen to trigger retry for specific failed items
- **Pseudocode:**
  ```typescript
  // On capability recovery, retry all failures for that capability
  appDegrade.subscribe((state, prev) => {
    for (const [cap, current] of Object.entries(state.capabilities)) {
      if (!prev.capabilities[cap].available && current.available) {
        retryFailedRegistrationsByCapability(cap);
      }
    }
  });
  ```

**Safe mode screen integration** (Track C-2):
- Show `RegistrationResult.failuresSummary` on failures
- File: `lib/kernel/safe-mode-screen-builder.ts` — Build SafeModeState from failures
- Call in `registration-phase.ts` after phase completes if failures exist

**Analytics + telemetry** (deferred):
- Events: `registration.item_failed`, `registration.retry_attempted`, `registration.recovery_detected`
- Dashboard: Track failure patterns per device/platform/network

---

## Summary

| Gap | Severity | Fix Location | Blocked On |
|---|---|---|---|
| `registerCrashCallback` never registered | High (storage/config crashes silently fail to enter safe mode) | `registration-phase.ts` (1 import + ~10 lines) | Nothing — ready to implement now |
| `system-responses.ts` infrastructure bodies | Low-Medium (flags set correctly, actions just no-op) | `system/Degrade/responses/system-responses.ts` | Offline Queue, circuit breaker, analytics buffer |
| **Track C:** Placeholder subscriptions | Low (expected, not yet ready) | `lib/subscriptions/registry.ts` | Sync/job managers recovery APIs |
| **Track C:** Retry logic system | Medium (needed for Track 7) | `lib/kernel/registration-retry-system.ts` + Settings UI | Auto-increment version, recovery detection |
| **Track C:** Safe mode screen display | Medium (Track C-2) | `lib/kernel/safe-mode-screen-builder.ts` | SafeModeState support |
| **Track C:** Analytics events | Low (nice-to-have) | `lib/analytics/` integration | Not blocking implementation |

## **Track C-2: Safe Mode Screen Integration (DEFERRED)**

**Status:** ⏳ **PENDING** — Awaits Track C implementation + safe mode system readiness

**Goal:** Display safe mode screen when registrations fail

**Implementation (High-Level):**
1. In `system/Kernel/registration-phase.ts`, after registrations complete:
   ```typescript
   const result = await registrationPhase();
   if (result.failed.length > 0 && !appDegrade.getState().degraded) {
     const safeMode = buildSafeModeFromRegistration(result);
     setSafeMode(safeMode);  // Shows full-screen UI with failures
   }
   ```

2. Safe mode screen displays:
   - "The following features are temporarily unavailable:"
   - List: "Auto-save", "Feature Updates", "Network Retry", etc.
   - Reason: "(requires network connection)"
   - Action: "Continue to App" or "Retry Now"

**Dependencies:**
- Track C implementation must complete first
- Safe mode screen component must exist
- SafeModeState must support `failures` metadata

**Next Step:** Implement in separate smaller PR after Track C

---

**Dependencies:**
- `services`, `jobSetup`, `auth`, `featureFlags` must all complete first (execution order ensures this)
- Needs degradation state from `appDegrade` (already wired)
- Needs phase context to know which degradations are active
- Needs `MISSING_INTEGRATION.md` for visibility into deferred items

**Next step:** Implement Track C in registration-phase.ts after Tracks A, B, D are merged. Create MISSING_INTEGRATION.md simultaneously for deferred tracking.

---