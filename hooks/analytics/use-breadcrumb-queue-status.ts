/**
 * Hook for debugging breadcrumb queue status
 *
 * Returns current queue statistics including size, oldest breadcrumb,
 * last flush time, overflow count, and provider name.
 *
 * Usage:
 *   const status = useBreadcrumbQueueStatus();
 *   console.log(`Queue: ${status.queueSize} breadcrumbs, last flush: ${status.lastFlushTime}`);
 */

import { breadcrumbQueue } from '@/lib/analytics';
import { useEffect, useState } from 'react';

export interface BreadcrumbQueueStatus {
  queueSize: number;
  oldestBreadcrumbTime?: number; // ms since epoch
  lastFlushTime?: number;
  overflowCount: number; // Session-only counter
  providerName: string;
}

/**
 * Get current breadcrumb queue status
 * Updates every time queue metrics change (on enqueue/flush/discard)
 */
export function useBreadcrumbQueueStatus(): BreadcrumbQueueStatus {
  const [status, setStatus] = useState<BreadcrumbQueueStatus>(() => breadcrumbQueue.getStats());

  useEffect(() => {
    // Poll queue status every 2s (provider should have async flush)
    // This is a simple polling approach; could be replaced with event emitter if needed
    const interval = setInterval(() => {
      setStatus(breadcrumbQueue.getStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return status;
}

/**
 * Get breadcrumb queue status synchronously (no React hook)
 * Useful for non-React code or logging
 */
export function getBreadcrumbQueueStatus(): BreadcrumbQueueStatus {
  return breadcrumbQueue.getStats();
}
