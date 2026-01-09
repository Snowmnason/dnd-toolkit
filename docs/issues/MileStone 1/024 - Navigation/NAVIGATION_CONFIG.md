# Navigation Config

This document explains how to define and use the centralized navigation configuration (`lib/navigation/navigation-config.ts`) for the D&D Toolkit app.

## Key Concepts
- **Single source of truth**: Every route (title, back behavior, TopBar visibility, params, modals, redirects) is declared once in `ROUTE_CONFIGS`.
- **Context-aware matching**: `getRouteConfig(context)` resolves the best config for the current path (exact → alias → startsWith → first-segment → fallback).
- **Helpers**: URI helpers in `lib/navigation/uri-helpers.ts` build URLs, preserve params, and normalize paths.

## Usage in Layouts
```ts
import { getRouteConfig, resolveTitle, resolveBackTarget } from '@/lib';

const context = {
  segments: useSegments(),
  params: useLocalSearchParams(),
  router: useRouter(),
  worldId: params.worldId as string | undefined,
  userRole: params.userRole as string | undefined,
  isMobile: Platform.OS !== 'web',
  isAuthenticated: true,
};

const config = getRouteConfig(context);
const title = resolveTitle(config, context);
const backTarget = resolveBackTarget(config, context);
```
Use the resulting config to drive TopBar, back handling, a11y focus, and (later) analytics.

## Route Config Fields
- `path`: Path pattern (e.g., `/main/items-treasure`)
- `aliases`: Optional alternate paths (case-insensitive)
- `title`: String or `(context) => string`
- `back`: Path or `(context) => string`
- `showTopBar`, `showHamburger`: Booleans
- `requiredParams`: Required query params
- `preserveParamsOnBack`: Params to keep when navigating back
- `modal`: `{ isModal, dismissOnBack?, onDismiss? }`
- `redirectIf`: `(context) => string | undefined` for access control
- `analyticsName`: Identifier for analytics (wiring pending)
- `animation`: Transition hint (future use)
- `a11yFocusTarget`: `'title' | 'firstInteractive' | 'none'`
- `onError`: Per-route error handler (future use)

## URI Helpers
Located in `lib/navigation/uri-helpers.ts`:
- `buildRoute(path, params)` → `/main/items-treasure?worldId=123`
- `preserveParams(current, keys)` and `mergeParams(a, b)`
- `validateParams(params, schema)`
- `buildNavigationTarget(path, currentParams, preserveKeys, extra)`
- `normalizePath`, `pathEquals`, `pathStartsWith`

## Matching Strategy
1) Exact path or alias
2) Starts-with (for nested routes)
3) First-segment fallback (e.g., `/main/*` → main default)
4) Default fallback (unknown route)

## Adding a Route
1. Add an entry to `ROUTE_CONFIGS` with `path`, `title`, `back`, and relevant options.
2. Create the screen file under `app/...` matching the path.
3. For tabbed panels, keep `preserveParamsOnBack: ['worldId', 'userRole']`.

## Access Control
Use `redirectIf` to guard routes (e.g., missing `worldId` → `/select/world-selection`).

## A11y Focus
Configs can request focus targets. The TopBar will focus the title on route change when `a11yFocusTarget === 'title'` (web).

## Current Coverage
The config includes all routes under `app/login`, `app/select`, `app/main` (with subpages), `app/settings`, and `app/web/download`.

## Notes
- Dynamic params like `/settings/[username]` are represented as concrete paths in `ROUTE_CONFIGS`; no pattern matching is used.
- Analytics, error boundaries, and advanced animations are placeholders to be wired during migration.
