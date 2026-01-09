# Navigation Configuration Guide

## Overview

The navigation config service provides centralized route configuration for the D&D Toolkit. Instead of inline switch/case logic in layout files, each route's behavior is defined declaratively in `lib/navigation/navigation-config.ts`.

## Quick Start

```typescript
import { getRouteConfig, NavigationContext } from '@/lib';

// Build navigation context
const context: NavigationContext = {
  segments: useSegments(),
  params: { worldId: '123', userRole: 'dm' },
  router: useRouter(),
  worldId: '123',
  userRole: 'dm',
  isMobile: Platform.OS !== 'web',
  isAuthenticated: true,
};

// Get config for current route
const config = getRouteConfig(context);

// Use config properties
console.log(config.title); // "Characters & NPCs"
console.log(config.showTopBar); // true
console.log(config.showHamburger); // false
```

## Route Config Properties

### Core Properties

- **`path`**: Route pattern (e.g., `/main/characters-npcs`)
- **`aliases`**: Alternative paths for this route (case-insensitive matching)
- **`title`**: Static string or dynamic function returning title
- **`back`**: Back button target (string path or function)
- **`showHamburger`**: Display hamburger menu button
- **`showTopBar`**: Display TopBar entirely (false for login routes)

### Parameters

- **`requiredParams`**: Array of param keys this route needs (e.g., `['worldId', 'userRole']`)
- **`preserveParamsOnBack`**: Params to preserve when navigating back

### Advanced Features

- **`modal`**: Modal configuration (`isModal`, `dismissOnBack`, `onDismiss`)
- **`redirectIf`**: Conditional redirect hook (e.g., unauthorized world access)
- **`analyticsName`**: Analytics tracking identifier
- **`animation`**: Transition animation type (`'slide'`, `'fade'`, `'modal'`, `'none'`)
- **`a11yFocusTarget`**: Where to focus on navigation (`'title'`, `'firstInteractive'`, `'none'`)
- **`onError`**: Custom error boundary handler

## URI Helpers

### `buildRoute(path, params)`

Build a route with query parameters:

```typescript
import { buildRoute } from '@/lib';

const url = buildRoute('/main/characters-npcs', { 
  worldId: '123', 
  userRole: 'dm',
  tab: 'npcs'
});
// => '/main/characters-npcs?worldId=123&userRole=dm&tab=npcs'
```

### `preserveParams(currentParams, keys)`

Keep specific params when navigating:

```typescript
import { preserveParams } from '@/lib';

const preserved = preserveParams(
  { worldId: '123', userRole: 'player', tab: 'monsters' },
  ['worldId', 'userRole']
);
// => { worldId: '123', userRole: 'player' }
```

### `mergeParams(existing, new)`

Merge param objects with new taking precedence:

```typescript
import { mergeParams } from '@/lib';

const merged = mergeParams(
  { worldId: '123', userRole: 'dm' },
  { userRole: 'player', tab: 'npcs' }
);
// => { worldId: '123', userRole: 'player', tab: 'npcs' }
```

### `validateParams(params, schema)`

Validate and sanitize params:

```typescript
import { validateParams } from '@/lib';

const valid = validateParams(
  { worldId: '123', userRole: 'dm', extra: 'ignored' },
  {
    required: ['worldId'],
    optional: ['userRole'],
    validators: {
      worldId: (val) => typeof val === 'string' && val.length > 0
    }
  }
);
// => { worldId: '123', userRole: 'dm' } or undefined if invalid
```

### `buildNavigationTarget(path, currentParams, preserve, additional)`

Convenience wrapper for building routes with preserved params:

```typescript
import { buildNavigationTarget } from '@/lib';

const target = buildNavigationTarget(
  '/main/characters-npcs',
  { worldId: '123', userRole: 'dm', tab: 'old' },
  ['worldId', 'userRole'],
  { tab: 'npcs' }
);
// => '/main/characters-npcs?worldId=123&userRole=dm&tab=npcs'
```

### Case-Insensitive Utilities

```typescript
import { normalizePath, pathEquals, pathStartsWith } from '@/lib';

normalizePath('/Main/Characters-NPCs'); // => '/main/characters-npcs'
pathEquals('/Main/Landing', '/main/landing'); // => true
pathStartsWith('/main/characters-npcs/123', '/main/characters'); // => true
```

## Adding a New Route

1. Add config entry to `ROUTE_CONFIGS` in `lib/navigation/navigation-config.ts`:

```typescript
{
  path: '/main/spells-magic',
  title: 'Spells & Magic',
  showTopBar: true,
  back: '/main/main-landing',
  requiredParams: ['worldId', 'userRole'],
  preserveParamsOnBack: ['worldId', 'userRole'],
  analyticsName: 'main_spells',
}
```

2. Create the screen file in `app/main/spells-magic.tsx`

3. That's it! The config is automatically picked up by matching logic.

## Matching Strategy

The `getRouteConfig()` function uses multiple strategies to find the best match:

1. **Exact match**: `/main/characters-npcs` matches config with `path: '/main/characters-npcs'`
2. **Alias match**: `/Login/SignIn` matches config with `aliases: ['/login/sign-in']`
3. **Starts with**: `/main/characters-npcs/123` matches config with `path: '/main/characters-npcs'`
4. **First segment**: `/main/unknown` matches config with `path: '/main/main-landing'`
5. **Default**: Fallback to generic config if no match

## Dynamic Titles

Use a function for context-aware titles:

```typescript
{
  path: '/settings',
  title: (context) => context.params.username 
    ? `Settings - ${context.params.username}` 
    : 'Settings',
}
```

## Dynamic Back Targets

Use a function for context-aware back behavior:

```typescript
{
  path: '/main/characters-npcs',
  back: (context) => {
    // Custom logic based on context
    if (context.params.fromSearch) {
      return '/main/search-results';
    }
    return '/main/main-landing';
  },
}
```

## Conditional Redirects

Use `redirectIf` to handle access control:

```typescript
{
  path: '/main/main-landing',
  redirectIf: (context) => {
    // Redirect if no worldId or user doesn't have access
    if (!context.worldId) {
      return '/select/world-selection';
    }
    
    // Check world access (implement in follow-up issue)
    // if (!hasWorldAccess(context.worldId, context.userId)) {
    //   return '/select/world-selection';
    // }
    
    return undefined; // No redirect
  },
}
```

## Modal Configuration

```typescript
{
  path: '/modals/character-sheet',
  title: 'Character Sheet',
  modal: {
    isModal: true,
    dismissOnBack: true,
    onDismiss: (context) => {
      // Custom dismiss logic
      console.log('Modal dismissed');
    },
  },
  animation: 'modal',
  a11yFocusTarget: 'firstInteractive',
}
```

## A11y Focus (Not Yet Wired)

Each route can specify where focus should move on navigation:

- `'title'` (default): Focus TopBar title for screen-reader users
- `'firstInteractive'`: Focus first interactive element on screen
- `'none'`: No automatic focus change

Implementation will be added in a follow-up issue.

## Analytics Integration (Not Yet Wired)

Each route has an `analyticsName` for tracking:

```typescript
{
  path: '/main/characters-npcs',
  analyticsName: 'main_characters',
}
```

Use `analyticsName` to emit page view events when route becomes active. Implementation will be added in follow-up issue.

## Error Boundaries (Not Yet Wired)

Custom error handlers per route:

```typescript
{
  path: '/main/admin-panel',
  onError: (error, context) => {
    console.error(`Error in admin panel: ${error.message}`);
    context.router.replace('/main/main-landing');
  },
}
```

## Testing

### Test Route Matching

```typescript
import { getRouteConfig } from '@/lib/navigation/navigation-config';

const context = {
  segments: ['main', 'characters-npcs'],
  params: { worldId: '123', userRole: 'dm' },
  // ... other context fields
};

const config = getRouteConfig(context);
expect(config.title).toBe('Characters & NPCs');
```

### Test URI Helpers

```typescript
import { buildRoute, validateParams } from '@/lib';

const url = buildRoute('/main/map', { worldId: '123' });
expect(url).toBe('/main/map?worldId=123');

const valid = validateParams(
  { worldId: '123' },
  { required: ['worldId'] }
);
expect(valid).toEqual({ worldId: '123' });
```

## Best Practices

- **Keep configs declarative**: Avoid complex logic in config; use helpers/hooks
- **Preserve params consistently**: Use `preserveParamsOnBack` for worldId/userRole
- **Use case-insensitive paths**: Leverage aliases for alternative casings
- **Test deep links**: Verify params flow correctly through nested routes
- **Document custom back logic**: Add comments when back behavior is non-standard

## Troubleshooting

### Route not matching

Check matching order: exact → alias → startsWith → first segment → default. Use `getAllRouteConfigs()` to debug registered routes.

### Params not preserved

Ensure `preserveParamsOnBack` includes the params you need and that back target uses `buildNavigationTarget()` helper.

### TopBar not showing/hiding correctly

Check `showTopBar` property in config and AUTH_CONFIG integration (public routes auto-hide TopBar).

### Case-sensitive routing issues

Use `aliases` with normalized paths or call `normalizePath()` when comparing routes manually.
