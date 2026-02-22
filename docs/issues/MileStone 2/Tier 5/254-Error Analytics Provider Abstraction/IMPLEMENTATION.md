# Error & Analytics Provider Abstraction: Implementation Guide

This guide covers the technical implementation details of the `ErrorTrackerProvider` abstraction, including interface design, provider implementations, and migration patterns.

## ErrorTrackerProvider Interface

**Core interface definition:**

```typescript
export interface ErrorTrackerProvider {
  /**
   * Capture an exception with optional context
   * @param error The error to capture
   * @param options Additional context (tags, user, extra data)
   */
  captureException(error: Error, options?: ErrorCaptureOptions): void;

  /**
   * Capture a log message at specified level
   * @param message The message to log
   * @param level Severity level
   */
  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info'): void;

  /**
   * Add a breadcrumb for debugging context
   * @param breadcrumb Breadcrumb data with category, message, level
   */
  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void;

  /**
   * Set or clear user context for error association
   * @param user User context or null to clear
   */
  setUser(user: TrackerUser | null): void;

  /**
   * Check if this tracker is enabled and functional
   * @returns true if tracker can send data
   */
  isEnabled(): boolean;
}
```

**Supporting types:**

```typescript
export interface ErrorCaptureOptions {
  tags?: Record<string, string>;
  user?: TrackerUser;
  extra?: Record<string, any>;
  level?: 'fatal' | 'error' | 'warning' | 'info';
}

export interface TrackerBreadcrumb {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info';
  data?: Record<string, any>;
}

export interface TrackerUser {
  id: string;
  email?: string; // PII - requires consent
  username?: string;
}
```

**Design Principles:**
- **Synchronous API**: All methods return `void` and never throw
- **Fire-and-forget**: Implementations handle async operations internally
- **PII Safety**: User email requires explicit consent (enforced at caller level)
- **Graceful Degradation**: `isEnabled()` allows checking before expensive operations
- **Provider Agnostic**: Interface works with Sentry, DataDog, Rollbar, etc.

## Provider Registration and Initialization

**Singleton pattern with registration:**

```typescript
// lib/services/error-tracker.ts
let currentTracker: ErrorTrackerProvider | null = null;

/**
 * Register the error tracker provider
 * Should be called once during app initialization
 */
export function registerErrorTracker(tracker: ErrorTrackerProvider): void {
  currentTracker = tracker;
}

/**
 * Get the current error tracker (always returns a tracker)
 * Falls back to NoOpErrorTracker if none registered
 */
export function getErrorTracker(): ErrorTrackerProvider {
  if (!currentTracker) {
    // Lazy initialization with warning in development
    if (__DEV__) {
      console.warn('No error tracker registered, using NoOpErrorTracker');
    }
    currentTracker = new NoOpErrorTracker();
  }
  return currentTracker;
}
```

**Initialization in kernel/bootstrap:**

```typescript
// lib/kernel/app-kernel.ts or similar
export async function initializeServices() {
  // Check configuration (outside issue scope)
  const errorTrackingEnabled = checkErrorTrackingEnabled();

  if (errorTrackingEnabled) {
    // Initialize Sentry tracker
    const sentryTracker = new SentryErrorTracker();
    await sentryTracker.initialize();
    registerErrorTracker(sentryTracker);
  } else {
    // Register no-op tracker
    registerErrorTracker(new NoOpErrorTracker());
  }
}
```

## SentryErrorTracker Implementation

**Complete implementation mapping Sentry SDK:**

```typescript
import * as Sentry from '@sentry/react-native';
import { ErrorTrackerProvider, ErrorCaptureOptions, TrackerBreadcrumb, TrackerUser } from './error-tracker';

export class SentryErrorTracker implements ErrorTrackerProvider {
  async initialize(): Promise<void> {
    // Sentry initialization (outside this issue scope)
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      // ... other config
    });
  }

  captureException(error: Error, options?: ErrorCaptureOptions): void {
    if (!this.isEnabled()) return;

    const sentryOptions: Sentry.CaptureContext = {};

    if (options?.tags) {
      sentryOptions.tags = options.tags;
    }

    if (options?.user) {
      sentryOptions.user = {
        id: options.user.id,
        email: options.user.email,
        username: options.user.username
      };
    }

    if (options?.extra) {
      sentryOptions.extra = options.extra;
    }

    if (options?.level) {
      sentryOptions.level = this.mapLevelToSentry(options.level);
    }

    Sentry.captureException(error, sentryOptions);
  }

  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'info'): void {
    if (!this.isEnabled()) return;

    Sentry.captureMessage(message, this.mapLevelToSentry(level));
  }

  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void {
    if (!this.isEnabled()) return;

    Sentry.addBreadcrumb({
      category: breadcrumb.category,
      message: breadcrumb.message,
      level: this.mapLevelToSentry(breadcrumb.level || 'info'),
      data: breadcrumb.data
    });
  }

  setUser(user: TrackerUser | null): void {
    if (!this.isEnabled()) return;

    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username
      });
    } else {
      Sentry.setUser(null);
    }
  }

  isEnabled(): boolean {
    // Check if Sentry is initialized and configured
    return !!Sentry.getCurrentHub().getClient();
  }

  private mapLevelToSentry(level: string): Sentry.SeverityLevel {
    switch (level) {
      case 'fatal': return 'fatal';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  }
}
```

**Key Implementation Notes:**
- **Conditional Execution**: All methods check `isEnabled()` first
- **Level Mapping**: Maps interface levels to Sentry-specific levels
- **User Context**: Passes through user data with PII fields
- **Async Initialization**: `initialize()` method for setup (Sentry.init)
- **Error Handling**: Never throws - async operations are fire-and-forget

## NoOpErrorTracker Implementation

**Silent fallback implementation:**

```typescript
import { ErrorTrackerProvider, ErrorCaptureOptions, TrackerBreadcrumb, TrackerUser } from './error-tracker';

export class NoOpErrorTracker implements ErrorTrackerProvider {
  captureException(error: Error, options?: ErrorCaptureOptions): void {
    // Do nothing
  }

  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'info'): void {
    // Do nothing
  }

  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void {
    // Do nothing
  }

  setUser(user: TrackerUser | null): void {
    // Do nothing
  }

  isEnabled(): boolean {
    return false;
  }
}
```

**Development Enhancement:**

```typescript
export class DevNoOpErrorTracker extends NoOpErrorTracker {
  private warned = false;

  captureException(error: Error, options?: ErrorCaptureOptions): void {
    if (!this.warned && __DEV__) {
      console.warn('Error tracking disabled:', error.message);
      this.warned = true;
    }
  }

  // ... other methods can show dev warnings if needed
}
```

## Migration Patterns

**Pattern 1: Direct Sentry Import Replacement**

**Before:**
```typescript
// lib/analytics/index.ts
import * as Sentry from '@sentry/react-native';

export function trackError(error: Error) {
  Sentry.captureException(error);
}
```

**After:**
```typescript
// lib/analytics/index.ts
import { getErrorTracker } from '@/lib/services';

export function trackError(error: Error) {
  getErrorTracker().captureException(error);
}
```

**Pattern 2: Conditional Error Tracking**

**Before:**
```typescript
// lib/api/request-manager.ts
import * as Sentry from '@sentry/react-native';

if (Sentry.getCurrentHub().getClient()) {
  Sentry.addBreadcrumb({
    category: 'api',
    message: 'API request failed'
  });
}
```

**After:**
```typescript
// lib/api/request-manager.ts
import { getErrorTracker } from '@/lib/services';

getErrorTracker().addBreadcrumb({
  category: 'api',
  message: 'API request failed'
});
```

**Pattern 3: User Context Management**

**Before:**
```typescript
// lib/auth/auth-state.ts
import * as Sentry from '@sentry/react-native';

export function setAuthUser(user: User) {
  Sentry.setUser({
    id: user.id,
    email: user.email
  });
}
```

**After:**
```typescript
// lib/auth/auth-state.ts
import { getErrorTracker } from '@/lib/services';

export function setAuthUser(user: User) {
  getErrorTracker().setUser({
    id: user.id,
    email: user.email // Consent checked at caller level
  });
}
```

## Testing Patterns

**Mock Provider for Unit Tests:**

```typescript
// __tests__/mocks/error-tracker.ts
import { ErrorTrackerProvider } from '@/lib/services';

export class MockErrorTracker implements ErrorTrackerProvider {
  capturedExceptions: Error[] = [];
  capturedMessages: string[] = [];
  breadcrumbs: TrackerBreadcrumb[] = [];
  currentUser: TrackerUser | null = null;

  captureException(error: Error, options?: ErrorCaptureOptions): void {
    this.capturedExceptions.push(error);
  }

  captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' = 'info'): void {
    this.capturedMessages.push(message);
  }

  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
  }

  setUser(user: TrackerUser | null): void {
    this.currentUser = user;
  }

  isEnabled(): boolean {
    return true;
  }

  reset(): void {
    this.capturedExceptions = [];
    this.capturedMessages = [];
    this.breadcrumbs = [];
    this.currentUser = null;
  }
}
```

**Test Setup:**

```typescript
// __tests__/setup.ts or individual test
import { registerErrorTracker } from '@/lib/services';
import { MockErrorTracker } from '../mocks/error-tracker';

const mockTracker = new MockErrorTracker();

beforeEach(() => {
  mockTracker.reset();
  registerErrorTracker(mockTracker);
});

test('should capture exceptions', () => {
  const error = new Error('Test error');
  getErrorTracker().captureException(error);

  expect(mockTracker.capturedExceptions).toContain(error);
});
```

**Integration Testing:**

```typescript
// Test with real provider
test('error tracker integration', async () => {
  const realTracker = new SentryErrorTracker();
  await realTracker.initialize();
  registerErrorTracker(realTracker);

  const tracker = getErrorTracker();
  expect(tracker.isEnabled()).toBe(true);

  // Test actual error capture (may require test DSN)
  tracker.captureMessage('Integration test');
});
```

## Performance Considerations

**Lazy Initialization:**
- `getErrorTracker()` creates NoOp tracker only when first called
- Avoids initialization overhead when error tracking is disabled

**Async Operations:**
- All network calls (Sentry, DataDog) are fire-and-forget
- No blocking operations in error paths
- Failed sends don't crash the app

**Memory Management:**
- Breadcrumbs can accumulate - providers should limit history
- User context is minimal (id, email, username)
- No large data structures kept in memory

**Bundle Impact:**
- Only active provider's code is loaded
- Tree shaking removes unused providers
- NoOp tracker has minimal bundle footprint

## Error Handling Philosophy

**Never Crash on Errors:**
- Error tracking failures should never break the app
- All methods are void-returning, no exceptions thrown
- Async failures are silently ignored

**Graceful Degradation:**
- If tracker fails, app continues normally
- No user-facing error messages for tracking failures
- Development warnings for debugging

**Reliability First:**
- Prefer losing error data over crashing the app
- Implement circuit breakers if needed (future enhancement)
- Always have a working fallback (NoOp tracker)

This implementation enables reliable, backend-agnostic error tracking that never compromises application stability.