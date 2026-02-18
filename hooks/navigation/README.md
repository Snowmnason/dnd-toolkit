# Navigation

Navigation-related hooks that centralize routing, context param propagation, and analytics-tracked transitions. Use `useAppNavigation` from the barrel.

## When to Use This Module

**Use this module if you need to:**

- Navigate while automatically including app context (worldId, userId)
- Track navigations in analytics or adjust behavior after operations
- Manage mobile panel/modal navigation state

**Do NOT use this module for:**

- Implementing low-level router primitives (use the router directly)
- Persisting navigation state outside of transient UI

## Architecture & Data Flow

```
UI event
        ↓
useAppNavigation -> validate params
        ↓
router.navigate()
        ↓
analytics.track(navigation_event)
```

**Key Principles:**

- **Context-aware navigation**: Hooks inject AppParams so routes don't miss required params.
- **Separation of concerns**: Navigation helpers do not fetch data; they only route and emit events.
- **Testable**: Provide thin wrappers so navigation behavior can be mocked in tests.

## API Reference

### `useAppNavigation()`

Navigate with automatic parameter merging and route validation.

**Returns:**
- `{ push, replace, back }` – navigation helpers that accept route and params.

```ts
const nav = useAppNavigation();
nav.push({ name: 'World', params: { worldId } });
```

### `useAnalyticsNavigation()`

Wrapper that records navigation events to analytics on top of `useAppNavigation()`.

### `usePanelNavigation()`

Manage open/close state for mobile side panels and modals.

## Dependencies

### External Packages

- **`expo-router` / `react-navigation`** – platform router (used indirectly)

### Internal Dependencies

- **`lib/navigation`** – central route definitions and TopBar config
- **`lib/analytics`** – navigation telemetry

## Error Handling & Edge Cases

### Missing Params

Navigation helpers validate required params and throw or redirect to an error route when missing.

### Deep Linking

Deep link handlers should translate URLs to the same param shapes used by these hooks.

## Performance Notes

Navigation is lightweight; avoid expensive synchronous computations during route handlers.

## Observability & Analytics

- Event: `navigation.change` – emitted on `push`/`replace` with `{ route, params }`

## Related Modules

- **`lib/navigation`** – canonical route/TopBar config
- **`hooks`** – barrel export

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for navigation hooks |
| `use-app-navigation.tsx` | Core navigation helpers with param injection |
| `use-analytics-navigation.tsx` | Navigation wrapper that tracks events |
| `use-panel-navigation.tsx` | Mobile panel and modal navigation state |
| `use-success-navigation.tsx` | Redirects after successful operations |
