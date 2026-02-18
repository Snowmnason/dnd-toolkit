# Breadcrumb Queue Testing

This guide documents manual and exploratory tests for the Breadcrumb Queue (provider-agnostic) implemented at `lib/analytics/breadcrumb-queue.ts`.

Quick checklist
- Enqueue while offline → persists to SecureStorage
- Flush on online transition → provider.sendBatch called
- Batch behavior: 10 per request
- Retry/backoff: 5 retries, exponential backoff
- Deduplication: same fingerprint skipped within 24h
- Overflow: >500 breadcrumbs → oldest dropped

Manual test steps
1. Setup
   - Build & start the app in dev mode
   - Ensure a provider adapter is available (Sentry or a test mock)

2. Offline → Online flow
   - Put device into offline mode (DevTools offline, Airplane mode)
   - Trigger breadcrumbs (UI action or manual Sentry.addBreadcrumb)
   - Confirm breadcrumbs are persisted (inspect SecureStorage key `STORAGE_KEYS.BREADCRUMB_QUEUE`)
   - Bring device online → observe provider receives batches

3. Batch & rate limit tests
   - Queue 15 breadcrumbs offline → expect two batches (10 + 5)
   - Mock provider to return 429 with `Retry-After` → queue should keep breadcrumbs and retry after indicated time
   - Mock provider to return 400 → breadcrumb discarded

4. Overflow
   - Enqueue >500 items and verify oldest items are dropped and overflow counter increments

5. Resilience
   - Simulate app crash with pending breadcrumbs, restart app, verify queue recovered
   - Toggle network rapidly (offline/online) and verify flush is debounced (single flush per 5s)

Notes for QA automation
- The repo includes unit/integration/stress tests under `__tests__/analytics/` as a starting point.
- Integration tests mock a `provider.sendBatch` implementation to drive success/retry/discard flows.
