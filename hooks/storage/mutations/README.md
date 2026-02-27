# Mutations

Typed hooks for performing server-side writes and local optimistic updates (worlds, users, invites). Use alongside `hooks/queries` for cache updates.

## When to Use This Module

**Use this module if you need to:**

- Create, update, or delete resources on the server
- Perform optimistic updates and rollback on failure
- Encapsulate mutation side-effects (analytics, navigation)

**Do NOT use this module for:**

- Long-lived background polling of read-only data
- Complex orchestration that belongs in a job worker

## Architecture & Data Flow

```
UI action (click)
        ↓
Hook (useCreateWorldMutation)
        ↓
lib/network -> POST/PUT/DELETE
        ↓
React Query mutation -> update cache / rollback
```

**Key Principles:**

- **Optimistic-first**: Provide quick UI response while ensuring correctness on rollback.
- **Side-effect aware**: Mutations accept `onSuccess` / `onError` callbacks for navigation and logging.
- **Cache consistency**: Mutations update or invalidate query cache keys owned by `hooks/queries`.

## API Reference

### `useCreateWorldMutation()`

Create a new world and update the worlds cache.

**Parameters:**
- `options` (object) – React Query mutation options (optional)

**Returns:**
- `{ mutate, isLoading, error }`

```ts
const m = useCreateWorldMutation();
m.mutate({ name }, { onSuccess: () => navigateToWorld() });
```

### `useUpdateWorldMutation()`, `useDeleteWorldMutation()`

Update or delete world resources with optimistic cache handling.

## Dependencies

### External Packages

- **`@tanstack/react-query`** – mutation primitives and cache updates

### Internal Dependencies

- **`lib/network`** – HTTP helper for requests
- **`hooks/queries`** – cache keys and invalidation targets

## Error Handling & Edge Cases

### Partial Failures

Mutations should rollback optimistic updates on network or validation failure and surface errors for user retry.

### Idempotency

Retry handlers should account for server-side idempotency where available.

## Performance Notes

Batching multiple small updates into a single server call is recommended when possible to reduce chattiness.

## Related Modules

- **`hooks/queries`** – cached reads that mutations update or invalidate
- **`lib/network`** – request layer used by mutations

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for mutation hooks |
| `use-worlds-mutation.tsx` | Create/update/delete worlds mutations |
| `use-users-mutation.tsx` | Mutations for updating or deleting users |
| `use-invites-mutation.tsx` | Create invite links and validate tokens |
