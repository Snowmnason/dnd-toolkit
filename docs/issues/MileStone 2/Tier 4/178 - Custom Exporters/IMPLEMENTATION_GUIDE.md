# Custom Analytics Event Exporters - Implementation Guide

## Overview

This implementation adds pluggable exporter architecture to the analytics system, enabling multi-backend analytics support. The key additions are:

- **ExporterRegistry**: In-memory registry for managing exporter registration and dispatch
- **AnalyticsExporter interface**: Standardized contract for implementing custom analytics backends
- **Async dispatch with error isolation**: Non-blocking event dispatch to all registered exporters using Promise.allSettled()

The system integrates with existing analytics calls (Analytics.track(), Analytics.withTiming(), etc.) and provides a provider-agnostic way to send events to multiple analytics services simultaneously.

## AnalyticsExporter Interface Breakdown

The `AnalyticsExporter` interface defines the contract for all analytics exporters:

```typescript
interface AnalyticsExporter {
  name: string; // Unique identifier ('sentry', 'mixpanel', 'custom-dashboard')
  version?: string; // Optional version for tracking
  requiredEvents?: string[]; // Event types this exporter must handle
  optionalEvents?: string[]; // Event types this exporter can handle
  export(event: AnalyticsEvent, context?: ExportContext): Promise<void>;
  validate?(event: AnalyticsEvent): boolean;
  isEnabled?(): boolean;
}
```

**Key Methods:**
- `export()`: Core method that sends the event to the backend. Must be async and never throw.
- `validate()`: Optional validation of event schema before export.
- `isEnabled()`: Optional feature flag check to enable/disable the exporter.

**Event Filtering:**
- `requiredEvents`: Whitelist of event types (e.g., ['error', 'fatal']). Only these events are sent.
- `optionalEvents`: Additional events the exporter can handle. Non-blocking if missing.
- If neither is specified, exporter receives all events.

## AnalyticsEvent Type

Standardized event structure passed to all exporters:

```typescript
interface AnalyticsEvent {
  id: string; // UUID for deduplication
  timestamp: number; // ms since epoch
  type: string; // 'error', 'event', 'performance', 'pageview', etc.
  name: string; // Event name ('user_action', 'api_request', etc.)
  category?: string; // Optional grouping ('ui', 'navigation', 'api')
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  userId?: string; // User identifier if available
  sessionId?: string; // Session identifier
  properties?: Record<string, any>; // Custom event data
  error?: { message?: string; code?: string }; // Error details (sanitized)
  performance?: { duration?: number; metric?: string }; // Performance data
}
```

**Event Properties:**
- **id**: Unique identifier, used for deduplication across retries
- **timestamp**: When the event occurred (not when exported)
- **type/name**: Hierarchical classification (type is broad, name is specific)
- **properties**: Flexible object for custom data
- **error/performance**: Specialized sub-objects for specific event types

## ExporterRegistry Class Methods

The `ExporterRegistry` manages exporter lifecycle and dispatch:

```typescript
class ExporterRegistry {
  register(exporter: AnalyticsExporter): void; // Add exporter
  unregister(name: string): void; // Remove by name
  get(name: string): AnalyticsExporter | undefined; // Get specific exporter
  getAll(): AnalyticsExporter[]; // Get all registered exporters
  isRegistered(name: string): boolean; // Check if registered
  clear(): void; // Remove all (for testing)
  dispatchEvent(event: AnalyticsEvent, context?: ExportContext): Promise<void>;
}
```

**Registry Behavior:**
- Prevents duplicate registration (same name overwrites)
- Maintains registration order (dispatch order)
- Filters disabled exporters during dispatch
- Provides synchronous access for debugging

## Built-in Sentry Exporter

The `SentryExporter` implements `AnalyticsExporter` for Sentry integration:

```typescript
class SentryExporter implements AnalyticsExporter {
  name = 'sentry';
  version = '1.0.0';
  requiredEvents = ['error', 'fatal'];
  optionalEvents = ['event', 'performance', 'navigation'];
  
  async export(event: AnalyticsEvent, context?: ExportContext): Promise<void> {
    // Convert to Sentry breadcrumb format
    // Queue offline events via #179
    // Send online events directly
  }
  
  isEnabled(): boolean {
    return config.analytics?.exporters?.sentry?.enabled !== false;
  }
}
```

**Integration with #179:**
- Offline events: Queued to `BreadcrumbQueue` for later sending
- Online events: Converted to Sentry breadcrumbs and sent immediately
- Uses same retry logic (exponential backoff, bounded retries)

**Event Mapping:**
- `type='error'` → Sentry error event
- `type='pageview'` → Sentry navigation breadcrumb
- `type='performance'` → Sentry performance breadcrumb
- `type='event'` → Sentry user-action breadcrumb

## Dispatch Mechanism

The `dispatchEvent()` function handles async, parallel dispatch to all enabled exporters:

```typescript
async function dispatchEvent(event: AnalyticsEvent, context?: ExportContext): Promise<void> {
  const exporters = registry.getAll().filter(exp => exp.isEnabled?.() ?? true);
  
  // Filter by event type
  const eligibleExporters = exporters.filter(exp => 
    !exp.requiredEvents || exp.requiredEvents.includes(event.type)
  );
  
  // Dispatch in parallel with error isolation
  const results = await Promise.allSettled(
    eligibleExporters.map(exp => exp.export(event, context))
  );
  
  // Log results
  results.forEach((result, i) => {
    const exporter = eligibleExporters[i];
    if (result.status === 'rejected') {
      logger.warn('analytics', `Exporter ${exporter.name} failed: ${result.reason}`);
    }
  });
}
```

**Key Features:**
- **Async non-blocking**: Fire-and-forget dispatch
- **Error isolation**: One exporter failure doesn't block others
- **Parallel execution**: All exporters called simultaneously
- **Event filtering**: Only eligible exporters receive events
- **Context passing**: Offline status, platform, app version provided

## Error Handling Strategy

Error isolation ensures robust multi-exporter operation:

- **Per-exporter isolation**: Each `export()` call wrapped in try/catch
- **Promise.allSettled()**: Captures both successes and failures
- **Logging only**: Failures logged but don't throw or block
- **Exporter-specific retry**: Each exporter decides retry policy
  - Sentry: Queues via #179 (exponential backoff)
  - Custom: May discard or implement local retry

**Error Classification:**
- **4xx responses**: Permanent failure, discard event
- **5xx/Network errors**: Transient, retry via exporter's queue
- **Validation failures**: Skip event, log warning
- **Type errors**: Caught and logged, don't crash app

## Feature Flag Integration

Exporters respect feature flags for runtime control:

```json
{
  "analytics": {
    "exporters": {
      "sentry": { "enabled": true },
      "mixpanel": { "enabled": false },
      "custom": { "enabled": true }
    }
  }
}
```

- **Per-exporter flags**: `analytics.exporters[name].enabled`
- **Default enabled**: Sentry enabled by default, others disabled
- **Runtime evaluation**: Checked before each dispatch
- **No code changes**: Enable/disable without redeployment

## Config in appsettings

Full configuration structure:

```json
{
  "analytics": {
    "dispatch": {
      "async": true,
      "debounceMs": 100,
      "queueSize": 100,
      "timeout": 5000
    },
    "exporters": {
      "sentry": { "enabled": true },
      "custom": { "enabled": false }
    }
  }
}
```

**Dispatch Settings:**
- `async`: Always true (non-blocking dispatch)
- `debounceMs`: Debounce multiple rapid dispatches
- `queueSize`: Max queued events (if dispatch queues needed)
- `timeout`: Max time for exporter calls

## Provider Adapter Pattern

The exporter system implements a provider adapter pattern:

- **AnalyticsExporter interface**: Abstract contract for any analytics backend
- **SentryExporter**: One concrete implementation
- **Custom exporters**: Mixpanel, Segment, internal dashboards implement same interface
- **No code changes**: Swap backends by changing exporter registration
- **Future extensibility**: Extract `AnalyticsProvider` interface for broader backend support

## Integration with #70, #179, #208

**#70 (Analytics Buffer):** Custom exporters can use the offline queue pattern for persistence when offline.

**#179 (Sentry Queue):** Sentry exporter automatically integrates with breadcrumb queue for offline persistence and retry logic.

**#208 (Network Telemetry):** Dispatch latency and exporter performance tracked in network telemetry for monitoring.