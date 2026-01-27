# API Module

Provides a robust, feature-rich HTTP request layer with built-in deduplication, retry logic, rate limiting, query caching, and fail-open capabilities. Designed as a foundation for any application requiring centralized API communication.

## When to Use This Module

**Use this module if you need to:**

- Make HTTP requests with automatic retry and exponential backoff
- Deduplicate concurrent identical requests (prevent duplicate API calls)
- Rate limit requests per key (token bucket algorithm)
- Cache API responses with configurable stale/cache times
- Integrate with a query cache for data persistence across app restarts
- Track request metrics (duration, success/failure, slow requests)
- Gracefully degrade when network is unavailable (fail-open)
- Report request errors to error tracking services (Sentry)
- Centralize request handling for easier debugging and monitoring

**Don't use this if:**

- You need custom HTTP client configuration (auth headers, interceptors); consider wrapping this module
- You need real-time WebSocket communication (this module handles REST requests only)
- You need batching/GraphQL optimizations (consider adding a layer on top)
- You're calling browser-only APIs (e.g., Fetch API with specific credentials modes)

## Architecture & Data Flow

```
Request Call (with key, fetcher, options)
        ↓
    Check QueryCache (if enabled)
        ↓
    Check Deduplication (if identical request in-flight)
        ↓
    Check Rate Limiting (if rate limit key provided)
        ↓
    Execute with Timeout & Retry (exponential backoff)
        ↓
    Persist to QueryCache (if enabled & successful)
        ↓
    Track Metrics (duration, success, errors)
        ↓
    Report Errors to Sentry (if enabled)
        ↓
    Return Result or Fail-Open (return null)
```

**Key Principles:**

- **Deduplication**: Multiple requests with the same key return the same promise (prevents thundering herd)
- **Retry**: Failed requests automatically retry with exponential backoff (default: 3 retries)
- **Rate Limiting**: Token bucket per key limits throughput without blocking (graceful backpressure)
- **Caching**: Results optionally persist to QueryCache for offline/fast access
- **Resilience**: Fail-open flag allows graceful degradation when offline or errors occur
- **Memory-safe**: Stale entries are automatically cleaned up to prevent unbounded growth
- **Observable**: All activity is tracked to logger and analytics

## API Reference

### `RequestManager.fetch<T>(key, fetcher, options?): Promise<T | null>`

Main method to execute an API request with optional deduplication, retry, rate limiting, and caching.

**Parameters:**

- `key` (string) – Unique identifier for the request. Used for deduplication, caching, and logging. Should be deterministic (e.g., `"users:list:page:1"` or `"worlds:${worldId}:members"`)
- `fetcher` (() => Promise<T>) – Async function that performs the actual HTTP request
- `options` (RequestOptions) – Optional configuration (see options below)

**Returns:** `Promise<T | null>` – Result of fetcher, or null if failOpen is true and error occurs

**Example:**

```ts
const users = await RequestManager.fetch(
  "users:list",
  async () => {
    const response = await fetch("/api/users");
    if (!response.ok) throw new Error("Failed to fetch users");
    return response.json();
  },
  {
    dedupe: true,
    retries: 3,
    timeout: 10000,
    rateLimitKey: "api:global",
    useQueryCache: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    tags: ["users"],
  },
);
```

---

### RequestOptions

Configuration object for `fetch()` method:

```ts
interface RequestOptions {
  /** Deduplicate identical concurrent requests (default: true) */
  dedupe?: boolean;

  /** Number of retry attempts on failure (default: 3) */
  retries?: number;

  /** Initial retry delay in ms, exponentially backed off (default: 1000) */
  retryDelay?: number;

  /** If true and request fails, return null instead of throwing (default: false) */
  failOpen?: boolean;

  /** Rate limit key - if provided, applies rate limiting (optional) */
  rateLimitKey?: string;

  /** Timeout in ms for the request (default: 30000) */
  timeout?: number;

  /** Use QueryCache for data persistence (default: false) */
  useQueryCache?: boolean;

  /** Stale time for QueryCache in ms (default: 2 * 60 * 1000) */
  staleTime?: number;

  /** Cache time for QueryCache in ms (default: 5 * 60 * 1000) */
  cacheTime?: number;

  /** Tags for QueryCache invalidation (default: []) */
  tags?: string[];
}
```

---

### `RequestManager.getStats(): { pendingRequests: number; pendingKeys: string[]; rateLimitedKeys: string[] }`

Returns current statistics about pending requests and rate-limited keys. Useful for debugging and monitoring.

```ts
const stats = RequestManager.getStats();
console.log(`${stats.pendingRequests} requests in-flight`, stats.pendingKeys);
```

---

### `RequestManager.clearPending(): void`

Clears all pending deduplicated requests. **WARNING:** Use only during logout or app cleanup to avoid breaking ongoing requests.

```ts
// On user logout
RequestManager.clearPending();
```

---

### `RequestManager.resetRateLimit(key?: string): void`

Resets rate limit for a specific key, or all keys if not provided.

```ts
// Reset rate limit for a specific API client
RequestManager.resetRateLimit("api:user:123");

// Reset all rate limits
RequestManager.resetRateLimit();
```

---

## Dependencies

### External Packages

- **`@sentry/react-native`** – Error reporting and context tracking
- None others (pure TypeScript/JavaScript)

### Internal Dependencies

- **`lib/analytics`** – Tracks request metrics (duration, success/failure, slow requests)
- **`lib/cache`** (QueryCache) – Provides data persistence layer for caching responses
- **`lib/utils/logger`** – Logs request lifecycle events and errors (see logger system)

---

## Error Handling & Edge Cases

### Timeout Errors

If a request exceeds the timeout (default 30s), it throws `Error("Request timeout after XXXms")`. The request still retries if retries are remaining.

```ts
try {
  const data = await RequestManager.fetch("slow-api", fetcher, {
    timeout: 5000,
  });
} catch (err) {
  console.error(err.message); // "Request timeout after 5000ms"
}
```

### Rate Limiting

If rate limited and `failOpen: false`, throws `Error("Rate limit exceeded: KEY")`. Token bucket refills automatically based on elapsed time.

```ts
// Rate limit: 10 requests/sec, max burst 20
// After 20 requests: backpressure until tokens refill
const data = await RequestManager.fetch("key", fetcher, {
  rateLimitKey: "api:global",
  failOpen: true, // Return null instead of throwing
});
```

### Deduplication Coalescing

Multiple requests with the same key return the same promise. If the first request fails, deduplicated requests also fail with the same error.

```ts
// Both calls return the same promise:
const p1 = RequestManager.fetch("users", fetcher1);
const p2 = RequestManager.fetch("users", fetcher2); // Uses promise from p1, ignores fetcher2
```

### QueryCache Integration Edge Cases

- If `useQueryCache: true` and cache read fails, request proceeds normally
- Cache persistence failure logs a warning but doesn't throw
- Stale cache is returned first; background revalidation doesn't block

```ts
// Cache hit (not stale) → returns immediately
// Cache stale → returns cached data, then fetches fresh in background
// Cache miss → fetches from network
```

### Fail-Open Behavior

When `failOpen: true`, any error (timeout, network, rate limit, retry exhaustion) returns `null` instead of throwing. Useful for optional/non-critical requests.

```ts
const analytics = await RequestManager.fetch("analytics", fetcher, {
  failOpen: true, // Non-critical: return null on error
});
if (analytics) {
  /* use it */
}
```

### Memory Leaks Prevention

- Pending requests are cleaned up immediately after settling
- Rate limit buckets older than 1 hour are removed
- Stale pending requests (>1 hour) are logged and removed
- Cleanup runs every 1 hour automatically

---

## Performance Notes

### Deduplication Overhead

Deduplication is O(1) (Map lookup). Negligible cost. Benefits far outweigh cost for high-volume APIs.

### Rate Limiting Overhead

Rate limiting uses token bucket algorithm. Refill is O(1) (single timestamp math). No background processing.

### QueryCache Integration Cost

- Cache check: O(1) lookup
- Cache write: Depends on `lib/cache` implementation; typically O(1) for in-memory cache
- Consider `cacheTime` to avoid excessive cache growth

### Retry & Backoff

Each retry doubles the delay (1s → 2s → 4s). Default max delay: ~7 seconds (3 retries). Configure `retryDelay` and `retries` based on SLA requirements.

### Stale Entry Cleanup

Cleanup runs every 1 hour and is O(n) where n = number of rate limit buckets/pending requests. Typically < 1000 entries; cleanup is negligible.

---

## Related Modules

- **`lib/analytics`** – Request metrics tracking (duration, success, errors). Provides `Analytics.getThreshold('slowRequestMs')`
- **`lib/cache` (QueryCache)** – Data persistence and cache invalidation. Coordinates stale/cache times
- **`lib/utils/logger`** – Request lifecycle logging (retries, rate limits, timeouts)
- **`lib/database`** – Database client layer; could wrap RequestManager for additional logic (auth, hooks, etc.)
- **`lib/network`** – Network status detection; potential integration point for offline/online events

---

## File Breakdown

| File                 | Purpose                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request-manager.ts` | Main RequestManager class. Implements request deduplication, retry with exponential backoff, rate limiting (token bucket), QueryCache integration, timeout handling, and error reporting. Singleton instance exported as `RequestManager`. |
| `auth-layer.ts`      | AuthLayer singleton, auth strategy registration, token injection, 401 handling. Integrates with RequestManager middleware chain.                                                                                                           |

---

# AuthLayer: Centralized Authentication Middleware

This module provides a pluggable auth strategy system integrated into RequestManager for centralized token management.

## When to Use AuthLayer

**Use AuthLayer when:**

- You need to inject Bearer tokens into API requests
- You want centralized token refresh logic (avoid scattering auth across the app)
- You need per-request auth strategy selection (user token vs service account)
- You want to handle 401 responses uniformly across the app
- You're building a multi-strategy auth system (future: Stripe API, GitHub, etc.)

**Don't use AuthLayer when:**

- Requests don't require authentication (public endpoints)
- You need OAuth/social login flows (use SessionService directly)
- You need fine-grained per-endpoint auth rules (use Structured Clients #9 later)

## Architecture & Data Flow

```
Request Flow with AuthLayer:
┌─────────────────────────────────────────────────────────────┐
│ RequestManager.fetch(url, fetcher, { authStrategy: 'user' }) │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ Dedupe / Rate Limit Check   │
    └────────────┬────────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ executeWithAuthLayer()      │
    │ - Inject token header      │
    │ - Execute fetcher()        │
    │ - Catch 401 response       │
    └────────────┬────────────────┘
                 │
          ┌──────┴──────┐
          │             │
          ▼ (2xx)      ▼ (401)
       Success    ┌─────────────────┐
                  │ Acquire Lock    │
                  │ (per-strategy)  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Call onTokenExpire│
                  │ (SessionService) │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Release Lock    │
                  │ Retry Request   │
                  └────────┬────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼ (success)  ▼ (fail)
                 Return        Throw
```

**Key Principles:**

- **Per-Strategy Locking:** Prevents thundering herd on concurrent 401s (only one token refresh per strategy)
- **One Retry:** Retries once after token refresh; if still fails, throws original error
- **Token Caching:** Strategies cache tokens with TTL to avoid redundant refresh calls
- **Cascading Logout:** Failed refresh triggers logout, which clears route guards and redirects to /login

## AuthLayer API

### AuthContext

Lightweight context passed to strategy methods:

```typescript
interface AuthContext {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
  endpoint?: string; // e.g., 'users', 'worlds', 'admin'
  retryCount?: number; // 0 on initial attempt, increments on retry
}
```

### AuthStrategy

Interface for auth token management:

```typescript
interface AuthStrategy {
  getToken(context: AuthContext): Promise<string | null>;
  onTokenExpire?(context: AuthContext): Promise<void>;
  shouldClearAuthStateOn401?: boolean; // If true, 401 handler clears global auth state
}
```

### Key Methods

#### registerAuthStrategy(name, strategy)

Register a new auth strategy. **Throws if name already registered.**

```typescript
const userStrategy: AuthStrategy = {
  async getToken(context) {
    const session = await SessionService.getCurrentSession();
    return session?.access_token ?? null;
  },
  async onTokenExpire(context) {
    await supabase.auth.refreshSession();
    // Refresh succeeds = new token cached, retry will use it
    // Refresh fails = throw, triggers clearAuthState() if shouldClearAuthStateOn401: true
  },
  shouldClearAuthStateOn401: true, // Only user strategy should logout
};

AuthLayer.registerAuthStrategy("user", userStrategy);
```

#### getAuthStrategy(name)

Get registered strategy by name:

```typescript
const strategy = AuthLayer.getAuthStrategy("user");
```

#### injectAuthHeader(headers, strategyName, context)

Inject auth header before fetcher:

```typescript
const headers = await AuthLayer.injectAuthHeader(
  { "Content-Type": "application/json" },
  "user",
  { url: "/api/worlds", method: "GET", endpoint: "worlds" },
);
// Returns: { 'Content-Type': ..., 'Authorization': 'Bearer ...' }
```

#### handle401Response(strategyName, context)

Handle 401 with per-strategy locking:

```typescript
if (response.status === 401) {
  await AuthLayer.handle401Response("user", context);
  // Token refresh complete, can retry request
}
```

#### isRefreshing(strategyName)

Check if strategy is currently refreshing:

```typescript
if (AuthLayer.isRefreshing("user")) {
  console.log("Token refresh in progress");
}
```

## Integration with RequestManager

AuthLayer is automatically integrated into RequestManager's middleware chain:

```
RequestManager.fetch()
  → Dedupe & Rate Limit Check
    → Auth Header Injection Middleware (AuthLayer.injectAuthHeader)
      → 401 Handling & Token Refresh Middleware (AuthLayer.handle401Response)
        → Retry Middleware (exponential backoff)
          → Actual Fetcher (user-provided)
```

When you specify `authStrategy` in RequestOptions, the middleware automatically:

1. **Injects token** before fetcher (calls strategy.getToken())
2. **Detects 401** responses
3. **Acquires per-strategy lock** (prevents thundering herd)
4. **Calls onTokenExpire()** to refresh token
5. **Retries once** with refreshed token

## Error Handling

### Concurrent 401s (Same Strategy)

Multiple requests with same strategy getting 401 simultaneously:

```
T0:   Request A gets 401 → acquires lock['user']
T10:  Request B gets 401 → waits for lock['user']
T100: Request A's refresh completes, releases lock
T100: Request B acquires lock → proceeds to retry (uses refreshed token from A)
```

**Result:** Only ONE token refresh, both requests retry with same token.

### Concurrent 401s (Different Strategies)

User request and Stripe request both get 401:

```
T0:  User request 401 → acquires lock['user']
T0:  Stripe request 401 → acquires lock['stripe'] (independent!)
```

**Result:** Both refresh independently without blocking.

### Token Refresh Fails

If onTokenExpire() throws:

1. Error is logged
2. If `shouldClearAuthStateOn401: true`, AuthStateManager.clearAuthState() is called
3. Original 401 error is thrown to caller
4. RequestManager doesn't retry further

### Strategy Not Found

If strategy name not registered:

1. Warning logged
2. Function returns quietly
3. Original error still thrown

## Fetcher Patterns

### Supabase Client (Auto-Auth)

Supabase client handles auth internally, no header manipulation needed:

```typescript
const worlds = await RequestManager.fetch(
  `worlds:user:${userId}`,
  async () => {
    const supabase = await getSupabaseClientLazy();
    const { data, error } = await supabase.from("worlds").select("*");
    if (error) throw error;
    return data;
  },
  {
    authStrategy: "user",
    useQueryCache: true,
  },
);
```

### Raw HTTP Fetch (Header-Based Auth)

For direct HTTP calls, fetcher receives headers from middleware:

```typescript
const data = await RequestManager.fetch(
  "api:GET:/api/worlds",
  async (headers?: Record<string, string>) => {
    const response = await fetch("https://api.example.com/worlds", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers, // Includes auth header from middleware
      },
    });
    if (!response.ok) {
      const error = new Error("HTTP error");
      (error as any).status = response.status;
      throw error;
    }
    return response.json();
  },
  {
    authStrategy: "user",
  },
);
```

## Multi-Strategy Scenarios (Current & Future)

### Phase 1: Single User Strategy

```typescript
RequestManager.fetch("/api/worlds", fetcher, {
  authStrategy: "user", // Supabase session token
});
```

### Phase 2+: Service Account Strategy

```typescript
const serviceStrategy: AuthStrategy = {
  async getToken(context) {
    if (!context.endpoint?.startsWith("admin/")) return null;
    return await SecureStorage.get(STORAGE_KEYS.SERVICE_ACCOUNT_TOKEN);
  },
  async onTokenExpire(context) {
    logger.error("auth", "Service account token expired");
    // Don't logout user - independent auth
  },
  shouldClearAuthStateOn401: false, // Never clear user session
};

AuthLayer.registerAuthStrategy("service", serviceStrategy);

// Same session uses both strategies
await RequestManager.fetch("/api/worlds", { authStrategy: "user" });
await RequestManager.fetch("/api/admin/users", { authStrategy: "service" });
```

### Phase 2+: External API Strategies

```typescript
const stripeStrategy: AuthStrategy = {
  async getToken(context) {
    if (!context.endpoint?.startsWith("stripe/")) return null;
    return getStripeAPIKey();
  },
  async onTokenExpire(context) {
    logger.warn("stripe", "API key invalid");
  },
  shouldClearAuthStateOn401: false,
};

AuthLayer.registerAuthStrategy("stripe", stripeStrategy);

await RequestManager.fetch("https://api.stripe.com/v1/charges", fetcher, {
  authStrategy: "stripe",
});
```

## Performance Notes

- **Token Injection:** ~1ms per request (async strategy.getToken())
- **Lock Efficiency:** O(1) Map lookup for per-strategy locks
- **Concurrent 401s:** Lock prevents N token refreshes, reduces to 1
- **Memory:** One Promise per active strategy refresh, cleaned up immediately

## Related Modules

- **`lib/auth/auth-state.ts`** (AuthStateManager) – Stores auth state, clears on logout
- **`lib/auth/sessionService.ts`** (SessionService) – Manages Supabase session and tokens
- **`lib/cache`** (QueryCache) – Data persistence for cached responses
- **`lib/network`** (NetworkDetection) – Network status; prevents refresh when offline

---

## Testing

Currently, no dedicated test guide exists for this module. When adding tests, create a guide at `docs/A Testing Guide/api.md` following the repository's testing guide template.

**Manual testing tips for AuthLayer:**

- Auth injection: Call with `authStrategy`, verify Authorization header present
- 401 handling: Mock 401 response, verify onTokenExpire called once
- Concurrent 401s: Trigger two concurrent 401s on same strategy, verify lock prevents multiple refreshes
- Token refresh succeeds: Verify retry succeeds with new token
- Token refresh fails: Verify original 401 thrown, user logged out if `shouldClearAuthStateOn401: true`
- Per-strategy locking: Different strategies get 401 simultaneously, verify both refresh independently
- Strategy not found: Verify warning logged, original error thrown

**Manual testing tips for RequestManager:**

- Dedupe: Call `fetch()` twice with same key; verify second request returns same promise
- Retry: Mock fetcher to fail 2 times then succeed; verify retries with exponential backoff
- Rate limit: Call `fetch()` 50+ times with same `rateLimitKey`; verify some requests fail or queue
- Timeout: Mock fetcher with `setTimeout(1s)`; call with `timeout: 500`; verify timeout error
- QueryCache: Call with `useQueryCache: true`, `staleTime: 1s`; verify cache hit on second call within 1s
- Fail-open: Call with `failOpen: true` and error fetcher; verify returns null instead of throwing
- Cleanup: Call `getStats()` periodically; verify stale entries are removed after 1+ hour

---

## Future Enhancements

- **Request Batching**: Batch multiple requests into a single HTTP call (e.g., GraphQL batch)
- **Dependency Injection**: Make Sentry, Logger, Analytics optional for portability to non-framework environments
- **Proactive Token Refresh**: Refresh tokens before expiry instead of reactively on 401
