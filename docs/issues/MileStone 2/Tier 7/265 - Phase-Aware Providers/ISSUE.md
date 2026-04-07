# Issue #265: Kernel Phase-Aware Provider Pattern

## Status
**Proposed** (Tier 7: Kernel & Initialization)

## Impact
**MEDIUM** — Eliminates initialization checks scattered across providers; improves bootstrap clarity; creates reusable pattern for phase-dependent initialization; reduces unnecessary service access attempts.

## Depends on
- App kernel phases system already implemented (see `hooks/kernel/use-app-kernel.tsx`)

## Integrates with
- #37+40 (Kernel Phase Progress & Messages) — Provides visible feedback to user during phase waits  
- All future providers that need to wait for bootstrap completion

---

## Problem Statement

**Current Issue:** When providers need services initialized by the kernel (auth, storage, network), they use ad-hoc checks to gate initialization:

```tsx
// Current pattern in AppParamsStableProvider
if (!isAuthConfigured()) {
  logger.category('storage').debug(
    'AppParamsStableProvider: Auth provider not ready yet, deferring world verification',
  );
  return; // Retry will happen when authStateVersion bumps
}
```

**Root Cause:** Race condition between kernel bootstrap phases and provider mounts
- `AppKernelProvider` mounts and starts kernel.initialize() (async phases)
- React immediately renders children (synchronous)
- `AppParamsStableProvider` (child) mounts and fires useEffect
- useEffect tries to access auth provider **before services phase completes**
- Provider must check `isAuthConfigured()` or similar guard; if not ready, return and hope authStateVersion triggers retry

**Current Workaround:** Providers gate with `isAuthConfigured()` and rely on state bumps to trigger re-attempts
- ✅ Works: Succeeds once services phase completes
- ❌ Implicit: Guard condition is a proxy for phase readiness, not explicit
- ❌ Fragile: If state subscription breaks, provider doesn't retry
- ❌ No pattern: Different providers use different guard checks; inconsistent codebase

**Better Approach:** Providers should **explicitly wait for phase readiness** using `usePhaseReady()`, making dependencies crystal clear.

---

## Codebase Status

### Currently Implemented
- ✅ `hooks/kernel/use-app-kernel.tsx` — Exports `usePhaseReady(phaseName: keyof AppKernelState['phases'])` hook
  - Type-safe: phase names are validated at compile time
  - Reactive: component re-renders when phase completes
  - Example: `usePhaseReady("servicesReady")` → `true` once services phase done
- ✅ `type-definitions/kernel-types.ts` — Defines all available phases (configReady, preloadReady, networkReady, storageReady, servicesReady, authReady, etc.)
- ✅ `hooks/kernel/index.ts` — Barrel exports `usePhaseReady`
- ✅ `lib/kernel/kernel-manager.ts` — Manages bootstrap phases and state subscriptions

### Gap Analysis
- ⚠️ **No pattern documentation** — Developers don't know about `usePhaseReady()` or when to use it
- ⚠️ **Inconsistent guard checks** — AppParamsStableProvider uses `isAuthConfigured()`; future providers may use different checks
- ⚠️ **Implicit dependencies** — No clear indication that a provider needs services ready (hidden in function calls inside useEffect)
- ⚠️ **No examples** — No code showing how to refactor an existing provider to use phase gating
- ⚠️ **No README guidance** — `lib/kernel/README.md` documents phases but not the provider pattern

---

## Solution

Make phase dependencies **explicit** by having providers call `usePhaseReady()` at the top level, replacing implicit guards with clear reactive gating.

**Key differences from current approach:**
- Instead of: `if (!isAuthConfigured()) return;` inside useEffect
- Use: `const servicesReady = usePhaseReady("servicesReady");` at component top, then `if (!servicesReady) return;` in effect

This makes:
1. **Dependencies visible** — Reader can see at a glance: "This provider waits for servicesReady phase"
2. **Reactivity correct** — Component re-renders when phase completes; retry logic is automatic
3. **Testability clear** — Mock `usePhaseReady()` to test "not ready yet" vs "ready" scenarios
4. **Scalable** — Any future provider can use the same pattern

## Out of Scope
- Refactoring providers that don't depend on kernel phases (e.g., ThemeProvider)
- Creating new kernel phases or changing phase ordering
- Performance optimization of phase transitions (separate issue)
- i18n or message centralization (covered in #40)

---

## Implementation Tracks

### Track A: Refactor AppParamsStableProvider to use usePhaseReady

**Goal:** Gate both leading effects on `servicesReady` phase instead of retry loops and guard checks.

**Problem in Current Code:**

**Effect 1** (load/verify worlds) — has isAuthConfigured() guard + retries on authStateVersion bumps:
```tsx
if (!isAuthConfigured()) {
  logger.category('storage').debug('Auth provider not ready yet, deferring...');
  return;
}
useEffect(..., [authStateVersion]); // Retry on sign-in/out changes
```

**Effect 2** (auth watcher subscription) — has exponential backoff retry loop:
```tsx
const setupAuthWatcher = async (attempt = 1) => {
  try {
    const unsubscribe = listenToAuthStateChanges(...);
  } catch (error) {
    const delayMs = Math.min(500 * Math.pow(2, attempt - 1), 4000);
    retryTimer = setTimeout(() => setupAuthWatcher(attempt + 1), delayMs);
  }
};
```

Both effects are trying to work around the same race: services not ready yet.

**Refactored Code:**
```tsx
export function AppParamsStableProvider({ children }: { children: ReactNode }) {
  const [stableParams, setStableParams] = useState<AppParamsStable>({...});
  const servicesReady = usePhaseReady("servicesReady"); // Gate on phase
  const [authStateVersion, setAuthStateVersion] = useState(0); // Keep: for sign-in/out reactivity
  
  // Effect 1: Load and verify worlds (gated on servicesReady)
  useEffect(() => {
    if (!servicesReady) return; // Wait — no isAuthConfigured() guard needed
    async function loadFromStorage() {
      await startBackgroundVerification(...);
    }
    loadFromStorage();
  }, [servicesReady, authStateVersion]); // servicesReady gates; authStateVersion triggers re-runs on sign-in/out
  
  // Effect 2: Auth watcher (gated on servicesReady)
  useEffect(() => {
    if (!servicesReady) return; // Wait — no retry loop needed
    const setupAuthWatcher = async () => { 
      const unsubscribe = listenToAuthStateChanges(async (session) => {
        if (session !== null) {
          setAuthStateVersion((v) => v + 1); // Trigger Effect 1 to re-verify
        }
      });
      // No catch block; listenToAuthStateChanges guaranteed available
    };
    setupAuthWatcher();
  }, [servicesReady]); // Runs when servicesReady true; no retry loop
```

**Scope:**
- [ ] **Effect 1:**
  - Add `const servicesReady = usePhaseReady("servicesReady");` at component top
  - Add `if (!servicesReady) return;` as first line of effect
  - Remove `isAuthConfigured()` guard inside `startBackgroundVerification()`
  - Update effect deps from `[authStateVersion]` to `[servicesReady, authStateVersion]`
  - Keep `authStateVersion` in deps (needed for sign-in/out re-verification)
- [ ] **Effect 2:**
  - Add `if (!servicesReady) return;` at top of effect
  - Delete entire retry loop (exponential backoff, MAX_RETRIES, setTimeout)
  - Call `setupAuthWatcher()` directly — guaranteed to succeed
  - Update effect deps from `[]` to `[servicesReady]`
- [ ] Update comments to explain phase gating
- [ ] Verify error message simplifications in `AuthStateManager.batchVerifyWorldAccess()`

**Files Changed:**
- `providers/AppParamsStableProvider.tsx`

✅ Exit: AppParamsStableProvider gates both effects on `servicesReady` phase. Retry loops and guard checks removed. Sign-in/out reactivity preserved via `authStateVersion`. No race conditions. `npm run lint` passes.

---

### Track B: Add storageReady gate to ThemeProvider

**Goal:** `ThemeProvider` calls `StorageManager.getRaw()` on mount with no phase guard. If storage isn't ready the try/catch silently swallows the error, defaults to `"classic"`/`"dark"`, and **never retries** — the user's saved theme is lost until restart. Add an explicit `storageReady` gate so the load only runs (and re-runs) after storage is initialized.

**Current Code:**
```tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [family, setFamilyState] = useState<ThemeFamily>("classic");
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadThemePreferences = async () => { /* ... */ };
    loadThemePreferences();
  }, []); // ← runs immediately, no phase guard
```

**Refactored Code:**
```tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [family, setFamilyState] = useState<ThemeFamily>("classic");
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [isLoading, setIsLoading] = useState(true);
  const storageReady = usePhaseReady("storageReady"); // Explicit: this provider depends on storage phase

  useEffect(() => {
    if (!storageReady) return; // Wait — SecureStorage cipher not yet initialized
    const loadThemePreferences = async () => { /* ... existing body unchanged ... */ };
    loadThemePreferences();
  }, [storageReady]); // Retriggers when storageReady becomes true
```

**Scope:**
- [ ] Add `const storageReady = usePhaseReady("storageReady");` at component top level
- [ ] Add `if (!storageReady) return;` as first line of the load effect
- [ ] Update effect dependency array from `[]` to `[storageReady]`
- [ ] Add `usePhaseReady` import from `@/hooks/kernel`

**Files Changed:**
- `providers/ThemeProvider.tsx`

✅ Exit: ThemeProvider loads theme preferences only after `storageReady`. If storage phase hasn't completed on first render, effect defers and re-runs when it does. `npm run lint` passes.

---

### Track C: Add storageReady gate to AppParamsVolatileProvider

**Goal:** `AppParamsVolatileProvider` calls `StorageManager.getRaw()` to restore `LAST_SELECTED_WORLD` and `LAST_USER_ROLE` session data. No phase guard exists — if storage isn't ready, the restore silently returns nulls and the session is lost for the lifetime of the component. Add a `storageReady` gate.

**Current Code:**
```tsx
export function AppParamsVolatileProvider({ children }: { children: ReactNode }) {
  // ... state + callbacks ...

  useEffect(() => {
    async function restoreSession() {
      const savedWorldId = await StorageManager.getRaw(STORAGE_KEYS.LAST_SELECTED_WORLD);
      const savedRole = await StorageManager.getRaw(STORAGE_KEYS.LAST_USER_ROLE);
      if (savedWorldId) setWorldId(savedWorldId);
      if (savedRole) setUserRole(savedRole as AccessRole);
    }
    restoreSession();
  }, [setWorldId, setUserRole]); // ← no phase guard
```

**Refactored Code:**
```tsx
export function AppParamsVolatileProvider({ children }: { children: ReactNode }) {
  // ... state + callbacks ...
  const storageReady = usePhaseReady("storageReady"); // Explicit: session restore depends on storage phase

  useEffect(() => {
    if (!storageReady) return; // Wait — storage not yet initialized
    async function restoreSession() { /* ... existing body unchanged ... */ }
    restoreSession();
  }, [storageReady, setWorldId, setUserRole]); // storageReady added to deps
```

**Scope:**
- [ ] Add `const storageReady = usePhaseReady("storageReady");` at component top level
- [ ] Add `if (!storageReady) return;` as first line of the restore effect
- [ ] Add `storageReady` to effect dependency array
- [ ] Add `usePhaseReady` import from `@/hooks/kernel`

**Files Changed:**
- `providers/AppParamsVolatileProvider.tsx`

✅ Exit: AppParamsVolatileProvider restores session only after `storageReady`. No silent null returns. `npm run lint` passes.

---

### Track D: Add phase gate TODO to SubscriptionProvider

**Goal:** `SubscriptionProvider` is currently a stub (`getSubscription()` returns a local mock — no real network call). No gate is needed now, but when real Supabase/Stripe calls land the developer must add a `servicesReady` gate or they'll repeat the same race condition fixed in Track A. Add a prominent TODO comment so that context isn't lost.

**Scope:**
- [ ] Add TODO comment inside `initSubscription()` above the `getSubscription()` call:
```tsx
// TODO (#37a Track D): When replacing this stub with real Supabase/Stripe calls,
// add phase gating at the top of this provider:
//   const servicesReady = usePhaseReady("servicesReady");
// and guard the effect:
//   if (!servicesReady) return;
// and wire [servicesReady] into the useEffect dependency array.
// Without this, the provider will attempt service calls before bootstrap completes.
```

**Files Changed:**
- `providers/SubscriptionProvider.tsx`

✅ Exit: Comment is in place. Next developer implementing real subscriptions will see the gate requirement immediately.

---

### Track E: Annotate ScaleProvider and PlatformProvider as gate-free

**Goal:** These two providers use only native platform APIs (`Dimensions`, `Platform.OS`, UA detection) — they have no dependency on kernel bootstrap phases and should never need gating. Add a comment to each to make this explicit, so future reviewers don't wonder if they were missed.

**Scope:**
- [ ] `ScaleProvider`: Add comment above the `useEffect`:
```tsx
// No phase gating needed — uses Dimensions API only; independent of kernel bootstrap
```
- [ ] `PlatformProvider`: Add comment above the `useEffect`:
```tsx
// No phase gating needed — uses Platform.OS, UA, and viewport only; independent of kernel bootstrap
```

**Files Changed:**
- `providers/ScaleProvider.tsx`
- `providers/PlatformProvider.tsx`

✅ Exit: Both providers have explicit "no gate needed" annotations. `npm run lint` passes.

---

### Track F: Remove dead code from AppParamsStableProvider

**Goal:** After Track A gates Effect 1 on `servicesReady`, Effect 3 becomes dead code. Effect 3 exists only to recover from a race condition where verification ran before auth was ready. Once Effect 1 is gated, that race cannot happen, so Effect 3 is no longer needed.

**Current Dead Code:**
```tsx
const previousUserIdRef = React.useRef<string | undefined>(undefined);

useEffect(() => {
  const hadNoUserId = previousUserIdRef.current === undefined;
  const nowHasUserId = stableParams.userId !== undefined;
  if (hadNoUserId && nowHasUserId && stableParams.connectedWorldIds.length === 0) {
    logger.category("storage").info(
      "AppParamsStableProvider: UserId just became available...",
    );
    setAuthStateVersion((v) => v + 1);
  }
  previousUserIdRef.current = stableParams.userId;
}, [stableParams.userId, stableParams.connectedWorldIds]);
```

With Track A in place, Effect 1 will not run until both `servicesReady` is true AND auth is ready. This race condition cannot occur.

**Scope:**
- [ ] Delete the entire `useEffect(() => {...}, [stableParams.userId, stableParams.connectedWorldIds])` block
- [ ] Delete `const previousUserIdRef = React.useRef<string | undefined>(undefined);`
- [ ] Update comments in Effect 1 if they reference this workaround

**Files Changed:**
- `providers/AppParamsStableProvider.tsx`

✅ Exit: Dead code removed. File is cleaner; no functional change. `npm run lint` passes.

---

### Track G: Verify initialization and prevent regressions

**Goal:** Ensure phase gating works correctly and providers wait for the correct phases.

**Scope:**
- [ ] Manual verification during app bootstrap:
  - [ ] Start app on web, iOS, and desktop
  - [ ] Monitor console: No errors about "Auth provider not ready" or similar (phase gate prevents access)
  - [ ] Monitor timing: Services phase completes within expected range (no long hangs)
  - [ ] Verify: AppParamsStableProvider loads user ID and worlds correctly
- [ ] Verify no edge cases:
  - [ ] What happens if phase is never ready? (e.g., services phase fails) — provider should stay disabled, not hang
  - [ ] What happens on app reset? Does phase gate reset correctly?
  - [ ] What happens if multiple providers wait on same phase? (Should all unblock simultaneously)

**Files Changed:**
- `providers/*.tsx` (modifications from Tracks B–F)
- No new files

✅ Exit: App starts cleanly, no initialization guard errors. Phase transitions work correctly. No regressions in bootstrap timing or provider initialization.

---

### Track H: Audit and update contexts/ providers for consistency

**Goal:** Audit the UI-layer context providers in `contexts/` (`AppToastProvider`, `ModalProvider`, `NotificationProvider`) to confirm they don't access kernel-controlled systems on mount. If any do, apply the same phase gating pattern.

**Current Status:** These appear to be UI-only (no storage/service calls), but they weren't included in the original audit. Verify before calling them gate-free.

**Scope:**
- [ ] Search `contexts/` for providers that might access `StorageManager`, services, or API on mount
- [ ] For each provider:
  - [ ] Identify if it depends on a kernel phase (likely UI-related phase)
  - [ ] If dependencies exist, add `usePhaseReady()` gate like Track A–C
  - [ ] If no dependencies, add comment like Track E
- [ ] Create audit table (provider → phase → pattern → status) for reference

**Files Changed:**
- `contexts/*.tsx` (if any need updating)

✅ Exit: All context providers either explicitly gated or documented as not needing gating. No scattered initialization patterns. `npm run lint` passes.

---

### Track I: Consolidate job infrastructure + handler registration into single job-setup-phase

**Goal:** Currently `job-phase.ts` (initializes queue) and `registration-phase.ts` (registers handlers) are separate files with just one function each. They're sequential (init → register) and logically coupled. Consolidate into a single `job-setup-phase.ts` that **inlines the bootstrap logic** (following the pattern of all other phases: config, preload, network, storage, services, auth). This keeps middleware cleaner for runtime operations.

**Architecture:**
- Delete `system/Kernel/phases/job-phase.ts`
- Delete `system/Kernel/phases/registration-phase.ts`
- Create `system/Kernel/phases/job-setup-phase.ts` with both initialization steps inlined (not delegating to middleware)
  - Step 1: Create adapters and inject into queue (inline, ~20-50ms)
  - Step 2: Register handlers with queue (inline, ~5-20ms)
- Keep `lib/middleware/jobs/job-service.ts` for runtime operations (enqueue, preconditions, normalization)
- Rename phase in type-definitions: remove `jobReady` and `registrationReady`; add `jobSetupReady`
- Update `app-kernel.ts` phase sequence

**Scope:**
- [ ] Create `system/Kernel/phases/job-setup-phase.ts` with logic inlined:
  ```tsx
  /**
   * Phase 7: Job Setup Phase (NON-CRITICAL)
   *
   * Responsibility: Initialize background job queue infrastructure and register handlers
   * Called by: system/Kernel/app-kernel.ts
   *
   * Two-step process inlined in this phase (not delegated to middleware):
   * 1. Create and inject storage adapters (FastCache, SecureStorage) — ~20-50ms
   * 2. Register all job handlers (sync-orchestrator, network-recovery-retry) — ~5-20ms
   *
   * Must run:
   * - AFTER services-phase (needs initialized storage)
   * - BEFORE auth-phase (auth may trigger sync jobs)
   *
   * NOTE: Background jobs are non-critical; app boots without them
   */
  export async function jobSetupPhase(): Promise<void> {
    try {
      const { logger } = await import("@/lib/utils");
      const { getJobQueue } = await import("@/system/Jobs/background-job-queue");
      const { FastCacheAdapter } = await import("@/lib/middleware/jobs/adapters/fastcache-adapter");
      const { SecureStorageAdapter } = await import("@/lib/middleware/jobs/adapters/secure-storage-adapter");

      // Step 1: Initialize queue infrastructure (create adapters, inject into singleton)
      const defaultAdapter = new FastCacheAdapter();
      const secureAdapter = new SecureStorageAdapter();
      const queue = getJobQueue({
        storageAdapter: defaultAdapter,
        secureAdapter,
      });
      await queue.initialize();
      logger.category("bootstrap").info("✅ Job infrastructure initialized");

      // Step 2: Register all job handlers with the queue
      const { createSyncJobHandler } = await import("@/lib/jobs");
      const syncHandler = createSyncJobHandler();
      queue.registerHandler(syncHandler.name, (async (payload: any) => {
        await syncHandler.execute(payload);
      }) as any);

      const { NetworkRecoveryRetryJobManager } = await import(
        "@/lib/jobs/core/network-recovery-retry-job"
      );
      const { NetworkStateManager } = await import("@/system/Network/state-machine");
      await NetworkRecoveryRetryJobManager.initialize(NetworkStateManager, queue);

      logger.category("bootstrap").info("✅ Job handlers registered");
    } catch (error) {
      const { logger } = await import("@/lib/utils");
      logger
        .category("bootstrap")
        .warn("Job setup phase warning (non-critical)", {
          error: (error as Error).message,
        });
    }
  }
  ```
- [ ] Update `type-definitions/kernel-types.ts`:
  - Remove `jobReady` and `registrationReady` from `KernelPhase` enum
  - Add `jobSetupReady` to `KernelPhase` enum
  - Update `AppKernelState.phases` object to reflect single `jobSetupReady` flag
- [ ] Update imports in `system/Kernel/app-kernel.ts`:
  - Remove imports of `jobPhase` and `registrationPhase`
  - Add import of `jobSetupPhase`
- [ ] Update phase execution order in `app-kernel.ts` comments
- [ ] Delete old files (done post-testing)
- [ ] `lib/middleware/jobs/job-service.ts` keeps `enqueue()`, `getJobs()`, `subscribe()`, and other runtime methods; nothing changes there. Just delete the bootstrap functions (`initializeJobInfrastructure`, `registerJobHandlers`) from this file since they're now in the phase.

**Architecture After:**
```
job-setup-phase.ts (bootstrap) — inlines creation + registration logic ~25-70ms
    ↓
@/system/Jobs/background-job-queue (singleton)
    ↓handlers listen for jobs
    ↑
lib/middleware/jobs/job-service.ts (runtime) — enqueue, preconditions, normalization
```

**Files Changed:**
- `system/Kernel/phases/job-setup-phase.ts` (new)
- `type-definitions/kernel-types.ts`
- `system/Kernel/app-kernel.ts`
- `lib/middleware/jobs/job-service.ts` (remove bootstrap functions `initializeJobInfrastructure` and `registerJobHandlers`)

✅ Exit: Job setup consolidated into single phase file. Logic inlined (matches pattern of CONFIG, PRELOAD, NETWORK, STORAGE, SERVICES, AUTH phases). Middleware stays focused on runtime operations. `npm run lint` passes. `npm run typecheck` clean.

---

### Track K: Create generalized Loading Context (multi-system UI blocker)

**Goal:** Create a shared `LoadingContext` that all systems (kernel, navigation, storage, services) can use to block UI during critical operations. This enables a single, consistent loading blocker throughout the app lifecycle.

**Rationale:**
- Kernel uses it during bootstrap (prevents UI crashes while providers wait)
- Navigation can use it for complex page loads
- Storage migrations can use it during data updates
- Service calls can use it for background operations
- Single visual blocker, consistent appearance, modular styling
- **No phase needed:** LoadingContext is pure React state; synchronous initialization in `app/_layout.tsx`

**Architecture:**
```
LoadingProvider (wraps AppKernelProvider in app/_layout.tsx)
    ↓
LoadingContext (state: isLoading, message, progress, decorativeElement)
    ↓ consumed by
LoadingBlocker component (renders SplashScreen or custom loader)
    ↓
Kernel → Navigation → Storage → Services (any system can call setLoading via useLoadingContext)
```

**Scope:**
- [ ] Create `contexts/LoadingContext.tsx`:
  ```tsx
  interface LoadingState {
    isLoading: boolean;
    message?: string;
    progress?: number; // 0-100, for future progress display
    decorativeElement?: React.ReactNode; // Customizable UI element (CustomLoad, StorageIcon, etc.)
  }

  export const LoadingContext = React.createContext<LoadingState & {
    setLoading: (state: boolean | LoadingState) => void;
  }>({
    isLoading: false,
    setLoading: () => {},
  });

  export function LoadingProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = React.useState<LoadingState>({ isLoading: false });

    const setLoading = (newState: boolean | LoadingState) => {
      if (typeof newState === 'boolean') {
        setState({ isLoading: newState });
      } else {
        setState({ isLoading: true, ...newState });
      }
    };

    return (
      <LoadingContext.Provider value={{ ...state, setLoading }}>
        {children}
      </LoadingContext.Provider>
    );
  }

  export function useLoadingContext() {
    const ctx = React.useContext(LoadingContext);
    if (!ctx) throw new Error('useLoadingContext must be used within LoadingProvider');
    return ctx;
  }
  ```
- [ ] Create `components/LoadingBlocker.tsx`:
  ```tsx
  import { useLoadingContext } from '@/contexts/LoadingContext';
  import { SplashScreen } from '@/components/SplashScreen';

  export function LoadingBlocker() {
    const { isLoading, message, progress, decorativeElement } = useLoadingContext();

    if (!isLoading) return null;

    return (
      <SplashScreen
        message={message}
        progress={progress}
        decorativeElement={decorativeElement}
      />
    );
  }
  ```
- [ ] Update `components/SplashScreen/SplashScreen.tsx` to accept params:
  ```tsx
  interface SplashScreenProps {
    message?: string;
    progress?: number;
    decorativeElement?: React.ReactNode; // Defaults to <CustomLoad />
  }

  export function SplashScreen({
    message = "Loading D&D Toolkit...",
    progress,
    decorativeElement,
  }: SplashScreenProps) {
    const { theme } = UseTheme();

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        {/* Message */}
        {message && <Title style={{ color: theme.accent, marginBottom: 16 }}>{message}</Title>}

        {/* Decorative Element (defaults to CustomLoad) */}
        {decorativeElement || <CustomLoad size="large" />}

        {/* Progress Bar (if provided) */}
        {progress !== undefined && (
          <View style={{ marginTop: 16, width: '80%', height: 4, backgroundColor: theme.border, borderRadius: 2 }}>
            <View
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: theme.accent,
                borderRadius: 2,
              }}
            />
          </View>
        )}
      </View>
    );
  }
  ```
- [ ] Update `app/_layout.tsx`:
  - Wrap app tree with `LoadingProvider` (before AppKernelProvider)
  - Mount `<LoadingBlocker />` at root level (highest z-index, above all content)
  - LoadingBlocker will block UI whenever any system calls `setLoading(true)`
  - Wrap structure:
    ```tsx
    <LoadingProvider>
      <AppKernelProvider>
        <ThemeProvider>
          {/* ... other providers ... */}
            <LoadingBlocker /> {/* Mounts here at root level */}
            {children}
        </ThemeProvider>
      </AppKernelProvider>
    </LoadingProvider>
    ```
- [ ] Wire kernel to use context:
  - In `lib/kernel/app-kernel.ts`: During kernel initialization, get `setLoading` via context
  - Call `setLoading({ message: "Initializing...", decorativeElement: <CustomLoad /> })` when first phase starts
  - Call `setLoading(false)` when `appReady` phase completes
  - Optional: Show progress updates during bootstrap
- [ ] Documentation (inline):
  - LoadingContext exports document: "Used by kernel, navigation, storage, and services to block UI during critical ops. No phase needed; pure React context."
  - LoadingBlocker component document: "Single UI blocker; renders SplashScreen with context state. Mounts at root level in app/_layout.tsx."

**Files Changed:**
- `contexts/LoadingContext.tsx` (new)
- `components/LoadingBlocker.tsx` (new)
- `components/SplashScreen/SplashScreen.tsx` (updated to accept message, progress, decorativeElement params)
- `app/_layout.tsx` (add LoadingProvider wrapper, mount LoadingBlocker)

✅ Exit: Generalized loading context created. SplashScreen now flexible (customizable message, progress, UI element). Kernel can control blocker via context. Other systems (navigation, storage, services) can use same context. Single blocker, consistent UX. No phase required. `npm run lint` passes. `npm run typecheck` clean.

---

### Track L: Clean up old loading/splash logic

**Goal:** Remove obsolete loading and splash screen patterns now that `LoadingContext` and updated `SplashScreen` handle all loading states.

**Scope:**
- [ ] Delete `hooks/ui/use-splash-screen.tsx` (context now handles splash timing)
- [ ] Delete `components/LoadingOverlay.tsx` (context-based LoadingBlocker replaces it)
- [ ] Remove old imports and references from `app/_layout.tsx`:
  - Remove: `import { useSplashScreen } from "@/hooks/ui";`
  - Remove: `import { LoadingOverlay, SplashScreen } from "@/components/SplashScreen";`
  - Remove old conditional: `if (splash.showSplash) return <SplashScreen />;`
  - Remove old conditional: `if (!kernel.phases.appReady) return <LoadingOverlay ... />;`
- [ ] Remove `components/SplashScreen/index.ts` barrel export of `LoadingOverlay`
- [ ] Update `hooks/ui/index.ts` to remove `useSplashScreen` export
- [ ] Search codebase for residual references to `useSplashScreen()` or `LoadingOverlay` and remove
  - Use: `grep -r "useSplashScreen\|LoadingOverlay" src/` to find all references
- [ ] Remove feature flag check for splash screen (`splashScreen` flag) if it was only used to toggle LoadingOverlay
  - If flag is still needed elsewhere, keep it; otherwise remove from config

**Files Changed:**
- `hooks/ui/use-splash-screen.tsx` (delete)
- `components/LoadingOverlay.tsx` (delete)
- `components/SplashScreen/index.ts` (remove LoadingOverlay export)
- `hooks/ui/index.ts` (remove useSplashScreen export)
- `app/_layout.tsx` (remove old splash/loading logic)
- `config/appsettings.*.json` (optional: remove splashScreen feature flag if unused)

✅ Exit: Old loading patterns removed. Codebase cleaner. Single source of truth for loading UI (LoadingContext + LoadingBlocker). All old references cleaned up. `npm run lint` passes. `npm run typecheck` clean.

---

## Acceptance Criteria

### **Phase 1 (Implementation):**
- [ ] Track A: AppParamsStableProvider refactored to `usePhaseReady("servicesReady")` gate
  - Dependency on `authStateVersion` removed
  - `isAuthConfigured()` check removed from effect
  - Effect dependency array updated to `[servicesReady]`
  - Comments updated to explain phase gating
- [ ] Track B: ThemeProvider gated on `storageReady`
  - Effect does not run until `storageReady` is true
  - Effect dependency array updated from `[]` to `[storageReady]`
  - Theme preferences load correctly after storage phase completes
- [ ] Track C: AppParamsVolatileProvider gated on `storageReady`
  - Session restore (`LAST_SELECTED_WORLD`, `LAST_USER_ROLE`) deferred until `storageReady`
  - `storageReady` added to effect dependency array
- [ ] Track D: SubscriptionProvider annotated with future gate TODO
  - TODO comment present and references correct phase (`servicesReady`)
- [ ] Track E: ScaleProvider and PlatformProvider annotated as gate-free
  - Both have explicit comments explaining why no phase gate is needed
- [ ] Track F: Dead code removed from AppParamsStableProvider
  - Effect 3 (race condition workaround) deleted
  - `previousUserIdRef` state variable deleted
  - File is cleaner; no functional change
- [ ] Track G: Verification complete
  - App starts cleanly on all platforms without phase-related errors
  - No regressions in bootstrap timing
  - Multiple providers waiting on same phase unblock correctly
  - Edge cases tested (phase failure, app reset, concurrent providers)
- [ ] Track H: Context providers audited for phase dependencies
  - All context providers reviewed for storage/services access
  - Any found dependencies gated or documented
  - Audit table created for future reference
- [ ] Track I: Job setup phase consolidated
  - `job-setup-phase.ts` created with both init + register operations inlined
  - `jobReady`/`registrationReady` replaced with single `jobSetupReady` flag
  - Old files can be deleted after testing
  - `npm run lint` passes; TypeScript clean
- [ ] Track K: Generalized Loading Context created and mounted
  - `contexts/LoadingContext.tsx` created with `LoadingProvider` and `useLoadingContext()` hook
  - `components/LoadingBlocker.tsx` created and mounted in `app/_layout.tsx`
  - `SplashScreen.tsx` updated to accept optional `message`, `progress`, and `decorativeElement` props
  - LoadingProvider wraps app tree (before AppKernelProvider)
  - LoadingBlocker renders at root level (highest z-index)
  - Kernel can call `setLoading()` during initialization
  - SplashScreen renders with custom decorative elements (defaults to `<CustomLoad />`)
  - Context ready for use by kernel, navigation, storage, services (no phase needed)
  - `npm run lint` passes; TypeScript clean
- [ ] Track L: Old loading/splash logic cleaned up
  - `hooks/ui/use-splash-screen.tsx` deleted
  - `components/LoadingOverlay.tsx` deleted
  - Old splash/loading conditionals removed from `app/_layout.tsx`
  - All references to `useSplashScreen()` and `LoadingOverlay` removed from codebase
  - Barrel exports updated (`components/SplashScreen/index.ts`, `hooks/ui/index.ts`)
  - Optional: `splashScreen` feature flag removed from config (if no longer needed)
  - Single source of truth: LoadingContext + LoadingBlocker
  - `npm run lint` passes; TypeScript clean
- [ ] `npm run lint` passes, TypeScript strict mode clean

### **Phase 2 (README):**
- [ ] Track A: AppParamsStableProvider refactored to `usePhaseReady("servicesReady")` gate
  - Dependency on `authStateVersion` removed
  - `isAuthConfigured()` check removed from effect
  - Effect dependency array updated to `[servicesReady]`
  - Comments updated to explain phase gating
- [ ] Track B: ThemeProvider gated on `storageReady`
  - Effect does not run until `storageReady` is true
  - Effect dependency array updated from `[]` to `[storageReady]`
  - Theme preferences load correctly after storage phase completes
- [ ] Track C: AppParamsVolatileProvider gated on `storageReady`
  - Session restore (`LAST_SELECTED_WORLD`, `LAST_USER_ROLE`) deferred until `storageReady`
  - `storageReady` added to effect dependency array
- [ ] Track D: SubscriptionProvider annotated with future gate TODO
  - TODO comment present and references correct phase (`servicesReady`)
- [ ] Track E: ScaleProvider and PlatformProvider annotated as gate-free
  - Both have explicit comments explaining why no phase gate is needed
- [ ] Track F: Dead code removed from AppParamsStableProvider
  - Effect 3 (race condition workaround) deleted
  - `previousUserIdRef` state variable deleted
  - File is cleaner; no functional change
- [ ] Track G: Verification complete
  - App starts cleanly on all platforms without phase-related errors
  - No regressions in bootstrap timing
  - Multiple providers waiting on same phase unblock correctly
  - Edge cases tested (phase failure, app reset, concurrent providers)
- [ ] Track H: Context providers audited for phase dependencies
  - All context providers reviewed for storage/services access
  - Any found dependencies gated or documented
  - Audit table created for future reference
- [ ] Track K: Generalized Loading Context documented in README
  - `lib/kernel/README.md` includes section: "Loading Context for UI Blocking"
  - Documents when to use (kernel, navigation, storage, services)
  - Shows API: `useLoadingContext()`, `setLoading()`, `setLoading({ message, progress, decorativeElement })`
  - Clarifies: No phase required; pure React context
  - Example: Kernel and other systems using context during operations
- [ ] Track L: Loading/splash cleanup documented
  - Changelog or migration guide noting removal of `useSplashScreen()` and `LoadingOverlay`
  - How to migrate any custom code using old patterns
  - `npm run lint` passes, TypeScript strict mode clean

### **Phase 2 (README):**
- [ ] `lib/kernel/README.md` "Phase-Aware Provider Pattern" section includes:
  - When to use vs. when to skip (decision tree)
  - List of all available phases (configReady, preloadReady, networkReady, storageReady, servicesReady, authReady)
  - Before/after code examples (implicit gate → explicit phase)
  - Concrete provider example with full lifecycle
  - Checklist for adding a new phase-aware provider

### **Phase 3 (Guides):**
- [ ] `docs/issues/MileStone 2/Tier 7/265 - Phase-Aware Providers/USAGE_GUIDE.md`
  - How to add a new phase-aware provider (step-by-step checklist)
  - Common patterns: waiting for single phase, waiting for multiple phases, conditional phases
  - Integration examples: Provider + AppKernelProvider + useEffect patterns
- [ ] `docs/issues/MileStone 2/Tier 7/265 - Phase-Aware Providers/IMPLEMENTATION_GUIDE.md`
  - Kernel phase lifecycle overview (which phases depend on which)
  - How phase readiness updates trigger component re-renders
  - Common pitfalls and how to avoid them
  - Debugging: How to verify a provider is waiting correctly

### **Phase 4 (Tests):**
- [ ] `docs/A Testing Guide/Provider Initialization Testing.md`
  - Manual test: Launch app, verify "Auth provider not ready" errors do NOT appear in console
  - Manual test: Monitor timing — services phase should complete within [X]ms
  - Manual test: AppParamsStableProvider loads user ID and connected worlds correctly
  - Manual test: Multiple providers mounted simultaneously don't race
  - Console capture: Show clean bootstrap logs (no phase-related warnings)
- [ ] Unit tests for `usePhaseReady()` hook:
  - Test returns `false` before phase completes
  - Test returns `true` after phase completes
  - Test component re-renders when phase completes
- [ ] Integration tests:
  - Test AppParamsStableProvider + kernel lifecycle
  - Test effect with `[servicesReady]` dependency runs at correct time
  - Test TypeScript prevents invalid phase names (compile-time validation)
- [ ] LoadingContext tests:
  - Unit test: `useLoadingContext()` provides correct state
  - Unit test: `setLoading(true/false)` updates state
  - Unit test: `setLoading({...})` merges state correctly
  - Integration test: LoadingBlocker renders when context.isLoading is true
  - Integration test: LoadingBlocker respects custom message, progress, decorativeElement
  - Integration test: Multiple callers can update loading state (no race)
- [ ] `npm run lint` and `npm run typecheck` passing

---

## Dependencies & Notes

### All Available Kernel Phases
From `type-definitions/kernel-types.ts`:
- `configReady` — App configuration loaded
- `preloadReady` — Fonts and images preloaded
- `networkReady` — Network state detection initialized
- `storageReady` — SecureStorage and storage systems initialized
- `servicesReady` — Auth, Error, and Database providers registered
- `authReady` — User auth state restored (if Supabase configured)
- `syncReady` — Offline sync system initialized
- `appReady` — All phases complete; app can render main UI

### Design Principle
**Phase gates over conditional checks** — Providers should declare their dependencies explicitly with `usePhaseReady()`, not hide them behind service availability checks. This makes dependencies visible and enables automatic retry when phase completes.

### Current Codebase Context
- `hooks/kernel/use-app-kernel.tsx` — Where `usePhaseReady()` is exported
- `type-definitions/kernel-types.ts` — Where phases are defined
- `lib/kernel/kernel-manager.ts` — Bootstrap orchestration
- `lib/middleware/services/auth-service.ts` — Where `isAuthConfigured()` is currently defined

### Pre-Release Stance
No legacy code path needed. App is pre-release; all providers migrate to phase-aware pattern immediately.
