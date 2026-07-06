# providers

App-shell providers and combined provider wrappers. This folder owns the root React provider stack that wraps the router and coordinates bootstrap, responsive UI state, subscription state, and app-level route parameters.

## What Lives Here

- root bootstrap provider setup
- combined provider wrappers for visual state and app parameters
- subscription and overlay provider composition
- public provider hooks used by the app shell and route layers

## Key Responsibilities

- boot the kernel before route content renders
- expose theme, scale, platform, and screen state through a combined visual provider
- expose stable and volatile route or world parameters through a combined app-params provider
- host overlay, modal, toast, snackbar, notification, drawer, and chrome state through the overlay composition
- keep the root provider tree readable in `app/_layout.tsx`

## Key Entry Points

- `app/_layout.tsx` — live root provider stack
- `AppKernelProvider.tsx` — kernel bootstrap and safe-mode shell state
- `ViewportProvider.tsx` — combined visual provider for theme, scale, platform, and screen state
- `AppParamsProvider.tsx` — combined provider for stable and volatile app parameters
- `overlay-provider.tsx` — combined overlay and chrome provider stack
- `SubscriptionProvider.tsx` — subscription and entitlement-facing shell state
- `index.ts` — barrel export for stable provider hooks that are safe to import from the folder root

## Related Modules

- `contexts/README.md` — lightweight contexts consumed inside the overlay composition
- `hooks/provider/` — app-shell coordination hooks
- `lib/kernel/README.md` — kernel and bootstrap orchestration
- `theme/README.md` — design tokens and theme system details

## File Breakdown

| File | Purpose |
| --- | --- |
| `AppKernelProvider.tsx` | Outer bootstrap provider for kernel state and readiness |
| `ViewportProvider.tsx` | Combined wrapper for `ThemeProvider`, `ScaleProvider`, `PlatformProvider`, and `ScreenProvider` |
| `ThemeProvider.tsx` | Theme family and mode state |
| `ScaleProvider.tsx` | Responsive sizing tokens |
| `PlatformProvider.tsx` | Platform and breakpoint state |
| `ScreenProvider.tsx` | Screen-level and panel-aware shell state |
| `AppParamsProvider.tsx` | Combined wrapper for stable and volatile app params |
| `AppParamsStableProvider.tsx` | Stable params such as `userId` and connected worlds |
| `AppParamsVolatileProvider.tsx` | Volatile params such as `worldId` and `userRole` |
| `SubscriptionProvider.tsx` | Subscription-facing app-shell state |
| `JobOperationProvider.tsx` | Background job operation UI state |
| `DropdownPortalProvider.tsx` | Dropdown portal wrapper |
| `TooltipPortalProvider.tsx` | Tooltip portal wrapper |
| `overlay-provider.tsx` | Composite provider for overlays, notifications, drawer, and chrome |
| `index.ts` | Public barrel for provider hooks and safe exports |
