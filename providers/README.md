# providers

React Context providers for global app state and configuration. Wraps the entire app with shared state, theming, sizing, and authentication.

## Provider Stack

Providers are nested in `app/_layout.tsx` in this order (order matters—each depends on providers above it):

```
AppKernelProvider (bootstrap app, initialize kernel)
  ↓
ThemeProvider (theme family, mode, tokens)
  ↓
ScaleProvider (responsive sizing, fonts, breakpoints)
  ↓
PlatformProvider (web/native platform detection)
  ↓
ViewportProvider (viewport dimensions, responsive breakpoints)
  ↓
ScreenProvider (screen state, focus management)
  ↓
SubscriptionProvider (premium subscription state)
  ↓
AppParamsStableProvider (userId, connectedWorlds)
  ↓
AppParamsVolatileProvider (worldId, userRole)
  ↓
JobOperationProvider (background job state)
  ↓
DropdownPortalProvider (dropdown positioning)
  ↓
TooltipPortalProvider (tooltip positioning)
  ↓
overlay-provider (modal overlays)
  ↓
RootLayout + Navigation Stack
```

## Core Providers

### AppKernelProvider

**File:** `AppKernelProvider.tsx`

Bootstraps the app kernel, manages initialization phases, and coordinates startup sequence. Handles font loading, image preloading, theme initialization, and network setup.

**Export:** `useAppKernel()` hook

**Example:**
```tsx
import { useAppKernel } from "@/providers/AppKernelProvider";

export function AppLoader() {
  const { phases, isReady } = useAppKernel();
  return isReady ? <MainApp /> : <SplashScreen phase={phases.current} />;
}
```

**Related:** `lib/kernel/` (kernel phases and initialization logic)

### ThemeProvider

**File:** `ThemeProvider.tsx`

Manages theme family (classic, cyberpunk, fantasy) and mode (light/dark). Loads saved preferences from SecureStorage. Resolves design tokens at runtime.

**Exports:** `UseTheme()` hook, `useThemeContext()` hook

**Example:**
```tsx
import { UseTheme, useThemeContext } from "@/providers/ThemeProvider";

export function MyComponent() {
  const theme = UseTheme();
  const { mode, setMode } = useThemeContext();

  return (
    <View style={{ backgroundColor: theme.$("background") }}>
      <Text style={{ color: theme.$("textPrimary") }}>Hello</Text>
      <Button onPress={() => setMode(mode === "dark" ? "light" : "dark")} />
    </View>
  );
}
```

**Related:** `theme/` folder (token definitions, theme families)

### ScaleProvider

**File:** `ScaleProvider.tsx`

Provides responsive sizing tokens (fonts, spacing, padding) that adapt to screen size. Listens to `Dimensions`, recalculates on resize, memoizes tokens.

**Export:** `useScale()` hook

**Example:**
```tsx
import { useScale } from "@/providers/ScaleProvider";

export function MyComponent() {
  const S = useScale();
  return (
    <View style={{ paddingTop: S.space.md, fontSize: S.font.body1 }}>
      Responsive content
    </View>
  );
}
```

**Related:** `theme/utils/sizing.ts` (sizes defined here)

### PlatformProvider

**File:** `PlatformProvider.tsx`

Detects platform (web/native), responsive breakpoints, and viewport dimensions. Updates on resize events with hysteresis to prevent mobile/desktop flipping.

**Export:** `usePlatform()` hook

**Example:**
```tsx
import { usePlatform } from "@/providers/PlatformProvider";

export function ResponsiveComponent() {
  const { isMobile, isDesktop } = usePlatform();
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}
```

### ViewportProvider

**File:** `ViewportProvider.tsx`

Manages viewport dimensions and responsive breakpoints. Provides real-time viewport size updates with debouncing.

**Export:** `useViewport()` hook

**Example:**
```tsx
import { useViewport } from "@/providers/ViewportProvider";

export function ResponsiveLayout() {
  const { width, height, breakpoint } = useViewport();
  return <View style={{ width, height }}>{/* responsive content */}</View>;
}
```

### ScreenProvider

**File:** `ScreenProvider.tsx`

Manages screen focus state and navigation context. Tracks current screen and provides focus management utilities.

**Export:** `useScreen()` hook

**Example:**
```tsx
import { useScreen } from "@/providers/ScreenProvider";

export function ScreenComponent() {
  const { isFocused, screenId } = useScreen();
  return isFocused ? <ActiveContent /> : <InactiveContent />;
}
```

## Data Providers

### AppParamsStableProvider

**File:** `AppParamsStableProvider.tsx`

Manages stable app parameters (userId, connectedWorldIds). Integrates with AuthStateManager. Performs background Supabase verification. Uses context-selector for performance.

**Exports:** `useUserId()`, `useConnectedWorlds()` hooks

**Example:**
```tsx
import { useUserId, useConnectedWorlds } from "@/providers/AppParamsStableProvider";

export function WorldSelector() {
  const userId = useUserId();
  const worlds = useConnectedWorlds();
  return <>{worlds.map(w => <Text key={w}>{w}</Text>)}</>;
}
```

**Related:** `lib/auth/auth-state.ts` (world access verification)

### AppParamsVolatileProvider

**File:** `AppParamsVolatileProvider.tsx`

Manages volatile session state (worldId, userRole). Persists to SecureStorage. Syncs across tabs on web. Uses context-selector for performance.

**Exports:** `useWorldId()`, `useUserRole()` hooks

**Example:**
```tsx
import { useWorldId, useUserRole } from "@/providers/AppParamsVolatileProvider";

export function WorldInfo() {
  const worldId = useWorldId();
  const role = useUserRole();
  return <Text>{role} in world {worldId}</Text>;
}
```

### SubscriptionProvider

**File:** `SubscriptionProvider.tsx`

**Status:** Scaffolding (placeholder, no real backend yet)

Manages premium subscription state (tier, features, refresh logic). Initializes subscription cache on mount.

**Export:** `useSubscription()` hook

**Example:**
```tsx
import { useSubscription } from "@/providers/SubscriptionProvider";

export function PremiumFeature() {
  const { isPremium } = useSubscription();
  return isPremium ? <PremiumContent /> : <FreeContent />;
}
```

**Future:** Fetch from Supabase/Stripe, polling, error handling.

### JobOperationProvider

**File:** `JobOperationProvider.tsx`

Manages background job operations and their UI state. Provides progress tracking and cancellation for long-running operations.

**Export:** `useJobOperation()` hook

**Example:**
```tsx
import { useJobOperation } from "@/providers/JobOperationProvider";

export function JobRunner() {
  const { runningJobs, cancelJob } = useJobOperation();
  return <>{runningJobs.map(job => <JobProgress key={job.id} job={job} />)}</>;
}
```

**Related:** `system/jobs/` (job queue system)

## UI Providers

### DropdownPortalProvider

**File:** `DropdownPortalProvider.tsx`

Manages dropdown positioning and portal rendering. Handles z-index stacking and positioning calculations for dropdown menus.

**Export:** `useDropdownPortal()` hook

**Example:**
```tsx
import { useDropdownPortal } from "@/providers/DropdownPortalProvider";

export function DropdownMenu() {
  const { portalRef, position } = useDropdownPortal();
  return <Portal ref={portalRef} style={position}>...</Portal>;
}
```

### TooltipPortalProvider

**File:** `TooltipPortalProvider.tsx`

Manages tooltip positioning and portal rendering. Handles tooltip display timing and positioning relative to trigger elements.

**Export:** `useTooltipPortal()` hook

**Example:**
```tsx
import { useTooltipPortal } from "@/providers/TooltipPortalProvider";

export function TooltipTrigger() {
  const { showTooltip, hideTooltip } = useTooltipPortal();
  return <Touchable onPress={showTooltip}>Hover me</Touchable>;
}
```

### overlay-provider

**File:** `overlay-provider.tsx`

Manages modal overlays and backdrop rendering. Handles overlay stacking, backdrop blur, and dismissal gestures.

**Export:** `useOverlay()` hook

**Example:**
```tsx
import { useOverlay } from "@/providers/overlay-provider";

export function ModalContainer() {
  const { isVisible, backdropOpacity } = useOverlay();
  return isVisible ? <Modal backdropOpacity={backdropOpacity} /> : null;
}
```

## Creating a Custom Provider

Pattern:

```tsx
// providers/MyProvider.tsx
import React, { createContext, useContext, useMemo } from "react";

interface MyContextValue {
  data: string;
  setData: (value: string) => void;
}

const MyContext = createContext<MyContextValue | undefined>(undefined);

export function MyProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState("initial");

  const value = useMemo(() => ({ data, setData }), [data]);

  return (
    <MyContext.Provider value={value}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error("useMyContext must be used inside MyProvider");
  }
  return context;
}
```

Then add to `app/_layout.tsx`:
```tsx
<MyProvider>{/* Rest of providers */}</MyProvider>
```

**Key:** Memoize context value with `useMemo` to prevent unnecessary re-renders.

---

## Best Practices

**Do:**
- Keep provider state minimal (only truly global)
- Memoize context values to prevent re-renders
- Use specific hooks (`useScale()`, not generic `useContext()`)
- Order providers by dependency (leaf nodes first)
- Document what each provider does

**Don't:**
- Put component state in providers (use local state)
- Access providers before they're mounted in tree
- Reorder providers without understanding dependencies
- Create a provider for every state (use local state first)

---

## Dependency Order

**Critical:** Providers depend on ones above them.

```
AppKernel          ← Initializes kernel phases
  ThemeProvider    ← Needs theme tokens loaded
    ScaleProvider  ← Builds on theme sizing tokens
      ...others    ← All depend on above
```

If a provider uses another provider's hook, it **must come after** that provider in the tree.

---

## Troubleshooting

**"Context is undefined"**
- Provider must be wrapped around component in tree
- Check you're using the right hook
- Verify provider hasn't been unmounted

**"Component not updating"**
- Check if context value is memoized (it should be)
- Verify dependency array in useMemo
- Don't create new objects inside render

**"Too many re-renders"**
- Memoize context values with useMemo
- Check for circular dependencies between providers

---

## Related Modules

- [app/_layout.tsx](../app/_layout.tsx) – Provider tree setup
- [theme/](../theme/) – Theme tokens and families
- [lib/auth/](../lib/auth/) – Authentication guards and state management
- [lib/kernel/](../lib/kernel/) – App bootstrap and kernel phases
