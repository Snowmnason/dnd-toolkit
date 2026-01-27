# AuthLayer Testing Guide

This guide covers testing the AuthLayer middleware and request authentication flow.

## Test Strategy

### Token Management

Tests use **real test tokens from Supabase dev instance** to ensure auth flow works end-to-end. This prevents mocking issues that could hide real auth bugs.

#### Token Acquisition

1. Create Supabase dev user with admin role in project's auth system
2. Sign in and capture the access token
3. Store in `config/test-tokens.ts` (gitignored, manually provided in CI/CD secrets)
4. Each test creates fresh session to avoid state pollution

#### CI/CD Integration

- GitHub Actions stores `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` as secrets
- Pre-test script exchanges credentials for token and writes to `config/test-tokens.ts`
- Tests read tokens directly; no mocking of SessionService
- Tokens auto-expire after test run (no cleanup needed)

### Test Cases

#### ✓ Auth Header Injection

**Test:** Verify Bearer token is added to request headers

```typescript
// Test that fetcher receives headers with Authorization
const headers: any = {};
const fetcher = vi.fn(async (h?: Record<string, string>) => {
  if (h) Object.assign(headers, h);
  return { data: "success" };
});

await RequestManager.fetch("api:GET:/test", fetcher, {
  authStrategy: "user",
});

expect(headers["Authorization"]).toMatch(/^Bearer /);
```

#### ✓ 401 Response Handling

**Test:** 401 triggers token refresh and retries

```typescript
// Setup
const onTokenExpire = vi.fn();
const refreshedToken = "new-token";
let callCount = 0;
const fetcher = vi.fn(async () => {
  callCount++;
  if (callCount === 1) {
    // First call: return 401
    const error = new Error("Unauthorized");
    (error as any).status = 401;
    throw error;
  }
  // Second call: should succeed with refreshed token
  return { data: "success" };
});

AuthLayer.registerAuthStrategy("user", {
  getToken: async () => refreshedToken,
  onTokenExpire,
});

const result = await RequestManager.fetch(
  "api:GET:/test",
  fetcher,
  { authStrategy: "user" }
);

expect(onTokenExpire).toHaveBeenCalled(); // Token refresh triggered
expect(callCount).toBe(2); // Retried after refresh
expect(result).toEqual({ data: "success" });
```

#### ✓ Per-Strategy Locking (Prevents Thundering Herd)

**Test:** Multiple concurrent 401s only trigger one token refresh

```typescript
// Setup: 3 concurrent requests, all get 401
const onTokenExpire = vi.fn();
let refreshCount = 0;

AuthLayer.registerAuthStrategy("user", {
  getToken: async () => "token",
  onTokenExpire: async () => {
    refreshCount++;
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  },
});

const fetcher = async () => {
  const error = new Error("Unauthorized");
  (error as any).status = 401;
  throw error;
};

// Fire 3 concurrent 401 requests
const promises = Array(3).fill(null).map(() =>
  RequestManager.fetch("api:GET:/test", fetcher, {
    authStrategy: "user",
  }).catch(() => null) // Expect them to fail after retry
);

await Promise.all(promises);

// onTokenExpire should be called ONCE, not 3 times
expect(refreshCount).toBe(1);
```

**Result:** Verify that concurrent 401s on same strategy don't create thundering herd

#### ✓ Offline Detection (Skip Refresh)

**Test:** 401 offline skips refresh and re-throws error

```typescript
// Setup: Offline network status
vi.mocked(NetworkDetection.getStatus).mockReturnValue({
  isOnline: false,
  type: "none",
  isExpensive: false,
  connectionQuality: "unknown",
});

const onTokenExpire = vi.fn();
AuthLayer.registerAuthStrategy("user", {
  getToken: async () => "token",
  onTokenExpire,
});

const fetcher = async () => {
  const error = new Error("Unauthorized");
  (error as any).status = 401;
  throw error;
};

// Request should fail with 401, no refresh attempt
const result = await RequestManager.fetch(
  "api:GET:/test",
  fetcher,
  { authStrategy: "user" }
).catch(e => e);

expect(onTokenExpire).not.toHaveBeenCalled(); // No refresh offline
expect(result.message).toContain("Unauthorized");
```

**Result:** Verify that offline 401s don't attempt token refresh

#### ✓ Auth State Clear on Refresh Failure

**Test:** Failed token refresh clears auth state

```typescript
// Setup: Simulate token refresh failure
const onTokenExpire = vi.fn(async () => {
  throw new Error("Token refresh failed");
});

AuthLayer.registerAuthStrategy("user", {
  getToken: async () => "expired-token",
  onTokenExpire,
});

const clearAuthStateSpy = vi.spyOn(AuthStateManager, "clearAuthState");
const fetcher = async () => {
  const error = new Error("Unauthorized");
  (error as any).status = 401;
  throw error;
};

// Request should fail AND clear auth state
await RequestManager.fetch(
  "api:GET:/test",
  fetcher,
  { authStrategy: "user" }
).catch(() => null);

expect(clearAuthStateSpy).toHaveBeenCalled(); // Auth cleared on refresh failure
```

**Result:** Verify auth state cleared to prevent infinite 401 loops

#### ✓ Public Strategy (No Auth Required)

**Test:** Public strategy returns no token

```typescript
const fetcher = vi.fn(async (headers?: Record<string, string>) => {
  expect(headers?.["Authorization"]).toBeUndefined(); // No auth header
  return { data: "public" };
});

AuthLayer.registerAuthStrategy("public", createPublicAuthStrategy());

const result = await RequestManager.fetch(
  "auth:signup",
  fetcher,
  { authStrategy: "public" }
);

expect(result).toEqual({ data: "public" });
```

#### ✓ Different Strategies Independent

**Test:** Multiple strategies don't interfere (user vs service account)

```typescript
// Setup: Two strategies with different tokens
const userToken = "user-token-xyz";
const serviceToken = "service-token-abc";

AuthLayer.registerAuthStrategy("user", {
  getToken: async () => userToken,
  onTokenExpire: async () => {},
});

AuthLayer.registerAuthStrategy("service", {
  getToken: async () => serviceToken,
  onTokenExpire: async () => {},
});

// User request
const userFetcher = vi.fn(async (h?: Record<string, string>) => {
  expect(h?.["Authorization"]).toContain(userToken);
  return { user: true };
});

// Service request
const serviceFetcher = vi.fn(async (h?: Record<string, string>) => {
  expect(h?.["Authorization"]).toContain(serviceToken);
  return { service: true };
});

await RequestManager.fetch("api:user", userFetcher, {
  authStrategy: "user",
});

await RequestManager.fetch("api:service", serviceFetcher, {
  authStrategy: "service",
});

// Verify each got correct token
expect(userFetcher).toHaveBeenCalled();
expect(serviceFetcher).toHaveBeenCalled();
```

## Manual Testing

### Test 401 Flow End-to-End

1. Start app in dev mode
2. Login to create valid session
3. In browser DevTools, manually clear session cookie/token
4. Make API request (e.g., fetch worlds)
5. **Expected:** Request fails with 401, redirects to login (AuthStateManager cleared auth)
6. **Actual:** Check browser console for logs:
   - "Got 401, attempting token refresh" (should not appear if offline)
   - "Token refresh failed—clearing auth state"
   - Route guard redirects to /login

### Test Concurrent 401s

1. Open app in two browser tabs (same session)
2. Clear auth in DevTools
3. Click "Fetch worlds" in both tabs simultaneously
4. **Expected:** Only ONE token refresh attempted (lock prevents double refresh)
5. **Actual:** Check logs - should see "Waiting for user token refresh" on second request

### Test Offline 401

1. Start app online, login
2. Disable network (DevTools → Network tab → "Offline")
3. Make API request that will fail
4. Click retry or reload
5. **Expected:** No token refresh attempt (skipped when offline)
6. **Actual:** Check logs - should see "Offline detected—skipping token refresh"

## Environment Setup

### config/test-tokens.ts (Gitignored)

```typescript
/**
 * Test tokens from Supabase dev instance (gitignored)
 * 
 * Pre-populate via CI/CD:
 * 1. Supabase sign-in with TEST_USER_EMAIL/PASSWORD
 * 2. Extract access_token from session
 * 3. Write to this file
 * 4. Tests run with real tokens
 */

export const TEST_TOKENS = {
  userAccessToken: process.env.TEST_USER_TOKEN || "",
  userRefreshToken: process.env.TEST_USER_REFRESH_TOKEN || "",
  serviceAccessToken: process.env.TEST_SERVICE_TOKEN || "",
};
```

### GitHub Actions CI Setup

```yaml
- name: Generate test tokens
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
  run: |
    # Sign in to Supabase, extract token, write to config/test-tokens.ts
    npm run generate-test-tokens

- name: Run tests
  run: npm run test
```

## Known Limitations

1. **Tokens expire:** Test tokens expire after ~1 hour. In CI, generate fresh tokens before each run.
2. **Shared test user:** If multiple CI jobs run concurrently, token refreshes may overlap. Consider per-job test users.
3. **Live Supabase dependency:** Tests require live Supabase connection. Can't run offline.

## Troubleshooting

### Tests failing: "No token from strategy 'user'"

**Cause:** SessionService.getCurrentSession() returns null (no session exists)

**Fix:** Check test setup creates session before auth tests run, or mock SessionService

### Tests hanging: "Waiting for user token refresh"

**Cause:** Per-strategy lock not releasing (onTokenExpire error)

**Fix:** Verify onTokenExpire() wrapped in try/catch, check error logs

### "Offline detected—skipping token refresh" appearing in online tests

**Cause:** NetworkDetection.getStatus().isOnline mocked as false

**Fix:** Reset mock before test: `vi.mocked(NetworkDetection.getStatus).mockRestore()`
