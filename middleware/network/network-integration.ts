/**
 * Network Integration Service — Middleware wrapper for system-level NetworkDetection
 *
 * Provides lib modules with a consistent API for network status queries.
 * This is the ONLY file in lib that imports NetworkDetection directly.
 * All other lib modules call these functions instead.
 *
 * Responsibilities:
 * - Query current network status and connection quality
 * - Subscribe to network status changes
 * - Check if online/offline
 */

import { logger } from "@/lib/utils";
import { ConnectionQuality, NetworkDetection, type NetworkStatus as SystemNetworkStatus } from "@/system/Network";

export interface NetworkStatus {
  isOnline: boolean;
  connectionQuality: string; // 'good', 'bad', 'cellular', 'offline'
  type?: string; // 'wifi', 'cellular', 'none', 'unknown'
  isExpensive?: boolean;
  effectiveType?: string; // '4g', '3g', '2g', 'slow-2g', 'offline'
}

/**
 * Get current network status.
 * Non-blocking — returns cached status.
 */
export function getNetworkStatus(): NetworkStatus {
  try {
    const status = NetworkDetection.getStatus();
    return {
      isOnline: status.isOnline,
      connectionQuality: status.connectionQuality,
      type: status.type,
      isExpensive: status.isExpensive,
      effectiveType: status.effectiveType,
    };
  } catch (error) {
    logger.category("network").warn("Failed to get network status", error);
    // Default to optimistic: assume online
    return {
      isOnline: true,
      connectionQuality: ConnectionQuality.GOOD,
    };
  }
}

/**
 * Check if the device is currently online.
 * Returns true if online, false if offline.
 */
export function isNetworkOnline(): boolean {
  return getNetworkStatus().isOnline;
}

/**
 * Subscribe to network status changes.
 * Callback fired whenever connection quality changes.
 *
 * @param callback - Function to call on status change
 * @returns Unsubscribe function
 */
export function subscribeToNetworkStatus(
  callback: (status: NetworkStatus) => void | Promise<void>,
): () => void {
  try {
    return NetworkDetection.subscribe((rawStatus: SystemNetworkStatus) => {
      const status: NetworkStatus = {
        isOnline: rawStatus.isOnline,
        connectionQuality: rawStatus.connectionQuality,
        type: rawStatus.type,
        isExpensive: rawStatus.isExpensive,
        effectiveType: rawStatus.effectiveType,
      };

      try {
        callback(status);
      } catch (error) {
        logger.category("network").warn("Network subscription callback error", error);
      }
    });
  } catch (error) {
    logger.category("network").error(
      "Failed to subscribe to network changes",
      error,
    );
    // Return no-op unsubscribe
    return () => {};
  }
}
