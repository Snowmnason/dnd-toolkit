/**
 * Phase 4: Services Phase (CRITICAL)
 * 
 * Responsibility: Register and initialize all system providers
 * Called by: system/Kernel/app-kernel.ts
 * 
 * Timing: ~50-150ms, max 500ms (defined in app-kernel)
 * Critical: YES — auth, error tracking, and analytics are required
 * Failure mode: Throws error; blocks app startup
 * 
 * Does:
 * 1. Call middleware service initialization
 * 2. Register auth provider (Supabase or mock)
 * 3. Register error tracker (console or Sentry)
 * 4. Register analytics exporter (HTTP or offline queue)
 * 5. Update kernel capabilities
 * 
 * What initializes:
 * - Auth provider (service detection, environment check)
 * - Error tracking system
 * - Analytics exporters
 * - Database provider (Supabase client)
 * - Middleware services (lazy-loaded on first use)
 *
 * NOTE: CRITICAL — must run before AUTH phase so AuthStateManager has registered provider
 */

/**
 * Execute services phase
 * 
 * Initializes all system providers (auth, error tracking, analytics).
 * Calls system-level services directly (no middleware during bootstrap).
 * These must be available before AUTH phase runs.
 * 
 * @param state - Mutable kernel state
 * @throws Error if service initialization fails (critical)
 */
export async function servicesPhase(signal: AbortSignal): Promise<void> {
  const { logger } = await import("@/lib/utils");

  if (signal.aborted) return;

  try {
    const { initializeServices } = await import("@/system/Services/service-initializer");
    const { getAllServiceStatuses } = await import("@/system/Services");
    const { syncServiceStatusesToDegradeManager } = await import(
      "@/system/Degrade/handlers/fault-handlers"
    );
    
    await initializeServices();
    // Auth strategies are registered within initializeServices by the middleware

    // Check service status after initialization
    const allStatusDetails = getAllServiceStatuses();

    // Log detailed status for each service
    Object.entries(allStatusDetails).forEach(([service, detail]) => {
      const icon = detail.status === 'ready' ? '✅' : 
                   detail.status === 'degraded' ? '⚠️' : '❌';
      const message = detail.message ? ` — ${detail.message}` : '';
      logger
        .category("bootstrap")
        .info(`  ${icon} ${service}: ${detail.status} (${detail.provider})${message}`);
    });

    // Sync all service statuses to degradeManager via centralized handler
    syncServiceStatusesToDegradeManager();

    logger
      .category("bootstrap")
      .info("✅ Services phase completed");
  } catch (error) {
    const { 
      reportDatabaseFault, 
      reportAuthFault,
      reportAnalyticsFault,
      reportErrorTrackingFault
    } = await import(
      "@/system/Degrade/handlers/fault-handlers"
    );
    const errorMsg = (error as Error).message;
    logger.category("bootstrap").error("[servicesPhase] ✗ Failed:", error);
    // Mark all services as degraded via centralized handlers
    reportDatabaseFault(`Services initialization failed: ${errorMsg}`);
    reportAuthFault(`Services initialization failed: ${errorMsg}`);
    reportAnalyticsFault(`Services initialization failed: ${errorMsg}`);
    reportErrorTrackingFault(`Services initialization failed: ${errorMsg}`);
    throw error;
  }
}
