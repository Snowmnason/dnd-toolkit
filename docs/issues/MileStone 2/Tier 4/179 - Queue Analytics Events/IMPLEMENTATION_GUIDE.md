# IMPLEMENTATION_GUIDE.md

## Overview

This guide documents the implementation of the breadcrumb queue feature for offline analytics event queuing and automatic flush on reconnect. The implementation uses a provider-agnostic architecture that supports multiple analytics backends.

### Key Architecture Decisions

- **3-file architecture with isolated Sentry folder**: `breadcrumb-queue.ts` (generic), `provider-adapter.ts` (generic interface), `sentry/sentry-adapter.ts` (Sentry-specific)
- **Storage key**: `dnd:sentry:breadcrumb_queue` (uses STORAGE_KEYS constant)
- **Queue size limit**: 500 breadcrumbs (configurable)
- **Provider-agnostic core**: Enables supporting multiple analytics backends without code changes

## Generic Architecture

### Provider Adapter Pattern

- **`BreadcrumbProvider` interface**: `sendBatch()`, `parseHttpResponse()` (any provider implements this)
- **`BreadcrumbSendResult`**: `sent[]`, `retry[]`, `discard[]` arrays with decisions
- **Factory**: `getAdapter(providerName)` returns initialized adapter
- **Benefits**: No SDK lock-in, testable, extensible

### QueuedBreadcrumb Structure (Generic)

- `id`, `timestamp`, `category`, `level`, `message`, `data`, `fingerprint` (client-computed hash)
- `retryCount`, `maxRetries`, `nextAttemptAt`, `metadata` (offlineAt, platform)
- **Provider-agnostic**: No Sentry-specific fields
- **Persisted via SecureStorage**

### BreadcrumbQueue Service Methods (Generic)

- `initialize(provider: BreadcrumbProvider)` — Load from SecureStorage + set provider
- `enqueue(breadcrumb)` — Add to queue + persist
- `peek(batchSize)` — Get next batch for flush (FIFO)
- `remove(ids)` — Remove after successful sync
- `markFailed(id, reason)` — Increment retry count + reschedule
- `discard(id, reason)` — Remove permanently + log
- `size()` — Current queue size
- `getStats()` — Queue metrics (size, oldest, overflow count, providerName)

### NetworkDetection Integration (Generic)

- Subscribe to online transition (`false → true`)
- Trigger `breadcrumbQueue.flush()` automatically
- **Batch breadcrumbs**: 10 per request via `adapter.sendBatch()` (any provider)
- **Debounced**: Once per 5s to avoid network flaps

### Retry Logic (Generic, Provider-Independent)

- **Formula**: `2^min(retryCount, 4) * baseMs` (1s, 2s, 4s, 8s, 16s)
- **Max retries**: 5 (then discard)
- **5xx/network errors**: Queue marks as failed + reschedules
- **429 rate-limit**: Respects `Retry-After` header or uses backoff (provider adapter parses header)
- **4xx permanent**: Provider/adapter classifies as discard action

### Deduplication via Fingerprint (Generic)

- **Client-side hash**: SHA1(category + message + level)
- **Persisted cache**: Tracks sent fingerprints (24h TTL)
- **Skip if already sent** within 24h window
- **Survives app restart** via SecureStorage

### Validation on Load (Generic)

- Remove corrupted breadcrumbs (missing required fields)
- Discard breadcrumbs older than 14 days
- Trim to 500 if overflow detected on startup
- Log warnings for discarded entries

### Logging (Generic)

- Use `logger.category('analytics')`
- Log: provider initialization, enqueue (with counts), flush (successes/retries/discards), rate limits
- Include: batch size, retry attempt, provider name (works with any provider)

## Sentry-Specific Implementation

### SentryAdapter Implementation

Located in isolated `lib/analytics/sentry/sentry-adapter.ts`:

- **Implements BreadcrumbProvider interface**
- **Converts QueuedBreadcrumb[] → Sentry envelope format** (Sentry-specific)
- **Hooks Sentry.addBreadcrumb()** to intercept → enqueue if offline, send if online
- **Parses Sentry response headers**: `Retry-After`, `X-RateLimit-Remaining` (Sentry-specific)
- **Classifies HTTP responses**: 2xx=success, 429=rate-limited, 4xx=discard, 5xx=retry, timeout=retry (Sentry logic)
- **Folder isolation benefit**: Delete `lib/analytics/sentry/` folder → remove Sentry; create `lib/analytics/datadog/` → add new provider

## Configuration

Provider-agnostic fields that work with any provider:

```json
{
  "analytics": {
    "breadcrumbs": {
      "enabled": true,
      "provider": "sentry",  // Swappable: "sentry" | "datadog" | "custom"
      "maxBreadcrumbs": 500,
      "batchSize": 10,
      "maxRetries": 5,
      "retryBaseMs": 1000,
      "debounceMs": 5000,
      "breadcrumbRetentionDays": 14
    }
  }
}
```

## File Structure

```
lib/analytics/
├── breadcrumb-queue.ts          # Generic queue logic
├── provider-adapter.ts          # Provider interface and factory
├── sentry/                      # Isolated Sentry implementation
│   └── sentry-adapter.ts        # Sentry-specific adapter
└── README.md                    # Updated with breadcrumb queue docs
```

## Integration Points

- **AppKernel**: Initialize queue with provider adapter
- **NetworkDetection**: Subscribe for auto-flush on online transitions
- **SecureStorage**: Persist queue under `dnd:sentry:breadcrumb_queue` key
- **Logger**: Analytics category for queue operations
- **Config**: `appsettings.json` for queue settings

## Benefits

- **Provider-agnostic**: Easy to swap or remove analytics backends
- **Offline resilience**: Automatic queuing and flushing
- **Performance**: Batched requests, deduplication, debounced flushes
- **Reliability**: Exponential backoff, rate limit handling, corruption recovery
- **Testable**: Mock adapters for unit testing
- **Observable**: Stats and hooks for monitoring</content>
<parameter name="filePath">p:/CodingProjects/dnd-toolkit/docs/issues/MileStone 2/Tier 4/179 - Queue Analytics Events/USAGE_GUIDE.md