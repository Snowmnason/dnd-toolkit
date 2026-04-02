/**
 * Phase 2: Network Phase (NON-CRITICAL)
 * 
 * Responsibility: Initialize network detection and monitoring
 * Called by: system/Kernel/app-kernel.ts
 * 
 * Timing: ~100-200ms, max 1000ms (defined in app-kernel)
 * Critical: NO — app works offline; defaults to online if detection fails
 * Failure mode: Logged as warning; network assumed online
 * 
 * Does:
 * 1. Initialize NetworkDetection state machine
 * 2. Check initial network status (online/offline, connection type)
 * 3. Start health check intervals for network recovery detection
 * 4. Subscribe to network changes
 * 
 * What initializes:
 * - Network status detection (uses platform APIs)
 * - Health check interval (5 minutes default)
 * - Network telemetry system
 *
 * NOTE: Non-critical; app is fully functional offline
 */

/**
 * Execute network phase
 * 
 * Initializes network detection and telemetry monitoring.
 * Network subscription and status tracking are handled by the orchestrator (app-kernel).
 * Network failures don't block bootstrap.
 */
export async function networkPhase(): Promise<void> {
  try {
    const { NetworkDetection } = await import("@/system/Network");
    const { logger } = await import("@/lib/utils");

    // Initialize network detection state machine
    await NetworkDetection.initialize();

    const initialStatus = NetworkDetection.getStatus();
    logger
      .category("bootstrap")
      .debug(
        `Network detection initialized: online=${initialStatus.isOnline}, type=${initialStatus.type}`,
      );

    // Initialize network telemetry (non-critical)
    try {
      const { initializeNetworkTelemetry } = await import(
        "@/lib/kernel/kernel-manager"
      );
      await initializeNetworkTelemetry();
      logger.category("bootstrap").debug("Network telemetry initialized");
    } catch (error) {
      logger
        .category("bootstrap")
        .warn("Network telemetry initialization failed (non-critical)", {
          error: (error as Error).message,
        });
    }
  } catch (error) {
    const { logger } = await import("@/lib/utils");
    const { reportConnectivityBootstrapFault } = await import(
      "@/system/Degrade/handlers/fault-handlers"
    );
    const errorMsg = (error as Error).message;
    logger
      .category("bootstrap")
      .warn("Network detection failed (non-critical)", {
        error: errorMsg,
      });
    // Mark connectivity as degraded via centralized handler
    reportConnectivityBootstrapFault(`Network detection failed: ${errorMsg}`);
    // Network failure is non-critical — app works offline
  }
}
