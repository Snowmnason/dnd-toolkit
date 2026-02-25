# Request Manager Documentation

## Overview

The `RequestManager` (`lib/api/request-manager.ts`) is a centralized API request layer that handles:

- **Request Deduplication** - Avoid duplicate in-flight requests
- **Retry Logic** - Exponential backoff with configurable retries
- **Rate Limiting** - Token bucket algorithm to prevent flooding
- **Timeout Handling** - Configurable request timeouts
- **Error Reporting** - Automatic Sentry integration
- **Fail-Open Mode** - Graceful degradation for offline scenarios
- **Future-Ready** - Extension points for offline buffering

## Quick Start

### Basic Usage

```typescript
import { RequestManager } from '@/lib';

const worlds = await RequestManager.fetch(
  `worlds:user:${userId}`,  // Unique key for deduplication
  () => worldsDB.getMyWorlds(userId),  // The actual request
  { dedupe: true }  // Options
);
```

### With Options

```typescript
const worlds = await RequestManager.fetch(
  `worlds:user:${userId}`,
  () => worldsDB.getMyWorlds(userId),
  {
    dedupe: true,              // Deduplicate concurrent requests
    retries: 3,                // Retry 3 times on failure
    retryDelay: 1000,          // Start with 1000ms, double each time
    timeout: 30000,            // 30 second timeout
    failOpen: false,           // Throw on failure (default)
    rateLimitKey: `user:${userId}` // Rate limit by user
  }
);
```

## API Reference

### `RequestManager.fetch<T>()`

Execute a request with optional dedupe, retry, rate limiting.

```typescript
async fetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: RequestOptions
): Promise<T | null>
```

**Parameters:**
- `key` - Unique identifier for the request (used for deduplication)
  - Should be deterministic (same inputs = same key)
  - Example: `worlds:user:${userId}`, `note:world:${worldId}:${noteId}`
- `fetcher` - Async function that performs the actual request
- `options` - Configuration object (see below)

**Returns:**
- The result of the fetcher function, or `null` if failOpen is true and request fails

**Throws:**
- Error if request fails and failOpen is false

### RequestOptions

```typescript
interface RequestOptions {
  // Deduplicate identical concurrent requests (default: true)
  dedupe?: boolean;
  
  // Number of retry attempts on failure (default: 3)
  retries?: number;
  
  // Initial retry delay in ms, exponentially backed off (default: 1000)
  retryDelay?: number;
  
  // If true and request fails, return null instead of throwing (default: false)
  failOpen?: boolean;
  
  // Rate limit key - if provided, applies rate limiting (optional)
  rateLimitKey?: string;
  
  // Timeout in ms for the request (default: 30000)
  timeout?: number;
}
```

### Other Methods

#### `RequestManager.getStats()`

Get debugging information about pending requests and rate limits.

```typescript
const stats = RequestManager.getStats();
// {
//   pendingRequests: 5,
//   pendingKeys: ['worlds:user:123', 'notes:world:456', ...],
//   rateLimitedKeys: ['user:789'] // Keys currently rate limited
// }
```

#### `RequestManager.clearPending()`

Clear all pending requests. Use during logout/cleanup.

```typescript
RequestManager.clearPending();
```

#### `RequestManager.resetRateLimit(key?)`

Reset rate limits for a specific key or all keys.

```typescript
// Reset for specific key
RequestManager.resetRateLimit(`user:${userId}`);

// Reset all
RequestManager.resetRateLimit();
```

## Common Patterns

### Pattern 1: Deduplicate World List Fetches

**Problem:** Multiple components might fetch the same world list simultaneously.  
**Solution:** Use RequestManager with dedupe enabled.

```typescript
// Component 1
const worlds = await RequestManager.fetch(
  `worlds:user:${userId}`,
  () => worldsDB.getMyWorlds(userId),
  { dedupe: true }
);

// Component 2 (same request)
// RequestManager returns the same promise from Component 1
// No duplicate database call!
```

### Pattern 2: Resilient Data Fetching with Retries

**Problem:** Network is flaky, requests fail randomly.  
**Solution:** Use RequestManager with retries and reasonable delays.

```typescript
const notes = await RequestManager.fetch(
  `notes:world:${worldId}`,
  () => notesDB.getByWorldId(worldId),
  {
    retries: 5,        // Try up to 5 times
    retryDelay: 500,   // Start with 500ms
    timeout: 20000     // Give up after 20 seconds
  }
);
```

### Pattern 3: Rate-Limited High-Traffic Endpoints

**Problem:** User is hammering a button, creating duplicate requests.  
**Solution:** Use RequestManager with rate limiting.

```typescript
async function createWorld(data) {
  const user = await RequestManager.fetch(
    `validate:user:${userId}:create-world`,
    () => validateUserForWrite(),
    {
      dedupe: true,
      retries: 2,
      rateLimitKey: `user:${userId}:create-world`,
      // Token bucket: 10 requests/second, bursts up to 20
      // Further requests return false/null until tokens refill
    }
  );
  
  if (!user) {
    // Rate limited or offline
    showToast('Too many requests, please wait');
    return;
  }
  
  // Proceed with world creation
}
```

### Pattern 4: Graceful Degradation (Offline)

**Problem:** User is offline, don't want to wait 30 seconds timing out.  
**Solution:** Use failOpen to return null quickly.

```typescript
const worlds = await RequestManager.fetch(
  `worlds:user:${userId}`,
  () => worldsDB.getMyWorlds(userId),
  {
    timeout: 5000,      // Quick timeout
    failOpen: true      // Return null on failure
  }
);

if (!worlds) {
  // Show cached data or empty state
  showCachedWorlds();
} else {
  // Show fresh data
  displayWorlds(worlds);
}
```

## How It Works

### Deduplication

When two identical requests are made concurrently:

```
Request 1: fetch('worlds:user:123', fetcher)
Request 2: fetch('worlds:user:123', fetcher)  [same key]

Timeline:
T0:   Request 1 starts
T5:   Request 2 starts
      → RequestManager detects key is already pending
      → Returns same promise as Request 1
T200: Both complete with same result (only 1 DB call!)
```

### Retry with Exponential Backoff

When a request fails:

```
Attempt 1:  [fails after 200ms]
Attempt 2:  [waits 1000ms, fails after 200ms]
Attempt 3:  [waits 2000ms, fails after 200ms]
Attempt 4:  [waits 4000ms, fails after 200ms]

Total time: 200 + 1000 + 200 + 2000 + 200 + 4000 + 200 = 7800ms
All retries exhausted, throws error
```

### Rate Limiting (Token Bucket)

```
Default: 10 requests/second, max 20 tokens (2 second burst)

Request 1: tokens=20 → request allowed → tokens=19
Request 2: tokens=19 → request allowed → tokens=18
...
Request 20: tokens=1 → request allowed → tokens=0
Request 21: tokens=0 → RATE LIMITED, returns null or throws

After 1 second:
tokens = 0 + (10 tokens/sec × 1 sec) = 10
Request 22: tokens=10 → request allowed → tokens=9
```

### Error Handling & Sentry

```typescript
// When a request fails:
try {
  await RequestManager.fetch(key, fetcher);
} catch (error) {
  // Error is automatically reported to Sentry with context:
  // {
  //   tags: { component: 'request-manager', requestKey: 'worlds:user:123' },
  //   contexts: {
  //     request: {
  //       key: 'worlds:user:123',
  //       dedupe: true,
  //       retries: 3,
  //       failOpen: false,
  //       timeout: 30000,
  //       rateLimited: false
  //     }
  //   }
  // }
  
  // Then error is re-thrown (unless failOpen=true)
  throw error;
}
```

## Migration Guide

### Step 1: Identify High-Traffic Reads

Look for:
- Hooks that fetch data (useWorlds, useNotes, etc.)
- Multiple components fetching identical data
- Data that doesn't change frequently

### Step 2: Generate Deterministic Keys

```typescript
// ✅ Good - always the same for same userId
const key = `worlds:user:${userId}`;

// ✅ Good - includes all parameters
const key = `note:world:${worldId}:${noteId}`;

// ❌ Bad - non-deterministic
const key = `worlds:${Date.now()}`;

// ❌ Bad - doesn't include all inputs
const key = `worlds`;  // What user?
```

### Step 3: Wrap Existing Calls

```typescript
// Before
const worlds = await worldsDB.getMyWorlds(userId);

// After
const worlds = await RequestManager.fetch(
  `worlds:user:${userId}`,
  () => worldsDB.getMyWorlds(userId),
  { dedupe: true, rateLimitKey: `user:${userId}` }
);
```

### Step 4: Handle Errors

```typescript
try {
  const worlds = await RequestManager.fetch(key, fetcher);
  setWorlds(worlds);
} catch (error) {
  logger.category('api').error('Failed to fetch worlds:', error);
  // Sentry has already been notified
  showErrorToast('Failed to load worlds');
}
```

## Best Practices

### ✅ DO:

- **Use unique keys** - Include all parameters that affect the result
- **Cache results at component level** - Don't rely only on RequestManager dedupe
- **Set reasonable timeouts** - Don't wait forever for flaky endpoints
- **Use rateLimitKey** - Prevent users from hammering buttons
- **Check failOpen results** - Handle null gracefully in offline scenarios
- **Monitor with getStats()** - Debug hanging requests
- **Clear on logout** - Call `clearPending()` when user logs out

### ❌ DON'T:

- **Don't use non-deterministic keys** - Will hurt dedupe effectiveness
- **Don't omit parameters from keys** - Requests with different inputs shouldn't share a key
- **Don't set retries too high** - Exponential backoff can exceed timeout
- **Don't ignore errors from Sentry** - These might indicate real issues
- **Don't rely on RequestManager for security** - Still validate auth on server
- **Don't use same key for different operations** - GET and POST should use different keys

## Configuration

### Rate Limiting

Default: 10 requests/second per key, bursts up to 20

```typescript
// In lib/api/request-manager.ts
const RATE_LIMIT_CONFIG = {
  tokensPerSecond: 10,
  maxTokens: 20,
};

// To change, edit the constants
// More aggressive: 5 tokens/sec, max 10 (stricter rate limiting)
// Less aggressive: 20 tokens/sec, max 40 (allow more requests)
```

### Timeouts

Default: 30 seconds

```typescript
// For fast endpoints
{ timeout: 5000 }

// For slow endpoints
{ timeout: 60000 }

// For fire-and-forget operations
{ timeout: 10000, failOpen: true }
```

## Future Extensions

### Offline Buffering (Planned)

```typescript
// Currently stubbed, will implement:
RequestManager.onOfflineBuffer = async (key, fetcher, error) => {
  // Store request for later retry
  // When back online, automatically retry
};
```

### Offline Detection (Planned)

```typescript
// Currently stubbed, will implement:
RequestManager.onOfflineDetect = async () => {
  // Check if user is online
  // If offline, skip request and return cached data
  return isOnline;
};
```

## Debugging

### See What's Pending

```typescript
const stats = RequestManager.getStats();
console.log('Pending:', stats.pendingKeys);
// Output:
// Pending: [
//   'worlds:user:123',
//   'notes:world:456:789',
//   'validate:user:123:create-world'
// ]
```

### See What's Rate Limited

```typescript
const stats = RequestManager.getStats();
console.log('Rate Limited:', stats.rateLimitedKeys);
```

### Monitor Sentry

All request failures are automatically reported to Sentry with the following tags:
- `component: 'request-manager'`
- `requestKey: <the request key>`

Filter in Sentry:
```
component:request-manager AND tag:requestKey:"worlds:user:*"
```

## FAQ

**Q: Does RequestManager cache results between page reloads?**  
A: No, it only deduplicates concurrent requests. Results are lost on page reload. Use another caching layer if you need persistence (localStorage, Supabase RLS cache, etc.).

**Q: Can I use RequestManager for mutations (POST, PUT, DELETE)?**  
A: Not recommended. Mutations should go through `validateUserForWrite()` directly. RequestManager is optimized for idempotent reads.

**Q: What if my request fails all retries?**  
A: The error is reported to Sentry and re-thrown (unless failOpen=true). Your code should handle it in a try-catch.

**Q: How does failOpen interact with retries?**  
A: Even with failOpen=true, all retries are attempted. Only after all retries fail does failOpen kick in and return null instead of throwing.

**Q: Can I change rate limit per request?**  
A: No, rate limiting is global. But you can use different `rateLimitKey` values to group users separately. This is intended - prevents single user from DoSing the app.
