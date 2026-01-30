# Implementation Notes for Developers

**Purpose**: Reference guide for understanding how the codebase uses these enhancements  
**Audience**: Developers maintaining or extending the project  
**Last Updated**: January 30, 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Integration Points](#core-integration-points)
3. [Module Structure](#module-structure)
4. [How Features Are Used in the Project](#how-features-are-used-in-the-project)
5. [Testing Patterns](#testing-patterns)
6. [Common Extension Points](#common-extension-points)

---

## Architecture Overview

### Data Flow

```
User Action (Query/Mutation)
  ↓
APIClient (Factory Pattern)
  ├─ RequestManager (handles options, deduplication, cache)
  ├─ AuthLayer (validates strategy, injects token)
  ├─ InterceptorManager (logging, tracing, timeout)
  ├─ CircuitBreaker (prevents cascading failures)
  └─ QueryCache (stores responses)
    ↓
    ├─ Online: Fetch → Cache → Return
    └─ Offline: Queue → Return promise when online
      ↓
OnlineSyncManager
  ├─ Checks network status
  ├─ Retrieves queued mutations
  ├─ Calls sync handlers per table
  ├─ Tracks per-mutation success/failure
  ├─ Updates circuit breaker state
  └─ Emits events (syncStarted, syncCompleted)
```

### Key Modules

| Module                   | File                              | Responsibility                              |
| ------------------------ | --------------------------------- | ------------------------------------------- |
| **APIClient**            | `lib/api/client-factory.ts`       | Factory for domain-specific API clients     |
| **RequestManager**       | `lib/api/request-manager.ts`      | Core request orchestration, dedup, retries  |
| **AuthLayer**            | `lib/api/auth-layer.ts`           | Auth validation and token injection         |
| **InterceptorManager**   | `lib/api/interceptor.ts`          | Request/response hooks for logging, tracing |
| **CircuitBreaker**       | `lib/api/circuit-breaker.ts`      | Prevents cascading failures                 |
| **OfflineMutationQueue** | `lib/offline/mutation-queue.ts`   | Stores mutations when offline               |
| **OnlineSyncManager**    | `lib/offline/sync-manager.ts`     | Orchestrates offline replay                 |
| **Phase4Enhancements**   | `lib/offline/offline-recovery.ts` | Auth, redaction, backoff, telemetry         |
| **QueryCache**           | `lib/cache/query-cache.ts`        | In-memory caching with tags                 |

---

## Core Integration Points

### 1. RequestManager - The Orchestrator

**Location**: `lib/api/request-manager.ts`

The RequestManager is the heart of request handling. Every query/mutation flows through here:

```typescript
async request(method, endpoint, data, options) {
  // 1. Validate auth strategy
  if (options.authStrategy) {
    const token = await authLayer.getToken(options.authStrategy);
  }

  // 2. Check QueryCache
  const cached = await queryCache.get(cacheKey, options);
  if (cached && !isStale) return cached; // ✅ Cache hit

  // 3. For stale data, return immediately + revalidate in background
  if (cached && isStale && options.staleWhileRevalidate) {
    this._revalidateInBackground(...);
    return cached; // ✅ Stale data returned immediately
  }

  // 4. Check circuit breaker
  if (circuitBreaker.isOpen(endpoint)) {
    throw new CircuitBreakerOpenError();
  }

  // 5. Deduplicate concurrent identical requests
  const existingPromise = this._dedupeMap.get(cacheKey);
  if (existingPromise) return existingPromise;

  // 6. Make actual request with interceptors
  const promise = this._makeRequest(method, endpoint, data, options);
  this._dedupeMap.set(cacheKey, promise);

  // 7. Handle response or error
  try {
    const response = await promise;
    circuitBreaker.recordSuccess(endpoint);
    await queryCache.set(cacheKey, response, options);
    return response;
  } catch (error) {
    circuitBreaker.recordFailure(endpoint);

    // 8. Queue mutation offline if applicable
    if (isMutation && isOffline) {
      await offlineQueue.enqueue({
        table: endpoint,
        operation: method,
        payload: data,
        authStrategy: options.authStrategy,
      });
      return queued;
    }
    throw error;
  }
}
```

**Key concepts**:

- Single source of truth for all requests
- Cache layer integrates seamlessly
- Offline queueing happens automatically
- Error handling triggers circuit breaker

### 2. AuthLayer - Validation & Token Injection

**Location**: `lib/api/auth-layer.ts`

Handles authentication strategy validation and token management:

```typescript
// Example: User auth strategy
class AuthLayer {
  private strategies = {
    user: {
      validate: () => authStateManager.isAuthenticated(),
      getToken: () => supabase.auth.session().access_token,
    },
    admin: {
      validate: () => authStateManager.isAdmin(),
      getToken: () => supabase.auth.session().access_token,
    },
    guest: {
      validate: () => true,
      getToken: () => null,
    },
  };

  async getToken(strategy) {
    if (!strategy) return null; // No auth needed

    const authConfig = this.strategies[strategy];
    if (!authConfig) throw new Error(`Unknown strategy: ${strategy}`);

    if (!authConfig.validate()) {
      throw new AuthError(`User not ${strategy}`);
    }

    return authConfig.getToken();
  }
}
```

**Used in**:

- RequestManager (every request validated)
- OfflineRecovery (auth replay injects fresh token)
- APIClient subclasses (define which endpoints need which auth)

### 3. QueryCache - Caching Strategy

**Location**: `lib/cache/query-cache.ts`

Persistent caching with tag-based invalidation:

```typescript
// APIClient usage
async getUsers(options) {
  return this.query("getUsers", "/users", {
    useQueryCache: true,
    staleTime: 5 * 60 * 1000,    // Stale after 5 min
    cacheTime: 60 * 60 * 1000,   // Remove from cache after 1 hour
    tags: ["users"],              // Tag for invalidation
  });
}

async updateUser(userId, data, options) {
  return this.mutation("updateUser", `/users/${userId}`, data, {
    invalidateTags: [`users`, `user:${userId}`],  // Invalidate related caches
  });
}
```

**Invalidation pattern**:

- `invalidateTags` automatically removes all caches with matching tags
- After mutation succeeds, related queries re-fetch automatically
- User sees fresh data without explicit refetches

### 4. OfflineMutationQueue - Persistence

**Location**: `lib/offline/mutation-queue.ts`

Stores mutations for later replay when offline:

```typescript
class OfflineMutationQueue {
  async enqueue(mutation) {
    // Add Phase 4 fields
    const prepared = await Phase4Enhancements.prepareForQueue(mutation);

    // Persist to SecureStorage
    const stored = {
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0,
      nextAttemptAt: null,
      lastErrorType: null,
      lastErrorMessage: null,
      lastAttemptAt: null,
      ...prepared,
    };

    await SecureStorage.set(`mutation:${id}`, JSON.stringify(stored));
    this._mutations.push(stored);
    return stored;
  }

  async getReadyBatch() {
    // Get mutations ready to retry (backoff window passed)
    return this._mutations.filter((m) => BackoffScheduler.isReadyToRetry(m));
  }

  async getStats() {
    // Collect telemetry
    return OfflineQueueStatsCollector.collectStats(this._mutations);
  }
}
```

**Key features**:

- Each mutation stored separately (partial failure handling)
- Phase 4 enhancements applied before storage
- Stats collected automatically for observability
- Survives app restart (persisted to SecureStorage)

### 5. OnlineSyncManager - Replay Orchestration

**Location**: `lib/offline/sync-manager.ts`

Replays queued mutations when network returns:

```typescript
class OnlineSyncManager {
  async syncAll() {
    this.emit("syncStarted");

    const batch = await queue.getReadyBatch();
    const results = {
      syncedCount: 0,
      failedCount: 0,
      conflictedCount: 0,
    };

    for (const mutation of batch) {
      try {
        // 1. Get appropriate sync handler
        const handler = this._handlers[mutation.table];

        // 2. Call handler with mutation context
        const result = await handler(
          mutation.payload,
          mutation.operation,
          supabase, // For complex queries
        );

        // 3. If successful, remove from queue
        if (result.success) {
          await queue.remove(mutation.id);
          results.syncedCount++;

          // Update cache with returned data
          await queryCache.invalidate([`${mutation.table}:*`]);

          // Record CB success
          await CircuitBreakerReplayManager.recordReplaySuccess(mutation);
        }
      } catch (error) {
        // 4. On failure, update mutation with error info
        const contract = NetworkErrorClassifier.classify(error);

        await queue.updateMutation(mutation.id, {
          lastErrorType: contract.type,
          lastErrorMessage: error.message,
          lastAttemptAt: Date.now(),
          retryCount: mutation.retryCount + 1,
        });

        // Schedule next retry with backoff
        if (contract.retryable) {
          const nextAttemptAt =
            BackoffScheduler.calculateNextAttemptAt(mutation);
          await queue.updateScheduledRetry(mutation.id, nextAttemptAt);

          // Record CB failure
          await CircuitBreakerReplayManager.recordReplayFailure(
            mutation,
            error,
            contract.type === "network",
          );

          results.failedCount++;
        } else {
          // Not retryable - user action needed
          results.conflictedCount++;
        }
      }
    }

    this.emit("syncCompleted", results);
    return results;
  }
}
```

**Sync handler registration**:

```typescript
// Define how to replay mutations for each table
OnlineSyncManager.registerSyncHandler(
  "notes",
  async (payload, operation, supabase) => {
    // Create/update/delete via Supabase
    if (operation === "create") {
      const { data, error } = await supabase
        .from("notes")
        .insert(payload)
        .single();

      if (error) {
        return {
          success: false,
          error: error.message,
          errorType: "validation", // or "conflict", "server", etc
        };
      }
      return { success: true, data };
    }
    // ... handle other operations
  },
);
```

### 6. Phase 4 Enhancements - Safety & Observability

**Location**: `lib/offline/offline-recovery.ts`

All Phase 4 features live here:

```typescript
// Applied to every queued mutation
async prepareForQueue(mutation) {
  // 1. Redact sensitive data
  const redactedPayload = RedactionManager.redactObject(
    mutation.payload
  );

  // 2. Store auth strategy for replay
  const authContext = await AuthReplayManager.prepareAuthContext(
    mutation
  );

  return {
    ...mutation,
    payload: redactedPayload,
    authStrategy: mutation.authStrategy, // For auth injection on replay
  };
}

// Called when mutation fails
NetworkErrorClassifier.classify(error, statusCode)
  // Returns: { type: "network" | "auth" | "validation" | ... }

// Called on every retry
BackoffScheduler.calculateNextAttemptAt(mutation)
  // Returns: timestamp for next attempt (with jitter)

// Called after sync completes
OfflineQueueStatsCollector.collectStats(mutations)
  // Returns: aggregated failure statistics by type

// Called when replay fails
CircuitBreakerReplayManager.recordReplayFailure(mutation, error, isNetworkError)
  // Updates CB state for endpoint

// Called when replay succeeds
CircuitBreakerReplayManager.recordReplaySuccess(mutation)
  // Resets CB state for endpoint

// Called in custom sync handlers
FetcherRegistryFallback.createHttpClient(mutation, authLayer)
  // Returns: { get, post, patch, delete } with auto-auth
```

---

## Module Structure

### `lib/api/` - Request Handling

```
lib/api/
├── index.ts                    # Public exports
├── client-factory.ts           # APIClient base class
├── request-manager.ts          # Core request orchestration
├── auth-layer.ts               # Auth validation
├── interceptor.ts              # Request/response hooks
├── circuit-breaker.ts          # CB pattern
├── network-recovery.ts         # Network detection
├── network-recovery-retry-job.ts # Background retry job
├── offline-queue.ts            # Legacy offline (deprecated)
├── offline-queue-replay.ts     # Legacy replay (deprecated)
├── clients/
│   ├── defaults.ts             # Cache defaults
│   ├── users.ts                # Example API client
│   └── worlds.ts               # Example API client
└── default-strategies.ts       # Auth strategy factories
```

**Key exports**:

- `APIClient` - Extend this to create domain-specific clients
- `RequestManager` - Handles all requests (used internally)
- `AuthLayer` - Manages auth validation (used internally)
- `CircuitBreakerManager` - CB state tracking

### `lib/offline/` - Offline & Replay

```
lib/offline/
├── index.ts                    # Public exports
├── types.ts                    # Type definitions
├── mutation-queue.ts           # Store mutations offline
├── sync-manager.ts             # Replay mutations online
├── offline-recovery.ts         # Phase 4 enhancements
└── handlers/
    └── default-sync-handlers.ts # Built-in sync handlers
```

**Key exports**:

- `OfflineMutationQueue` - Store/retrieve offline mutations
- `OnlineSyncManager` - Orchestrate replay
- `Phase4Enhancements` - Auth, redaction, backoff, telemetry
- All Phase 4 managers (RedactionManager, AuthReplayManager, etc.)

### `lib/cache/` - Data Caching

```
lib/cache/
├── index.ts                    # Public exports
├── query-cache.ts              # In-memory cache with tags
└── cache-versioning.ts         # Version management
```

**Key exports**:

- `QueryCache` - Store/retrieve/invalidate caches

---

## How Features Are Used in the Project

### Creating an API Client

```typescript
// lib/api/clients/users.ts
import { APIClient, type QueryOptions, type MutationOptions } from "../client-factory";

export class UsersAPI extends APIClient {
  // Query - read-only, cacheable
  async getUsers(options?: QueryOptions) {
    return this.query("getUsers", "/users", {
      useQueryCache: true,
      staleTime: 5 * 60 * 1000,
      cacheTime: 60 * 60 * 1000,
      tags: ["users"],
      authStrategy: undefined, // Public endpoint
    });
  }

  // Query - get single user
  async getUser(id: string, options?: QueryOptions) {
    return this.query("getUser", `/users/${id}`, {
      useQueryCache: true,
      staleTime: 5 * 60 * 1000,
      tags: [`user:${id}`],
      authStrategy: "user",  // Requires user auth
      ...options,
    });
  }

  // Mutation - write operation
  async updateUser(
    userId: string,
    data: any,
    options?: MutationOptions
  ) {
    return this.mutation("updateUser", `/users/${userId}`, data, {
      method: "PATCH",
      authStrategy: "user",        // Requires user auth
      invalidateTags: [
        "users",                    // Invalidate list
        `user:${userId}`,           // Invalidate single
      ],
      ...options,
    });
  }
}

// Usage in component
import { UsersAPI } from "@/lib/api";

export function UserList() {
  const api = new UsersAPI(httpClient);

  // First request - fetches from network
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.getUsers({
      staleWhileRevalidate: true,  // Return cached immediately
    }),
  });

  return (
    <div>
      {users.map(user => (
        <UserCard key={user.id} user={user} api={api} />
      ))}
    </div>
  );
}
```

### Registering Sync Handlers

```typescript
// lib/offline/handlers/default-sync-handlers.ts
import { OnlineSyncManager } from "../sync-manager";

OnlineSyncManager.registerSyncHandler(
  "users",
  async (payload, operation, supabase) => {
    if (operation === "create") {
      const { data, error } = await supabase
        .from("users")
        .insert([payload])
        .select()
        .single();

      if (error) {
        // Classify error for retry decisions
        return {
          success: false,
          error: error.message,
          errorType: error.code === "23505" ? "conflict" : "server",
        };
      }

      return { success: true, data };
    }

    if (operation === "update") {
      const { data, error } = await supabase
        .from("users")
        .update(payload)
        .eq("id", payload.id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message,
          errorType: "validation",
        };
      }

      return { success: true, data };
    }

    return {
      success: false,
      error: `Unknown operation: ${operation}`,
      errorType: "validation",
    };
  },
);
```

### Monitoring Sync Progress

```typescript
// hooks/use-offline-sync.ts
import { OnlineSyncManager } from "@/lib/offline";

export function useSyncStatus() {
  const [status, setStatus] = useState({
    isSyncing: false,
    queued: 0,
    failedCount: 0,
  });

  useEffect(() => {
    const unsubscribeSyncStart = OnlineSyncManager.on("syncStarted", () => {
      setStatus(s => ({ ...s, isSyncing: true }));
    });

    const unsubscribeSyncComplete = OnlineSyncManager.on("syncCompleted", async (result) => {
      const stats = await OnlineSyncManager.getQueueStats();
      setStatus({
        isSyncing: false,
        queued: stats.totalQueued,
        failedCount: result.failedCount,
      });
    });

    return () => {
      unsubscribeSyncStart();
      unsubscribeSyncComplete();
    };
  }, []);

  return status;
}

// Usage in component
export function SyncIndicator() {
  const { isSyncing, queued } = useSyncStatus();

  return (
    <div>
      {isSyncing && <Spinner />}
      {queued > 0 && <Badge>{queued} queued</Badge>}
    </div>
  );
}
```

### Error Handling in Components

```typescript
// Handle different error types appropriately
async function handleUserUpdate(userId, data) {
  try {
    await usersAPI.updateUser(userId, data);
  } catch (error) {
    // Error is automatically queued if offline
    // Component receives error after it's been classified

    if (error.message.includes("Unauthorized")) {
      showDialog({
        title: "Sign In Required",
        message: "Please sign in to make changes",
      });
    } else if (error.message.includes("validation")) {
      showDialog({
        title: "Invalid Input",
        message: "Please check your data and try again",
      });
    } else if (error.message.includes("Conflict")) {
      showDialog({
        title: "Conflict",
        message: "Data changed on server. Refresh and try again.",
      });
    } else {
      showToast("Saved offline. Will sync when online.");
    }
  }
}
```

---

## Testing Patterns

### Unit Testing API Clients

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UsersAPI } from "@/lib/api/clients/users";

describe("UsersAPI", () => {
  let mockHttpClient: any;
  let api: UsersAPI;

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
    };
    api = new UsersAPI(mockHttpClient);
  });

  it("should cache user queries", async () => {
    mockHttpClient.get.mockResolvedValueOnce({ id: "1", name: "John" });

    // First call - hits network
    await api.getUser("1", { useQueryCache: true });
    expect(mockHttpClient.get).toHaveBeenCalledTimes(1);

    // Second call - hits cache
    await api.getUser("1", { useQueryCache: true });
    expect(mockHttpClient.get).toHaveBeenCalledTimes(1); // Not called again
  });

  it("should queue mutations offline", async () => {
    mockHttpClient.patch.mockRejectedValueOnce(new Error("Network error"));

    const result = await api.updateUser("1", { name: "Jane" });

    expect(result).toHaveProperty("queued", true);
    const queue = await OfflineMutationQueue.getInstance();
    const queued = queue.getAll();
    expect(queued).toHaveLength(1);
  });

  it("should invalidate related caches on mutation", async () => {
    const invalidateSpy = vi.spyOn(QueryCache.getInstance(), "invalidate");

    mockHttpClient.patch.mockResolvedValueOnce({ success: true });

    await api.updateUser("1", { name: "Jane" });

    expect(invalidateSpy).toHaveBeenCalledWith(["users", "user:1"]);
  });
});
```

### Testing Offline & Replay

```typescript
describe("Offline Replay", () => {
  it("should replay mutations with fresh auth", async () => {
    // 1. Queue mutation with old token
    const mutation = await queue.enqueue({
      table: "notes",
      operation: "create",
      payload: { title: "Test" },
      authStrategy: "user",
    });

    // 2. Verify token not stored
    const stored = JSON.parse(
      await SecureStorage.get(`mutation:${mutation.id}`),
    );
    expect(stored.payload).not.toHaveProperty("token");

    // 3. Mock auth layer to return fresh token
    const freshToken = "fresh_token_xyz";
    vi.spyOn(authLayer, "getToken").mockResolvedValueOnce(freshToken);

    // 4. Replay mutation
    const syncHandler = vi.fn().mockResolvedValueOnce({ success: true });
    OnlineSyncManager.registerSyncHandler("notes", syncHandler);

    const result = await OnlineSyncManager.syncAll();

    // 5. Verify sync handler called with fresh auth context
    expect(syncHandler).toHaveBeenCalled();
    expect(result.syncedCount).toBe(1);
  });

  it("should classify errors and schedule retries", async () => {
    const mutation = await queue.enqueue({
      table: "notes",
      operation: "create",
      payload: { title: "Test" },
    });

    // Mock handler to fail with network error
    vi.spyOn(OnlineSyncManager, "_handlers").value({
      notes: vi.fn().mockRejectedValueOnce(new Error("Network timeout")),
    });

    await OnlineSyncManager.syncAll();

    // Verify mutation scheduled for retry
    const updated = await queue.getMutation(mutation.id);
    expect(updated.lastErrorType).toBe("network");
    expect(updated.nextAttemptAt).toBeGreaterThan(Date.now());
  });

  it("should handle partial batch failures", async () => {
    // Queue multiple mutations
    const mut1 = await queue.enqueue({
      table: "notes",
      operation: "create",
      payload: {},
    });
    const mut2 = await queue.enqueue({
      table: "notes",
      operation: "create",
      payload: {},
    });
    const mut3 = await queue.enqueue({
      table: "notes",
      operation: "create",
      payload: {},
    });

    // Mock handler: 1st succeeds, 2nd fails, 3rd succeeds
    let callCount = 0;
    const syncHandler = vi.fn(async () => {
      callCount++;
      if (callCount === 2) throw new Error("Validation error");
      return { success: true };
    });

    OnlineSyncManager.registerSyncHandler("notes", syncHandler);
    const result = await OnlineSyncManager.syncAll();

    expect(result.syncedCount).toBe(2);
    expect(result.failedCount).toBe(1);

    // Verify partial state
    expect(await queue.getAll()).toHaveLength(1); // Only failed one remains
  });
});
```

---

## Common Extension Points

### Adding a New API Client

```typescript
// 1. Create client file
export class ItemsAPI extends APIClient {
  async listItems(options?: QueryOptions) {
    return this.query("listItems", "/items", {
      useQueryCache: true,
      tags: ["items"],
      ...options,
    });
  }

  async createItem(data: any, options?: MutationOptions) {
    return this.mutation("createItem", "/items", data, {
      method: "POST",
      invalidateTags: ["items"],
      authStrategy: "user",
      ...options,
    });
  }
}

// 2. Export from lib/api/index.ts
export { ItemsAPI } from "./clients/items";

// 3. Register sync handler
OnlineSyncManager.registerSyncHandler(
  "items",
  async (payload, operation, supabase) => {
    // Custom replay logic
  },
);

// 4. Use in components
const itemsAPI = new ItemsAPI(httpClient);
const items = await itemsAPI.listItems();
```

### Adding a Custom Auth Strategy

```typescript
// 1. Define strategy in AuthLayer
authLayer.registerStrategy("api_key", {
  validate: () => !!config.apiKey,
  getToken: () => `Bearer ${config.apiKey}`,
});

// 2. Use in API client
async getPublicData() {
  return this.query("getPublicData", "/public", {
    authStrategy: "api_key",
  });
}
```

### Adding a Custom Interceptor

```typescript
// 1. Register interceptor
InterceptorManager.registerInterceptor({
  // Called before request
  onRequest: (request, context) => {
    console.log(`[${context.requestId}] ${request.method} ${request.url}`);
    return request;
  },

  // Called after response
  onResponse: (response, context) => {
    console.log(`[${context.requestId}] ${response.status}`);
    return response;
  },

  // Called on error
  onError: (error, context) => {
    console.error(`[${context.requestId}] ${error.message}`);
    throw error;
  },
});
```

### Customizing Error Classification

```typescript
// For custom error types, override in sync handler
OnlineSyncManager.registerSyncHandler(
  "items",
  async (payload, operation, supabase) => {
    try {
      // ... sync logic
    } catch (error) {
      // Custom classification based on your API
      const errorType =
        error.code === "CUSTOM_CONFLICT" ? "conflict" : "server";

      return {
        success: false,
        error: error.message,
        errorType, // Guides retry scheduling
      };
    }
  },
);
```

---

## Key Takeaways for Developers

1. **Everything flows through RequestManager** - This is the single integration point
2. **Phase 4 enhancements are transparent** - Developers use the same API, safety happens behind scenes
3. **Offline is automatic** - Network failures trigger queueing without special handling
4. **Errors are classified** - Error type determines retry strategy (network vs validation vs auth)
5. **Cache invalidation is tag-based** - Multiple queries invalidated by single tag
6. **Sync handlers are extensible** - Add custom replay logic per table
7. **Circuit breaker prevents cascades** - Automatically stops retrying failing endpoints

---

## Related Documentation

- **USAGE_GUIDE.md** - How to use these features as an application developer
- **lib/api/README.md** - Detailed RequestManager, AuthLayer, and CircuitBreaker docs
- **lib/offline/README.md** - Detailed OfflineQueue, SyncManager, and Phase 4 docs
- **lib/cache/README.md** - QueryCache API and tag-based invalidation
