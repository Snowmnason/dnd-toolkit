/**
 * Hook for debugging analytics buffer status
 *
 * Use this in development or admin panels to inspect the analytics queue.
 * Uses subscription-based updates (not polling) to avoid redundant work.
 */

import { analyticsBufferService, notifyBufferStateChange } from "@/lib/analytics/analytics-buffer";
import { useEffect, useState } from "react";

export interface AnalyticsBufferStatus {
  queueSize: number;
  isFlushing: boolean;
  lastFlushTime: number | null; // Timestamp
  queuedEventTypes: string[]; // Unique event types in queue
  maxSize: number;
  oldestEventAge: number | null; // milliseconds
}

// Track flushing state (since buffer service doesn't expose this)
let isFlushing = false;
let lastFlushTime: number | null = null;

/**
 * Hook to get analytics buffer status
 * Subscribes to buffer state changes instead of polling for efficiency
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
    /**
     * Update state with current buffer and flushing state
     */
    const updateStatus = async () => {
      const stats = analyticsBufferService.getStats();
      const allEvents = await analyticsBufferService.getAll();
      const eventTypes = Array.from(
        new Set(allEvents.map((e) => e.eventType)),
      );

      setStatus({
        queueSize: stats.queueSize,
        isFlushing,
        lastFlushTime,
        queuedEventTypes: eventTypes,
        maxSize: stats.maxSize,
        oldestEventAge: stats.oldestEventAge,
      });
    };

    // Subscribe to buffer state changes
    // Callback fires whenever queue or flushing state changes
    const unsubscribe = analyticsBufferService.subscribe(updateStatus);

    // Initial update (state may have changed since hook was mounted)
    updateStatus().catch((error) => {
      console.error("Error updating analytics buffer status:", error);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}

/**
 * Internal: Update flushing state (called from network integration)
 * Notifies all buffer subscribers when flushing state changes
 * @internal
 */
export function _setAnalyticsBufferFlushing(
  value: boolean,
  timestamp?: number,
): void {
  isFlushing = value;
  if (value === false && timestamp) {
    lastFlushTime = timestamp;
  }
  // Notify subscribed components of state change
  notifyBufferStateChange();
}

