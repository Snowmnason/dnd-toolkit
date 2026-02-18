# Analytics Module

Provides a flexible, consent-aware analytics and performance monitoring foundation for applications. Supports event tracking, user identification, performance measurement, and session management with built-in privacy controls.

## When to Use This Module

**Use this module if you need to:**

- Track user events and engagement metrics with consent awareness
- Monitor application performance and identify slow operations
- Measure screen load times and custom operation duration with [lib/utils's startup time tracking](../utils/README.md)
- Manage user sessions, retention, and funnel analysis
- Identify and categorize errors for debugging and error tracking (Sentry)
- Ensure analytics compliance with privacy regulations (GDPR, CCPA, etc.)
- Have granular control over what data is collected and when (privacy-first design)
- Integrate with error reporting and monitoring services

**Do NOT use this module for:**

- Real-time analytics dashboards (this sends data to Sentry breadcrumbs; use external analytics service for dashboards)
- Custom event schemas with custom storage (add a persistence layer on top)
- Cross-device analytics sync (this is single-device; use [lib/database](../database/README.md) for server-side persistence)
- Telemetry logging (use [lib/utils's Logger](../utils/README.md) instead)

## Architecture & Data Flow

```
User Action / Runtime Event
        ↓
    Check Consent Level
        ↓
    Sanitize Data (remove sensitive fields)
        ↓
    Categorize (if error) / Measure (if timing)
        ↓
    Is Network Online?
        ├─ YES ─→ Send to Sentry (if enabled & consent allows)
        └─ NO  ─→ Queue to Offline Buffer (persisted locally)
                        ↓
                  [Buffer waits for online transition]
                        ↓
                  [Automatic retry with exponential backoff]
        ↓
    Log to Logger (for debugging & audit trail)
```

**Key Principles:**

- **Privacy-first**: All analytics are consent-based; defaults to 'basic' (GDPR compliant)
- **Offline-aware**: Events are queued locally when offline and automatically flushed when online
- **Resilient retries**: Failed sends retry with exponential backoff (1s → 2s → 4s → 8s → 16s)
- **Sanitization**: Sensitive fields (user input, system paths, full errors) are stripped before sending
- **Graceful degradation**: If Sentry is disabled or unavailable, events are still logged locally
- **Performance-aware**: Tracks and warns about slow operations; cleans up stale performance marks

## API Reference

### `Analytics` Object

Main entry point for event tracking and user identification.

#### `Analytics.enabled(): boolean`

Returns true if Sentry is configured and the `sentryEnabled` feature flag is set.

```ts
if (Analytics.enabled()) {
  // Safe to track analytics
}
```

#### `Analytics.identify(user: { id?: string; username?: string } | null): void`

Associates subsequent events with a user ID and optional username. Pass `null` to clear the user.

```ts
Analytics.identify({ id: "user-123", username: "john_doe" });
// ... later ...
Analytics.identify(null); // Clear user on logout
```

#### `Analytics.track(event: string, props?: Record<string, any>): void`

Tracks a generic event with optional properties. Respects consent levels:

- Events named 'screen_view' or 'component_usage' require 'usage' consent
- Events starting with 'performance' or named 'api_request' require 'performance' consent

```ts
Analytics.track("user_action", {
  action_type: "button_click",
  button_id: "save",
});
```

#### `Analytics.trackComponentUsage(params: { component: string; action: string; detail?: Record<string, any> }): void`

Convenience method for tracking component interactions. Automatically sets the event to 'component_usage'.

```ts
Analytics.trackComponentUsage({
  component: "LoginForm",
  action: "submit",
  detail: { method: "email" },
});
```

#### `Analytics.withTiming<T>(label: string, fn: () => Promise<T> | T, warnMs?: number): Promise<T> | T`

Wraps a function to measure execution time and log warnings if it exceeds a threshold. Logs performance breadcrumbs to Sentry if performance consent is allowed.

```ts
await Analytics.withTiming("database_query", () => queryDatabase(), 5000);
// If execution exceeds 5000ms, warns and sends breadcrumb
```

#### `Analytics.getThreshold(key: 'slowScreenMs' | 'slowRequestMs'): number`

Returns the configured performance threshold from app config, with a 3000ms fallback.

---

### `Performance` Object

Dedicated performance measurement utilities for custom timing scenarios.

#### `Performance.startMeasure(label: string): void`

Marks the start of a measurement. Warn if a mark with the same label already exists (prevents duplicate measurements).

```ts
Performance.startMeasure("data_loading");
```

#### `Performance.endMeasure(label: string, warnMs?: number): void`

Marks the end of a measurement and tracks the duration. Logs a warning if duration exceeds the threshold.

```ts
Performance.endMeasure("data_loading", 2000); // Warn if > 2000ms
```

#### `Performance.useScreenDuration(screenName: string): void`

React hook that automatically measures screen load duration. Starts measurement on mount, ends on unmount.

```ts
export function MyScreen() {
  Performance.useScreenDuration('MyScreen');
  return <View>...</View>;
}
```

#### `Performance.cleanupOldMarks(): void`

Internal method called automatically after `startMeasure()`. Removes marks older than 5 minutes to prevent memory leaks.

---

### `sessionManager` Object

Tracks user sessions, screen views, and error counts within a session.

#### `sessionManager.startSession(userId?: string): void`

Starts a new session. If a session is already active, ends the previous one first. Tracks a 'session_started' event.

```ts
sessionManager.startSession("user-456");
```

#### `sessionManager.endSession(): void`

Ends the current session and tracks a 'session_ended' event with aggregated metrics (duration, screen views, errors).

```ts
sessionManager.endSession();
```

#### `sessionManager.trackScreenView(screenName: string): void`

Records a screen view within the current session. Increments the screen view counter and updates last activity time.

```ts
sessionManager.trackScreenView("HomeScreen");
```

#### `sessionManager.trackError(): void`

Records an error within the current session. Increments error count and updates last activity time.

```ts
sessionManager.trackError();
```

#### `sessionManager.getCurrentDuration(): number`

Returns the current session duration in milliseconds.

```ts
const durationMs = sessionManager.getCurrentDuration();
```

#### `sessionManager.isSessionActive(): boolean`

Returns true if the session is still active (no inactivity > 30 minutes).

```ts
if (!sessionManager.isSessionActive()) {
  sessionManager.startSession(userId);
}
```

---

### Analytics Buffer (Offline Mode)

Automatically queues analytics events when offline and flushes them when the network becomes available. Requires the `analyticsBuffer.enabled` feature flag to be true.

#### `analyticsBufferService.initialize(): void`

Initializes the analytics buffer. Loads persisted queue from storage, validates event retention (7-day max), and sets up network monitoring.

```ts
import { analyticsBufferService } from "@/lib/analytics";

await analyticsBufferService.initialize();
```

#### `analyticsBufferService.enqueue(event: QueuedAnalyticsEvent): Promise<void>`

Adds an analytics event to the offline queue. Only enqueues if offline or if network is unreliable. Returns immediately (non-blocking).

```ts
await analyticsBufferService.enqueue({
  name: "screen_view",
  properties: { screen: "HomeScreen" },
  timestamp: Date.now(),
});
```

#### `analyticsBufferService.getStats(): AnalyticsBufferStats`

Returns current queue statistics: size, max size, oldest event age, and event type breakdown.

```ts
const { queueSize, maxSize, oldestEventAgeSec } = analyticsBufferService.getStats();
console.log(`${queueSize}/${maxSize} events queued (oldest: ${oldestEventAgeSec}s)`);
```

#### `analyticsBufferService.clear(): Promise<void>`

Clears all queued events. Use only for testing or user-initiated data deletion (privacy).

```ts
await analyticsBufferService.clear();
```

#### `useAnalyticsBufferStatus(): AnalyticsBufferStatus`

React hook for monitoring buffer status in debug/admin screens. Returns queue size, flushing state, last flush time, and queued event types.

```tsx
export function DebugAnalytics() {
  const { queueSize, isFlushing, lastFlushTime } = useAnalyticsBufferStatus();
  
  return (
    <View>
      <Text>Queue: {queueSize} events</Text>
      <Text>Last flush: {lastFlushTime?.toLocaleTimeString()}</Text>
      <Text>Status: {isFlushing ? "Flushing..." : "Idle"}</Text>
    </View>
  );
}
```

#### `calculateExponentialBackoff(retryCount: number, baseMs?: number): number`

Calculates exponential backoff delay for retry scheduling. Returns delay in milliseconds. Used internally by retry logic.

```ts
// Default base: 1000ms
calculateExponentialBackoff(0); // 1000ms
calculateExponentialBackoff(1); // 2000ms
calculateExponentialBackoff(2); // 4000ms
calculateExponentialBackoff(3); // 8000ms
calculateExponentialBackoff(4); // 16000ms (capped at 2^4)
calculateExponentialBackoff(5); // 16000ms (capped at 2^4)
```

**Retry Behavior:**

- Events are retried up to `maxRetries` times (default: 5, configurable)
- Failed sends (5xx, network errors) schedule automatic retry with exponential backoff
- Permanent failures (4xx) are discarded immediately
- After `maxRetries` exceeded, event is discarded with logging
- Automatic flusher checks for ready-to-retry events every 30 seconds

**Configuration:**

Configure buffer behavior in `config/appsettings.json`:

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

| Setting      | Default | Description                                                            |
| ------------ | ------- | ---------------------------------------------------------------------- |
| `enabled`    | `true`  | Enable/disable offline queuing                                         |
| `maxSize`    | `100`   | Max events in queue; older events dropped when exceeded (FIFO)         |
| `maxRetries` | `5`     | Max retry attempts per event before discard                            |
| `batchSize`  | `25`    | Events sent per network request                                        |
| `retryBaseMs`| `1000`  | Base delay for exponential backoff (milliseconds)                      |
| `debounceMs` | `5000`  | Debounce online transition to prevent flush spam from network flapping |

---

### `AnalyticsConsent` Object

Manages consent levels for analytics tracking. Defaults to 'basic' for GDPR compliance.

#### `AnalyticsConsent.setLevel(level: 'none' | 'basic' | 'full'): void`

Sets the consent level:

- `'none'`: No analytics tracking
- `'basic'`: Only essential events (errors, auth, session)
- `'full'`: All analytics including usage and performance

```ts
AnalyticsConsent.setLevel("full"); // User opts in to full tracking
```

#### `AnalyticsConsent.getLevel(): 'none' | 'basic' | 'full'`

Returns the current consent level.

#### `AnalyticsConsent.isAllowed(category: 'essential' | 'performance' | 'usage'): boolean`

Returns true if tracking is allowed for a given category based on the current consent level.

```ts
if (AnalyticsConsent.isAllowed("performance")) {
  // Safe to track performance metrics
}
```

---

### Utility Functions

#### `categorizeError(error: any): ErrorCategory`

Categorizes an error into: `'network'`, `'auth'`, `'validation'`, `'timeout'`, or `'unknown'`.

```ts
const category = categorizeError(new Error("Network timeout"));
// Returns: 'timeout'
```

#### `sanitizeError(err: any): { error_name?: string; error_code?: string | number } | undefined`

Extracts only safe, structured error identifiers (name and code). Returns `undefined` if error has neither.

```ts
const safe = sanitizeError(error);
// { error_name: 'TypeError', error_code: 'VALIDATION_ERROR' }
```

#### `trackFeatureBlocked(params: { feature: string; reason: 'flag_disabled' | 'requires_premium' | 'beta_only' }): void`

Tracks when a feature is blocked due to a flag, paywall, or beta restriction.

```ts
trackFeatureBlocked({ feature: "export_world", reason: "requires_premium" });
```

---

### A/B Testing & Variant Tracking

Import from `lib/analytics/variant-tracking`:

#### `trackVariantAssignment(event: VariantAssignmentEvent): void`

Tracks when a user is assigned to a variant (A or B). **Automatically called** by the rollout system; manual calls are rarely needed.

```ts
import { trackVariantAssignment } from "@/lib/analytics/variant-tracking";

trackVariantAssignment({
  flagName: "characters_v2_screen",
  variant: "B",
  userId: "user-123",
  percentage: 50,
});
```

#### `trackVariantEngagement(event: VariantEngagementEvent): void`

Tracks user engagement with a variant feature (clicks, form submissions, etc.).

```ts
import { trackVariantEngagement } from "@/lib/analytics/variant-tracking";

trackVariantEngagement({
  flagName: "characters_v2_screen",
  variant: "B",
  action: "edit_button_clicked",
  userId: "user-123",
  metadata: { button_name: "edit_character" },
});
```

#### `trackVariantPerformance(event: VariantPerformanceEvent): void`

Tracks performance metrics per variant for comparison (e.g., screen load times, API response times).

```ts
import { trackVariantPerformance } from "@/lib/analytics/variant-tracking";

trackVariantPerformance({
  flagName: "characters_v2_screen",
  variant: "B",
  userId: "user-123",
  metric: "screen_load_ms",
  value: 1250,
});
```

**For component-level tracking**, use the `useVariantTracking()` hook from `@/hooks`:

```tsx
import { useVariantTracking } from "@/hooks";

export function CharactersV2Screen() {
  const { trackEngagement, trackPerformance } = useVariantTracking(
    "characters_v2_screen",
    "B",
  );

  return (
    <Button
      onPress={() => {
        trackEngagement("view_details");
      }}
    >
      View Details
    </Button>
  );
}
```

For detailed A/B testing guide, see [docs/issues/MileStone 2/Tier 3/058 - Per-Variant Tracking/VARIANT_TRACKING_GUIDE.md](../../docs/issues/MileStone%202/Tier%203/058%20-%20Per-Variant%20Tracking/VARIANT_TRACKING_GUIDE.md).

---

## Dependencies

### External Packages

- **`@sentry/react-native`** – Error reporting and breadcrumb tracking
- **`expo-constants`** – Access to app config and environment variables

### Internal Dependencies

- **`lib/config/loader`** – Loads feature flags and performance thresholds
- **`lib/utils/logger`** – Logs debug and error messages (see logger system docs)
- **`lib/storage/SecureStorage`** – Encrypted persistent storage for offline queue (analytics buffer only)
- **`lib/network/network-detection`** – Monitors online/offline state and triggers automatic flush (analytics buffer only)

---

## Error Handling & Edge Cases

### Sentry Disabled

If Sentry is not configured or the `sentryEnabled` feature flag is false, all analytics calls gracefully no-op. Events are still logged locally for debugging.

```ts
// If Sentry is disabled, these do nothing:
Analytics.track("event"); // No error, no-op
Analytics.identify({ id: "user" }); // No error, no-op
```

### Circular Dependency Prevention

`sessionManager` does not import the main `Analytics` object; instead, it sends breadcrumbs directly to Sentry to avoid circular imports.

### Performance Mark Cleanup

Old performance marks (>5 minutes) are automatically cleaned up to prevent memory leaks. If a mark is still pending after 5 minutes (e.g., an operation never called `endMeasure`), it will be silently removed.

### Consent Bypass

Event tracking respects consent levels, but `identify()` and error categorization always work (they don't send data, just prepare it).

### Sanitization Failures

If sanitization fails, events are still sent with available data. Errors during sanitization are caught and logged without throwing.

### Analytics Buffer Failures

The analytics buffer gracefully handles network and storage failures:

- **Storage failures**: If SecureStorage is unavailable, the buffer falls back to in-memory queue (events lost on app restart)
- **Flush failures**: 4xx errors discard events (permanent failure); 5xx and network errors automatically retry with exponential backoff
- **Consent changes**: If consent is withdrawn during buffering, queued events remain buffered but are not flushed (require re-consent to resume)
- **Queue overflow**: When queue exceeds `maxSize`, oldest events are dropped first (FIFO overflow)
- **Event validation**: Corrupted events are skipped during loading; valid events are retained and processed normally

---

## Performance Notes

### Breadcrumb Overhead

Each event creates a Sentry breadcrumb, which is stored in memory. Sentry limits breadcrumbs to ~100 per session; older ones are automatically dropped.

### Mark Cleanup Cost

Mark cleanup is O(n) where n = number of active marks (typically < 10). Called after each `startMeasure()`.

### Consent Checks

Consent checks are O(1) and checked before any Sentry calls, reducing unnecessary overhead when consent is denied.

### Session Management

Session tracking is lightweight (only stores a few integers and strings). `isSessionActive()` performs a simple timestamp check (O(1)).

### Analytics Buffer Overhead

- **Queue storage**: O(maxSize) persistent storage; encrypted AES-CTR via SecureStorage
- **Batch flushing**: Network requests sent in configurable batches (default: 25 events/request); minimizes network overhead
- **Retry scheduler**: Runs every 30 seconds to check for events ready to retry; O(n) scan where n = queued events (typically < 100)
- **Debouncing**: Online transitions debounced (default: 5s) to prevent flush spam from network flapping
- **Memory footprint**: Retry metadata (timestamps, error reasons) adds ~200 bytes per queued event

---

## Related Modules

- **`lib/config`** – Provides feature flags (`sentryEnabled`, `performanceMonitoring`, `analyticsBuffer`) and performance thresholds
- **`lib/utils/logger`** – Used for debug/error logging; see logger system for category configuration
- **`lib/storage`** – SecureStorage provides encrypted persistent storage for the analytics buffer queue
- **`lib/network/network-detection`** – Monitors online/offline state and triggers automatic buffer flush on online transitions
- **`lib/error`** – Centralized error handling; consider integrating for automatic error categorization

---

## File Breakdown

| File                           | Purpose                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                     | Main entry point. Exports `Analytics`, `Performance`, `trackFeatureBlocked()`, `analyticsBufferService`, and `calculateExponentialBackoff()`. Includes event tracking, user identification, sanitization, and performance measurement with Sentry integration. |
| `analytics-buffer.ts`          | Offline queue service. Implements persistent FIFO queue for offline analytics events with exponential backoff retry scheduling, automatic discard on max retries, and configuration management.     |
| `analytics-network-integration.ts` | Network integration layer. Monitors online/offline transitions, automatically flushes queued events when online, manages retry scheduling, and debounces network state changes.                     |
| `consent.ts`                   | Consent level management. Defaults to 'basic' (GDPR compliant). Provides `AnalyticsConsent` manager with `setLevel()`, `getLevel()`, and `isAllowed()` methods.                                     |
| `session.ts`                   | Session tracking. Provides `sessionManager` to start/end sessions, track screen views and errors, and query session activity.                                                                       |
| `error-categorization.ts`      | Error categorization utility. `categorizeError()` classifies errors into network, auth, validation, timeout, or unknown categories.                                                                 |
| `utils.ts`                     | Shared utilities. Includes `sanitizeError()` to extract safe error fields and `getThreshold()` to retrieve performance thresholds from config.                                                      |
| `variant-tracking.ts`          | A/B testing and variant analytics. Exports `trackVariantAssignment()`, `trackVariantEngagement()`, `trackVariantPerformance()` for tracking variant assignments and user engagement with A/B tests. |

---

## Testing

Currently, no dedicated test guide exists for this module. See the source files for usage patterns. When adding tests, create a guide at `docs/A Testing Guide/analytics.md` following the repository's testing guide template.

**Manual testing tips:**

- Set feature flag `sentryEnabled` to false and verify analytics gracefully no-op
- Set `AnalyticsConsent.setLevel('none')` and verify no breadcrumbs are sent to Sentry
- Call `Analytics.withTiming()` with a fast function (should not warn)
- Call `Analytics.withTiming()` with a slow function (should log warning and breadcrumb)
- Use browser DevTools Network tab (if web) or Sentry console integration to verify breadcrumbs are sent

---

## Future Enhancements

- **Event Replay**: Integrate session replay for debugging user flows
- **User Properties**: Extend `identify()` to accept custom user properties and tags
- **Buffer Analytics**: Track buffer flush success rate, average batch size, and retry counts per event category
- **Compression**: Compress queued events before storage to reduce SecureStorage footprint
- **Selective Flushing**: Allow filtering events by category or age before flush (e.g., flush only "error" events when low battery)
- **Server-side Retries**: Offload retry logic to analytics backend for events already sent but failed on acknowledge
