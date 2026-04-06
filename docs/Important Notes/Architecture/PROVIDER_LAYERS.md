# Provider Layers Architecture

Centralized documentation of the app's provider hierarchy, explaining what each layer does and how they integrate.

---

## Overview

The app uses **layered providers** to manage different aspects of state and behavior:

1. **Kernel Provider** — Bootstrap + phase management (outermost)
2. **Theme/Scale/Platform Providers** — Design system + device context
3. **Subscription Provider** — Feature/subscription state
4. **App Params Providers** — Global navigation + user context (two-tier gating)
5. **Overlay Provider** — Modals, drawers, notifications, toasts (composite)
6. **UI Blocker Layer** — Splash screen + loading state

---

## Provider Tree Structure

```
┌─ RootLayout
│  ├─ AppKernelProvider ..................... Kernel bootstrap, phases, safe mode
│  ├─ ThemeProvider ......................... Design tokens, dark/light mode
│  ├─ ScaleProvider ......................... Responsive sizing (spacing, fonts)
│  ├─ PlatformProvider ...................... Platform detection (web/ios/android)
│  ├─ SubscriptionProvider .................. Subscription state, feature gate
│  ├─ AppParamsStableProvider ............... User ID + connected worlds (stable)
│  ├─ AppParamsVolatileProvider ............ World ID + user role (volatile)
│  ├─ ModalProvider ......................... Modal stack management
│  ├─ NavDrawerProvider ..................... Drawer state + sidebar expand/collapse
│  ├─ NotificationProvider .................. Notification queue
│  ├─ AppToastProvider ...................... Toast message state management
│  ├─ AppToastLayer ......................... Toast rendering + animations
│  ├─ AppSnackbarProvider ................... Snackbar messages
│  ├─ JobOperationProvider .................. Job operation tracking (bottom-right panel)
│  └─ ChromeProvider ........................ Top/bottom bar state
│     └─ UIBlockerLayer ..................... Splash screen + loading overlay
│        └─ AppErrorBoundary
│           └─ RootLayoutContent (Stack + routes)
```

---

## Detailed Layer Descriptions

### 1. AppKernelProvider

**What it does:**
- Orchestrates app bootstrap (all phases: config → preload → network → storage → services → auth → feature-flags → registration)
- Manages phase timeouts with device-aware adaptive delays
- Tracks app readiness state (`kernel.phases.appReady`)
- Enables safe mode on critical failures
- Provides degradation state (which systems are working/failing)

**When used:**
- Bootstrap guard for all downstream providers
- Phase-dependent initialization (e.g., auth provider waits for `services` phase)

**Related files:**
- `system/Kernel/app-kernel.ts` — Kernel orchestrator
- `hooks/kernel/useAppKernel.ts` — Access kernel state
- `system/Kernel/phases/*.ts` — Individual phase implementations

---

### 2. ThemeProvider

**What it does:**
- Loads and applies design tokens (colors, typography, spacing families)
- Manages dark/light mode switching
- Provides `UseTheme()` hook for component theming

**Context:**
- `ThemeContext` — Current theme state + tokens
- Uses `design-tokens` from theming system

**When used:**
- Components that render visual UI (text colors, backgrounds)
- Any component using `$()` token resolver

**Related files:**
- `theme/ThemeProvider.tsx` — Provider implementation
- `theme/tokens.ts` — Token definitions
- `theme/index.ts` — Barrel export

---

### 3. ScaleProvider

**What it does:**
- Calculates responsive sizing based on device screen size
- Provides `useScale()` hook returning `S.space.*` (margin/padding), `S.fontSize.*`, `S.scale`
- Ensures consistent spacing across platforms

**Context:**
- `ScaleContext` — Scale values (spacing, font sizes)

**When used:**
- Every component that needs responsive sizing
- Layout calculations (padding, gaps, widths)

**Related files:**
- `providers/ScaleProvider.tsx` — Scale calculation logic
- `theme/useScale.ts` — Hook for consuming scale values

---

### 4. PlatformProvider

**What it does:**
- Detects current platform (web, iOS, Android)
- Provides `usePlatform()` hook returning platform type
- Used for platform-specific UI branching

**When used:**
- Components that render differently on web vs mobile
- Platform-specific features (e.g., NavDrawer modes)

**Related files:**
- `providers/PlatformProvider.tsx` — Platform detection

---

### 5. SubscriptionProvider

**What it does:**
- Fetches and caches user subscription tier
- Provides feature gating based on subscription level
- Manages premium/free tier state

**Examples:**
- Show "Premium feature" overlay on free tier
- Unlock advanced map tools on premium
- Track subscription expirations

**Context:**
- `SubscriptionContext` — Current tier + features available

**Related files:**
- `providers/SubscriptionProvider.tsx` — Subscription state
- `hooks/subscriptions/useSubscription.ts` — Consumer hook

---

### 6. AppParamsStableProvider

**What it does:**
- Manages "stable" global params: User ID + list of connected worlds
- These values persist across navigations and don't change during a session
- Synced from storage on app launch

**When loaded:**
- After `kernel.phases.appReady` (storage phase must complete)

**Context:**
- User ID, connected worlds list

**Example:**
```tsx
const { userId, connectedWorlds } = useAppParamsStable();
```

**Related files:**
- `providers/AppParamsStableProvider.tsx` — State management

---

### 7. AppParamsVolatileProvider

**What it does:**
- Manages "volatile" global params: Current world ID + user role in that world
- These change as user navigates between worlds
- Synced from URL params (Expo Router)

**When loaded:**
- Same as stable (needs `appReady`), but updates frequent during navigation

**Examples:**
```tsx
const { worldId, userRole } = useAppParamsVolatile();
// Changes as user navigates: /main?worldId=xyz → /settings (clears worldId)
```

**Related files:**
- `providers/AppParamsVolatileProvider.tsx` — State management
- `app/_layout.tsx` — URL param synchronization

---

### 8. OverlayProvider (Composite)

**What it does:**
- Composite wrapping all overlay/notification providers
- Maintains a consistent ordering for modal stacking

**Contains (in nesting order):**
1. **ModalProvider** — Modal stack (topmost, overlays everything)
2. **NavDrawerProvider** — Drawer state (below modals)
3. **NotificationProvider** — Notification queue
4. **AppToastProvider** — Toast message state management
5. **AppToastLayer** — Toast rendering, positioning, and animations
6. **AppSnackbarProvider** — Snackbar messages
7. **JobOperationProvider** — Job operation tracking
8. **ChromeProvider** — Top/bottom bar state (innermost)

**Why this order matters:**
- Modals need to be rendered last (highest z-index)
- Toast layer renders above provider state but below modals
- Chrome (top/bottom bars) rendered first but appears behind toasts
- Overlays are rendered by outer providers, appearing above inner content

**Related files:**
- `providers/overlay-provider.tsx` — Composite provider

---

### 9. ModalProvider

**What it does:**
- Manages modal stack (multiple modals can be queued)
- Provides `useModal()` hook for showing/hiding modals
- Handles backdrop animations and focus management

**Context:**
- Active modals, modal queue

**Example:**
```tsx
const { show, hide } = useModal();
show(<MyModalContent />);
```

**Related files:**
- `contexts/modal-context.tsx` — Modal stack management

---

### 10. NavDrawerProvider

**What it does:**
- Manages drawer state: modal visibility + position (left/right)
- Desktop sidebar expanded/collapsed state (persisted to storage)
- Provides `useNavDrawer()` hook

**Context:**
- Drawer visibility, position, sidebar expanded state

**Example:**
```tsx
const { show, isExpanded, setExpanded } = useNavDrawer();
```

**Related files:**
- `contexts/nav-drawer-context.tsx` — Drawer state
- `components/layer/NavDrawerLayer.tsx` — Rendering layer
- See: `docs/Important Notes/UI/NAVDRAWER.md`

---

### 11. NotificationProvider

**What it does:**
- Maintains notification queue
- Provides `useNotification()` hook for adding notifications
- Auto-dismisses notifications after timeout

**Context:**
- Active notifications list

**Related files:**
- `contexts/notifications-context.tsx` — Notification management

---

### 12. AppToastProvider

**What it does:**
- Global toast message state management
- Maintains toast queue and visibility state
- Provides `useAppToast()` hook for showing/hiding toasts
- Single toast at a time (not stacked)

**Context:**
- Current toast state (visible, title, message, type)

**Example:**
```tsx
const { show, hide } = useAppToast();
show('File uploaded!', 'success', 2000);
```

**Related files:**
- `contexts/app-toast-context.tsx` — Toast state management

---

### 13. AppToastLayer

**What it does:**
- Renders and positions toast messages from the AppToastProvider queue
- Handles enter/exit animations using React Native Reanimated
- Manages absolute positioning (top-right on desktop)
- Provides touch-to-dismiss functionality
- Uses `pointerEvents: 'box-none'` to avoid blocking UI interactions

**Why separate from provider:**
- Provider manages state, layer handles presentation
- Allows toast rendering to be positioned independently of provider hierarchy
- Follows the same pattern as NotificationContainer

**Positioning:**
- Desktop: Top-right corner with responsive spacing
- Mobile: Adapted positioning (handled by responsive scale system)
- Z-index: 9999 (high priority but below modals)

**Animations:**
- Enter: `FadeInDown` with spring animation (300ms)
- Exit: `FadeOutUp` (200ms)
- Touch feedback: Instant hide on touch

**Related files:**
- `components/layer/AppToastLayer.tsx` — Layer implementation
- `components/ui/AppToast.tsx` — Toast visual component
- `contexts/app-toast-context.tsx` — State management

---

### 13. AppSnackbarProvider

**What it does:**
- Snackbar message system (similar to toast, different styling)
- Provides `useAppSnackbar()` hook
- Alternative to toast for different UX patterns

**Related files:**
- `contexts/app-snackbar-context.tsx` — Snackbar state

---

### 14. JobOperationProvider

**What it does:**
- Manages user-initiated job tracking (uploads, downloads)
- Provides `useJobOperation()` hook
- Shows jobs in collapsible panel (bottom-right desktop, bottom mobile)
- Auto-expands panel when jobs are added (unless user manually collapsed)

**Context:**
- Job list, panel open/closed state, active job count

**Example:**
```tsx
const { addJob, updateJob } = useJobOperation();
addJob({ id, type: 'JobUpload', status: 'pending', ... });
updateJob(id, { status: 'active', progress: 50 });
```

**Related files:**
- `providers/JobOperationProvider.tsx` — Job state
- `components/layer/JobOperationLayer.tsx` — Rendering layer
- `hooks/jobs/useJobOperation.ts` — Consumer hook
- See: `docs/Important Notes/UI/JOB_OPERATIONS.md`

---

### 15. ChromeProvider

**What it does:**
- Manages top/bottom bar state (TopBar + potential future BottomBar)
- Provides state for showing/hiding chrome elements
- Helps prevent UI flickering when chrome changes

**Related files:**
- `contexts/chrome-context.tsx` — Chrome state

---

### 16. UIBlockerLayer

**What it does:**
- Renders the splash screen overlay during bootstrap
- Displays kernel phase progress
- Blocks user interaction until `kernel.phases.appReady === true`
- Auto-hides when bootstrap completes or errors

**Why it's separate:**
- Must be placed outside `RootLayoutContent` to prevent premature route mounts
- Sits between providers and router to gate navigator tree rendering

**Related files:**
- `components/SplashScreen/UIBlockerLayer.tsx` — Implementation
- `hooks/kernel/useKernelLoadingSync.ts` — Sync with kernel state

---

## Integration with Kernel Bootstrap

### Timing

1. **Before `appReady`** — All providers mount, but `RootLayoutContent` renders nothing
2. **During bootstrap** — Kernel phases execute, UIBlockerLayer shows splash
3. **After `appReady`** — Routes mount, auth guards activate, data loads

### Guards

Certain providers wait for specific phases:

| Provider | Waits for | Reason |
|----------|-----------|--------|
| NavDrawerProvider | `appReady` | Loads sidebar state from storage (needs storage phase) |
| SubscriptionProvider | `appReady` | Fetches subscription from database (needs services phase) |
| AppParamsStable | `appReady` | Loads user ID from storage (needs storage phase) |
| AppParamsVolatile | N/A | Syncs from URL immediately |
| ModalProvider | N/A | Theme-agnostic, no guards needed |
| JobOperationProvider | N/A | State-only, no guards needed |

### Post-Bootstrap Behavior

Once `kernel.phases.appReady === true`:
- Route tree fully mounted
- Auth guards can check authentication
- Data queries execute
- UI is fully interactive

---

## Best Practices

### Adding a New Provider

1. **Define context** — Type the state shape clearly
2. **Implement provider** — Use `createContext` + component wrapper
3. **Add consumer hook** — Provide typed access
4. **Place in tree** — Consider z-index/ordering needs
5. **Document** — Add entry to this file + usage guide
6. **Test mounting** — Verify it doesn't break provider order

### Reordering Providers

⚠️ **Careful:** Changing provider order can break z-index stacking or phase dependencies.

**Safe changes:**
- Moving bootstrap-independent providers (modals, toasts)
- Adding guard to a provider that needs `appReady`

**Unsafe changes:**
- Moving OverlayProvider above theme (would break theming in overlays)
- Moving ChromeProvider outside OverlayProvider (breaks z-index)
- Moving AppParams before AppKernel (would break gating)

---

## File Organization

```
providers/
  ├─ AppParamsStableProvider.tsx
  ├─ AppParamsVolatileProvider.tsx
  ├─ PlatformProvider.tsx
  ├─ ScaleProvider.tsx
  ├─ SubscriptionProvider.tsx
  ├─ ThemeProvider.tsx
  ├─ overlay-provider.tsx (composite)
  └─ JobOperationProvider.tsx

contexts/
  ├─ app-snackbar-context.tsx
  ├─ app-toast-context.tsx
  ├─ chrome-context.tsx
  ├─ modal-context.tsx
  ├─ nav-drawer-context.tsx
  ├─ notifications-context.tsx
  └─ index.ts (barrel)

components/
  ├─ layer/
  │  ├─ AppToastLayer.tsx
  │  ├─ JobOperationLayer.tsx
  │  ├─ NavDrawerLayer.tsx
  │  └─ UIBlockerLayer.tsx
  └─ SplashScreen/
     └─ UIBlockerLayer.tsx

app/
  └─ _layout.tsx (root provider tree)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Context hook throws "not within provider" | Check provider ordering in `_layout.tsx`; verify component is inside tree |
| Modal appears behind toast | ModalProvider must come before AppToastProvider |
| Drawer state doesn't persist | `appReady` guard may not be set; check bootstrap phase |
| Component doesn't re-render on context change | Memoize component or use selector hook to narrow updates |
| Multiple providers initializing simultaneously | Some can be parallelized; see kernel phase parallelization docs |

---

## Related Documentation

- **Kernel Bootstrap:** `docs/Important Notes/Architecture/KERNEL_ARCHITECTURE_ANALYSIS.md`
- **NavDrawer Usage:** `docs/Important Notes/UI/NAVDRAWER.md`
- **JobOperations Usage:** `docs/Important Notes/UI/JOB_OPERATIONS.md`
- **Services Architecture:** `docs/Important Notes/Architecture/SERVICES_ARCHITECTURE.md`
