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

## Summary

| Gap | Severity | Fix Location | Blocked On |
|---|---|---|---|
| `registerCrashCallback` never registered | High (storage/config crashes silently fail to enter safe mode) | `registration-phase.ts` (1 import + ~10 lines) | Nothing — ready to implement now |
| `system-responses.ts` infrastructure bodies | Low-Medium (flags set correctly, actions just no-op) | `system/Degrade/responses/system-responses.ts` | Offline Queue, circuit breaker, analytics buffer |
