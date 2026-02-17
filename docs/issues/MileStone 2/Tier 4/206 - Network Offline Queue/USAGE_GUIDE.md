# Network Offline Queue — Usage Guide

This guide explains how to integrate and use the Offline Mutation Queue and Online Sync Manager introduced for Issue #206. It provides a concise checklist, code examples, debugging steps, and troubleshooting tips for implementers and integrators.

**When to Use**
- Use the offline queue whenever user-driven mutations (create/update/delete) must be preserved across network interruptions.
- Use for data that must preserve causality (create before update) and avoid user-visible data loss.

**Integration Checklist**
- Register per-table sync handlers (one-time, app bootstrap).
- Wrap mutation calls with `enqueueIfOffline()` or use `OfflineMutationQueue.enqueue()` directly where appropriate.
- Add `useOfflineQueue()` to a top-level area (layout, status bar) to monitor queue size and status.
- Mount `<SyncStatus />` in the app layout to show pending count and syncing indicator.
- Use optimistic helpers (`createOptimisticUpdate()` / `rollbackOptimisticUpdate()`) for responsive UI.
- Ensure `OnlineSyncManager.initialize()` runs in the kernel bootstrap (it already does in AppKernel).

**API Reference (quick)**
- `OfflineMutationQueue.enqueue(mutation)` — Persist a mutation (id, table, operation, payload, invalidateTags).
- `OfflineMutationQueue.peek(batchSize)` — Return next FIFO batch (ready for processing).
- `OfflineMutationQueue.remove(id)` — Remove a mutation after successful sync.
- `OfflineMutationQueue.discard(id)` — Permanently remove (dead-letter) a mutation.
- `OnlineSyncManager.subscribe(cb)` — Listen for sync status updates and progress.
- `enqueueIfOffline(fn, mutationDescriptor)` — Wrapper that queues when offline and executes when online.
- `useOfflineQueue()` — Hook that returns `{ queueSize, isSyncing, lastSyncedAt, deadLetterCount }`.
- `<SyncStatus />` — UI component showing pending changes and a syncing spinner.

**Code Examples**

- Registering a sync handler (bootstrap):

```ts
import { registerSyncHandler } from '@/lib/offline/sync-handlers';

registerSyncHandler('worlds', async ({ operation, payload, supabaseClient }) => {
  if (operation === 'update') {
    return await supabaseClient.from('worlds').update(payload).eq('id', payload.id);
  }
  // handle create/delete as needed
});
```

- Wrapping a mutation with `enqueueIfOffline()`:

```ts
import { enqueueIfOffline } from '@/lib/offline/utils';

await enqueueIfOffline(
  () => supabase.from('characters').insert(newChar),
  {
    operation: 'create',
    table: 'characters',
    payload: newChar,
    invalidateTags: ['characters']
  }
);
```

- Using optimistic helpers:

```ts
import { createOptimisticUpdate, rollbackOptimisticUpdate } from '@/lib/offline/utils';

const optimisticId = createOptimisticUpdate({ cacheKey: 'characters', value: newChar });
try {
  await enqueueIfOffline(...);
} catch (err) {
  rollbackOptimisticUpdate(optimisticId, 'characters');
}
```

**Debugging & Monitoring**
- Inspect the queue programmatically during development:

```ts
import { OfflineMutationQueue } from '@/lib/offline/mutation-queue';
const items = await OfflineMutationQueue.getAll();
console.log('Queue contents:', items);
```

- Subscribe to `OnlineSyncManager` events to monitor progress and errors.
- SecureStorage key: the queue is persisted using the storage key constant (`STORAGE_KEYS.OFFLINE_MUTATION_QUEUE`) — inspect SecureStorage only in dev.
- Logs: use the `storage` and `offline` logger categories to trace enqueue/sync/remove events.

**Troubleshooting**
- Mutations not syncing:
  - Verify `NetworkDetection.isOnline` becomes `true` on reconnect.
  - Check `OnlineSyncManager.subscribe()` event stream for errors.
  - Inspect sync handler errors (handler should throw or return supabase error for 4xx/5xx handling).
- Queue grows without processing:
  - Confirm `OnlineSyncManager.initialize()` ran on app bootstrap.
  - Check for repeated 4xx errors — these will move items to dead-letter; inspect `deadLetterCount`.
- Unexpected rollbacks:
  - 4xx server responses are treated as permanent failures and will trigger rollback of optimistic updates.
  - If rollback occurs unexpectedly, inspect server validation and payload shape.

**Best Practices**
- Keep mutations idempotent where possible.
- Provide sensible `invalidateTags` so `QueryCache` invalidation is precise and avoids unnecessary refetches.
- Keep batch size modest (default = 5) to reduce partial failure complexity.

**Files & Helpers**
- See the following for implementation and examples:
  - `lib/offline/mutation-queue.ts`
  - `lib/offline/sync-manager.ts`
  - `lib/offline/sync-handlers.ts`
  - `lib/offline/utils.ts` (optimistic helpers)

---
End of usage guide.
