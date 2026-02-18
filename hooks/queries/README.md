# Queries

Short, typed React Query-style hooks for reading server state (users, worlds). Designed to be used from `@/hooks` barrel.

## When to Use This Module

**Use this module if you need to:**

- Fetch read-only data for UI (world lists, user profiles)
- Reuse standardized request/response shapes across components
- Use pagination, caching, and refetch controls via a single hook

**Do NOT use this module for:**

- Performing complex client-side state orchestration
- Writing optimistic updates or long-running mutations

## Architecture & Data Flow

```
Component
        ↓
Hook (useWorldsQuery)
        ↓
lib/network -> API call
        ↓
Query cache (React Query) / return data
```

**Key Principles:**

- **Single responsibility**: Each hook wraps one API/resource.
- **Cache-first**: Hooks read from and update the shared query cache.
- **Lightweight**: Keep transform logic minimal; map shapes near UI when needed.

## API Reference

### `useWorldsQuery(options)`

Fetch the current user's worlds with pagination.

**Parameters:**
- `options` (object) – `{ page?: number, limit?: number, enabled?: boolean }`

**Returns:**
- `{ data, isLoading, error, refetch }` – worlds page and helpers.

```ts
const { data, isLoading } = useWorldsQuery({ page: 1, limit: 10 });
```

### `useCurrentUserQuery()`

Fetch the current authenticated user's profile and preferences.

**Returns:**
- `{ data, isLoading, error, refetch }` – user profile or null.

## Dependencies

### External Packages

- **`@tanstack/react-query`** – caching, background refetch, mutation integration

### Internal Dependencies

- **`lib/network`** – performs API calls
- **`hooks/index`** – re-exported from the main barrel

## Error Handling & Edge Cases

### API Errors

Hooks surface network and server errors via `error` (standard React Query error). Callers should show fallbacks and retry controls.

### Empty States

Return `null` or empty arrays; UI should treat `data` carefully when paginated.

## Performance Notes

### Pagination

Page sizes affect memory use; prefer server-side pagination for large world lists.

## Related Modules

- **`lib/network`** – low-level request helpers and state machine
- **`hooks/mutations`** – for write operations and optimistic updates

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for query hooks |
| `use-worlds-query.tsx` | Paginated worlds query hook |
| `use-worlds.ts` | Alternate world query utilities and helpers |
| `use-users-query.tsx` | User profile and user-by-id query hook |
