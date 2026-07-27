# System Kernel Module

Low-level app lifecycle and phase management providing the foundation for app initialization. Manages bootstrap phases, service registration, and system readiness detection. Pure system layer with no business logic.

## When to Use This Module

**Use this module for:**

- App bootstrap and initialization sequencing
- Service registration and dependency injection
- Phase-based system readiness detection
- Low-level app lifecycle events
- System health monitoring

**Don't use this module for:**

- Business logic initialization (belongs in lib/kernel)
- UI readiness (belongs in lib/kernel)
- Feature-specific setup (belongs in lib modules)
- User-facing initialization (belongs in components)

## Architecture & Data Flow

```
App Start → AppKernel.initialize()
                      ↓
Phase Execution (CONFIG → PRELOAD → NETWORK → STORAGE → SERVICES → JOB_SETUP → AUTH → READY)
                      ↓
Service Registration → Dependency Injection
                      ↓
System Ready → Emit Events → App Continues
```

**Key Components:**

- **AppKernel**: Main kernel class managing phases and state
- **Phase Functions**: Individual phase implementations in `/phases/` directory
- **State Management**: Centralized kernel state with phase tracking
- **Event System**: Subscription-based state change notifications
- **Error Handling**: Phase failure detection and recovery

## Phase Execution Order

The kernel executes phases in a strict, dependency-aware order with adaptive timeouts:

1. **CONFIG** - Environment setup, configuration loading, and device performance measurement
2. **PRELOAD** - Critical fonts and assets loading (<500ms target)
3. **NETWORK** - Network detection and speed classification
4. **STORAGE** - Cache validation and migration (network-aware)
5. **SERVICES** - Auth provider, error tracker, analytics registration
6. **JOB_SETUP** - Background job queue initialization and handlers
7. **AUTH** - Session restoration (non-blocking, runs in background)
8. **FEATURE_FLAGS** - Load and apply feature flags from server
9. **REGISTRATION** - Register job handlers and activate subscriptions
10. **READY** - All critical systems initialized, app can render UI

**Phase Dependencies:**
- CONFIG: No dependencies (runs first)
- PRELOAD/NETWORK/STORAGE: Can run in parallel after CONFIG
- SERVICES: Requires NETWORK
- AUTH: Requires NETWORK + SERVICES
- JOB_SETUP: Requires STORAGE + PRELOAD
- FEATURE_FLAGS: Requires all previous phases
- REGISTRATION: Requires FEATURE_FLAGS
- READY: Requires all previous phases complete

**Failure Classification:**
- **Unreachable**: Skip phase, mark capabilities unavailable (e.g., network unreachable)
- **Timeout**: Defer to on-demand retry, enable degraded mode (e.g., slow network)
- **Non-recoverable**: Critical phases only, trigger safe mode (e.g., storage corruption)

## API Reference

### App Kernel

#### `AppKernel.initialize(): Promise<void>`

Initialize the app kernel and execute all bootstrap phases in order.

```typescript
import { AppKernel } from '@/system/kernel';

await AppKernel.initialize();
// All phases complete, app ready for UI rendering
```

#### `AppKernel.getState(): AppKernelState`

Get current kernel state snapshot.

```typescript
const state = AppKernel.getState();
console.log(state.currentPhase); // "READY"
console.log(state.phases.appReady); // true
```

#### `AppKernel.subscribe(callback: KernelListener): () => void`

Subscribe to kernel state changes. Returns unsubscribe function.

```typescript
const unsubscribe = AppKernel.subscribe((state) => {
  if (state.phases.appReady) {
    console.log("App is ready!");
  }
});

unsubscribe(); // Stop listening
```

#### `AppKernel.retry(): Promise<void>`

Retry initialization after a recoverable error.

```typescript
if (kernel.error?.recoverable) {
  await AppKernel.retry();
}
```

### Phase Functions

Each phase is implemented as a separate function in the `/phases/` directory:

- **`configPhase()`** - Configuration loading and device performance measurement
- **`preloadPhase()`** - Font and asset loading
- **`networkPhase()`** - Network detection and speed classification
- **`storagePhase()`** - Cache validation and migrations
- **`servicesPhase()`** - Service provider registration
- **`jobSetupPhase()`** - Background job queue setup
- **`authPhase()`** - Session restoration (non-blocking)
- **`featureFlagsPhase()`** - Feature flag loading and application
- **`registrationPhase()`** - Job and subscription registration

### State Management

#### Kernel State Structure

```typescript
interface AppKernelState {
  currentPhase: KernelPhase;
  phases: {
    configReady: boolean;
    preloadReady: boolean;
    networkReady: boolean;
    storageReady: boolean;
    servicesReady: boolean;
    jobSetupReady: boolean;
    authReady: boolean;
    featureFlagsReady: boolean;
    registrationReady: boolean;
    appReady: boolean;
  };
  capabilities: KernelCapabilities; // Network, storage, auth availability
  error?: KernelError;
  progress: PhaseProgress;
}
```

#### Capability Tracking

The kernel tracks system capabilities that may degrade during runtime:

```typescript
interface KernelCapabilities {
  network: boolean;      // Network connectivity available
  storage: boolean;      // Local storage accessible
  auth: boolean;         // Authentication system ready
  database: boolean;     // Database queries possible
  sync: boolean;         // Data synchronization available
  // ... additional capabilities
}
```

### Degradation Integration

The kernel integrates with the degradation system (`system/Degrade`) to track capability availability:

- Phase failures automatically update capability states
- System responses trigger infrastructure adaptation
- UI components can check capabilities before operations
- Recovery mechanisms restore degraded functionality
  error: KernelError | null;
  timing: Record<string, number>; // Phase durations in ms
  capabilities: KernelCapabilities;
  networkStatus: NetworkStatus | null;
  safeMode: SafeModeState | null;
}
```

#### Phase Transitions

Phases advance automatically in sequence. Each phase function:

1. Performs its initialization work
2. Updates state.phases.*Ready = true
3. Records timing data
4. Advances currentPhase to next phase
5. Notifies subscribers of state change

### Error Handling

#### Phase Failures

If a phase fails, the kernel:

1. Sets `state.error` with failure details
2. Sets `currentPhase = "ERROR"`
3. Stops further phase execution
4. Notifies subscribers of error state

#### Recovery

Some errors are recoverable:

```typescript
if (kernel.error?.recoverable) {
  await AppKernel.retry(); // Restart from failed phase
}
```

### Capabilities Detection

The kernel detects platform capabilities during initialization:

```typescript
capabilities: {
  storage: boolean;    // SecureStorage available
  network: boolean;    // Network detection working
  auth: boolean;       // Auth provider configured
  analytics: boolean;  // Analytics exporters ready
  backend: boolean;    // Supabase configured
  platform: "web" | "ios" | "android" | "desktop";
}
```

## Dependencies

### External Packages

- **`expo-constants`** - Environment variable access
- **`expo-font`** - Font loading for preload phase
- **`expo-network`** - Network status detection

### Internal Dependencies

- **`@/managers/analytics/analytics-manager`** - Analytics network integration
- **`@/lib/error`** - Safe mode state management
- **`@/lib/utils/logger`** - Bootstrap logging
- **`@/system/network`** - Network detection system
- **`@/type-definitions/kernel-types`** - Centralized type definitions

## Implementation Details

### Phase Timing

Typical initialization timeline:

- **CONFIG**: 100-150ms (env setup, Supabase init)
- **PRELOAD**: 300-500ms (font loading)
- **NETWORK**: <10ms (event subscription)
- **STORAGE**: 50-100ms (validation + migrations)
- **SERVICES**: 50-100ms (provider registration)
- **JOB_SETUP**: 20-50ms (queue initialization)
- **AUTH**: 500-1000ms (session restore, parallel execution)

### Network Awareness

Storage phase knows network status for intelligent behavior:

- **Online**: Full migration and validation
- **Offline**: Skip network-dependent operations
- **Unknown**: Conservative approach with fallbacks

### Service Registration

Services are registered during SERVICES phase:

```typescript
// Auth provider (required before AUTH phase)
ServiceRegistry.register('auth', authProvider);

// Error tracking
ServiceRegistry.register('errorTracker', sentryClient);

// Analytics
ServiceRegistry.register('analytics', analyticsExporter);
```

### Job Queue Setup

Background job system initialized in JOB_SETUP phase:

- Queue infrastructure setup
- Handler registration for async operations
- Ready for auth-related background tasks

### Auth Phase (Non-blocking)

AUTH phase starts auth restoration but doesn't wait:

- Sets `authReady = true` immediately
- Auth continues in background
- App can render UI while auth completes
- Auth provider guaranteed registered from SERVICES phase

## Error Handling & Edge Cases

### Config Phase Failure

If Supabase credentials missing:

```typescript
error: {
  code: "CONFIG_FAILED",
  message: "Supabase not configured",
  recoverable: true, // Can retry with different config
}
```

### Storage Migration Failure

If cache migration fails:

```typescript
error: {
  code: "STORAGE_FAILED",
  message: "Cache migration failed",
  recoverable: true, // Can retry or reset storage
}
```

### Network Detection Failure

If network monitoring fails:

- Continues with `networkReady = true`
- Uses fallback network status
- Degrades gracefully for offline scenarios

## Performance Notes

### Phase Parallelization

AUTH phase runs in parallel with other operations:

- Starts after JOB_SETUP completes
- Doesn't block READY state
- Allows app to render UI immediately
- Auth completes asynchronously

### Memory Management

Kernel maintains minimal state:

- Phase flags (boolean)
- Timing data (numbers)
- Error objects (when failed)
- Capability flags
- No large data structures

### Monitoring

All phase transitions are logged:

```typescript
logger.category('bootstrap').info('Phase complete', {
  phase: 'STORAGE',
  duration: 85,
  success: true
});
```

## Related Modules

- **`lib/kernel`** - Orchestration layer and React integration
- **`system/network`** - Network detection system
- **`system/storage`** - Storage validation and migrations
- **`lib/auth`** - Authentication system
- **`managers/analytics/analytics-manager`** - Analytics exporters
- **`lib/error`** - Error tracking and safe mode

await AppKernel.initialize();
// App phases execute in order
```

#### `AppKernel.getCurrentPhase(): KernelPhase`

Get current bootstrap phase.

```typescript
const phase = AppKernel.getCurrentPhase();
if (phase === 'READY') {
  // System is initialized
}
```

### Service Registry

#### `ServiceRegistry.register<T>(name: string, service: T): void`

Register a system service.

```typescript
ServiceRegistry.register('database', databaseClient);
ServiceRegistry.register('auth', authProvider);
```

#### `ServiceRegistry.get<T>(name: string): T`

Get registered service instance.

```typescript
const db = ServiceRegistry.get<DatabaseClient>('database');
```

### Phase Management

#### `PhaseManager.advanceTo(phase: KernelPhase): Promise<void>`

Advance to next bootstrap phase.

```typescript
await PhaseManager.advanceTo('STORAGE');
// Storage phase complete
```

## Dependencies

### External

- **None** – Core system layer

### Internal

- **`system/Storage`** – Bootstrap data persistence
- **`system/Services`** – Service provider access

## Error Handling & Edge Cases

### Phase Failure

Bootstrap stops; error details available for recovery.

### Service Missing

Throws error during initialization.

### Concurrent Initialization

Idempotent; multiple calls safe.

## Performance Notes

- **Fast Bootstrap**: Minimal overhead phases
- **Lazy Loading**: Services loaded on demand
- **Event Batching**: Lifecycle events batched
- **Memory Efficient**: Minimal state retention

## Related Modules

- **`lib/kernel`** – Business logic initialization
- **`system/Services`** – Service implementations
- **`system/Storage`** – Bootstrap persistence

## File Breakdown

| File | Purpose |
| --- | --- |
| `app-kernel.ts` | Main kernel implementation |
| `phases/` | Phase management logic |
| `index.ts` | Barrel export |