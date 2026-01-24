# providers

**React Context providers for global app state and configuration.**

Wraps the entire app with shared state, theming, sizing, and authentication. Located in the provider tree in `app/_layout.tsx`.

---

## Provider Stack

Providers are nested in `app/_layout.tsx` in this order:

```
AppKernelProvider (bootstrap app, initialize kernel)
  ↓
ThemeProvider (theme family, mode, tokens) ★ MOVED HERE
  ↓
ScaleProvider (responsive sizing, fonts, breakpoints)
  ↓
PlatformProvider (web/native platform detection) ★ MOVED HERE
  ↓
SubscriptionProvider (premium subscription state)
  ↓
AppParamsStableProvider (userId, connectedWorlds) ★ MOVED HERE
  ↓
AppParamsVolatileProvider (worldId, userRole) ★ MOVED HERE
  ↓
NotificationProvider (toast/snackbar notifications)
  ↓
RootLayout + Navigation Stack
```

**Order matters** – Each provider depends on providers above it. Don't reorder without understanding dependencies.

---

## Providers Overview

### ScaleProvider

**File:** `ScaleProvider.tsx`

**Purpose:** Provides responsive sizing tokens (fonts, spacing, padding) that adapt to screen size.

**Exports:** `useScale()` hook

**Usage:**

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

**What it does:**

- Listens to `Dimensions` (screen resize events)
- Recalculates sizing based on screen width
- Memoizes sizing object to prevent unnecessary re-renders
- Provides fonts, spacing, button sizes, breakpoints

**Related:** `theme/ultils/sizing.ts` (where sizes are defined)

---

### SubscriptionProvider

**File:** `SubscriptionProvider.tsx`

**Status:** SCAFFOLDING (placeholder, no real backend yet)

**Purpose:** Manages premium subscription state (tier, features, refresh logic).

**Exports:** `useSubscription()` hook

**Usage:**

```tsx
import { useSubscription } from "@/providers/SubscriptionProvider";

export function PremiumFeature() {
  const { subscription, isPremium, isLoading } = useSubscription();

  if (!isPremium) return <Text>Premium only</Text>;
  return <Text>Premium content</Text>;
}
```

**What it does (currently):**

- Initializes subscription cache on mount
- Provides refresh method to fetch latest subscription
- Shares subscription state across app (avoid duplicate fetches)

**What it will do (future):**

- Fetch from Supabase/Stripe backend
- Set up polling or listeners for cache invalidation
- Handle error states (network, auth errors)

**Related:** `lib/premium/` (SubscriptionManager, premium features)

---

### ThemeProvider

**File:** `ThemeProvider.tsx` ★ MOVED FROM `/theme`

**Purpose:** Manages theme family (classic, cyberpunk, fantasy) and mode (light/dark).

**Exports:** `UseTheme()` hook, `useThemeContext()` hook

**Usage:**

```tsx
import { UseTheme, useThemeContext } from "@/providers/ThemeProvider";

export function MyComponent() {
  const theme = UseTheme();
  const { family, mode, setFamily, setMode } = useThemeContext();

  return (
    <View style={{ backgroundColor: theme.$("background") }}>
      <Text style={{ color: theme.$("textPrimary") }}>Hello</Text>
      <Button onPress={() => setMode(mode === "dark" ? "light" : "dark")} />
    </View>
  );
}
```

**What it does:**

- Loads saved theme preferences from SecureStorage
- Manages active theme family and mode
- Resolves design tokens (colors, fonts, sizing)
- Provides theme switching at runtime

**Related:** `theme/` folder (token definitions, theme families)

---

### PlatformProvider

**File:** `PlatformProvider.tsx` ★ MOVED FROM `/contexts`

**Purpose:** Detects and provides platform info (web/native, responsive breakpoints).

**Exports:** `usePlatform()` hook

**Usage:**

```tsx
import { usePlatform } from "@/providers/PlatformProvider";

export function ResponsiveComponent() {
  const { isMobile, isDesktop, width, height } = usePlatform();

  return (
    <View>
      {isMobile && <Text>Mobile layout</Text>}
      {isDesktop && <Text>Desktop layout</Text>}
    </View>
  );
}
```

**What it does:**

- Detects platform (mobile/desktop) with hysteresis logic
- Tracks viewport dimensions (width, height)
- Updates on resize events
- Prevents mobile/desktop flipping on small size changes

**Related:** `useScale()` (responsive sizing tokens)

---

### AppParamsStableProvider

**File:** `AppParamsStableProvider.tsx` ★ MOVED FROM `/contexts`

**Purpose:** Manages stable app parameters (userId, connectedWorldIds).

**Exports:** `useAppParamsStable()`, `useUserId()`, `useConnectedWorlds()` hooks

**Usage:**

```tsx
import {
  useUserId,
  useConnectedWorlds,
} from "@/providers/AppParamsStableProvider";

export function WorldSelector() {
  const userId = useUserId();
  const worlds = useConnectedWorlds();

  return (
    <View>
      <Text>User: {userId}</Text>
      {worlds.map((w) => (
        <Text key={w}>{w}</Text>
      ))}
    </View>
  );
}
```

**What it does:**

- Manages userId and connectedWorldIds
- Integrates with AuthStateManager
- Performs background Supabase verification
- Uses context-selector for performance

**Related:** `lib/auth/auth-state.ts` (world access verification)

---

### AppParamsVolatileProvider

**File:** `AppParamsVolatileProvider.tsx` ★ MOVED FROM `/contexts`

**Purpose:** Manages volatile session state (worldId, userRole).

**Exports:** `useAppParamsVolatile()`, `useWorldId()`, `useUserRole()` hooks

**Usage:**

```tsx
import { useWorldId, useUserRole } from "@/providers/AppParamsVolatileProvider";

export function WorldInfo() {
  const worldId = useWorldId();
  const role = useUserRole();

  return (
    <Text>
      {role} in world {worldId}
    </Text>
  );
}
```

**What it does:**

- Manages worldId and userRole for session state
- Persists to SecureStorage
- Syncs across tabs on web
- Uses context-selector for performance

**Related:** `lib/storage/SecureStorage.ts` (persistence)

---

### AuthProvider

**File:** `auth-provider.tsx`

**Purpose:** Manages authentication state (session, profile, login/logout).

**Exports:** `useAuthContext()` hook

**Usage:**

```tsx
import { useAuthContext } from "@/hooks/use-auth-context";

export function UserProfile() {
  const { session, profile, isLoading } = useAuthContext();

  if (!session) return <Text>Not logged in</Text>;
  return <Text>Hello, {profile?.name}</Text>;
}
```

**What it does:**

- Fetches current session on app startup
- Subscribes to auth state changes (login, logout, token refresh)
- Stores session in context for global access
- Handles Supabase auth events

**Related:** `lib/auth/`, `lib/auth/auth-state.ts` (userId management)

---

## Advanced Usage

### Creating a Custom Provider

If you need global state, create a provider following this pattern:

```tsx
// providers/MyProvider.tsx
import React, { createContext, useContext } from "react";

interface MyContextValue {
  data: string;
  setData: (value: string) => void;
}

const MyContext = createContext<MyContextValue | undefined>(undefined);

export function MyProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState("initial");

  return (
    <MyContext.Provider value={{ data, setData }}>
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

### Performance: Preventing Unnecessary Re-renders

Use `useMemo` to memoize context values:

```tsx
const value = useMemo(
  () => ({ data, setData }),
  [data], // Only recreate when data changes
);

return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
```

This prevents child components from re-rendering when provider mounts/unmounts.

---

## Best Practices

### ✅ Do

- Keep provider state minimal (only what's truly global)
- Memoize context values to prevent re-renders
- Use specific hooks (`useScale()`, not generic `useContext()`)
- Document what each provider does
- Order providers by dependency (leaf nodes first)

### ❌ Don't

- Put component state in providers (use React state or local storage)
- Access providers before they're mounted in tree
- Skip error boundaries (wrap providers with try/catch)
- Create provider for every state (use local state first)
- Reorder providers without understanding dependencies

---

## Dependency Order

**Critical:** These providers depend on ones above them.

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

- Make sure provider is wrapped around component in tree
- Check that you're using the right hook
- Verify provider hasn't been unmounted

**"Component not updating"**

- Check if context value is memoized (it should be)
- Verify dependency array in useMemo
- Don't create new objects inside render (causes recreations)

**"Too many re-renders"**

- Memoize context values with useMemo
- Check for circular dependencies between providers
- Don't call provider hooks in render (only in components)

---

## Related

- [app/\_layout.tsx](../app/_layout.tsx) – Provider tree setup
- [theme/](../theme/) – Theme tokens and families (ThemeProvider now in /providers)
- [lib/auth/](../lib/auth/) – Authentication guards and state management
- [lib/kernel/](../lib/kernel/) – App bootstrap and kernel phases
- [hooks/use-auth-context.tsx](../hooks/use-auth-context.tsx) – Auth context hook
