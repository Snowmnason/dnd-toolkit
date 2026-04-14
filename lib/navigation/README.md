# Navigation Module

Centralized route metadata and matching for app navigation.

This module now owns route identity and metadata only:

- path matching
- title resolution
- aliases
- accessibility focus targets
- route analytics names
- optional route-scoped error handling

This module does not own chrome visibility or guard decisions.

## Ownership Model

Navigation route config owns:

- `path`
- `aliases`
- `title`
- `a11yFocusTarget`
- `analyticsName`
- `onError`

AppConfig chrome policy owns:

- top bar visibility
- bottom bar visibility
- hamburger visibility (derived)
- nav drawer visibility
- exact-path overrides via `skipPaths`

Guard/auth systems own:

- redirect decisions
- required param enforcement
- access checks

## API Reference

### Core Route Config

#### `getRouteConfig(context): RouteConfig`

Matches current route using:

1. exact path / alias
2. parent path (`pathStartsWith`)
3. first segment
4. fallback default

#### `resolveTitle(config, context): string`

Resolves route title from static string or title function.

#### `registerRouteConfig(config): void`

Adds or replaces a route config at runtime (testing or dynamic registration).

#### `getAllRouteConfigs(): RouteConfig[]`

Returns the current config registry.

### Path Utilities

#### `canonicalizePath(path): string`

Canonical, case-insensitive path normalization.

#### `pathEquals(path1, path2): boolean`

Case-insensitive path equality.

#### `pathStartsWith(path, prefix): boolean`

Case-insensitive path prefix match.

## RouteConfig Interface

```ts
interface RouteConfig {
  path: string;
  aliases?: string[];
  title: string | ((context: NavigationContext) => string);
  a11yFocusTarget?: "title" | "firstInteractive" | "none";
  analyticsName?: string;
  onError?: (error: Error, context: NavigationContext) => void;
}
```

## Chrome Policy Integration

Chrome visibility is resolved by `hooks/provider/use-chrome-policy.ts` from AppConfig:

- `ui.chrome.topBar.skipRoutes` and `ui.chrome.topBar.skipPaths`
- `ui.chrome.bottomBar.routeGroups` and `ui.chrome.bottomBar.skipPaths`
- `ui.navDrawer.skipRoutes` and `ui.navDrawer.skipPaths`

Exact-path overrides use `skipPaths` (for example `/select/no-topbar`).

## Related Files

- `lib/navigation/navigationConfig.ts`
- `lib/navigation/routeCanonicalizer.ts`
- `lib/navigation/routes/`
- `lib/navigation/index.ts`
- `hooks/provider/use-chrome-policy.ts`

## Notes

- Semantic back targets were removed from route config.
- Redirect and required-params metadata were removed from route config.
- Keep route files focused on metadata and avoid reintroducing UI policy.
