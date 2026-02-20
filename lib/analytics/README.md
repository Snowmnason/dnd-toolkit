# Analytics Module

Consent-aware analytics and performance monitoring. Handles event tracking, user identification, screen/session measurement, and offline event queuing with automatic retry.

## When to Use This Module

**Use this module if you need to:**

- Track user events and engagement metrics with consent awareness
- Monitor application performance and identify slow operations
- Measure screen load times and custom operation durations
- Track performance baselines and detect regressions over time
- Manage user sessions, screen views, and error counts
- Queue events when offline and flush them automatically when reconnected
- Track A/B test variant assignments and engagement
- **Manage user consent levels for GDPR compliance** (persist across app restarts, sync to database)

**Do NOT use this module for:**

- Real-time analytics dashboards (events go to Sentry breadcrumbs only; use an external service for dashboards)
- Cross-device analytics sync (single-device only; use [lib/database](../database/README.md) for server-side persistence)
- General debug/telemetry logging (use [lib/utils's Logger](../utils/README.md) instead)

## Architecture & Data Flow

```
User Action / Runtime Event
        ↓
    Check Consent Level (AnalyticsConsent)
        ↓
    Sanitize Data (strip message, stack, raw error fields)
        ↓
    Is Network Online? (works with lib/network)
        ├─ YES ─→ Send to Sentry breadcrumb (if sentryEnabled flag is set)
        └─ NO  ─→ Queue to AnalyticsBuffer (encrypted via lib/storage)
                        ↓
                  [Online transition detected]
                        ↓
                  [Flush in batches with exponential backoff retry]
        ↓
    Log to Logger (analytics / performance category)
```

**Key Principles:**

- **Privacy-first**: Defaults to `'basic'` consent (GDPR compliant); no usage or performance events sent without opt-in
- **Offline-aware**: Events persist to encrypted storage and flush automatically when reconnected (works with lib/network)
- **Resilient retries**: Failed sends retry with exponential backoff (1s → 2s → 4s → 8s → 16s, capped at 16s)
- **Sanitization**: Strips `message`, `stack`, and raw error strings before sending; only `error_name` and `error_code` are kept
- **Graceful degradation**: If Sentry is disabled or the `sentryEnabled` flag is off, all calls are silent no-ops

## API Reference

### `Analytics` Object

Main entry point. Imported from `@/lib/analytics`.

#### `Analytics.enabled(): boolean`

Returns `true` if Sentry is configured and the `sentryEnabled` feature flag is set. All other methods silently no-op when this is `false`.

#### `Analytics.identify(user: { id?: string; username?: string } | null): void`

Associates subsequent Sentry events with a user. Pass `null` to clear (call on logout).

```ts
Analytics.identify({ id: "user-123", username: "john_doe" });
Analytics.identify(null); // on logout
```

#### `Analytics.track(event: string, props?: Record<string, any>): void`

Sends a Sentry breadcrumb. Consent is checked automatically:
- `'screen_view'` and `'component_usage'` require `'usage'` consent
- Events starting with `'performance'` or named `'api_request'` require `'performance'` consent

```ts
Analytics.track("user_action", { action_type: "button_click", button_id: "save" });
```

#### `Analytics.trackComponentUsage(params): void`

Shorthand for `track("component_usage", ...)`. Requires `'usage'` consent.

```ts
Analytics.trackComponentUsage({ component: "LoginForm", action: "submit", detail: { method: "email" } });
```

#### `Analytics.withTiming<T>(label, fn, warnMs?): Promise<T> | T`

Wraps a function, measures its duration, and logs a warning if it exceeds the threshold. Sends a performance breadcrumb to Sentry if `'performance'` consent is given.

```ts
await Analytics.withTiming("database_query", () => queryDatabase(), 5000);
```

#### `Analytics.getThreshold(key: 'slowScreenMs' | 'slowRequestMs'): number`

Reads the configured threshold from `appsettings.json`. Falls back to `3000ms` if config is unavailable.

---

### `Performance` Object

Manual start/stop measurements for custom timing scenarios.

#### `Performance.startMeasure(label: string): void`

Starts a named measurement. Warns and overwrites if the same label is already active.

#### `Performance.endMeasure(label: string, warnMs?: number): void`

Ends the measurement and calls `Analytics.track("performance_measure", ...)` with the duration. Logs a warning if the duration exceeds the threshold.

```ts
Performance.startMeasure("data_loading");
// ... work ...
Performance.endMeasure("data_loading", 2000);
```

#### `Performance.useScreenDuration(screenName: string): void`

React hook. Calls `startMeasure` on mount and `endMeasure` on unmount automatically.

```ts
export function MyScreen() {
  Performance.useScreenDuration("MyScreen");
  return <View>...</View>;
}
```

#### `Performance.cleanupOldMarks(): void`

Internal. Removes marks older than 5 minutes to prevent memory leaks from abandoned measurements. Called automatically inside `startMeasure`.

---

### `sessionManager` Object

Tracks session lifetime, screen views, and error counts. Sends `session_started` and `session_ended` events.

| Method | Description |
| ------ | ----------- |
| `startSession(userId?)` | Starts a session. Ends any active session first. |
| `endSession()` | Ends the session and tracks duration, screen views, and error count. |
| `trackScreenView(screenName)` | Increments screen view counter and updates last activity time. |
| `trackError()` | Increments error counter and updates last activity time. |
| `getCurrentDuration(): number` | Returns current session duration in milliseconds. |
| `isSessionActive(): boolean` | Returns `false` if no session or last activity was >30 minutes ago. |

---

### `AnalyticsConsent` Object

**GDPR-compliant consent management with persistent storage and database sync.**

Manages user consent levels for analytics tracking. Persists consent across app restarts using SecureStorage and optionally syncs to database for cross-device agreement. Defaults to `'basic'` level (GDPR safe) on first launch.

#### Consent Level Semantics

| Level | What is tracked | GDPR Compliance |
| ----- | --------------- | --------------- |
| `'none'` | Nothing (analytics disabled) | ✅ Fully compliant |
| `'basic'` | Essential events only (errors, auth, session) | ✅ GDPR safe minimum |
| `'full'` | All events including usage and performance | ⚠️ Requires explicit opt-in |

#### Architecture: Persistence → Restore → Event Emission Flow

```
App Bootstrap (AppKernel.initialize)
        ↓
AnalyticsConsent.initialize()  ← Read priority: fresh SecureStorage → DB → stale SecureStorage → default 'basic'
        ↓
[Consent restored from storage/database]
        ↓
User Action / Runtime Event
        ↓
AnalyticsConsent.isAllowed(category)  ← Check consent before emission
        ↓
[Event allowed] → Emit to Sentry/analytics
[Event blocked] → Silent no-op
        ↓
User changes consent (via UI hook)
        ↓
AnalyticsConsent.setLevel()  ← Persist to SecureStorage + queue DB sync
```

**Key Principles:**

- **Privacy-first**: Defaults to `'basic'` (essential tracking only) for GDPR compliance
- **Persistent**: Survives app restarts via SecureStorage encryption (AES-256-CTR)
- **Cross-device sync**: Database-backed for profile consistency (optional)
- **Non-blocking**: Storage operations are async; app continues with defaults on failure
- **Feature-gated**: `'persist-analytics-consent'` flag controls persistence behavior

#### API Reference

##### `AnalyticsConsent.initialize(options?): Promise<ConsentLevel>`

Initializes consent from storage. **Call during app bootstrap (AppKernel does this automatically).**

Read priority: fresh SecureStorage cache → database (if authenticated) → stale SecureStorage cache → default `'basic'`.

```ts
// Called automatically by AppKernel - manual calls usually unnecessary
const level = await AnalyticsConsent.initialize({
  maxAgeMs: 4 * 60 * 60 * 1000,  // 4 hours cache freshness
  forceRefresh: false,            // Skip cache, force DB fetch
});
```

##### `AnalyticsConsent.setLevel(level: ConsentLevel): Promise<void>`

Updates consent level and persists to SecureStorage. Queues database sync for cross-device agreement.

Non-blocking: persists locally immediately, syncs to database asynchronously.

```ts
await AnalyticsConsent.setLevel('full');  // Enables all tracking
await AnalyticsConsent.setLevel('basic'); // GDPR-safe minimum
await AnalyticsConsent.setLevel('none');  // Disables all tracking
```

##### `AnalyticsConsent.getLevel(): ConsentLevel`

Returns current in-memory consent level.

```ts
const level = AnalyticsConsent.getLevel(); // 'basic' | 'full' | 'none'
```

##### `AnalyticsConsent.isAllowed(category: 'essential' | 'performance' | 'usage'): boolean`

Checks if a tracking category is allowed based on current consent level.

```ts
if (AnalyticsConsent.isAllowed('performance')) {
  // Send performance events
}
if (AnalyticsConsent.isAllowed('usage')) {
  // Send usage analytics
}
// 'essential' always allowed (errors, auth, session)
```

##### `AnalyticsConsent.getStoredConsent(): Promise<ConsentLevel>`

Reads consent directly from SecureStorage (bypasses in-memory state).

```ts
const stored = await AnalyticsConsent.getStoredConsent(); // For diagnostics
```

#### Integration Points

- **#70 (Analytics Buffer)**: Respects consent when queueing events; clears buffer on consent downgrade
- **#178 (Custom Exporters)**: Events gated by consent before export
- **AppKernel Bootstrap**: `AnalyticsConsent.initialize()` called early in startup sequence
- **Settings UI**: Toggle switch in `Screens/settings/AppSettings.tsx` via `useAnalyticsConsent()` hook
- **Database Sync**: Consent changes queued via `ConsentSyncQueue` for cross-device agreement

#### GDPR/Compliance Context

- **Default 'basic'**: Ensures GDPR compliance out-of-the-box without user action
- **Explicit opt-in**: Users must actively choose 'full' tracking
- **Consent withdrawal**: Downgrading consent clears existing analytics buffer
- **Audit trail**: Consent changes logged via `logger.category('analytics')`
- **Data minimization**: Only essential data sent at 'basic' level
- **Platform notes**:
  - **Web**: Uses localStorage via SecureStorage (encrypted)
  - **iOS**: Uses Keychain via Expo SecureStore
  - **Android**: Uses SharedPreferences via Expo SecureStore
  - **Desktop**: Uses OS-specific secure storage

#### Future Enhancements

- **Granular consent levels**: Per-category toggles (performance, usage, marketing)
- **Audit history UI**: Show consent change timeline
- **Server-side sync**: Conflict resolution for cross-device consent changes
- **Consent expiration**: Time-based consent refresh requirements

---

### `ConsentSyncQueue` Object

**Asynchronous database sync for consent changes.**

Queues consent level updates for syncing to the database when online. Handles offline scenarios with automatic retry on network recovery. Fire-and-forget design ensures consent changes are non-blocking.

#### Features

- **Persistent queue**: Survives app restarts via SecureStorage
- **Network-aware**: Automatically processes on network recovery
- **Exponential backoff**: Retries failed syncs (2s → 4s → 8s → 16s → 30s max)
- **Fire-and-forget**: Non-blocking, doesn't wait for database confirmation

#### API Reference

##### `ConsentSyncQueue.initialize(): Promise<void>`

Initializes queue from storage and sets up automatic processing. **Called automatically by AppKernel during auth phase bootstrap.**

Loads any persisted sync items from SecureStorage and schedules retry timeouts for items ready to process. Also registers a network listener that automatically processes the queue when the device comes back online.

```ts
// Called automatically by AppKernel - manual calls usually unnecessary
await ConsentSyncQueue.initialize();
```

##### `ConsentSyncQueue.enqueue(level: ConsentLevel): Promise<string>`

Queues a consent change for database sync. Returns queue ID for tracking.

```ts
const syncId = await ConsentSyncQueue.enqueue('full');
// Consent change queued for database sync
```

##### `ConsentSyncQueue.processQueue(): Promise<void>`

Manually processes pending syncs. Called automatically on network recovery.

```ts
await ConsentSyncQueue.processQueue(); // Process all pending syncs
```

##### `ConsentSyncQueue.size(): number`

Returns current queue size (for diagnostics).

```ts
const pending = ConsentSyncQueue.size(); // Number of pending syncs
```

##### `ConsentSyncQueue.getAll(): PendingConsentSync[]`

Returns all pending syncs (for debugging).

```ts
const pending = ConsentSyncQueue.getAll(); // Array of pending items
```

##### `ConsentSyncQueue.clear(): Promise<void>`

Clears the queue (use with caution, for testing/recovery).

```ts
await ConsentSyncQueue.clear(); // Clear all pending syncs
```

#### Integration Points

- **AnalyticsConsent.setLevel()**: Automatically queues database sync on consent changes
- **Network recovery**: Queue processes automatically when connection restored (via NetworkDetection subscription)
- **AppKernel Bootstrap**: `ConsentSyncQueue.initialize()` called during auth phase, loads persisted items and sets up network listener for automatic processing

---

### Analytics Buffer (Offline Queue)

Persists events to encrypted storage (works with lib/storage) when offline and flushes on reconnect (works with lib/network). Controlled by the `analytics.buffer` config block.

#### `analyticsBufferService.enqueue(event): Promise<QueuedAnalyticsEvent | null>`

Adds an event to the offline queue. `id`, `timestamp`, and `retryCount` are generated automatically.

```ts
await analyticsBufferService.enqueue({
  eventType: "screen_view",
  payload: { screen: "HomeScreen" },
  maxRetries: 5,
});
```

#### `analyticsBufferService.getStats(): AnalyticsBufferStats`

Returns `queueSize`, `maxSize`, `oldestEventAge` (ms), and a breakdown by event type.

#### `analyticsBufferService.clear(): Promise<void>`

Clears all queued events. Use only for user-initiated data deletion.

#### `calculateExponentialBackoff(retryCount, baseMs?): number`

Returns the delay in ms for a given retry attempt. Base defaults to 1000ms; caps at 16000ms (retry 4+).

**Buffer config** (in `config/appsettings.json`):

```json
{
  "analytics": {
    "buffer": {
      "enabled": true,
      "maxSize": 100,
      "maxRetries": 5,
      "batchSize": 25,
      "retryBaseMs": 1000,
      "debounceMs": 5000
    }
  }
}
```

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `enabled` | `true` | Turns the offline buffer on/off |
| `maxSize` | `100` | Max queued events; oldest dropped when exceeded (FIFO) |
| `maxRetries` | `5` | Attempts before an event is discarded |
| `batchSize` | `25` | Events per flush request |
| `retryBaseMs` | `1000` | Base for exponential backoff |
| `debounceMs` | `5000` | Debounce delay on network-online transitions |

---

### Breadcrumb Queue (Offline Queue)

Queues Sentry breadcrumbs when offline and flushes them automatically on reconnect. Provider-agnostic design allows swapping analytics backends.

#### `BreadcrumbQueue.initialize(provider)` — Initialize with provider adapter

Sets up the queue with a provider adapter (e.g., SentryAdapter). Loads persisted breadcrumbs from SecureStorage.

#### `enqueue(breadcrumb)` — Queue a breadcrumb (with dedup via fingerprint)

Adds a breadcrumb to the queue. Deduplicates based on fingerprint hash to prevent duplicates.

#### `getStats()` — Get queue statistics (count, pending, lastFlush, etc.)

Returns queue metrics like size, oldest breadcrumb age, provider name.

#### `flush()` — Manual flush (async)

Triggers a manual flush of queued breadcrumbs via the provider.

#### `BreadcrumbProvider` interface — contract for implementing adapters

Interface for provider adapters: `sendBatch(breadcrumbs)`, `parseHttpResponse(response)`.

#### `useBreadcrumbQueueStatus()` — Debug hook

Returns `{ queueSize, isFlushing, lastFlushTime, oldestBreadcrumbTime, providerName }`.

**Queue config** (in `config/appsettings.json`):

```json
{
  "analytics": {
    "breadcrumbs": {
      "enabled": true,
      "maxBreadcrumbs": 500,
      "batchSize": 10,
      "maxRetries": 5,
      "retryBaseMs": 1000,
      "debounceMs": 5000
    }
  }
}
```

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `enabled` | `true` | Turns the breadcrumb queue on/off |
| `maxBreadcrumbs` | `500` | Max queued breadcrumbs; oldest dropped when exceeded (FIFO) |
| `batchSize` | `10` | Breadcrumbs per flush request |
| `maxRetries` | `5` | Attempts before a breadcrumb is discarded |
| `retryBaseMs` | `1000` | Base for exponential backoff |
| `debounceMs` | `5000` | Debounce delay on network-online transitions |

---

### Analytics Exporters (Pluggable Backends)

Pluggable exporter architecture for multi-backend analytics support. Decouples event dispatch from specific analytics services.

#### `AnalyticsExporter` Interface

Contract for implementing custom analytics exporters:

```typescript
interface AnalyticsExporter {
  name: string; // Unique identifier
  version?: string;
  requiredEvents?: string[]; // Event types this exporter must handle
  optionalEvents?: string[]; // Event types this exporter can handle
  export(event: AnalyticsEvent, context?: ExportContext): Promise<void>;
  validate?(event: AnalyticsEvent): boolean;
  isEnabled?(): boolean;
}
```

#### `AnalyticsEvent` Type

Standardized event structure for all exporters:

```typescript
interface AnalyticsEvent {
  id: string; // UUID
  timestamp: number; // ms since epoch
  type: string; // 'pageview', 'event', 'error', 'performance', 'custom'
  name: string; // Event name ('user_signup', 'api_error', etc.)
  category?: string; // 'navigation', 'commerce', 'social', 'custom'
  level?: 'debug' | 'info' | 'warning' | 'error' | 'fatal'; // Severity
  userId?: string; // Who did this
  sessionId?: string; // Session context
  properties: Record<string, unknown>; // Event-specific data
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    duration: number; // ms
    metric?: string; // FCP, LCP, INP, etc.
  };
}
```

#### `ExporterRegistry` Class

Manages exporter registration:

- `register(exporter: AnalyticsExporter)` — Add exporter
- `unregister(name: string)` — Remove by name
- `get(name: string)` — Get exporter by name
- `getAll()` — Get all registered exporters
- `isRegistered(name: string)` — Check if registered

#### `dispatchEvent(event: AnalyticsEvent, context?: ExportContext)` — Standalone Function

Dispatches events to all enabled exporters asynchronously with error isolation.

#### Built-in Sentry Exporter

`SentryExporter` implements `AnalyticsExporter` for Sentry integration:

- Maps events to Sentry breadcrumbs/errors
- Integrates with Breadcrumb Queue for offline persistence
- Feature flag controlled (`analytics.exporters.sentry.enabled`)

#### Custom Exporter Implementation

To create a custom exporter:

```typescript
import { exporterRegistry } from '@/lib/analytics/exporters';

class CustomExporter implements AnalyticsExporter {
  name = 'custom';
  requiredEvents = ['event'];
  
  async export(event: AnalyticsEvent): Promise<void> {
    // Send to custom backend
  }
  
  isEnabled(): boolean {
    return true; // Or check feature flags
  }
}

// Register it
exporterRegistry.register(new CustomExporter());
```

**Exporter config** (in `config/appsettings.json`):

```json
{
  "analytics": {
    "exporters": {
      "sentry": { "enabled": true },
      "custom": { "enabled": false }
    }
  }
}
```

---

### Utility Functions

#### `categorizeError(error): ErrorCategory`

Classifies an error into `'network'`, `'auth'`, `'validation'`, `'timeout'`, or `'unknown'` by inspecting `message`, `name`, and `code`.

#### `sanitizeError(err): { error_name?, error_code? } | undefined`

Strips everything except `name` and `code` from an error object. Returns `undefined` if neither field is present.

#### `trackFeatureBlocked(params): void`

Tracks when a feature is blocked. Sends a `"feature_blocked"` event with `feature` and `reason`.

```ts
trackFeatureBlocked({ feature: "export_world", reason: "requires_premium" });
```

---

### Variant Tracking

A/B test helpers. Import directly from `@/lib/analytics/variant-tracking` or via the barrel.

#### `trackVariantAssignment(event: VariantAssignmentEvent): void`

Fired when a user is bucketed into a variant. Called automatically by the rollout system.

#### `trackVariantEngagement(event: VariantEngagementEvent): void`

Fired when a user interacts with a variant feature. Provide `flagName`, `variant`, `action`, and `userId`.

#### `trackVariantPerformance(event: VariantPerformanceEvent): void`

Fired to record a numeric performance metric for a specific variant (e.g., `screen_load_ms`).

For component-level usage see the `useVariantTracking()` hook in `hooks/analytics`.

---

### Performance Baseline Service

Tracks historical performance metrics and detects regressions. See `lib/analytics/performance/README.md` for detailed documentation.

#### `performanceBaselineService.initialize(): Promise<void>`

Load baselines from storage and apply config. Call during app bootstrap.

#### `performanceBaselineService.recordSample(label, durationMs, context?): void`

Record a performance measurement. Respects `track-performance-baseline` feature flag.

#### `performanceBaselineService.getBaseline(label): OperationBaseline | null`

Get current baseline percentiles for an operation.

#### `performanceBaselineService.detectRegression(label, durationMs, context?): RegressionDetectionResult`

Check if measurement indicates a regression.

#### `performanceBaselineService.reset(label): Promise<void>`

Clear baseline for an operation.

#### `performanceBaselineService.resetAll(): Promise<void>`

Clear all baselines.

---

## Dependencies

### External Packages

- **`@sentry/react-native`** – Breadcrumb and user tracking
- **`expo-constants`** – Reads Sentry DSN from app config

### Internal Dependencies

- **`lib/config`** – Feature flags (`sentryEnabled`) and performance thresholds
- **`lib/utils/logger`** – Category-based debug and error logging
- **`lib/storage`** – Encrypted queue persistence (analytics buffer only)
- **`lib/network`** – Online/offline detection for automatic flush (analytics buffer only)

---

## Error Handling & Edge Cases

### Sentry Disabled

When `sentryEnabled` is `false` or Sentry has no DSN, all `Analytics.*` calls are silent no-ops. Nothing throws.

### Circular Dependency

`session.ts` does not import `index.ts`. It sends Sentry breadcrumbs directly to avoid a circular import.

### Abandoned Performance Marks

If `endMeasure` is never called (e.g., an error interrupted the flow), the mark is silently removed after 5 minutes by `cleanupOldMarks`.

### Consent Withdrawn Mid-Buffer

Queued offline events stay in the buffer but will not be flushed until consent is restored. Events are not discarded automatically on consent withdrawal.

### Buffer Overflow

When the queue exceeds `maxSize`, the oldest events are dropped first (FIFO). A session-only `overflowCount` counter tracks dropped events; reset it with `getAndResetOverflowCount()` from `analyticsBufferService`.

### Storage Unavailable

If SecureStorage is unavailable, the buffer falls back to an in-memory queue. Events will be lost if the app restarts before they are flushed.

### Flush Error Handling

- **4xx responses**: Event is discarded immediately (permanent failure).
- **5xx / network errors**: Event is rescheduled with exponential backoff.
- **Max retries exceeded**: Event is discarded and logged.

---

## Performance Notes

### Breadcrumb Overhead

Each `Analytics.track()` call creates one Sentry breadcrumb in memory. Sentry caps the breadcrumb buffer at ~100; older ones are dropped automatically.

### Consent Checks

All consent checks are O(1) and run before any Sentry call, so denied categories add virtually no overhead.

### Mark Cleanup

O(n) scan over active marks (typically fewer than 10). Runs automatically after every `startMeasure` call.

### Buffer Overhead

- Retry scheduler runs every 30 seconds — O(n) scan over queued events (max 100).
- Online transitions are debounced (default 5s) to avoid flush spam from network flapping.
- Each queued event adds ~200 bytes of retry metadata to encrypted storage.

---

## Related Modules

- **`lib/config`** – Feature flags (`sentryEnabled`) and performance thresholds (`slowScreenMs`, `slowRequestMs`)
- **`lib/utils/logger`** – Category-based logging used throughout this module (`analytics`, `performance`)
- **`lib/storage`** – Encrypted queue persistence for the offline buffer
- **`lib/network`** – Online/offline state monitoring; triggers automatic buffer flush

---

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel and main exports. Defines `Analytics`, `Performance`, and `trackFeatureBlocked()`. Re-exports everything from the other files. |
| `consent.ts` | `AnalyticsConsent` manager. Tracks consent level (`none` / `basic` / `full`) and exposes `isAllowed()` for category gating. |
| `session.ts` | `sessionManager`. Tracks session lifetime, screen views, and error count. Sends `session_started` and `session_ended` events. |
| `analytics-buffer.ts` | Offline event queue. FIFO persistent storage via lib/storage, retry scheduling, overflow tracking, and batch flush logic. |
| `analytics-network-integration.ts` | Connects the buffer to lib/network. Flushes queued events on online transitions with debouncing and consent checks. |
| `breadcrumb-queue.ts` | Generic breadcrumb queue for offline queuing. Provider-agnostic, handles dedup, retry, and persistence. |
| `provider-adapter.ts` | Interface and factory for provider adapters (e.g., Sentry). Enables swapping analytics backends. |
| `sentry/` | Isolated Sentry implementation. |
| `sentry/sentry-adapter.ts` | Sentry-specific adapter implementing BreadcrumbProvider. Handles envelope format and rate limits. |
| `error-categorization.ts` | `categorizeError()`. Classifies errors into `network`, `auth`, `validation`, `timeout`, or `unknown` by inspecting message, name, and code. |
| `utils.ts` | Shared helpers: `sanitizeError()` (strips sensitive fields), `getThreshold()` (reads from config). |
| `performance/` | Performance baseline tracking and regression detection. |
| `performance/performance-baseline.ts` | `PerformanceBaselineService` singleton. Tracks historical percentiles, detects regressions, handles warm-up and idle filtering. |
| `performance/README.md` | Documentation for performance baseline tracking module. |


