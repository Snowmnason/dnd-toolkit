# Architecture Documentation

Wiki-style reference for the large systems that shape how the app boots, routes, stores data, degrades, and talks to backend services.

## How To Use This Folder

Use this folder when you need to understand the current system model, not just a single feature.

- Start here for cross-cutting architecture questions.
- Use the linked documents for subsystem details.
- Treat `modules/` as the place for deeper module-specific architecture notes that will expand over time.

## Core System Guides

- **[PROVIDER_LAYERS.md](PROVIDER_LAYERS.md)** - Root provider stack, ownership, and why ordering matters
- **[KERNEL_ARCHITECTURE_ANALYSIS.md](KERNEL_ARCHITECTURE_ANALYSIS.md)** - Kernel bootstrap model and the hook or manager bridge into the UI
- **[AUTH_AND_SYNC_FLOW.md](AUTH_AND_SYNC_FLOW.md)** - How auth restoration, re-auth, and sync flow through bootstrap and runtime
- **[REALTIME_ARCHITECTURE.md](REALTIME_ARCHITECTURE.md)** - Realtime feature flag and entitlement update model
- **[Apps Response to Degraded Paths.md](Apps%20Response%20to%20Degraded%20Paths.md)** - Degradation paths, capability flags, and recovery behavior

## Foundation Policies

- **[CACHING_POLICY.md](CACHING_POLICY.md)** - Cache and persistence rules across memory, disk, and secure storage
- **[CSP-Configuration.md](CSP-Configuration.md)** - Web CSP note and current security constraints
- **[ERROR_HANDLING_PATTERN.md](ERROR_HANDLING_PATTERN.md)** - Centralized error-code and `AppError` pattern

## Module Notes

The `modules/` folder is for narrower architecture references that sit below the app-wide system layer.

- `modules/navigation/` - Navigation system and route-flow notes
- `modules/services/` - Service adapter and provider architecture

## Notes

Some deeper implementation writeups still live under `docs/issues/`, but this folder should prefer current-system pages that stand on their own without depending on issue history.