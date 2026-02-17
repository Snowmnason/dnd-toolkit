# Offline Mutation Queue — Architecture (Tier 4)

This document describes the architecture for Issue #206: Network Offline Queue & Mutation Synchronization. It focuses on components, responsibilities, data flows, error paths, and integration points for Tier-4 (offline & network resilience).

## High-level Overview

- Goal: Persist user mutations made while offline and reliably synchronize them when connectivity returns, preserving causality and providing user feedback.
- Principles: durability (SecureStorage), ordered processing (FIFO), resilience (retry/backoff), observable state (hooks + UI), and safe failure handling (dead-letter + conflict queue).

## Core Components

- `OfflineMutationQueue` (lib/offline/mutation-queue.ts)
  - Persistent FIFO queue stored in `SecureStorage` under `STORAGE_KEYS.OFFLINE_MUTATION_QUEUE`.
  - Items: `{ id, operation, table, payload, invalidateTags, createdAt, retryCount, nextAttemptAt }`.
  - API: `enqueue()`, `peek(batchSize)`, `markFailed()`, `remove()`, `discard()`, `getAll()`.

- `OnlineSyncManager` (lib/offline/sync-manager.ts)
  - Subscribes to `NetworkDetection` and system kernel phases.
  - Debounced auto-sync on reconnect; processes `peek()` batches.
  - Executes per-table `syncHandlers` and applies success/failure logic.
  - Publishes status via `subscribe()` for UI hooks.

- `Sync Handlers` (lib/offline/sync-handlers.ts)
  - Per-table/operation functions that apply queued mutation to the server (e.g., Supabase).
  - Return server result or throw/return error objects for 4xx/5xx semantics.

- `BackoffScheduler` / `OfflineRecovery` (lib/offline/offline-recovery.ts)
  - Computes `nextAttemptAt` using exponential backoff with jitter; enforces `maxRetries`.
  - Coordinates retry windows and avoids hot loops.

- `ConflictQueueManager` (lib/offline/conflict-resolution.ts)
  - Stores detected conflicts for later inspection or UI resolution.
  - Applies Last-Write-Wins (LWW) by default; pluggable resolution strategies.

- `QueryCache` integration (lib/cache/QueryCache)
  - `invalidateByTags()` called on successful sync to refresh dependent queries.

- `SecureStorage` (lib/storage/SecureStorage)
  - Encrypted persistence; queue survives restarts and device reboots.

- `NetworkDetection` (lib/network/network-detection)
  - Emits online/offline events and network quality signals consumed by `OnlineSyncManager`.

- UI Layer
  - `useOfflineQueue()` hook: exposes `{ queueSize, isSyncing, lastSyncedAt, deadLetterCount }`.
  - `<SyncStatus />` component: compact UI indicator rendered in app layout.
  - `AppToastProvider` used by hooks for user-visible notifications (sync success/failure).

## Primary Data Flow

1. User triggers a mutation in UI (create/update/delete).
2. Caller uses `enqueueIfOffline()` wrapper:
   - If online: execute mutation directly; optionally return optimistic result and record server response.
   - If offline or server request fails due to network: call `OfflineMutationQueue.enqueue(mutationDescriptor)` and apply optimistic update (if used).
3. Mutation is persisted to `SecureStorage` in FIFO order.
4. When `NetworkDetection` reports online, `OnlineSyncManager` wakes (debounced) and calls `OfflineMutationQueue.peek(batchSize)`.
5. For each mutation in the batch, `OnlineSyncManager` calls the corresponding `syncHandler`.
   - On success (2xx): `OfflineMutationQueue.remove(id)` + `QueryCache.invalidateByTags(mutation.invalidateTags)` + notify subscribers/UI.
   - On permanent failure (4xx validation): `OfflineMutationQueue.discard(id)` (dead-letter) + rollback optimistic update + notify user.
   - On transient failure (5xx/network): `OfflineMutationQueue.markFailed(id)` and schedule nextAttemptAt via `BackoffScheduler`.
   - On conflict: enqueue conflict in `ConflictQueueManager` and notify user via conflict UI or postponed resolution.
6. `OnlineSyncManager` continues processing batches until queue empty or rate limits reached.

## Error Handling & Edge Cases

- 4xx errors: treated as permanent — moved to dead-letter and not retried. Caller receives rollback notification.
- 5xx/network: treated as transient — increment retry count and schedule next attempt with exponential backoff and jitter.
- Max retries exceeded: move to dead-letter and surface to admin/debug tools.
- Large queues: process in batches (default `batchSize = 5`) to reduce partial-failure complexity and server load.
- App crash during sync: queue persists; `OnlineSyncManager` resumes on next bootstrap.

## Observability & Debugging

- `OnlineSyncManager.subscribe()` emits status and progress events for UI and logging.
- Logger categories: `offline`, `storage`, `network` — include mutation id in log entries for tracing.
- Development helpers: `OfflineMutationQueue.getAll()` and `ConflictQueueManager.getAll()` for inspection.

## Security & Privacy

- All persisted queue items stored via `SecureStorage` with AES-CTR encryption.
- Avoid storing sensitive raw secrets in payloads; prefer references/IDs.

## Deployment Notes

- Ensure `OnlineSyncManager.initialize()` is called during kernel bootstrap (already wired in `AppKernel`).
- Monitor server endpoints for idempotency guarantees to avoid duplicates when retries occur.

## Integration Checklist (summary)

- [ ] Register sync handlers for each persisted table.
- [ ] Wrap mutations with `enqueueIfOffline()`.
- [ ] Add `SyncStatus` to app layout and subscribe to `OnlineSyncManager` where needed.
- [ ] Implement optimistic update where UX requires immediacy; plan rollbacks for permanent errors.

---
End of architecture document.
