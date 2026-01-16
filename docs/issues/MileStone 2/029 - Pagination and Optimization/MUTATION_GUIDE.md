# Mutation Guide — Worlds, SecureStorage & FastCache

This guide explains how to handle mutations that affect world membership, ownership, and access flags.
It documents the order of operations, error handling, and examples using existing helpers (`worldAccessCache`).

**Why this matters**
- The project uses two layers of caching:
  - `FastCache` / `QueryCache` — fast, unencrypted SWR cache for full world data (UI performance)
  - `SecureStorage` — encrypted, persistent flags and metadata used by guards and cross-session checks

Mutations must update both layers (where relevant) to avoid races between UI state and guard checks.

## Principles

- DB is canonical: Always perform the DB mutation first. If the DB call fails, do not update any cache.
- Query invalidation next: Invalidate `QueryCache` tags so readers revalidate in background (SWR). This provides a fresh FastCache state.
- SecureStorage last: Update encrypted access flags/metadata in `SecureStorage` so guards and cross-session checks remain authoritative.
- Non-blocking storage: SecureStorage writes should be non-throwing — if storage fails, log the error but treat the DB operation as successful.
- Centralize updates: Use the `worldAccessCache` helper in `lib/storage/world-access-cache.ts` to keep mutation code concise.

## Which mutations should update SecureStorage

- `create()` — set owner access flag for the new world.
- `delete()` — clear access flags and meta for the deleted world.
- `addUserToWorld()` — set access flag for added user.
- `removeUserFromWorld()` — remove access flag for removed user.

Other mutations that change permissions/roles should also update metadata (e.g., `updateRole()`), using the same helper.

## Example pattern

Follow this minimal pattern inside mutation functions in `lib/database/worlds.ts`:

```ts
// 1) DB mutation (RequestManager.fetch wrapper)
const { data, error } = await supabase.from('world_access').insert(...).select().single();
if (error) throw new Error(error.message);

// 2) Invalidate FastCache (QueryCache)
await QueryCache.invalidateByTags([CACHE_TAGS.worldMembers(worldId), CACHE_TAGS.user(userId), CACHE_TAGS.worlds]);

// 3) Update SecureStorage (non-throwing)
await worldAccessCache.updateAccessFlag(worldId, true, 'add');

// 4) Return DB result
return data;
```

## Helper: `worldAccessCache`

- Location: `lib/storage/world-access-cache.ts`
- Methods:
  - `updateAccessFlag(worldId: string, hasAccess: boolean, source: 'create'|'add'|'remove'|'delete')` — sets/removes `world_access_<id>` and writes `world_access_meta_<id>`.
  - `clearWorldAccess(worldId: string)` — removes both flag and meta for deleted worlds.

Both functions swallow storage errors and log them; this ensures DB success is always respected.

## Optimistic updates & SecureStorage

- Optimistic UI updates can update `FastCache` immediately via `useMutation` optimisticUpdate callbacks.
- Do NOT update `SecureStorage` optimistically; only update it after the DB confirms success. SecureStorage is authoritative for guards and must not be desynchronized by optimistic failures.

## TTL & Reverification

- Store a small meta object `world_access_meta_<id>` with `{ timestamp, source }` so background refreshers can decide whether to re-verify membership.
- Recommended meta TTL: 5–30 minutes depending on how frequently roles change. Use `updateStorageCache.refreshAllWorldsCache()` for forced re-sync from server.

## Error handling

- DB errors: bubble up to the caller (mutation should fail). The UI mutation system will revert optimistic updates.
- Storage errors: log and continue. Optionally schedule a background retry via telemetry or a refresh button.

## Quick checklist for maintainers

- [ ] DB mutation uses `RequestManager.fetch()` for retries/dedupe.
- [ ] `QueryCache.invalidateByTags()` is called for relevant tags (`worlds`, `worldMembers`, `user:<id>`, `world:<id>`).
- [ ] `worldAccessCache` is called after DB success to update `SecureStorage`.
- [ ] SecureStorage writes are wrapped in `try/catch` and do not throw.

---

Additions or improvements welcome: prefer small, focused helpers in `lib/storage/` and keep mutation flows clear and consistent.