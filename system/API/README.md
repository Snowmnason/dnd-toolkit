# System API Module

Low-level HTTP transport layer providing resilient, cached, and deduplicated API requests. Handles retries, circuit breakers, offline queuing, rate limiting, and request deduplication. Pure transport layer with no business logic.

## When to Use This Module

**Use this module for:**

- Making HTTP requests with automatic resilience (retries, circuit breaker, offline handling)
- Request deduplication to prevent duplicate API calls
- Caching API responses with TTL and invalidation
- Rate limiting to prevent API abuse
- Request analytics and monitoring

**Don't use this module for:**

- Business logic validation (belongs in lib managers)
- Data transformation (belongs in lib modules)
- Authentication handling (belongs in lib/auth)
- Offline mutation queuing (belongs in lib/offline)

## Architecture & Data Flow

```
Lib Manager → Middleware → System API
                              ↓
RequestManager.fetch() → Interceptors → Cache Check → Deduplication
                              ↓
Rate Limiting → Circuit Breaker → HTTP Request → Retry Logic
                              ↓
Response → Cache Storage → Analytics → Return to Middleware
```

**Key Components:**

- **RequestManager**: Main entry point for HTTP requests with resilience
- **Interceptors**: Request/response middleware for auth, headers, logging
- **Cache**: TTL-based response caching with invalidation
- **Deduplication**: Prevents duplicate concurrent requests
- **Rate Limiting**: Prevents API abuse with configurable limits
- **Circuit Breaker**: Fails fast when API is unhealthy
- **Offline Queue**: Queues requests when network unavailable
- **Retry Logic**: Exponential backoff for transient failures
- **Analytics**: Request metrics and error tracking

## API Reference

### Core Request Method

#### `RequestManager.fetch<T>(key: string, fetcher: () => Promise<T>, options?: RequestOptions): Promise<T>`

Execute HTTP request with full resilience stack.

```typescript
import { RequestManager } from '@/system/API';

const data = await RequestManager.fetch(
  'get-user-profile',
  () => apiClient.get('/user/profile'),
  {
    cache: { ttl: 5 * 60 * 1000 }, // 5 minutes
    retry: { maxAttempts: 3 },
    deduplication: true
  }
);
```

### Request Options

```typescript
interface RequestOptions {
  cache?: {
    ttl: number;           // Time to live in milliseconds
    tags?: string[];       // Cache invalidation tags
  };
  retry?: {
    maxAttempts: number;   // Max retry attempts
    baseDelay: number;     // Base delay for exponential backoff
  };
  deduplication?: boolean; // Enable request deduplication
  rateLimit?: {
    requests: number;      // Requests per window
    windowMs: number;      // Time window in milliseconds
  };
  circuitBreaker?: boolean; // Enable circuit breaker protection
  offlineQueue?: boolean;  // Queue when offline
}
```

### Cache Management

#### `RequestManager.invalidateCache(pattern: string): Promise<void>`

Invalidate cache entries matching pattern.

```typescript
// Invalidate all user-related cache
await RequestManager.invalidateCache('user:*');

// Invalidate specific entry
await RequestManager.invalidateCache('user:profile:123');
```

#### `RequestManager.clearCache(): Promise<void>`

Clear all cached responses.

```typescript
await RequestManager.clearCache();
```

### Circuit Breaker

#### `CircuitBreakerManager.getState(endpoint: string): CircuitBreakerState`

Get circuit breaker state for endpoint.

```typescript
const state = CircuitBreakerManager.getState('/api/user');
if (state === 'OPEN') {
  // API is unhealthy, requests will fail fast
}
```

## Dependencies

### External

- **None** – Pure transport layer

### Internal

- **`system/Storage`** – Cache persistence
- **`system/Network`** – Network status detection
- **`lib/analytics`** – Request metrics
- **`lib/utils/logger`** – Request logging

## Error Handling & Edge Cases

### Network Failures

Requests retry with exponential backoff; queue when offline.

### Circuit Breaker Open

Requests fail fast with specific error type.

### Rate Limit Exceeded

Requests delayed or rejected based on configuration.

### Cache Corruption

Invalid cached responses ignored; fresh request made.

### Concurrent Requests

Deduplication prevents duplicate API calls.

## Performance Notes

- **Caching**: Reduces API calls by serving cached responses
- **Deduplication**: Prevents redundant requests for same data
- **Circuit Breaker**: Fails fast during outages
- **Rate Limiting**: Prevents API throttling
- **Minimal Overhead**: <5ms for cached requests

## Related Modules

- **`lib/middleware/api`** – Calls RequestManager with validated requests
- **`system/Storage`** – Persists cached responses
- **`system/Network`** – Provides network status for offline handling
- **`lib/analytics`** – Tracks request success/failure metrics

## File Breakdown

| File | Purpose |
| --- | --- |
| `request-manager.ts` | Main RequestManager class with fetch method |
| `interceptor.ts` | Request/response interceptor system |
| `request-cache.ts` | TTL-based response caching |
| `request-deduplication.ts` | Prevents duplicate concurrent requests |
| `request-rate-limiting.ts` | API rate limiting |
| `request-retry.ts` | Exponential backoff retry logic |
| `request-offline-queue.ts` | Queues requests when offline |
| `request-analytics.ts` | Request metrics and monitoring |
| `resilience/circuit-breaker.ts` | Circuit breaker implementation |
| `index.ts` | Barrel export of public API |