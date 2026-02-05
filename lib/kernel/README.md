# lib/kernel

Centralized application bootstrap and lifecycle management. Orchestrates all startup phases (configuration, preload, storage, network, auth) into a single explicit contract. Ensures app is fully initialized before rendering main UI and provides real-time phase tracking to all consumers.

## When to Use This Module

**Use this module to:**

- Initialize the app during startup (one-time setup orchestrated across all systems)
- Wait for specific bootstrap phases before rendering UI (via `kernel.phases.appReady`, `supabaseReady`, etc.)
- Access platform capabilities and readiness status (Supabase available? Network online? Storage migrated?)
- Load non-critical fonts on-demand via [lib/utils's web-font-loader](../utils/README.md) to avoid blocking bootstrap
- Track app readiness state and handle initialization errors gracefully
- Manage storage defaults and run [lib/storage's cache migrations](../storage/README.md) during startup
- Monitor initialization timing for performance optimization and diagnostics

**Do NOT use this module for:**

- Recurring state management (use React Context or [lib/storage's SecureStorage](../storage/README.md) instead)
- Per-screen initialization (bootstrap happens once at app launch; per-screen use hooks)
- Replacing error boundaries (use error boundaries and [lib/error](../error/README.md) for runtime crashes)
- Manual phase advancement (phases progress automatically; subscribe to changes instead)
- App configuration (use [lib/config](../config/README.md) instead)

## Architecture & Data Flow

```
App Startup
        ↓
AppKernelProvider mounted (root level)
        ↓
AppKernel.initialize() starts (one-time)
        ↓
Phase: CONFIG
  - Load environment variables (Supabase URL, API keys)
  - Initialize Supabase client
  - Validate config via lib/config
        ↓
Phase: PRELOAD
  - Load critical fonts (via expo-font)
  - Load critical images/assets
  - Target: <500ms to avoid splash screen overlap
        ↓
Phase: STORAGE
  - Validate cached data structure
  - Run cache migrations (lib/storage cache-versioning)
  - Initialize storage defaults (STORAGE_DEFAULTS)
        ↓
Phase: NETWORK
  - Initialize network detection (expo-network)
  - Subscribe to online/offline events
  - Detect current network status
        ↓
Phase: AUTH (non-blocking)
  - Restore user session from SecureStorage
  - Check if authenticated
  - Load cached user profile
  - Runs in parallel with other phases
        ↓
Phase: READY
  - All critical phases complete
  - App safe to render main UI
  - UI can now call useAppKernel() and check kernel.phases.appReady
        ↓
Post-READY: Feature Flags (non-blocking)
  - Initialize FeatureFlagsManager with Supabase client + userId (if available)
  - Verify device clock validity
  - Bootstrap flags from server (one-time fetch)
  - Bridge: Sync legacy FeatureFlags with server values
  - Bridge: Reconfigure Logger to respect remote debugLogs flag
```

**Key Principles:**

- **Single Source of Truth**: One kernel instance; all consumers subscribe to same state
- **Explicit Phases**: Clear progression through defined stages; consumers know what's done
- **Non-Blocking Auth**: Auth phase doesn't block app readiness; fetch happens in background
- **Error Recovery**: Critical phase failures don't crash app; accessible via kernel.error
- **Timing Tracking**: Each phase duration measured and accessible for diagnostics
- **Observable**: Kernel state broadcast to all subscribers on every state change
- **Platform Detection**: Capabilities (storage, network, backend) tracked and accessible

## API Reference

### `AppKernel` Singleton

Main kernel instance. Manages all bootstrap phases.

#### `AppKernel.initialize(): Promise<void>`

Initializes the kernel. Safe to call multiple times—only initializes once (idempotent).

```ts
import { AppKernel } from "@/lib/kernel";

await AppKernel.initialize();
// App is now in one of: CONFIG → PRELOAD → STORAGE → NETWORK → READY
// Or ERROR if a critical phase failed
```

**Lifecycle:**

- First call starts initialization
- Subsequent calls return same promise
- Initialization is one-time, never repeats
- Safe to await from multiple places simultaneously

#### `AppKernel.getState(): AppKernelState`

Returns current kernel state without subscribing (snapshot).

```ts
const state = AppKernel.getState();
console.log(state.currentPhase); // "READY", "CONFIG", etc.
console.log(state.phases.appReady); // true/false
console.log(state.error); // null or KernelError
console.log(state.capabilities); // { storage, network, auth, backend, platform }
console.log(state.timing); // { config: 125, preload: 450, storage: 50, ... }
```

**Returns:** `AppKernelState` object (see State Interface section)

#### `AppKernel.subscribe(callback: (state: AppKernelState) => void): () => void`

Subscribes to kernel state changes. Called whenever kernel state updates (phase change, timing update, error, etc.).

```ts
const unsubscribe = AppKernel.subscribe((state) => {
  console.log(`Phase: ${state.currentPhase}`);
  if (state.phases.appReady) {
    console.log("App is ready!");
  }
});

// Later: stop listening
unsubscribe();
```

**Returns:** Unsubscribe function

#### `AppKernel.retry(): Promise<void>`

Retries initialization if a recoverable error occurred. Useful for handling temporary network failures during config/auth phase.

```ts
if (kernel.error && kernel.error.recoverable) {
  console.log("Retrying initialization...");
  await AppKernel.retry();
}
```

---

### React Hooks & Context

#### `AppKernelProvider`

Provider component. Must wrap entire app at root level (in `app/_layout.tsx`).

```tsx
import { AppKernelProvider } from "@/lib/kernel";

export default function RootLayout() {
  return (
    <AppKernelProvider>
      <YourApp />
    </AppKernelProvider>
  );
}
```

**Side Effects:**

- Initializes kernel once on mount
- Subscribes to state changes
- Re-renders all consumers when state changes

#### `useAppKernel(): AppKernelState`

Hook to access kernel state. Must be called within `AppKernelProvider`.

```ts
import { useAppKernel } from '@/lib/kernel';

export function MyComponent() {
  const kernel = useAppKernel();

  if (!kernel.phases.appReady) {
    return <LoadingScreen />;
  }

  return <MainApp />;
}
```

**Throws:** Error if called outside AppKernelProvider

#### `useAppReady(): boolean`

Shorthand hook. Returns true if app is ready to render main UI (phase = READY).

```ts
const isReady = useAppReady();
return isReady ? <MainApp /> : <SplashScreen />;
```

#### `usePhaseReady(phase: keyof AppKernelState['phases']): boolean`

Check if a specific phase is complete. Type-safe (TypeScript enforces valid phase names).

```ts
const authReady = usePhaseReady("authReady");
const storageReady = usePhaseReady("storageReady");

// Compile error: usePhaseReady('invalidPhase');
```

---

### State Interfaces

#### `AppKernelState`

Complete kernel state object.

```ts
interface AppKernelState {
  currentPhase: KernelPhase; // Current phase: "idle" | "config" | "preload" | "storage" | "network" | "auth" | "ready" | "error"

  phases: {
    configReady: boolean; // Config loaded & Supabase client initialized
    preloadReady: boolean; // Fonts & images preloaded
    storageReady: boolean; // Storage validated & migrated
    networkReady: boolean; // Network detection initialized
    authReady: boolean; // Session restored (non-blocking)
    appReady: boolean; // All critical phases done, safe to render UI
  };

  error: KernelError | null; // null if no error; populated if phase fails

  timing: Record<string, number>; // Duration (ms) of each phase
  // Example: { config: 125, preload: 450, storage: 50 }

  capabilities: KernelCapabilities; // Platform/feature availability

  networkStatus: NetworkStatus | null; // Current network state (online/offline/unknown)
}
```

#### `KernelCapabilities`

Platform and feature availability detected during bootstrap.

```ts
interface KernelCapabilities {
  storage: boolean; // SecureStorage working (encryption available)
  network: boolean; // Network detection available
  auth: boolean; // Auth system available
  analytics: boolean; // Analytics tracking enabled
  backend: boolean; // Supabase configured & accessible
  platform: "web" | "ios" | "android" | "desktop" | "unknown";
}
```

#### `KernelPhase`

Enumerated bootstrap phases.

```ts
enum KernelPhase {
  IDLE = "idle", // Not started
  CONFIG = "config", // Loading env vars, initializing Supabase
  PRELOAD = "preload", // Loading fonts & critical assets
  STORAGE = "storage", // Storage validation & migrations
  NETWORK = "network", // Network detection setup
  AUTH = "auth", // Session restoration (non-blocking)
  READY = "ready", // All critical phases done
  ERROR = "error", // A critical phase failed
}
```

#### `KernelError`

Detailed error information for phase failures.

```ts
interface KernelError extends Error {
  code: KernelErrorCode; // Specific error type: CONFIG_FAILED, PRELOAD_FAILED, etc.
  name: string; // Error name (e.g., "TypeError")
  message: string; // User-friendly error message
  phase: KernelPhase; // Which phase failed
  originalError?: Error; // Original thrown error (if wrapped)
  recoverable: boolean; // Can AppKernel.retry() recover from this?
  timestamp: number; // When error occurred (milliseconds since epoch)
}
```

---

### Font Loading

#### `loadLazyFont(fontName: LazyFontName): Promise<void>`

Load a non-critical font on-demand. Fonts are loaded asynchronously without blocking app.

```ts
import { loadLazyFont } from "@/lib/kernel";

// In a component that needs Cyberpunk font:
useEffect(() => {
  loadLazyFont("Cyberpunk").catch((err) => {
    console.warn("Failed to load Cyberpunk font", err);
  });
}, []);
```

**Safe to call:**

- Multiple times (deduplicates)
- From multiple places (coalesces concurrent loads)
- Before/after kernel ready (non-blocking)

#### `lazyFonts: Record<string, require>`

Registry of lazy-loadable fonts. Add new fonts here:

```ts
export const lazyFonts = {
  Cyberpunk: require("../../assets/fonts/Cyberpunk.ttf"),
  Eurostile: require("../../assets/fonts/Eurostile.ttf"),
} as const;
```

#### `type LazyFontName`

Type-safe font name. TypeScript enforces valid font names.

```ts
// ✅ Compiles
loadLazyFont("Cyberpunk");

// ❌ Compile error
loadLazyFont("InvalidFont");
```

---

### Storage Defaults

#### `STORAGE_DEFAULTS: Record<string, StorageDefaultValue>`

Centralized storage key defaults. Used during storage phase initialization.

```ts
export const STORAGE_DEFAULTS = {
  [STORAGE_KEYS.CONNECTED_WORLDS]: JSON.stringify([]),
  [STORAGE_KEYS.HAS_ACCOUNT]: JSON.stringify(false),
  [STORAGE_KEYS.THEME_MODE]: JSON.stringify("dark"),
  // ... more keys
};
```

**Format:**

- **Value is string**: JSON-serialized default; initialized on first boot
- **Value is null**: Key is optional; not initialized (absent from storage until first use)

#### `getStorageDefault(key: string): StorageDefaultValue`

Get default value for a storage key.

```ts
const defaultWorlds = getStorageDefault(STORAGE_KEYS.CONNECTED_WORLDS);
// Returns: "[]" (JSON string) or null
```

#### `shouldInitializeStorageKey(key: string): boolean`

Check if a storage key should be initialized at startup.

```ts
if (shouldInitializeStorageKey(STORAGE_KEYS.USER_DATA)) {
  // Initialize this key during storage phase
}
```

#### `getRequiredStorageKeys(): string[]`

Get all storage keys that should be initialized (values !== null).

```ts
const requiredKeys = getRequiredStorageKeys();
// Returns: [STORAGE_KEYS.CONNECTED_WORLDS, STORAGE_KEYS.HAS_ACCOUNT, ...]
```

---

## Dependencies

### External Packages

- **`expo-font`** – Font loading (preload critical fonts, lazy load others)
- **`expo-network`** – Network detection (online/offline status)
- **`expo-constants`** – Environment variables (Supabase config)

### Internal Dependencies

- **`lib/config`** – Config validation during CONFIG phase
- **`lib/database` (Supabase)** – Supabase client initialization
- **`lib/storage` (SecureStorage)** – Storage validation during STORAGE phase
- **`lib/auth` (AuthStateManager)** – Session restoration during AUTH phase
- **`lib/cache`** – Cache validation and migrations
- **`lib/utils/logger`** – Bootstrap logging (bootstrap category)
- **`lib/network`** – Network detection integration
- **`lib/analytics`** – Performance tracking (phase timing)

---

## Error Handling & Edge Cases

### Config Phase Failure (Supabase Not Configured)

If Supabase credentials missing, app gracefully degrades:

```ts
kernel.error = {
  code: KernelErrorCode.CONFIG_FAILED,
  message: "Supabase is not configured",
  phase: KernelPhase.CONFIG,
  recoverable: true, // Can retry
};

// App continues with offline-only mode
// Can retry: await AppKernel.retry();
```

### Preload Timeout (Fonts Take >500ms)

If fonts load slowly, app proceeds anyway (non-blocking):

```ts
// After 500ms, if fonts not ready:
// - Preload phase completes (success)
// - Fonts continue loading in background
// - UI renders with fallback fonts initially
// - Fonts appear when ready
```

### Storage Migration Failure

If cache migration fails, app can retry or reset:

```ts
kernel.error = {
  code: KernelErrorCode.STORAGE_MIGRATION_FAILED,
  recoverable: true,
};

// Option 1: Retry migration
await AppKernel.retry();

// Option 2: Reset storage to defaults (user loses cached data)
// Call from component: await SecureStorage.clear();
```

### Auth Restoration Timeout

Auth phase is non-blocking; app ready even if auth not restored:

```ts
// If session restoration takes >5s:
// - Auth phase still completes
// - phases.authReady = true (even if session not found)
// - User redirected to login on first route guard check
// - Can retry: await AuthStateManager.restoreSession();
```

### Network Detection Unavailable

If expo-network not available (rare), app continues:

```ts
kernel.capabilities.network = false;
// App proceeds with offline mode
// No real-time online/offline detection
```

---

## Performance Notes

### Initialization Timeline

- **CONFIG phase**: 100-150ms (env var setup, Supabase init)
- **PRELOAD phase**: 300-500ms (critical font loading)
- **STORAGE phase**: 50-100ms (validation + migrations)
- **NETWORK phase**: <10ms (event subscription)
- **AUTH phase**: 500-1000ms (session restoration, runs in parallel)
- **Total**: ~500-600ms to READY (AUTH overlaps other phases)

### Optimization Tips

- Load critical fonts in PRELOAD phase only
- Use lazy fonts for specialty fonts (Cyberpunk, Eurostile)
- Keep storage migrations fast (<50ms)
- Don't block READY on AUTH phase (non-blocking)
- Monitor phase timing via kernel.timing for regressions

### Memory Usage

- Kernel state: ~1KB (small object)
- Listeners: O(n) where n = subscriber count (typically 5-10)
- Font cache: ~500KB (depends on font size)

---

## Related Modules

- **`lib/config`** – Configuration validation and loading
- **`lib/database` (Supabase)** – Backend initialization
- **`lib/storage` (SecureStorage)** – Local data persistence
- **`lib/auth` (AuthStateManager)** – Session management
- **`lib/network`** – Network detection and connectivity
- **`lib/utils/logger`** – Bootstrap diagnostics
- **`lib/error` (AppErrorBoundary)** – Runtime error handling
- **`lib/analytics`** – Performance and event tracking

---

## File Breakdown

| File                  | Purpose                                                                                                                                            | Exports                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `app-kernel.ts`       | Core kernel class. Manages bootstrap phases, state tracking, error handling, subscriber notifications. Singleton instance exported as `AppKernel`. | `AppKernel`, `KernelPhase`, `KernelErrorCode`, `AppKernelState`, `KernelCapabilities`, `KernelError`  |
| `use-app-kernel.tsx`  | React integration. Provider component for context, hooks for state access and phase checking.                                                      | `AppKernelProvider`, `useAppKernel()`, `useAppReady()`, `usePhaseReady()`                             |
| `lazy-fonts.ts`       | On-demand font loading. Registry of non-critical fonts with deduplication and concurrent load prevention.                                          | `loadLazyFont()`, `lazyFonts`, `LazyFontName`                                                         |
| `storage-defaults.ts` | Storage initialization defaults. Centralized definition of default values for all storage keys; used during STORAGE phase.                         | `STORAGE_DEFAULTS`, `getStorageDefault()`, `shouldInitializeStorageKey()`, `getRequiredStorageKeys()` |
| `index.ts`            | Barrel export for public API                                                                                                                       | All exports from app-kernel, use-app-kernel, lazy-fonts, storage-defaults                             |

---

## Testing

Currently, no dedicated test guide exists. When adding tests, create a guide at `docs/A Testing Guide/kernel.md` following the repository's testing guide template.

**Manual testing tips:**

- **Phase Progression**: Verify phases advance in order (CONFIG → PRELOAD → STORAGE → NETWORK → AUTH, READY)
- **Idempotent Init**: Call `AppKernel.initialize()` multiple times; verify only happens once
- **Error Recovery**: Force CONFIG error, verify `kernel.error.recoverable = true`, retry succeeds
- **Non-Blocking Auth**: Disable network, verify APP reaches READY without waiting for AUTH completion
- **Timing Tracking**: Check `kernel.timing` shows reasonable phase durations (<1s each)
- **Lazy Font Loading**: Call `loadLazyFont()` twice concurrently; verify only loads once
- **Storage Defaults**: Check SecureStorage initialized with STORAGE_DEFAULTS on first boot

---

## Future Enhancements
