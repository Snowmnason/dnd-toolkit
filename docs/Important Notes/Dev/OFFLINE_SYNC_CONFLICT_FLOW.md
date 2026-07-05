# Offline Sync Conflict Flow

Developer note for the current offline conflict-detection and resolution path.

## Why This Note Exists

This is the implemented part of the older offline requirements note.

It documents what the offline sync layer already does today, so future cleanup or extension work does not need to rediscover the current contract.

## Current Implemented Behavior

### Sync Handler Result Contract

`lib/offline/sync-handlers.ts` defines `SyncHandlerResult` with optional server metadata on `data`.

Current documented metadata fields:

- `updated_at?: string | number`
- `version?: number`
- `etag?: string`

The important active field for v1 conflict resolution is `updated_at`.

`version` and `etag` are present as future-oriented metadata slots, but they are not the current conflict-resolution source of truth.

### Server Timestamp Extraction

`lib/offline/sync-manager.ts` extracts `handlerResult.data.updated_at` when a handler reports a conflict.

Current behavior:

1. if `updated_at` is a number, it is used directly
2. if it is a string, it is parsed as a date
3. if parsing fails or the field is absent, the server timestamp becomes `undefined`

That normalized timestamp is then passed into `executeConflictResolution(...)`.

### LWW Conflict Resolution

`lib/offline/conflict/conflict-resolution.ts` currently uses Last-Write-Wins for v1.

The active rule is:

- if server timestamp is unavailable, use conservative server-wins behavior
- if server timestamp is newer than the local queued mutation timestamp, discard the local mutation
- if local timestamp is newer or equal, keep and retry the local mutation

This is intentionally simple and favors predictable behavior over richer merge logic.

### Conflict Queue Recording

`lib/offline/sync-manager.ts` enqueues detected conflicts into `ConflictQueueManager` before applying automatic LWW resolution.

`lib/offline/conflict/conflict-queue-manager.ts` provides the background singleton used for that tracking.

That means conflicts are not only auto-resolved; they are also recorded for:

- debugging
- telemetry
- future UI inspection or resolution surfaces

## Current Boundaries

The infrastructure is implemented, but it is still infrastructure.

Important boundary notes:

- the sync layer expects handler results to return useful server metadata when available
- the handler contract is documented in `lib/offline/sync-handlers.ts`
- `lib/offline/README.md` already contains a partial sync-handler usage explanation

## Practical Meaning

Today, the completed work is not "offline sync is feature-complete."

It is specifically that:

- the handler result contract now has room for server metadata
- the sync manager knows how to read `updated_at`
- LWW can use a normalized server timestamp
- conflicts are recorded before auto-resolution

That is the implemented baseline future handler-backed sync work will build on.