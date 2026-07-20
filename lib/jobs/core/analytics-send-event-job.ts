/**
 * Analytics Send Event Job
 *
 * Background job that sends a single analytics event through the middleware.
 * Registered as job type "analytics_send_event" via lib/jobs/registry.ts.
 *
 * Replaces the old bespoke analytics-buffer.ts + analytics-network-integration.ts
 * offline-queue/retry mechanism. The BackgroundJobQueue (#167) already persists
 * jobs across app restarts and retries automatically on reconnect, so each
 * analytics event is enqueued as its own job instead of living in a hand-rolled
 * FIFO buffer with its own network listener and backoff scheduler.
 *
 * The job is a delayed manager: it calls middleware exactly like a synchronous
 * manager would, except it runs later after being persisted and retried by the
 * job queue. All validation, precondition checks, and provider logic stays in
 * the middleware layer (middleware/services/analytics-service.ts).
 */

import { logger } from '@/lib/utils/logger';
import type { AnalyticsEventPayload } from '@/middleware/services';
import type { BackgroundJobQueue } from '@/system/Jobs/background-job-queue';

/**
 * Register the analytics_send_event job handler with the queue.
 */
export function registerAnalyticsSendEventJob(queue: BackgroundJobQueue): void {
  queue.registerHandler('analytics_send_event', async (rawPayload) => {
    const payload = rawPayload as unknown as AnalyticsEventPayload;

    try {
      // Call middleware to handle all validation, preconditions, and provider logic
      const { sendAnalyticsEvent } = require('@/middleware/services');
      await sendAnalyticsEvent(payload);
      return { sentAt: Date.now() };
    } catch (error) {
      logger.category('analytics').warn(`[analytics-send-event-job] Send failed: ${error}`);
      // Re-throw so job queue retries with backoff
      throw error;
    }
  });
}
