# IMPLEMENTATION_GUIDE.md - Issue #250: Centralize Analytics Consent Gating

## Overview

This implementation centralizes analytics consent gating at the dispatch layer, ensuring all events (analytics, breadcrumbs, error reports) respect user consent levels before reaching external services. The system provides three-tier consent: 'none' (minimal), 'basic' (errors + performance), 'full' (all tracking).

## Architecture

### Consent Categories
- **Essential**: Error reports, fatal crashes (always emitted for debugging)
- **Performance**: API metrics, timing data, network telemetry (requires 'basic' consent)
- **Usage**: Screen views, user interactions, feature engagement (requires 'full' consent)

### Gate Locations
- **Event Dispatch**: `dispatchEvent()` in exporter registry checks consent before sending to backends
- **Breadcrumb Queue**: `enqueue()` checks consent before persisting breadcrumbs
- **Error Reporting**: `getCrashReportPayload()` scopes error payloads by consent level

## Files Created

### Core Gating Logic
- **`lib/analytics/consent-gating.ts`**: Central gate functions and event category mapping
- **`lib/analytics/event-consent-mapping.ts`**: Default event-to-category mappings
- **`lib/analytics/consent-error-payload.ts`**: Tiered error payload builder

### Module Documentation
- **`lib/analytics/consent-gating/README.md`**: Developer guide for adding new events

## Files Edited

### Analytics Core
- **`lib/analytics/exporters/exporter-registry.ts`**: Added consent check in `dispatchEvent()`
- **`lib/analytics/breadcrumb-queue.ts`**: Added consent check in `enqueue()`
- **`lib/analytics/index.ts`**: Exported gating functions and removed ad-hoc consent checks

### Error Reporting
- **`lib/error/ErrorBoundary.tsx`**: Updated to use tiered error payloads
- **`lib/api/request-manager.ts`**: Updated error reporting with consent scoping

### Network Telemetry
- **`lib/network/network-telemetry.ts`**: Updated `hasPrivacyConsent()` to use centralized gating

### Documentation
- **`lib/analytics/README.md`**: Added consent flow documentation
- **`lib/error/README.md`**: Added tiered error reporting section
- **`lib/api/README.md`**: Updated error reporting descriptions

## Key Implementation Details

### Event Category Mapping

Events are categorized using a two-level lookup:
1. **Event Type**: General category (analytics, breadcrumb, error)
2. **Event Name**: Specific event identifier

```typescript
// Example mappings
const EVENT_CONSENT_MAPPING = {
  analytics: {
    screen_view: 'usage',
    api_request: 'performance',
    error: 'essential'
  },
  breadcrumb: {
    navigation: 'performance',
    ui: 'usage',
    error: 'essential'
  }
};
```

### Gate Logic

The `shouldEmitEvent()` function implements the consent rules:

```typescript
function shouldEmitEvent(category: ConsentCategory | null, consentLevel: ConsentLevel): boolean {
  if (category === 'essential') return true; // Always emit (even 'none' — keep essential list small)
  if (category === 'performance') return consentLevel !== 'none';
  if (category === 'usage') return consentLevel === 'full';
  // Unmapped events default to 'performance' — requires >= 'basic' consent.
  // This prevents forgotten events from leaking to 'none' consent users.
  return consentLevel !== 'none';
}
```

### Error Payload Scoping

Error reports are scoped by consent level:

- **none**: No external reporting (stored locally, user prompted for opt-in)
- **basic**: Minimal payload (error, message, stack trace, app version)
- **full**: Complete payload (component stack, user context, breadcrumbs)

## Integration Points

### Analytics Events
```typescript
// Before: Scattered consent checks
if (AnalyticsConsent.isAllowed('usage')) {
  dispatchEvent(event);
}

// After: Centralized gating
dispatchEvent(event); // Gate handles consent internally
```

### Breadcrumb Persistence
```typescript
// Before: No consent check
breadcrumbQueue.enqueue(breadcrumb);

// After: Consent-gated persistence
breadcrumbQueue.enqueue(breadcrumb); // Only persists if consented
```

### Error Reporting
```typescript
// Before: Full payload always
Sentry.captureException(error, fullContext);

// After: Consent-scoped payload
const options = getCrashReportPayload(error, componentStack, consentLevel);
if (options) Sentry.captureException(error, options);
```

## Migration Strategy

### Removed Ad-hoc Checks
- **`lib/analytics/index.ts`**: Removed `isAllowed()` guards from `track()`, `withTiming()`, `endMeasure()`
- **`lib/analytics/analytics-network-integration.ts`**: Removed blanket flush gate
- **`lib/network/network-telemetry.ts`**: Updated collection-side check to use centralized API

### Preserved Collection Gates
Some consent checks remain at collection time (not dispatch):
- Network telemetry collection (should we measure at all?)
- These use `shouldEmitEvent()` for consistency but check at measurement time

## Testing Strategy

### Unit Tests
- **`__tests__/analytics/consent-gating.unit.test.ts`**: Gate logic and mapping functions
- **`__tests__/analytics/consent-error-payload.unit.test.ts`**: Payload scoping

### Integration Tests
- **`__tests__/analytics/exporters/dispatch.test.ts`**: End-to-end dispatch gating
- **`__tests__/analytics/breadcrumb-queue.integration.test.ts`**: Persistence gating

### Manual Test Cases
- Consent level changes during runtime
- Unmapped event handling
- Error reporting at different consent levels
- Breadcrumb queue consent withdrawal

## Performance Impact

### Synchronous Gates
- Consent checks are synchronous (in-memory lookups)
- No async operations in hot paths
- Negligible performance overhead

### Memory Usage
- Event mappings loaded once at startup
- No per-event memory allocation
- Breadcrumb queue respects consent to avoid storage waste

## Security Considerations

### Privacy-First Design
- Events dropped before reaching external services
- No partial data leakage
- Clear logging of dropped events for debugging

### Safe Defaults
- Unmapped events default to `'performance'` (requires >= `'basic'` consent — never leaks to `'none'` users)
- Consent manager defaults to 'basic' if uninitialized
- Error boundary catches gate failures

## Future Enhancements

### Runtime Mapping Updates
- `registerEventConsentMapping()` for dynamic event registration
- Hot-reload of mappings without restart

### Advanced Gating
- Time-based consent (temporary opt-out)
- Context-aware gating (per-feature consent)
- Granular category controls

### Audit Logging
- Consent change history
- Event drop logging for compliance
- Privacy impact assessments