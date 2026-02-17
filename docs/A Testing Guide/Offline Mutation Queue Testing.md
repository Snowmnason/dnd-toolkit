# Offline Mutation Queue — Testing Guide

This testing guide lists manual test cases, automated test suggestions, platform-specific notes, and success criteria for the Offline Mutation Queue (Issue #206).

## Manual Test Cases
- [ ] Create an entity while offline → UI shows "1 pending change" → go online → mutation synced and removed from queue.
- [ ] Edit an entity while offline → restart app while still offline → queue persists after restart → go online → edits synced in order.
- [ ] Perform multiple mutations (create, update, delete) offline → confirm they sync in FIFO order.
- [ ] Simulate transient network errors (5xx) → mutations retry with exponential backoff (delays increase on subsequent attempts).
- [ ] Force a 4xx server validation error → mutation moves to dead-letter and optimistic update is rolled back.
- [ ] Create a conflict (server updated same row while client offline) → conflict detected and handled via Last-Write-Wins; verify conflict recorded in conflict queue.
- [ ] `SyncStatus` component appears only when queue non-empty and shows spinner when syncing.
- [ ] Optimistic update flow: UI immediately reflects change, then finalizes after sync; on permanent failure, rollback occurs.

## Automated Tests (Unit & Integration)

- Unit tests for `lib/offline/mutation-queue.test.ts`:
  - Enqueue persists to `SecureStorage` and `getAll()` returns FIFO order.
  - `peek(batchSize)` returns correct batch size and order.
  - `markFailed()` increments retry count and computes nextAttemptAt.
  - Max retries leads to `discard()` / dead-letter behavior.

- Sync manager integration tests (`lib/offline/sync-manager.test.ts`):
  - On `NetworkDetection.isOnline = true`, `OnlineSyncManager` processes ready mutations.
  - Success path removes items and calls `QueryCache.invalidateByTags()`.
  - 4xx errors are discarded (dead-letter) and not retried.
  - 5xx/network errors cause retry with backoff and keep items in queue.

- Hook/component tests:
  - `useOfflineQueue()` returns real-time `queueSize` and `isSyncing`.
  - `<SyncStatus />` renders correctly for non-empty queue and updates when queue empties.

## Test Data Setup
- Create small test fixtures: `character`, `world`, `note` objects with deterministic IDs for assertions.
- Use a mock `supabaseClient` or local test double for sync handlers to control responses (200, 4xx, 5xx).

## Platform-specific Notes
- Web: Use browser DevTools to go offline, throttle network, and inspect local storage; use the exported `OfflineMutationQueue.getAll()` for debug output.
- iOS / Android: Use airplane mode or network conditioner to simulate offline; verify SecureStorage persistence across app restarts.

## Commands
Run local unit/integration tests and linting (adjust to your project scripts):

```bash
# run tests (uses project's test runner, e.g., vitest/jest)
npm run test

# run lint
npm run lint
```

## Success Criteria
- All manual test cases pass consistently across web, iOS, and Android.
- Unit and integration tests cover enqueue/peek/remove, retry/backoff, and dead-letter logic.
- UI tests show `SyncStatus` behavior and optimistic update flows reliably.

## Troubleshooting Tests
- If queue persistence tests fail on CI, ensure SecureStorage test shim/mocks are in place.
- For flaky network tests, add deterministic mock for `NetworkDetection` to avoid environment-dependent flakes.

---
End of testing guide.
