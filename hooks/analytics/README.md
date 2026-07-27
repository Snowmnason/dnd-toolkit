# Analytics

Hooks for analytics event emission, consent management, and crash report opt-in. Public event emission now lives in `managers/analytics/analytics-manager.ts` via the `Analytics` export; this module stays focused on UI-facing consent and event tracking.

## When to Use This Module

**Use this module if you need to:**
- **Track analytics events** from React components (use `Analytics.track()` from `managers/analytics/analytics-manager`)
- **Manage user analytics consent levels** (GDPR compliance, persistence)
- **Handle crash report opt-in when consent is 'none'** (privacy-first error reporting)

**Do NOT use this module for:**
- Managing analytics configuration and lower-level analytics plumbing (see `lib/analytics`)
- Direct access to buffer or queue state (breadcrumb queue stats available via `lib/analytics/exporters/breadcrumb-queue.ts`)

## Architecture & Data Flow

```
Component
        ↓
useAnalyticsConsent / useCrashConsentReport / Analytics.track()
        ↓
Manage consent / handle crash opt-in / emit events through manager gateway
        ↓
Persist consent / send crash reports / queue events to background jobs
```

**Key Principles:**
- **Event Emission**: `Analytics.track()` provides the public analytics API with built-in consent gating.
- **Consent Management**: `useAnalyticsConsent` provides GDPR-compliant consent management with persistence.
- **Crash Opt-in**: `useCrashConsentReport` enables privacy-first error reporting when consent is 'none'.
- **Separation**: Event sending and job queuing live in the manager gateway; consent and exporter plumbing live in `lib/analytics`.

## API Reference

### `useAnalytics()` & `useAnalyticsSession()`
Track analytics events from React components with session context.

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
- **`@/managers/analytics/analytics-manager`** – public analytics emission gateway with consent gating
- **`lib/analytics`** – consent management, breadcrumb queue, and telemetry logic

## Error Handling & Edge Cases

### Consent Persistence
Consent changes are persisted to storage with retry logic; failures throw an AnalyticsError.

## Performance Notes

Buffer and queue status checks are lightweight; avoid polling too frequently.

## Related Modules
- **`@/managers/analytics/analytics-manager`** – Public analytics emission gateway
- **`lib/analytics`** – analytics event buffer, breadcrumb queue, and telemetry

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `use-analytics.ts` | Track analytics events from React components with session context |
| `use-analytics-consent.ts` | GDPR-compliant consent management with persistence and database sync |
| `use-crash-consent-report.ts` | Privacy-first crash reporting opt-in for 'none' consent users |
| `useErrorReporting.ts` | Error reporting integration |
