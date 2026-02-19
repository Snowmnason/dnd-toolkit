/**
 * Services Initialization Module
 * Centralizes setup for all services (Sentry, analytics exporters, etc.)
 *
 * This file is called once during AppKernel bootstrap.
 * To remove a service: delete the initialization call from here.
 * No need to touch AppKernel multiple times.
 *
 * Services exposed:
 * - SentryExporter (auto-registered)
 * - Future: Other service exporters
 */

import { AnalyticsExporter, exporterRegistry } from '@/lib/analytics/exporters';
import { logger } from '@/lib/utils/logger';
import { SentryExporter } from './sentry/sentry-analytics-exporter';

/**
 * Initialize all services
 * Call this once during app bootstrap (AppKernel phase)
 *
 * Safe to call multiple times (idempotent)
 */
export async function initializeServices(): Promise<void> {
  logger.info('services', 'Initializing all services...');

  try {
    // Register Sentry analytics exporter
    await initializeSentryExporter();

    logger.info('services', 'All services initialized successfully');
  } catch (error) {
    logger.error('services', `Failed to initialize services: ${error}`);
    throw error;
  }
}

/**
 * Initialize and register Sentry analytics exporter
 * Only registers if Sentry is enabled and configured
 */
async function initializeSentryExporter(): Promise<void> {
  try {
    const sentryExporter: AnalyticsExporter = new SentryExporter();

    // Check if enabled via config before registering
    if (sentryExporter.isEnabled?.()) {
      // Initialize exporter if it has an initialize lifecycle hook
      if (sentryExporter.initialize) {
        await sentryExporter.initialize();
      }

      // Register to global registry
      exporterRegistry.register(sentryExporter);
      logger.debug('services', 'Sentry exporter initialized and registered');
    } else {
      logger.debug('services', 'Sentry exporter is disabled in config, skipping registration');
    }
  } catch (error) {
    logger.warn(
      'services',
      `Failed to initialize Sentry exporter: ${error}. Continuing without it.`
    );
    // Don't throw - if Sentry exporter fails, other services should still work
  }
}

/**
 * Export registry for direct use if needed
 */
export { exporterRegistry } from '@/lib/analytics/exporters/exporter-registry';
export type { AnalyticsEvent, AnalyticsExporter, ExportContext } from '@/lib/analytics/exporters/exporter-registry';

