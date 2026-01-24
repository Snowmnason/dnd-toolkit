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

---

## Testing

Currently, no dedicated test guide exists for this module. When adding tests, create a guide at `docs/A Testing Guide/api.md` following the repository's testing guide template.

**Manual testing tips:**

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
