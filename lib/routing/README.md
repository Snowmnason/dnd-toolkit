# lib/routing

App-specific route authentication configuration. Defines which routes are protected (require authentication) and which are public (accessible without login). Used during app initialization to set up authentication guards.

## When to Use This Module

**Use this module to:**

- Define which app routes require authentication (protected vs. public)
- Specify public routes (login, landing, web-only pages)
- Configure redirect behavior when unauthenticated users try to access protected routes
- Set up auth guards during app bootstrap via [lib/auth's useAuthGuard hook](../auth/README.md)
- Coordinate with [lib/navigation's route config](../navigation/README.md) for complete route setup

**Do NOT use this module for:**

- Detailed route configuration like TopBar, modals, animations (use [lib/navigation/navigation-config](../navigation/README.md) instead)
- Navigation logic or URL building (use [lib/navigation](../navigation/README.md) instead)
- Route parameters or deep linking (use [lib/navigation/routes/](../navigation/README.md) instead)
- Per-route UI behavior beyond auth level (use [lib/navigation](../navigation/README.md) instead)
- Subscription/premium gating (use [lib/premium's SubscriptionManager](../premium/README.md) + [lib/feature-flags](../feature-flags/README.md) instead)

## Architecture & Data Flow

```
App Bootstrap
    ↓
Read AUTH_CONFIG from lib/routing
    ↓
lib/auth/useAuthGuard hook checks route against AUTH_CONFIG
    ↓
Protected routes: require authentication (redirected to login if not authed)
Public routes: accessible without authentication
    ↓
Navigation proceeds or redirects based on auth status
```

**Key Principle:**

- Single source of truth for route protection levels
- Used by auth guards during layout initialization
- Complements `lib/navigation/navigation-config` (which handles TopBar, modals, animations)

## API Reference

### `AUTH_CONFIG`

App-specific route authentication configuration object.

```ts
export const AUTH_CONFIG = {
  protectedRoutes: ["select", "main", "settings"] as const,
  publicRoutes: ["login", "web"] as const,
  redirectOnUnauthenticated: "/" as const,
};
```

**Properties:**

- **`protectedRoutes: readonly string[]`** – Routes that require authentication. Unauthenticated users are redirected. Common values: `'main'`, `'select'`, `'settings'`, `'worlds'`
- **`publicRoutes: readonly string[]`** – Routes accessible without authentication. Authenticated users can still visit. Common values: `'login'`, `'web'`, `'landing'`
- **`redirectOnUnauthenticated: string`** – Route to redirect to when unauthenticated user tries to access protected route. Typically `'/'` or `'/login'`

**Type Safety:**

Routes are defined as `const`, enabling TypeScript to enforce valid route names:

```ts
const protectedRoutes = AUTH_CONFIG.protectedRoutes;
// Type: readonly ["select", "main", "settings"]
// TypeScript enforces literal types; prevents typos
```

### Usage in Auth Guards

```ts
import { AUTH_CONFIG } from '@/lib/routing';
import { useAuthGuard } from '@/lib/auth';

// In _layout.tsx:
export default function RootLayout() {
  const kernel = useAppKernel();

  // Protect routes using AUTH_CONFIG
  useAuthGuard(kernel.phases.appReady, {
    protectedRoutes: AUTH_CONFIG.protectedRoutes,
    publicRoutes: AUTH_CONFIG.publicRoutes,
    redirectTarget: AUTH_CONFIG.redirectOnUnauthenticated,
  });

  return <Stack />;
}
```

### Checking Route Protection

```ts
import { AUTH_CONFIG } from "@/lib/routing";

function isProtectedRoute(route: string): boolean {
  return AUTH_CONFIG.protectedRoutes.includes(route);
}

function isPublicRoute(route: string): boolean {
  return AUTH_CONFIG.publicRoutes.includes(route);
}

// Usage:
if (isProtectedRoute("main")) {
  // Route requires authentication
}
```

## Dependencies

### Internal Dependencies

- **`lib/auth` (useAuthGuard)** – Hook that reads AUTH_CONFIG to guard protected routes
- **`lib/navigation/navigation-config`** – Separate config for TopBar, modals, animations (not auth)

### External Dependencies

None. `lib/routing` is self-contained configuration with no external package dependencies.

## File Breakdown

| File              | Purpose                                                     | Exports       |
| ----------------- | ----------------------------------------------------------- | ------------- |
| `route-config.ts` | Route authentication configuration. Simple constant export. | `AUTH_CONFIG` |

## Related Modules

- **`lib/auth/useAuthGuard`** – Primary consumer; reads AUTH_CONFIG to determine which routes to protect
- **`lib/navigation/navigation-config`** – Complements this module; handles route-specific UI (TopBar, modals, etc.)
- **`lib/auth/auth-state.ts`** – Provides authentication status (AuthStateManager)
- **`app/_layout.tsx`** – Root layout that uses AUTH_CONFIG during app initialization

## App-Specific Configuration

**For D&D Toolkit**, protected routes include:

- `select` – World selection screen (requires user account)
- `main` – Main app screens (requires user + world access)
- `settings` – Settings screens (requires authentication)

**Public routes include:**

- `login` – Login/signup screens (accessible without auth)
- `web` – Web-specific pages (accessible without auth)

**To customize for a new app:**

1. Add/remove routes from `protectedRoutes` array
2. Add/remove routes from `publicRoutes` array
3. Update `redirectOnUnauthenticated` if needed (usually `'/'` or `'/login'`)

```ts
// Example: Pathfinder Companion app
export const AUTH_CONFIG = {
  protectedRoutes: ["campaigns", "character-sheet", "party", "settings"],
  publicRoutes: ["login", "landing"],
  redirectOnUnauthenticated: "/login",
};
```

## Error Handling

**Route Not Found in Either List:**

If a route is neither in `protectedRoutes` nor `publicRoutes`, it's treated as **public by default** (accessible without auth). Log a warning during development:

```ts
// In auth guard logic:
if (
  !AUTH_CONFIG.protectedRoutes.includes(route) &&
  !AUTH_CONFIG.publicRoutes.includes(route)
) {
  logger.warn(
    "routing",
    `Route '${route}' not in AUTH_CONFIG, treating as public`,
  );
}
```

**Route in Both Lists:**

Type system prevents this (readonly const arrays), but if manually edited, protected takes precedence in auth guard logic.

## Testing

No dedicated test guide exists. When adding tests, create a guide at `docs/A Testing Guide/routing.md`.

**Manual testing tips:**

- Verify protected routes redirect unauthenticated users to `redirectOnUnauthenticated`
- Verify public routes are accessible without authentication
- Verify authenticated users can access both public and protected routes
- Check console for "Route not in AUTH_CONFIG" warnings (indicates config gap)
- Test on login/logout transitions to verify guard behavior

## Future Enhancements

- **Per-Route Auth Levels** – More granular than protected/public (e.g., 'guest-only', 'admin-only', 'world-required'). See `lib/auth/useAuthGuard` for existing tiered levels
- **Dynamic Route Registration** – Allow features to register their own routes at runtime (plugin pattern)
- **Route Aliases** – Support multiple URLs for same route (SEO, backwards compatibility)
- **Feature-Gated Routes** – Hide routes based on feature flags (see `lib/config/appsettings.*.json`)
