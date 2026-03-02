# Precondition Failure Behavior Documentation

This document catalogs what your lib modules DO when key preconditions fail. Understanding these patterns is essential for debugging, error recovery, and building resilient features.

---

## Executive Summary

| Precondition | Current Behavior | Error Signal | Retry Logic |
|---|---|---|---|
| **Network Offline** | Queue for replay | `null` returned or queued logged | Auto-replay on reconnect |
| **Provider Not Initialized** | Throw specific error | `ProviderInitializationError` or `throw` | None; fails immediately |
| **Auth Token Invalid/Expired** | Attempt refresh once, then clear state | Error thrown or state cleared | Single 401 retry after token refresh |
| **Auth Check Fails** | Return `null` or throw based on context | `null` or `Error` thrown | None; immediate failure |

---

## 1. NETWORK OFFLINE — Queueing & Replay Behavior

### When Network is Down

**Network Status Definition:**
- `offline` = True OFFLINE (no connectivity at all)
- `cellular` = Valid connected state (should NOT trigger offline queuing)
- `wifi` / `4g` / `3g` = Connected states (no queueing)

### lib/api/request-manager.ts

**File:** [lib/api/request-manager.ts](lib/api/request-manager.ts#L775)

When a request fails with network-level error (offline or circuit breaker open):

```typescript
// 1. Network Detection Check (lines 775-785)
const networkStatus = await NetworkDetection.getStatus();
const isOffline = networkStatus.connectionQuality === "offline";

if (isOffline) {
  // QUEUE FOR REPLAY
  const entry = this._buildQueueEntry(enrichedKey, options_, enrichedKey, "POST", requestContext);
  await OfflineQueueManager.enqueue(entry);
  logger.category('api').info("Request queued for offline replay", { key: enrichedKey });
  return null;  // Return null immediately
}
```

**Current Behavior:**
- ✅ **QUEUES** request immediately when `connectionQuality === "offline"`
- ✅ **Preserves context**: idempotencyKey and request context stored in queue entry
- ✅ **Preserves fetcher**: Registered fetcher functions stored in `fetcherRegistry` for replay
- ✅ **FIFO ordering**: Requests replayed in the order they were queued
- ✅ **Auto-replay on reconnect**: `breadcrumb-queue.ts` hooks into `NetworkDetection` for auto-flush
- ❌ **Max queue size**: Default 100 entries; oldest dropped when exceeded (with warning logged)
- ❌ **Max retries**: Default 3 attempts per queued request; failed entries discarded

**Error Signal:**
- Returns `null` (graceful degradation via `failOpen` behavior)
- Logs: `"Request queued for offline replay"` at `info` level

**Retry Logic:**
- Automatic replay on network restore (via `NetworkDetection` subscription)
- Manual flush via `RequestManager.flushOfflineQueue()`
- Each queued request gets up to 3 replay attempts before being discarded

### lib/analytics/exporters/breadcrumb-queue.ts

**File:** [lib/analytics/exporters/breadcrumb-queue.ts](lib/analytics/exporters/breadcrumb-queue.ts#L400)

When breadcrumb provider fails (network error):

```typescript
// Marked Failed with Exponential Backoff (lines ~ 250-260)
async markFailed(id: string, reason: string): Promise<void> {
  const breadcrumb = this.queue.find((b) => b.id === id);
  breadcrumb.retryCount++;

  if (breadcrumb.retryCount >= breadcrumb.maxRetries) {
    await this.discard(id, `max retries exceeded (${reason})`);
    return;
  }

  const backoffMs = Math.pow(2, Math.min(breadcrumb.retryCount, 4)) * this.retryBaseMs;
  breadcrumb.nextAttemptAt = Date.now() + backoffMs;
  await this._persist();
}
```

**Current Behavior:**
- ✅ **QUEUES** breadcrumbs in SecureStorage
- ✅ **Exponential backoff**: 2^n * baseMs (max 16x base delay)
- ✅ **Deduplication**: Fingerprint-based to prevent duplicate breadcrumbs
- ✅ **Auto-flush on reconnect**: Listens to NetworkDetection with 5s debounce
- ✅ **Rate limit handling**: 429 response triggers `nextFlushAfterMs` backoff
- ❌ **Max queue size**: 500 breadcrumbs; oldest dropped with `overflowCount` logged
- ❌ **Max retries**: Configurable; default from `ANALYTICS_RETRY_DEFAULTS.maxRetries`

**Error Signal:**
- Logs: `"Queue overflow: dropped old breadcrumb"` when max reached
- Logs: `"Retry scheduled at [nextAttemptAt]"` for failed breadcrumbs
- Logs: `"Discarded breadcrumb (id: [id], reason: [reason])"` for exceeded retries

**Retry Logic:**
- Exponential backoff with jitter (2s → 4s → 8s → 16s cap)
- Up to `maxRetries` attempts (3-5 default from config)
- Automatic flush on online transition (non-blocking background task)

---

## 2. PROVIDER NOT INITIALIZED — Immediate Failure

### When Auth Provider Not Registered

**File:** [system/Services/auth-adapter.ts](system/Services/auth-adapter.ts#L780)

```typescript
export async function getAuthProvider(): Promise<AuthProvider> {
  if (!registeredProvider) {
    const error = new ProviderInitializationError(
      'Provider not initialized. Did you call registerAuthProvider() during app bootstrap?'
    );
    throw error;  // THROWS IMMEDIATELY
  }
  return registeredProvider;
}
```

**Current Behavior:**
- ✅ **THROWS** `ProviderInitializationError` immediately
- ✅ **Clear error message**: Includes suggestion to check `service-initializer.ts`
- ❌ **No retry**: Caller must handle or propagate
- ❌ **No queueing**: Auth operations cannot be queued for later
- ❌ **No fallback**: Fails hard; cannot proceed without provider

**Error Signal:**
- Exception: `ProviderInitializationError`
- Message: `"Provider not initialized. Did you call registerAuthProvider()...?"`
- Category: logged as `'auth'` category

**Typical Call Stack:**
1. `signUpUser()` or `signInUser()` calls `await getAuthProvider()`
2. Throws `ProviderInitializationError`
3. Caught in try/catch block, returns error result to caller
4. UI displays error message

### When Database Provider Not Registered

**File:** [system/Services/database-adapter.ts](system/Services/database-adapter.ts#L222)

```typescript
export function getDatabaseProvider(): DatabaseProvider {
  if (!registeredProvider) {
    if (!hasWarnedNotRegistered) {
      logger.category('database').warn(
        'getDatabaseProvider() called before registerDatabaseProvider(). Returning NoOp.'
      );
    }
    return noOpProvider;  // RETURNS NoOp (not throws!)
  }
  return registeredProvider;
}
```

**Current Behavior:**
- ✅ **RETURNS NoOp provider** (does not throw; fails later on query)
- ✅ **Single dev-only warning** logged first time
- ❌ **Deferred failure**: Error thrown when you actually call query methods

**What Happens When NoOp Provider Used:**

```typescript
// NoOpDatabaseProvider.from() always throws:
from(): QueryBuilder {
  this.throwNotConfigured('query (from)');
  // Throws: "Cannot query (from). DatabaseProvider not registered..."
}
```

**Error Signal:**
- Warning logged once: `"getDatabaseProvider() called before registerDatabaseProvider()"`
- Later: Error thrown when calling `.from()`, `.insert()`, `.select()`, etc.
- Message: `"[Database] Not configured: Cannot [operation]. DatabaseProvider not registered..."`
- Category: logged as `'database'` category

**Implications:**
- `lib/database/repositories/*` calls will throw when attempting actual database operations
- Not the place to catch this—should be caught at bootstrap in `service-initializer.ts`
- Symptoms: Blank screen, silent failure, or null reference errors if error not propagated

---

## 3. AUTH TOKEN INVALID/EXPIRED — 401 Handling & Token Refresh

### lib/api/request-manager.ts — Auth Layer Error Handling

**File:** [lib/api/request-manager.ts](lib/api/request-manager.ts#L1280)

When a request receives 401 (Unauthorized):

```typescript
private async executeWithAuthLayer<T>(
  fetcher: () => Promise<T>,
  key: string,
  strategyName: string,
  retryCount: number,
): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    const status = (error as any)?.status || (error as any)?.code;

    if (status === 401 && retryCount < 1) {  // Only retry once
      logger.category("auth").info("Got 401, attempting token refresh", {
        httpStatus: 401,
        key,
        strategy: strategyName,
      });

      try {
        // OPTIMIZATION: Skip refresh if offline
        const { NetworkDetection } = await import("@/lib/network");
        if (!NetworkDetection.getStatus().isOnline) {
          throw error;  // Re-throw; let offline queue handle
        }

        // Attempt token refresh
        await AuthLayer.handle401Response(strategyName, context);
        
        // RETRY ONCE after refresh
        return await fetcher();
      } catch (refreshError) {
        // Refresh failed — check if should clear auth state
        const strategyObj = AuthLayer.getAuthStrategy(strategyName);
        const shouldClear = strategyObj?.shouldClearAuthStateOn401 ?? false;

        if (shouldClear) {
          // CLEAR AUTH STATE
          const { AuthStateManager } = await import("@/lib/auth/auth-state");
          await AuthStateManager.clearAuthState();
          logger.category('api').warn("Clearing auth state due to 401", {
            key,
            strategy: strategyName,
          });
        }

        throw error;  // Re-throw original 401
      }
    }

    throw error;  // Not a 401, or already retried once
  }
}
```

**Current Behavior:**
- ✅ **401 detected**: Check for `status === 401`
- ✅ **Retry once**: On first 401, attempt token refresh and retry
- ✅ **Offline check**: If offline during 401, skip refresh (let offline queue handle)
- ✅ **Auth state cleared**: If strategy indicates `shouldClearAuthStateOn401`, log user out
- ✅ **Single retry**: Only retries once; second 401 = thrown without retry
- ❌ **No queuing**: 401s never queued for offline replay (assumed temporary)

**Error Signal:**
- First attempt: Logs `"Got 401, attempting token refresh"`
- On refresh failure: Logs `"Token refresh failed"` + error code
- On auth state clear: Logs `"Clearing auth state due to 401"`
- Final: `Error` thrown (caller must catch)

**Retry Logic:**
1. First 401 → Attempt `AuthLayer.handle401Response()` to refresh token
2. Call fetcher again (one retry)
3. If second 401 → Throw error and optionally clear auth state
4. Caller (e.g., UI) detects cleared state and redirects to `/login`

### lib/auth/authService.ts — Auth Operation Error Handling

When calling `signUpUser()` or `signInUser()`:

**File:** [lib/auth/authService.ts](lib/auth/authService.ts#L140)

```typescript
const authProvider = await getAuthProvider();
const signupResult = await authProvider.signUp(sanitizedEmail, password, {
  emailRedirectTo: `${baseUrl}/login/auth-redirect?action=signup-confirm`,
});

if (!signupResult.success) {
  const error = signupResult.error;
  const retryStrategy = classifyErrorRetryStrategy(error);
  
  logger.category('auth').debug(`Signup error classified: ${retryStrategy.reason}`, {
    shouldAutoRetry: retryStrategy.shouldAutoRetry,
    suggestRetryAfterMs: retryStrategy.suggestRetryAfterMs,
  });

  // Check error type
  if (error instanceof EmailAlreadyExistsError) {
    return { success: false, showEmailExistsModal: true };
  }

  return { success: false, error: error.message };
}
```

**Current Behavior:**
- ✅ **Error classification**: Determines `shouldAutoRetry` and `suggestRetryAfterMs`
- ✅ **Specific modal hints**: Returns `showEmailExistsModal: true` for known errors
- ✅ **User-facing messages**: Redacted, safe error messages returned
- ❌ **No automatic retry**: Caller decides whether to retry (UI shows error, user clicks retry)
- ❌ **No queuing**: Auth operations not queued for offline replay

**Error Categories:**
```typescript
function classifyErrorRetryStrategy(error: unknown): ErrorRetryStrategy {
  if (error instanceof NetworkError) {
    return {
      shouldAutoRetry: true,
      suggestRetryAfterMs: 2000,  // 2s
      reason: "TRANSIENT_NETWORK_FAILURE",
    };
  }

  if (error instanceof RateLimitError) {
    return {
      shouldAutoRetry: false,  // User should wait
      suggestRetryAfterMs: (error.retryAfterSeconds || 60) * 1000,
      reason: "RATE_LIMIT_EXCEEDED",
    };
  }

  if (error instanceof InvalidCredentialsError || error instanceof EmailAlreadyExistsError) {
    return {
      shouldAutoRetry: false,
      reason: "PERMANENT_FAILURE",
    };
  }

  return { shouldAutoRetry: false, reason: "UNKNOWN" };
}
```

**Error Signal:**
- Returns `{ success: false, error: string | AuthError }`
- Logs at `'auth'` category with error reason
- No exception thrown (result object pattern)

---

## 4. AUTH CHECK FAILS — validateCurrentUser() Behavior

### lib/database/common.ts — validateCurrentUser()

**File:** [lib/database/common.ts](lib/database/common.ts#L70)

```typescript
export async function validateCurrentUser(): Promise<{
  auth_id: string;
  email: string;
} | null> {
  // getUser() makes a live server round-trip to validate the JWT
  const session = await (await getAuthProvider()).getUser();

  if (!session) {
    logger.category("database").debug("User validation failed: token rejected by server");

    if (isDevelopment()) {
      logger.category("database").warn(
        "DEV MODE: Auth validation failed. Do NOT bypass authentication here..."
      );
    }

    return null;  // Return null, not throw
  }

  return {
    auth_id: session.userId,
    email: session.email || '',
  };
}
```

**Current Behavior:**
- ✅ **Returns null**: When auth fails (not exception)
- ✅ **Server validation**: Calls `getUser()` which validates JWT on server
- ✅ **Logs in dev**: Warns if validation fails in development mode
- ✅ **Thread-safe**: Single read per validation call (no cached state)
- ❌ **No implicit retry**: Caller must decide to retry
- ❌ **No queueing**: Write operations cannot be queued if validation fails

### lib/database/common.ts — validateUserForWrite()

**File:** [lib/database/common.ts](lib/database/common.ts#L119)

```typescript
export async function validateUserForWrite(): Promise<User> {
  const validatedAuth = await validateCurrentUser();

  if (!validatedAuth) {
    throw new Error("Not authenticated - cannot perform write operation");  // THROWS
  }

  const userProfile = await getUserRepository().getCurrentUser({ forceRefresh: true });

  if (!userProfile) {
    logger.category("database").error("User profile not found during write validation");
    throw new Error("User profile not found - cannot perform write operation");  // THROWS
  }

  return userProfile;
}
```

**Current Behavior:**
- ✅ **Validates auth**: Calls `validateCurrentUser()` which checks server
- ✅ **Fetches fresh profile**: Calls database with `forceRefresh: true`
- ✅ **Throws on auth failure**: Immediate error if not authenticated
- ✅ **Throws on profile missing**: Data inconsistency error
- ❌ **No retry**: Caller must catch and retry
- ❌ **No graceful degradation**: Fails hard on any validation failure

**Error Signals:**
1. Auth validation fails: `"Not authenticated - cannot perform write operation"`
2. Profile missing: `"User profile not found - cannot perform write operation"`
3. Database error: `"[entity] not found"` or specific error from repository

**Typical Use Pattern:**
```typescript
// In mutation handlers (create world, update settings, etc.)
try {
  const user = await validateUserForWrite();
  const result = await worldsDB.create({ name: 'My World', ownerId: user.id });
  return result;
} catch (error) {
  if (error.message.includes("Not authenticated")) {
    // Redirect to login
    return redirect('/login');
  }
  // Handle other errors
  throw error;
}
```

---

## Comparison Matrix

| Failure Type | Module | Behavior | Error Signal | Queued? | Retried? | Logged |
|---|---|---|---|---|---|---|
| **Network Offline** | request-manager | Queue for replay | `null` returned | ✅ Yes | ✅ Auto on reconnect | ✅ info |
| **Network Offline** | breadcrumb-queue | Queue in storage | Logged as failed | ✅ Yes | ✅ Exp. backoff | ✅ warn |
| **Auth Provider Init** | auth-adapter | Throw immediately | `ProviderInitializationError` | ❌ No | ❌ No | ✅ error |
| **Database Provider Init** | database-adapter | Return NoOp | Warning (once), later error | ❌ No | ❌ No | ✅ warn |
| **401 Token Expired** | request-manager | Refresh once, retry | Error thrown | ❌ No | ✅ Single refresh | ✅ info/warn |
| **401 Permanent** | request-manager | Clear auth state | Error thrown | ❌ No | ❌ No | ✅ warn |
| **Auth Validation Fail** | database/common | Return null | `null` or Error | ❌ No | ❌ No | ✅ debug |
| **Write Validation Fail** | database/common | Throw error | `Error` thrown | ❌ No | ❌ No | ✅ error |

---

## Key Insights & Patterns

### 1. **Offline Queueing Is Smart**
- Only queues when `connectionQuality === "offline"` (not for `cellular`)
- Auto-flushes on reconnect with debounce (prevents thundering herd)
- Preserves idempotency keys and context for replay
- Falls back gracefully when queue is full (oldest dropped, warning logged)

### 2. **Provider Initialization Fails Hard**
- **Auth**: Throws `ProviderInitializationError` (eager failure)
- **Database**: Returns NoOp, fails later on first query (deferred failure)
- Neither can proceed without proper registration
- Check `service-initializer.ts` if you see these errors at startup

### 3. **401 Handling Is Symmetric**
- First 401 → Try token refresh + single retry
- Second 401 → Clear auth state (user logged out)
- Offline during 401 → Let offline queue handle (skip refresh)
- Only happens in request-manager (auth operations use own error handling)

### 4. **Logging Strategy**
- **Info level**: Expected recoverable failures (queued, 401 refresh attempts)
- **Warn level**: Degraded behavior (supply dropped, max retries exceeded, auth cleared)
- **Error level**: Unrecoverable failures (provider init, validation failed, write guards)
- **Debug level**: Low-level details (offline check, validation result details)

### 5. **No Silent Failures**
- All major failures logged with context (key, strategy, error type)
- Breadcrumb queue stats tracked (overflow count, queue size)
- Error codes attached to analytics for observability
- Correlation IDs generated for request tracking

---

## Testing Guidelines

When adding new features, verify these patterns:

1. **Network Offline**: Request queued, auto-replays on reconnect
2. **Provider Missing**: Clear error message pointing to bootstrap code
3. **Auth Expired**: Single token refresh attempt, then logout on second failure
4. **Data Validation**: Appropriate error thrown/returned, not swallowed

---

## Related Documentation

- [lib/api/request-manager.ts](lib/api/request-manager.ts) — Full retry & offline queue logic
- [lib/analytics/exporters/breadcrumb-queue.ts](lib/analytics/exporters/breadcrumb-queue.ts) — Offline breadcrumb persistence
- [system/Services/auth-adapter.ts](system/Services/auth-adapter.ts) — Provider registration & error classes
- [lib/database/repositories/SupabaseUserRepository.ts](lib/database/repositories/SupabaseUserRepository.ts) — Database error handling examples
- [lib/auth/authService.ts](lib/auth/authService.ts) — Auth operation error classification

