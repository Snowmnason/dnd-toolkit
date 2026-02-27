/**
 * Sentry Analytics Exporter
 * Implements the AnalyticsExporter interface for Sentry backend
 *
 * Handles:
 * - Event mapping to Sentry breadcrumb/error format
 * - Offline queueing via #179 (BreadcrumbQueue)
 * - Feature flag control
 * - Error detection and routing (errors → Sentry errors, events → breadcrumbs)
 */

import { getAppConfig } from '@/config';
import { breadcrumbQueue } from '@/lib/analytics/exporters/breadcrumb-queue';
import {
  AnalyticsEvent,
  AnalyticsExporter,
  ExportContext,
} from '@/lib/analytics/exporters/exporter-registry';
import { SentryAdapter } from '@/lib/services/sentry/sentry-adapter';
import { logger } from '@/lib/utils/logger';

/**
 * Sentry exporter for analytics events
 * Handles error and breadcrumb events, with offline queueing support
 */
export class SentryExporter implements AnalyticsExporter {
  name = 'sentry';
  version = '7.2.0'; // Sentry SDK version (@sentry/react-native) for compatibility tracking
  requiredEvents = ['error']; // Always handle errors
  optionalEvents = ['event', 'pageview', 'performance', 'custom']; // Optional breadcrumbs

  private sentryAdapter: SentryAdapter | null = null;

  constructor() {
    try {
      this.sentryAdapter = new SentryAdapter();
    } catch (error) {
      logger.category('analytics').warn(
        'SentryExporter',
        `Failed to initialize Sentry adapter: ${error}`
      );
    }
  }

  /**
   * Initialize the Sentry exporter
   * Sets up breadcrumb queue with Sentry adapter for offline persistence
   * Called during service initialization before exporter registration
   */
  async initialize(): Promise<void> {
    try {
      // Create and initialize Sentry adapter for breadcrumb queue
      const adapter = new SentryAdapter();
      await breadcrumbQueue.initialize(adapter);
      logger.category('analytics').info(
        'SentryExporter',
        'Initialized breadcrumb queue with Sentry adapter'
      );
    } catch (error) {
      logger.category('analytics').warn(
        'SentryExporter',
        `Failed to initialize breadcrumb queue: ${error}`
      );
      // Don't throw - exporter can still work, just won't queue offline
    }
  }

  /**
   * Export analytics event to Sentry
   * Handles offline queueing and event routing
   */
  async export(event: AnalyticsEvent, context?: ExportContext): Promise<void> {
    // Validate event
    if (!this.validate(event)) {
      logger.category('analytics').warn(
        'SentryExporter',
        `Invalid event for Sentry: ${event.name}`
      );
      return;
    }

    // Check if online or offline
    const isOffline = context?.offline ?? false;

    try {
      // Route event based on type
      if (event.type === 'error' || event.type === 'fatal') {
        // Errors go to breadcrumb queue (for batch transport)
        await this._queueErrorEvent(event, isOffline);
      } else if (event.type === 'pageview') {
        // Pageviews are breadcrumbs
        await this._queueBreadcrumb(event, 'navigation', isOffline);
      } else if (event.type === 'performance') {
        // Performance events are breadcrumbs
        await this._queueBreadcrumb(event, 'performance', isOffline);
      } else if (event.type === 'event' || event.type === 'custom') {
        // Custom events are breadcrumbs
        await this._queueBreadcrumb(event, 'user-action', isOffline);
      }
    } catch (error) {
      logger.category('analytics').error(
        'SentryExporter',
        `Failed to export event to Sentry: ${error}`
      );
      throw error; // Re-throw for async dispatch error handling
    }
  }

  /**
   * Validate event for Sentry export
   * Check that required fields are present
   */
  validate(event: AnalyticsEvent): boolean {
    if (!event.id || typeof event.id !== 'string') {
      return false;
    }
    if (!event.type || typeof event.type !== 'string') {
      return false;
    }
    if (!event.name || typeof event.name !== 'string') {
      return false;
    }
    return true;
  }

  /**
   * Check if Sentry exporter is enabled
   * Reads from config: analytics.exporters.sentry.enabled
   */
  isEnabled(): boolean {
    try {
      const config = getAppConfig();
      const exporterConfig = config.analytics?.exporters?.sentry;
      return exporterConfig?.enabled !== false; // Default to enabled
    } catch (error) {
      logger.category('analytics').warn(
        'SentryExporter',
        `Failed to check if enabled: ${error}, defaulting to enabled`
      );
      return true; // Default to enabled on error
    }
  }

  /**
   * Queue an error event to the breadcrumb queue
   * Errors are sent as breadcrumbs to Sentry
   */
  private async _queueErrorEvent(
    event: AnalyticsEvent,
    isOffline: boolean
  ): Promise<void> {
    const data = {
      eventId: event.id,
      eventType: event.type,
      eventName: event.name,
      errorCode: event.error?.code,
      errorStack: event.error?.stack,
      userId: event.userId,
      sessionId: event.sessionId,
      properties: event.properties,
    };

    const breadcrumb = {
      timestamp: event.timestamp,
      category: 'error',
      level: (event.level ?? 'error') as 'error' | 'fatal' | 'warning' | 'info' | 'debug',
      message: event.error?.message ?? event.name,
      data,
      metadata: {
        offlineAt: isOffline ? Date.now() : undefined,
        approxSize: JSON.stringify(data).length,
      },
    };

    const queued = await breadcrumbQueue.enqueue(breadcrumb);
    if (queued) {
      logger.category('analytics').analytics(
        'SentryExporter',
        `Queued error event: ${event.name}`
      );
    }
  }

  /**
   * Queue a breadcrumb event to the breadcrumb queue
   */
  private async _queueBreadcrumb(
    event: AnalyticsEvent,
    category: string,
    isOffline: boolean
  ): Promise<void> {
    const data = {
      eventId: event.id,
      eventType: event.type,
      userId: event.userId,
      sessionId: event.sessionId,
      properties: event.properties,
      duration: event.performance?.duration,
      metric: event.performance?.metric,
    };

    const breadcrumb = {
      timestamp: event.timestamp,
      category,
      level: (event.level ?? 'info') as 'info' | 'debug' | 'warning' | 'error' | 'fatal',
      message: event.name,
      data,
      metadata: {
        offlineAt: isOffline ? Date.now() : undefined,
        approxSize: JSON.stringify(data).length,
      },
    };

    const queued = await breadcrumbQueue.enqueue(breadcrumb);
    if (queued) {
      logger.category('analytics').analytics(
        'SentryExporter',
        `Queued breadcrumb: ${event.name}`
      );
    }
  }
}
