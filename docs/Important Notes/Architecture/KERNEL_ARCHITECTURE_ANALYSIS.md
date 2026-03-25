# Kernel Architecture Analysis

## Summary

The dnd-toolkit uses a **clearly structured manager → hook pattern** for the kernel. The architecture follows the app's golden rule: Components only import from hooks/components (never from lib/ or system/).

### Quick Answer to Your Questions

1. ✅ **lib/kernel/** contains: `kernel-manager.ts`, `lazy-fonts.ts`, `README.md`, `index.ts`
2. ✅ **hooks/kernel/** contains: `use-app-kernel.tsx`, `use-kernel-loading-sync.tsx`, `useKernelError.ts`, `README.md`, `index.ts`
3. ✅ **Main kernel location**: `system/Kernel/app-kernel.ts` (system layer) wrapped by `lib/kernel/kernel-manager.ts`
4. ✅ **UIBlocker sync is already implemented** via `useKernelLoadingSync()` hook
5. ✅ **Proper architecture**: Manager (lib/) → Hook (hooks/) → UI Component pattern
6. ✅ **Where to add phase progress**: A new `useKernelPhaseProgress()` hook in `hooks/kernel/`

---

## Architecture Deep Dive

### Layer Structure

```
Components/Screens (app/, Screens/)
        ↓ (import only from)
React Hooks (hooks/kernel/)
        ↓ (calls)
Manager (lib/kernel/kernel-manager.ts)
        ↓ (delegates to via dynamic import)
System (system/Kernel/app-kernel.ts)
        ↓ (executes phases sequentially)
Phase Functions (system/Kernel/phases/)
        ↓ (calls back to)
lib/* modules (auth, network, storage, etc.)
```

### File Locations

#### **system/Kernel/** (Pure System Layer)
```
system/Kernel/
├── app-kernel.ts          # Core AppKernel class - state machine + phase orchestration
├── phases/                 # Individual phase implementations
│   ├── auth-phase.ts
│   ├── config-phase.ts
│   ├── job-setup-phase.ts
│   ├── network-phase.ts
│   ├── preload-phase.ts
│   ├── services-phase.ts
│   └── storage-phase.ts
├── index.ts               # Exports AppKernel singleton
└── README.md              # System-layer documentation
```

**Key Feature**: Contains comment about future phase progress callbacks:
```typescript
// FUTURE ENHANCEMENT: Phase Progress Callbacks
// To add progress tracking for phases (e.g., "Loading fonts... 50%"):
// 1. Add `onProgress?: (progress: number, message: string) => void` to runPhase()
// 2. Call onProgress() with incremental updates during async operations
// 3. Emit progress events through kernel.subscribe() with extended state
```

#### **lib/kernel/** (Manager Layer)
```
lib/kernel/
├── kernel-manager.ts      # Facade - wraps system/Kernel exports
│   ├── initializeKernel()
│   ├── getKernelState()
│   ├── onKernelStateChange()
│   ├── onAppReady()
│   ├── getSafeMode()
│   ├── setSafeMode()
│   └── Phase setup functions (initializeNetworkTelemetry, loadUserSettings, etc.)
├── lazy-fonts.ts          # On-demand font loading
├── index.ts               # Barrel export
└── README.md              # API reference and usage patterns
```

**Key Pattern**: All functions delegating via dynamic import:
```typescript
export async function initializeKernel(): Promise<void> {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.initialize();
}
```

This prevents circular dependency: Components → hooks → lib/kernel works fine, but lib/kernel doesn't hold a permanent import of system/Kernel.

#### **hooks/kernel/** (React Bridge Layer)
```
hooks/kernel/
├── use-app-kernel.tsx          # React context + hook for kernel state
│   ├── AppKernelProvider       # Root provider (must wrap app)
│   └── useAppKernel()          # Hook to access kernel state
├── use-kernel-loading-sync.tsx # ALREADY SYNCS PHASE PROGRESS!
│   └── useKernelLoadingSync()  # Hides splash when appReady
├── useKernelError.ts           # Hook to access kernel errors
├── index.ts                    # Barrel export
└── README.md                   # Hook documentation
```

---

## Current Phase Progress Sync (Already Implemented!)

### How `useKernelLoadingSync()` Works

**File**: `hooks/kernel/use-kernel-loading-sync.tsx`

```typescript
export function useKernelLoadingSync(): void {
  const kernel = useAppKernel();
  const { setLoading } = useUIBlocker();

  useEffect(() => {
    // Hide loading blocker when kernel finishes
    if (kernel.phases.appReady) {
      setLoading(false);
    }
    // Also hide on error so crash screen shows
    else if (kernel.error) {
      setLoading(false);
    }
  }, [kernel.phases.appReady, kernel.error, setLoading]);
}
```

**Called from**: `app/_layout.tsx` inside the root layout component

### Current Integration Flow

```
app/_layout.tsx calls useKernelLoadingSync()
    ↓
Hook reads kernel.phases.appReady from context
    ↓
When appReady becomes true:
    ↓
Hook calls setLoading(false)
    ↓
UIBlockerLayer receives false
    ↓
SplashScreen (LoadingBlocker) disappears
```

---

## Architecture Pattern: Manager → Hook → Component

### Why This Pattern?

1. **Clean boundaries** — Components never touch lib/ or system/
2. **Testability** — Can mock manager calls in hook tests
3. **Maintainability** — Changes to system/Kernel only need updating lib/kernel/kernel-manager.ts
4. **Type safety** — All types flow through manager; no component type confusion
5. **Reusability** — Manager functions can be called from non-hook code (cli, workers, etc.)

### Example: Full Data Flow

```typescript
// 1. Component (in app/)
function MyScreen() {
  const kernel = useAppKernel();  // ← Hook is the ONLY import from lib/
  return <Text>{kernel.phases.appReady ? 'Ready' : 'Loading'}</Text>;
}

// 2. Hook (in hooks/kernel/)
export function useAppKernel(): AppKernelState {
  const state = useContext(AppKernelContext);
  // AppKernelContext was populated by AppKernelProvider
  return state;
}

// 3. Provider (in hooks/kernel/)
export function AppKernelProvider({ children }: ...) {
  const [state, setState] = useState(getKernelState());

  useEffect(() => {
    initializeKernel();  // ← Calls manager function
    onKernelStateChange((newState) => setState(newState));
  }, []);

  return <AppKernelContext.Provider value={state}>{children}</AppKernelContext.Provider>;
}

// 4. Manager (in lib/kernel/)
export async function initializeKernel(): Promise<void> {
  const { AppKernel } = require("@/system/Kernel");
  return AppKernel.initialize();
}

// 5. System (in system/Kernel/)
class AppKernelClass {
  async initialize(): Promise<void> {
    await this.runPhase("config", () => configPhase());
    await this.runPhase("preload", () => preloadPhase());
    await this.runPhase("network", () => networkPhase());
    // ... more phases
  }
}
```

---

## How the Kernel Phase Progress Currently Works

### AppKernelState Type

**File**: `type-definitions/kernel-types.ts` (inferred from code)

```typescript
interface AppKernelState {
  currentPhase: KernelPhase;  // 'CONFIG' | 'PRELOAD' | 'NETWORK' | 'STORAGE' | 'SERVICES' | 'JOB_SETUP' | 'AUTH' | 'READY' | 'ERROR'
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
  error: KernelError | null;
  timing: Record<string, number>;  // Phase durations in ms
  capabilities: {
    storage: boolean;
    network: boolean;
    auth: boolean;
    analytics: boolean;
    backend: boolean;
    platform: string;  // 'web' | 'ios' | 'android' | 'windows' | 'macos'
  };
  networkStatus: NetworkStatus | null;
  safeMode: SafeModeState | null;
}
```

### Phase Execution Order

**File**: `system/Kernel/app-kernel.ts` lines ~150

```typescript
// Phase 0: CONFIG
await this.runPhase("config", () => configPhase());

// Phase 1: PRELOAD
await this.runPhase("preload", () => preloadPhase());

// Phase 2: NETWORK
await this.runPhase("network", async () => {
  await networkPhase();
  this.setupNetworkSubscription();
});

// Phase 3: STORAGE
await this.runPhase("storage", () => storagePhase());

// Phase 4: SERVICES
await this.runPhase("services", () => servicesPhase());

// Phase 5: JOB_SETUP
await this.runPhase("jobSetup", () => jobSetupPhase());

// Phase 6: AUTH
await this.runPhase("auth", () => authPhase());

// APP READY
this.updateState({
  currentPhase: KernelPhase.READY,
  phases: { ...this.state.phases, appReady: true },
});
```

Each phase:
1. Updates `currentPhase`
2. Sets corresponding phase flag (e.g., `phases.preloadReady = true`)
3. Records timing in `timing[phaseName]`
4. Broadcasts state change to all subscribers via `this.listeners`

---

## Where to Add Phase Progress UI Sync

### Option 1: Extend `useKernelLoadingSync()` ✅ **RECOMMENDED**

**Location**: `hooks/kernel/use-kernel-loading-sync.tsx`

**Current State**: Hides splash when appReady. Can be extended to show progress during bootstrap.

**Change**:
```typescript
export function useKernelLoadingSync(): void {
  const kernel = useAppKernel();
  const { setLoading } = useUIBlocker();

  useEffect(() => {
    // NEW: Show phase progress while initializing
    if (!kernel.phases.appReady && !kernel.error) {
      const progressPercent = calculatePhaseProgress(kernel.currentPhase);
      const message = getPhaseMessage(kernel.currentPhase);
      
      setLoading({
        message,
        progress: progressPercent,
        showProgress: true,
      });
    }
    // When done - hide splash
    else if (kernel.phases.appReady) {
      setLoading(false);
    }
    // On error - show error screen
    else if (kernel.error) {
      setLoading(false);
    }
  }, [kernel.currentPhase, kernel.phases.appReady, kernel.error, setLoading]);
}
```

### Option 2: Create New `useKernelPhaseProgress()` Hook ✅ **ALSO GOOD**

**Location**: `hooks/kernel/use-kernel-phase-progress.tsx` (new file)

**Benefits**:
- Separate concern (phase progress distinct from "show/hide")
- Easier to test/mock
- Can be used independently in other components
- Keeps `useKernelLoadingSync()` focused on show/hide logic

**Implementation**:
```typescript
// hooks/kernel/use-kernel-phase-progress.tsx

export function useKernelPhaseProgress(): {
  progressPercent: number;
  currentPhaseName: string;
  message: string;
} {
  const kernel = useAppKernel();
  
  const progressPercent = useMemo(
    () => calculatePhaseProgress(kernel.currentPhase),
    [kernel.currentPhase]
  );
  
  const message = useMemo(
    () => getPhaseMessage(kernel.currentPhase),
    [kernel.currentPhase]
  );

  return {
    progressPercent,
    currentPhaseName: kernel.currentPhase,
    message,
  };
}
```

Then in `useKernelLoadingSync()`:
```typescript
export function useKernelLoadingSync(): void {
  const kernel = useAppKernel();
  const { setLoading } = useUIBlocker();
  const { progressPercent, message } = useKernelPhaseProgress();

  useEffect(() => {
    if (!kernel.phases.appReady && !kernel.error) {
      setLoading({ message, progress: progressPercent, showProgress: true });
    } else if (kernel.phases.appReady) {
      setLoading(false);
    } else if (kernel.error) {
      setLoading(false);
    }
  }, [kernel.phases.appReady, kernel.error, message, progressPercent, setLoading]);
}
```

---

## UIBlockerLayer & SplashScreen (Already Support Progress!)

### UIBlockerState Type

**File**: `components/UIBlockerContext.ts`

```typescript
export interface UIBlockerState {
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  progress?: number;              // ← Already supported!
  showProgress?: boolean;         // ← Already supported!
  decorativeElement?: React.ReactNode;
}

export interface UIBlockerContextValue extends UIBlockerState {
  setLoading: (state: boolean | Partial<Omit<UIBlockerState, 'isLoading'>>) => void;
}
```

### What Can Be Displayed

The `UIBlockerLayer` already renders with:
- **Title**: "D&D Toolkit" (default, customizable)
- **Subtitle**: "Loading App" (default, customizable)
- **Message**: Current phase message
- **Progress**: Number 0-100
- **Progress bar**: Shows if `showProgress: true`
- **Decorative Element**: Optional custom React component

### Example Usage

```typescript
const { setLoading } = useUIBlocker();

// Show with progress
setLoading({
  title: 'D&D Toolkit',
  subtitle: 'Loading App',
  message: 'Initializing network...',
  progress: 25,
  showProgress: true,
});

// Update message + progress
setLoading({
  message: 'Loading fonts...',
  progress: 45,
});

// Hide
setLoading(false);
```

---

## Provider Hierarchy in app/_layout.tsx

**File**: `app/_layout.tsx` lines ~399–431

```typescript
<AppKernelProvider>
  {/* ... other providers ... */}
  
  <ThemeProvider>
    <ScaleProvider>
      <PlatformProvider>
        <SubscriptionProvider>
          <AppParamsStableProvider>
            <AppParamsVolatileProvider>
              {/* UIBlockerLayer MUST be OUTSIDE AppKernelProvider 
                  so kernel can call setLoading() during bootstrap */}
              <UIBlockerLayer>
                <RootLayout />
              </UIBlockerLayer>
            </AppParamsVolatileProvider>
          </AppParamsStableProvider>
        </SubscriptionProvider>
      </PlatformProvider>
    </ScaleProvider>
  </ThemeProvider>
</AppKernelProvider>
```

---

## Summary: Files You Need to Know About

### To Understand Kernel System
1. **system/Kernel/app-kernel.ts** — Phase orchestration, state machine
2. **system/Kernel/phases/*.ts** — Individual phase implementations
3. **system/Kernel/README.md** — System layer documentation

### To Use Kernel in Components
1. **lib/kernel/kernel-manager.ts** — Manager API (initializeKernel, getKernelState, onKernelStateChange, etc.)
2. **hooks/kernel/use-app-kernel.tsx** — React hook + context provider
3. **hooks/kernel/use-kernel-loading-sync.tsx** — Splash screen sync (where phase progress should wire in)

### UI Integration
1. **components/UIBlockerContext.ts** — State interface + useUIBlocker hook
2. **components/UIBlockerLayer.tsx** — Provider + overlay renderer
3. **components/SplashScreen/index.tsx** — Visual component (already supports progress)

### App Integration
1. **app/_layout.tsx** — Root layout calling useKernelLoadingSync()

---

## Recommended Implementation Path

For **Issue #38 (Kernel Phase Progress)**:

### Step 1: Add Phase Message Localization
- Create `lib/localization/phase-messages.ts`
- Map KernelPhase enum to user-friendly strings
- Example: `'preload' → 'Loading Fonts...'`, `'auth' → 'Restoring Session...'`

### Step 2: Add Progress Calculation Function
- Create `lib/kernel/phase-progress.ts`
- Calculate progressPercent based on current phase
- Example: Phase 1 of 7 = ~14%, Phase 7 of 7 = ~100%

### Step 3: Create New Hook (Option 2) or Extend Existing (Option 1)
- **Option 2 Recommended**: New `hooks/kernel/use-kernel-phase-progress.tsx`
- Encapsulates progress calculation and messaging
- Returns `{ progressPercent, message, phaseName }`

### Step 4: Wire Into `useKernelLoadingSync()`
- Update `hooks/kernel/use-kernel-loading-sync.tsx`
- Call new hook (or inline calculation)
- Pass `message`, `progress`, `showProgress` to `setLoading()`

### Step 5: Test
- Verify phase messages appear during bootstrap
- Check progress bar increments correctly
- Ensure no flashing/jank

---

## Key Insights

1. **Manager Pattern is Already Perfect**: `lib/kernel/kernel-manager.ts` already wraps `system/Kernel/` properly. Components never import from system/.

2. **Hook Pattern is Already Integrated**: `useAppKernel()` provides clean access to kernel state. No need for new context providers.

3. **UI Integration Point Already Exists**: `useKernelLoadingSync()` in `hooks/kernel/` is the exact place to add phase progress syncing.

4. **UIBlocker Fully Supports Progress**: SplashScreen + UIBlockerLayer already accept `progress`, `showProgress`, `message`. Just need to feed phase data from kernel.

5. **No System/Kernel Changes Needed**: Phase progress tracking can be added entirely in `hooks/kernel/` without touching system layer.

6. **Type-Safe**: All kernel state is typed via `AppKernelState` → no guessing about available fields.

