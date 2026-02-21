# USAGE_GUIDE.md - Issue #250: Centralize Analytics Consent Gating

## Overview

The centralized consent gating system ensures all analytics events respect user privacy preferences. Events are automatically filtered at the dispatch layer based on three consent levels: 'none', 'basic', and 'full'.

## Consent Levels

### None (Minimal)
- **Essential events only**: Errors, crashes, fatal issues
- **No performance tracking**: API metrics, timing data blocked
- **No usage analytics**: Screen views, user interactions blocked
- **Error reporting**: Stored locally with opt-in mechanism for crash reports

### Basic (Recommended)
- **Essential events**: Errors, crashes always emitted
- **Performance tracking**: API calls, network metrics, timing data
- **No usage analytics**: Screen views, feature engagement blocked
- **Error reporting**: Minimal payload (error + stack trace)

### Full (Complete)
- **All event types**: Essential, performance, and usage analytics
- **Complete error context**: Full component stack, user context, breadcrumbs
- **Usage insights**: Screen flows, feature adoption, user behavior

## Automatic Behavior

Once implemented, consent gating works transparently:

1. **Event Creation**: Code emits events normally via `Analytics.track()`, `Analytics.withTiming()`, etc.
2. **Consent Check**: System automatically checks user consent level
3. **Gate Application**: Events filtered before reaching external services
4. **Silent Dropping**: Non-consented events dropped with debug logging
5. **Error Isolation**: Gate failures don't break app functionality

## Code Examples

### Basic Event Emission

```typescript
import { Analytics } from '@/lib/analytics';

// Events automatically respect consent
Analytics.track('screen_view', { screen: 'settings' });
Analytics.track('api_request', { endpoint: '/users', duration: 250 });
Analytics.track('error', { message: 'Network timeout', code: 500 });
```

### Performance Tracking

```typescript
import { Analytics } from '@/lib/analytics';

// Timing measurements respect consent
await Analytics.withTiming('api_call', async () => {
  return await api.getUserProfile(userId);
});

// Manual performance events
Analytics.track('performance_measure', {
  name: 'image_load',
  duration: 1200,
  size: '2.3MB'
});
```

### Error Reporting

```typescript
import { getCrashReportPayload, AnalyticsConsent } from '@/lib/analytics';

try {
  // Risky operation
  await processUserData();
} catch (error) {
  // Automatic consent-scoped reporting
  const options = getCrashReportPayload(error, componentStack, AnalyticsConsent.getLevel());
  if (options) {
    Sentry.captureException(error, options);
  }
}
```

### Crash Opt-in for 'None' Consent

When users choose 'none' consent, crashes are not automatically sent to Sentry. However, you can provide an opt-in mechanism allowing users to send crash reports after the fact:

```typescript
import { useCrashConsentReport } from '@/hooks/analytics';

function ErrorFallback({ error, componentStack }) {
  const { canOptIn, sendCrashReport } = useCrashConsentReport();

  return (
    <View>
      <Text>Something went wrong!</Text>
      {canOptIn && (
        <Button 
          onPress={() => sendCrashReport(error, componentStack)}
          title="Send Crash Report (Help Improve the App)"
        />
      )}
    </View>
  );
}
```

This provides privacy-first error reporting - users maintain control over their data while still enabling debugging when they choose to participate.

## Adding New Events

### 1. Determine Event Category

Choose the appropriate category based on data sensitivity:

- **Essential**: App stability, debugging, crash reporting
- **Performance**: System metrics, API performance, technical insights
- **Usage**: User behavior, feature adoption, business analytics

### 2. Add to Event Mapping

Update `lib/analytics/event-consent-mapping.ts`:

```typescript
export const DEFAULT_EVENT_CONSENT_MAPPING: EventConsentMapping = {
  analytics: {
    // Existing mappings...
    'new_feature_used': 'usage',        // User behavior
    'cache_hit_rate': 'performance',    // System performance
    'app_crash': 'essential',           // App stability
  },
  breadcrumb: {
    // Breadcrumb categories...
    'navigation': 'performance',
    'user_interaction': 'usage',
    'error': 'essential',
  }
};
```

### 3. Emit Events Normally

```typescript
// Event automatically gated based on mapping
Analytics.track('new_feature_used', {
  feature: 'dark_mode',
  source: 'settings_toggle'
});
```

## Integration Checklist

### For New Analytics Events
- [ ] Determine appropriate consent category (essential/performance/usage)
- [ ] Add mapping to `DEFAULT_EVENT_CONSENT_MAPPING`
- [ ] Test emission at all consent levels
- [ ] Verify events appear/disappear based on consent

### For Error Handling
- [ ] Use `getCrashReportPayload()` for Sentry reporting
- [ ] Handle `null` return (consent='none') appropriately
- [ ] Test error payloads at different consent levels

### For Breadcrumb Tracking
- [ ] Use standard Sentry breadcrumb API
- [ ] System automatically gates persistence
- [ ] No additional consent checks needed

## Testing Consent Behavior

### Manual Test Cases

**Test Case 1: Consent Level Changes**
```typescript
// Set consent to 'none'
AnalyticsConsent.setLevel('none');
Analytics.track('screen_view', { screen: 'home' }); // Should be dropped

// Change to 'basic'
AnalyticsConsent.setLevel('basic');
Analytics.track('api_request', { endpoint: '/data' }); // Should emit
Analytics.track('screen_view', { screen: 'profile' }); // Should be dropped

// Change to 'full'
AnalyticsConsent.setLevel('full');
Analytics.track('screen_view', { screen: 'settings' }); // Should emit
```

**Test Case 2: Error Reporting Scoping**
```typescript
// At 'none' consent - no external reporting
const options = getCrashReportPayload(error, stack, 'none');
// Result: options === null

// At 'basic' consent - minimal payload
const options = getCrashReportPayload(error, stack, 'basic');
// Result: { level: 'error', extra: { app_version: '1.0.0' } }

// At 'full' consent - complete payload
const options = getCrashReportPayload(error, stack, 'full');
// Result: { contexts: { component: {...}, user: {...} }, breadcrumbs: [...] }
```

**Test Case 3: Breadcrumb Persistence**
```typescript
// At 'none' consent
Sentry.addBreadcrumb({ message: 'User clicked button' });
// Result: Not persisted to queue

// At 'basic' consent
Sentry.addBreadcrumb({ message: 'API call started' });
// Result: Persisted (performance category)

// At 'full' consent
Sentry.addBreadcrumb({ message: 'User scrolled' });
// Result: Persisted (usage category)
```

### Debug Logging

Enable debug logging to verify gating:

```typescript
// Check console for gating messages
Analytics.track('test_event', { data: 'test' });
// Console: "Event 'test_event' dropped due to consent level (category=usage, level=basic)"
```

## Troubleshooting

### Events Not Emitting
1. **Check consent level**: `AnalyticsConsent.getLevel()`
2. **Verify mapping**: Is event name in `DEFAULT_EVENT_CONSENT_MAPPING`?
3. **Check category**: Does consent level allow the category?
4. **Review logs**: Look for "dropped due to consent level" messages

### Unmapped Events
- Unmapped events default to 'essential' category
- Check logs for "Unmapped event" warnings
- Add proper mapping to prevent warnings

### Performance Issues
- Consent checks are synchronous and fast
- No performance impact on event emission
- Breadcrumb gating prevents storage waste

## Migration from Ad-hoc Checks

### Before (Scattered Checks)
```typescript
// ❌ Old pattern - manual consent checks everywhere
if (AnalyticsConsent.isAllowed('usage')) {
  Analytics.track('screen_view', { screen: 'home' });
}

if (AnalyticsConsent.isAllowed('performance')) {
  Analytics.track('api_request', { endpoint: '/data' });
}
```

### After (Centralized Gating)
```typescript
// ✅ New pattern - emit freely, gate handles consent
Analytics.track('screen_view', { screen: 'home' });
Analytics.track('api_request', { endpoint: '/data' });
```

## Best Practices

### Event Naming
- Use consistent naming conventions
- Include context in event names when helpful
- Avoid PII in event names or properties

### Category Selection
- Default to 'essential' for debugging events
- Use 'performance' for technical metrics
- Reserve 'usage' for business intelligence

### Error Handling
- Always check `getCrashReportPayload()` return value
- Provide fallback logging for 'none' consent
- Test error reporting at all consent levels

### Privacy Compliance
- Never include PII in events
- Use event properties sanitization
- Document data collection purposes
- Provide clear consent explanations to users