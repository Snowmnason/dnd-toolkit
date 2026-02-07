# lib/navigation

Centralized declarative navigation and routing system. Manages TopBar appearance, back button behavior, modals, animations, redirects, accessibility, and A/B testing variants for all routes. Single source of truth for route configuration across the entire app.

## When to Use This Module

**Use this module to:**

- Get route configuration for current navigation context (TopBar title, back button, modals, animations)
- Build URLs with type-safe parameters via `buildRoute`
- Normalize and match routes (case-insensitive, aliases supported)
- Preserve parameters across navigation and deep linking
- Handle dynamic titles and conditional redirects per route
- Configure analytics tracking points per route
- Set up accessibility focus targets and screen reader labels
- Register and override dynamic routes at runtime
- **A/B test route variants** with percentage-based user bucketing
- **Gradually roll out new screens** to subsets of users

**Do NOT use this module for:**

- Authentication/authorization (use [lib/routing's AUTH_CONFIG](../routing/README.md) and [lib/auth's useAuthGuard](../auth/README.md) hook instead)
- App-level state management (use React Context or [lib/storage's SecureStorage](../storage/README.md) instead)
- Screen-specific logic (implement in screen components themselves)
- Modal UI state management (control via React state, not routing)
- Route protection/access control (use [lib/routing/AUTH_CONFIG](../routing/README.md) for auth levels)

## Architecture & Data Flow

```
App Navigation
        ↓
Current route segments (from useSegments())
        ↓
getRouteConfig(context) matches against ROUTE_CONFIGS
        ↓
Route matching strategy:
  1. Exact path match (normalized case)
  2. Alias match (alternative paths)
  3. Parent segment match (first part)
  4. Default fallback
        ↓
Returns RouteConfig with:
  - TopBar title (static or dynamic)
  - Back button target
  - Modal/full-screen behavior
  - Conditional redirects
  - Animations, A11y focus, analytics
  - Route variants (A/B testing)
        ↓
evaluateRouteVariant() determines user variant (if configured)
        ↓
Renderer uses config + variant to display TopBar + screen
```

**Key Principles:**

- **Declarative**: All route config defined in one place (no switch statements in components)
- **Composable**: Routes organized by screen area (login, main, settings, etc.)
- **Type-Safe**: TypeScript enforces valid route properties
- **Dynamic**: Titles/back-buttons can be functions (access to context)
- **Smart Matching**: Handles exact paths, aliases, and fallbacks gracefully
- **Extensible**: Dynamic route registration for plugins/features

## API Reference

### `getRouteConfig(context: NavigationContext): RouteConfig`

Get route configuration for current navigation context. Uses intelligent matching (exact → aliases → parent → default).

```ts
import { getRouteConfig } from '@/lib/navigation';

export function MyScreen() {
  const segments = useSegments();
  const params = useLocalSearchParams();
  const router = useRouter();

  const config = getRouteConfig({
    segments,
    params,
    router,
    worldId: params.worldId as string,
    isMobile: Platform.OS !== 'web',
  });

  const title = resolveTitle(config, { segments, params, router, isMobile: true });

  return (
    <View>
      <TopBar title={title} back={config.back} />
    </View>
  );
}
```

### `resolveTitle(config: RouteConfig, context: NavigationContext): string`

Resolve dynamic title if it's a function. Safe to call with string or function titles.

```ts
const title = resolveTitle(config, context);
// If config.title = "Settings" → returns "Settings"
// If config.title = (ctx) => `${ctx.worldId}` → returns worldId value
```

### `resolveBackTarget(config: RouteConfig, context: NavigationContext): string | undefined`

Resolve back button target if it's a function or return string directly.

```ts
const backTarget = resolveBackTarget(config, context);
// If config.back = "/main" → returns "/main"
// If config.back = (ctx) => ctx.params.returnTo → returns param value
```

### `shouldRedirect(config: RouteConfig, context: NavigationContext): string | undefined`

Check if route should redirect. Returns target path if redirect needed, undefined otherwise.

```ts
const redirectTarget = shouldRedirect(config, context);
if (redirectTarget) {
  router.push(redirectTarget); // Redirect user
}
```

### `buildRoute(path: string, params?: RouteParams): string`

Build a route with URL parameters. Encodes params as query string.

```ts
import { buildRoute } from "@/lib/navigation/uri-helpers";

const route = buildRoute("/main/characters-npcs", {
  worldId: "123",
  tab: "npcs",
  sortBy: "name",
});
// Result: "/main/characters-npcs?worldId=123&tab=npcs&sortBy=name"

router.push(route);
```

### `preserveParams(currentParams: RouteParams, keysToPreserve: string[]): RouteParams`

Extract specific params to preserve across navigation.

```ts
import { preserveParams } from "@/lib/navigation/uri-helpers";

const preserved = preserveParams(
  { worldId: "123", tab: "npcs", search: "dragon" },
  ["worldId", "tab"], // Keep these
);
// Result: { worldId: '123', tab: 'npcs' }
```

### `normalizePath(path: string): string`

Normalize route path to lowercase for case-insensitive matching.

```ts
normalizePath("/Main/Characters"); // Returns "/main/characters"
```

### `pathEquals(path1: string, path2: string): boolean`

Compare two paths case-insensitively.

```ts
pathEquals("/Main/Characters", "/main/characters"); // true
```

### `pathStartsWith(path: string, prefix: string): boolean`

Check if path starts with prefix (case-insensitive).

```ts
pathStartsWith("/main/characters/123", "/main/characters"); // true
```

### `registerRouteConfig(config: RouteConfig): void`

Dynamically register or update a route config at runtime. Useful for feature flags or plugins.

```ts
registerRouteConfig({
  path: "/main/treasure",
  title: "Treasure & Loot",
  showTopBar: true,
  analyticsName: "main_treasure",
});
```

### `getAllRouteConfigs(): RouteConfig[]`

Get all registered route configurations. Useful for debugging or testing.

```ts
const allRoutes = getAllRouteConfigs();
console.log(`App has ${allRoutes.length} routes`);
```

### `getTransitionAnimation(config: RouteConfig, context: NavigationContext): AnimationType`

Get animation type for route transition (placeholder for future implementation).

```ts
const animation = getTransitionAnimation(config, context);
// Returns: 'slide', 'fade', 'modal', or 'none'
// Future: Will integrate with Expo Router stack options
```

## Interfaces

### `NavigationContext`

Context passed to route config handlers (dynamic titles, back buttons, redirects).

```ts
interface NavigationContext {
  segments: string[]; // Route segments from useSegments()
  params: RouteParams; // URL params
  router: Router; // Expo Router instance
  worldId?: string; // Convenience: current world ID
  userRole?: string; // Convenience: current user role
  isMobile: boolean; // Is mobile platform (not web)
}
```

### `RouteConfig`

Configuration for a single route. See [lib/navigation/routes/README.md](routes/README.md) for detailed examples.

```ts
interface RouteConfig {
  path: string; // Required: "/main/characters"
  title: string | ((context) => string); // Required: static or dynamic
  showTopBar?: boolean; // Optional: show TopBar (default: true)
  showHamburger?: boolean; // Optional: show menu button
  back?: string | ((context) => string); // Optional: back target
  aliases?: string[]; // Optional: alternative paths
  requiredParams?: string[]; // Optional: must have in URL
  preserveParamsOnBack?: string[]; // Optional: keep these on back nav
  redirectIf?: (context) => string | undefined; // Optional: conditional redirect
  modal?: ModalConfig; // Optional: modal config
  animation?: AnimationType; // Optional: transition animation
  a11yFocusTarget?: A11yFocusTarget; // Optional: focus target on nav
  analyticsName?: string; // Optional: tracking name
  onError?: (error, context) => void; // Optional: error handler
}
```

## Dependencies

### External Packages

- **`expo-router`** – Router instance for navigation (typed as `Router`)
- **`React`** – Context/state management (implicit)

### Internal Dependencies

- **`lib/navigation/routes/`** – App-specific route definitions (login, main, settings, etc.)
- **`lib/navigation/uri-helpers.ts`** – URL param building and path normalization
- **`lib/utils/logger`** – Navigation logging (category: 'navigation')
- **`lib/routing/AUTH_CONFIG`** – Determines which routes are protected (separate concern)

## File Breakdown

| File                   | Purpose                                                                       | Exports                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigation-config.ts` | Core navigation system. Route matching, resolution, and dynamic registration. | `getRouteConfig()`, `resolveTitle()`, `resolveBackTarget()`, `shouldRedirect()`, `registerRouteConfig()`, `getAllRouteConfigs()`, `getTransitionAnimation()`, types |
| `uri-helpers.ts`       | URL building and path utilities. Parameter handling, normalization, matching. | `buildRoute()`, `preserveParams()`, `normalizePath()`, `pathEquals()`, `pathStartsWith()`, `mergeParams()`, `extractParams()`, types                                |
| `routes/`              | App-specific route configurations organized by screen area.                   | `LOGIN_ROUTES`, `SELECT_ROUTES`, `MAIN_ROUTES`, `SETTINGS_ROUTES`, `WEB_ROUTES`                                                                                     |
| `routes/README.md`     | How to add routes and organize by screen area.                                | Documentation                                                                                                                                                       |

## How It Works in a Screen

```tsx
import { getRouteConfig, resolveTitle, resolveBackTarget } from '@/lib/navigation';
import { useSegments, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform } from 'react-native';

export default function CharactersScreen() {
  const segments = useSegments();
  const params = useLocalSearchParams();
  const router = useRouter();

  // 1. Get route config for current route
  const config = getRouteConfig({
    segments,
    params,
    router,
    worldId: params.worldId as string,
    isMobile: Platform.OS !== 'web',
  });

  // 2. Resolve dynamic title if needed
  const title = resolveTitle(config, { segments, params, router, isMobile: true });

  // 3. Check for conditional redirect
  const redirectTarget = shouldRedirect(config, { segments, params, router, isMobile: true });
  useEffect(() => {
    if (redirectTarget) {
      router.push(redirectTarget);
    }
  }, [redirectTarget]);

  // 4. Render with resolved config
  return (
    <SafeAreaView>
      {config.showTopBar && (
        <TopBar
          title={title}
          onBack={
            config.back
              ? () => router.push(resolveBackTarget(config, {...}))
              : undefined
          }
        />
      )}
      {/* Screen content */}
    </SafeAreaView>
  );
}
```

## Modals vs. Full-Screen Routes

**Key Distinction:**

- **Full-Screen Routes**: Defined in route config, have TopBar, navigate via router.push()
- **Modals**: Presentational components controlled by React state, NOT in route config. Do NOT have route URLs.

Example:

```tsx
// ✅ Full-screen route (in navigation-config)
export const SETTINGS_ROUTES = [
  {
    path: "/settings/world",
    title: "World Settings",
    showTopBar: true,
  },
];

// ✅ Modal (NOT in navigation-config, controlled by state)
<SettingsModal visible={showModal} onDismiss={() => setShowModal(false)} />;
```

The `modal` config field is reserved for future modal-as-route patterns.

## Route Matching Strategy

When navigating to `/main/characters/123`, matching strategy is:

1. **Exact path match** (case-insensitive)
   - Check `/main/characters`
   - Check aliases: `/main/characters-npcs`, etc.

2. **Parent segment match** (first part)
   - Check `/main/*`
   - Default for all `/main/...` routes

3. **Fallback to default**
   - Uses title "D&D Toolkit"
   - Logs warning (route not in config)

## Accessibility

Routes support accessibility focus targets:

- **`a11yFocusTarget: 'title'`** (default) – Focus TopBar title on navigation (good for screen readers)
- **`a11yFocusTarget: 'firstInteractive'`** – Focus first interactive element (e.g., button)
- **`a11yFocusTarget: 'none'`** – No automatic focus (for modals)

## Analytics Integration

Each route can specify an analytics tracking name:

```ts
{
  path: '/main/characters',
  analyticsName: 'main_characters',  // Sent to analytics
}
```

Used by `lib/analytics` to track screen views and user behavior.

## Related Modules

- **`lib/navigation/routes/`** – App-specific route definitions
- **`lib/routing/AUTH_CONFIG`** – Which routes are protected/public
- **`lib/auth/useAuthGuard`** – Enforces authentication on protected routes
- **`lib/analytics`** – Tracks navigation events via `analyticsName`
- **`app/_layout.tsx`** – Root layout that uses getRouteConfig()
- **`hooks/use-app-navigation.tsx`** – Custom hook wrapping navigation functions

## Testing

Currently, no dedicated test guide exists. When adding tests, create a guide at `docs/A Testing Guide/navigation.md`.

**Manual testing tips:**

- Verify dynamic titles render correctly (access context properly)
- Test conditional redirects (unauthorized world, premium only, etc.)
- Check parameter preservation on back navigation
- Verify accessibility focus targets
- Test animations (visual inspection)
- Check analytics tracking names are sent
- Verify aliases work (alternative paths)
- Test dynamic route registration

## Future Enhancements (Navigation)

- **Deep Linking** – Full URI support with automatic param extraction
- **Expo Router Animation Integration** – Implement actual stack animations
- **Plugin Routes** – Plugins register routes dynamically

## Future Enhancements (Routes)

- **Route Groups** – Organize routes into logical groups with shared config (e.g., all /main/\* share same TopBar style)
- **Dynamic Route Registration** – Plugins register routes at runtime
- **Nested Route Support** – Better handling of deeply nested paths
- **Breadcrumb Generation** – Auto-generate breadcrumbs from route hierarchy
