# USAGE_GUIDE.md

## When to Use the Breadcrumb Queue

The breadcrumb queue is designed for:

- **Any app using a crash reporting or analytics provider** (Sentry, DataDog, etc.)
- **Apps in areas with unreliable connectivity** (mobile networks, rural areas)
- **Apps wanting automatic offline resilience** without manual batching logic

## Automatic Behavior (Transparent to User)

The breadcrumb queue operates automatically with no user intervention required:

- **Breadcrumbs enqueued when offline**, flushed when online
- **No manual flush needed** (automatic on network reconnect)
- **Deduplication prevents duplicates** across reconnects
- **Rate limits respected**: Queue backs off on 429 responses

### Flow Example

1. User creates breadcrumb (via `Sentry.addBreadcrumb()`)
2. **If offline**: Breadcrumb queued to SecureStorage
3. **If online**: Breadcrumb sent to provider immediately
4. **On online transition**: Queue auto-flushes (batched, 10 per request)
5. **Success**: Breadcrumbs removed from queue, appear in provider dashboard
6. **Failure**: Retry with exponential backoff; rate-limits respected

## Integration with Custom Provider

### Implementing a Custom Provider

1. **Implement BreadcrumbProvider interface** (2 methods):
   ```typescript
   interface BreadcrumbProvider {
     sendBatch(breadcrumbs: QueuedBreadcrumb[]): Promise<BreadcrumbSendResult>;
     parseHttpResponse(response: any): BreadcrumbSendResult;
   }
   ```

2. **Create provider folder**: `lib/analytics/custom-provider/` (mirror Sentry folder structure)

3. **Set in config**: `analytics.breadcrumbs.provider = "custom"`

4. **Factory resolves**: `getAdapter("custom")` returns your adapter

### Example: Minimal Custom Adapter

```typescript
class CustomAdapter implements BreadcrumbProvider {
  async sendBatch(breadcrumbs: QueuedBreadcrumb[]): Promise<BreadcrumbSendResult> {
    // Convert to your provider's format and send
    const response = await fetch('https://your-provider.com/batch', {
      method: 'POST',
      body: JSON.stringify(breadcrumbs)
    });
    return this.parseHttpResponse(response);
  }

  parseHttpResponse(response: Response): BreadcrumbSendResult {
    if (response.ok) {
      return { sent: breadcrumbs.map(b => b.id), retry: [], discard: [] };
    }
    // Handle errors...
  }
}
```

**Benefits**: Multi-provider support, easy to swap or remove entire provider folder.

## Debugging

### Hook: useBreadcrumbQueueStatus()

```typescript
const { queueSize, isFlushing, lastFlushTime, providerName } = useBreadcrumbQueueStatus();
```

### Queue Stats

```typescript
const stats = breadcrumbQueue.getStats();
// Returns: size, oldest, overflow count, providerName
```

### Enable Logging

```json
{
  "featureFlags": {
    "loggerCategories": {
      "analytics": true
    }
  }
}
```

### Inspect Storage

- **Key**: `dnd:sentry:breadcrumb_queue` in SecureStorage
- **View**: Use SecureStorage debug tools or manual inspection

## Consent and Privacy

- **Respects analytics consent** (#181): Disable queue when user opts out
- **Queue cleared on consent revocation**
- **No PII in breadcrumbs** (provider adapter responsible for redaction)
- **User can manually clear**: `breadcrumbQueue.clear()`

## Troubleshooting

### Queue Full (>500)

- **Symptom**: Oldest breadcrumbs dropped, overflow counter logged
- **Check**: `breadcrumbQueue.getStats().overflowCount`
- **Solution**: Increase `maxBreadcrumbs` in config or reduce breadcrumb frequency

### Stuck in Retry

- **Symptom**: Log shows 429 rate limit
- **Check**: Wait X seconds (from `Retry-After` header) or restart app
- **Debug**: Enable analytics logging to see retry attempts

### Network Flaps

- **Symptom**: Excessive retries
- **Protection**: Debounced to once per 5s, prevents repeated flush attempts
- **Config**: Adjust `debounceMs` if needed

### Stale Breadcrumbs

- **Symptom**: Breadcrumbs not sending
- **Auto-cleanup**: Discarded if >14 days old
- **Config**: Adjust `breadcrumbRetentionDays`

### Corrupted Queue

- **Symptom**: Breadcrumbs disappearing
- **Auto-recovery**: Purged on startup; inspect logs for details
- **Check**: `logger.category('analytics')` for discard reasons

### Duplicates in Provider

- **Symptom**: Same breadcrumb appears multiple times
- **Check**: Fingerprint dedup logic, possible hash collision
- **Debug**: Enable logging to see dedup decisions

## Best Practices

### Breadcrumb Creation

- **Add selectively**: Focus on high-value events (category: 'http', 'ui', 'navigation')
- **Consistent format**: Use standard message format for dashboard grouping
- **Include context**: `userId`, `screen`, `action` in data object
- **Avoid PII**: No passwords, tokens, emails, personal identifiers

### Testing

- **Offline/online transitions**: Turn airplane mode on/off
- **Network conditions**: Test on slow/spotty connections
- **Provider responses**: Mock 429, 5xx responses

## Performance Impact

- **<10ms overhead** per breadcrumb enqueue
- **Flush is async** (non-blocking UI)
- **Batch flushing** (10 per request) prevents rate limiting
- **Network flap debouncing** (5s) prevents excessive retries
- **Expected storage**: 50-500 breadcrumbs = <1MB

## Integration Checklist

- [ ] Create `lib/analytics/breadcrumb-queue.ts` and service
- [ ] Initialize queue in AppKernel (`BreadcrumbQueue.initialize()`)
- [ ] Hook provider's breadcrumb method to enqueue when offline
- [ ] Hook NetworkDetection for auto-flush on online
- [ ] Configure queue settings in `appsettings.json`
- [ ] Test offline → online flow
- [ ] Verify breadcrumbs appear in provider dashboard

## Manual Operations (Rare, for Debugging)

- **Force flush**: `breadcrumbQueue.flush()`
- **Clear queue**: `breadcrumbQueue.clear()`
- **Get stats**: `breadcrumbQueue.getStats()`

## Related Features

### Analytics Buffer (#70)

- **Separate queues**: Sentry breadcrumbs vs analytics events
- **Same pattern**: Both use FIFO, SecureStorage, retry backoff
- **Independent flush**: No coordination needed

### Network Telemetry (#208)

- **Queue size as indicator**: High queue size may signal connection problems
- **Correlation analysis**: Provider dashboard can show queue size vs connection quality</content>
<parameter name="filePath">p:/CodingProjects/dnd-toolkit/docs/issues/MileStone 2/Tier 4/179 - Queue Analytics Events/USAGE_GUIDE.md