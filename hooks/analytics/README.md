# Analytics

Hooks for analytics buffer status, breadcrumb queue monitoring, consent management, and telemetry integration. Used to monitor analytics event queues, manage user consent, and ensure events are sent reliably.

## When to Use This Module

**Use this module if you need to:**
- Monitor analytics buffer status for UI or debugging
- Track breadcrumb queue state for offline analytics
- **Manage user analytics consent levels** (GDPR compliance, persistence)
- **Handle crash report opt-in when consent is 'none'** (privacy-first error reporting)
- Trigger UI changes based on analytics queue state

**Do NOT use this module for:**
- Sending analytics events directly (use `lib/analytics`)
- Managing analytics configuration (see `lib/analytics`)

## Architecture & Data Flow

```
Component
        ↓
useAnalyticsBufferStatus / useBreadcrumbQueueStatus / useAnalyticsConsent / useCrashConsentReport
        ↓
Read analytics event buffer or breadcrumb queue state / manage consent / handle crash opt-in
        ↓
Update UI or trigger flush / persist consent changes / send crash reports
```

**Key Principles:**
- **Observability**: Hooks expose analytics buffer and breadcrumb queue state for UI/monitoring.
- **Consent Management**: `useAnalyticsConsent` provides GDPR-compliant consent management with persistence.
- **Crash Opt-in**: `useCrashConsentReport` enables privacy-first error reporting when consent is 'none'.
- **Separation**: Event sending and config live in `lib/analytics`.

## API Reference

### `useAnalyticsBufferStatus()`
Read the current status of the analytics event buffer.

### `useBreadcrumbQueueStatus()`
Read the current status of the breadcrumb queue for offline analytics.

### `useAnalyticsConsent(options?)`
**GDPR-compliant consent management hook.**

Manages user consent levels with automatic persistence and database sync. Initializes consent from storage on mount.

```ts
const { level, setLevel, isLoading, isInitialized } = useAnalyticsConsent();

// Check current level
if (level === 'full') {
  // Enable full tracking
}

// Update consent (persists automatically)
await setLevel('basic'); // Switches to GDPR-safe minimum
```

**Parameters:**
- `options.maxAgeMs` (optional): Cache freshness threshold (default 4 hours)
- `options.forceRefresh` (optional): Skip cache, force database refresh

**Returns:**
- `level`: Current consent level (`'none' | 'basic' | 'full'`)
- `setLevel(level)`: Update consent level (async, persists to storage + queues DB sync)
- `isLoading`: True during initialization or level changes
- `isInitialized`: True after consent loaded from storage

### `useCrashConsentReport()`
**Privacy-first crash reporting hook for 'none' consent users.**

When users decline analytics consent, crashes are not auto-sent to Sentry. This hook provides an opt-in mechanism where users can choose to send crash reports after the fact, enabling debugging without forcing consent.

```ts
const { canOptIn, sendCrashReport } = useCrashConsentReport();

// Only show opt-in UI when consent is 'none'
if (canOptIn) {
  <Button onPress={() => sendCrashReport(error, componentStack)}>
    Send Crash Report
  </Button>
}
```

**Returns:**
- `canOptIn`: True when consent level is 'none' (opt-in available)
- `sendCrashReport(error, componentStack?)`: Send crash report with full payload (async)

## Dependencies

### External Packages
- None

### Internal Dependencies
- **`lib/analytics`** – analytics event buffer, breadcrumb queue, and telemetry logic

## Error Handling & Edge Cases

### Buffer Overflows
If the buffer is full, hooks should surface status for UI to prompt a flush or warn the user.

### Queue Issues
Breadcrumb queue status should handle cases where the queue is corrupted or provider is unavailable.

## Performance Notes

Buffer and queue status checks are lightweight; avoid polling too frequently.

## Related Modules
- **`lib/analytics`** – analytics event buffer, breadcrumb queue, and telemetry

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `use-analytics-buffer-status.ts` | Read analytics event buffer status for UI/monitoring |
| `use-breadcrumb-queue-status.ts` | Read breadcrumb queue status for offline analytics monitoring |
| `use-analytics-consent.ts` | GDPR-compliant consent management with persistence and database sync |
| `use-crash-consent-report.ts` | Privacy-first crash reporting opt-in for 'none' consent users |
