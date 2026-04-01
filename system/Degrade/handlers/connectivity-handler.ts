/**
 * Connectivity Degradation Handler
 *
 * ALWAYS-LISTENING subscription. Wires NetworkDetection status changes
 * to the degradeManager CONNECTIVITY capability.
 *
 * Lifecycle: initialized during kernel bootstrap (after network phase),
 * stays subscribed for the full app lifetime — network can flip at any time.
 * Cleaned up via degradeManager.clear() → registered cleanup fires.
 *
 * Pattern: Subscribe → call degradeManager.set() on each status change.
 * Logic lives here, not scattered across phases.
 */

import type { NetworkStatus } from '@/system/Network';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import { degradeManager } from '../degrade-manager';
import { DegradeCapability } from '../types';

const HANDLER_NAME = 'connectivity';
const SOURCE = 'network-detection';

/**
 * Initialize the connectivity degradation handler.
 *
 * Subscribes to NetworkDetection status changes and updates
 * the CONNECTIVITY capability flag accordingly.
 *
 * - OFFLINE quality → degrade (false)
 * - Any other quality → capable (true)
 *
 * Call once during bootstrap. Cleanup is registered automatically
 * with degradeManager so destroy() handles it.
 */
export function initializeConnectivityHandler(): void {
  // Set initial state from current network status before subscribing
  const initial = NetworkDetection.getStatus();
  applyNetworkStatus(initial);

  // Subscribe for all future changes
  const unsubscribe = NetworkDetection.subscribe((status: NetworkStatus) => {
    applyNetworkStatus(status);
  });

  // Register cleanup with degrade manager — fires on degradeManager.clear()
  degradeManager.registerHandlerCleanup(HANDLER_NAME, unsubscribe);
}

/**
 * Map NetworkStatus → degradeManager.set() for CONNECTIVITY.
 * Separated for reuse by both initial state and subscription callback.
 */
function applyNetworkStatus(status: NetworkStatus): void {
  const isOffline = !status.isOnline || status.connectionQuality === ConnectionQuality.OFFLINE;

  degradeManager.set(DegradeCapability.CONNECTIVITY, !isOffline, {
    source: SOURCE,
    reason: isOffline
      ? `offline (type=${status.type}, quality=${status.connectionQuality})`
      : `online (type=${status.type}, quality=${status.connectionQuality})`,
  });
}
