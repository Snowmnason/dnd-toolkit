# Phase-Aware Provider Pattern: Usage Guide

## Overview

Phase-aware providers use the kernel's phase system to coordinate when context providers initialize. Instead of implicit dependencies (checking if services exist), providers explicitly declare which kernel phases they need to complete before running their initialization logic.

This guide shows you how to add new phase-aware providers and common patterns for integrating them with the app's bootstrap sequence.

## When to Use Phase-Aware Providers

**Use this pattern when your provider:**
- Accesses storage, database, or network services
- Depends on authentication state
- Needs configuration data loaded first
- Should wait for critical systems to be ready

**Skip this pattern when your provider:**
- Only provides static configuration (no async operations)
- Has no dependencies on other systems
- Is purely presentational (themes, dimensions, platform detection)

## Step-by-Step: Adding a New Phase-Aware Provider

### Step 1: Identify Dependencies

Determine which kernel phases your provider needs:

```typescript
// Available phases (from type-definitions/kernel-types.ts)
type KernelPhase =
  | 'configReady'      // App configuration loaded
  | 'preloadReady'     // Fonts/images preloaded
  | 'networkReady'     // Network detection initialized
  | 'storageReady'     // SecureStorage initialized
  | 'servicesReady'    // Auth/Error/Database providers registered
  | 'authReady'        // User auth state restored
  | 'syncReady'        // Offline sync initialized
  | 'appReady'         // All phases complete
```

**Decision Tree:**
- Need to read/write user preferences? → `storageReady`
- Need to call database or auth APIs? → `servicesReady`
- Need user's authentication state? → `authReady`
- Just need basic config? → `configReady`

### Step 2: Import Required Hooks

```typescript
import { usePhaseReady } from '@/hooks/kernel/use-app-kernel';
import { useEffect } from 'react';
```

### Step 3: Gate Your Provider Logic

**Before (implicit dependency):**
```typescript
export function MyProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // ❌ Implicit dependency - assumes services exist
    if (isAuthConfigured()) {
      loadUserData().then(setData);
    }
  }, []); // Empty deps - runs immediately

  return <MyContext.Provider value={data}>{children}</MyContext.Provider>;
}
```

**After (explicit phase gate):**
```typescript
export function MyProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(null);
  const servicesReady = usePhaseReady('servicesReady');

  useEffect(() => {
    // ✅ Explicit dependency - waits for services phase
    if (servicesReady) {
      loadUserData().then(setData);
    }
  }, [servicesReady]); // ✅ Phase in dependency array

  return <MyContext.Provider value={data}>{children}</MyContext.Provider>;
}
```

### Step 4: Add Documentation Comments

```typescript
export function MyProvider({ children }: { children: React.ReactNode }) {
  // Phase gate: servicesReady
  // Reason: Needs database and auth services to load user data
  const servicesReady = usePhaseReady('servicesReady');

  useEffect(() => {
    if (servicesReady) {
      loadUserData().then(setData);
    }
  }, [servicesReady]);

  return <MyContext.Provider value={data}>{children}</MyContext.Provider>;
}
```

### Step 5: Mount in App Layout

Add your provider to the provider chain in `app/_layout.tsx`:

```typescript
export default function RootLayout() {
  return (
    <AppKernelProvider>
      <LoadingProvider>           {/* Highest priority */}
        <ThemeProvider>           {/* storageReady */}
        <ScaleProvider>           {/* No gate needed */}
        <PlatformProvider>        {/* No gate needed */}
        <AppParamsStableProvider> {/* servicesReady */}
        <AppParamsVolatileProvider>{/* storageReady */}
        <SubscriptionProvider>    {/* TODO: servicesReady */}
          {/* Add your provider here */}
          <MyProvider>            {/* servicesReady */}
            <Stack />
          </MyProvider>
        </SubscriptionProvider>
        </AppParamsVolatileProvider>
        </AppParamsStableProvider>
        </ScaleProvider>
        </PlatformProvider>
        </ThemeProvider>
      </LoadingProvider>
    </AppKernelProvider>
  );
}
```

## Common Patterns

### Pattern 1: Single Phase Gate

Most providers wait for just one phase:

```typescript
// Storage-dependent provider
function ThemeProvider({ children }) {
  const storageReady = usePhaseReady('storageReady');

  useEffect(() => {
    if (storageReady) {
      loadThemeFromStorage();
    }
  }, [storageReady]);

  // ...
}
```

### Pattern 2: Multiple Phase Gates

Some providers need multiple phases:

```typescript
// Auth + storage dependent
function UserPreferencesProvider({ children }) {
  const storageReady = usePhaseReady('storageReady');
  const authReady = usePhaseReady('authReady');

  useEffect(() => {
    // Wait for both phases
    if (storageReady && authReady) {
      loadUserPreferences();
    }
  }, [storageReady, authReady]);

  // ...
}
```

### Pattern 3: Conditional Phase Gates

Advanced providers might have different logic based on configuration:

```typescript
function DataProvider({ children }) {
  const servicesReady = usePhaseReady('servicesReady');
  const authReady = usePhaseReady('authReady');

  useEffect(() => {
    if (servicesReady) {
      if (isSupabaseConfigured()) {
        // Wait for auth if using Supabase
        if (authReady) {
          loadRemoteData();
        }
      } else {
        // Load local data immediately
        loadLocalData();
      }
    }
  }, [servicesReady, authReady]);

  // ...
}
```

### Pattern 4: Provider with Loading States

Combine with LoadingContext for better UX:

```typescript
import { useLoadingContext } from '@/contexts/LoadingContext';

function HeavyProvider({ children }) {
  const servicesReady = usePhaseReady('servicesReady');
  const { setLoading } = useLoadingContext();

  useEffect(() => {
    if (servicesReady) {
      setLoading({ message: 'Loading heavy data...' });
      loadHeavyData().finally(() => {
        setLoading(false);
      });
    }
  }, [servicesReady, setLoading]);

  // ...
}
```

## Integration Examples

### Example 1: Basic Provider Migration

**Before:**
```typescript
// Old implicit approach
function AppParamsProvider({ children }) {
  useEffect(() => {
    if (isAuthConfigured()) {
      restoreSession();
    }
  }, []);
}
```

**After:**
```typescript
// New explicit approach
function AppParamsProvider({ children }) {
  const servicesReady = usePhaseReady('servicesReady');

  useEffect(() => {
    if (servicesReady) {
      restoreSession();
    }
  }, [servicesReady]);
}
```

### Example 2: Provider Chain Dependencies

```typescript
// app/_layout.tsx
<AppKernelProvider>
  <LoadingProvider>
    <ThemeProvider />           {/* Needs: storageReady */}
    <AppParamsStableProvider /> {/* Needs: servicesReady */}
    <UserDataProvider />        {/* Needs: servicesReady + authReady */}
    <App />
  </LoadingProvider>
</AppKernelProvider>
```

### Example 3: Error Handling with Phases

```typescript
function ApiProvider({ children }) {
  const servicesReady = usePhaseReady('servicesReady');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (servicesReady) {
      initializeApiClient()
        .catch(err => {
          setError(err);
          // Could trigger safe mode here
        });
    }
  }, [servicesReady]);

  if (error) {
    return <ErrorBoundary error={error} />;
  }

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}
```

## Checklist for New Providers

- [ ] **Dependencies identified**: Which kernel phase(s) does this provider need?
- [ ] **Phase gate added**: `usePhaseReady(phase)` hook imported and used
- [ ] **Effect dependencies**: Phase included in useEffect dependency array
- [ ] **Documentation**: Phase gate and reason documented in comments
- [ ] **Mount order**: Provider mounted in correct order in `app/_layout.tsx`
- [ ] **Error handling**: What happens if phase fails or times out?
- [ ] **Testing**: Manual test that provider waits correctly
- [ ] **Loading states**: Consider using LoadingContext for long operations

## Troubleshooting

**Provider runs too early:**
- Check that you're using `usePhaseReady(phase)` not just checking phase directly
- Verify phase name is spelled correctly (TypeScript will catch typos)

**Provider never runs:**
- Check that the required phase actually completes (console log kernel.phases)
- Verify provider is mounted inside AppKernelProvider

**Multiple re-renders:**
- Make sure phase is in useEffect dependency array
- Consider using useCallback for expensive operations

**Race conditions:**
- If multiple providers depend on same phase, they will all unblock simultaneously
- Use LoadingContext if you need to serialize operations