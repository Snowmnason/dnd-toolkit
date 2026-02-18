/**
 * Analytics Buffer Network Integration
 *
 * Integrates AnalyticsBufferService with NetworkDetection to automatically flush
 * pending events when the device goes online. Handles:
 * - Online/offline transitions with debouncing
 * - Batch flushing (25 events per request)
 * - Exponential backoff retry scheduling
 * - Non-blocking async flush
 * - Error handling (4xx discard, 5xx retry)
 * - Consent-aware flushing (no flush if consent withdrawn)
 */

import { getAppConfig } from "@/lib/config/loader";
import { NetworkDetection, type NetworkStatus } from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";
import { analyticsBufferService } from "./analytics-buffer";
import { AnalyticsConsent } from "./consent";

/**
 * Flush analytics events to backend
 * Pulled from the queue, sent in batches, with proper error handling
 * 
 * Respects nextAttemptAt scheduling (only flushes events ready for retry)
 */
export async function flushAnalyticsQueue(): Promise<void> {
  try {
    // Check consent before flushing
    // Note: "usage" consent is for user behavior analytics like screen_view
    // "performance" is for performance metrics
    // For the buffer, we respect general "usage" consent (conservative)
    if (!AnalyticsConsent.isAllowed("usage")) {
      logger
        .category("analytics")
        .debug("Analytics consent not given, skipping flush");
      return;
    }

    // Get config
    const config = getAppConfig();
    const batchSize = config.analytics?.buffer?.batchSize ?? 25;
    const maxBatches = Math.ceil(
      (analyticsBufferService.size() / batchSize) * 1.5,
    ); // Safety limit

    let flushedCount = 0;
    let failedCount = 0;
    let batchCount = 0;

    while (
      analyticsBufferService.size() > 0 &&
      batchCount < maxBatches
    ) {
      batchCount++;

      const batch = await analyticsBufferService.peek(batchSize);
      if (!batch || batch.length === 0) {
        break;
      }

      // Filter: only include events that are ready to retry (or never tried)
      const now = Date.now();
      const readyBatch = batch.filter((e) => !e.nextAttemptAt || e.nextAttemptAt <= now);
      const scheduledBatch = batch.filter((e) => e.nextAttemptAt && e.nextAttemptAt > now);

      if (readyBatch.length === 0) {
        // All events in batch are scheduled for future retry
        if (scheduledBatch.length > 0) {
          const nextRetryMs = Math.min(...scheduledBatch.map((e) => e.nextAttemptAt!));
          const waitMs = nextRetryMs - now;
          logger
            .category("analytics")
            .debug(
              `All events in next batch are scheduled; next retry in ${waitMs}ms`,
            );
        }
        break;
      }

      logger
        .category("analytics")
        .debug(
          `Flushing batch ${batchCount} with ${readyBatch.length}/${batch.length} ready events`,
          {
            ready: readyBatch.length,
            scheduled: scheduledBatch.length,
          },
        );

      try {
        // Send batch to analytics backend
        const success = await sendAnalyticsEventsBatch(readyBatch);

        if (success) {
          // Remove successfully sent events from queue
          const eventIds = readyBatch.map((e) => e.id);
          await analyticsBufferService.remove(eventIds);
          flushedCount += readyBatch.length;

          logger
            .category("analytics")
            .debug(`Flushed ${readyBatch.length} events successfully`);
        } else {
          // Failed but retryable - mark with next attempt time
          failedCount += readyBatch.length;
          logger
            .category("analytics")
            .warn("Failed to flush batch, will retry later", {
              eventCount: readyBatch.length,
            });
          break;
        }
      } catch (error) {
        logger
          .category("analytics")
          .error("Error flushing batch:", {
            error: String(error),
            batchSize: readyBatch.length,
          });
        // Continue to prevent single batch failure from blocking other batches
        failedCount += readyBatch.length;
        break;
      }

      // Space out batches to avoid overwhelming backend
      if (analyticsBufferService.size() > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (flushedCount > 0 || failedCount > 0) {
      logger
        .category("analytics")
        .info(`Flush complete: ${flushedCount} sent, ${failedCount} failed (scheduled for retry)`, {
          flushedCount,
          failedCount,
          queueSize: analyticsBufferService.size(),
        });
    }
  } catch (error) {
    logger
      .category("analytics")
      .error("Analytics flush error:", {
        error: String(error),
      });
  }
}

/**
 * Send a batch of analytics events to the backend
 *
 * Returns true if successful (200-299 or 4xx), false if retryable (5xx/network)
 */
async function sendAnalyticsEventsBatch(
  events: {
    id: string;
    timestamp: number;
    eventType: string;
    payload: Record<string, any>;
  }[],
): Promise<boolean> {
  try {
    // Get the Sentry DSN to determine backend
    // For now, we'll send to a theoretical analytics endpoint
    // In production, this would be the actual provider's endpoint
    const endpoint = getAnalyticsEndpoint();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: events.map((e) => ({
          type: e.eventType,
          timestamp: e.timestamp,
          data: e.payload,
        })),
      }),
    });

    // Success: 2xx
    if (response.status >= 200 && response.status < 300) {
      return true;
    }

    // 4xx: Permanent failure, discard events immediately
    if (response.status >= 400 && response.status < 500) {
      logger
        .category("analytics")
        .warn("Permanent error flushing analytics (4xx), discarding events", {
          status: response.status,
          eventCount: events.length,
        });

      // Discard events immediately (permanent error)
      for (const event of events) {
        await analyticsBufferService.discard(event.id, `HTTP ${response.status}`);
      }

      return true; // Treated as handled so flush can continue
    }

    // 5xx or other: Retryable
    logger
      .category("analytics")
      .warn("Retryable error flushing analytics", {
        status: response.status,
        eventCount: events.length,
      });

    for (const event of events) {
      await analyticsBufferService.markFailed(event.id, `HTTP ${response.status}`);
    }

    return false; // Retryable - keep in queue
  } catch (networkError) {
    // Network error: retryable
    logger
      .category("analytics")
      .warn("Network error flushing analytics, will retry", {
        error: String(networkError),
      });

    // Mark events as failed (they'll be retried next online transition)
    for (const event of events) {
      await analyticsBufferService.markFailed(event.id, "network_error");
    }

    return false; // Retryable
  }
}

/**
 * Get the analytics backend endpoint
 * Determines based on environment and Sentry config
 */
function getAnalyticsEndpoint(): string {
  // In a real implementation, this would determine the correct endpoint
  // based on the analytics provider (Sentry, Mixpanel, Segment, etc.)
  // For now, return a placeholder
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (sentryDsn) {
    // Parse Sentry DSN to get the endpoint
    try {
      const url = new URL(sentryDsn);
      const projectId = url.pathname.split("/").pop();
      return `${url.protocol}//${url.host}/api/${projectId}/store/`;
    } catch {
      // Fallback
    }
  }

  // Fallback endpoint (would be configured per provider)
  return "https://analytics.example.com/batch";
}

/**
 * Initialize network integration for analytics buffer
 * Call this once at app startup
 * 
 * Sets up:
 * - Network status listener for online transitions
 * - Retry scheduler to check for scheduled events periodically
 */
let isInitialized = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retrySchedulerTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeFromNetwork: (() => void) | null = null;

export function initializeAnalyticsNetworkIntegration(): void {
  if (isInitialized) {
    logger
      .category("analytics")
      .debug("Analytics network integration already initialized");
    return;
  }

  try {
    const config = getAppConfig();
    const debounceMs = config.analytics?.buffer?.debounceMs ?? 5000;
    const retryCheckIntervalMs = 30000; // Check for scheduled retries every 30s

    // Subscribe to network status changes
    unsubscribeFromNetwork = NetworkDetection.subscribe(
      (status: NetworkStatus) => {
        handleNetworkStatusChange(status, debounceMs);
      },
    );

    // Start retry scheduler: periodically check for events ready to retry
    retrySchedulerTimer = setInterval(() => {
      scheduleReadyRetries().catch((error) => {
        logger
          .category("analytics")
          .error("Retry scheduler error:", { error: String(error) });
      });
    }, retryCheckIntervalMs);

    isInitialized = true;
    logger
      .category("analytics")
      .debug("Analytics network integration initialized with retry scheduler");
  } catch (error) {
    logger
      .category("analytics")
      .error("Failed to initialize analytics network integration:", {
        error: String(error),
      });
  }
}

/**
 * Check for events that are ready to retry and trigger a flush if any exist
 */
async function scheduleReadyRetries(): Promise<void> {
  try {
    // Don't retry if we're offline
    if (!NetworkDetection.isOnline()) {
      return;
    }

    // Check if any events are ready to retry
    const allEvents = await analyticsBufferService.getAll();
    const now = Date.now();
    const readyEvents = allEvents.filter(
      (e) => !e.nextAttemptAt || e.nextAttemptAt <= now,
    );

    if (readyEvents.length === 0) {
      // No events ready to retry
      const scheduledEvents = allEvents.filter(
        (e) => e.nextAttemptAt && e.nextAttemptAt > now,
      );
      if (scheduledEvents.length > 0) {
        const nextRetryMs = Math.min(...scheduledEvents.map((e) => e.nextAttemptAt!));
        logger
          .category("analytics")
          .debug(
            `Retry scheduler: ${scheduledEvents.length} events scheduled, next in ${nextRetryMs - now}ms`,
          );
      }
      return;
    }

    logger
      .category("analytics")
      .info(
        `Retry scheduler: Found ${readyEvents.length} events ready to retry`,
      );

    // Trigger a non-blocking flush
    flushAnalyticsQueue().catch((error) => {
      logger
        .category("analytics")
        .error("Retry flush failed:", { error: String(error) });
    });
  } catch (error) {
    logger
      .category("analytics")
      .error("Error checking for ready retries:", {
        error: String(error),
      });
  }
}

/**
 * Handle network status changes with debouncing
 */
function handleNetworkStatusChange(
  status: NetworkStatus,
  debounceMs: number,
): void {
  if (!status.isOnline) {
    // Going offline: clear any pending flush timer
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    return;
  }

  // Going online: debounce flush to avoid network flaps
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    // Non-blocking flush (fire and forget)
    flushAnalyticsQueue().catch((error) => {
      logger
        .category("analytics")
        .error("Background flush failed:", { error: String(error) });
    });
  }, debounceMs);
}

/**
 * Cleanup network integration
 */
export function cleanupAnalyticsNetworkIntegration(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (retrySchedulerTimer) {
    clearInterval(retrySchedulerTimer);
    retrySchedulerTimer = null;
  }

  if (unsubscribeFromNetwork) {
    unsubscribeFromNetwork();
    unsubscribeFromNetwork = null;
  }

  isInitialized = false;
  logger
    .category("analytics")
    .debug("Analytics network integration cleaned up");
}

/**
 * Handle analytics consent withdrawal
 *
 * Called when user withdraws analytics consent. Immediately discards all pending
 * events without flushing. Integrates with AnalyticsConsent to support the workflow:
 * - User sets consent to 'none' or removes analytics permission
 * - App calls this function
 * - All pending buffer events are discarded
 * - New events only buffered after consent is re-granted
 *
 * Respects Phase 1b spec: "On consent withdraw: call clear(), remove storage key,
 * and log the discard locally (non-identifying). Do not schedule or send any pending events."
 */
export async function handleAnalyticsConsentWithdrawal(): Promise<void> {
  await analyticsBufferService.handleConsentWithdrawal();
}
