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
import { registerErrorTracker } from '../error-tracker';
import { SentryErrorTracker } from './sentry-error-tracker';

/**
 * Initialize Sentry SDK and register the error tracker
 *
 * Called during app bootstrap if config.features.sentryEnabled === true
 * Responsible for:
 * 1. Reading DSN and environment from process.env
 * 2. Initializing @sentry/react-native SDK
 * 3. Creating and registering SentryErrorTracker
 *
 * @throws Logs warn and throws on SDK init failure; caller should catch and fallback
 */
export async function initializeSentryErrorTracker(): Promise<void> {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT || 'production';
  const isDev = isDevelopment();

  if (!sentryDsn) {
    logger.info('bootstrap', '[Sentry] No DSN provided — SDK not initialized');
    return;
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
    logger.info('bootstrap', '[Sentry] SDK initialized');

    // Register error tracker with initialized SDK
    const sentryTracker = new SentryErrorTracker();
    registerErrorTracker(sentryTracker);
    logger.debug('bootstrap', 'SentryErrorTracker initialized and registered');
  } catch (error) {
    logger.warn('bootstrap', `[Sentry] Failed to initialize: ${error}`);
    throw error;
  }
}
