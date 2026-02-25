# Logger System Guide

Centralized, category-driven logging with multiple opt-in features for performance monitoring, context injection, and log deduplication.

## Core API: Category-Chaining

All logging uses the **category-chaining API**, not legacy string-first calls.

```typescript
import { logger } from "@/lib/utils/logger";

// Basic syntax: logger.category('category').level(message, metadata)
logger.category('auth').info('User logged in', { userId: '123' });
logger.category('api').warn('Slow response', { duration: 2000 });
logger.category('network').error('Connection failed', { error: err });
```

## Log Levels

| Level | Color | Use Case | Example |
|-------|-------|----------|---------|
| `debug` | Magenta | Detailed diagnostic info (control flow, state changes) | "Retrying failed request" |
| `info` | Default | General informational events | "User session restored" |
| `warn` | Yellow | Unexpected but recoverable situations | "Slow API response (1.2s)" |
| `error` | Red | Error conditions (exceptions, failures) | "Authentication failed: token expired" |
| `analytics` | Blue | User behavior tracking / analytics events | "Feature flag evaluated for user" |
| `perf` | Green | Performance metrics (timings, durations) | "Request completed in 245ms" |

## Log Categories

Organized by functional domain:

| Category | Purpose |
|----------|---------|
| `auth` | Authentication, login/logout, session management |
| `api` | API requests, HTTP calls, request deduplication |
| `network` | Network status, connectivity, battery, cellular |
| `database` | Database queries, Supabase provider initialization |
| `storage` | Local storage, caching, data persistence |
| `navigation` | Route changes, screen transitions, deep links |
| `offline` | Offline queue, sync operations, background sync |
| `jobs` | Background job queue, task scheduling |
| `ui` | Component rendering, UI updates |
| `performance` | Performance profiling, metrics |
| `security` | Auth tokens, encryption, sensitive data |
| `bootstrap` | App startup, kernel initialization |
| `realtime` | Real-time subscriptions, WebSocket events |
| `feature_flags` | Feature flag evaluation and rollout |
| `buckets` | File/blob storage operations |
| `error` | Error handling, error tracking |
| `analytics` | Telemetry, user tracking (duplicate of level?) |
| `other` | Miscellaneous, catch-all |

### Choosing a Category

- **Use `api`** for REST/GraphQL requests, retry logic, response handling
- **Use `network`** for connectivity status, battery/cellular changes, network quality
- **Use `auth`** for login, logout, token refresh, session state
- **Use `storage`** for local caching, persistence operations
- **Use `offline`** for offline queue management, sync state
- **Use `bootstrap`** for app initialization phases, kernel readiness
- **Use `error`** for error tracking and error-specific logic (not exceptions themselves)

## Feature Flag: Debug Logs

Debug log level is **feature-flag controlled** via `debugLogs` flag in:
- `config/appsettings.*.json` (static, for development/testing)
- Server-synced feature flags (dynamic, after app boots)

```typescript
// Both debug + analytics + perf levels enabled when debugLogs = true
// Only error level when debugLogs = false
logger.category('api').debug('Detailed request info'); // Only when flag enabled
logger.category('api').error('Request failed');        // Always logged
```

---

## Optional Features (Tier 1-4)

### Feature A: Context Stack (Tier 1)

Auto-inject userId, worldId, requestId into all logs without manually passing them.

```typescript
// Once at app init (after current user loaded):
logger.setContext({ userId: '550e8400-e29b-41d4-a716-446655440000' });

// Now all logs auto-include [userId='550e8400...'] tags:
logger.category('auth').info('Session restored');
// Output: [auth] info Session restored [userId='550e8400...']

// Add more context at any time:
logger.setContext({ userId: '123', worldId: 'abc456', requestId: 'req-789' });

// Clear context:
logger.clearContext();

// Get current context:
const context = logger.getContext(); // { userId: '123', worldId: 'abc456' }
```

**Best for:**
- Tracing logs across related requests (all logs for a user have consistent userId tag)
- Reducing boilerplate (no need to pass userId to logger calls deep in call stack)
- Debugging (correlate logs by userId/worldId across entire session)

**Example use case:**
```typescript
// In auth-state.ts, after successfully loading user:
const userData = await backend.getJSON(STORAGE_KEYS.USER_DATA);
if (userData?.id) {
  logger.setContext({ userId: userData.id });
  logger.category('auth').info('User context loaded');
}

// Now all downstream logs include userId automatically
```

---

### Feature B: Batch Event Logger (Tier 2)

Suppress duplicate logs within a time window (deduplicate rapid high-frequency events).

```typescript
import { logger } from "@/lib/utils/logger";

// Suppress duplicates within 100ms window
logger.category('network').batch('Network state: online', 100);
logger.category('network').batch('Network state: online', 100); // Suppressed
logger.category('network').batch('Network state: online', 100); // Suppressed
// Only first one logs; subsequent duplicates within 100ms window suppressed

// Different message? Logs it:
logger.category('network').batch('Network state: offline', 100); // Logs because different
```

**Parameters:**
- `message`: Log message (exact string match for deduplication)
- `debounceMs`: Time window in milliseconds (100-500 typical)

**Best for:**
- High-frequency state changes (network status, battery level, signal strength)
- Network quality transitions (connection quality, effective type changes)
- Reducing console spam from rapidly-firing events
- Preventing log explosion in flaky network conditions

**Example implementations:**
```typescript
// network-detection.ts - battery status changes every second
logger.category('network').batch(`Battery: ${level}%`, 500);

// state-machine.ts - state transitions from network flakiness
logger.category('network').batch(`State: ${from} → ${to}`, 100);

// Any high-frequency event listener:
element.addEventListener('pointermove', () => {
  logger.category('ui').batch(`Pointer: ${x},${y}`, 50); // Max 1 log per 50ms
});
```

---

### Feature C: Performance Timing (Tier 2)

Measure async operation duration and auto-log with perf level.

```typescript
import { logger } from "@/lib/utils/logger";

// Start timer
const timer = logger.startTiming('api', 'Fetch user profile');

// Do async work
const user = await fetchUserProfile(userId);

// Get elapsed time (non-blocking)
const elapsed = timer.getElapsed(); // milliseconds

// End timer (logs automatically with perf level)
timer.end();
// Output: [api] perf Fetch user profile completed in 245ms { duration: 245 }
```

**With metadata:**
```typescript
const timer = logger.startTiming('api', 'Request /api/users');
const result = await fetch('/api/users');
const elapsed = timer.getElapsed();

logger.category('api').perf('Request completed', {
  duration: elapsed,
  endpoint: '/api/users',
  status: 200,
  retries: 2
});
```

**Best for:**
- API requests (measure total time including retries)
- Database queries (measure query execution)
- Heavy computations (measure algorithm runtime)
- Feature flag evaluations (measure rollout check time)
- Memory-intensive operations (pair with profiler)

**Example implementations:**
```typescript
// request-manager.ts - all API requests
const timer = logger.startTiming('api', `Request ${endpoint}`);
const result = await executeWithTimeout(fn, timeout);
timer.end(); // Auto-logs duration

// database queries
const timer = logger.startTiming('database', 'Query users table');
const users = await db.query('SELECT * FROM users');
logger.category('database').perf('Query completed', {
  duration: timer.getElapsed(),
  rows: users.length
});

// feature flag evaluation
const timer = logger.startTiming('feature_flags', 'Evaluate flag');
const enabled = await evaluateFlag(flagName, userId);
logger.category('feature_flags').perf('Evaluation complete', {
  duration: timer.getElapsed(),
  enabled,
  flagName
});
```

---

### Feature E: Structured Metadata (Tier 3)

Optional schema registry for log validation (foundation for future enforcement).

```typescript
import { logger, LOG_SCHEMAS } from "@/lib/utils/logger";

// Example schemas (documentation + future validation)
const schemas = {
  'auth.login': { userId: 'string', provider: 'string', duration: 'number' },
  'api.request': { endpoint: 'string', method: 'string', status: 'number', duration: 'number' },
  'network.status': { type: 'string', online: 'boolean', quality: 'string' }
};

// Log with validated metadata (currently optional, can be enforced later)
logger.category('auth').info('User logged in', {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  provider: 'google',
  duration: 1200
});
```

**Current status:** Foundation only (no validation enforced yet)

**Future use:** Validate log metadata against schemas to ensure consistency and catch missing fields.

---

## Automatic Enrichment

Logs automatically enrich with:

### Error Code Metadata
When logging an `AppError`, error codes and metadata auto-attach:

```typescript
import { AppError } from "@/lib/utils/error";
import { logger } from "@/lib/utils/logger";

try {
  // ... operation that fails with APP_ERROR.AUTH_TOKEN_EXPIRED
} catch (error) {
  logger.category('auth').error('Auth failed', { appError: error });
  // Auto-enriches with: code, category, severity, message (from ERROR_CODES)
}
```

### PII Redaction
Sensitive fields auto-redacted (emails, tokens, SSNs, credit cards):

```typescript
logger.category('auth').info('User data', {
  email: 'user@example.com',      // Redacted to [REDACTED]
  auth_token: 'secret-xyz',       // Redacted to [REDACTED]
  phone: '555-1234'               // Redacted to [REDACTED]
});
```

---

## Practical Recipes

### Recipe 1: API Request with Timing + Context

```typescript
import { logger } from "@/lib/utils/logger";

async function fetchWorlds(userId: string) {
  // Set context once per user session
  logger.setContext({ userId });
  
  const timer = logger.startTiming('api', 'Fetch worlds');
  try {
    const response = await fetch(`/api/users/${userId}/worlds`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const worlds = await response.json();
    logger.category('api').perf('Worlds fetched', {
      duration: timer.getElapsed(),
      count: worlds.length,
      endpoint: '/api/users/:id/worlds'
    });
    return worlds;
  } catch (error) {
    logger.category('api').perf('Worlds fetch failed', {
      duration: timer.getElapsed(),
      error: (error as Error).message,
      endpoint: '/api/users/:id/worlds'
    });
    throw error;
  }
}
```

### Recipe 2: High-Frequency Status Changes with Batch

```typescript
import { logger } from "@/lib/utils/logger";

// Battery level listener (fires every 1-2 seconds on some devices)
function setupBatteryListener() {
  const battery = navigator.getBattery();
  battery.addEventListener('levelchange', () => {
    // Suppress duplicate logs within 500ms
    logger.category('network').batch(`Battery: ${battery.level}%`, 500);
  });
  
  battery.addEventListener('chargingchange', () => {
    // Suppress duplicate logs within 500ms
    logger.category('network').batch(`Charging: ${battery.charging ? 'on' : 'off'}`, 500);
  });
}
```

### Recipe 3: Multi-Retry Request with Full Logging

```typescript
import { logger } from "@/lib/utils/logger";

async function executeWithRetry(fn, maxRetries = 3) {
  const timer = logger.startTiming('api', 'Request with retries');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.category('api').debug('Attempt', { attempt, maxRetries });
      const result = await fn();
      logger.category('api').perf('Request succeeded', {
        duration: timer.getElapsed(),
        attempts: attempt,
        status: 'success'
      });
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.category('api').perf('Request failed after retries', {
          duration: timer.getElapsed(),
          attempts: attempt,
          error: (error as Error).message,
          status: 'failed'
        });
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 100; // Exponential backoff
      logger.category('api').warn('Retrying after error', {
        attempt,
        nextDelay: delay,
        error: (error as Error).message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Recipe 4: Feature Flag Evaluation with Timing

```typescript
import { logger } from "@/lib/utils/logger";

async function isFeatureEnabled(flagName: string, userId: string): Promise<boolean> {
  const timer = logger.startTiming('feature_flags', `Evaluate ${flagName}`);
  
  try {
    const enabled = await evaluateFlagFromServer(flagName, userId);
    logger.category('feature_flags').perf('Flag evaluated', {
      duration: timer.getElapsed(),
      flagName,
      enabled,
      userId
    });
    return enabled;
  } catch (error) {
    logger.category('feature_flags').error('Flag evaluation failed', {
      duration: timer.getElapsed(),
      flagName,
      error: (error as Error).message
    });
    return false; // Failsafe default
  }
}
```

---

## Common Mistakes & Best Practices

### ✅ DO

- **Use category-chaining:** `logger.category('api').info(...)`
- **Set context once:** `logger.setContext({ userId })` after user loads
- **Use batch() for high-frequency:** Network status, battery, input events
- **Use perf() for critical paths:** API requests, DB queries, heavy ops
- **Include relevant metadata:** Endpoint, duration, status, error messages
- **Use appropriate levels:** `error` for exceptions, `warn` for unexpected, `info` for important, `debug` for detail

### ❌ DON'T

- **Don't use legacy string-first API:** ~~`logger.info('auth', ...)`~~ → Use `logger.category('auth').info(...)`
- **Don't log every state change:** Use `batch()` to deduplicate
- **Don't spam logs on bootstrap:** Remove non-critical startup logs (done in cleanup pass)
- **Don't include PII directly:** Logger auto-redacts sensitive fields, but avoid when possible
- **Don't ignore feature flags:** Only log debug/analytics when `debugLogs` enabled
- **Don't start timer but don't end it:** Always call `timer.end()` or `timer.getElapsed()`

---

## Architecture

**Location:** `lib/utils/logger.ts` (695 lines)

**Exports:**
- `logger`: Singleton instance with `category()`, `setContext()`, `startTiming()`
- `CategoryLogger` class: Methods for each level + `batch()`
- `LogCategory`, `LogLevel` types: For TypeScript safety
- `PerfTimer` interface: Return type of `startTiming()`
- `LogMetadata`, `LogSchema` types: For optional validation
- `LOG_SCHEMAS` constant: Example schemas (documentation)

**Dependencies:**
- `@/lib/config/loader`: Load feature flags (debugLogs)
- `@/lib/utils/redaction-manager`: Auto-redact PII
- AppError duck-typing: For error enrichment

---

## Future Enhancements

1. **Schema validation**: Enforce metadata against LOG_SCHEMAS at runtime (Tier 3 completion)
2. **Log rotation**: Archive old logs to file storage (Tier 4)
3. **Structured output**: JSON formatting option for log aggregation services
4. **Performance profiling**: Integration with performance.measure() API
5. **Log export**: Download logs from app for debugging
6. **Remote telemetry**: Send critical logs to backend (errors, perf metrics)

---

For implementation examples, see:
- [request-manager.ts](../../lib/api/request-manager.ts) - API request timing + perf logging
- [auth-state.ts](../../lib/auth/auth-state.ts) - Context stack injection
- [state-machine.ts](../../lib/network/state-machine.ts) - Batch event deduping
- [network-detection.ts](../../lib/network/network-detection.ts) - Battery/network status batching
