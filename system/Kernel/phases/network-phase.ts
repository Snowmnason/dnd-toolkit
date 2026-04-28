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
 * Non-blocking backend latency probe.
 *
 * Fires a lightweight HEAD request to the configured backend and logs the
 * round-trip time.  Useful for separating "slow network" from "slow code"
 * in bootstrap timing analysis.  Fire-and-forget — does NOT block the
 * network phase or any subsequent phase.
 */
function measureBackendLatency(): void {
  void (async () => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!url) return;

    const { logger } = await import("@/lib/utils");
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(`${url}/auth/v1/health`, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      logger
        .category("network")
        .info(`[network/ping] backend latency: ${Date.now() - start}ms`);
    } catch {
      clearTimeout(timeoutId);
      const ms = Date.now() - start;
      logger.category("network").warn(
        controller.signal.aborted
          ? `[network/ping] backend timeout (>${ms}ms)`
          : `[network/ping] backend unreachable: ${ms}ms`,
      );
    }
  })();
}

/**
 * Execute network phase
 * 
 * Initializes network detection and telemetry monitoring.
 * Network subscription and status tracking are handled by the orchestrator (app-kernel).
 * Network failures don't block bootstrap.
 */
export async function networkPhase(signal: AbortSignal): Promise<void> {
  try {
    if (signal.aborted) return;
    const { NetworkDetection } = await import("@/system/Network");
    const { logger } = await import("@/lib/utils");

    // Initialize network detection state machine
    await NetworkDetection.initialize();

    const initialStatus = NetworkDetection.getStatus();
    logger
      .category("bootstrap")
      .info(
        `Network detection initialized (online: ${initialStatus.isOnline}, quality: ${initialStatus.connectionQuality}) — firing latency probe`,
      );

    // Fire-and-forget: logs [network/ping] when result arrives, doesn't block bootstrap
    measureBackendLatency();

    // Initialize network telemetry — fire-and-forget (non-critical, heavy barrel import)
    // @/lib/kernel/kernel-manager is 1011 modules; awaiting it blocks the network phase
    // and causes the 1200ms timeout to fire. Telemetry only needs to be ready before the
    // first network-change event, not before the app is interactive.
    void (async () => {
      try {
        const { initializeNetworkTelemetry } = await import(
          "@/lib/kernel/kernel-manager"
        );
        await initializeNetworkTelemetry();
        logger.category("bootstrap").debug("Network telemetry initialized (deferred)");
      } catch (error) {
        logger
          .category("bootstrap")
          .warn("Network telemetry initialization failed (non-critical)", {
            error: (error as Error).message,
          });
      }
    })();
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
