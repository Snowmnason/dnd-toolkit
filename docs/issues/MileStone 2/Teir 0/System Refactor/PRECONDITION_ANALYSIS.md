# Precondition & Error Handling Cross-File Analysis

## Executive Summary

**Total Precondition/Error Handling Code:** ~1,200-1,400 lines across 6 files  
**Total Business Logic Code:** ~1,400-1,600 lines across 6 files  

**Key Finding:** Preconditions and error handling consume **45-60% of code** across the codebase. Multiple files contain **duplicated precondition checks** that could be centralized in middleware.

**Most Common Preconditions (Deduplication Candidates):**
1. ✅ **Network status checks** (request-manager, breadcrumb-queue) — **2 implementations**
2. ✅ **Auth provider readiness** (authService, auth-operations, common.ts) — **3+ implementations**
3. ✅ **Rate limiting/guards** (authService, auth-operations, request-manager) — **multiple patterns**
4. ✅ **Error classification & retry logic** (authService, auth-operations, request-manager) — **3 implementations**
5. ✅ **Deduplication logic** (request-manager, breadcrumb-queue) — **2 separate implementations**
6. ✅ **Input validation** (authService, auth-operations, SupabaseUserRepository) — **multiple patterns**

---

## File-by-File Analysis

### 1. `lib/auth/authService.ts` (590 lines total)

| Metric | Count |
|--------|-------|
| **Precondition/Error Logic** | ~255-290 lines (43-49%) |
| **Business Logic** | ~300-335 lines (51-57%) |

#### Preconditions Checked:
- ✅ Input validation (`validateEmail`, `validatePassword`)
- ✅ Rate limiting guard (`checkAuthGuard` for signup/signin/reset)
- ✅ Auth provider readiness (`await getAuthProvider()`)
- ✅ Error classification/retry strategy (`classifyErrorRetryStrategy`)
- ✅ Session persistence checks
- ✅ Profile validation & database readiness
- ✅ Pending invites check

#### Problem Areas:
```typescript
// Line ~95-130: Rate guard + error handling is repeated 3 times (signup, signin, reset)
const guard = await checkAuthGuard(sanitizedEmail, "signup");
if (!guard.allowed) {
  // ~10 lines of retry calculation and error formatting
}

// Line ~155-175: Error classification logic
const error = signupResult.error;
const retryStrategy = classifyErrorRetryStrategy(error);
// Similar pattern in signin & reset

// Line ~200-330: signInUser has massive post-success flow
// - Profile fetch (database call)
// - Profile validation
// - Pending invites check  
// - Multiple conditional redirects
// This is 60% post-success error handling, not business logic
```

#### Duplicate Patterns Found:
- Rate guard check appears 3 times (signup, signin, reset) — **12 lines × 3 = 36 lines of duplication**
- Error classification logic appears 3 times — **Similar pattern across auth operations**
- Profile validation + redirect logic is duplicated in both authService.ts and auth-operations.ts

---

### 2. `lib/auth/auth-operations.ts` (716 lines total)

| Metric | Count |
|--------|-------|
| **Precondition/Error Logic** | ~310-370 lines (43-52%) |
| **Business Logic** | ~346-406 lines (48-57%) |

#### Preconditions Checked:
- ✅ Input validation (email, password)
- ✅ Rate limiting guard (3 operations)
- ✅ Auth provider readiness (`await getAuthProvider()`)
- ✅ Error classification/retry strategy
- ✅ Session validation (`getSession()` before updatePassword)
- ✅ Password strength validation

#### Problem Areas:
```typescript
// Line ~150-200: Identical rate guard pattern as authService.ts
const guard = await checkAuthGuard(sanitizedEmail, "signup");
if (!guard.allowed) {
  // Same 10-line pattern
}

// Line ~130-150: classifyErrorRetryStrategy duplicated from authService.ts
function classifyErrorRetryStrategy(error: unknown): ErrorRetryStrategy {
  // ~40 lines, exact duplicate
}

// Line ~250-280: mapAuthErrorToCode() function
// Maps error types to codes — this is also pattern-duplicated in request-manager.ts

// Line ~450-470: updatePassword has guard: must be authenticated
const currentSession = await authProvider.getSession();
if (!currentSession) {
  return { success: false, error: "Not authenticated" };
}
```

#### Duplicate Patterns Found:
- `classifyErrorRetryStrategy()` — **Exact duplicate of authService.ts version**
- Rate guard checks — **Duplicated from authService.ts (3 times)**
- Error code mapping — **Pattern similar to request-manager's error handling**
- Input validation — **Duplicated across both auth modules**

---

### 3. `lib/api/request-manager.ts` (2,177 lines total)

| Metric | Count |
|--------|-------|
| **Precondition/Error Logic** | ~1,100-1,200 lines (50-55%) |
| **Business Logic** | ~977-1,077 lines (45-50%) |

This is the **largest concentration of precondition code**. The RequestManager is a comprehensive middleware, but much of it is checking prerequisites before actual request execution.

#### Preconditions Checked:
- ✅ Deduplication status (pendingRequests map check)
- ✅ Rate limiting bucket status (token bucket algorithm)
- ✅ Circuit breaker status (CircuitBreakerManager)
- ✅ AuthLayer wrapping (auth strategy check)
- ✅ QueryCache presence (useQueryCache flag)
- ✅ Network quality (NetworkDetection.getStatus())
- ✅ Adaptive payload injection (based on network quality)
- ✅ Offline queue manager integration
- ✅ Abort signal tracking (in-flight GET requests)
- ✅ Error enrichment & correlation tracking
- ✅ Sentry integration checks

#### Problem Areas:
```typescript
// Line ~650-850: Large block of precondition checks before actual fetch call
// ADAPTIVE PARAMS INJECTION (~40 lines)
if (this.shouldAutoInjectAdaptiveParams(key, options_.useAdaptiveParams)) {
  const status = NetworkDetection.getStatus();
  // ~ 10 lines of param building
}

// PARAMS CONVERSION (~10 lines)
if (options_.params) {
  keyWithParams = this.appendParamsToKey(keyWithParams, options_.params);
}

// RETRY STATE TRACKING (~20 lines)
if (initialAdaptiveQuality) {
  const existingState = this.currentRetryState.get(key);
  // ~ 10 lines of state management
}

// QueryCache CHECK (~40 lines)
if (options_.useQueryCache) {
  try {
    const cached = await QueryCache.get<T>(enrichedKey);
    // Cache validation & return
  }
}

// CIRCUIT BREAKER (~50 lines, not shown but referenced)

// RATE LIMITING (~60 lines)

// OFFLINE QUEUE (~40 lines)

// AUTH LAYER (~60 lines for header extraction)

// Total preconditions before actual fetcher call: ~300+ lines

// Line ~1,000-1,200: Error handling & enrichment
try {
  // ... actual fetch call
} catch (error) {
  // Large error enrichment block (~150 lines)
  const enrichedError = enrichError(error, {
    category: 'network',
    code: extractErrorCode(error),
    // ... 20+ fields for error context
  });
  
  // Sentry integration (~50 lines)
  if (Analytics.enabled() && trackingEnabled) {
    Analytics.recordBreadcrumb({
      // Error categorization & logging
    });
  }
  
  // Error correlation tracking (~20 lines)
  captureErrorCorrelation(error, {
    // Context data
  });
}

// Line ~1,200-1,400: Retry logic with quality downgrade
if (shouldRetry) {
  // Quality downgrade logic (~40 lines)
  if (initialAdaptiveQuality) {
    const newQuality = this.downgradeAdaptiveQuality(initialAdaptiveQuality);
    // Rebuild request with lower quality
  }
  
  // Exponential backoff (~20 lines)
  const delay = Math.pow(2, retryCount) * options_.retryDelay;
  await new Promise(r => setTimeout(r, delay));
}
```

#### Duplicate Patterns Found:
- **Error classification logic** — Similar to authService.ts/auth-operations.ts
- **Network status checks** — Same calls as breadcrumb-queue
- **Retry logic with backoff** — Pattern exists in breadcrumb-queue's markFailed()
- **Rate limiting** — Token bucket is separate from guard-based rate limiting in auth

---

### 4. `lib/database/common.ts` (300 lines)

| Metric | Count |
|--------|-------|
| **Precondition/Error Logic** | ~80-100 lines (27-33%) |
| **Business Logic** | ~200-220 lines (67-73%) |

**Lowest precondition ratio — but still has important patterns to extract.**

#### Preconditions Checked:
- ✅ Auth provider readiness (`await getAuthProvider()`)
- ✅ Session validation (null checks)
- ✅ User existence checks (null safety)
- ✅ Error handling (try/catch around database calls)
- ✅ Development mode checks (isDevelopment())

#### Problem Areas:
```typescript
// Line ~30-45: getCurrentAuthId()
export async function getCurrentAuthId(): Promise<string | null> {
  const session = await (await getAuthProvider()).getSession();  // ← Precondition
  return session?.userId || null;                                // ← Business logic
}
// 5 lines precondition, 2 lines business

// Line ~55-75: validateCurrentUser()
export async function validateCurrentUser(): Promise<...> {
  const session = await (await getAuthProvider()).getUser();  // ← Precondition
  
  if (!session) {
    logger.category("database").debug(...);
    if (isDevelopment()) {
      logger.category("database").warn(...);
    }
    return null;                                               // ← Error handling
  }
  
  return { auth_id: session.userId, email: session.email || '' };  // ← Business
}
// ~15 lines precondition/error, ~5 lines business

// Line ~90-120: validateUserForWrite()
export async function validateUserForWrite(): Promise<User> {
  const { AuthStateManager } = await import("../auth/auth-state");  // ← Precondition
  
  const validatedAuth = await validateCurrentUser();  // ← Precondition call
  
  if (!validatedAuth) {
    throw new Error("Not authenticated...");  // ← Error
  }
  
  const userProfile = await getUserRepository().getCurrentUser({ forceRefresh: true });
  
  if (!userProfile) {
    logger.category("database").error(...);
    throw new Error("User profile not found...");  // ← Error
  }
  
  try {
    await AuthStateManager.saveUserData(userProfile);  // ← Cache update
  } catch (cacheError) {
    logger.category("database").warn(...);
  }
  
  return userProfile;  // ← Business return
}
// ~30 lines precondition/error, ~10 lines actual fetch/return
```

#### Duplicate Patterns Found:
- **Auth provider readiness** — Called in 2 functions, same pattern as authService/auth-operations
- **Error handling structure** — Same try/catch/log pattern as request-manager
- **Session validation** — Null check pattern is repeated

---

### 5. `lib/database/repositories/SupabaseUserRepository.ts` (visible portion)

| Metric | Count |
|--------|-------|
| **Precondition/Error Logic** | ~120-160 lines (50-55%) |
| **Business Logic** | ~110-140 lines (45-50%) |

#### Preconditions Checked:
- ✅ Database provider readiness (`await getDatabaseProvider()`)
- ✅ Input validation (username validation function calls)
- ✅ Session validation (`getCurrentSession()`)
- ✅ Error handling (database error checks)
- ✅ Edge case handling (PGRST116 error code)

#### Problem Areas:
```typescript
// Line ~30-50: create()
return RequestManager.fetch(
  `user:create:${userData.auth_id}`,
  async () => {
    // PRECONDITIONS (~20 lines)
    if (userData.username) {
      const usernameValidation = validateUsername(userData.username);
      if (!usernameValidation.isValid) {
        throw new Error("Username contains...");
      }
      userData.username = usernameValidation.sanitized;
    }
    
    // BUSINESS LOGIC (~15 lines)
    const { data, error } = await getDatabaseProvider()
      .from("users", "public")
      .insert(userData)
      .select()
      .single();
    
    // ERROR HANDLING (~20 lines)
    if (error) {
      logger.category("database").error(...);
      throw new Error(error.message || "Failed...");
    }
    
    // LOGGING (~10 lines)
    logger.category("database").info(...)
    return data;
  },
  dbRequestOptions("create", "user"),
);
// Heavy logging is obfuscating signal-to-noise ratio
```

#### Duplicate Patterns Found:
- **RequestManager.fetch() wrapper** — Every operation is wrapped (consistent, good)
- **Validation pattern** — Same username validation across create/update
- **Error handling** — Database error extraction + logging pattern
- **Session checks** — currentUser() has generic session check

---

### 6. `lib/analytics/exporters/breadcrumb-queue.ts` (607 lines)

| Metric | Count |
|--------|-------|
| **Precondition/Error Logic** | ~300-350 lines (49-58%) |
| **Business Logic** | ~257-307 lines (42-51%) |

#### Preconditions Checked:
- ✅ Provider readiness check (`if (!provider)`)
- ✅ Consent gate check (`shouldEmitEvent()`)
- ✅ Deduplication cache check (fingerprint lookup)
- ✅ Overflow prevention (queue size check)
- ✅ Network status tracking (rate limit after 429)
- ✅ Batch spacing logic (if 100+ pending)
- ✅ Rate limit backoff (nextFlushAfterMs check)
- ✅ Retry scheduling (exponential backoff)
- ✅ Max retries exceeded check

#### Problem Areas:
```typescript
// Line ~160-210: enqueue()
async enqueue(breadcrumb: ...): Promise<QueuedBreadcrumb | null> {
  // PRECONDITION 1: Provider check (~3 lines)
  if (!this.provider) {
    logger.category('analytics').analytics('BreadcrumbQueue', 'enqueue called before init');
    return null;
  }
  
  // PRECONDITION 2: Consent gate (~10 lines)
  const consentCategory = this._getConsentCategoryForBreadcrumb(breadcrumb.category);
  const consentLevel = AnalyticsConsent.getLevel();
  if (!shouldEmitEvent(consentCategory, consentLevel)) {
    logger.category('analytics').warn(...);
    return null;
  }
  
  // PRECONDITION 3: Dedup cache check (~15 lines)
  const fingerprint = await this._computeFingerprint(breadcrumb);
  const lastSent = this.deduplicationCache.get(fingerprint);
  if (lastSent && Date.now() - lastSent < this.deduplicationTTL) {
    logger.category('analytics').warn(...);
    return null;
  }
  
  // BUSINESS LOGIC: Create queued breadcrumb (~15 lines)
  const queuedBreadcrumb: QueuedBreadcrumb = {
    id: this._bytesToHex(Crypto.getRandomBytes(16)),
    timestamp: breadcrumb.timestamp,
    // ... other fields
  };
  
  // PRECONDITION 4: Overflow check (~15 lines)
  if (this.queue.length > this.maxBreadcrumbs) {
    const dropped = this.queue.shift();
    this.overflowCount++;
    logger.category('analytics').warn(...);
  }
  
  // BUSINESS LOGIC: Persist (~5 lines)
  await this._persist();
  return queuedBreadcrumb;
}
// ~60 lines preconditions, ~25 lines business

// Line ~310-380: flush()
async flush(): Promise<void> {
  // PRECONDITION 1: State checks (~5 lines)
  if (this.isFlushing || !this.provider || this.queue.length === 0) {
    return;
  }
  
  // PRECONDITION 2: Rate limit backoff (~10 lines)
  const now = Date.now();
  if (now < this.nextFlushAfterMs) {
    logger.category('analytics').analytics(...);
    return;
  }
  
  this.isFlushing = true;
  this.lastFlushAttemptTime = now;
  
  try {
    // PRECONDITION 3: Batch spacing check (~10 lines)
    const hasLargeQueue = this.queue.length >= 100;
    if (hasLargeQueue && this.lastFlushTime && now - this.lastFlushTime < this.batchSpacingMs) {
      logger.category('analytics').info(...);
      this.isFlushing = false;
      return;
    }
    
    // PRECONDITION 4: Dedup-on-flush (~25 lines)
    let batch = this.peek(this.batchSize);
    batch = batch.filter((b) => {
      const lastSent = this.deduplicationCache.get(b.fingerprint);
      if (lastSent && now - lastSent < this.deduplicationTTL) {
        return false;  // Skip
      }
      return true;
    });
    
    if (batch.length === 0) {
      this.isFlushing = false;
      return;
    }
    
    // BUSINESS LOGIC: Send batch (~10 lines)
    this.currentBatchIds = new Set(batch.map(b => b.id));
    const result: BreadcrumbSendResult = await this.provider.sendBatch(batch);
    
    // PROCESSING: Handle results (~50 lines)
    // - Process successes (mark dedup)
    // - Process retries (call markFailed)
    // - Process discards (call discard)
    // - Handle rate-limited response (429)
  }
}
// ~80 lines preconditions, ~60 lines processing
```

#### Duplicate Patterns Found:
- **Network status checks** — Same pattern as request-manager's NetworkDetection
- **Rate limiting/backoff** — Similar exponential backoff logic as request-manager
- **Deduplication logic** — Separate implementation, but same fingerprint → set logic as request-manager
- **Batch processing** — Similar send/retry/discard pattern as request-manager retry logic
- **Config loading with fallbacks** — Same try/catch pattern as request-manager

---

## Cross-File Duplication Summary

### 1. **Auth Provider Readiness Checks** (High Impact)
**Appears in:** authService.ts, auth-operations.ts, common.ts, SupabaseUserRepository.ts  
**Lines of Duplication:** ~40-50 lines across 4 files

```typescript
// Pattern 1: Direct call with await
const authProvider = await getAuthProvider();
const session = await authProvider.getSession();

// Pattern 2: Chained
const session = await (await getAuthProvider()).getSession();

// Pattern 3: With null guard
if (!provider) { throw new Error('...'); }

// Candidates for Middleware:
// - Centralize getAuthProvider() error handling
// - Create AuthProviderMiddleware with automatic readiness validation
```

---

### 2. **Rate Limiting/Guard Logic** (High Impact)
**Appears in:** authService.ts (×3: signup, signin, reset), auth-operations.ts (×3), request-manager.ts  
**Lines of Duplication:** ~36+ lines explicitly, pattern duplicated 6+ times

```typescript
// Pattern (repeated 3× in authService.ts, 3× in auth-operations.ts):
const guard = await checkAuthGuard(sanitizedEmail, "signup");
if (!guard.allowed) {
  const retrySeconds = guard.retryAfterMs ? Math.ceil(guard.retryAfterMs / 1000) : undefined;
  return {
    success: false,
    error: retrySeconds
      ? `Too many attempts. Try again in ${retrySeconds} seconds.`
      : "Too many attempts. Please wait before trying again.",
  };
}

// This block appears 6 times with minimal variation
// Could be moved to middleware or unified helper
```

---

### 3. **Error Classification & Retry Strategy** (High Impact)
**Appears in:** authService.ts, auth-operations.ts, request-manager.ts  
**Lines of Duplication:** ~80-100+ lines total

```typescript
// Pattern 1: classifyErrorRetryStrategy (authService.ts & auth-operations.ts - EXACT DUPLICATE)
function classifyErrorRetryStrategy(error: unknown): ErrorRetryStrategy {
  if (error instanceof NetworkError) {
    return {
      shouldAutoRetry: true,
      suggestRetryAfterMs: 2000,
      reason: ERROR_CODES.RETRY.TRANSIENT_NETWORK_FAILURE,
    };
  }
  if (error instanceof RateLimitError) {
    return {
      shouldAutoRetry: false,
      suggestRetryAfterMs: (error.retryAfterSeconds || 60) * 1000,
      reason: ERROR_CODES.RETRY.RATE_LIMIT_EXCEEDED,
    };
  }
  // ... more error type checks
}

// Pattern 2: Similar logic in request-manager.ts (slightly different implementation)
// Uses enrichError() and extractErrorCode() but same classification concept

// Candidates for Unification:
// - Create ErrorClassificationMiddleware
// - Or: lib/services/error-classification.ts with shared classification logic
```

---

### 4. **Deduplication Logic** (Medium Impact)
**Appears in:** request-manager.ts, breadcrumb-queue.ts  
**Lines of Duplication:** ~50-60 lines total

```typescript
// request-manager.ts: Dedup by request key
private pendingRequests: Map<string, PendingRequest> = new Map();

if (options_.dedupe && this.pendingRequests.has(enrichedKey)) {
  return this.pendingRequests.get(enrichedKey).promise;
}

// breadcrumb-queue.ts: Dedup by fingerprint in cache
private deduplicationCache = new Map<string, number>();

const leftSent = this.deduplicationCache.get(fingerprint);
if (lastSent && Date.now() - lastSent < this.deduplicationTTL) {
  return null;
}

// Both use Map<string, value> but different keys (request key vs fingerprint)
// Could share a common DeduplicationHelper
```

---

### 5. **Exponential Backoff/Retry Logic** (Medium Impact)
**Appears in:** request-manager.ts, breadcrumb-queue.ts, authService.ts (error classification hints)  
**Lines of Duplication:** ~40-50 lines total

```typescript
// breadcrumb-queue.ts:
const backoffMs = Math.pow(2, Math.min(breadcrumb.retryCount, 4)) * this.retryBaseMs;

// request-manager.ts (inferred from code structure):
// Similar exponential backoff with configurable delays
const delay = Math.pow(2, retryCount) * options_.retryDelay;
```

---

### 6. **Network Status Checks** (Medium Impact)
**Appears in:** request-manager.ts (NetworkDetection), breadcrumb-queue.ts (network quality tracking)  
**Lines of Duplication:** ~30-40 lines

```typescript
// request-manager.ts:
const status = NetworkDetection.getStatus();
if (status) {
  const payloadOptions = getAdaptivePayloadOptions(status);
  const adaptiveParams = buildAdaptiveQueryParams(payloadOptions);
}

// breadcrumb-queue.ts:
// Manually tracking network state for rate limit backoff
private lastNetworkOnTime = 0;

// Both check network, but separate implementations
// Could centralize to NetworkStatusMiddleware
```

---

### 7. **Input Validation** (Medium Impact)
**Appears in:** authService.ts, auth-operations.ts, SupabaseUserRepository.ts  
**Lines of Duplication:** ~50-60 lines total

```typescript
// Pattern: Validation + Sanitization
const emailValidation = validateEmail(email);
if (!emailValidation.isValid) {
  return { success: false, error: "Please enter a valid email..." };
}
const sanitizedEmail = emailValidation.sanitized;

// Appears in multiple auth flows
// Same pattern for password, username validation
// Could centralize in ValidationMiddleware
```

---

## Middleware Candidates (Priority Order)

| Middleware | Files Affected | Est. Lines Saved | Priority |
|------------|---|---|---|
| **AuthProviderMiddleware** | authService, auth-operations, common.ts, SupabaseUserRepository | 40-50 | 🔴 HIGH |
| **RateLimitMiddleware** | authService, auth-operations, request-manager | 40-60 | 🔴 HIGH |
| **ErrorClassificationMiddleware** | authService, auth-operations, request-manager | 60-80 | 🔴 HIGH |
| **NetworkStatusMiddleware** | request-manager, breadcrumb-queue | 30-40 | 🟡 MEDIUM |
| **DeduplicationMiddleware** | request-manager, breadcrumb-queue | 25-35 | 🟡 MEDIUM |
| **ExponentialBackoffMiddleware** | request-manager, breadcrumb-queue | 20-30 | 🟡 MEDIUM |
| **InputValidationMiddleware** | authService, auth-operations, SupabaseUserRepository | 25-35 | 🟡 MEDIUM |
| **CacheCheckMiddleware** | request-manager, database operations | 20-30 | 🟢 LOW |

---

## Recommendations

1. **Immediate Action:** Create `lib/middleware/` folder with:
   - `auth-provider-middleware.ts` (eliminate 40-50 lines of duplication across 4 files)
   - `error-classification-middleware.ts` (consolidate classifyErrorRetryStrategy)
   - `rate-limit-middleware.ts` (eliminate 6+ identical guard blocks)

2. **Short Term:** Refactor request-manager.ts to use middleware pattern for complex preconditions

3. **Long Term:** Establish "Middleware Layer" as architectural pattern with clear rules:
   - All precondition checks go to middleware
   - Business logic units should be < 60 lines
   - Precondition/Error ratio target: < 40%

