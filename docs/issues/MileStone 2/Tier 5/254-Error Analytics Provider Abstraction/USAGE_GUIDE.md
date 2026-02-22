# Error & Analytics Provider Abstraction: Usage Guide

This guide shows how to use the `ErrorTrackerProvider` abstraction that enables swapping error tracking backends (Sentry, DataDog, Rollbar) without changing application code.

## Using getErrorTracker() in a New Module

**Import the error tracker and use it directly:**

```typescript
import { getErrorTracker } from '@/lib/services';

// In any module that needs error tracking
const tracker = getErrorTracker();

// All methods are fire-and-forget (never throw)
tracker.captureException(new Error('Something went wrong'));
tracker.addBreadcrumb({
  category: 'user_action',
  message: 'Button clicked',
  level: 'info'
});
```

**Key Points:**
- `getErrorTracker()` always returns a tracker (never null)
- If no tracker is registered, returns `NoOpErrorTracker` (silent no-ops)
- All methods are synchronous and safe to call
- No need for null checks or try/catch blocks

## Capturing Exceptions with Consent-Filtered Payload

**Use `getCrashReportPayload()` from analytics for consent-aware reporting:**

```typescript
import { getErrorTracker } from '@/lib/services';
import { getCrashReportPayload, AnalyticsConsent } from '@/lib/analytics';

try {
  // Risky operation
  await performRiskyOperation();
} catch (error) {
  // Get consent-filtered payload
  const consentLevel = AnalyticsConsent.getLevel();
  const options = getCrashReportPayload(error, componentStack, consentLevel);

  // Send to error tracker (if consent allows)
  if (options) {
    getErrorTracker().captureException(error, options);
  }
}
```

**Consent Levels:**
- **`none`**: No error reporting (returns `null`)
- **`basic`**: Minimal error info (message, code, no stack traces)
- **`full`**: Complete error details (stack traces, user context, breadcrumbs)

## Adding Breadcrumbs with Category

**Add contextual breadcrumbs for debugging:**

```typescript
import { getErrorTracker } from '@/lib/services';

// User action breadcrumb
getErrorTracker().addBreadcrumb({
  category: 'user_action',
  message: 'User clicked save button',
  level: 'info',
  data: {
    buttonId: 'save-btn',
    formData: { /* sanitized data only */ }
  }
});

// API call breadcrumb
getErrorTracker().addBreadcrumb({
  category: 'api',
  message: 'API request started',
  level: 'info',
  data: {
    endpoint: '/api/users',
    method: 'POST'
  }
});

// Performance breadcrumb
getErrorTracker().addBreadcrumb({
  category: 'performance',
  message: 'Slow operation detected',
  level: 'warning',
  data: {
    operation: 'database_query',
    duration: 2500,
    threshold: 2000
  }
});
```

**Breadcrumb Best Practices:**
- Use consistent categories: `user_action`, `api`, `navigation`, `performance`, `auth`
- Include only sanitized, non-sensitive data
- Use appropriate levels: `info`, `warning`, `error`
- Keep messages descriptive but concise

## Setting/Clearing User Context on Sign-in/out

**Associate errors with users (PII-aware):**

```typescript
import { getErrorTracker } from '@/lib/services';
import { AnalyticsConsent } from '@/lib/analytics';

// On user sign-in
function onUserSignIn(userId: string, email?: string) {
  const consentLevel = AnalyticsConsent.getLevel();

  // Basic user context (always safe)
  const userContext = { id: userId };

  // Add email only with full consent
  if (consentLevel === 'full' && email) {
    userContext.email = email;
  }

  getErrorTracker().setUser(userContext);
}

// On user sign-out
function onUserSignOut() {
  getErrorTracker().setUser(null);
}

// On app launch (restore user context)
function restoreUserContext() {
  const currentUser = getCurrentUser();
  if (currentUser) {
    onUserSignIn(currentUser.id, currentUser.email);
  }
}
```

**PII Safety Rules:**
- User `id` is always safe (internal identifier)
- Email requires explicit user consent (`full` level)
- Never include passwords, tokens, or sensitive personal data
- Clear user context on logout

## Adding a New Error Tracker (DataDog Example)

**Implement the `ErrorTrackerProvider` interface:**

```typescript
import { ErrorTrackerProvider, ErrorCaptureOptions, TrackerBreadcrumb, TrackerUser } from '@/lib/services';

export class DataDogErrorTracker implements ErrorTrackerProvider {
  constructor(private apiKey: string, private applicationId: string) {}

  captureException(error: Error, options?: ErrorCaptureOptions): void {
    // Map to DataDog error format
    const datadogError = {
      error: {
        message: error.message,
        stack: error.stack,
        kind: error.name
      },
      tags: options?.tags || [],
      user: options?.user,
      extra: options?.extra || {}
    };

    // Send to DataDog (async, fire-and-forget)
    this.sendToDataDog('error', datadogError).catch(() => {
      // Silently ignore network failures
    });
  }

  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'info'): void {
    const datadogLog = {
      message,
      level: this.mapLevel(level),
      timestamp: Date.now()
    };

    this.sendToDataDog('log', datadogLog).catch(() => {});
  }

  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void {
    const datadogBreadcrumb = {
      message: breadcrumb.message,
      category: breadcrumb.category,
      level: this.mapLevel(breadcrumb.level || 'info'),
      data: breadcrumb.data || {},
      timestamp: Date.now()
    };

    this.sendToDataDog('breadcrumb', datadogBreadcrumb).catch(() => {});
  }

  setUser(user: TrackerUser | null): void {
    if (user) {
      // Set user context in DataDog
      this.sendToDataDog('user', {
        id: user.id,
        email: user.email, // Only if consent allows
        name: user.username
      }).catch(() => {});
    } else {
      // Clear user context
      this.sendToDataDog('user', null).catch(() => {});
    }
  }

  isEnabled(): boolean {
    return !!this.apiKey && !!this.applicationId;
  }

  private mapLevel(level: string): string {
    switch (level) {
      case 'fatal': return 'emerg';
      case 'error': return 'err';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  }

  private async sendToDataDog(type: string, data: any): Promise<void> {
    // Implementation depends on DataDog SDK or REST API
    const endpoint = `https://api.datadoghq.com/api/v1/${type}`;

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.apiKey,
        'DD-APPLICATION-KEY': this.applicationId
      },
      body: JSON.stringify(data)
    });
  }
}
```

**Register the new tracker:**

```typescript
// In service initialization
import { registerErrorTracker } from '@/lib/services';
import { DataDogErrorTracker } from './datadog-error-tracker';

// Check configuration (outside this issue scope, but included for completeness)
const dataDogApiKey = process.env.EXPO_PUBLIC_DATADOG_API_KEY;
const dataDogAppId = process.env.EXPO_PUBLIC_DATADOG_APP_ID;

if (dataDogApiKey && dataDogAppId) {
  registerErrorTracker(new DataDogErrorTracker(dataDogApiKey, dataDogAppId));
} else {
  // Fallback to NoOp when disabled
  registerErrorTracker(new NoOpErrorTracker());
}
```

## Disabling Error Tracking Without Breaking Anything

**Error tracking can be disabled via configuration:**

```typescript
// When error tracking is disabled, register NoOp tracker
import { registerErrorTracker, NoOpErrorTracker } from '@/lib/services';

// Check if error tracking should be enabled
// (Configuration check - outside this issue scope)
const errorTrackingEnabled = checkErrorTrackingConfig();

if (!errorTrackingEnabled) {
  registerErrorTracker(new NoOpErrorTracker());
} else {
  // Register real tracker (Sentry, DataDog, etc.)
  registerErrorTracker(new SentryErrorTracker());
}
```

**What happens when disabled:**
- All `getErrorTracker()` calls return `NoOpErrorTracker`
- All methods silently do nothing (no console output in production)
- No exceptions thrown, no crashes
- Application continues working normally
- Development builds may show single warning on first use

**Configuration approaches (outside issue scope):**
- Environment variables: `EXPO_PUBLIC_ERROR_TRACKING_ENABLED`
- Feature flags: `features.errorTracking.enabled`
- App settings: `config.services.errorProvider.enabled`

## Migration from Direct Sentry Calls

**Before (direct Sentry imports):**
```typescript
import * as Sentry from '@sentry/react-native';

// Direct SDK calls
Sentry.captureException(error);
Sentry.addBreadcrumb(breadcrumb);
Sentry.setUser(user);
```

**After (provider abstraction):**
```typescript
import { getErrorTracker } from '@/lib/services';

// Provider-agnostic calls
getErrorTracker().captureException(error);
getErrorTracker().addBreadcrumb(breadcrumb);
getErrorTracker().setUser(user);
```

**Benefits:**
- Backend can be swapped without code changes
- Consistent API across all error tracking providers
- Automatic fallback when disabled
- PII-safe by design
- Testable with mock providers

This abstraction enables swapping error tracking backends in 1-2 days without touching application code, as demonstrated by the DataDog example above.