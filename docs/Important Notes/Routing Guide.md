# lib/routing

Route authentication configuration (protected vs. public routes). Defines which routes require login and accessible without authentication. Input for lib/auth's useAuthGuard hook during app bootstrap.

## When to Use This Module

- Define protected routes (require authentication)
- Define public routes (no login required)
- Set up auth redirects during app initialization
- Coordinate with lib/navigation for complete route setup

Do NOT use for: detailed route config like TopBar, modals, animations (use lib/navigation), navigation logic (use lib/navigation), or route parameters (use lib/navigation/routes).

## Architecture & Data Flow

```
App Bootstrap → Read AUTH_CONFIG → lib/auth/useAuthGuard checks route
  ├─ Protected: redirect unauthenticated users
  └─ Public: allow all users
```

Single source of truth for route protection levels. Complements lib/navigation (which handles TopBar, modals, animations).

## API Reference

`AUTH_CONFIG` — Configuration with `protectedRoutes` (require auth), `publicRoutes` (no auth), `redirectOnUnauthenticated` (redirect target).

**Example:**
```ts
export const AUTH_CONFIG = {
  protectedRoutes: ["select", "main", "settings"] as const,
  publicRoutes: ["login", "web"] as const,
  redirectOnUnauthenticated: "/",
};
```

**Usage in layouts:**
```ts
import { useAuthGuard } from '@/lib/auth';
import { AUTH_CONFIG } from '@/lib/routing';

useAuthGuard(kernel.phases.appReady, {
  protectedRoutes: AUTH_CONFIG.protectedRoutes,
  publicRoutes: AUTH_CONFIG.publicRoutes,
  redirectTarget: AUTH_CONFIG.redirectOnUnauthenticated,
});
```

## Dependencies

**External:** None

**Internal:** lib/auth (useAuthGuard uses AUTH_CONFIG), lib/navigation (handles UI config)

## File Breakdown

| File            | Purpose                                    | Lines |
| --------------- | ------------------------------------------ | ----- |
| route-config.ts | Route auth config (protected/public routes) | ~20   |
| index.ts        | Barrel export                              | ~10   |

## Related Modules

- [lib/auth](../auth/README.md) — useAuthGuard reads AUTH_CONFIG to protect routes
- [lib/navigation](../navigation/README.md) — Handles route UI config (TopBar, modals, animations)
- [app/_layout.tsx](../../app/_layout.tsx) — Root layout uses AUTH_CONFIG during bootstrap

## Customization

To configure for a new app, edit route-config.ts:
```ts
export const AUTH_CONFIG = {
  protectedRoutes: ["main", "settings"],
  publicRoutes: ["login", "landing"],
  redirectOnUnauthenticated: "/login",
};
```

Routes not in either list default to public with a console warning (indicates config gap).
