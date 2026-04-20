# Navigation Middleware - Usage Guide

Centralized navigation middleware system that provides unified route protection, case-insensitive matching, and analytics integration for all app navigation.

## Overview

**Use this system for:**
- All navigation actions (push, replace, back, modal navigation)
- Route protection based on authentication and world access
- Case-insensitive route matching and canonicalization
- Navigation analytics and telemetry
- Platform-aware routing constraints

**Do NOT use for:**
- Direct router calls (use navigation hooks instead)
- Navigation that bypasses middleware (all navigation should go through middleware)
- Custom routing logic outside the navigation system

## How It Works

The navigation system operates through a layered architecture:

1. **Hooks Layer** - React hooks provide semantic navigation APIs
2. **Manager Layer** - Orchestrates validation, canonicalization, and policy decisions
3. **Middleware Layer** - Executes guard pipeline and handles analytics
4. **System Layer** - Pure infrastructure for guard execution and transaction management

All navigation requests flow through this pipeline, ensuring consistent behavior and centralized control.

## Basic Usage

### Navigation Hooks

Use the semantic navigation hooks instead of direct router calls:

```typescript
import { useNavigation } from '@/hooks/navigation';

export function MyComponent() {
  const { push, replace, back } = useNavigation();

  const handleNavigate = () => {
    push('/main/characters'); // Goes through middleware
  };

  const handleReplace = () => {
    replace('/select/world-selection'); // Replaces current route
  };

  return (
    <View>
      <Button onPress={handleNavigate} title="Go to Characters" />
      <Button onPress={handleReplace} title="Replace Route" />
      <Button onPress={back} title="Go Back" />
    </View>
  );
}
```

### Route Protection

Routes are automatically protected based on configuration:

```typescript
// Routes are protected in config/routing-auth-config.ts
// No additional code needed in components
const protectedRoutes = [
  '/main/*',      // Requires authentication + world access
  '/select/*',    // Requires authentication only
  '/settings/*',  // Requires authentication only
];
```

### Platform Constraints

Routes can be restricted by platform:

```typescript
// Mobile-only routes
const mobileRoutes = [
  '/main/characters',  // Mobile panel entry
  '/main/items',       // Mobile panel entry
  // ... etc
];

// Desktop-only routes
const desktopRoutes = [
  '/main/main-landing', // Desktop 5-panel view
];
```

## Navigation APIs

### useNavigation()

Main navigation hook providing semantic navigation methods.

```typescript
const {
  push,        // Navigate to new route (adds to history)
  replace,     // Replace current route (no history addition)
  back,        // Go back in history
  dismissTo,   // Dismiss to specific route
  openModal,   // Open modal route
  dismiss,     // Dismiss current modal/screen
} = useNavigation();
```

**Parameters:**
- `route` (string) - Target route path
- `params` (object, optional) - Route parameters

**Returns:** Promise that resolves when navigation completes or rejects on failure.

### useRouteConfig()

Get current route configuration and metadata.

```typescript
const {
  currentRoute,
  routeConfig,
  isProtected,
  platform,
} = useRouteConfig();
```

**Returns:**
- `currentRoute` (string) - Current canonical route path
- `routeConfig` (RouteConfig) - Full route configuration
- `isProtected` (boolean) - Whether route requires authentication
- `platform` ('mobile'|'desktop'|null) - Platform constraint

## Configuration

### Route Protection

Configure protected routes in `config/routing-auth-config.ts`:

```typescript
export const ROUTE_PROTECTION = {
  // Routes requiring authentication + world access
  protected: ['/main/*'],
  // Routes requiring authentication only
  accountOnly: ['/select/*', '/settings/*'],
  // Public routes (no auth required)
  public: ['/', '/login/*', '/web/*'],
};
```

### Platform Constraints

Set platform constraints in route definitions (`lib/navigation/routes/*.ts`):

```typescript
export const mainRoutes: RouteConfig[] = [
  {
    path: '/main/main-landing',
    platform: 'desktop', // Desktop only
    // ... other config
  },
  {
    path: '/main/characters',
    platform: 'mobile', // Mobile only
    // ... other config
  },
];
```

## Analytics Integration

Navigation events are automatically tracked:

```typescript
// Events captured automatically:
// - nav_transition_allowed (successful navigation)
// - nav_guard_auth_denied (auth failure)
// - nav_guard_world_access (world access failure)
// - nav_guard_timeout (pipeline timeout)
// - nav_error (system error)
```

Access analytics data through the analytics system for navigation insights and A/B testing.

## Troubleshooting

### Navigation Fails Silently
- Check console for middleware errors
- Verify route exists in navigation config
- Ensure platform constraints match current platform

### Route Not Found
- Routes must be registered in `lib/navigation/routes/`
- Check for typos in route paths
- Verify case-insensitive matching is working

### Guards Not Executing
- All navigation must use `useNavigation()` hook
- Direct router calls bypass middleware
- Check route protection configuration

### Platform Mismatch
- Routes with `platform` constraints only work on specified platforms
- Use `useRouteConfig()` to check current platform support