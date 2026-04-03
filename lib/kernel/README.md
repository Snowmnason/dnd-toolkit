# Kernel Module

Centralized application bootstrap and lifecycle management. Orchestrates startup phases (config, preload, network, storage, services, job_setup, auth, feature_flags, registration) into single explicit contract. Ensures all critical systems initialized before rendering main UI. Provides real-time phase tracking, capability monitoring, and recovery mechanisms.

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
        ↓
System bootstrap phases execute (config → preload/network/storage → services → auth → feature_flags → registration → ready)
        ↓
Post-READY (non-critical, async):
        └─ Analytics: Track bootstrap metrics
        └─ Degradation: Monitor capability states
        ↓
UI renders with kernel.phases.appReady = true
```

**Key Principles:**

- **Single Source of Truth**: One kernel instance; all consumers subscribe to same state
- **Phase-Based Readiness**: UI waits for specific system readiness phases
- **Orchestration Layer**: Coordinates between system bootstrap and React UI
- **Error Recovery**: Critical failures accessible via `kernel.error`; retry via `AppKernel.retry()`
- **Observable**: Kernel state broadcast to all subscribers on change

## API Reference

### AppKernel Singleton

#### `AppKernel.initialize(): Promise<void>`

Initializes kernel. Safe to call multiple times—only initializes once (idempotent).

```typescript
await AppKernel.initialize();
// System bootstrap phases execute, app becomes ready for UI rendering
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
  currentPhase: KernelPhase;  // Current bootstrap phase
  
  phases: {
    configReady: boolean;     // Environment setup complete
    preloadReady: boolean;    // Critical assets loaded
    networkReady: boolean;    // Network detection initialized
    storageReady: boolean;    // Storage system ready
    servicesReady: boolean;   // Services registered
    jobSetupReady: boolean;   // Job queue initialized
    authReady: boolean;       // Auth session restored
    appReady: boolean;        // All systems ready for UI
  };
  
  error: KernelError | null;  // Bootstrap failure details
  timing: Record<string, number>; // Phase duration tracking
  capabilities: KernelCapabilities; // Platform capabilities
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

## Loading Context for UI Blocking

The Loading Context provides a centralized way to show loading states and block UI during long-running operations. Unlike phase-based blocking (which waits for system initialization), this is for user-initiated operations that need visual feedback.

### When to Use

**Use UIBlockerLayer for:**
- Kernel initialization (bootstrap loading screen)
- Navigation transitions (route changes)
- Storage operations (large data saves/loads)
- Service calls (analytics export, error reporting)
- Any operation >500ms that needs user feedback

**Do NOT use for:**
- Automatic system initialization (use phases instead)
- Quick operations (<100ms)
- Background tasks (no UI blocking needed)

### API

```typescript
import { useUIBlocker } from "@/components";

// Get current loading state
const { isLoading, message, progress, title, subtitle } = useUIBlocker();

// Set loading state (blocks UI)
setLoading(true); // Simple loading
setLoading({ 
  message: "Saving world data...",
  progress: 50, // 0-100
  title: "Please wait",
  subtitle: "Processing..."
});

// Clear loading state
setLoading(false);
```

### Integration with Kernel

The UIBlockerLayer works alongside kernel phases:

```typescript
// During kernel initialization
if (!kernel.phases.appReady) {
  setLoading({
    message: "Initializing app...",
    progress: 30
  });
}

// After kernel ready, clear loading
setLoading(false);
```

### Provider Setup

UIBlockerLayer wraps the app tree (after ThemeProvider, before content):

```typescript
// app/_layout.tsx
<AppKernelProvider>
  <ThemeProvider>
    <UIBlockerLayer>
      {/* App content */}
    </UIBlockerLayer>
  </ThemeProvider>
</AppKernelProvider>
```

## Phase-Aware Provider Pattern

Context providers that depend on kernel phases should explicitly wait for those phases before initializing. This prevents race conditions and ensures providers have access to required systems.

### When to Use vs. When to Skip

**Use phase-aware pattern for providers that:**
- Access storage, services, or auth systems
- Need Supabase client, network status, or cached data
- Have effects that run once on mount
- Could cause errors if systems aren't ready

**Skip phase-aware pattern for providers that:**
- Only provide static configuration (colors, dimensions)
- Have no effects or async operations
- Don't depend on any external systems
- Are pure React context (no side effects)

### Decision Tree

```
Does provider access external systems?
├── YES → Use phase-aware pattern
│   ├── Storage access? → Wait for "storageReady"
│   ├── Services/Auth access? → Wait for "servicesReady"
│   └── Network-only? → Wait for "networkReady"
└── NO → Skip phase-aware pattern
    └── Pure config/theme? → No phase gate needed
```

### Available Phases

- **`configReady`** – Environment variables loaded, Supabase client initialized
- **`preloadReady`** – Critical fonts/images loaded
- **`networkReady`** – Network detection initialized
- **`storageReady`** – Storage validated and migrated
- **`servicesReady`** – Auth provider, error tracker, analytics registered
- **`jobSetupReady`** – Job queue initialized and handlers registered
- **`authReady`** – Session restored (non-blocking)
- **`appReady`** – All critical systems initialized

### Before/After Examples

**Before (implicit gate - race condition prone):**

```typescript
// ❌ Race condition: runs before storage ready
useEffect(() => {
  const theme = SecureStorage.get(THEME_KEY);
  setTheme(theme);
}, []); // No dependencies - runs immediately
```

**After (explicit phase gate):**

```typescript
// ✅ Explicit gate: waits for storage
const storageReady = usePhaseReady("storageReady");

useEffect(() => {
  if (!storageReady) return; // Wait for phase
  
  const theme = SecureStorage.get(THEME_KEY);
  setTheme(theme);
}, [storageReady]); // Explicit dependency
```

### Concrete Provider Example

```typescript
export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const storageReady = usePhaseReady("storageReady");

  useEffect(() => {
    if (!storageReady) return; // Wait for storage phase

    // Safe to access storage now
    const savedTheme = SecureStorage.get(THEME_KEY);
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [storageReady]); // Re-run when storage ready

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### Checklist for Adding Phase-Aware Provider

- [ ] Identify required systems (storage? services? network?)
- [ ] Map systems to kernel phases
- [ ] Add `usePhaseReady(phase)` hook call
- [ ] Gate all effects with phase check
- [ ] Add phase to effect dependencies
- [ ] Test provider initializes correctly after phase completes
- [ ] Verify no race conditions during app startup

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

## Related Modules

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
