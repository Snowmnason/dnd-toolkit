# Navigation Module

Centralized declarative navigation system managing TopBar appearance, back button behavior, modals, redirects, and accessibility for all routes.

## When to Use This Module

**Use this module to:**

- Get route configuration for current navigation context (TopBar title, back button, redirects)
- Build URLs with type-safe parameters via `buildRoute()`
- Normalize and match routes (case-insensitive, aliases supported)
- Handle dynamic titles, back targets, and conditional redirects
- Configure analytics tracking points per route
- Set accessibility focus targets per route
- Dynamically register routes at runtime

**Do NOT use this module for:**

- Authentication/authorization (use `lib/routing/AUTH_CONFIG` and `lib/auth/useAuthGuard` instead)
- App-level state management (use React Context instead)
- Screen-specific logic (implement in screen components)
- Modal state management (control via React state, not routing)

## Architecture & Data Flow

```
Route segments + params
    ↓
getRouteConfig() matches against ROUTE_CONFIGS
    ↓
Returns RouteConfig with title/back/redirects
    ↓
Renderer displays TopBar + handles navigation
```

**Key Principles:**

- **Declarative**: All route configuration in one place, no switch statements
- **Type-safe**: TypeScript enforces valid route properties and parameters
- **Dynamic**: Titles and back buttons can be functions accessing context
- **Smart matching**: Exact paths, aliases, parent segments, and fallbacks

## API Reference

### Configuration

#### `getRouteConfig(context): RouteConfig`

Get route configuration for current navigation context.

```typescript
const config = getRouteConfig({
  segments,           // Route segments from useSegments()
  params,             // URL params from useLocalSearchParams()
  router,             // Expo Router instance
  worldId: params.worldId,
  isMobile: Platform.OS !== 'web',
});
```

#### `resolveTitle(config, context): string`

Resolve dynamic title (function or string).

```typescript
const title = resolveTitle(config, context);
```

#### `resolveBackTarget(config, context): string | undefined`

Resolve back button target (function or string).

```typescript
const back = resolveBackTarget(config, context);
if (back) router.push(back);
```

#### `shouldRedirect(config, context): string | undefined`

Check if route should redirect. Returns target path if needed.

```typescript
const redirect = shouldRedirect(config, context);
if (redirect) router.push(redirect);
```

### URL Building

#### `buildRoute(path, params?): string`

Build route with URL parameters.

```typescript
const route = buildRoute("/main/characters", {
  worldId: "123",
  tab: "npcs",
});
// Result: "/main/characters?worldId=123&tab=npcs"
```

#### `preserveParams(currentParams, keysToPreserve): RouteParams`

Extract specific params to preserve across navigation.

```typescript
const preserved = preserveParams(
  { worldId: "123", tab: "npcs" },
  ["worldId", "tab"]
);
```

### Path Utilities

#### `normalizePath(path): string`

Normalize path to lowercase for case-insensitive matching.

```typescript
normalizePath("/Main/Characters"); // "/main/characters"
```

#### `pathEquals(path1, path2): boolean`

Compare paths case-insensitively.

```typescript
pathEquals("/Main/Characters", "/main/characters"); // true
```

#### `pathStartsWith(path, prefix): boolean`

Check if path starts with prefix (case-insensitive).

```typescript
pathStartsWith("/main/characters/123", "/main/characters"); // true
```

### Dynamic Registration

#### `registerRouteConfig(config): void`

Dynamically register or update route config at runtime.

```typescript
registerRouteConfig({
  path: "/main/treasure",
  title: "Treasure & Loot",
  showTopBar: true,
  analyticsName: "main_treasure",
});
```

#### `getAllRouteConfigs(): RouteConfig[]`

Get all registered route configurations.

```typescript
const allRoutes = getAllRouteConfigs();
```

## Interfaces

### RouteConfig

Configuration for a single route.

```typescript
interface RouteConfig {
  path: string;                              // Required: "/main/characters"
  title: string | ((context) => string);    // Required: static or dynamic
  showTopBar?: boolean;                      // Optional: default true
  back?: string | ((context) => string);    // Optional: back target
  aliases?: string[];                        // Optional: alternative paths
  redirectIf?: (context) => string | undefined; // Optional: conditional
  analyticsName?: string;                    // Optional: tracking name
  a11yFocusTarget?: 'title' | 'firstInteractive' | 'none'; // Optional
}
```

## Route Matching Strategy

When navigating to `/main/characters/123`:

1. **Exact path match** (case-insensitive) – `/main/characters`
2. **Alias match** – Alternative paths like `/main/characters-npcs`
3. **Parent segment match** – `/main/*` catches all under `/main/`
4. **Fallback** – Uses default config, logs warning

## Modals vs. Full-Screen Routes

**Full-Screen Routes** (in navigation config):
- Have route URLs (e.g., `/settings/world`)
- Show TopBar
- Navigate via `router.push()`

**Modals** (NOT in navigation config):
- Controlled by React state, not routing
- Presentational components only
- Do NOT have route URLs

```typescript
// ✅ Full-screen route
{ path: "/settings/world", title: "World Settings", showTopBar: true }

// ✅ Modal (controlled by state)
<SettingsModal visible={showModal} onDismiss={() => setShowModal(false)} />
```

## Accessibility

Routes support focus targets on navigation:

| Target | Use Case |
| --- | --- |
| `'title'` (default) | Focus TopBar title for screen readers |
| `'firstInteractive'` | Focus first interactive element (button, input) |
| `'none'` | No automatic focus (for modals) |

## Analytics

Each route can specify a tracking name sent to analytics system:

```typescript
{ path: '/main/characters', analyticsName: 'main_characters' }
```

## Dependencies

### External Packages

- **`expo-router`** – Router instance for navigation and route management

### Internal Dependencies

- **`lib/routing/AUTH_CONFIG`** – Route protection configuration
- **`lib/auth/useAuthGuard`** – Authentication enforcement for routes
- **`lib/analytics`** – Navigation event tracking
- **`lib/utils/logger`** – Navigation logging and debugging

## Related Modules

- **`lib/navigation/routes/`** – App-specific route definitions organized by screen area
- **`lib/routing/AUTH_CONFIG`** – Authentication configuration for protected routes
- **`lib/auth/useAuthGuard`** – Route protection hook that uses navigation config
- **`lib/analytics`** – Tracks navigation events and user flow analytics
- **`app/_layout.tsx`** – Root layout that applies navigation configuration

## File Breakdown

| File | Purpose |
| --- | --- |
| `navigation-config.ts` | Core system (route matching, resolution, dynamic registration) |
| `uri-helpers.ts` | URL building and path utilities (parameter handling, normalization) |
| `routes/` | App-specific route definitions organized by screen area |
| `routes/README.md` | How to add routes and organize by screen |
| `index.ts` | Barrel export of public API |
