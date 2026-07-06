# contexts

Lightweight React contexts used by the app shell and overlay systems. This folder is not the main provider stack; the root app-shell wrappers live in `providers/`.

## What Lives Here

- toast and snackbar state
- notification and modal state
- nav drawer and chrome state
- portal-related shared context
- the legacy `ThemeContext`
- `UIBlockerContext` for loading overlays and splash gating

## Key Responsibilities

- expose narrow UI-shell context hooks without pulling in the full provider stack
- keep overlay-related state close to the overlay provider composition
- provide cycle-safe access to the UI blocker layer from kernel-facing hooks
- preserve the legacy theme context while new theme ownership stays in `providers/ThemeProvider.tsx`

## Important Paths

- `index.ts` — barrel export for the lightweight contexts
- `app-toast-context.tsx` — app toast queue and display state
- `app-snackbar-context.tsx` — snackbar messaging state
- `notifications-context.tsx` — notification center state
- `modal-context.tsx` — modal registration and open-state tracking
- `nav-drawer-context.tsx` — nav drawer visibility and placement
- `chrome-context.tsx` — top bar and bottom bar chrome state
- `dropdown-portal-context.tsx` and `tooltip-portal-context.tsx` — shared portal positioning state
- `ThemeContext.tsx` — legacy theme access path
- `UIBlockerContext.ts` — cycle-safe loading blocker access for kernel and splash flows

## Related Modules

- `providers/README.md` — root app-shell providers and combined wrappers
- `providers/overlay-provider.tsx` — composite overlay provider that wires many of these contexts together
- `components/layer/` — rendering layers that consume toast, snackbar, nav drawer, and blocker state
- `hooks/provider/` — provider-shell coordination hooks

## File Breakdown

| File | Purpose |
| --- | --- |
| `app-toast-context.tsx` | Toast queue and toast actions |
| `app-snackbar-context.tsx` | Snackbar state and tone handling |
| `chrome-context.tsx` | Top bar and bottom bar chrome state |
| `dropdown-portal-context.tsx` | Dropdown portal placement state |
| `modal-context.tsx` | Modal registry and modal open-state helpers |
| `nav-drawer-context.tsx` | Drawer visibility, placement, and drawer actions |
| `notifications-context.tsx` | Notification list and notification actions |
| `PanelNavigationContext.tsx` | Dual-panel navigation state used by panel-aware layouts |
| `ThemeContext.tsx` | Legacy theme context kept for compatibility |
| `tooltip-portal-context.tsx` | Tooltip portal placement state |
| `UIBlockerContext.ts` | Loading blocker state used by the splash and safe-mode shell |
| `index.ts` | Public barrel for the folder |
