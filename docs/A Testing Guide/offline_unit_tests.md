**Offline Unit Tests — Overview**

Purpose: define the small set of unit tests and scenarios we should cover for the offline/sync foundation so that when we later wire handlers, versioning, and integration tests we already have focused unit coverage.

Scope (high-level):

- `resolveLastWriteWins` behavior
- `OnlineSyncManager.syncMutation` decision branches (success, retryable error, conflict)
- `enqueueIfOffline` queueing fallback
- `OfflineMutationQueue` operations (enqueue, peek, remove, markFailed, discard)
- `ConflictQueueManager` enqueue/remove/subscribe persistence behavior
- `createOptimisticUpdate` optimistic update behavior for create/update/delete
- Notification hooks: `use-offline-notifications` timer cleanup and `OfflineSyncNotificationLayer` sequencing
- Cache invalidation on successful sync (`QueryCache.invalidateByTags` usage)

Test patterns and suggestions:

- Use Jest or Vitest (repository uses TypeScript) with mocking for storage and Supabase client.
- Mock time for timestamp comparisons (use fake timers) to create deterministic tests for LWW.
- Use small, focused unit tests rather than large end-to-end tests. E2E can be added later.

Suggested test cases

1. `resolveLastWriteWins`

- server `updated_at` undefined → result: server-wins (conservative)
- server `updated_at` < client timestamp → local-wins (shouldRetry=true)
- server `updated_at` == client timestamp → deterministic tie-break (server-wins or defined policy)
- server `updated_at` > client timestamp → server-wins (discard)

2. `enqueueIfOffline` + `OfflineMutationQueue`

- when offline: `enqueueIfOffline` returns queued marker and item persists in `OfflineMutationQueue`
- when online: `enqueueIfOffline` executes `onlineFn` and does not queue
- on network error during online execute: falls back to queueing

3. `OnlineSyncManager.syncMutation` decision branches

- handler returns success -> queue item removed and `QueryCache.invalidateByTags` called
- handler returns retryable network error -> `OfflineMutationQueue.markFailed` called and retryable result returned
- handler returns conflict and handlerResult.data.updated_at older/newer -> correct LWW branch followed (markFailed or remove)
- handler returns conflict and provides `updated_at` string -> `sync-manager` extracts and normalizes timestamp

4. `ConflictQueueManager`

- `enqueueConflict` stores conflict item and `subscribe` listeners notified
- `removeConflict` removes and subscribers reflect change

5. `createOptimisticUpdate`

- create: appends payload to array
- update: missing id field returns `undefined` and logs warning (mock logger)
- delete: removes matching id or returns `null` for non-array data

6. Notification hooks & UI layer

- `use-offline-notifications` clears timers on unmount and status change (no leaks)
- `OfflineSyncNotificationLayer` does not flicker when state rapidly toggles (use fake timers, assert no multiple toasts)

7. Cache invalidation

- after simulated successful sync, `QueryCache.invalidateByTags` called with `mutation.invalidateTags`

Test organization and files

- `tests/offline/resolveLastWriteWins.test.ts`
- `tests/offline/sync-manager.test.ts`
- `tests/offline/mutation-queue.test.ts`
- `tests/offline/conflict-queue.test.ts`
- `tests/offline/optimistic-update.test.ts`
- `tests/offline/notifications.test.ts`

Utilities / helpers for tests

- `tests/utils/mockFastCache.ts` (in-memory implementation)
- `tests/utils/mockSecureStorage.ts` (in-memory secure store)
- `tests/utils/mockSupabase.ts` (handler stubs returning controlled results)
- time helpers to freeze/set `Date.now()` or advance timers

Notes / next steps

- When handlers adopt `updated_at`/`version`, add tests that simulate server-provided timestamps and verify `sync-manager` uses them for LWW.
- Add a short runbook describing how to run offline tests and where to add new tests: `npm run test` (or repo's test command).

If you want, I can scaffold the test files with a few representative tests (e.g., `resolveLastWriteWins` and `enqueueIfOffline`) next.
