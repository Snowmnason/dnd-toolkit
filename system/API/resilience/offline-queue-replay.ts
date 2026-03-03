/**
 * Offline Queue Replay Trigger
 *
 * Listens to NetworkDetection state changes and automatically replays queued requests
 * when connectivity is restored.
 */

import { logger } from "@/lib/utils/logger";
import { RequestManager } from "@/system/API/request-manager";
import { NetworkDetection, type NetworkStatus } from "@/system/Network";

let statusChangeUnsubscribe: (() => void) | null = null;

/**
 * Initialize network listener for automatic offline queue replay
 * Should be called during app bootstrap (in AppKernelProvider or similar)
 */
export async function initializeOfflineQueueReplay(): Promise<void> {
  try {
    // Subscribe to network status changes
    statusChangeUnsubscribe = NetworkDetection.subscribe(
      (status: NetworkStatus) => {
        handleNetworkStatusChange(status);
      },
    );

    logger.category('api').info("Offline queue replay listener initialized");
  } catch (error) {
    logger.category('api').error("Failed to initialize offline queue replay listener", error);
  }
}

/**
 * Cleanup network listener
 * Should be called during app shutdown
 */
export function cleanupOfflineQueueReplay(): void {
  if (statusChangeUnsubscribe) {
    statusChangeUnsubscribe();
    statusChangeUnsubscribe = null;
    logger.category('api').debug("Offline queue replay listener cleaned up");
  }
}

/**
 * Handle network status changes and trigger replay when appropriate
 */
async function handleNetworkStatusChange(status: NetworkStatus): Promise<void> {
  // Trigger replay when connectivity is restored (GOOD quality)
  if (status.connectionQuality === "good") {
    logger.category('api').info("Network restored, flushing offline queue", {
      isOnline: status.isOnline,
      connectionQuality: status.connectionQuality,
    });

    try {
      await RequestManager.flushOfflineQueue();
    } catch (error) {
      logger.category('api').error("Error flushing offline queue on reconnect", error);
    }
  } else if (status.connectionQuality === "offline") {
    logger.category('api').debug("Network offline, pausing queue replay", {
      connectionQuality: status.connectionQuality,
    });
  }
}
