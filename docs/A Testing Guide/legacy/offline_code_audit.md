# Offline Code Audit

Purpose: capture what the current offline stack does, how it ties into hooks/screens, and what future enhancements/comments were embedded in the code so we can translate them into clean QA guidance later.

## Core modules (from `/lib/offline`)

1. **`sync-manager.ts` (`OnlineSyncManager`)**
   - Subscribes to `NetworkDetection` and debounces reconnection events to avoid thrashing.
   - Pulls queued mutations from `OfflineMutationQueue.peek(batchSize)` and runs them through `executeSyncHandler` with the live Supabase client (dynamically imported).
   - Detects conflicts by checking `handlerResult.conflict` and runs `executeConflictResolution` with a Last-Write-Wins (LWW) policy (client wins if timestamp newer, otherwise discard).
   - Tracks retryable failures (`network`/`429`), marks them with `markFailed`, then automatically retries using `calculateBackoff` (future enhancement: expose telemetry to QA?).
   - Flushes cache tags via `QueryCache.invalidateByTags` when handlers return `invalidateTags`.

2. **`mutation-queue.ts` (`OfflineMutationQueue`)**
   - Persists queued mutations through `SecureStorage` (see `SecureStorage` wrapper) with operations: `enqueue`, `peek`, `remove`, `markFailed`, `discard`, `size`.
   - Supports `Atomic` operations for safe concurrency (ensures `enqueue` and `remove` do not race).
   - Comments suggest durability is crucial for cross-session sync (QA should verify queue survives app restarts and offline crashes).

3. **`sync-handlers.ts` + `utils.ts`**
   - `registerSyncHandler` wires tables to handler functions that call Supabase (currently `lib/database/*` modules provide these handlers).
   - `enqueueIfOffline` wraps mutations; if offline or handler fails, it records `QueuedMutation` with metadata (table, operation, payload, `invalidateTags`).
   - `createOptimisticUpdate` supplies helpers for UI to speculatively update arrays.
   - Comments mention future enhancements: throttled retries, pluggable conflict strategies, user-facing conflict modal (v1 is LWW only).

4. **Conflict/Notification helpers (`conflict-resolution.ts`, `conflict-queue-manager.ts`, `use-conflict-queue.ts`, `use-offline-notifications.ts`)**
   - Conflicts are enqueued through `ConflictQueueManager` and currently resolved without user interaction (LWW). Comments explicitly say future versions may expose modals.
   - Notification hooks (`use-offline-notifications`, `use-sync-notifications`) clean up timers (watch for leaks) and broadcast state changes; tests should ensure timers are cleared on unmount.

## Hook / feature connections

- `hooks/use-worlds-mutation.tsx` and `hooks/use-world-modal.tsx` call `enqueueIfOffline` and rely on `OfflineMutationQueue` metadata.
- `hooks/use-world-creation.tsx` uses `worldsDB` (which registers sync handler) to insert new worlds via offline queue.
- `hooks/use-sync-notifications` monitors `OnlineSyncManager` status listeners to show toasts and snackbar actions (QA should verify toasts like `"Syncing X"`, `"Retry"`).

## Observations / actionable suggestions for docs and QA

- **LWW is hard-coded**. Conflicts never surface to QA yet—they always auto-resolve. Document the two scenarios (server newer vs local newer) so QA can verify behavior matches the code comments.
- **Retry/backoff handling**: `calculateBackoff` (not shown yet, but referenced) is crucial. QA could simulate flaky networks to exercise the exponential backoff path.
- **Cache invalidation**: `QueryCache.invalidateByTags` is called only for successful mutations that explicitly set `invalidateTags`. Tests should cover both the presence and absence of tags.
- **Offline persistence**: comments emphasise queue durability across restarts; add QA steps: queue while offline, kill app, relaunch, confirm pending items sync.
- **Notification hooks**: `use-offline-notifications` uses timers and `useEffect` cleanup. Recommend unit tests for timer cleanup (covered in existing offline unit tests but call out to remind QA).
- **Future features** mentioned inline\*\*: user-visible conflict modal, better telemetry/logging, admin-visible script for queue inspection (makes sense for future `scripts` section). Document these notes so QA knows what's planned.

## Suggestions for improvements

- Log more metadata when `OfflineMutationQueue.markFailed` is invoked (currently only reason string). QA could capture these logs when a mutation fails to trace issues.
- Consider guarding `executeSyncHandler` dynamic import to reuse single Supabase client instead of re-importing each time (performance/memory). Could be noted as a future dev improvement.
- Add guard for `handlerResult.data?.updated_at` parsing; currently `new Date()` is called without validation. Tests should simulate invalid dates to ensure `executeConflictResolution` handles `NaN` by defaulting to server-wins.
- `NetworkDetection` is subscribed but never unsubscribed; ensure `OnlineSyncManager.destroy` (if added later) cleans up to prevent leaks during hot reload or tests.

## Next steps for QA docs

1. Translate the above modules into a structured testing guide (preferably one per platform).
2. Mirror the suggested offline unit tests already drafted; we can map each test case to code paths above.
3. Keep this audit file under `legacy/` as a reference for future doc updates.
