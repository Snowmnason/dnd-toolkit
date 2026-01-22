**Offline Requirements (blockers / items needing external data)**

Note: `TopBarIndicator` and notification sequencing fixes are completed and not listed here. This file only tracks items we cannot fully fix without additional data or cross-team agreement.

- **Server timestamps (high priority)**: handlers must return a reliable server timestamp (e.g., `updated_at`, `last_modified`, or a monotonic version). When available, the sync layer should pass that timestamp into `executeConflictResolution` so LWW can make correct decisions. Until handlers provide this, treat `timestamp` as `undefined` (conservative server-wins).

- **Conflict recording / observability**: All detected conflicts must be enqueued to the `ConflictQueueManager` (persisted/telemetry) so UI/analytics can inspect them later. Do not rely solely on transient logs.

- **Handler contract (coordination task)**: Define and publish the required shape for sync handlers (fields: `success`, `data`, `conflict?: boolean`, `error?: string`, `updated_at?: string|number`). Update `sync-handlers` types and docs when teams agree on the field names and formats.

---

When the handler contract is agreed and handlers start returning `updated_at`/server timestamps, the next updates are:

- Wire `handlerResult.data.updated_at` (or response headers) into `sync-manager` and pass it to `executeConflictResolution`.
- Add unit tests validating `resolveLastWriteWins` with real server timestamps.
- Ensure `ConflictQueueManager.enqueueConflict` is called for all conflict cases and that recorded entries include the handler's returned metadata (server timestamp, response id/etag).

If you'd like, I can open follow-up tasks (PR-ready) to implement the handler contract, wire `updated_at`, and add tests once you confirm the field names. 