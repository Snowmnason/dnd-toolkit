# Analytics Buffer — Testing Guide

## Overview

- **Purpose:** Verify analytics events are safely buffered while offline and flushed when online.
- **What we're testing:** Buffer persistence, FIFO ordering, retry/backoff, deduplication, overflow, and consent behavior.

## Environments

- Web (DevTools offline), iOS (Airplane Mode / Network Link Conditioner), Android (Airplane Mode)

## Manual Test Cases

### ✓ Test 1: Event queued while offline and flushed on reconnect

Steps:
1. Go offline.
2. Trigger an analytics event (pageview or custom event).
3. Confirm the event shows in the pending indicator (or use `useAnalyticsBufferStatus()` for debug).
4. Go online and wait for flush.

Expected:
- Event persisted and removed after successful flush.

### ✓ Test 2: Multiple events flush in FIFO order

Steps:
1. Go offline.
2. Emit three events in a known order (A, B, C).
3. Go online and wait for flush.

Expected:
- Backend receives A → B → C order.

### ⚡ Test 3: 5xx response retries with backoff

Steps:
1. Use mock backend to return 500 on first attempt, 200 on second.
2. Enqueue event(s) offline and bring app online.

Expected:
- First attempt fails and event remains queued; second attempt succeeds and event removed.

### ⚡ Test 4: 4xx response is discarded

Steps:
1. Mock backend to return 400 for a specific event.
2. Enqueue that event and bring app online.

Expected:
- Event is discarded and not retried; UI rolls back optimistic update if applicable.

### ✓ Test 5: Queue overflow drops oldest

Steps:
1. Configure `maxSize` to 100 (default).
2. While offline, enqueue >100 events.

Expected:
- Oldest events are dropped; queue size remains at or below `maxSize`.

### ✓ Test 6: Persist across restart

Steps:
1. Enqueue events while offline.
2. Restart app without restoring network.
3. Verify queue still present and events remain.

Expected:
- Pending events survive app restart and flush after reconnect.

### ✓ Test 7: Consent withdrawn discards pending events

Steps:
1. Enqueue events while offline with consent enabled.
2. Withdraw analytics consent.

Expected:
- Pending events are discarded and not flushed.

## Debugging & Tools

- Use `useAnalyticsBufferStatus()` hook to inspect `queueSize`, `isFlushing`, `lastFlushTime`.
- Check SecureStorage key `dnd:analytics:offline_queue` for raw persisted data (developer only).

## Success Criteria

- Events queued when offline and reliably flushed when online (>95% delivery in test runs).
- No duplicates on successful flush.
- Queue trims to configured `maxSize` and survives restarts.
