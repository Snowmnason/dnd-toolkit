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
Phase Execution (CONFIG → PRELOAD → STORAGE → AUTH → READY)
                      ↓
Service Registration → Dependency Injection
                      ↓
System Ready → Emit Events → App Continues
```

**Key Components:**

- **AppKernel**: Main kernel class managing phases
- **PhaseManager**: Handles phase transitions and validation
- **ServiceRegistry**: Registers and provides system services
- **EventEmitter**: Broadcasts lifecycle events

## API Reference

### App Kernel

#### `AppKernel.initialize(): Promise<void>`

Initialize the app kernel and execute bootstrap phases.

```typescript
import { AppKernel } from '@/system/Kernel';

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