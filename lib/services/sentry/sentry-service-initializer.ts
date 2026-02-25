/**
 * Sentry Service Initialization
 *
 * Centralizes all Sentry-specific setup:
 * - SDK initialization with DSN, environment, release, filters
 * - ErrorTracker registration
 *
 * Called by lib/services/service-initializer.ts only when Sentry is enabled.
 * Single responsibility: "If Sentry is on, initialize it here."
 */

import { isDevelopment } from '@/lib/config/loader';
import { logger } from '@/lib/utils/logger';
import { APP_VERSION } from '@/lib/utils/version';
import Constants from 'expo-constants';
import { registerErrorTracker } from '../error-tracker';
import { SentryErrorTracker } from './sentry-error-tracker';

/**
 * Initialize Sentry SDK and register the error tracker
 *
 * Called during app bootstrap if Sentry is enabled in config
 * Responsible for:
 * 1. Reading DSN from process.env or Constants.expoConfig.extra (fallback for non-standard builds)
 * 2. Initializing @sentry/react-native SDK (only if DSN is available)
 * 3. Creating and registering SentryErrorTracker
 *
 * @returns true if SDK was initialized and tracker registered, false if DSN missing or init skipped
 * @throws Logs warn and throws on SDK init failure; caller should catch and fallback
 */
export async function initializeSentryErrorTracker(): Promise<boolean> {
  // Try to read DSN from process.env first, then fallback to Constants.expoConfig.extra
  // This supports both standard Expo builds (env vars) and ejected/custom builds (app.json via Constants)
  const sentryDsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    Constants.expoConfig?.extra?.sentryDsn;
  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT || 'production';
  const isDev = isDevelopment();

  if (!sentryDsn) {
    logger.category('bootstrap').info('[Sentry] No DSN provided — SDK not initialized');
    return false;
  }

  try {
    // Initialize Sentry SDK
    const Sentry = await import('@sentry/react-native');
    Sentry.init({
      dsn: sentryDsn,
      environment,
      release: `dnd-toolkit@${APP_VERSION}`,
      debug: isDev,
      sampleRate: isDev ? 1.0 : 0.1,
      sendDefaultPii: true,
      enableLogs: isDev,
      beforeSend: (event) => {
        if (isDev) {
          if (event.exception?.values?.[0]?.value?.includes('Network request failed')) {
            return null;
          }
          if (event.exception?.values?.[0]?.value?.includes('Loading chunk')) {
            return null;
          }
        }
        return event;
      },
    });
    // Register error tracker with initialized SDK
    const sentryTracker = new SentryErrorTracker();
    registerErrorTracker(sentryTracker);
    return true;
  } catch (error) {
    logger.category('bootstrap').warn(`[Sentry] Failed to initialize: ${error}`);
    throw error;
  }
}
