# Custom Analytics Event Exporters - Usage Guide

## Integration Checklist

To add custom analytics exporters to your app:

- [ ] Create `lib/analytics/exporters/` directory structure
- [ ] Define `AnalyticsExporter` interface in `index.ts`
- [ ] Implement `ExporterRegistry` class for managing exporters
- [ ] Create `dispatchEvent()` function with error isolation
- [ ] Implement built-in `SentryExporter` for Sentry integration
- [ ] Register exporters on app initialization (AppKernel phase)
- [ ] Hook into existing analytics calls to dispatch events
- [ ] Configure feature flags in `appsettings.json`
- [ ] Test with multiple exporters simultaneously

## Automatic Behavior

Once integrated, the exporter system works automatically:

1. **Event Creation**: User actions call `Analytics.track()`, `Analytics.withTiming()`, etc.
2. **Event Dispatch**: `dispatchEvent()` called asynchronously for each event
3. **Parallel Export**: All enabled exporters receive the event simultaneously
4. **Error Isolation**: If one exporter fails, others continue successfully
5. **Logging**: Success/failure logged for monitoring
6. **Non-blocking**: Dispatch never blocks the main app thread

## Code Examples

### Basic Event Dispatch

```typescript
import { Analytics } from '@/lib/analytics';

// Events automatically dispatched to all registered exporters
Analytics.track('user_action', { action: 'button_click', button: 'save' });
Analytics.withTiming('api_call', () => apiRequest(), 5000);
```

### Registering a Custom Exporter

```typescript
import { exporterRegistry } from '@/lib/analytics';
import { CustomDashboardExporter } from './custom-dashboard-exporter';

// Register on app init
exporterRegistry.register(new CustomDashboardExporter());
```

### Implementing a Custom Exporter

```typescript
import { AnalyticsExporter, AnalyticsEvent, ExportContext } from '@/lib/analytics';

class CustomDashboardExporter implements AnalyticsExporter {
  name = 'custom-dashboard';
  requiredEvents = ['event', 'performance'];
  
  async export(event: AnalyticsEvent, context?: ExportContext): Promise<void> {
    // Check if offline
    if (context?.offline) {
      // Queue for later
      await queueEventForLater(event);
      return;
    }
    
    // Send to custom dashboard API
    const response = await fetch('/api/analytics', {
      method: 'POST',
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      throw new Error(`Dashboard API error: ${response.status}`);
    }
  }
  
  validate(event: AnalyticsEvent): boolean {
    // Custom validation
    return !!event.id && !!event.type;
  }
  
  isEnabled(): boolean {
    // Check feature flag
    return getAppConfig().analytics?.exporters?.custom?.enabled ?? false;
  }
}
```

### Feature Flag Control

```typescript
// In appsettings.json
{
  "analytics": {
    "exporters": {
      "sentry": { "enabled": true },
      "custom": { "enabled": false } // Disable without code changes
    }
  }
}
```

### Handling Export Errors

```typescript
class ResilientExporter implements AnalyticsExporter {
  name = 'resilient';
  
  async export(event: AnalyticsEvent): Promise<void> {
    try {
      await sendToBackend(event);
    } catch (error) {
      // Log but don't throw - error isolation handles this
      logger.category('analytics').warn(`Export failed: ${error.message}`);
      // Optionally queue for retry
      await queueForRetry(event);
    }
  }
}
```

### Offline-Aware Export

```typescript
class OfflineAwareExporter implements AnalyticsExporter {
  name = 'offline-aware';
  
  async export(event: AnalyticsEvent, context?: ExportContext): Promise<void> {
    if (context?.offline) {
      // Use offline queue pattern (#70)
      await analyticsBufferService.enqueue({
        eventType: 'analytics_event',
        payload: event,
      });
      return;
    }
    
    // Online: send immediately
    await sendToBackend(event);
  }
}
```

## Exporter Patterns

### Simple Exporter

Just forwards events to a backend API:

```typescript
class SimpleExporter implements AnalyticsExporter {
  name = 'simple';
  
  async export(event: AnalyticsEvent): Promise<void> {
    await fetch('/api/track', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }
}
```

### Queueing Exporter

Buffers events when offline using the analytics buffer pattern:

```typescript
class QueueingExporter implements AnalyticsExporter {
  name = 'queueing';
  
  async export(event: AnalyticsEvent, context?: ExportContext): Promise<void> {
    if (context?.offline) {
      await analyticsBufferService.enqueue(event);
      return;
    }
    
    await sendBatch([event]);
  }
}
```

### Filtering Exporter

Only processes specific event types:

```typescript
class ErrorOnlyExporter implements AnalyticsExporter {
  name = 'errors-only';
  requiredEvents = ['error', 'fatal'];
  
  async export(event: AnalyticsEvent): Promise<void> {
    // Only receives error events
    await sendToErrorTracking(event);
  }
}
```

### Transforming Exporter

Modifies events before sending:

```typescript
class TransformingExporter implements AnalyticsExporter {
  name = 'transforming';
  
  async export(event: AnalyticsEvent): Promise<void> {
    // Add custom properties
    const transformed = {
      ...event,
      properties: {
        ...event.properties,
        app_version: getAppVersion(),
        platform: getPlatform(),
      }
    };
    
    await sendToBackend(transformed);
  }
}
```

### Conditional Exporter

Enabled/disabled based on runtime conditions:

```typescript
class ConditionalExporter implements AnalyticsExporter {
  name = 'conditional';
  
  isEnabled(): boolean {
    // Only enabled in production
    return process.env.NODE_ENV === 'production';
  }
  
  async export(event: AnalyticsEvent): Promise<void> {
    await sendToBackend(event);
  }
}
```

## Integration with #70, #179, #208

### #70 (Analytics Buffer)

Custom exporters can use the offline queue pattern:

```typescript
// Exporter queues events when offline
await analyticsBufferService.enqueue({
  eventType: 'analytics_export',
  payload: event,
  maxRetries: 3,
});
```

### #179 (Sentry Queue)

Sentry exporter automatically uses breadcrumb queue for offline persistence. Custom exporters can implement similar patterns.

### #208 (Network Telemetry)

Dispatch performance is tracked automatically. Monitor exporter latency in network telemetry logs.

## Debugging

### Check Registered Exporters

```typescript
import { exporterRegistry } from '@/lib/analytics/exporters';

console.log('Registered exporters:', exporterRegistry.getAll().map(e => e.name));
```

### Monitor Dispatch Logs

```typescript
// Check logger.category('analytics') for dispatch results
// Success: "Exporter sentry succeeded"
// Failure: "Exporter custom failed: Network error"
```

### Test Multiple Exporters

```typescript
// Register test exporters
registerExporter(new SentryExporter());
registerExporter(new CustomExporter());

// Emit test event
Analytics.track('test_event', { test: true });

// Check both exporters received the event
```

### Verify Feature Flags

```typescript
// Check config
console.log('Sentry enabled:', getAppConfig().analytics?.exporters?.sentry?.enabled);

// Toggle and test
updateConfig({ analytics: { exporters: { sentry: { enabled: false } } } });
Analytics.track('test'); // Should not reach Sentry
```

### Inspect Event Payloads

```typescript
// Add logging to custom exporter
async export(event: AnalyticsEvent): Promise<void> {
  console.log('Received event:', JSON.stringify(event, null, 2));
  await sendToBackend(event);
}
```

## Troubleshooting

### Event Not Exported

**Check exporter enabled:**
```typescript
console.log(exporterRegistry.getAll().filter(e => e.isEnabled?.() ?? true));
```

**Check event type filtering:**
```typescript
const exporter = exporterRegistry.get('custom');
console.log('Required events:', exporter.requiredEvents);
console.log('Event type matches:', exporter.requiredEvents?.includes(event.type));
```

**Check validation:**
```typescript
const isValid = exporter.validate?.(event) ?? true;
console.log('Event valid:', isValid);
```

### Exporter Errors Blocking Dispatch

**Verify error isolation:**
- Errors should be logged but not thrown
- Other exporters should continue
- Check `Promise.allSettled()` usage in `dispatchEvent()`

### Feature Flag Not Working

**Check config structure:**
```json
{
  "analytics": {
    "exporters": {
      "name": { "enabled": true }
    }
  }
}
```

**Check flag evaluation:**
```typescript
console.log('Flag value:', getAppConfig().analytics?.exporters?.name?.enabled);
```

### Performance Issues

**Check dispatch async:**
- `dispatchEvent()` should return immediately
- Exporters should not block each other

**Check exporter latency:**
- Monitor via #208 network telemetry
- Implement timeouts in exporters

### Custom Exporter Not Registered

**Verify registration timing:**
- Register during app initialization (AppKernel)
- Not during component mount (may miss events)

**Check for duplicates:**
```typescript
console.log('Registration count:', exporterRegistry.getAll().length);
```