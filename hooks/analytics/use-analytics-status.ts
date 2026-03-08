/**
 * Analytics Status Hooks
 *
 * Debug hooks for inspecting analytics queue state.
 * Combines buffer (event queue) and breadcrumb queue status in one module.
 *
 * Use in development panels or admin UIs — not in production UI.
 */

import { breadcrumbQueue } from "@/lib/analytics";
import { analyticsBufferService, notifyBufferStateChange } from "@/lib/analytics/exporters/analytics-buffer";
import { logger } from "@/lib/utils/logger";
import { useEffect, useState } from "react";

// ─── Analytics Buffer ─────────────────────────────────────────────────────────

export interface AnalyticsBufferStatus {
  queueSize: number;
  isFlushing: boolean;
  lastFlushTime: number | null;
  queuedEventTypes: string[];
  maxSize: number;
  oldestEventAge: number | null;
}

// Module-level flushing state (shared with network integration)
let isFlushing = false;
let lastFlushTime: number | null = null;

/**
 * Hook to get analytics buffer (event queue) status.
 * Subscribes to buffer state changes instead of polling.
 */
export function useAnalyticsBufferStatus(): AnalyticsBufferStatus {
  const [status, setStatus] = useState<AnalyticsBufferStatus>(() => {
    const stats = analyticsBufferService.getStats();
    return {
      queueSize: stats.queueSize,
      isFlushing,
      lastFlushTime,
      queuedEventTypes: [],
      maxSize: stats.maxSize,
      oldestEventAge: stats.oldestEventAge,
    };
  });

  useEffect(() => {
    const updateStatus = async () => {
      const stats = analyticsBufferService.getStats();
      const allEvents = await analyticsBufferService.getAll();
      const eventTypes = Array.from(new Set(allEvents.map((e) => e.eventType)));
      setStatus({
        queueSize: stats.queueSize,
        isFlushing,
        lastFlushTime,
        queuedEventTypes: eventTypes,
        maxSize: stats.maxSize,
        oldestEventAge: stats.oldestEventAge,
      });
    };

    const unsubscribe = analyticsBufferService.subscribe(updateStatus);
    updateStatus().catch((error) => {
      logger.category("analytics").error("Error updating analytics buffer status", { error });
    });

    return () => unsubscribe();
  }, []);

  return status;
}

/**
 * Update flushing state — called from network integration.
 * Notifies all buffer subscribers when flushing state changes.
 * @internal
 */
export function _setAnalyticsBufferFlushing(value: boolean, timestamp?: number): void {
  isFlushing = value;
  if (value === false && timestamp) {
    lastFlushTime = timestamp;
  }
  notifyBufferStateChange();
}

// ─── Breadcrumb Queue ─────────────────────────────────────────────────────────

export interface BreadcrumbQueueStatus {
  queueSize: number;
  oldestBreadcrumbTime?: number;
  lastFlushTime?: number;
  overflowCount: number;
  providerName: string | null;
  isFlushing: boolean;
}

/**
 * Hook to get breadcrumb queue status.
 * Polls every 2s (breadcrumb queue doesn't emit change events).
 */
export function useBreadcrumbQueueStatus(): BreadcrumbQueueStatus {
  const [status, setStatus] = useState<BreadcrumbQueueStatus>(() => breadcrumbQueue.getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(breadcrumbQueue.getStats());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

/**
 * Get breadcrumb queue status synchronously (non-hook, for logging).
 */
export function getBreadcrumbQueueStatus(): BreadcrumbQueueStatus {
  return breadcrumbQueue.getStats();
}
