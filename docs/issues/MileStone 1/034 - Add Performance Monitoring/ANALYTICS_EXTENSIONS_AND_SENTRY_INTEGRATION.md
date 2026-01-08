# Analytics & Performance Monitoring - Extended Features & Future Integration

Comprehensive guide for analytics implementation, future Sentry integration, and testing strategies.

## Overview

The analytics layer is built as a **thin, extensible abstraction** over Sentry. It provides:
- **Cost control**: No events sent unless DSN + `performanceMonitoring` flag are enabled
- **Privacy-first**: Consent layer built in from the start
- **Error categorization**: Distinguishes network, auth, timeout, validation errors
- **Session tracking**: User engagement and retention metrics
- **Breadcrumb management**: Lightweight, non-obtrusive event logging
- **Configuration**: Tunable thresholds for slow screen/request detection

---

## Core Features

### 1. Performance Monitoring with Configurable Thresholds

**Location**: `config/appsettings.*.json` → `thresholds`

```json
{
  "thresholds": {
    "slowScreenMs": 3000,
    "slowRequestMs": 3000
  }
}
```

**Used in:**
- `Performance.endMeasure()` - warns if screen duration exceeds threshold
- `lib/api/request-manager.ts` - warns if request duration exceeds threshold
- `Performance.useScreenDuration()` hook - can accept custom threshold

**Testing when Sentry enabled:**
- Verify slow screens (>3s) appear in Sentry breadcrumbs
- Change thresholds and confirm warnings update in console
- Measure component-heavy screens; compare dev (fast) vs production (slow)

---

### 2. Error Categorization

**Location**: `lib/analytics/error-categorization.ts`

Automatically categorizes errors into:
- **network**: Connection failures, offline, timeouts
- **auth**: Auth failures, token expiry, permission denied
- **validation**: Input/constraint violations
- **timeout**: Request/operation timeouts
- **unknown**: Uncategorized

**Auto-tracked in:**
- `withTiming()` - catches errors and logs with category
- `lib/api/request-manager.ts` - sanitizes error fields, includes category

**Testing when Sentry enabled:**
- Trigger network errors (go offline) and confirm category appears as `error_category: 'network'`
- Test auth failures (expired token) and confirm `error_category: 'auth'`
- Verify categorization groups errors in Sentry "Issues" dashboard for pattern analysis

---

### 3. Session & User Retention Tracking

**Location**: `lib/analytics/session.ts` → `SessionManager_`

Tracks:
- Session start/end
- Session duration (minutes)
- Screen view count within session
- Error count within session
- Session activity state (30-min inactivity timeout)

**API:**
```typescript
import { SessionManager_ } from '@/lib/analytics';

// Lifecycle
SessionManager_.startSession(userId);
SessionManager_.trackScreenView(screenName);  // Called auto in use-analytics-navigation
SessionManager_.trackError();                 // Call on error capture
SessionManager_.endSession();

// Queries
const durationMs = SessionManager_.getCurrentDuration();
const isActive = SessionManager_.isSessionActive();
```

**Testing when Sentry enabled:**
- Start session → verify `session_started` breadcrumb
- Navigate between screens → verify `screen_views` count increments
- Trigger errors → verify `errors` count increments
- End session → verify `session_ended` event with aggregated metrics
- Check Sentry "Events" for session metrics; pivot on duration/errors for cohort analysis

---

### 4. Consent & Privacy Layer

**Location**: `lib/analytics/consent.ts` → `AnalyticsConsent`

Provides consent-based tracking for GDPR/privacy compliance.

**API:**
```typescript
import { AnalyticsConsent } from '@/lib/analytics';

// Set consent level
AnalyticsConsent.setLevel('none');   // No tracking
AnalyticsConsent.setLevel('basic');  // Only errors/essential
AnalyticsConsent.setLevel('full');   // All tracking (default)

// Check before tracking
if (AnalyticsConsent.isAllowed('performance')) {
  trackPerformanceMetric();
}
if (AnalyticsConsent.isAllowed('usage')) {
  trackScreenView();
}
```

**Categories:**
- **essential**: Auth, errors (always tracked even in 'basic' mode)
- **performance**: Slow screens, API timings, withTiming
- **usage**: Screen views, component usage, feature flags

**Testing when Sentry enabled:**
- Set consent to 'none' → verify no breadcrumbs sent to Sentry
- Set to 'basic' → verify only error breadcrumbs appear
- Set to 'full' → verify all breadcrumbs (performance + usage) appear

**Future Extension:**
- Integrate with user preferences (settings screen)
- Persist consent choice to local storage
- Sync with backend privacy policy

---

### 5. Component Usage Tracking

**Location**: `lib/analytics/index.ts` → `Analytics.trackComponentUsage()`

Track which components are used and how.

**API:**
```typescript
import { Analytics } from '@/lib';

Analytics.trackComponentUsage({
  component: 'WeatherSlider',
  action: 'change',
  detail: { value: 0.5, range: [0, 1] }
});

Analytics.trackComponentUsage({
  component: 'NoteEditor',
  action: 'save',
  detail: { contentLength: 512 }
});
```

**Testing when Sentry enabled:**
- Add tracking to key components (sliders, textboxes, feature toggles)
- Verify `component_usage` breadcrumbs appear in Sentry
- Use to identify underutilized features or UX friction points

---

### 6. Breadcrumb Management (Foundation)

**Current state:** Breadcrumbs are added on every analytics event. This is lightweight and won't cause cost issues without a DSN.

**Future optimization (out of scope):**
- Cap breadcrumb count (e.g., last 100) to avoid memory buildup in long sessions
- Implement local breadcrumb queue that flushes only on error
- Add breadcrumb retention policy (age-out old events)

---

## Integration Checklist: When Sentry is Enabled

### Prerequisites
```env
EXPO_PUBLIC_SENTRY_DSN=https://your_key@your_org.ingest.us.sentry.io/your_project
```

In `config/appsettings.json`:
```json
"features": {
  "performanceMonitoring": true
}
```

### What Gets Sent to Sentry
- **Breadcrumbs**: Every `Analytics.track()`, `Performance.*`, `withTiming()` call
- **Errors**: Unhandled exceptions + intentional error reports via `Sentry.captureException()`
- **User context**: User ID + username via `Analytics.identify()`
- **Device context**: OS, app version, environment automatically included

### Testing Checklist
- [ ] Navigate through multiple screens; verify `screen_view` breadcrumbs appear
- [ ] Make an API call; verify `api_request` breadcrumb with duration and ok/error status
- [ ] Trigger a slow operation (>3s); verify breadcrumb appears with duration
- [ ] Trigger a network error; verify error categorization and breadcrumb
- [ ] Use a feature-blocked premium gate; verify `feature_blocked` breadcrumb
- [ ] Start and end a session; verify session metrics aggregated in `session_ended`
- [ ] Set consent to 'basic'; verify performance/usage breadcrumbs are filtered
- [ ] Interact with tracked components; verify `component_usage` breadcrumbs

### Sentry Dashboard Insights
1. **Performance**: Filter breadcrumbs by category='performance' to see slow operations
2. **Errors**: Group by `error_category` to identify systemic issues (network, auth, etc.)
3. **Sessions**: Use session_started/session_ended for user engagement funnel analysis
4. **Features**: Query `feature_blocked` events to measure feature demand/friction
5. **Components**: Query `component_usage` to find underutilized or overused UI elements

---

## File Locations

| File | Purpose |
|------|---------|
| `lib/analytics/index.ts` | Main Analytics API, Performance helpers, exports |
| `lib/analytics/consent.ts` | Consent/privacy layer |
| `lib/analytics/error-categorization.ts` | Error type classification |
| `lib/analytics/session.ts` | Session & retention tracking |
| `hooks/use-analytics-navigation.tsx` | Screen view tracking hook (auto-called in layout) |
| `lib/api/request-manager.ts` | API request duration tracking |
| `hooks/use-premium-feature.ts` | Premium gate telemetry |
| `config/appsettings.json` | Thresholds, feature flags |

---

## Configuration Reference

### `config/appsettings.json`

```json
{
  "features": {
    "performanceMonitoring": false  // Toggle all analytics (recommended: false for prod until reviewed)
  },
  "thresholds": {
    "slowScreenMs": 3000,
    "slowRequestMs": 3000
  }
}
```

### Environment Variables

```env
EXPO_PUBLIC_SENTRY_DSN=...        # Required to enable Sentry
EXPO_PUBLIC_ENVIRONMENT=production # Set environment context for Sentry
```

---

## Future Enhancements

### Short Term (Next Iteration)
1. **Sentry Performance Traces** - Measure end-to-end user workflows (e.g., "character creation flow")
2. **Custom metrics** - Gauge metrics for active users, feature usage rates
3. **Alert rules** - Notify on error spikes, slow screen detection
4. **Retention cohorts** - Track user retention by feature adoption

### Medium Term
1. **A/B testing integration** - Tag events with experiment variant
2. **Offline analytics buffer** - Queue events when offline, flush on reconnect
3. **Privacy dashboard** - User-facing consent UI + preference persistence
4. **Custom dashboards** - Sentry custom dashboards for D&D Toolkit KPIs

### Long Term
1. **Transition to analytics platform** - Evaluate Amplitude/Mixpanel for richer event analytics
2. **ML anomaly detection** - Auto-detect unusual user behavior patterns
3. **Real User Monitoring (RUM)** - Measure actual web app performance from browsers
4. **Retention & engagement** - Build custom retention funnels and feature adoption metrics

---

## Code Examples

### Track a Custom Event
```typescript
import { Analytics } from '@/lib';

Analytics.track('defeated_enemy', {
  enemyType: 'dragon',
  difficulty: 'hard',
  time_seconds: 120
});
```

### Measure Async Operation
```typescript
import { Analytics } from '@/lib';

const results = await Analytics.withTiming('generate_loot_table', async () => {
  return await generateLootTableAsync(enemyLevel);
}, 2000); // Custom 2s threshold
```

### Track Premium Feature Block
```typescript
import { trackFeatureBlocked } from '@/lib';

if (!isPremium) {
  trackFeatureBlocked({
    feature: 'custom_character_portraits',
    reason: 'requires_premium'
  });
}
```

### Set Consent Level
```typescript
import { AnalyticsConsent } from '@/lib';

// User opts out of analytics
AnalyticsConsent.setLevel('none');

// Later: user changes mind
AnalyticsConsent.setLevel('basic'); // Only essential tracking
```

---

## Troubleshooting

**"Breadcrumbs not appearing in Sentry"**
- Verify DSN is set: `console.log(process.env.EXPO_PUBLIC_SENTRY_DSN)`
- Verify `performanceMonitoring: true` in config
- Ensure an error is being captured (breadcrumbs only send with error events)
- Check Sentry "Inbound Filters" for any filtering rules

**"No session_ended event"**
- Ensure `SessionManager_.endSession()` is called on app background/logout
- Currently not auto-wired; you'll need to add it to your auth logout flow

**"Consent filtering not working"**
- Verify `AnalyticsConsent.setLevel()` is called before any tracking
- Check `Analytics.enabled()` returns `true` (DSN + performanceMonitoring flag)

---

## Summary

This analytics foundation provides a **privacy-first, extensible, cost-conscious** infrastructure for understanding user behavior and app performance. It's ready for Sentry integration and can evolve into richer analytics platforms without refactoring call sites.

Key design principles:
- ✅ No-op when disabled (zero cost in production without DSN)
- ✅ Consent built in from the start
- ✅ Sanitized data (no PII or error messages)
- ✅ Tunable thresholds for different environments
- ✅ Error categorization for root cause analysis
- ✅ Session retention for engagement metrics
