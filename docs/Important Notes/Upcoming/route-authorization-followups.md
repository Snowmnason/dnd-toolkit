# Route Authorization Follow-Ups

Future route-gating work that was deliberately deferred from the centralized navigation system.

## Current Status

The current route system already has working protection primitives.

- `config/routing-auth-config.ts` classifies public and protected top-level route groups
- `lib/navigation/navigationConfig.ts` defines route metadata
- `lib/navigation/policyEngine.ts` evaluates access decisions
- route config already supports existing concerns like path identity, analytics names, platform constraints, and back destinations

## What Is Still Missing

The route config does not currently expose a dedicated field for feature-flag or entitlement-based route authorization.

The older issue note called this a `requiresAuthorized` idea. That name is less important than the missing capability itself:

- no route-level field for "this route requires a feature flag"
- no route-level field for "this route requires an entitlement or subscription"
- no unified route metadata contract for future non-auth authorization checks

## Why It Was Deferred

The repo already has enough route protection for the current app:

- public versus protected groups
- permission and admin-oriented policy decisions in the navigation layer
- context-aware route metadata

What it does not yet have is a settled design for route-level feature-flag or entitlement gating.

## When To Revisit

Revisit this when one of these becomes real:

- a route should be hidden or blocked by a feature flag
- a premium or subscription route should require an entitlement
- route access should depend on a richer authorization matrix than auth plus role checks

## Example Future Shape

```ts
{
  path: '/main/premium-tools',
  title: 'Premium Tools',
  requiresEntitlement: 'premium_tools',
}
```

or a more general version:

```ts
{
  path: '/main/beta-feature',
  title: 'Beta Feature',
  authorization: {
    featureFlag: 'beta_tools',
    entitlement: 'premium_beta_access',
  },
}
```

The exact field shape should wait until the real use case is clearer.

## Priority

Low to medium.

This is worth revisiting once route-level feature flagging or entitlement gating becomes a real requirement, not before.