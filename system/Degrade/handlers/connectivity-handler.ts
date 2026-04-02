/**
 * Connectivity Degradation Handler
 *
 * ALWAYS-LISTENING subscription. Wires NetworkDetection status changes
 * to the appDegrade CONNECTIVITY capability.
 *
 * Lifecycle: initialized during kernel bootstrap (after network phase),
 * stays subscribed for the full app lifetime — network can flip at any time.
 * Cleaned up via appDegrade.clear() → registered cleanup fires.
 *
 * Pattern: Subscribe → call appDegrade.set() on each status change.
 * Logic lives here, not scattered across phases.
 */

import type { NetworkStatus } from '@/system/Network';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import { DegradeCapability } from '@/type-definitions/degrade';
import { appDegrade } from '../app-degrade';

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
 * with appDegrade so destroy() handles it.
 */
export function initializeConnectivityHandler(): void {
  // Set initial state from current network status before subscribing
  const initial = NetworkDetection.getStatus();
  applyNetworkStatus(initial);

  // Subscribe for all future changes
  const unsubscribe = NetworkDetection.subscribe((status: NetworkStatus) => {
    applyNetworkStatus(status);
  });

  // Register cleanup with degrade manager — fires on appDegrade.clear()
  appDegrade.registerHandlerCleanup(HANDLER_NAME, unsubscribe);
}

/**
 * Map NetworkStatus → appDegrade.set() for CONNECTIVITY.
 * Separated for reuse by both initial state and subscription callback.
 */
function applyNetworkStatus(status: NetworkStatus): void {
  const isOffline = !status.isOnline || status.connectionQuality === ConnectionQuality.OFFLINE;

  appDegrade.set(DegradeCapability.CONNECTIVITY, !isOffline, {
    source: SOURCE,
    reason: isOffline
      ? `offline (type=${status.type}, quality=${status.connectionQuality})`
      : `online (type=${status.type}, quality=${status.connectionQuality})`,
  });
}
