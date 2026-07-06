# Provider Layers Architecture

Reference for the root provider stack and the responsibilities owned at each layer.

## Purpose

The app uses a small number of high-value root providers to keep bootstrap, app-wide state, overlays, and failure handling in predictable places.

This document answers three questions:

1. What wraps the app at the root?
2. What does each provider own?
3. Why does the order matter?

## Current Root Shape

The current root layout is organized like this:

```text
RootLayout
└─ AppKernelProvider
   └─ ViewportProvider
      └─ SubscriptionProvider
         └─ AppParamsProvider
            └─ OverlayProvider
               └─ UIBlockerLayer
                  └─ AppErrorBoundary
                     └─ RootLayoutContent
```

Inside `RootLayoutContent`, the app renders the route stack plus the shared overlay layers such as notifications, toasts, job operations, snackbars, the nav drawer, and offline sync messaging.

## Why The Order Matters

- `AppKernelProvider` sits outermost because bootstrap state gates the rest of the app.
- `ViewportProvider` must exist before responsive layout decisions are made.
- `SubscriptionProvider` and `AppParamsProvider` provide app-wide identity, world, and access context used by routed screens.
- `OverlayProvider` must wrap the routed UI so overlays can appear above normal content.
- `UIBlockerLayer` must sit above the routed content so it can own splash and loading overlays.
- `AppErrorBoundary` stays close to the rendered app tree so crashes can fall back cleanly without bypassing the root providers.

## Layer Responsibilities

### AppKernelProvider

Owns bootstrap lifecycle, readiness state, safe mode, and phase progress.

- Starts the kernel once.
- Subscribes UI code to kernel state.
- Exposes app-ready and phase-ready state to hooks.
- Keeps system bootstrap out of screens and route components.

Related code:
- `providers/AppKernelProvider.tsx`
- `hooks/kernel/use-app-kernel.tsx`
- `lib/kernel/kernel-manager.ts`
- `system/Kernel/app-kernel.ts`

### ViewportProvider

Owns app-wide viewport and responsive layout state.

- Provides current viewport context for layout decisions.
- Helps the app branch between desktop-style and mobile-style presentation.
- Supports shared layout logic without pushing viewport checks into every screen.

### SubscriptionProvider

Owns subscription and entitlement-facing UI state.

- Makes premium or gated-state information available to the app.
- Supports feature gating without each screen independently refetching tier state.

### AppParamsProvider

Owns app-level identity and route-derived parameters.

- Bridges stable user context and active world context into the routed app.
- Gives screens a shared place to read current app parameters.
- Keeps world or user context changes centralized instead of scattering them across screens.

### OverlayProvider

Owns overlay-related providers and their ordering contract.

This is the layer that makes modal, portal, drawer, notification, toast, snackbar, and job-operation behavior consistent across the app.

Its main job is not business logic. Its job is composition and z-order discipline.

### UIBlockerLayer

Owns the splash and global loading overlay.

- Starts active by default during bootstrap.
- Hides when kernel readiness allows the app to fully render.
- Can also be reused for blocking foreground operations when needed.

### AppErrorBoundary

Owns the crash fallback path for rendering failures in the routed app tree.

- Catches UI crashes close to the content tree.
- Shows the crash fallback without tearing down the outer provider stack.
- Keeps failure handling explicit at the app-shell level.

## Overlay Behavior In Practice

`OverlayProvider` supplies state and wiring. Visible layers are rendered from the app shell so they can sit above route content consistently.

The current shell renders these shared layers:

- notification container
- app toast layer
- job operation layer
- snackbar layer
- nav drawer layer
- offline sync notification layer

This split keeps provider state separate from the visual layer that actually renders on top of the app.

## What Does Not Belong Here

- Feature-specific local state
- Per-screen form state
- Backend orchestration
- One-off component toggles that do not need app-shell ownership

If a concern does not need root-level composition, it should usually live below this layer.

## Related Guides

- **Kernel bootstrap:** `KERNEL_ARCHITECTURE_ANALYSIS.md`
- **Auth and sync lifecycle:** `AUTH_AND_SYNC_FLOW.md`
- **Degradation and recovery:** `Apps Response to Degraded Paths.md`
- **Services adapter model:** `modules/services/SERVICES_ARCHITECTURE.md`