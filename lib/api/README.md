# API Module

Centralized HTTP request layer with deduplication, retry, circuit breaking, auth injection, offline queuing, and typed domain clients. Built on top of `RequestManager` as the core engine, with `APIClient` as the typed factory for domain-specific clients.

## When to Use This Module

**Use this module if you need to:**

- Make HTTP requests with automatic retry and exponential backoff
- Deduplicate concurrent identical requests (same key = same in-flight promise)
- Inject auth tokens automatically per request via a named strategy
- Protect against cascading failures with per-endpoint circuit breakers
- Queue requests that fail while offline and replay them on reconnect
- Build typed, domain-specific API clients with cache integration
- Intercept requests/responses for cross-cutting concerns (logging, telemetry, header mutation)

**Do NOT use this module for:**

- Real-time WebSocket communication (REST only)
- Database operations (use [lib/database](../database/README.md) instead)
- Authentication state management (use [lib/auth](../auth/README.md) instead)
- Raw fetch calls without business logic (always wrap in a domain client or `RequestManager.fetch`)

## Architecture & Data Flow

```
Caller (component / service)
        ↓
APIClient.query() / APIClient.mutation()
        ↓
RequestManager.fetch(key, fetcher, options)
        ↓
    [Dedupe] Is there already an in-flight request for this key?
        ├─ YES → return existing promise
        └─ NO  → continue
        ↓
    [Auth] AuthLayer.injectAuthHeader() if authStrategy is set
        ↓
    [Interceptors] onBeforeRequest hooks
        ↓
    [Circuit Breaker] Is the endpoint circuit Open?
        ├─ YES → throw CircuitBreakerOpenError (or return null if failOpen)
        └─ NO  → execute fetcher
        ↓
    [Retry] On failure: exponential backoff up to options.retries
        ↓
    [Offline Queue] On network failure: queue request for replay
        ↓
    [Interceptors] onAfterResponse or onError hooks
        ↓
    [Cache] Store result in QueryCache if useQueryCache is set
        ↓
Return result to caller
```

**Key Principles:**

- **Deduplication**: Multiple callers requesting the same key share one in-flight promise.
- **Auth-on-replay**: Offline queue stores the auth strategy name, not the token; fresh tokens are fetched at replay time.
- **Circuit breaking**: Per-endpoint failure tracking prevents hammering unhealthy services.
- **Fail-open**: `failOpen: true` returns `null` instead of throwing, enabling graceful degradation.
- **Typed clients**: `APIClient` subclasses provide deterministic cache keys, Zod validation, and tag-based cache invalidation.

## API Reference

### `RequestManager`

The low-level engine. Use directly only when `APIClient` is too heavyweight.

#### `RequestManager.fetch<T>(key, fetcher, options?): Promise<T | null>`

Executes a request with deduplication, retry, auth, and optional caching.

**Parameters:**

- `key` (string) – Unique, deterministic identifier (e.g., `"worlds:${worldId}:members"`). Used for deduplication and cache.
- `fetcher` (() => Promise<T>) – The actual HTTP call.
- `options` (RequestOptions) – See options table below.

```ts
const data = await RequestManager.fetch(
  "users:me",
  () => fetch("/api/users/me").then(r => r.json()),
  { retries: 3, timeout: 10000, authStrategy: "user" }
);
```

**RequestOptions:**

| Option | Default | Description |
| ------ | ------- | ----------- |
| `dedupe` | `true` | Coalesce concurrent requests with the same key |
| `retries` | `3` | Retry attempts on failure |
| `retryDelay` | `1000` | Initial retry delay in ms (doubles each attempt) |
| `failOpen` | `false` | Return `null` instead of throwing on failure |
| `timeout` | `30000` | Request timeout in ms |
| `authStrategy` | — | Named strategy registered with `AuthLayer` |
| `interceptors` | — | Array of `RequestInterceptor` for this request |
| `idempotencyKey` | — | Sent as `Idempotency-Key` header; preserved in offline queue |
| `context` | — | Arbitrary metadata passed to interceptors |
| `useAdaptiveParams` | `true` | Append network-quality params to HTTP URLs (works with lib/network) |
| `rateLimitKey` | — | Token bucket key; applies per-key rate limiting |
| `useQueryCache` | — | Cache key to store/read from QueryCache (works with lib/cache) |
| `tags` | — | Cache tags for batch invalidation |

#### `RequestManager.flushOfflineQueue(): Promise<void>`

Replays all queued offline requests. Called automatically on reconnect by `offline-queue-replay.ts`. Can be called manually.

#### `RequestManager.getStats()`

Returns `{ pendingRequests, pendingKeys, rateLimitedKeys }`. Useful for debugging.

#### `RequestManager.clearPending(): void`

Clears all in-flight deduplicated requests. Call only during logout or app teardown.

---

### `APIClient`

Base class for typed domain clients. Subclass to build a client for a specific API domain.

```ts
class MyClient extends APIClient {
  constructor() {
    super({
      baseUrl: "/api/my-domain",
      authStrategy: "user",
      circuitBreakerKey: "my-domain",
      defaultTags: ["my-domain"],
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
    });
  }

  async getItem(id: string) {
    return this.query("getItem", `/${id}`, { tags: [`item:${id}`] });
  }

  async createItem(data: CreateItemRequest) {
    return this.mutation("createItem", "/", data, {
      method: "POST",
      invalidateTags: ["my-domain"],
    });
  }
}
```

#### `client.query<T>(operationName, path, options?): Promise<T>`

Executes a read operation. Result is automatically cached using a deterministic key derived from `operationName` and `path`.

#### `client.mutation<T>(operationName, path, body, options?): Promise<T>`

Executes a write operation. Invalidates `invalidateTags` on success.

**QueryOptions:**

| Option | Description |
| ------ | ----------- |
| `cacheKey` | Override the auto-generated cache key |
| `responseSchema` | Zod schema for response validation |
| `tags` | Cache tags assigned to this result |
| `staleTime` | How long before cached result is considered stale (ms) |

**MutationOptions:**

| Option | Description |
| ------ | ----------- |
| `method` | HTTP method (`POST`, `PUT`, `PATCH`, `DELETE`) |
| `invalidateTags` | Tags to invalidate from QueryCache on success |
| `requestSchema` | Zod schema for request body validation |
| `responseSchema` | Zod schema for response validation |

---

### `AuthLayer`

Manages named auth strategies. Strategies inject `Authorization: Bearer <token>` headers and handle 401 token refresh.

#### `AuthLayer.registerAuthStrategy(name, strategy): void`

Registers a strategy. Call during app bootstrap.

```ts
AuthLayer.registerAuthStrategy("user", createUserAuthStrategy());
```

#### `AuthLayer.injectAuthHeader(init, strategyName, context): Promise<RequestInit>`

Called internally by `RequestManager`. Injects the token into request headers.

**AuthStrategy interface:**

```ts
interface AuthStrategy {
  getToken(context: AuthContext): Promise<string | null>;
  onTokenExpire?(context: AuthContext): Promise<void>;
}
```

**Built-in strategies** (from `default-strategies.ts`):

| Factory | Description |
| ------- | ----------- |
| `createUserAuthStrategy()` | Supabase user session token with in-memory caching |
| `createPublicAuthStrategy()` | No token; for public endpoints |
| `createInviteAuthStrategy()` | Invite-scoped token for unauthenticated world access |

---

### `CircuitBreakerManager`

Per-endpoint circuit breaker. Tracks failure counts and failure rate. Opens the circuit when thresholds are exceeded.

**States:** `Closed` → `Open` → `Half-Open` → `Closed` (or back to `Open`)

```ts
CircuitBreakerManager.getState("users-service");  // "Closed" | "Open" | "Half-Open" | undefined
CircuitBreakerManager.getStats("users-service");  // { failureCount, nextRecoveryAt, ... }
CircuitBreakerManager.reset("users-service");     // Manual reset (testing / admin)
```

**Default thresholds** (from `appsettings.json` under `circuitBreaker`):

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `failures` | `10` | Consecutive failures before opening |
| `ratePercent` | `50` | Failure rate % in sliding window before opening |
| `rateWindowMs` | `60000` | Sliding window duration (ms) |
| `baseTimeoutMs` | `30000` | Initial recovery timeout (ms) |
| `maxTimeoutMs` | `300000` | Max recovery timeout after repeated Half-Open failures |

Custom thresholds can be passed per-key via `CircuitThresholds` when calling `RequestManager.fetch`.

---

### `InterceptorManager`

Registers global interceptors that run on every request. Hooks run serially in registration order.

```ts
InterceptorManager.register({
  name: "logging",
  onBeforeRequest({ url, endpoint }) {
    logger.info("api", `Request: ${endpoint}`);
  },
  onError({ error, statusCode, queued }) {
    logger.error("api", `Failed: ${statusCode}`, { queued });
  },
});
```

**RequestInterceptor hooks:**

| Hook | When it runs | Can mutate? |
| ---- | ------------ | ----------- |
| `onBeforeRequest` | Before each attempt (including retries) | Yes — `req.init` (headers, body) |
| `onAfterResponse` | After a successful response | Yes — `res.data` |
| `onError` | After all retries are exhausted | No — observe only |

---

### Offline Queue

Requests that fail due to network unavailability are automatically queued in `OfflineQueueManager` and replayed when connectivity is restored.

- **Trigger**: `NetworkDetection` state = `"offline"` only. Cellular is a valid connected state and does not trigger queuing.
- **Replay**: Automatic via `offline-queue-replay.ts` on `connectionQuality === "good"`. Also triggered manually by `RequestManager.flushOfflineQueue()`.
- **Auth**: The auth strategy name is stored, not the token. Fresh tokens are fetched at replay time.
- **Persistence**: Queue entries survive app restarts via encrypted storage (works with lib/storage).

#### `OfflineQueueManager.enqueue(entry): Promise<void>`

Adds a request to the queue. Called internally by `RequestManager`.

#### `OfflineQueueManager.getStats(): OfflineQueueStats`

Returns queue size, max size, and oldest entry age.

---

### `NetworkRecoveryManager`

Orchestrates app state during network transitions. Called during bootstrap.

```ts
await NetworkRecoveryManager.initialize();
NetworkRecoveryManager.setNotificationCallback((msg) => showToast(msg));
registerNetworkRecoveryHooks(networkStateMachine);
```

On `RECOVERING → GOOD`: flushes offline queue and invalidates stale cache (works with lib/cache).
On `GOOD → OFFLINE`: triggers user notification via the registered callback.

---

### Pre-built Domain Clients

Located in `clients/`. These are ready-to-use subclasses of `APIClient`.

#### `UsersAPI`

Handles `/api/users` endpoints. Auth strategy: `"user"`. Stale time: 5 min.

```ts
const api = new UsersAPI();
await api.getCurrentUser();
await api.getUser(userId);
await api.updateUser(userId, { name: "New Name" });
```

#### `WorldsAPI`

Handles `/api/worlds` endpoints. Auth strategy: `"user"`. Stale time: 10 min.

```ts
const api = new WorldsAPI();
await api.getWorld(worldId);
await api.listWorlds();
await api.createWorld(data);
```

#### `CACHE_DEFAULTS`

Standard stale/cache time presets for use in custom clients:

| Key | Stale | Cache |
| --- | ----- | ----- |
| `user` | 5 min | 30 min |
| `world` | 10 min | 60 min |
| `reference` | 30 min | 2 hr |

---

## Dependencies

### External Packages

- **`lib/services`** – Error tracking abstraction for tiered consent-based payload scoping (none/basic/full levels)

### Internal Dependencies

- **`lib/cache`** – QueryCache for response persistence and tag-based invalidation
- **`lib/network`** – Network state detection; drives offline queue trigger and adaptive params
- **`lib/storage`** – Encrypted persistence for the offline queue (works with lib/storage)
- **`lib/analytics`** – Tracks request metrics (duration, success/failure)
- **`lib/config`** – Circuit breaker thresholds and feature flags
- **`lib/database`** – Supabase client used by `createUserAuthStrategy()` for token retrieval
- **`lib/utils/logger`** – Category-based logging (`api`, `network`, `auth`)

## Error Handling & Edge Cases

### `CircuitBreakerOpenError`

Thrown when a circuit is `Open`. Contains `endpoint` and `recoveryAt`. Handle with `failOpen: true` to return `null` instead.

### Deduplication Coalescing

If the first of two deduplicated requests fails, both callers receive the same error. The second fetcher is never called.

### Offline Queue Overflow

Default max queue size is 100 entries. When exceeded, the oldest entry is dropped (FIFO). Configurable via `OfflineQueueConfig`.

### Token Expiry During Replay

If a replayed request gets a 401, `onTokenExpire` is called on the registered strategy. If refresh fails, the request is dropped and logged.

### Interceptor Errors

Errors thrown inside interceptor hooks are caught and logged. Execution continues to the next hook and the request is not aborted.

### Retry Exhaustion

After all retries are used, if `failOpen: false` (default), the error is thrown and reported via error tracker with tiered payload scoping based on user consent. If `failOpen: true`, `null` is returned.

## Performance Notes

### Deduplication Cost

In-flight request tracking is O(1) map lookup by key. Negligible overhead.

### Circuit Breaker Sliding Window

Failure and request windows are trimmed on every check by removing entries older than `rateWindowMs`. O(n) where n = requests in the window (bounded by rate).

### Offline Queue Persistence

Queue is written to encrypted storage on every enqueue and dequeue. Max 100 entries by default.

### Adaptive Params

Network quality params are injected per-request based on current `NetworkDetection` state (works with lib/network). O(1) lookup; no async overhead.

## Related Modules

- **`lib/cache`** – QueryCache for storing and invalidating API responses
- **`lib/network`** – Network state machine; drives offline queue and adaptive params
- **`lib/storage`** – Encrypted queue persistence for offline requests
- **`lib/database`** – Supabase client used by auth strategies
- **`lib/auth`** – Auth state management; `onTokenExpire` integrates with `AuthStateManager`
- **`lib/analytics`** – Request duration and failure tracking

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel exports for the entire module |
| `request-manager.ts` | Core engine: deduplication, retry, auth injection, circuit breaker coordination, offline queueing |
| `client-factory.ts` | `APIClient` base class: typed query/mutation methods, cache key generation, Zod validation, tag invalidation |
| `auth-layer.ts` | `AuthLayer` singleton: registers named auth strategies, injects `Bearer` tokens, handles 401 refresh |
| `default-strategies.ts` | Concrete `AuthStrategy` factories: `createUserAuthStrategy()`, `createPublicAuthStrategy()`, `createInviteAuthStrategy()` |
| `circuit-breaker.ts` | `CircuitBreakerManager`: per-endpoint failure tracking, state machine (Closed / Open / Half-Open) |
| `interceptor.ts` | `InterceptorManager`: serial `onBeforeRequest` / `onAfterResponse` / `onError` hook pipeline |
| `offline-queue.ts` | `OfflineQueueManager`: FIFO persistent queue for failed requests; survives app restarts |
| `offline-queue-replay.ts` | Subscribes to lib/network state changes and flushes the offline queue on reconnect |
| `network-recovery.ts` | `NetworkRecoveryManager`: orchestrates cache invalidation and user notifications on network transitions |
| `network-recovery-retry-job.ts` | `NetworkRecoveryRetryJobManager`: background job (works with lib/jobs) for periodic reconnection attempts |
| `types-inference-guide.ts` | Developer reference: patterns for deriving TypeScript types from Zod schemas |
| `clients/defaults.ts` | `CACHE_DEFAULTS`: standard stale/cache time presets for domain clients |
| `clients/users.ts` | `UsersAPI`: pre-built client for `/api/users` endpoints |
| `clients/worlds.ts` | `WorldsAPI`: pre-built client for `/api/worlds` endpoints |
