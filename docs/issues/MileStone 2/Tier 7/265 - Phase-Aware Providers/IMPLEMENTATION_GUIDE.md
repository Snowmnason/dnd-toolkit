# Phase-Aware Provider Pattern: Implementation Guide

## Overview

This guide explains how the kernel phase system works internally and how phase-aware providers integrate with the bootstrap lifecycle. Understanding these mechanics helps you debug issues and implement providers that work reliably with the app's initialization sequence.

## Kernel Phase Lifecycle

### Phase Execution Order

Kernel phases execute sequentially in this order:

```
1. CONFIG      (100-150ms)  - Load app configuration
   ↓
2. PRELOAD     (300-500ms)  - Load fonts and critical assets
   ↓
3. NETWORK     (<10ms)      - Initialize network detection
   ↓
4. STORAGE     (50-100ms)   - Initialize storage systems
   ↓
5. SERVICES    (50-100ms)   - Register service providers
   ↓
6. JOB_SETUP   (20-50ms)    - Initialize background job queues
   ↓
7. AUTH        (500-1000ms) - Restore authentication state
   ↓
8. SYNC_READY  (varies)     - Initialize offline sync
   ↓
9. APP_READY   (0ms)        - All phases complete
```

### Phase Dependencies

Each phase depends on the previous phases:

- **CONFIG**: No dependencies (runs first)
- **PRELOAD**: Depends on CONFIG (needs config to know which fonts to load)
- **NETWORK**: Depends on CONFIG (needs config for network settings)
- **STORAGE**: Depends on CONFIG (needs config for storage backends)
- **SERVICES**: Depends on STORAGE (some services need storage initialized)
- **JOB_SETUP**: Depends on SERVICES (job queue needs service providers)
- **AUTH**: Depends on SERVICES (needs auth service provider)
- **SYNC_READY**: Depends on AUTH (needs user context for sync)
- **APP_READY**: Depends on all previous phases

### Phase State Management

```typescript
// From lib/kernel/app-kernel.ts
interface KernelState {
  phases: {
    configReady: boolean;
    preloadReady: boolean;
    networkReady: boolean;
    storageReady: boolean;
    servicesReady: boolean;
    jobSetupReady: boolean;
    authReady: boolean;
    syncReady: boolean;
    appReady: boolean;
  };
  timing: {
    configStart: number;
    preloadStart: number;
    // ... timing for each phase
  };
  error?: KernelError;
}
```

## How Phase Updates Trigger Re-renders

### React Integration Pattern

The kernel uses a publish-subscribe pattern with React:

```typescript
// lib/kernel/use-app-kernel.tsx
export function usePhaseReady(phase: keyof KernelPhases): boolean {
  const kernel = useKernel();

  // Subscribe to kernel state changes
  const [phaseReady, setPhaseReady] = useState(kernel.phases[phase]);

  useEffect(() => {
    // Update local state when kernel phase changes
    const unsubscribe = kernel.subscribe(() => {
      setPhaseReady(kernel.phases[phase]);
    });

    return unsubscribe;
  }, [kernel, phase]);

  return phaseReady;
}
```

### Re-render Cascade

When a phase completes:

1. **Kernel updates phase state**: `kernel.phases.storageReady = true`
2. **Kernel notifies subscribers**: All `usePhaseReady()` hooks re-evaluate
3. **React re-renders**: Components using the phase hook update
4. **Effects run**: `useEffect(() => { if (storageReady) { ... } }, [storageReady])`

### Timing Considerations

```typescript
// Example: Provider waiting for storageReady
function ThemeProvider({ children }) {
  const storageReady = usePhaseReady('storageReady');

  useEffect(() => {
    console.log('ThemeProvider effect running, storageReady:', storageReady);
    if (storageReady) {
      // This runs AFTER storage phase completes
      loadThemeFromStorage();
    }
  }, [storageReady]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
```

**Console output:**
```
ThemeProvider effect running, storageReady: false  // Initial render
ThemeProvider effect running, storageReady: true   // After storage phase
```

## Common Pitfalls & Solutions

### Pitfall 1: Missing Phase in Dependencies

**Problem:**
```typescript
useEffect(() => {
  if (storageReady) {
    loadData();
  }
}, []); // ❌ Missing storageReady in deps
```

**Why it's broken:** Effect runs once on mount, before storage is ready.

**Solution:**
```typescript
useEffect(() => {
  if (storageReady) {
    loadData();
  }
}, [storageReady]); // ✅ Include phase in dependencies
```

### Pitfall 2: Direct Phase Checking

**Problem:**
```typescript
const kernel = useKernel();
useEffect(() => {
  if (kernel.phases.storageReady) { // ❌ Direct access
    loadData();
  }
}, []);
```

**Why it's broken:** No re-render when phase completes.

**Solution:**
```typescript
const storageReady = usePhaseReady('storageReady');
useEffect(() => {
  if (storageReady) {
    loadData();
  }
}, [storageReady]);
```

### Pitfall 3: Race Conditions with Multiple Phases

**Problem:**
```typescript
const storageReady = usePhaseReady('storageReady');
const authReady = usePhaseReady('authReady');

useEffect(() => {
  if (storageReady) { // ❌ Only checks one phase
    loadUserData();
  }
}, [storageReady]); // ❌ Missing authReady
```

**Why it's broken:** Runs when storage is ready, even if auth isn't.

**Solution:**
```typescript
useEffect(() => {
  if (storageReady && authReady) { // ✅ Check both
    loadUserData();
  }
}, [storageReady, authReady]); // ✅ Both in dependencies
```

### Pitfall 4: Infinite Re-renders

**Problem:**
```typescript
useEffect(() => {
  if (storageReady) {
    setData(fetchData()); // ❌ Creates new object every render
  }
}, [storageReady]);
```

**Why it's broken:** `fetchData()` returns new object → state changes → re-render → effect runs again.

**Solution:**
```typescript
useEffect(() => {
  if (storageReady) {
    fetchData().then(setData); // ✅ Async, no new object
  }
}, [storageReady]);
```

### Pitfall 5: Provider Order Issues

**Problem:**
```typescript
// app/_layout.tsx - Wrong order
<AppKernelProvider>
  <MyProvider />        {/* Needs servicesReady */}
  <ServiceProvider />   {/* Provides servicesReady */}
</AppKernelProvider>
```

**Why it's broken:** MyProvider mounts before services exist.

**Solution:**
```typescript
<AppKernelProvider>
  <ServiceProvider />   {/* Services first */}
  <MyProvider />        {/* Then dependent providers */}
</AppKernelProvider>
```

## Debugging Phase-Aware Providers

### 1. Check Phase Completion

Add logging to see when phases complete:

```typescript
// In your provider
const storageReady = usePhaseReady('storageReady');

useEffect(() => {
  console.log('MyProvider: storageReady =', storageReady);
  console.log('MyProvider: all phases =', useKernel().phases);
}, [storageReady]);
```

**Expected output:**
```
MyProvider: storageReady = false
MyProvider: all phases = { configReady: true, storageReady: false, ... }
MyProvider: storageReady = true
MyProvider: all phases = { configReady: true, storageReady: true, ... }
```

### 2. Verify Hook Usage

Test the `usePhaseReady` hook directly:

```typescript
// Add to any component temporarily
function DebugComponent() {
  const configReady = usePhaseReady('configReady');
  const storageReady = usePhaseReady('storageReady');
  const servicesReady = usePhaseReady('servicesReady');

  return (
    <View>
      <Text>Config: {configReady ? '✅' : '⏳'}</Text>
      <Text>Storage: {storageReady ? '✅' : '⏳'}</Text>
      <Text>Services: {servicesReady ? '✅' : '⏳'}</Text>
    </View>
  );
}
```

### 3. Check Provider Mounting

Verify providers are mounted in the correct order:

```typescript
// In app/_layout.tsx - add temporary logging
console.log('Mounting AppParamsStableProvider');
<AppParamsStableProvider>
  {console.log('AppParamsStableProvider mounted')}
  {/* ... */}
</AppParamsStableProvider>
```

### 4. Monitor Kernel State

Access full kernel state for debugging:

```typescript
const kernel = useKernel();

useEffect(() => {
  console.log('Kernel state:', {
    phases: kernel.phases,
    timing: kernel.timing,
    error: kernel.error
  });
}, [kernel.phases, kernel.error]);
```

### 5. Test Phase Dependencies

Create a test component to verify phase relationships:

```typescript
function PhaseDebugger() {
  const allPhases = useKernel().phases;

  // Check that phases complete in order
  const phaseOrder = ['configReady', 'preloadReady', 'networkReady',
                     'storageReady', 'servicesReady', 'authReady', 'appReady'];

  const violations = [];
  for (let i = 1; i < phaseOrder.length; i++) {
    const prev = phaseOrder[i-1];
    const curr = phaseOrder[i];
    if (allPhases[curr] && !allPhases[prev]) {
      violations.push(`${curr} completed before ${prev}`);
    }
  }

  return (
    <View>
      {violations.map(v => <Text key={v}>❌ {v}</Text>)}
      {violations.length === 0 && <Text>✅ Phase order correct</Text>}
    </View>
  );
}
```

## Performance Considerations

### Phase Timing Expectations

- **Fast phases** (< 50ms): config, network, storage, services, job_setup
- **Medium phases** (100-500ms): preload
- **Slow phases** (500-1000ms): auth
- **Variable phases**: sync (depends on data volume)

### Optimization Tips

1. **Batch operations**: If multiple providers need the same phase, they all unblock simultaneously
2. **Lazy loading**: Use phase gates to defer expensive operations
3. **Loading states**: Use LoadingContext for operations that take time
4. **Error boundaries**: Wrap phase-dependent providers in error boundaries

### Monitoring Performance

```typescript
// Track how long your provider takes to initialize
useEffect(() => {
  if (servicesReady) {
    const start = Date.now();
    initializeProvider().finally(() => {
      console.log(`Provider initialized in ${Date.now() - start}ms`);
    });
  }
}, [servicesReady]);
```

## Error Handling

### Phase Failures

If a phase fails, dependent providers won't run:

```typescript
function ApiProvider({ children }) {
  const servicesReady = usePhaseReady('servicesReady');
  const kernel = useKernel();

  // Check for kernel errors
  if (kernel.error) {
    return <ErrorFallback error={kernel.error} />;
  }

  useEffect(() => {
    if (servicesReady) {
      // Phase succeeded, safe to initialize
      initializeApi();
    }
  }, [servicesReady]);

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}
```

### Provider Initialization Failures

Handle provider-specific errors:

```typescript
function DataProvider({ children }) {
  const storageReady = usePhaseReady('storageReady');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (storageReady) {
      loadData().catch(err => {
        setError(err);
        // Could notify kernel to enter safe mode
      });
    }
  }, [storageReady]);

  if (error) {
    return <ProviderErrorFallback error={error} />;
  }

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}
```

## Migration from Legacy Patterns

### Before: Implicit Dependencies

```typescript
// Old way - scattered checks
useEffect(() => {
  if (isAuthConfigured() && storage.isInitialized()) {
    loadUserData();
  }
}, []);
```

### After: Explicit Phase Gates

```typescript
// New way - clear dependencies
const servicesReady = usePhaseReady('servicesReady');

useEffect(() => {
  if (servicesReady) {
    loadUserData();
  }
}, [servicesReady]);
```

### Benefits of Migration

- **Clarity**: Dependencies are explicit and documented
- **Reliability**: No race conditions or timing issues
- **Debugging**: Easy to see why providers aren't initializing
- **Testing**: Can mock phase completion in tests
- **Performance**: Automatic batching when phases complete