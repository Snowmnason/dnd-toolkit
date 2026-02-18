# Analytics Module

Consent-aware analytics and performance monitoring. Handles event tracking, user identification, screen/session measurement, and offline event queuing with automatic retry.

## When to Use This Module

**Use this module if you need to:**

- Track user events and engagement metrics with consent awareness
- Monitor application performance and identify slow operations
- Measure screen load times and custom operation durations
- Manage user sessions, screen views, and error counts
- Queue events when offline and flush them automatically when reconnected
- Track A/B test variant assignments and engagement

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

Controls which categories of events are allowed. Defaults to `'basic'` (GDPR safe).

| Level | What is tracked |
| ----- | --------------- |
| `'none'` | Nothing |
| `'basic'` | Essential events only (errors, auth, session) |
| `'full'` | All events including usage and performance |

```ts
AnalyticsConsent.setLevel("full");
AnalyticsConsent.getLevel(); // 'full'
AnalyticsConsent.isAllowed("performance"); // true
```

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
| `error-categorization.ts` | `categorizeError()`. Classifies errors into `network`, `auth`, `validation`, `timeout`, or `unknown` by inspecting message, name, and code. |
| `utils.ts` | Shared helpers: `sanitizeError()` (strips sensitive fields), `getThreshold()` (reads from config). |
| `variant-tracking.ts` | A/B test helpers: `trackVariantAssignment()`, `trackVariantEngagement()`, `trackVariantPerformance()`. |

---


