# Navigation System Guide

This project uses Expo Router with a centralized route registry. Use this as a quick reference for adding or editing routes.

## Key Files
- Navigation registry: [lib/navigation/navigation-config.ts](../../../lib/navigation/navigation-config.ts)
- Route modules: [lib/navigation/routes](../../../lib/navigation/routes)
- URI helpers: [lib/navigation/uri-helpers.ts](../../../lib/navigation/uri-helpers.ts)
- TopBar resolution helpers: `resolveTitle`, `resolveBackTarget` inside navigation-config

## Route Modules
Routes are grouped by domain under `lib/navigation/routes/`:
- `login-routes.ts` — public/auth flows
- `select-routes.ts` — world selection/creation
- `main-routes.ts` — world-dependent app areas
- `settings-routes.ts` — settings and playgrounds
- `web-routes.ts` — web-only pages

Each module exports a `RouteConfig[]` that is merged in `navigation-config.ts`.

## RouteConfig Essentials
Common fields when adding/editing a route:
- `path`: Kebab-case path, e.g. `/main/world-exploration`
- `aliases`: Alternative paths/casing if needed
- `title`: String or `(context) => string` for dynamic titles
- `back`: String target or `(context) => string`
- `showTopBar`, `showHamburger`: Booleans to control chrome
- `requiredParams`: Enforce presence of params (e.g., `['worldId', 'userRole']` for main routes)
- `preserveParamsOnBack`: Params to carry when navigating back
- `redirectIf`: `(context) => string | undefined` to block/redirect (e.g., missing world)
- `modal`: Reserved modal config (presentational only today)
- `animation`: `'slide' | 'fade' | 'modal' | 'none'` (placeholder hook for future transitions)
- `a11yFocusTarget`: `'title' | 'firstInteractive' | 'none'`
- `onError`: `(error, context) => void` for per-route error handling

## Adding a New Route (Typical Flow)
1. Create the screen under `app/` with a path that matches the route (Expo Router will map it). Example: `app/main/world-exploration.tsx` for `/main/world-exploration`.
2. Add a `RouteConfig` entry in the appropriate module under `lib/navigation/routes/`.
3. If the route requires world context, set `requiredParams: ['worldId', 'userRole']` and consider a `redirectIf` to `/select/world-selection` when missing.
4. If back navigation should preserve params, set `preserveParamsOnBack` and use `buildNavigationTarget` when constructing manual links.
5. For dynamic titles or backs, provide functions that read from `NavigationContext` (segments, params, worldId, userRole, isMobile, isAuthenticated).

## Protections and Guards
- Use `requiredParams` and `redirectIf` to block entry when context is incomplete.
- Main routes typically demand `worldId` and `userRole`; redirect to `/select/world-selection` if absent.
- Public/login routes should avoid clearing world params unless intentionally resetting (see central param update effect in the layout).

## Naming Conventions
- Paths: kebab-case, scoped by domain (`/main/...`, `/settings/...`, `/login/...`).
- Files under `app/` should mirror path segments (case-sensitive on web). Example: `/settings/StyleDesktop` pairs with `app/settings/StyleDesktop.tsx`.
- Route IDs/analytics: use `analyticsName` with a consistent prefix (e.g., `main_world_map`).

## Animations
- `animation` is defined per route; current implementations are placeholders, but keep values consistent (`slide`, `fade`, `modal`, `none`) to enable future transitions.

## Editing Existing Routes
- Update titles or back targets in the relevant module; the TopBar will pick them up via `resolveTitle` and `resolveBackTarget`.
- For new params, add them to `requiredParams` and `preserveParamsOnBack` where appropriate.
- To enforce access rules, add a `redirectIf` that returns a path when the context is invalid.

## Building Targets with Params
Use `buildNavigationTarget(targetPath, params, preserveList)` when you need to programmatically navigate while keeping specific params (e.g., `worldId`, `userRole`). This helper lives in [lib/navigation/uri-helpers.ts](../../../lib/navigation/uri-helpers.ts).

## Testing Checklist for New Routes
- Can the screen be opened directly via URL (web) with required params? If not, does it redirect safely?
- Does the TopBar show correct title/back behavior?
- Do back/forward navigations preserve `worldId`/`userRole` where needed?
- Are `redirectIf` and `requiredParams` aligned so unauthorized or param-less access is blocked?
