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

import { AnalyticsConsent } from '@/lib/analytics/consent';
import { getAppConfig, isDevelopment } from '@/lib/config';
import { logger } from '@/lib/utils/logger';
import {
  ErrorCaptureOptions,
  ErrorTrackerProvider,
  SeverityLevel,
  TrackerBreadcrumb,
  TrackerUser,
} from '../error-tracker';

/**
 * Check if Sentry SDK should be active for error tracking or analytics
 * Single source of truth: SDK is enabled if EITHER errorProvider OR analytics is enabled.
 *
 * Checks:
 * 1. errorProvider.enabled OR analytics.enabled (config.services)
 * 2. Valid DSN is configured (process.env or Constants.expoConfig.extra)
 * 3. Not in test environment
 *
 * This ensures full abstraction from Sentry — if both services are disabled,
 * the SDK is never imported and has zero overhead.
 */
function isSentryEnabled(): boolean {
  try {
    const config = getAppConfig();

    // Primary control: either error provider or analytics must be enabled
    const errorProviderEnabled = config.services?.errorProvider?.enabled ?? false;
    const analyticsEnabled = config.services?.analytics?.enabled ?? false;
    const sdkNeeded = errorProviderEnabled || analyticsEnabled;
    if (!sdkNeeded) return false;

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
        logger.category('error').error('[SentryErrorTracker] Failed to capture exception:', sentryError);
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
        logger.category('error').error('[SentryErrorTracker] Failed to capture message:', sentryError);
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
        logger.category('error').error('[SentryErrorTracker] Failed to add breadcrumb:', sentryError);
      }
    }
  }

  setUser(user: TrackerUser | null): void {
    if (!this.isEnabled()) {
      return;
    }

    // SWITCH #2: Consent-level gating for user identification
    // Do not send user-identifying data unless consent level permits it.
    // Consent level 'none' means SDK stays silent on user data; 'basic' and 'full' allow identification.
    const consentLevel = AnalyticsConsent.getLevel();
    if (consentLevel === 'none' && user !== null) {
      if (isDevelopment()) {
        logger.category('error').debug('[SentryErrorTracker] setUser suppressed: consent level is "none"');
      }
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
        logger.category('error').error('[SentryErrorTracker] Failed to set user:', sentryError);
      }
    }
  }

  isEnabled(): boolean {
    return isSentryEnabled();
  }

  async flush(timeoutMs: number = 2000): Promise<boolean> {
    if (!this.isEnabled()) return true;

    try {
      // Sentry.flush returns a Promise<boolean>
      // Timeout provided in milliseconds
      // @ts-ignore - Sentry typings may vary across versions
      return await Sentry.flush(timeoutMs);
    } catch (err) {
      if (isDevelopment()) {
        logger.category('error').warn('[SentryErrorTracker] flush failed', err);
      }
      return false;
    }
  }
}

