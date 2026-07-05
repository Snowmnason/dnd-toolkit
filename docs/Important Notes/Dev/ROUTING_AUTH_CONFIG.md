# Routing Auth Config

Developer guide for the route-protection configuration used during bootstrap and runtime navigation policy checks.

## Why This Note Exists

This note is about the narrow routing-auth slice of the app, not the full navigation system.

Use this when you need to answer questions like:

- which top-level route groups are protected versus public
- where unauthenticated users get redirected
- which file is the source of truth for route access classification
- what needs to change when a new route group is added

For the larger navigation architecture, use the notes under `Architecture/modules/navigation/`.

## Current Source Of Truth

The live route-auth config is:

- `config/routing-auth-config.ts`

Current contents:

```ts
export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings'] as const,
  publicRoutes: ['login', 'web'] as const,
  redirectOnUnauthenticated: '/login/sign-in' as const,
};
```

This config classifies top-level path segments, not full nested URLs.

Examples:

- `/main/*` is protected because `main` is protected
- `/select/*` is protected because `select` is protected
- `/login/*` is public because `login` is public
- `/web/*` is public because `web` is public

## Where It Is Used

This config is consumed by multiple layers.

### Bootstrap Entry Coordination

- `hooks/navigation/use-bootstrap-route-guard.ts`

This hook runs on web when bootstrap completes and decides whether the current entry URL should be honored or redirected.

### Runtime Navigation Policy

- `lib/navigation/policyEngine.ts`
- `lib/navigation/navManager.ts`

These layers use `AUTH_CONFIG` when evaluating whether a route is public, protected, or should redirect.

### Root Layout

- `app/_layout.tsx`

The root layout calls `useBootstrapRouteGuard(kernel.phases.appReady)` during startup.

## Current Behavior

At a high level:

1. bootstrap finishes
2. web entry coordination checks the current URL
3. policy logic evaluates whether the route is public or protected
4. unauthenticated users are redirected to `redirectOnUnauthenticated`

The current redirect target is:

```ts
'/login/sign-in'
```

That is the current canonical unauthenticated destination, not `/`.

## Examples

### Example 1: Adding A New Protected Route Group

If a new top-level route group like `/account/*` should require login:

```ts
export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings', 'account'] as const,
  publicRoutes: ['login', 'web'] as const,
  redirectOnUnauthenticated: '/login/sign-in' as const,
};
```

Result:

- `/account/profile` becomes protected
- unauthenticated entry to `/account/profile` redirects to sign-in

### Example 2: Adding A New Public Route Group

If a new public route group like `/legal/*` should always be reachable without auth:

```ts
export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings'] as const,
  publicRoutes: ['login', 'web', 'legal'] as const,
  redirectOnUnauthenticated: '/login/sign-in' as const,
};
```

Result:

- `/legal/privacy` can be deep-linked directly
- bootstrap guard should honor it as a public route

### Example 3: Current Web Entry Behavior

Given the current config:

- unauthenticated user opens `/main/characters`
  - route is protected
  - bootstrap or policy layer redirects to `/login/sign-in`
- user opens `/web/privacy`
  - route is public
  - route is allowed directly

## Important Constraint

`AUTH_CONFIG` works on top-level route segments.

That means you should think in terms of route groups like:

- `main`
- `select`
- `settings`
- `login`
- `web`

Do not try to configure every nested child path individually in this file.

## Common Mistakes

- changing the app route structure without updating `AUTH_CONFIG`
- assuming the redirect target is still `/`
- treating this file as the full navigation configuration source of truth
- putting detailed UI route behavior here instead of in navigation config or route metadata

## When To Update This Note

Update this note if any of these change:

- the protected or public top-level route groups
- the unauthenticated redirect target
- the bootstrap hook or policy-engine ownership of route protection

## Related Notes

- `Architecture/modules/navigation/navigation_flow.md`
- `Architecture/modules/navigation/NavSystem.md`
- `app/_layout.tsx`
- `config/routing-auth-config.ts`