# Kernel Module

Centralized application bootstrap and lifecycle management. Orchestrates startup phases (configuration, preload, network, storage, services, auth) into single explicit contract. Ensures all critical systems initialized before rendering main UI. Provides real-time phase tracking and recovery mechanisms.

## When to Use This Module

**Use this module to:**

- Initialize the app during startup (one-time orchestration of all systems)
- Wait for specific bootstrap phases before rendering UI (`kernel.phases.appReady`)
- Check platform capabilities (Supabase available? Network online? Storage migrated?)
- Load non-critical fonts on-demand via `loadLazyFont()`
- Track app readiness state and handle initialization errors
- Monitor initialization timing for performance diagnostics

**Do NOT use this module for:**

- Recurring state management (use React Context instead)
- Per-screen initialization (bootstrap happens once; use hooks per-screen)
- Manual phase advancement (phases progress automatically)

## Architecture & Data Flow

```
App Startup
        ↓
AppKernelProvider mounted
        ↓
AppKernel.initialize() starts
        ├─ CONFIG: Load env vars, init Supabase client (MUST run first)
        ├─ PRELOAD: Load critical fonts/images (<500ms target)
        ├─ NETWORK: Initialize network detection & online status (before storage for offline awareness)
        ├─ STORAGE: Validate & migrate cache (knows network status)
        ├─ SERVICES: Register auth provider, error tracker, analytics exporter (blocking, MUST be before AUTH)
        ├─ AUTH: Restore session, initialize auth state (non-blocking, provider already registered)
        └─ READY: Critical systems initialized, safe to render UI (auth completing in background)
        ↓
Post-READY (non-critical, async):
        ├─ Feature Flags: Bootstrap from server, sync to legacy system
        └─ Analytics: Track bootstrap metrics
        ↓
UI renders with kernel.phases.appReady = true
```

**Key Principles:**

- **Single Source of Truth**: One kernel instance; all consumers subscribe to same state
- **Explicit Phases**: Clear progression; consumers know what's initialized
- **Services Before Auth**: Services (auth provider, error tracker) registered synchronously before AUTH phase starts, eliminating the race condition
- **Network Awareness**: Storage knows network status for intelligent offline fallback
- **Non-Blocking Auth**: AUTH completes in background - appReady is set immediately after auth begins (but provider is guaranteed registered)
- **Error Recovery**: Critical failures accessible via `kernel.error`; retry via `AppKernel.retry()`
- **Timing Tracking**: Each phase duration measured in `kernel.timing`
- **Observable**: Kernel state broadcast to all subscribers on change

## API Reference

### AppKernel Singleton

#### `AppKernel.initialize(): Promise<void>`

Initializes kernel. Safe to call multiple times—only initializes once (idempotent).

```typescript
await AppKernel.initialize();
// App now in CONFIG → PRELOAD → NETWORK → STORAGE → SERVICES → AUTH → READY or ERROR
```

#### `AppKernel.getState(): AppKernelState`

Returns current kernel state snapshot (no subscription).

```typescript
const state = AppKernel.getState();
console.log(state.currentPhase); // "READY", "CONFIG", etc.
console.log(state.phases.appReady); // boolean
console.log(state.error); // null or KernelError
console.log(state.capabilities); // { storage, network, auth, backend, platform }
console.log(state.timing); // { config: 125, preload: 450, ... } in ms
```

#### `AppKernel.subscribe(callback): () => void`

Subscribe to kernel state changes. Called on phase change, timing update, error, etc.

```typescript
const unsubscribe = AppKernel.subscribe((state) => {
  if (state.phases.appReady) {
    console.log("App is ready!");
  }
});

unsubscribe(); // Stop listening
```

#### `AppKernel.retry(): Promise<void>`

Retry initialization if recoverable error occurred.

```typescript
if (kernel.error?.recoverable) {
  await AppKernel.retry();
}
```

### React Hooks & Context

#### `AppKernelProvider`

Provider component. Must wrap entire app at root level (`app/_layout.tsx`).

```typescript
export default function RootLayout() {
  return (
    <AppKernelProvider>
      <YourApp />
    </AppKernelProvider>
  );
}
```

#### `useAppKernel(): AppKernelState`

Access kernel state. Must be called within `AppKernelProvider`.

```typescript
const kernel = useAppKernel();
if (!kernel.phases.appReady) {
  return <LoadingScreen />;
}
```

#### `useAppReady(): boolean`

Shorthand. Returns true if app ready to render main UI.

```typescript
const isReady = useAppReady();
```

#### `usePhaseReady(phase: string): boolean`

Check if a specific phase is complete (type-safe).

```typescript
const authReady = usePhaseReady("authReady");
const storageReady = usePhaseReady("storageReady");
```

### Font Loading

#### `loadLazyFont(fontName: string): Promise<void>`

Load non-critical font on-demand. Safe to call multiple times (deduplicates).

```typescript
import { loadLazyFont } from "@/lib/kernel";

useEffect(() => {
  loadLazyFont("Cyberpunk").catch(err => console.warn("Font load failed"));
}, []);
```

### State Interfaces

#### `AppKernelState`

```typescript
interface AppKernelState {
  currentPhase: "idle" | "config" | "preload" | "storage" | "network" | "auth" | "ready" | "error";
  
  phases: {
    configReady: boolean;      // Supabase client initialized
    preloadReady: boolean;     // Fonts/images preloaded
    storageReady: boolean;     // Storage validated & migrated
    networkReady: boolean;     // Network detection initialized
    authReady: boolean;        // Session restored (non-blocking)
    appReady: boolean;         // All critical phases done
  };
  
  error: KernelError | null;   // Phase failure details
  timing: Record<string, number>; // Duration (ms) of each phase
  capabilities: {             // Platform/feature availability
    storage: boolean;
    network: boolean;
    auth: boolean;
    backend: boolean;
    platform: "web" | "ios" | "android" | "desktop" | "unknown";
  };
}
```

#### `KernelError`

Detailed error information.

```typescript
interface KernelError {
  code: string;               // Specific error type (CONFIG_FAILED, PRELOAD_FAILED, etc.)
  name: string;               // Error name
  message: string;            // User-friendly message
  phase: string;              // Which phase failed
  recoverable: boolean;       // Can AppKernel.retry() recover?
  timestamp: number;          // When error occurred (ms)
}
```

## Dependencies

### External Packages

- **`expo-font`** – Font loading (preload critical, lazy load others)
- **`expo-network`** – Network detection (online/offline)
- **`expo-constants`** – Environment variables

### Internal Dependencies

- **`lib/config`** – Config validation (CONFIG phase)
- **`lib/database`** – Supabase client (CONFIG phase)
- **`lib/storage`** – Storage validation & cache migrations (STORAGE phase)
- **`lib/auth`** – Session restoration (AUTH phase, non-blocking)
- **`lib/network`** – Network detection (NETWORK phase)
- **`lib/utils/logger`** – Bootstrap logging
- **`lib/analytics`** – Performance tracking

## Error Handling & Edge Cases

### Config Phase Failure (Supabase Not Configured)

If Supabase credentials missing, app gracefully degrades:

```typescript
kernel.error = {
  code: "CONFIG_FAILED",
  message: "Supabase is not configured",
  recoverable: true, // Can retry
};
// App continues with offline-only mode
```

### Auth Restoration Timeout

Auth phase is non-blocking; app ready even if auth timeout:

```typescript
// If session restoration takes >5s:
// - phases.authReady = true (even if session not found)
// - User redirected to login on first route guard
```

### Preload Timeout (Fonts Take >500ms)

Fonts load non-blockingly; app proceeds with fallback fonts:

```typescript
// After 500ms if fonts not ready:
// - Preload phase completes (success)
// - Fonts continue loading in background
// - UI renders with fallback fonts initially
```

### Storage Migration Failure

If cache migration fails, app can retry or reset:

```typescript
// Option 1: Retry migration
await AppKernel.retry();

// Option 2: Reset storage (user loses cached data)
await SecureStorage.clear();
```

## Performance Notes

### Initialization Timeline

- **CONFIG**: 100-150ms (env var setup, Supabase init)
- **PRELOAD**: 300-500ms (critical font loading)
- **STORAGE**: 50-100ms (validation + migrations)
- **NETWORK**: <10ms (event subscription)
- **AUTH**: 500-1000ms (session restoration, runs in parallel)
- **Total to READY**: ~500-600ms (AUTH overlaps other phases)

### Optimization Tips

- Load critical fonts in PRELOAD phase only
- Use `loadLazyFont()` for specialty fonts (Cyberpunk, Eurostile)
- Keep storage migrations fast (<50ms)
- Don't block READY on AUTH phase (non-blocking by design)
- Monitor `kernel.timing` for performance regressions

## Related Modules

- **`lib/config`** – Configuration validation
- **`lib/database`** – Supabase client initialization
- **`lib/storage`** – Local data persistence and migrations
- **`lib/auth`** – Session management
- **`lib/network`** – Network detection and connectivity
- **`lib/feature-flags`** – Initialized after READY phase
- **`lib/error`** – Runtime error handling (separate from bootstrap)
- **`lib/utils/logger`** – Bootstrap diagnostics

## File Breakdown

| File | Purpose |
| --- | --- |
| `app-kernel.ts` (500+ lines) | Core kernel class (phases, state, error handling, subscribers) |
| `use-app-kernel.tsx` | React integration (provider, hooks) |
| `lazy-fonts.ts` | On-demand font loading (deduplication, concurrent load prevention) |
| `storage-defaults.ts` | Storage initialization defaults for all keys |
| `index.ts` | Barrel export of public API |
