# Implementation Guide — Analytics Buffer (Issue #70)

Purpose: document what was added for the analytics offline buffer so engineers can understand integration points, data shapes, behaviors, and runtime config.

## Overview

New module: `lib/analytics/analytics-buffer.ts`
- Singleton `AnalyticsBufferService` that persists analytics events to `SecureStorage` under `dnd:analytics:offline_queue`.
- Network integration in `lib/analytics/analytics-network-integration.ts` exposing `initializeAnalyticsNetworkIntegration()`, `flushAnalyticsQueue()`, `cleanupAnalyticsNetworkIntegration()`, and `handleAnalyticsConsentWithdrawal()`.
- Exports wired through `lib/analytics/index.ts` (buffer service, helpers, network integration functions).

## Key Additions

### QueuedAnalyticsEvent
- Fields: `id` (UUID), `timestamp`, `eventType`, `payload`, `retryCount`, `maxRetries`, `nextAttemptAt?`, `lastErrorReason?`, `metadata?` (offlineAt, priority).
- Minimal, sanitized payload only (no PII persisted).

### AnalyticsBufferService (public API)
- `initialize(config?: Partial<AnalyticsBufferConfig>): Promise<void>` — load persisted queue, validate, apply runtime overrides.
- `enqueue(event): Promise<QueuedAnalyticsEvent | null>` — add event (FIFO), persist, drop oldest on overflow.
- `peek(batchSize): QueuedAnalyticsEvent[]` — get next batch (FIFO, synchronous).
- `remove(ids): Promise<void>` — remove successfully sent events.
- `markFailed(id, reason): Promise<void>` — increment retryCount, set `nextAttemptAt` (exponential backoff), discard if max retries exceeded.
- `discard(id, reason): Promise<void>` — permanently drop a specific event.
- `clear(): Promise<void>` — wipe queue (used for consent withdrawal).
- `getAll(): Promise<QueuedAnalyticsEvent[]>` and `getStats(): AnalyticsBufferStats` — diagnostics.
- `handleConsentWithdrawal(): Promise<void>` — immediate discard of pending events on consent withdraw.

### Retry/backoff
- `calculateExponentialBackoff(retryCount, baseMs=1000)` — progression: 1s, 2s, 4s, 8s, 16s (cap at 2^4).
- Events scheduled using `nextAttemptAt` (timestamp) and retried only when ready.
- `markFailed` auto-discards after `maxRetries`.

### Network integration
- Subscribe to `NetworkDetection` online transitions; on online, debounce and call `flushAnalyticsQueue()`.
- `flushAnalyticsQueue()` batches (configurable `batchSize`, default 25), sends to backend, treats 2xx as success, 4xx as permanent (calls `markFailed` so it can be discarded), 5xx/network as retryable (calls `markFailed` to schedule retry).
- Retry scheduler checks for ready events every 30s and triggers non-blocking flushes when online.
- On service `initialize()` an immediate ready-event flush is scheduled if the app starts online and ready events exist (prevents waiting for network flap).

### Consent behavior
- Buffer respects analytics consent (`AnalyticsConsent.isAllowed('usage')`) before flushing.
- `handleConsentWithdrawal()` clears pending queue and logs non-identifying discard.

## Validation & Survivability
- On load: corrupted entries (missing id/timestamp/eventType) are discarded and logged; events older than 7 days are removed; queue trimmed to `maxSize` (drop oldest) and overflow count tracked.
- Storage fallback: when SecureStorage fails, queue operates in-memory (documented; events lost on restart).

## Config (runtime)
- Exposed under `appsettings.analytics.buffer` (dev values override prod). Keys:
  - `enabled` (bool)
  - `maxSize` (number, default 100)
  - `maxRetries` (number, default 5)
  - `batchSize` (number, default 25)
  - `retryBaseMs` (ms, default 1000)
  - `debounceMs` (ms, default 5000)

## Logging / Telemetry
- `logger.category('analytics')` used for all buffer ops: enqueue, flush start/complete/failure, markFailed, discard, overflow, consent discards, retry scheduler activity.
- Integrates with #208 telemetry: buffer size / overflow / retry counts can be included in network telemetry events.

## Files changed / Created
- `lib/analytics/analytics-buffer.ts` (new features & API)
- `lib/analytics/analytics-network-integration.ts` (network integration + retry scheduler)
- `lib/analytics/index.ts` (exports updated)
- `hooks/analytics/use-analytics-buffer-status.ts` (diagnostic hook)
- `lib/analytics/README.md` (buffer section added)

## Integration checklist for engineers
- Call `analyticsBufferService.initialize()` in `AppKernel` startup (after `kernel.phases.appReady`).
- Call `initializeAnalyticsNetworkIntegration()` once at startup to subscribe to network events.
- On user consent changes, call `handleAnalyticsConsentWithdrawal()` when consent is removed.

## Notes & Rationale
- FIFO overflow chosen to preserve newest user actions while bounding storage.
- Deduplication by UUID; backends should accept idempotency keys if required.
- Retry scheduling keeps failed events in queue until they either succeed or exceed `maxRetries`.

---

(End of implementation guide)
