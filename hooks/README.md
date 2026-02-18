# Hooks

**Reusable React hooks for navigation, data fetching, mutations, UI state, and feature checks.**

Concise reference for the project's hook categories, import patterns, common usage, and file layout. Follow React rules of hooks and prefer the barrel exports in `@/hooks`.

## Quick Start

### Import

Prefer the single barrel export:

```tsx
import { useWorldsQuery, useCreateWorldMutation, useAppNavigation } from "@/hooks";
```

Category barrels are available (e.g., `@/hooks/queries`) when you need to tree-shake or import a single hook.

## Hook Categories (short)

- **Navigation**: `useAppNavigation`, `usePanelNavigation`, `useAnalyticsNavigation`
- **Auth / Entitlements**: `useAuthStatus`, `usePremiumFeature`, `useEntitlement`
- **Queries**: `useWorldsQuery`, `useCurrentUserQuery`, `useUserQuery`
- **Mutations**: `useCreateWorldMutation`, `useUpdateWorldMutation`, `useDeleteWorldMutation`
- **UI / Layout**: `useScale`, `useThemeSwitcher`, `useSplashScreen`, `useRenderTracker` (dev)
- **Assets**: `useImageCache`, `usePrefetchImage`, `useViewportTracking`
- **Feature Flags / A/B**: `useFeatureFlag`, `useVariantTracking`
- **Notifications**: `useNotifications`

## Common Patterns

Fetching example (React Query-style hooks):

```tsx
const { data: worlds, isLoading, error } = useWorldsQuery({ page: 1, limit: 10 });
```

Mutations with optimistic updates:

```tsx
const mutation = useUpdateWorldMutation();
mutation.mutate({ worldId, name }, { onSuccess: () => {} });
```

Feature flag example:

```tsx
const enabled = useFeatureFlag("newUI");
return enabled ? <NewUI/> : <OldUI/>;
```

## Best Practices

- Use the barrel exports from `@/hooks`.
- Always handle `isLoading` and `error` states.
- Don't call hooks conditionally; keep them at component top-level.
- Prefer React Query / mutation hooks for server state and optimistic updates.
- Use `useRenderTracker()` in development to find unnecessary re-renders.

## File Structure

```text
hooks/
├── index.ts             # barrel
├── queries/             # data fetching hooks
├── mutations/           # create/update/delete hooks
├── navigation/          # navigation helpers
├── auth/                # auth & entitlement helpers
├── ui/                  # scale, theme, splash hooks
├── assets/              # image caching & viewport tracking
└── utils/               # notifications, feature-flag helpers
```

## Important Notes

- `useImageCache()` defaults: 50MB limit, 1-hour TTL.
- Entitlement hooks may return cached values; call with `force`/refresh when needed.
- Mutations follow `{ mutate, isLoading, error, data }` shape and accept `onSuccess` / `onError` options.

## Related

- [providers/](../providers/) — Auth, Theme, Scale providers used by hooks
- [lib/navigation/](../lib/navigation/) — Route definitions and helpers
- [lib/premium/](../lib/premium/) — Subscription & entitlement logic

