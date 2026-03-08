/**
 * Network Manager — Coordination Hub
 *
 * Single point of entry for network functionality.
 * Coordinates NetworkDetection, error handling, telemetry, and adaptive payload logic.
 *
 * Used by:
 * - Hooks (useNetworkStatus, useAdaptivePayload, etc.)
 * - Lib modules (analytics, offline, jobs, api)
 *
 * This manager is NOT middleware (no precondition checks).
 * It's a facade that exports lib/network utilities and system/Network status queries
 * so callers don't need to import from multiple places.
 */

import { NetworkDetection, type NetworkStatus } from '@/system/Network/network-detection';
import { getAdaptivePayloadOptions, type AdaptivePayloadOptions } from './adaptive-payload/adaptive-payload';
import {
    isNetworkError,
    shouldServeStaleOnError,
} from './error-handling';
import {
    captureErrorCorrelation,
    emitHealthCheckEvent,
    emitQualityChangeEvent,
    mapQualityTier,
    startHealthCheckInterval,
    stopHealthCheckInterval,
    type ConnectionQualityTier,
} from './network-telemetry';

// Track last quality tier for quality change events
let lastQualityTier: ConnectionQualityTier | undefined = undefined;

export const NetworkManager = {
  /**
   * Get current network status
   * @returns Current NetworkStatus or undefined if detection not ready
   */
  getStatus(): NetworkStatus | undefined {
    return NetworkDetection.getStatus();
  },

  /**
   * Subscribe to network status changes
   * @param callback Called with new status when network state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (status: NetworkStatus | undefined) => void): () => void {
    return NetworkDetection.subscribe(callback);
  },

  // ─── Error Handling API ────────────────────────────────────────────

  /**
   * Check if an error is network-related
   * @param error The error to check
   * @returns True if error is network-related
   */
  isNetworkError(error: any): boolean {
    return isNetworkError(error);
  },

  /**
   * Determine if stale cache should be served on error
   * @param error The error that occurred
   * @param hasCache Whether we have cached data available
   * @param isOnline Whether we're currently online
   * @returns True if stale cache should be served
   */
  shouldServeStaleOnError(
    error: any,
    hasCache: boolean,
    isOnline: boolean,
  ): boolean {
    return shouldServeStaleOnError(error, { hasCache, isOnline, isNetworkError: isNetworkError(error) });
  },

  // ─── Adaptive Payload API ────────────────────────────────────────────

  /**
   * Get adaptive payload options for current network quality
   * @param status Network status (uses current if not provided)
   * @returns Payload options (image quality, exclude maps, etc.)
   */
  getPayloadOptions(status?: NetworkStatus): AdaptivePayloadOptions {
    const targetStatus = status || NetworkDetection.getStatus();
    return getAdaptivePayloadOptions(targetStatus);
  },

  // ─── Telemetry API ────────────────────────────────────────────────────

  /**
   * Emit quality change event (called when effectiveType changes)
   * Automatically computes quality tiers from network status for you.
   * @param status Current network status
   */
  emitQualityChange(status: NetworkStatus): void {
    const currentQuality = mapQualityTier(status.effectiveType, undefined);
    emitQualityChangeEvent(lastQualityTier, currentQuality, status);
    lastQualityTier = currentQuality;
  },

  /**
   * Emit health check event (periodic monitoring)
   * @param status Optional network status (uses current if not provided)
   */
  emitHealthCheck(status?: NetworkStatus): void {
    const targetStatus = status || NetworkDetection.getStatus();
    if (targetStatus) {
      emitHealthCheckEvent(targetStatus);
      const currentQuality = mapQualityTier(targetStatus.effectiveType, undefined);
      lastQualityTier = currentQuality;
    }
  },

  /**
   * Emit error correlation event (for observability)
   * Links network errors to quality state.
   * For advanced usage, import and call captureErrorCorrelation directly.
   * @param errorMessage The error message
   * @param errorCode Optional error code
   */
  emitErrorCorrelation(errorMessage: string, errorCode?: number): void {
    captureErrorCorrelation("other", errorMessage, errorCode);
  },

  /**
   * Start periodic health check events (5min interval)
   * Call once at app boot to enable health monitoring
   */
  startHealthCheckTimer(): void {
    startHealthCheckInterval();
  },

  /**
   * Stop periodic health check events
   */
  stopHealthCheckTimer(): void {
    stopHealthCheckInterval();
  },
};

// Export types and utilities for convenience
export { ConnectionQuality } from '@/system/Network/network-detection';
export type { NetworkStatus } from '@/system/Network/network-detection';
export type { AdaptivePayloadOptions } from './adaptive-payload/adaptive-payload';
export { mapQualityTier } from './network-telemetry';
export type { ConnectionQualityTier, ErrorCorrelationEvent } from './network-telemetry';

