# Structured API Client & Offline Replay - Usage Guide

**Status**: ✅ Complete  
**Last Updated**: January 30, 2026  
**Scope**: Complete guide for using Phase 3 & Phase 4 enhancements

---

## Quick Overview

This guide covers all enhancements to the APIClient factory for better performance, reliability, and offline support.

### Phase 3: Core Enhancements (10 items)

- Stale-while-revalidate for faster UX
- Mutation idempotency keys
- Batch partial failure handling
- Retry backoff with jitter
- Auth strategy validation
- Error boundaries
- Request context propagation
- Zod type inference
- Interceptor timeouts
- Circuit breaker Half-Open state

### Phase 4: Offline Replay (7 items)

- Auth-on-replay with fresh tokens
- Deterministic redaction of sensitive data
- Scheduled retries with smart backoff
- Per-entry failure telemetry
- Standardized error contracts
- Circuit breaker state tracking during replay
- Safe fallback HTTP client for sync handlers

---

## Stale-While-Revalidate Pattern

**When to use**: Frequently accessed data where instant UI feedback is more important than fresh data.

### Basic Usage

```typescript
import { UsersAPI } from "@/lib/api";

const usersAPI = new UsersAPI(httpClient);

// First call - fetches from network
const users = await usersAPI.getUsers({
  staleWhileRevalidate: true, // Enable pattern
  staleTime: 5 * 60 * 1000, // Stale after 5 min
});

// Second call within stale window - returns cached immediately
// Background fetch happens automatically
const usersAgain = await usersAPI.getUsers({
  staleWhileRevalidate: true,
});
// ✅ Instant response (cached)
// 🔄 Background refresh in progress
```

### How It Works

1. **First call**: Network fetch, cache result with timestamp
2. **Within stale window**: Return cached data immediately, revalidate in background
3. **Cache stale, user inactive**: User sees instant data while fresh data loads
4. **Fresh data arrives**: UI updates automatically if component is watching

### Implementation Notes

- Only applies when data is cached AND within staleTime
- Background revalidation doesn't block the response
- Use in list views, dashboards, frequently accessed data
- Avoid on critical mutations or one-time operations

---

## Mutation Idempotency Keys

**When to use**: Ensure retries don't create duplicates (critical for user mutations).

### Basic Usage

```typescript
// Auto-generated idempotency key
const result = await usersAPI.updateUser(
  userId,
  {
    name: "New Name",
  },
  {
    authStrategy: "user",
    invalidateTags: [`user:${userId}`],
    // idempotencyKey is auto-generated and included
  },
);

// Same mutation retried = same key = backend deduplicates
```

### How It Works

- Idempotency key is generated once per mutation
- Key is stored with the mutation in offline queue
- On replay, same key is sent to backend
- Backend recognizes key and returns cached result instead of repeating operation

### Implementation Notes

- Automatically handled by RequestManager
- Keys persist across app restarts (stored with mutation)
- Backend must support idempotency key header
- Prevents duplicate charges, notes, profile updates, etc.

---

## Batch Partial Failure Handling

**When to use**: Bulk operations where some items may fail while others succeed.

### Basic Usage

```typescript
// Offline queue handles partial failures
const results = await syncManager.syncAll();

console.log(`✅ ${results.syncedCount} succeeded`);
console.log(`❌ ${results.failedCount} failed`);
console.log(`⚠️  ${results.conflictedCount} had conflicts`);

// Failed mutations remain queued for retry
// Succeeded mutations are removed
// Conflicts need user intervention
```

### How It Works

- When syncing batch of 10 mutations, if 7 succeed and 3 fail:
  - ✅ 7 mutations removed from queue
  - ❌ 3 mutations stay queued (with failure reason)
  - Each retried individually on next sync
- Prevents cascading failures
- User sees partial progress

### Implementation Notes

- Each mutation tracked independently
- Failures don't prevent other mutations from syncing
- Use error reasons to guide user (retry later? user action needed? validation error?)
- For lists, show per-item status rather than all-or-nothing

---

## Retry Backoff with Jitter

**When to use**: Automatic (built into all mutations).

### How It Works

```
Attempt 1: Fail immediately
Attempt 2: Wait 2s + ±10% jitter = 1.8-2.2s, retry
Attempt 3: Wait 4s + ±10% jitter = 3.6-4.4s, retry
Attempt 4: Wait 8s + ±10% jitter = 7.2-8.8s, retry
... capped at 5 minutes
```

### Implementation Notes

- Exponential backoff: `2^(retryCount) * baseDelay`
- Jitter prevents "thundering herd" (all clients retrying simultaneously)
- Default: 3 retries with 1s base delay = max ~15s wait
- Can be configured in app settings
- Respects circuit breaker state (won't retry if endpoint is open)

---

## Auth Strategy Validation

**When to use**: Defining API endpoints that need specific auth levels.

### Basic Usage

```typescript
export class UsersAPI extends APIClient {
  async getUsers() {
    // No auth required - public endpoint
    return this.query("getUsers", "/api/users", {
      authStrategy: undefined, // or omit
    });
  }

  async getCurrentUser() {
    // User auth required
    return this.query("getCurrentUser", "/api/me", {
      authStrategy: "user", // User must be authenticated
    });
  }

  async deleteAllUsers() {
    // Admin auth required
    return this.mutation(
      "deleteAllUsers",
      "/api/admin/nuke",
      {},
      {
        authStrategy: "admin", // Only admins allowed
      },
    );
  }
}
```

### How It Works

- AuthLayer checks if current user has required strategy
- If missing: throws error before making request
- If present: injects token automatically
- During offline replay: uses fresh token from AuthLayer

### Implementation Notes

- Strategies are application-specific ("user", "admin", "guest", etc.)
- AuthLayer must be initialized with available strategies
- Validation happens on every request
- Prevents auth errors and unauthorized requests

---

## Error Boundaries & Recovery

**When to use**: Handle errors gracefully and retry intelligently.

### How Error Contracts Work

```typescript
import { NetworkErrorClassifier } from "@/lib/offline";

// Errors are classified into types
const error = new Error("Network timeout");
const contract = NetworkErrorClassifier.classify(error, 500);

if (contract.type === "network") {
  // Network error - definitely retry
  scheduleRetry(contract.suggestedBackoffMs);
} else if (contract.type === "auth") {
  // Auth error - refresh token and retry once
  await refreshToken();
  retry();
} else if (contract.type === "validation") {
  // Validation error - don't retry, user action needed
  showUserError("Invalid data format");
} else if (contract.type === "conflict") {
  // Conflict - merge/resolve and retry
  resolveConflict();
} else if (contract.type === "rate_limit") {
  // Rate limited - backoff significantly
  scheduleRetry(contract.suggestedBackoffMs); // 30s+
}
```

### Error Types

| Type           | Cause                 | Retryable | Suggested Action          |
| -------------- | --------------------- | --------- | ------------------------- |
| **network**    | Timeout, DNS, offline | Yes       | Exponential backoff       |
| **auth**       | 401 Unauthorized      | Yes       | Refresh token, retry once |
| **validation** | 400 Bad Request       | No        | Show user error           |
| **conflict**   | 409 Conflict          | Yes       | Resolve & retry           |
| **rate_limit** | 429 Too Many          | Yes       | Exponential backoff       |
| **server**     | 5xx Server Error      | Yes       | Exponential backoff       |
| **unknown**    | Unexpected            | No        | Log & alert               |

### Implementation Notes

- Errors are classified automatically during sync
- Classification guides retry scheduling
- Each error type has different recovery strategy
- Per-mutation error tracking for observability

---

## Request Context Propagation

**When to use**: Logging, tracing, and interceptor access to request metadata.

### Basic Usage

```typescript
const result = await usersAPI.getUsers({
  context: {
    requestId: generateId(), // Unique ID for tracing
    source: "user_list_view", // Where request came from
    userId: currentUserId, // User making request
    priority: "high", // Request priority
  },
});

// Context available in:
// - Interceptors (for logging/tracing)
// - Error handlers (for debugging)
// - Offline queue (stored with mutation)
```

### How It Works

- Context object passed through entire request lifecycle
- Available in all interceptors and handlers
- Persisted with mutation if queued offline
- Used for debugging and tracing

### Implementation Notes

- Use for debugging information only (non-critical)
- Don't store secrets in context
- Helps with "what was this request trying to do?" debugging
- Available via `RequestContext` in interceptors

---

## Zod Type Inference

**When to use**: Defining API client with automatic type safety.

### Basic Usage

```typescript
import { z } from "zod";
import { APIClient } from "@/lib/api";

// Define schema
const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
});

export class UsersAPI extends APIClient {
  async getUser(id: string): Promise<z.infer<typeof UserSchema>> {
    return this.query("getUser", `/users/${id}`);
    // Return type automatically inferred from schema
  }
}
```

### How It Works

- Use Zod schemas to define response types
- `z.infer<typeof Schema>` extracts TypeScript type
- Same schema can be used for runtime validation
- Type-safe responses with minimal boilerplate

### Implementation Notes

- Define schemas close to where they're used
- Import types from `lib/schemas` for shared schemas
- Validation happens in sync handlers (not automatically)
- Schemas document API contract

---

## Interceptor Timeouts

**When to use**: Automatic (default 30s for all requests).

### How It Works

```
Request starts
  ↓
30 seconds pass
  ↓
Timeout interceptor fires
  ↓
Request aborted
  ↓
Error classified as "network" (timeout)
  ↓
Scheduled for retry with backoff
```

### Implementation Notes

- Default timeout: 30 seconds (configurable)
- Applies to all HTTP requests through RequestManager
- Prevents hanging requests on slow networks
- Timeout is classified as network error (retryable)

---

## Circuit Breaker Pattern

**When to use**: Automatic (prevents cascading failures).

### How It Works

```
Endpoint: GET /api/users

CLOSED STATE (normal):
  - All requests go through
  - Failures tracked

Threshold reached (e.g., 5 failures in 60s):
  - State → OPEN
  - All new requests FAST-FAIL immediately
  - Prevents further load on struggling endpoint

Recovery timeout (e.g., 30s):
  - State → HALF-OPEN
  - Next request sent as "probe"
  - If succeeds: State → CLOSED
  - If fails: State → OPEN (timeout increases)
```

### Implementation Notes

- Separate circuit breaker per endpoint
- Prevents cascading failures when service is struggling
- Half-Open state allows controlled recovery
- Failures recorded and tracked for debugging

---

## Auth-on-Replay (Phase 4)

**When to use**: Offline mutations that need fresh auth tokens.

### How It Works

```typescript
// When mutation is queued offline
const queued = await queue.enqueue({
  table: "notes",
  payload: { content: "My note" },
  authStrategy: "user", // Remember auth requirement
});

// When replaying after coming online
const headers = await AuthReplayManager.injectAuthHeaders(mutation, authLayer);
// ✅ Fresh token from AuthLayer injected
// ❌ Old session token NOT used
```

### Implementation Notes

- Auth strategy stored with each mutation
- Fresh token fetched from AuthLayer on replay
- Prevents "stale token" errors during replay
- If token fetch fails, mutation fails (user can retry)

---

## Deterministic Redaction (Phase 4)

**When to use**: Automatic (all queued mutations redacted).

### How It Works

```typescript
import { RedactionManager } from "@/lib/offline";

const payload = {
  userId: "123",
  token: "abc123xyz", // ❌ Will be redacted
  password: "secret", // ❌ Will be redacted
  email: "user@example.com", // ✅ Kept
};

const redacted = RedactionManager.redactObject(payload);
// Result: { userId: "123", email: "user@example.com" }
// Tokens/passwords removed before storage
```

### Sensitive Fields (Auto-Redacted)

- `authorization`, `auth`, `token`, `refreshToken`, `idToken`
- `password`, `secret`, `privateKey`, `api_key`, `apiKey`
- `email`, `phone`, `ssn`, `creditCard`, `bankAccount`
- `access_token`, `refresh_token`, `oauth_token`

### Implementation Notes

- Redaction is deterministic (same input = same output)
- Supports nested objects and arrays
- Recursively checks all levels
- Can be validated with `validateRedaction()`

---

## Scheduled Retries with Backoff (Phase 4)

**When to use**: Automatic (all offline mutations).

### How It Works

```typescript
import { BackoffScheduler } from "@/lib/offline";

// Mutation fails
const nextAttemptAt = BackoffScheduler.calculateNextAttemptAt(mutation);
// Returns: now + 2000ms (for first retry)

// Update mutation with schedule
await queue.updateScheduledRetry(mutation.id, nextAttemptAt);

// Later, scheduler checks:
const ready = BackoffScheduler.isReadyToRetry(mutation);
if (ready) {
  // Retry now
} else {
  const waitMs = BackoffScheduler.getTimeUntilRetry(mutation);
  // Retry in waitMs milliseconds
}
```

### Timing

```
Retry 1: Wait 2s   (±10%)
Retry 2: Wait 4s   (±10%)
Retry 3: Wait 8s   (±10%)
Retry 4: Wait 16s  (±10%)
... up to 5 min cap
```

### Implementation Notes

- `nextAttemptAt` persisted with mutation
- Survives app restarts (checks on resume)
- Jitter prevents thundering herd
- Capped at 5 minutes between retries

---

## Failure Telemetry (Phase 4)

**When to use**: Observability and debugging failed mutations.

### How to Use

```typescript
import { OnlineSyncManager } from "@/lib/offline";

// Get queue statistics
const stats = await OnlineSyncManager.getQueueStats();

console.log(`
  Queue Stats:
  - Total queued: ${stats.totalQueued}
  - Network errors: ${stats.failuresByType.network}
  - Auth errors: ${stats.failuresByType.auth}
  - Validation errors: ${stats.failuresByType.validation}
  - Conflicts: ${stats.failuresByType.conflict}
  - Rate limits: ${stats.failuresByType.rate_limit}
  - Server errors: ${stats.failuresByType.server}
  - Scheduled for retry: ${stats.scheduledForRetry}
  - Avg retries: ${stats.avgRetryCount}
  - Oldest queued: ${stats.oldestMutationAge}ms ago
`);

// Per-mutation tracking
for (const mutation of queuedMutations) {
  console.log(`
    Mutation ${mutation.id}:
    - Operation: ${mutation.operation}
    - Last error: ${mutation.lastErrorMessage}
    - Error type: ${mutation.lastErrorType}
    - Retry count: ${mutation.retryCount}
    - Last attempted: ${mutation.lastAttemptAt}
  `);
}
```

### What It Shows

- Total queued count
- Breakdown by error type
- How many scheduled for retry
- Average retry attempts
- Age of oldest mutation
- Per-mutation failure reason

### Implementation Notes

- Stats collected automatically during sync
- Use for debugging user issues
- Monitor error trends (too many conflicts? network timeouts?)
- Show user-friendly messages based on error type

---

## Circuit Breaker Replay Tracking (Phase 4)

**When to use**: Automatic (prevents cascading failures on replay).

### How It Works

```
Mutation 1 fails during replay
  ↓
CircuitBreakerReplayManager.recordReplayFailure()
  ↓
CB for endpoint marked as failure
  ↓
After threshold: CB opens for endpoint
  ↓
Future mutations for that endpoint fast-fail
  ↓
Prevents hammer on struggling server
```

### Implementation Notes

- CB state automatically updated on replay failures
- Separate CB per table/endpoint
- Prevents aggressive retry storms
- Recovery allowed during Half-Open state

---

## Fetcher Registry Fallback (Phase 4)

**When to use**: Custom sync handlers that need simple HTTP client.

### How to Use

```typescript
import { FetcherRegistryFallback } from "@/lib/offline";

registerSyncHandler(
  "custom_endpoint",
  async (mutation, operation, supabase) => {
    // Get safe HTTP client
    const http = await FetcherRegistryFallback.createHttpClient(
      mutation,
      authLayer,
    );

    try {
      if (operation === "create") {
        const result = await http.post("/api/sync", {
          operation: "create",
          payload: mutation.payload,
        });
        return { success: true, data: result };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: "server", // Will be classified by sync manager
      };
    }
  },
);
```

### HTTP Client Methods

```typescript
// GET request
const user = await http.get("/api/users/123");

// POST request
const result = await http.post("/api/notes", {
  title: "My Note",
  content: "Content here",
});

// PATCH request
const updated = await http.patch("/api/users/123", {
  name: "New Name",
});

// DELETE request
await http.delete("/api/users/123");
```

### What It Provides

✅ Automatic auth header injection (fresh tokens)  
✅ JSON serialization/deserialization  
✅ HTTP status code error handling  
✅ Simple API (get/post/patch/delete)  
✅ Error classification support

### What It Doesn't Provide

❌ Request/response validation  
❌ Interceptor hooks  
❌ Automatic retry logic (sync manager handles)  
❌ Automatic cache invalidation (sync manager does)  
❌ Conflict detection

For complex scenarios, implement full sync handler with Supabase client.

### Implementation Notes

- Use for simple HTTP-based APIs
- For complex business logic, use full sync handler
- Errors automatically classified by sync manager
- Safe defaults (JSON content-type, auth injection)

---

## Integration Example

Here's how everything works together:

```typescript
import { UsersAPI } from "@/lib/api";
import { OnlineSyncManager } from "@/lib/offline";

// 1. Query with stale-while-revalidate
const users = await usersAPI.getUsers({
  staleWhileRevalidate: true,
  authStrategy: "user",
  context: { source: "dashboard" },
});
// ✅ If online: fetched with fresh auth
// ✅ If offline: queued with redacted payload
// ✅ If queued: retried with backoff + fresh token

// 2. Mutation with idempotency
const updated = await usersAPI.updateUser(
  userId,
  {
    name: "New Name",
  },
  {
    authStrategy: "user",
    invalidateTags: [`user:${userId}`],
    // Idempotency key auto-generated
  },
);
// ✅ If online: succeeds immediately
// ✅ If offline: queued with auth strategy + redaction
// ✅ On retry: same idempotency key prevents duplicates

// 3. Monitor sync progress
OnlineSyncManager.on("syncStarted", () => console.log("🔄 Syncing..."));
OnlineSyncManager.on("syncCompleted", async (result) => {
  console.log(`✅ ${result.syncedCount} succeeded`);
  const stats = await OnlineSyncManager.getQueueStats();
  if (stats.totalQueued > 0) {
    console.log(`⚠️  ${stats.totalQueued} still queued`);
  }
});

// 4. Handle errors gracefully
try {
  await usersAPI.updateUser(userId, data);
} catch (error) {
  // Error is already classified and queued if offline
  // UI can show appropriate message based on error type
  showErrorMessage(error.message);
}
```

---

## Best Practices

1. **Always include `authStrategy`** for mutations that need auth
2. **Use tags for cache invalidation** when data changes
3. **Enable stale-while-revalidate** for list views
4. **Monitor queue stats** to catch issues
5. **Handle errors based on type** (network vs validation vs auth)
6. **Test offline scenarios** - enable offline in DevTools
7. **Use context for debugging** - helps with "what went wrong?"
8. **Validate responses** in sync handlers with Zod schemas

---

## Troubleshooting

### Mutations stuck in queue

Check stats to see error type:

```typescript
const stats = await OnlineSyncManager.getQueueStats();
console.log(stats.failuresByType);
```

- **network**: Device is offline or server unreachable
- **auth**: Token expired, refresh and try manual sync
- **validation**: Payload invalid, fix before retrying
- **conflict**: Data changed on server, resolve manually
- **rate_limit**: Too many requests, wait before retrying

### Fresh auth not injected on replay

Verify `authStrategy` is set:

```typescript
// ❌ Wrong - no auth strategy
await queue.enqueue({ table: "notes", payload: {...} });

// ✅ Correct - auth strategy set
await queue.enqueue({
  table: "notes",
  payload: {...},
  authStrategy: "user",  // Required for auth injection
});
```

### Sensitive data in offline queue

Enable redaction validation in tests:

```typescript
const found = RedactionManager.validateRedaction(payload);
expect(found).toHaveLength(0); // ✅ No sensitive fields
```

### Circuit breaker stuck open

Wait for recovery timeout (~30-60s) or:

```typescript
import { CircuitBreakerManager } from "@/lib/api";
const cb = CircuitBreakerManager;
cb.reset("offline:notes"); // Manual reset if needed
```
