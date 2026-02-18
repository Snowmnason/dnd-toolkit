# lib/offline

Persistent, encrypted offline mutation queue with automatic sync, conflict resolution (Last-Write-Wins), and real-time UI feedback. All mutations are durable, encrypted at rest (AES-256-CTR), and survive app restarts.

## When to Use This Module

- Offline-capable create/update/delete mutations that must sync to server
- Guaranteed delivery with automatic retry and exponential backoff
- Seamless UI experience with offline/online transitions and conflict handling
- Cache invalidation after successful sync
- Real-time sync status and error feedback to users

Do NOT use for: ephemeral state (use React state), read-only queries (use lib/cache or lib/api), analytics (use lib/analytics), or non-DB mutations.


## Relationship to lib/jobs

- **OfflineMutationQueue** (this): User-driven mutations (create/update/delete) queued and synced on reconnect
- **BackgroundJobQueue** (lib/jobs): Automatic deferred work (refreshes, cleanup) triggered by system events
- **Integration**: OnlineSyncManager enqueues feature_flags_refresh job on app resume

## Architecture & Data Flow

```
User Mutation → enqueueIfOffline()
  ├─ If offline: queue in SecureStorage (encrypted)
  ├─ If online: execute immediately via Supabase
  └─ Both: invalidate cache, notify UI via hooks
  ↓
OnlineSyncManager watches network status
  ├─ On reconnect: batch sync with debounce (5s default)
  ├─ Per-mutation: executeSyncHandler()
  ├─ Per-result: conflict detection, retry logic, cache invalidation
  └─ Notify listeners: useOfflineNotifications, useSyncNotifications
```

Key components:
- **OfflineMutationQueue**: Persistent FIFO queue (SecureStorage, encrypted)
- **OnlineSyncManager**: Network watcher, batch processor, retry handler, listener coordinator
- **Sync Handlers**: Per-table pluggable handlers (register during bootstrap)
- **Conflict Resolution**: Last-Write-Wins by timestamp (extensible)
- **UI Hooks**: Real-time feedback on offline status and sync progress

## API Reference

### Core Enqueueing

`enqueueIfOffline<T>(onlineFn, mutation): Promise<T | { queued: true; mutationId: string }>`

Main entry for offline-capable mutations.

**Parameters:**
- `onlineFn`: `() => Promise<T>` — function to call when online
- `mutation`: operation ('create' | 'update' | 'delete'), table, payload, ownerId?, invalidateTags?, cacheKeyPattern?

**Returns:** Result of onlineFn if online+success, or `{ queued: true, mutationId }` if offline/error

**Example:**
```ts
const result = await enqueueIfOffline(
  () => supabase.from("notes").update(payload).eq("id", id).select().single(),
  { operation: "update", table: "notes", payload, invalidateTags: ["notes"] }
);
if (isQueuedMutation(result)) console.log("Queued, will sync on reconnect");
```

`isQueuedMutation(result): boolean` — Type guard.

### Sync Handlers

`registerSyncHandler(table, handler): void`

Register per-table handler called during sync. Handler receives (payload, operation, supabaseClient), returns `{ success, data?, error?, conflict? }`.

**Example:**
```ts
registerSyncHandler("notes", async (payload, operation, supabase) => {
  if (operation === "update") {
    const { data, error } = await supabase
      .from("notes").update(payload).eq("id", payload.id).select().single();
    return { success: !error, data, error: error?.message };
  }
  // ... handle create, delete
});
```

`executeSyncHandler(mutation, supabase): Promise<SyncResult>` — Internal; executes registered handler.

### Sync Manager

`OnlineSyncManager.initialize(config?): Promise<void>`

Bootstrap (call once during app startup). Config: batchSize (5), debounceMs (5000), maxRetries (5), retryBaseMs (2000).

`OnlineSyncManager.subscribe(listener): () => void` — Listen to sync status changes. Callback receives `{ isSyncing, totalQueued, syncedCount, failedCount, conflicts, lastSyncAttempt?, lastError? }`.

**Example:**
```ts
const unsubscribe = OnlineSyncManager.subscribe((status) => {
  if (status.conflicts.length > 0) showConflictUI(status.conflicts);
});
```

### Conflict Resolution

`resolveLastWriteWins(mutation, conflict, serverTimestamp): ConflictResolutionResult`

Resolve via timestamp comparison. Returns `{ strategy, shouldRetry, shouldKeep, reason }`.

### UI Hooks

`useOfflineNotifications(): OfflineToastState` — Returns toast props for online/offline transitions.

`useSyncNotifications(): { toastProps, snackbarProps }` — Returns toast/snackbar props for sync events (started, complete, error, conflict).

### Types

**QueuedMutation**: id, operation, table, payload, ownerId?, timestamp, retryCount, serverVersion?, cacheKeyPattern?, invalidateTags?

**SyncConflict**: mutationId, type ('version_mismatch' | 'resource_deleted' | 'permission_denied'), serverVersion?, localVersion?, message, suggestedStrategy?

**OfflineSyncStatus**: isSyncing, totalQueued, syncedCount, failedCount, conflicts, lastSyncAttempt?, lastError?

## Error Handling & Edge Cases

**Network flapping**: Debounce (5s default) prevents rapid sync attempts; network stabilization required.

**Max retries exhausted**: After 5 attempts with exponential backoff (~30s total), mutation marked failed. Subscribe to status to show manual retry/discard UI.

**Conflict scenarios** (version mismatch, resource deleted, permission denied): LWW compares timestamps; newer wins. User intervention UI planned for future.

**Storage corruption**: Queue cleared on startup if validation fails; user notified.

**Storage quota exceeded**: Warning logged at 1MB; oldest mutations may evict if quota (5-10MB web, 100-200MB native) exceeded.

**Handler registration gaps**: Sync fails with "No handler registered for table X"; mutation remains queued for retry.

## Performance Notes

- **Enqueue cost**: Online success ~100-500ms (Supabase delay), offline ~8ms (encryption + store)
- **Storage per mutation**: 150-250 bytes metadata + payload size
- **Sync batching**: 5 mutations per batch, ~2s per batch typical
- **Retry schedule**: Immediate, then 2s, 4s, 8s, 16s delays (exponential backoff)
- **Queue load**: ~5-50ms for 10-100 mutations; grows ~O(n) with size
- **UI hook overhead**: ~2-3ms setup, 10-50ms re-render on status change

## Dependencies

**External:** supabase-js, react-native-reanimated (for native sync notifications)

**Internal:** works with lib/storage (SecureStorage), lib/network (NetworkDetection), lib/cache (QueryCache for invalidation), lib/analytics (future: sync metrics)

## Related Modules

- [lib/storage](../storage/README.md) — All mutations encrypted via SecureStorage
- [lib/network](../network/README.md) — Network status detection for sync triggers
- [lib/cache](../cache/README.md) — Cache invalidation on sync success
- [lib/jobs](../jobs/README.md) — Feature flag refresh enqueued on app resume

## File Breakdown

| File                         | Purpose                                             | Lines |
| ---------------------------- | --------------------------------------------------- | ----- |
| mutation-queue.ts            | Persistent, encrypted FIFO mutation queue           | ~200  |
| sync-manager.ts              | Network watcher, batch processor, retry handler     | ~450  |
| conflict-resolution.ts       | Last-Write-Wins conflict resolution                 | ~200  |
| sync-handlers.ts             | Per-table pluggable handler registry                | ~150  |
| types.ts                     | Strongly typed mutation, sync, conflict structures  | ~150  |
| utils.ts                     | Helpers (enqueue, optimistic update, etc.)          | ~80   |
| use-offline-notifications.ts | React hook for offline status UI                    | ~50   |
| use-sync-notifications.ts    | React hook for sync status UI                       | ~50   |
| index.ts                     | Barrel export                                       | ~60   |

---
