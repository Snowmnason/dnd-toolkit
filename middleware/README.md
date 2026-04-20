# Middleware Module

Precondition checking and orchestration layer between lib managers and system adapters. Ensures services are ready, network is available, and requests are properly formatted before delegating to system layer. Handles offline queuing, circuit breaker state, and recovery orchestration.

## When to Use This Module

**Use middleware for:**

- API request orchestration (network checks, transformation, offline queuing)
- Service precondition validation (provider ready, network available)
- Cross-cutting concerns (auth level defaults, request labeling, error normalization)
- Recovery coordination (network recovery hooks, circuit breaker integration)

**Don't use middleware for:**

- Business logic validation (belongs in lib managers)
- Data transformation (belongs in lib modules)
- State management (belongs in lib modules)
- UI concerns (belongs in hooks/components)

## Architecture & Data Flow

```
Lib Manager (business logic)
        ↓
Middleware (preconditions + orchestration)
        ├─ Network check (online? quality acceptable?)
        ├─ Service ready (provider initialized?)
        ├─ Data transformation (lib format → system format)
        ├─ Context enrichment (auth level, user ID, labels)
        └─ Offline handling (queue if network unavailable)
        ↓
System Adapter (pure transport)
        ├─ Retry logic
        ├─ Caching
        ├─ Circuit breaker
        └─ HTTP execution
```

**Key Components:**

- **API Middleware** (`api/request-service.ts`) – Network checks, request transformation, offline queuing
- **Service Middleware** (`services/`) – Provider readiness checks, auth/database preconditions
- **Network Recovery** (`api/network-recovery.ts`) – Orchestrates recovery on network state changes
- **Circuit Breaker Integration** – Prevents cascading failures during outages

## API Reference

### API Request Service

#### `executeRequest<T>(key: string, fetcher: () => Promise<T>, options?: ApiMiddlewareOptions): Promise<T>`

Execute API request with middleware checks.

```typescript
import { executeRequest } from '@/middleware/api';

const result = await executeRequest(
  'get-user-profile',
  () => apiClient.get('/user/profile'),
  {
    context: { userId: 'user_123', authLevel: 'user' },
    label: 'Fetch user profile for settings'
  }
);
```

### Service Preconditions

#### Auth Service

```typescript
import { getAuthProvider, isAuthReady } from '@/middleware/services';

// Check if auth operations can proceed
if (isAuthReady()) {
  const provider = getAuthProvider();
  // ... use provider
}
```

#### Database Service

```typescript
import { getDatabaseProvider, isDatabaseReady } from '@/middleware/services';

// Check if database operations can proceed
if (isDatabaseReady()) {
  const provider = getDatabaseProvider();
  // ... use provider
}
```

## Dependencies

### External

- **None** – Pure orchestration layer

### Internal

- **`system/Services`** – Service providers and adapters
- **`system/API`** – Request management and resilience
- **`system/Network`** – Network detection and quality
- **`lib/utils/logger`** – Request logging and tracing

## Error Handling & Edge Cases

### Network Unavailable

Requests with network requirements are queued via `OfflineQueueManager`. Retried when network returns.

### Service Not Ready

Throws typed error indicating bootstrap issue. Should not happen in normal operation.

### Circuit Breaker Open

Requests fail fast when circuit breaker prevents calls. Automatic recovery when service health improves.

### Concurrent Requests

Multiple requests deduplicated at system layer; middleware focuses on preconditions.

## Performance Notes

- **Lightweight checks** – Network status cached, service readiness memoized
- **No blocking operations** – All checks are synchronous and fast (<1ms)
- **Lazy initialization** – Services initialized on first access
- **Minimal overhead** – Pure orchestration, no data processing

## Related Modules

- **`lib/[domain]-manager.ts`** – Calls middleware before system operations
- **`system/API/RequestManager`** – Executes requests after middleware validation
- **`system/Services`** – Provides service adapters checked by middleware
- **`system/Network`** – Supplies network status for precondition checks
- **`lib/offline`** – Handles queued requests when network unavailable

## File Breakdown

| File | Purpose |
| --- | --- |
| `api/request-service.ts` | API request orchestration (network checks, transformation, offline queuing) |
| `api/network-recovery.ts` | Recovery coordination on network state changes |
| `services/auth-service.ts` | Auth service preconditions and provider access |
| `services/database-service.ts` | Database service preconditions and provider access |
| `services/analytics-service.ts` | Analytics service preconditions and provider access |
| `services/error-service.ts` | Error tracking service preconditions and provider access |
| `index.ts` | Barrel export of public API |