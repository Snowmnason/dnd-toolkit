/**
 * Performance Regression Detection Job
 *
 * Background job that sends performance regression events through middleware.
 * Registered as job type "performance_regression_detected" via lib/jobs/registry.ts.
 *
 * Replaces fire-and-forget dispatch via exporter-registry.ts.
 * The BackgroundJobQueue (#167) persists jobs across app restarts and retries
 * automatically on reconnect, so regression events are now durable instead of
 * lost if the app closes or network is temporarily unavailable.
 *
 * NOTE: Like analytics_send_event, this is a delayed manager that calls middleware
 * directly (allowed exception to strict layering). The job is just enqueued persistence
 * + retry wrapper around a middleware call.
 *
 * FUTURE: Regression events could benefit from batching and TTL dedup like
 * the breadcrumb queue, but that's out of scope for #301. For now, each regression
 * is sent as an individual event with the same retry/backoff as other analytics.
 */

import { logger } from '@/lib/utils/logger';
import type { AnalyticsEventPayload } from '@/middleware/services';
import type { BackgroundJobQueue } from '@/system/Jobs/background-job-queue';

/**
 * Regression event payload structure (from performance-manager.ts)
 */
export interface RegressionEventPayload {
  id: string;
  timestamp: number;
  type: 'performance';
  name: 'regression_detected';
  properties: Record<string, any>;
}

/**
 * Register the performance_regression_detected job handler with the queue.
 */
export function registerPerformanceRegressionJob(queue: BackgroundJobQueue): void {
  queue.registerHandler('performance_regression_detected', async (rawPayload) => {
    const payload = rawPayload as unknown as RegressionEventPayload;

    try {
      // Transform regression event to analytics event format for middleware
      const analyticsEvent: AnalyticsEventPayload = {
        eventType: 'performance',
        name: payload.name,
        properties: payload.properties,
      };

      // Call middleware to handle all validation, preconditions, and provider logic
      const { sendAnalyticsEvent } = require('@/middleware/services');
      await sendAnalyticsEvent(analyticsEvent);
      return { sentAt: Date.now() };
    } catch (error) {
      logger.category('performance').warn(`[performance-regression-job] Send failed: ${error}`);
      // Re-throw so job queue retries with backoff
      throw error;
    }
  });
}
