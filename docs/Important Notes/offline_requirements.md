**Offline Requirements (blockers / items needing external data)**

Note: `TopBarIndicator` and notification sequencing fixes are completed and not listed here. This file tracks outstanding tasks and future extensibility points.

## ✅ Completed

- **Handler contract**: `SyncHandlerResult` now includes optional server metadata fields:
  - `updated_at?: string | number` — ISO8601 or epoch-ms timestamp for LWW conflict resolution
  - `version?: number` or `etag?: string` — reserved for future versioning strategies (v2+)
- **Server timestamp extraction**: `sync-manager` now extracts `handlerResult.data.updated_at` and normalizes to epoch-ms before passing to `executeConflictResolution`. If unavailable, defaults to `undefined` (conservative server-wins).
- **Conflict recording / observability**: All detected conflicts are enqueued to `ConflictQueueManager` for telemetry and future UI inspection.

## 📋 Future Tasks

- **Add unit tests**: Cover `resolveLastWriteWins` with real server timestamps (equal timestamps, server-newer, local-newer, undefined).
- **Versioning strategy (v2+)**: Once `version`/`etag` fields are populated by handlers, implement vector-clock or ETag-based conflict detection for stronger accuracy.
- **Ensure handlers populate `updated_at`**: DB modules should return server timestamps (e.g., from `updated_at` timestamptz column on Supabase). Without this, LWW defaults to conservative server-wins.
- **Document handler contract**: Add a runbook in `docs/` explaining how to implement a sync handler (fields, timestamps, conflict detection).
