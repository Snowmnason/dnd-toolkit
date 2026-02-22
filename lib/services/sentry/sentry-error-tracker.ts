/**
 * Sentry Error Tracker Implementation
 *
 * Implements ErrorTrackerProvider interface for Sentry error tracking.
 * All Sentry SDK call sites are isolated to lib/services/sentry/ — see also
 * sentry-adapter.ts (breadcrumbs) and service-initializer.ts (SDK init).
 *
 * All direct Sentry SDK calls are isolated here. Callers use the provider interface
 * and never import Sentry directly.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

import { getAppConfig, isDevelopment } from '@/lib/config/loader';
import {
    ErrorCaptureOptions,
    ErrorTrackerProvider,
    SeverityLevel,
    TrackerBreadcrumb,
    TrackerUser,
} from '../error-tracker';

/**
 * Check if Sentry is enabled and configured
 * (Moved from analytics/index.ts — centralized here)
 *
 * Checks:
 * 1. Feature flag is enabled in config
 * 2. Valid DSN is configured
 * 3. Not in test environment
 */
function isSentryEnabled(): boolean {
  try {
    const config = getAppConfig();

    // Primary control: feature flag
    if (!config.features?.sentryEnabled) return false;

    // Also respect the central services config if present
    const errorServiceEnabled = config.services?.errorProvider?.enabled;
    if (typeof errorServiceEnabled === 'boolean' && !errorServiceEnabled) return false;

    // Check for valid DSN
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || Constants.expoConfig?.extra?.sentryDsn;
    return !!dsn;
  } catch {
    return false;
  }
}

/**
 * Sentry implementation of ErrorTrackerProvider
 * Routes all error tracking calls to Sentry SDK
 */
export class SentryErrorTracker implements ErrorTrackerProvider {
  captureException(error: Error, options?: ErrorCaptureOptions): void {
    if (!this.isEnabled()) {
      return;
    }

    try {
      Sentry.captureException(error, {
        tags: options?.tags,
        extra: options?.extra,
        level: options?.level as Sentry.SeverityLevel | undefined,
        fingerprint: options?.fingerprint,
        contexts: options?.contexts,
      });
    } catch (sentryError) {
      if (isDevelopment()) {
        console.error('[SentryErrorTracker] Failed to capture exception:', sentryError);
      }
    }
  }

  captureMessage(message: string, level?: SeverityLevel): void {
    if (!this.isEnabled()) {
      return;
    }

    try {
      Sentry.captureMessage(message, level as Sentry.SeverityLevel | undefined);
    } catch (sentryError) {
      if (isDevelopment()) {
        console.error('[SentryErrorTracker] Failed to capture message:', sentryError);
      }
    }
  }

  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void {
    if (!this.isEnabled()) {
      return;
    }

    try {
      Sentry.addBreadcrumb({
        category: breadcrumb.category,
        message: breadcrumb.message,
        level: breadcrumb.level as Sentry.SeverityLevel | undefined,
        data: breadcrumb.data,
        timestamp: breadcrumb.timestamp ? breadcrumb.timestamp / 1000 : undefined, // Sentry uses sec, not ms
      });
    } catch (sentryError) {
      if (isDevelopment()) {
        console.error('[SentryErrorTracker] Failed to add breadcrumb:', sentryError);
      }
    }
  }

  setUser(user: TrackerUser | null): void {
    if (!this.isEnabled()) {
      return;
    }

    try {
      if (user === null) {
        Sentry.setUser(null);
      } else {
        // Pass user object directly — Sentry will handle id, email, and extra fields
        Sentry.setUser(user as any);
      }
    } catch (sentryError) {
      if (isDevelopment()) {
        console.error('[SentryErrorTracker] Failed to set user:', sentryError);
      }
    }
  }

  isEnabled(): boolean {
    return isSentryEnabled();
  }
}

