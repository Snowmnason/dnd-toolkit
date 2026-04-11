/**
 * Job Handler Registry
 *
 * Explicit registry of all background job handlers for the app.
 * Each entry defines a job name and a lazy loader that returns the handler function.
 *
 * Used by registration-phase.ts to register all handlers with the job queue
 * after infrastructure (job-setup) and domain phases (auth, feature flags) are complete.
 *
 * To add a new job:
 * 1. Create the job in lib/jobs/core/
 * 2. Add an entry here with name + loader
 * 3. Done — registration phase auto-discovers it
 */

import type { BackgroundJobQueue } from "@/system/Jobs/background-job-queue";

/**
 * A registrable job handler entry.
 * - name: unique job type identifier (matches what's used in queue.enqueue())
 * - register: async function that registers the handler with the queue
 */
export interface JobRegistryEntry {
  name: string;
  register: (queue: BackgroundJobQueue) => Promise<void>;
}

/**
 * All core job handlers.
 * Order doesn't matter — all are registered during the same phase.
 * 
 * IMPORTANT: Non-critical jobs (e.g., network-recovery-retry) are registered
 * asynchronously via internal_deferred_init to avoid blocking registration phase.
 */
export const CORE_JOBS: JobRegistryEntry[] = [
  {
    name: "sync-orchestrator",
    register: async (queue) => {
      const { createSyncJobHandler } = await import("@/lib/jobs");
      const syncHandler = createSyncJobHandler();
      queue.registerHandler(
        syncHandler.name,
        async (payload: any, _context: any) => {
          await syncHandler.execute(payload);
        },
      );
    },
  },
  {
    name: "storage-health-check",
    register: async (queue) => {
      const { registerStorageHealthCheckJob } = await import(
        "@/middleware/storage/helpers/storage-health-monitor"
      );
      // Register handler and enqueue first health check to run in background
      // (does NOT block registration — check runs asynchronously after appReady)
      await registerStorageHealthCheckJob(queue);
    },
  },
  {
    name: "feature-flags-refresh",
    register: async (queue) => {
      const { refreshSubscription } = await import("@/lib/premium");
      const { logger } = await import("@/lib/utils");
      queue.registerHandler("feature_flags_refresh", async () => {
        await refreshSubscription();
        logger.category("jobs").info("feature_flags_refresh job completed");
        return { updatedAt: Date.now() };
      });
    },
  },
  {
    name: "internal_deferred_init",
    register: async (queue) => {
      const { logger } = await import("@/lib/utils");
      
      // Universal handler for deferred initialization tasks
      // Allows jobs to defer expensive setup without blocking registration phase
      queue.registerHandler("internal_deferred_init", async (payload: any) => {
        const target = payload.target || "unknown";
        
        try {
          if (target === "network-recovery-retry-full-init") {
            // COMPLETELY deferred: register handler + initialize
            const { NetworkRecoveryRetryJobManager, getNetworkRecoveryRetryHandler } = await import(
              "@/lib/jobs/core/network-recovery-retry-job"
            );
            const { NetworkStateManager } = await import(
              "@/system/Network/state-machine"
            );
            
            // Register the handler
            queue.registerHandler("network_recovery_retry", getNetworkRecoveryRetryHandler());
            
            // Initialize state machine hooks
            await NetworkRecoveryRetryJobManager.initialize(NetworkStateManager, queue);
            
            logger.category("bootstrap").info("Network recovery (full) initialized (deferred)");
          } else if (target === "degrade-system-setup") {
            // Degrade system setup deferred (saves ~4.2s during registration)
            const { initializeConnectivityHandler, appDegrade } = await import("@/system/Degrade");
            const { registerAllSystemResponses } = await import("@/system/Degrade/responses/system-responses");
            const { registerAllLibResponses } = await import("@/lib/error/degrade/lib-responses");
            const { registerDisplayCallbacks } = await import("@/lib/error/degrade/degrade-manager");
            const { setSafeMode } = await import("@/lib/kernel");
            const { createSafeModeState, SafeModeReason } = await import("@/lib/error");
            const { showDegradeToast } = await import("@/lib/utils/toast-queue");
            const { registerCrashCallback } = await import("@/system/Degrade/handlers/crash-handlers");

            // Initialize connectivity handler (always-listening subscription)
            initializeConnectivityHandler();
            logger.category("bootstrap").debug("Connectivity handler initialized (deferred)");

            // Register system-level degradation responses
            registerAllSystemResponses(appDegrade);
            logger.category("bootstrap").debug("System degradation responses registered (deferred)");

            // Register UI display callbacks for degradation events
            registerDisplayCallbacks({
              showSafeMode: (capability, reason) => {
                try {
                  let safeModeReason = SafeModeReason.UNKNOWN;
                  switch (capability) {
                    case "database":
                      safeModeReason = SafeModeReason.STORAGE_UNREADABLE;
                      break;
                    case "auth":
                      safeModeReason = SafeModeReason.AUTH_INVALID;
                      break;
                    case "storage":
                      safeModeReason = SafeModeReason.STORAGE_CORRUPTED;
                      break;
                    case "sync":
                      safeModeReason = SafeModeReason.NETWORK_SYNC_FAILURES;
                      break;
                    case "connectivity":
                      safeModeReason = SafeModeReason.NETWORK_UNAVAILABLE;
                      break;
                    default:
                      safeModeReason = SafeModeReason.UNKNOWN;
                  }
                  const safeModeState = createSafeModeState(safeModeReason, {
                    details: `${capability}: ${reason}`,
                  });
                  setSafeMode(safeModeState);
                } catch (error) {
                  logger.category("bootstrap").error("Failed to enter safe mode (deferred)", { error, capability, reason });
                }
              },
              showToast: (options) => {
                try {
                  showDegradeToast(options);
                } catch (error) {
                  logger.category("bootstrap").error("Failed to show toast (deferred)", { error, options });
                }
              },
            });
            logger.category("bootstrap").debug("Display callbacks registered (deferred)");

            // Register crash callback
            registerCrashCallback((notification) => {
              if (notification.suggestedAction === 'safe-mode') {
                try {
                  let safeModeReason = SafeModeReason.UNKNOWN;
                  switch (notification.capability) {
                    case "database":
                      safeModeReason = SafeModeReason.STORAGE_UNREADABLE;
                      break;
                    case "auth":
                      safeModeReason = SafeModeReason.AUTH_INVALID;
                      break;
                    case "storage":
                      safeModeReason = SafeModeReason.STORAGE_CORRUPTED;
                      break;
                    case "sync":
                      safeModeReason = SafeModeReason.NETWORK_SYNC_FAILURES;
                      break;
                    case "connectivity":
                      safeModeReason = SafeModeReason.NETWORK_UNAVAILABLE;
                      break;
                    default:
                      safeModeReason = SafeModeReason.UNKNOWN;
                  }
                  const safeModeState = createSafeModeState(safeModeReason, {
                    details: `${notification.capability}: ${notification.reason}`,
                  });
                  setSafeMode(safeModeState);
                } catch (error) {
                  logger.category("bootstrap").error("Crash callback failed to enter safe mode", { error, capability: notification.capability, reason: notification.reason });
                }
              }
            });
            logger.category("bootstrap").debug("Crash callback registered (deferred)");

            // Register lib-level degradation responses
            registerAllLibResponses();
            logger.category("bootstrap").info("Degrade system fully initialized (deferred)");
          } else {
            logger.category("bootstrap").warn(`Unknown deferred init target: ${target}`);
          }
        } catch (error) {
          logger.category("bootstrap").error(`Deferred init failed for ${target}`, { error: String(error) });
          throw error; // Let job queue handle retry
        }
        
        return { completedAt: Date.now(), target };
      });
      
      // Enqueue the network recovery full initialization to run after appReady
      // This defers BOTH registration and initialization
      await queue.enqueue({
        type: "internal_deferred_init",
        payload: { target: "network-recovery-retry-full-init" },
        runAt: Date.now() + 100,
        maxRetries: 1,
        idempotencyKey: "network-recovery-init-complete-deferred",
      });
    },
  },
];
