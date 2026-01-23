# Sync Handler Contract (Developer Runbook)

Purpose: provide a minimal, unambiguous contract for sync handlers so DB modules can implement handlers that the offline sync system (`OnlineSyncManager`) can depend on.

Location: `lib/offline/sync-handlers.ts` (registry + types)

## Contract (TypeScript)

```ts
export interface SyncHandlerResult {
  success: boolean; // true on success
  data?: any; // single-row/object returned from DB (prefer .select().single())
  error?: string; // error message when success === false
  conflict?: boolean; // whether handler indicated a conflict
  // Optional server metadata used by conflict resolution:
  updated_at?: string | number; // ISO8601 string, epoch-ms number, or Date.toISOString()
  version?: number; // optional integer row-version
  etag?: string; // optional ETag string (for HTTP/REST backends)
}

export type SyncHandler = (
  payload: any,
  operation: "create" | "update" | "delete",
  supabaseClient: any,
) => Promise<SyncHandlerResult>;
```

## Rules & Guidance

- Always return `data` as the canonical server response for the affected row. For Supabase use `.select().single()` to return the updated row including `updated_at`.
- Prefer `updated_at` (Postgres `timestamptz`) as the canonical timestamp. Format may be ISO8601 string (e.g., `2025-12-31T12:34:56Z`) or epoch-ms number — `sync-manager` will normalize.
- `updated_at` is table-agnostic: handlers do not need to expose table name for timestamp extraction — `sync-manager` reads `handlerResult.data.updated_at` generically.
- If your table uses integer row versions, populate `version` (incrementing integer) instead of or in addition to `updated_at`.
- If using HTTP/REST backends, prefer `etag` header values in `etag` field.
- When a handler detects a version/etag mismatch, set `conflict: true` and include any helpful diagnostic in `error` or `data` (e.g., server row id / server snapshot).

## Example: Supabase update handler (recommended pattern)

```ts
async function updateWorldHandler(payload, operation, supabase) {
  const { data, error } = await supabase
    .from("worlds")
    .update({ ...payload, updated_at: "now()" })
    .eq("world_id", payload.world_id)
    .select()
    .single();

  if (error) {
    return {
      success: false,
      error: error.message,
      conflict: /* detect from error */ false,
    };
  }

  // data.updated_at will be present from DB; include it as-is in SyncHandlerResult
  return { success: true, data };
}

registerSyncHandler("worlds", updateWorldHandler);
```

## Sync Manager expectations

- `OnlineSyncManager` will call handlers via `executeSyncHandler()` and, on conflict, will look for `handlerResult.data?.updated_at` to perform Last-Write-Wins (LWW).
- `sync-manager` normalizes `updated_at` to epoch-ms (number). If `updated_at` is missing or unparseable, the manager treats timestamp as `undefined` and uses conservative server-wins behavior.
- `version`/`etag` are reserved for future v2 strategies; handlers are encouraged to provide them if available.

## Observability & Telemetry

- Handlers should return `data` that includes identifying fields (id, resource keys). This helps `ConflictQueueManager` record conflicts with useful metadata.
- When setting `conflict: true`, include in `data` or `error` the server response or reason so the `ConflictQueueManager` can persist diagnostics.

## Testing

- Unit tests should mock handlers returning different `updated_at` values (string/number/undefined) to validate `resolveLastWriteWins` behavior.
- Integration tests should confirm `sync-manager` reads and normalizes `updated_at` and that conflicts are enqueued to `ConflictQueueManager`.

## Migration notes

- If your table doesn't currently provide `updated_at`, add a `timestamptz` column and set it in writes (or use DB triggers). This change ensures correct LWW behavior and reduces conservative discards.

## Troubleshooting

- If LWW seems to behave incorrectly (local always wins), confirm handlers actually return `data.updated_at` and that it's a recent server timestamp (not client-generated).
- If conflicts lack useful info, expand your handler to include `select()`ed server row in `data` so the `ConflictQueueManager` can persist it.

---

Add this runbook to `docs/issues/MileStone 2/158 - Offline Foundation` and link from `INTEGRATION_GUIDE.md` if desired.
