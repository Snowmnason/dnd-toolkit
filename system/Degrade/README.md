# System Degrade Module

Foundation layer for tracking and responding to app capability degradation. Provides reference-counted capability state management with automatic system-level responses. Framework-independent infrastructure for graceful degradation handling.

## When to Use This Module

**Use this module for:**

- Tracking app capability availability across multiple sources (network, database, auth, storage, etc.)
- Registering system-level responses to capability state changes
- Coordinating infrastructure-level degradation responses (stopping jobs, switching transports)
- Managing reference-counted capability states with multiple reporters

**Do NOT use this module for:**

- UI-level degradation responses (use lib/degradation instead)
- Business logic error handling (use lib/error)
- Application-specific degradation logic (use lib modules)
- User-facing error messages (use components)

## Architecture & Data Flow

```
Multiple Sources (network, auth, storage, etc.)
        ↓
DegradeManager.set(capability, available, {source, reason})
        ↓
Reference Counting: capability = ALL sources report available
        ↓
System Response Handlers execute automatically
        ↓
Infrastructure adapts (jobs pause, transports switch, etc.)
```

**Key Principles:**

- **Reference Counting**: Capability available only when ALL sources report it as available
- **System-Level Responses**: Infrastructure concerns (job queues, network transports, storage fallbacks)
- **Event-Driven**: State changes trigger automatic responses without polling
- **Source Tracking**: Each capability state change includes source and reason metadata
- **Framework-Independent**: No React or UI dependencies

## API Reference

### DegradeManager (appDegrade) singleton

Central singleton for managing capability degradation state.

#### `appDegrade` (preferred)

Use the shared singleton instance exported by the module.

```typescript
import { appDegrade } from '@/system/Degrade';

// the appDegrade instance is the central manager; there is no getInstance() API.
appDegrade.set(DegradeCapability.STORAGE, false, {
  source: 'storage-health-check',
  reason: 'Storage backend not available',
});
```

#### `degrade.set(capability, value, options)`

Update capability state from a specific source.

```typescript
// Report network connectivity lost
degrade.set(DegradeCapability.CONNECTIVITY, false, {
  source: 'network-detector',
  reason: 'No internet connection detected'
});

// Report database available
degrade.set(DegradeCapability.DATABASE, true, {
  source: 'supabase-client',
  reason: 'Connection established'
});
```

#### `degrade.isCapable(capability): boolean`

Check if a capability is currently available.

```typescript
if (degrade.isCapable(DegradeCapability.SYNC)) {
  // Safe to perform sync operations
}
```

#### `degrade.getState(): DegradeState`

Get complete degradation state snapshot.

```typescript
const state = appDegrade.getState();
console.log(state.capabilities.sync.value); // true/false
console.log(state.capabilities.sync.reason); // reason text
console.log(state.timestamp); // snapshot timestamp
```

#### `degrade.registerResponse(capability, handler): () => void`

Register system-level response handler for capability changes.

```typescript
const unregister = degrade.registerResponse(DegradeCapability.CONNECTIVITY, ({available}) => {
  if (!available) {
    // Switch to offline transport
    switchToOfflineMode();
  } else {
    // Resume online operations
    resumeOnlineSync();
  }
});

// Later: unregister(); // Remove handler
```

#### `degrade.subscribe(callback): () => void`

Subscribe to state changes. Returns unsubscribe function.

```typescript
const unsubscribe = degrade.subscribe((state) => {
  console.log('Capabilities changed:', state.capabilities);
});

unsubscribe(); // Stop listening
```

## Capability Types

All supported capabilities that can degrade:

- **CONNECTIVITY**: Network connectivity (online/offline)
- **DATABASE**: Database queries and writes
- **AUTH**: Authentication and session validation
- **STORAGE**: Local storage access
- **SYNC**: Data synchronization
- **BACKGROUND_JOBS**: Background job processing
- **ANALYTICS**: Analytics tracking
- **ERROR_TRACKING**: Error reporting
- **FEATURE_FLAGS**: Feature flag loading
- **PREMIUM_FEATURES**: Premium feature access

## Response Handlers

System-level response handlers for automatic infrastructure adaptation:

### Connectivity Handler (`handlers/connectivity-handler.ts`)

Manages network state transitions:
- Switches between online/offline transports
- Pauses/resumes background sync
- Updates network-aware caches

### Crash Handlers (`handlers/crash-handlers.ts`)

Handles critical system failures:
- Triggers safe mode for non-recoverable errors
- Captures system state for diagnostics
- Prevents cascading failures

### Fault Handlers (`handlers/fault-handlers.ts`)

Manages service-level faults:
- Retries failed operations with backoff
- Switches to fallback services
- Updates health monitoring

### System Responses (`responses/system-responses.ts`)

Central registry of system response handlers:
- Job queue management (pause/resume)
- Storage fallback switching
- Network transport selection
- Service health monitoring

## Error Handling

Degradation system is designed to be fault-tolerant:

- Response handler errors never crash the degradation system
- Invalid capability names are logged but don't throw
- State updates are atomic and thread-safe
- Source tracking prevents duplicate registrations

## Testing

### Unit Tests
- Capability state transitions
- Reference counting logic
- Response handler execution
- Error handling edge cases

### Integration Tests
- Multi-source capability reporting
- System response coordination
- State persistence across restarts
- Performance under high-frequency updates

## Dependencies

- `@/type-definitions/degrade`: Core types and interfaces
- `@/lib/utils`: Logging utilities
- No external dependencies (framework-independent)