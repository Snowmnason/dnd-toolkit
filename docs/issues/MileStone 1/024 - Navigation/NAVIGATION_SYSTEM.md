# Navigation System Architecture

## Overview

The navigation system provides a centralized, declarative approach to defining route behavior across the D&D Toolkit app. Instead of scattering TopBar titles, back button logic, and param handling across layout files, everything lives in one place: `lib/navigation/navigation-config.ts`.

## Core Concept

**One route = One config entry**

When you add a new screen, you define its navigation behavior once in the config. The system handles matching, param preservation, deep linking, and more automatically.

## How It Works

### 1. Route Matching

When a user navigates to a route like `/main/characters-npcs?worldId=123`, the system:

1. Reads current segments from Expo Router (`useSegments()`)
2. Extracts URL params (`useLocalSearchParams()`)
3. Builds a `NavigationContext` with all relevant info
4. Calls `getRouteConfig(context)` to find the matching config

The matcher tries multiple strategies in order:
- **Exact path match**: `/main/characters-npcs` exactly matches config path
- **Alias match**: `/Login/SignIn` matches via `aliases: ['/login/sign-in']`
- **Starts with**: `/main/characters-npcs/npc-123` matches `/main/characters-npcs`
- **First segment**: `/main/unknown-route` falls back to `/main/main-landing`
- **Default**: Returns generic fallback config

All matching is **case-insensitive** by default.

### 2. Navigation Context

The `NavigationContext` object gives config handlers access to everything they need:

```typescript
{
  segments: ['main', 'characters-npcs'],  // Current route segments
  params: { worldId: '123', userRole: 'dm', tab: 'npcs' },  // URL params
  router: RouterInstance,  // Expo Router for navigation
  worldId: '123',  // Convenience (extracted from params)
  userRole: 'dm',  // Convenience (extracted from params)
  isMobile: false,  // Platform detection
  isAuthenticated: true  // Auth state
}
```

This context is passed to any config function (dynamic titles, back handlers, redirects).

### 3. Route Configuration

Each route config defines its complete behavior:

```typescript
{
  path: '/main/characters-npcs',
  title: 'Characters & NPCs',  // Static or function
  back: '/main/main-landing',  // Where back button goes
  showTopBar: true,
  showHamburger: false,
  requiredParams: ['worldId', 'userRole'],  // Must be present
  preserveParamsOnBack: ['worldId', 'userRole'],  // Keep on navigation
  analyticsName: 'main_characters',
  animation: 'slide'
}
```

### 4. Dynamic Behavior

Configs can be **static values** or **functions**:

```typescript
{
  path: '/settings',
  // Dynamic title based on context
  title: (context) => {
    return context.params.username 
      ? `Settings - ${context.params.username}` 
      : 'Settings';
  },
  
  // Dynamic back target
  back: (context) => {
    if (context.params.fromSearch) {
      return '/main/search-results';
    }
    return '/main/main-landing';
  }
}
```

## URI Helpers

The system includes utilities for safe param handling:

### buildRoute(path, params)
Creates URLs with query params:
```typescript
buildRoute('/main/characters-npcs', { worldId: '123', tab: 'npcs' })
// => '/main/characters-npcs?worldId=123&tab=npcs'
```

### preserveParams(currentParams, keys)
Keeps specific params when navigating:
```typescript
preserveParams(
  { worldId: '123', userRole: 'dm', tab: 'old' },
  ['worldId', 'userRole']
)
// => { worldId: '123', userRole: 'dm' }
```

### buildNavigationTarget(path, current, preserve, additional)
Combines preservation and building:
```typescript
buildNavigationTarget(
  '/main/map-board',
  { worldId: '123', userRole: 'dm', tab: 'characters' },
  ['worldId', 'userRole'],
  { layer: 'combat' }
)
// => '/main/map-board?worldId=123&userRole=dm&layer=combat'
```

## Common Patterns

### Adding a New Route

1. Create the screen file in `app/`:
```typescript
// app/main/spells-magic.tsx
export default function SpellsMagicScreen() {
  // Your component
}
```

2. Add config entry:
```typescript
{
  path: '/main/spells-magic',
  title: 'Spells & Magic',
  back: '/main/main-landing',
  showTopBar: true,
  requiredParams: ['worldId', 'userRole'],
  preserveParamsOnBack: ['worldId', 'userRole'],
  analyticsName: 'main_spells'
}
```

That's it. No layout changes needed.

### Navigating with Params

From any component:
```typescript
import { useRouter, useLocalSearchParams } from 'expo-router';
import { buildNavigationTarget } from '@/lib';

const router = useRouter();
const currentParams = useLocalSearchParams();

// Navigate preserving worldId and userRole
const target = buildNavigationTarget(
  '/main/items-equipment',
  currentParams,
  ['worldId', 'userRole']
);
router.push(target);
```

### Handling Back Navigation

The config's `back` property defines where the back button goes:

```typescript
{
  path: '/main/characters-npcs',
  back: '/main/main-landing',  // Always go to landing
}
```

Or use a function for conditional logic:
```typescript
{
  path: '/main/character-detail',
  back: (context) => {
    // Go back to characters or search depending on entry point
    return context.params.fromSearch 
      ? '/main/search'
      : '/main/characters-npcs';
  }
}
```

### Access Control (redirectIf)

Redirect users who shouldn't access a route:

```typescript
{
  path: '/main/main-landing',
  redirectIf: (context) => {
    // No worldId? Send to world selection
    if (!context.worldId) {
      return '/select/world-selection';
    }
    
    // Future: Check if user has access to this world
    // if (!hasAccess(context.worldId, context.userId)) {
    //   return '/select/world-selection';
    // }
    
    return undefined;  // No redirect needed
  }
}
```

### Modals

Define modal behavior:
```typescript
{
  path: '/modals/character-sheet',
  title: 'Character Sheet',
  modal: {
    isModal: true,
    dismissOnBack: true,  // Back button dismisses
    onDismiss: (context) => {
      // Custom cleanup
      console.log('Sheet dismissed');
    }
  },
  animation: 'modal',
  a11yFocusTarget: 'firstInteractive'
}
```

## Integration Points

### In Layout Components

```typescript
import { useSegments, useRouter, useLocalSearchParams } from 'expo-router';
import { getRouteConfig, resolveTitle, resolveBackTarget } from '@/lib';

function MyLayout() {
  const segments = useSegments();
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const context = {
    segments,
    params,
    router,
    worldId: params.worldId as string,
    userRole: params.userRole as string,
    isMobile: Platform.OS !== 'web',
    isAuthenticated: AuthStateManager.isAuthenticated(),
  };
  
  const config = getRouteConfig(context);
  const title = resolveTitle(config, context);
  const backTarget = resolveBackTarget(config, context);
  
  return (
    <Stack>
      <Stack.Screen
        options={{
          headerTitle: title,
          headerBackVisible: !!backTarget,
          // ...other options from config
        }}
      />
    </Stack>
  );
}
```

### Deep Linking

The system handles deep links automatically. When a user opens:
```
https://app.com/main/characters-npcs?worldId=abc123&userRole=player
```

The system:
1. Matches `/main/characters-npcs` config
2. Extracts params: `{ worldId: 'abc123', userRole: 'player' }`
3. Validates required params are present
4. Applies any `redirectIf` checks
5. Renders with full context

### Case-Insensitive Routing

All paths are normalized to lowercase for matching:
```typescript
// These all match the same config:
'/Main/Characters-NPCs'
'/main/characters-npcs'
'/MAIN/CHARACTERS-NPCS'
```

Use aliases for explicit alternative paths:
```typescript
{
  path: '/login',
  aliases: ['/login/welcome', '/signin', '/auth/login']
}
```

## Security & Safety

### Param Validation

Always validate params for sensitive routes:
```typescript
{
  path: '/settings',
  requiredParams: ['username'],
  redirectIf: (context) => {
    // Ensure username matches authenticated user
    if (context.params.username !== context.currentUser?.username) {
      return '/settings/' + context.currentUser?.username;
    }
    return undefined;
  }
}
```

### Object Injection Protection

URI helpers use null-prototype objects and `hasOwnProperty` guards to prevent prototype pollution:
```typescript
const params = Object.create(null);  // No inherited properties
if (Object.prototype.hasOwnProperty.call(source, key)) {
  params[key] = source[key];  // Safe assignment
}
```

This protects against malicious params like `__proto__` or `constructor`.

## Testing Routes

```typescript
import { getRouteConfig } from '@/lib';

const context = {
  segments: ['main', 'characters-npcs'],
  params: { worldId: '123', userRole: 'dm' },
  router: mockRouter,
  worldId: '123',
  userRole: 'dm',
  isMobile: false,
  isAuthenticated: true,
};

const config = getRouteConfig(context);

expect(config.title).toBe('Characters & NPCs');
expect(config.back).toBe('/main/main-landing');
expect(config.requiredParams).toContain('worldId');
```

## Future Features (Built-in, Not Wired)

### Analytics Tracking
Each route has `analyticsName`. Wire up page view events:
```typescript
useEffect(() => {
  if (config.analyticsName) {
    analytics.pageView(config.analyticsName, context.params);
  }
}, [config.analyticsName]);
```

### A11y Focus Management
Set focus on route changes:
```typescript
if (config.a11yFocusTarget === 'title') {
  titleRef.current?.focus();
}
```

### Animation Types
Use `config.animation` for transition styles:
```typescript
animation: config.animation || 'slide'
```

## Troubleshooting

**Route not matching?**
- Check path spelling and casing
- Use `getAllRouteConfigs()` to see registered routes
- Try adding an alias

**Params not preserved?**
- Ensure `preserveParamsOnBack` includes needed keys
- Use `buildNavigationTarget` helper when navigating

**Back button not working?**
- Check `config.back` is defined
- Use `resolveBackTarget()` to get dynamic back path
- Verify back path exists in route registry

**Deep link fails?**
- Check `requiredParams` are in URL
- Look for `redirectIf` blocking access
- Verify parent route is protected by auth guard

## Best Practices

1. **Keep configs declarative** - Avoid complex logic in config; extract to helper functions
2. **Always preserve worldId/userRole** - These are core context params
3. **Use functions for dynamic behavior** - Titles, back targets, redirects
4. **Test deep links** - Ensure params flow correctly
5. **Document custom logic** - Add comments for non-obvious back behavior
6. **Validate sensitive routes** - Use `redirectIf` for access control

## Summary

The navigation system centralizes route behavior, making it easier to:
- Add new routes (one config entry)
- Maintain consistent navigation patterns
- Handle deep links with params
- Preserve context across navigation
- Implement access control
- Support case-insensitive routing

Everything is type-safe, well-documented, and designed to scale as the app grows.
