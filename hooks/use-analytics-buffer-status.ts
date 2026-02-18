/**
 * Hook for debugging analytics buffer status
 *
 * Use this in development or admin panels to inspect the analytics queue
 */

import { analyticsBufferService } from "@/lib/analytics/analytics-buffer";
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
 * Updates whenever the buffer changes
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
    // Poll buffer status every 500ms (light polling during flushes)
    const interval = setInterval(async () => {
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
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return status;
}

/**
 * Internal: Update flushing state (called from network integration)
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
}
