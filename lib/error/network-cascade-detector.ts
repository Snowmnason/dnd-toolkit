/**
 * Network Cascade Detector
 *
 * Tracks consecutive sync failures and determines when app should enter
 * DEGRADED safe mode due to network cascade (repeated sync failures).
 *
 * A "cascade" is when sync failures trigger other failures (e.g., failed sync
 * causes stale data, which causes UI errors, which cause more failures).
 *
 * This detector uses a simple threshold-based approach:
 * - Track consecutive sync failures
 * - After threshold (default 3), trigger DEGRADED safe mode
 * - Reset counter when sync succeeds OR when app exits safe mode
 *
 * The detector is automatically reset when:
 * 1. A sync succeeds (recordSuccess is called)
 * 2. App exits safe mode successfully (AppKernel.setSafeMode(null))
 *
 * This ensures that after recovery from a network cascade, the app has a clean
 * slate and can't easily re-trigger safe mode on the next few minor failures.
 *
 * ACTIVE INTEGRATION (Phase 4):
 * The detector is integrated with OnlineSyncManager (lib/offline/sync-manager.ts):
 * - recordFailure() called when sync completely fails
 * - recordSuccess() called when sync completes (even partially)
 * - Safe mode automatically triggered when cascade threshold exceeded
 * - Detector resets when app exits safe mode via AppKernel.setSafeMode(null)
 *
 * This provides automatic network cascade resilience without requiring app restart.
 */

import { logger } from "@/lib/utils/logger";
import { DEFAULT_SAFE_MODE_CONFIG } from "./safe-mode";

class NetworkCascadeDetectorService {
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private isInCascade = false;

  /**
   * Record a sync failure
   * Returns true if cascade should be triggered (threshold reached)
   */
  recordFailure(): boolean {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    logger.category("network").warn("Sync failure recorded", {
      consecutiveFailures: this.consecutiveFailures,
      threshold: DEFAULT_SAFE_MODE_CONFIG.syncFailureThreshold,
    });

    // Check if we've exceeded threshold
    if (
      this.consecutiveFailures >= DEFAULT_SAFE_MODE_CONFIG.syncFailureThreshold
    ) {
      if (!this.isInCascade) {
        this.isInCascade = true;
        logger
          .category("network")
          .error("Network cascade detected - exceeded failure threshold", {
            failures: this.consecutiveFailures,
            threshold: DEFAULT_SAFE_MODE_CONFIG.syncFailureThreshold,
          });
        return true; // Trigger safe mode
      }
    }

    return false;
  }

  /**
   * Record a successful sync
   * Resets the failure counter
   */
  recordSuccess(): void {
    if (this.consecutiveFailures > 0) {
      logger
        .category("network")
        .info("Sync success - resetting failure counter", {
          previousFailures: this.consecutiveFailures,
        });
    }

    this.consecutiveFailures = 0;
    this.isInCascade = false;
  }

  /**
   * Get current cascade state
   */
  isInNetworkCascade(): boolean {
    return this.isInCascade;
  }

  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Reset cascade detector
   * Useful for testing or manual recovery
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.isInCascade = false;
    logger.category("network").debug("Network cascade detector reset");
  }
}

export const NetworkCascadeDetector = new NetworkCascadeDetectorService();
