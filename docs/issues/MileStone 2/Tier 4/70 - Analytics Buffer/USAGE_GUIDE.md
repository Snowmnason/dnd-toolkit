# Usage Guide — Analytics Buffer (Issue #70)

Quick reference for product engineers and developers on how to use, inspect, and troubleshoot the analytics buffer.

## What it does (summary)
- Transparently queues analytics events when offline.
- Automatically flushes when the device becomes online (debounced).
- Retries failed sends with exponential backoff; discards permanent failures.
- Respects analytics consent: no flushing when consent absent; pending events discarded on consent withdrawal.

## How to enable / configure
- Edit `config/appsettings.json` / `config/appsettings.dev.json` under `analytics.buffer`.
- Defaults (already used if missing):
```json
{
  "enabled": true,
  "maxSize": 100,
  "maxRetries": 5,
  "batchSize": 25,
  "retryBaseMs": 1000,
  "debounceMs": 5000
}
```

## Developer integration checklist
- Startup:
  - `await analyticsBufferService.initialize()` (call during app kernel bootstrap)
  - `initializeAnalyticsNetworkIntegration()` (subscribe to network/status + start retry scheduler)
- Consent changes:
  - On withdraw: call `handleAnalyticsConsentWithdrawal()` to discard pending events
  - On grant: normal buffering & flushing resumes for new events

## Public APIs & examples

Import:
```ts
import {
  analyticsBufferService,
  flushAnalyticsQueue,
  initializeAnalyticsNetworkIntegration,
  handleAnalyticsConsentWithdrawal,
} from "@/lib/analytics";
```

Enqueue (internal usage — analytics lib will call this when buffering is needed):
```ts
await analyticsBufferService.enqueue({
  eventType: 'screen_view',
  payload: { screen: 'Home' },
  maxRetries: 5,
});
```

Force a manual flush (rarely needed):
```ts
flushAnalyticsQueue(); // non-blocking
```

Clear queue (emergency):
```ts
await analyticsBufferService.clear();
```

Consent withdraw handler (call when user revokes analytics consent):
```ts
await handleAnalyticsConsentWithdrawal();
```

## Debugging & Admin UI (recommended)
- Use `useAnalyticsBufferStatus()` (debug hook) to show:
  - `queueSize`, `isFlushing`, `lastFlushTime`, `queuedEventTypes`.
- Check logs under `logger.category('analytics')` for detailed activity: enqueue, flush attempts, retries, discards.
- Inspect SecureStorage key `dnd:analytics:offline_queue` on device debugging (only non-PII fields stored).

## Troubleshooting
- Events not queued:
  - Confirm `analyticsBufferService.isInitialized()` returned true.
  - Confirm `AnalyticsConsent.isAllowed('usage')` is true for buffer-enabled events.
  - Verify `SecureStorage` availability; if unavailable, buffer falls back to in-memory (transient).

- Events not flushing:
  - Confirm device reports online with `NetworkDetection.isOnline()`.
  - Check `flushAnalyticsQueue()` logs for HTTP status or network errors.
  - Check `lastFlushTime` and `isFlushing` from debug hook.

- Duplicate events observed:
  - Confirm event `id` deduplication; if backend duplicates appear, ensure server-side idempotency with event id header.

- Queue grows unexpectedly:
  - Backend may be returning 5xx (check logs); retry backoff will delay retries. Increase `batchSize` or `retryBaseMs` if needed.

## Testing notes (for QA)
- Simulate offline: queue events, restart app, confirm queue persisted, then bring online and assert flush success.
- Simulate 4xx vs 5xx: return 4xx to ensure events discarded, return 5xx to ensure events remain and retry as scheduled.

## Security & Privacy
- No PII stored; events are sanitized before enqueuing.
- Buffer obeys user consent; pending events are discarded on consent withdrawal.

---

(End of usage guide)
