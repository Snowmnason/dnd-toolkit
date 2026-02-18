/**
 * Analytics Buffer Network Integration
 *
 * Integrates AnalyticsBufferService with NetworkDetection to automatically flush
 * pending events when the device goes online. Handles:
 * - Online/offline transitions with debouncing
 * - Batch flushing (25 events per request)
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

      logger
        .category("analytics")
        .debug(`Flushing batch ${batchCount} with ${batch.length} events`);

      try {
        // Send batch to analytics backend
        const success = await sendAnalyticsEventsBatch(batch);

        if (success) {
          // Remove successfully sent events from queue
          const eventIds = batch.map((e) => e.id);
          await analyticsBufferService.remove(eventIds);
          flushedCount += batch.length;

          logger
            .category("analytics")
            .debug(`Flushed ${batch.length} events successfully`);
        } else {
          // Failed but retryable - leave in queue for next flush
          logger
            .category("analytics")
            .warn("Failed to flush batch, will retry later");
          break;
        }
      } catch (error) {
        logger
          .category("analytics")
          .error("Error flushing batch:", {
            error: String(error),
            batchSize: batch.length,
          });
        // Continue to prevent single batch failure from blocking other batches
        break;
      }

      // Space out batches to avoid overwhelming backend
      if (analyticsBufferService.size() > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (flushedCount > 0) {
      logger
        .category("analytics")
        .info(`Flush complete: ${flushedCount} events sent`);
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

    // 4xx: Permanent failure, discard events
    if (response.status >= 400 && response.status < 500) {
      logger
        .category("analytics")
        .warn("Permanent error flushing analytics (4xx), discarding events", {
          status: response.status,
          eventCount: events.length,
        });

      // Mark events as failed and discard if max retries exceeded
      for (const event of events) {
        await analyticsBufferService.markFailed(event.id, `HTTP ${response.status}`);
      }

      return true; // Treat as "handled" to unblock further flushes
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
 */
let isInitialized = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
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

    // Subscribe to network status changes
    unsubscribeFromNetwork = NetworkDetection.subscribe(
      (status: NetworkStatus) => {
        handleNetworkStatusChange(status, debounceMs);
      },
    );

    isInitialized = true;
    logger
      .category("analytics")
      .debug("Analytics network integration initialized");
  } catch (error) {
    logger
      .category("analytics")
      .error("Failed to initialize analytics network integration:", {
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

  if (unsubscribeFromNetwork) {
    unsubscribeFromNetwork();
    unsubscribeFromNetwork = null;
  }

  isInitialized = false;
  logger
    .category("analytics")
    .debug("Analytics network integration cleaned up");
}
