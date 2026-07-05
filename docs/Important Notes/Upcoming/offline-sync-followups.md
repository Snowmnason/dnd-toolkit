# Offline Sync Follow-Ups

Future work that remains after the current conflict-flow baseline was implemented.

## Current State

The underlying conflict-flow infrastructure exists.

- `SyncHandlerResult` supports server metadata
- `sync-manager` extracts `updated_at`
- LWW conflict resolution uses the normalized timestamp when available
- conflicts are recorded in `ConflictQueueManager`

This note tracks the work that still remains around that baseline.

## Remaining Follow-Ups

### Add Unit Tests For LWW

No `__tests__` coverage was found for `resolveLastWriteWins`.

Useful cases to cover:

- equal timestamps
- server newer
- local newer
- undefined or missing server timestamp

This is the most concrete missing validation item.

### Add Stronger Versioning Strategy Later

`version` and `etag` are present in the sync-handler contract, but they are not yet used as the live resolution strategy.

If the sync system needs stronger guarantees later, this is where a richer conflict-detection strategy would start.

Examples:

- ETag-aware compare-and-retry
- explicit server version checks
- more advanced multi-device conflict handling

### Ensure Real Sync Handlers Return `updated_at`

The infrastructure expects handler results to return server timestamps when available.

That requirement is still important because without a usable server timestamp, LWW falls back to conservative server-wins behavior.

Important nuance:

- the handler contract is in place
- `lib/offline/README.md` documents the pattern
- no live `registerSyncHandler(...)` registrations were found during this pass

So this follow-up is best read as:

when concrete handler-backed tables are introduced or wired up, make sure their returned server rows include `updated_at`.

### Decide Whether A Dedicated Handler Runbook Is Still Needed

There is already partial documentation in:

- `lib/offline/sync-handlers.ts`
- `lib/offline/README.md`

What does not exist yet is a dedicated docs note focused only on implementing handler-backed sync.

If offline sync grows more tables or becomes a common workflow, a dedicated runbook may still be worth adding.

## Priority

Medium overall.

The testing gap is the clearest near-term task. The versioning and runbook work are later-stage follow-ups. The `updated_at` reminder remains relevant when real handler registrations are added.