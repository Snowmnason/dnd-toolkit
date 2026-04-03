# Kernel Phase Control - Degradation Implementation

Comprehensive implementation guide for the centralized degradation framework that manages system failures and capability states across the application.

## Overview

The degradation framework provides graceful handling of system failures through a priority-based error queue and capability flags. Multiple systems can report faults, which are aggregated and prioritized to prevent UI flickering and ensure critical failures are handled first.

## Architecture

```
System Components → Degrade Manager → Degradation Service → appDegrade
       ↓                    ↓                    ↓              ↓
   Report faults      Queue by priority     Update flags    UI observes
   (network down,     (network > auth >     (set capability  (show offline
    DB unavailable)    storage > sync)      flags)          banner)
```

### Core Components

- **`appDegrade`**: System-level singleton managing capability flags
- **`DegradeManager`**: Lib-level manager handling error prioritization and history
- **`DegradationService`**: Middleware layer for precondition checks
- **Error Queue**: Priority-ordered processing (0=highest, 99=lowest)

## Implementation Tracks

### Track 1: System Foundation

**Create `system/Degrade/` infrastructure:**

```typescript
// system/Degrade/types.ts
export enum DegradeCapability {
  CONNECTIVITY = "connectivity",
  DATABASE = "database",
  AUTH = "auth",
  STORAGE = "storage",
  SYNC = "sync",
  BACKGROUND_JOBS = "backgroundJobs",
  ANALYTICS = "analytics",
  ERROR_TRACKING = "errorTracking",
  PREMIUM_FEATURES = "premiumFeatures"
}

export interface DegradeCapabilityState {
  value: boolean;
  reason: string;
  source: string;
  updatedAt: number;
}
```

```typescript
// system/Degrade/app-degrade.ts
export class DegradeManager {
  set(capability: DegradeCapability, value: boolean, context: { source: string; reason: string });
  subscribe(callback: (state: DegradeState) => void): () => void;
  getState(): DegradeState;
  isCapable(capability: DegradeCapability): boolean;
}

export const appDegrade = new DegradeManager();
```

### Track 2: Priority Queue System

**Implement error prioritization in `lib/error/degrade/degrade-manager.ts`:**

```typescript
const PRIORITY_MAP = {
  [DegradeCapability.CONNECTIVITY]: 0,      // Network foundation
  [DegradeCapability.AUTH]: 1,              // Critical for data access
  [DegradeCapability.STORAGE]: 2,           // Blocks all persistence
  [DegradeCapability.DATABASE]: 3,          // Data operations
  [DegradeCapability.SYNC]: 4,              // Background data sync
  [DegradeCapability.BACKGROUND_JOBS]: 5,   // Non-critical operations
  [DegradeCapability.ANALYTICS]: 6,         // Telemetry (optional)
  [DegradeCapability.ERROR_TRACKING]: 7,    // Error reporting (optional)
  [DegradeCapability.PREMIUM_FEATURES]: 99   // Features (lowest priority)
};
```

**Manager API:**
```typescript
export class DegradeManager {
  reportFault(capability: DegradeCapability, reason: string, context?: any): void;
  reportCrash(capability: DegradeCapability, reason: string, context?: any): void;
  reportRecovery(capability: DegradeCapability, reason?: string): void;
  getDegradationState(): DegradeState;
  isCapableOf(capability: DegradeCapability): boolean;
  subscribeToDegradation(callback: (state: DegradeState) => void): () => void;
}
```

### Track 3: Bootstrap Integration

**Wire phase failures to degradation system:**

```typescript
// system/Kernel/phases/network-phase.ts
try {
  await initializeNetwork();
} catch (error) {
  appDegrade.set('connectivity', false, {
    source: 'network-phase',
    reason: error.message
  });
  // Continue with offline fallback
}
```

**Key phase integrations:**
- `network-phase.ts` → `connectivity` flag
- `services-phase.ts` → `database`, `auth` flags
- `storage-phase.ts` → `storage` flag
- `auth-phase.ts` → `auth` flag
- `job-setup-phase.ts` → `backgroundJobs` flag

### Track 4: Middleware Layer

**Create precondition checks in `lib/middleware/degrade/degradation-service.ts`:**

```typescript
export class DegradationService {
  updateDegradation(error: DegradeError): void {
    // Validate preconditions
    // Call appDegrade.set() with validated state
  }
}
```

**Service responsibilities:**
- Precondition validation (network status, consent, service readiness)
- Safe state updates (never call appDegrade directly from middleware)
- No business logic duplication

### Track 5: Bootstrap Error Routing

**Wire middleware fault detection to manager:**

```typescript
// lib/middleware/services/database-service.ts
import { degradeManager } from '@/lib/error/degrade';

export async function getDatabase(): Promise<DatabaseProvider> {
  try {
    return await initDatabase();
  } catch (error) {
    logger.warn('Database unavailable');
    degradeManager.reportFault('database', error.message, { phase: 'bootstrap' });
    throw error; // Preserve existing behavior
  }
}
```

**Integration points:**
- `database-service.ts` → Database faults
- `auth-service.ts` → Auth provider faults
- `error-service.ts` → Error tracking faults
- `analytics-service.ts` → Analytics faults
- `exporter-registry.ts` → Analytics availability
- `feature-flags-manager.ts` → Premium feature faults

### Track 6: Runtime Error Handling

**Replace inline safe mode calls with centralized crash reporting:**

```typescript
// Before: lib/offline/sync-manager.ts
if (cascadeDetected) {
  setSafeMode(NETWORK_CASCADE);
}

// After:
if (cascadeDetected) {
  degradeManager.reportCrash('sync', 'cascade-detected', cascadeDetails);
}
```

**Runtime integrations:**
- `sync-manager.ts` → Sync cascade crashes
- `auth-health-monitor.ts` → Session expiration crashes
- `storage-health-monitor.ts` → Storage corruption crashes

### Track 7: Response Handlers

**Create capability-specific response logic in `system/Degrade/handlers/`:**

```typescript
// system/Degrade/handlers/fault-handlers.ts
export function handleConnectivityDegraded(isOnline: boolean): void {
  if (!isOnline) {
    // Show offline banner, queue mutations, disable real-time features
    notifyUI('offline-mode', { canRetry: false });
  }
}

export function handleDatabaseDegraded(isAvailable: boolean): void {
  if (!isAvailable && appDegrade.isCapable('connectivity')) {
    // Partial offline: queue mutations, show unavailable indicator
    notifyUI('database-unavailable', { canRetry: true });
  }
}
```

**Handler categories:**
- **Fault handlers**: Graceful degradation (connectivity, database, auth, sync)
- **Crash handlers**: Unrecoverable failures requiring safe mode (storage)

## Error Priority Map

| Priority | Capability | Trigger | Response |
|----------|------------|---------|----------|
| 0 | `connectivity` | Network init fails / goes offline | Full offline mode |
| 1 | `auth` | Provider fails / session expires | Authentication lock |
| 2 | `storage` | Corruption / unreadable | Safe mode crash |
| 3 | `database` | Provider unavailable | Partial offline |
| 4 | `sync` | Cascade detected | Sync paused |
| 5 | `backgroundJobs` | Queue fails | Jobs disabled |
| 6 | `analytics` | Exporter unavailable | Silent failure |
| 7 | `errorTracking` | Tracker unavailable | Silent failure |
| 99 | `premiumFeatures` | Entitlements fail | Feature lock |

## UI Integration

**Create React hooks for capability checking:**

```typescript
// hooks/degrade/useCapability.ts
export function useCapability(capability: DegradeCapability): boolean {
  const [state, setState] = useState(appDegrade.getState());

  useEffect(() => {
    return appDegrade.subscribe(setState);
  }, []);

  return state.capabilities[capability]?.value ?? true;
}

// Usage in components
function SyncButton() {
  const canSync = useCapability('sync');
  return canSync ? <Button>Sync Now</Button> : <Text>Sync Paused</Text>;
}
```

## Testing Strategy

**Unit tests for each layer:**
- `appDegrade` state management
- `DegradeManager` priority queuing
- `DegradationService` precondition checks
- Response handlers behavior

**Integration tests:**
- Bootstrap failure scenarios
- Runtime error cascades
- Recovery flows
- UI adaptation

## Migration Notes

**Boundary enforcement:**
- Middleware → Manager (not direct to appDegrade)
- Manager → Service (not direct to appDegrade)
- Service → appDegrade (only layer that calls set)

**Preserve existing behavior:**
- Fallback logic remains intact
- Error logging continues
- Recovery mechanisms unchanged
- Only adds centralized state management

## Success Criteria

- ✅ Single source of truth for all capability states
- ✅ Priority-based error processing prevents UI flickering
- ✅ Graceful degradation for all failure scenarios
- ✅ Centralized response handlers for consistent behavior
- ✅ Clean separation between detection, queuing, and response
- ✅ No scattered inline degradation logic
- ✅ Observable state for UI adaptation