# AuthLayer: Centralized Authentication Middleware

## When to Use This Module

**Use AuthLayer when:**

- You need to inject Bearer tokens into API requests
- You want centralized token refresh logic (avoid scattering auth across the app)
- You need per-request auth strategy selection (user token vs service account)
- You want to handle 401 responses uniformly across the app
- You're building a multi-strategy auth system (future: Stripe API, GitHub, etc.)

**Don't use AuthLayer when:**

- Requests don't require authentication (public endpoints)
- You need OAuth/social login flows (use `SessionService` directly)
- You need fine-grained per-endpoint auth rules (use Structured Clients #9 later)

## Architecture & Data Flow

```
Request Flow with AuthLayer:
┌─────────────────────────────────────────────────────────────┐
│ RequestManager.fetch(url, fetcher, { authStrategy: 'user' }) │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
     ┌───────────────────────────┐
     │ Dedupe / Rate Limit Check  │
     └───────────────┬───────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ executeWithAuthLayer()  │
        │ - Inject token header  │
        │ - Execute fetcher()    │
        │ - Catch 401 response   │
        └────────────┬───────────┘
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

**Key Flows:**

1. **Token Injection (Pre-Request):**
   - AuthLayer.injectAuthHeader() called before fetch()
   - Strategy.getToken(context) returns token string
   - Authorization header added to request headers

2. **401 Handling (Per-Strategy Locking):**
   - Detect 401 response in executeWithAuthLayer()
   - Acquire lock: `refreshLocks[strategyName]`
   - Multiple concurrent 401s on same strategy wait for lock
   - Call strategy.onTokenExpire(context) once
   - Retry original request after refresh completes

3. **Logout Cascade:**
   - onTokenExpire() calls AuthStateManager.clearAuthState()
   - Clears session storage, marks hasAccount: false
   - Route guards detect auth state change, redirect to login
   - User session ends cleanly

## API Reference

### AuthContext

Lightweight context passed to strategy decision-making:

```typescript
export interface AuthContext {
  /** Request URL */
  url: string;

  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";

  /** Optional: API endpoint category (e.g., 'users', 'worlds', 'admin') */
  endpoint?: string;

  /** Optional: retry attempt count (0 on first attempt) */
  retryCount?: number;
}
```

### AuthStrategy

Interface for auth token management:

```typescript
export interface AuthStrategy {
  /**
   * Get token for this request context
   * @returns Token string, or null if not applicable for this endpoint
   */
  getToken(context: AuthContext): Promise<string | null>;

  /**
   * Called on 401 or token expiry
   * Implementation should refresh token or invalidate session
   */
  onTokenExpire?(context: AuthContext): Promise<void>;
}
```

### AuthLayer Methods

#### registerAuthStrategy(name, strategy)

Register a new auth strategy:

```typescript
import { AuthLayer } from "@/lib/api";

const userStrategy: AuthStrategy = {
  async getToken(context) {
    const session = await SessionService.getCurrentSession();
    return session?.access_token ?? null;
  },
  async onTokenExpire(context) {
    await AuthStateManager.clearAuthState();
    logger.warn("auth", "Session expired", { endpoint: context.endpoint });
  },
};

AuthLayer.registerAuthStrategy("user", userStrategy);
```

#### getAuthStrategy(name)

Get registered strategy:

```typescript
const strategy = AuthLayer.getAuthStrategy("user");
if (strategy) {
  const token = await strategy.getToken(context);
}
```

#### injectAuthHeader(headers, strategyName, context)

Inject auth header into request headers:

```typescript
const headers = await AuthLayer.injectAuthHeader(
  { "Content-Type": "application/json" },
  "user",
  { url, method: "GET", endpoint: "worlds" },
);
// Returns: { 'Content-Type': ..., 'Authorization': 'Bearer ...' }
```

#### handle401Response(strategyName, context)

Handle 401 response with per-strategy locking:

```typescript
try {
  if (response.status === 401) {
    await AuthLayer.handle401Response("user", context);
    // Token refresh complete, can retry request
  }
} catch (error) {
  // Token refresh failed
}
```

#### isRefreshing(strategyName)

Check if strategy is currently refreshing:

```typescript
if (AuthLayer.isRefreshing("user")) {
  console.log("Token refresh in progress");
}
```

#### getRegisteredStrategies()

Get all registered strategy names:

```typescript
const strategies = AuthLayer.getRegisteredStrategies();
// Returns: ['user', 'service', 'stripe']
```

## Error Handling & Edge Cases

### 401 Handling

**Scenario:** Request gets 401 Unauthorized

**Flow:**

1. executeWithAuthLayer() catches 401
2. Checks `retryCount` - only retry once
3. Calls `AuthLayer.handle401Response()`
4. Per-strategy locking ensures single token refresh across concurrent 401s
5. Retries request with refreshed token

**Result:**

- ✓ If refresh succeeds and retry succeeds: return data
- ✗ If refresh fails: throw original 401 error
- ✗ If retry fails: throw retry error

### Concurrent 401s (Same Strategy)

**Scenario:** Two requests get 401 simultaneously for 'user' strategy

**With Locking:**

```
T0:   Request A gets 401 → acquires lock['user'] → calls onTokenExpire()
T10:  Request B gets 401 → wait for lock['user']
T100: Request A's refresh completes, releases lock
T100: Request B acquires lock → lock already released, proceeds to retry
T110: Request B retries with refreshed token
```

**Result:** Only ONE onTokenExpire() call, both requests retry with same token

### Concurrent 401s (Different Strategies)

**Scenario:** User request gets 401, Stripe request gets 401 simultaneously

**With Per-Strategy Locking:**

```
T0:   User request gets 401 → acquires lock['user']
T0:   Stripe request gets 401 → acquires lock['stripe'] (independent!)
T50:  User token refresh completes
T60:  Stripe key refresh completes
```

**Result:** Both refresh independently, no blocking

### Strategy Not Found

**Scenario:** AuthLayer.handle401Response('admin', context) but 'admin' not registered

**Handling:**

```
logger.warn('auth', 'Strategy "admin" not found for 401')
// Function returns quietly, doesn't retry
// Original error still thrown by executeWithAuthLayer
```

### Token Refresh Fails

**Scenario:** SessionService.refreshToken() throws error

**Handling:**

```
try {
  await strategy.onTokenExpire(context);
} catch (error) {
  logger.error('auth', `Failed ${strategyName} token refresh:`, error);
  throw error; // Re-throw, original 401 thrown to caller
}
```

## Testing

### Integration Test Pattern

Use real test tokens (not mocks) with elevated privileges:

```typescript
describe("AuthLayer with RequestManager", () => {
  beforeEach(() => {
    AuthLayer.clearAuthStrategies();
  });

  it("should inject auth header and handle 401 with retry", async () => {
    // 1. Register test strategy with real token
    const testStrategy: AuthStrategy = {
      async getToken(context) {
        const session = await SessionService.getTestSession();
        return session?.access_token ?? null;
      },
      async onTokenExpire(context) {
        // Mock logout behavior
        testLogoutCalled = true;
      },
    };

    AuthLayer.registerAuthStrategy("test-user", testStrategy);

    // 2. Mock fetcher that returns 401 first time, success second time
    let fetchAttempts = 0;
    const mockFetcher = async () => {
      fetchAttempts++;
      if (fetchAttempts === 1) {
        const err = new Error("Unauthorized");
        (err as any).status = 401;
        throw err;
      }
      return { data: "success" };
    };

    // 3. Execute request with auth
    const result = await RequestManager.fetch("api:test:data", mockFetcher, {
      authStrategy: "test-user",
    });

    // 4. Verify
    expect(result).toEqual({ data: "success" });
    expect(fetchAttempts).toBe(2); // First failed, second succeeded
    expect(testLogoutCalled).toBe(false); // Token refresh succeeded
  });

  it("should handle concurrent 401s with per-strategy locking", async () => {
    let refreshCount = 0;
    const testStrategy: AuthStrategy = {
      async getToken(context) {
        return "test-token";
      },
      async onTokenExpire(context) {
        refreshCount++;
        // Simulate async refresh
        await new Promise((r) => setTimeout(r, 50));
      },
    };

    AuthLayer.registerAuthStrategy("test-user", testStrategy);

    // Two concurrent requests that both get 401
    const fetcher1 = async () => {
      throw { status: 401, message: "Unauthorized" };
    };
    const fetcher2 = async () => {
      throw { status: 401, message: "Unauthorized" };
    };

    // Both requests execute concurrently
    const [result1, result2] = await Promise.allSettled([
      RequestManager.fetch("api:test:1", fetcher1, {
        authStrategy: "test-user",
      }),
      RequestManager.fetch("api:test:2", fetcher2, {
        authStrategy: "test-user",
      }),
    ]);

    // Verify locking: only one refresh happened
    expect(refreshCount).toBe(1);
    expect(result1.status).toBe("rejected"); // Both failed (fetcher always throws)
    expect(result2.status).toBe("rejected");
  });
});
```

### Manual Testing Checklist

- [ ] Single request with valid token: token injected, request succeeds
- [ ] Single request with expired token: 401 detected, token refresh called, retry succeeds
- [ ] Token refresh fails: original 401 thrown, user logged out
- [ ] Concurrent requests with token expiry: lock prevents multiple refreshes
- [ ] No auth strategy specified: request works without auth header
- [ ] Non-existent strategy: warns in logs, request fails
- [ ] Token refresh completes during dedup: deduplicated request waits for lock, gets fresh token

## Multi-Strategy Scenarios (Phase 1 Planning)

### Phase 1: Single User Strategy

```typescript
// Only 'user' strategy registered
RequestManager.fetch("/api/worlds", {
  authStrategy: "user", // Uses Supabase session token
});
```

### Phase 2+: Service Account Strategy

```typescript
// Service account for admin operations
const serviceStrategy: AuthStrategy = {
  async getToken(context) {
    if (!context.endpoint?.startsWith("admin/")) return null;
    return await SecureStorage.get(STORAGE_KEYS.SERVICE_ACCOUNT_TOKEN);
  },
  async onTokenExpire(context) {
    logger.error("auth", "Service account token expired");
    // Don't logout user - this is independent auth
  },
};

AuthLayer.registerAuthStrategy("service", serviceStrategy);

// Same session uses both strategies
await RequestManager.fetch("/api/worlds", { authStrategy: "user" });
await RequestManager.fetch("/api/admin/users", { authStrategy: "service" });
```

### Phase 2+: External API Strategies (Stripe, GitHub, etc.)

```typescript
const stripeStrategy: AuthStrategy = {
  async getToken(context) {
    // Only for Stripe endpoints
    if (!context.endpoint?.startsWith("stripe/")) return null;
    return getStripeAPIKey();
  },
  async onTokenExpire(context) {
    logger.warn("stripe", "API key invalid");
    // Don't invalidate user session
  },
};

AuthLayer.registerAuthStrategy("stripe", stripeStrategy);

// User token for internal APIs, Stripe key for external
await RequestManager.fetch("/api/charges", { authStrategy: "user" });
await RequestManager.fetch("https://api.stripe.com/v1/charges", {
  authStrategy: "stripe",
});
```

## Future Enhancements

### Proactive Token Refresh (Phase 5+)

Currently AuthLayer handles reactive 401s. Future enhancement: refresh tokens before expiry.

**Approach:**

- Check JWT expiry timestamp periodically (e.g., every minute)
- If expiring in < 5 minutes, refresh proactively
- Prevents mid-session logout jarring UX
- Lives in kernel phase or background job

**Example (Future):**

```typescript
// In kernel or background job
const session = await SessionService.getCurrentSession();
const expiresIn = session.expiresAt * 1000 - Date.now();
if (expiresIn < 5 * 60 * 1000) {
  // < 5 minutes
  await AuthLayer.handle401Response("user", context);
}
```

See `docs/suggestions/PROACTIVE_TOKEN_REFRESH_PHASE5.md` for full design.

### Structured Clients (#9, Phase 2+)

Build on top of AuthLayer:

- Define endpoints with required auth level upfront
- Enforce at call time: `usersAPI.deleteUser()` requires 'admin'
- Type-safe endpoint definitions
- Auto-generate cache keys, dedup, validation

See `lib/navigation/routes/README.md` for planned API.

## Middleware Integration with RequestManager

AuthLayer is integrated into RequestManager's middleware chain to handle authentication automatically:

```
RequestManager.fetch()
  → Dedupe & Rate Limit Check
    → Auth Header Injection Middleware (AuthLayer)
      → 401 Handling & Token Refresh Middleware (AuthLayer)
        → Retry Middleware (exponential backoff)
          → Actual Fetcher (user-provided)
```

### How Fetchers Work with Auth Middleware

When you call `RequestManager.fetch()` with `authStrategy`, the middleware automatically:

1. **Calls AuthLayer.injectAuthHeader()** to get token before fetch
2. **Passes headers to fetcher** - fetcher can optionally use them
3. **Handles 401 responses** - refreshes token and retries

### Fetcher Patterns

#### Pattern 1: Supabase Client (Auto-Auth)

Supabase client handles auth automatically, so fetcher ignores headers:

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
    staleTime: 2 * 60 * 60 * 1000, // 2 hours
  },
);
```

**How it works:** Supabase client reads session from SessionService internally, no header injection needed.

#### Pattern 2: Raw HTTP Fetch (Header-Based Auth)

For direct HTTP calls, fetcher receives headers and must use them:

```typescript
// ✓ Correct: Fetcher accepts and uses headers
const data = await RequestManager.fetch(
  "api:GET:/api/worlds",
  async (headers?: Record<string, string>) => {
    const response = await fetch("https://api.example.com/worlds", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers, // Include auth headers from middleware
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

**How it works:** Middleware calls fetcher(headers), fetcher merges headers into fetch options, 401 response triggers token refresh and retry.

#### Pattern 3: Custom API Client (Wrapper)

Create a reusable wrapper that handles headers:

```typescript
// In lib/api/custom-http-client.ts
export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers, // Auth middleware injects Authorization here
    },
  });

  if (!response.ok) {
    const error = new Error("HTTP error");
    (error as any).status = response.status;
    throw error;
  }

  return response.json();
}

// Usage:
const worlds = await RequestManager.fetch(
  "api:GET:/api/worlds",
  (headers) => apiFetch("/api/worlds", { method: "GET" }, headers),
  { authStrategy: "user" },
);
```

### Error Handling in Fetchers

When using raw fetch or custom HTTP clients, ensure:

1. **401 Response:** Attach `.status` property to error so middleware detects it

   ```typescript
   if (response.status === 401) {
     const error = new Error("Unauthorized");
     (error as any).status = 401;
     throw error;
   }
   ```

2. **No Infinite Retries:** Middleware only retries once on 401 (token refresh + retry)

3. **Network Errors:** Let them bubble up - RequestManager handles retry logic

## Related Modules

- **SessionService** (`lib/auth/sessionService.ts`) – Manages Supabase session, tokens
- **AuthStateManager** (`lib/auth/auth-state.ts`) – Stores auth state, clears on logout
- **RequestManager** (`lib/api/request-manager.ts`) – HTTP request dedup, retry, rate limit
- **AuthGuard** (`lib/auth/useAuthGuard.ts`) – Route protection (redirects on logout)

## File Breakdown

| File                 | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `auth-layer.ts`      | AuthLayer singleton, auth strategy registration, token injection, 401 handling |
| `request-manager.ts` | Modified to call AuthLayer.injectAuthHeader() before fetch, handle 401s        |
| `index.ts`           | Exports AuthLayer, AuthStrategy, AuthContext types                             |

## Performance Notes

- **Token Injection Overhead:** ~1ms per request (strategy.getToken() is async)
- **Lock Efficiency:** O(1) Map lookup for per-strategy locks, no polling
- **Concurrent 401s:** Lock prevents duplicate token refreshes (scales linearly with concurrent requests)
- **Memory:** One Promise per active strategy refresh, cleaned up immediately after

## Troubleshooting

### Issue: Requests getting 401 after token refresh

**Cause:** SessionService.refreshToken() succeeded but getToken() still returns old token

**Fix:** Verify SessionService stores new token correctly, check SecureStorage write

### Issue: Token refresh called multiple times for single 401

**Cause:** Different strategies registered without isolation

**Fix:** Use getRegisteredStrategies(), ensure each strategy has unique name

### Issue: Requests hanging after 401 (deadlock)

**Cause:** onTokenExpire() error not caught, lock never released

**Fix:** Check logs, wrap onTokenExpire() in try/catch in strategy implementation

## Questions? Issues?

See issue #5 (API Auth Layer) for design discussion and acceptance criteria.
