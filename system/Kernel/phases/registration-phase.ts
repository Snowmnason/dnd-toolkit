/**
 * Phase 8: Registration Phase (NON-CRITICAL)
 *
 * Responsibility: Register all job handlers and activate all subscriptions
 * Called by: system/Kernel/app-kernel.ts
 *
 * Timing: ~30-100ms (handler registration + subscription activation)
 * Critical: NO — app can run without handlers/subscriptions, but background jobs won't execute
 * Failure mode: Individual failures logged as warnings; does not block app startup
 *
 * Iterates two explicit registries:
 * 1. CORE_JOBS (lib/jobs/registry.ts) — registers job handlers with the queue
 * 2. SUBSCRIPTIONS (lib/subscriptions/registry.ts) — activates long-lived listeners
 *
 * Must run:
 * - AFTER featureFlags-phase (jobs/subscriptions may depend on feature flags)
 * - AFTER jobSetup-phase (queue infrastructure must be initialized)
 * - BEFORE appReady (all handlers must be registered before UI triggers jobs)
 *
 * NOTE: Job queue infrastructure is initialized in job-setup-phase.
 *       This phase only registers handlers and activates subscriptions.
 *
 * Track C: Capability-driven failure tracking
 * - Tracks failures with required capability for future retry logic
 * - Builds failuresSummary for safe mode display
 * - Returns RegistrationResult with all registrations/failures
 */

import { logger } from "@/lib/utils";
import { DegradeCapability } from "@/type-definitions/degrade";
import type { RegistrationFailure, RegistrationResult } from "@/type-definitions/registration";

/**
 * Map job/subscription names to their required capabilities
 */
function getRequiredCapability(itemName: string): DegradeCapability {
  switch (itemName) {
    case "sync-orchestrator":
      return DegradeCapability.CONNECTIVITY;
    case "network-recovery-retry":
      return DegradeCapability.CONNECTIVITY;
    case "feature-flags-refresh":
      return DegradeCapability.CONNECTIVITY;
    case "storage-health-check":
      return DegradeCapability.STORAGE;
    case "analytics-network-integration":
      return DegradeCapability.CONNECTIVITY;
    case "network-recovery-subscription":
      return DegradeCapability.CONNECTIVITY;
    default:
      return DegradeCapability.CONNECTIVITY;
  }
}

/**
 * Check if a subscription/job is recoverable on capability recovery
 */
function isRecoverable(itemName: string): boolean {
  const nonRecoverable = [
    "network-recovery-subscription",
    "sync-recovery-subscription",
    "job-recovery-subscription",
    "service-health-subscription",
  ];
  return !nonRecoverable.includes(itemName);
}

/**
 * Convert internal names to human-readable feature names
 */
function humanReadableName(itemName: string): string {
  switch (itemName) {
    case "sync-orchestrator":
      return "Auto-save";
    case "network-recovery-retry":
      return "Network Recovery";
    case "feature-flags-refresh":
      return "Feature Updates";
    case "storage-health-check":
      return "Storage Check";
    case "analytics-network-integration":
      return "Analytics";
    case "network-recovery-subscription":
      return "Connection Monitor";
    default:
      return itemName;
  }
}

/**
 * Build human-readable summary of failures grouped by capability
 */
function buildFailuresSummary(failed: RegistrationFailure[]): string {
  if (failed.length === 0) return "";

  const grouped = new Map<string, string[]>();

  for (const item of failed) {
    const key = item.requiredCapability;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(humanReadableName(item.item));
  }

  const summaries: string[] = [];
  for (const [capability, items] of grouped) {
    summaries.push(`${items.join(", ")} (requires ${capability})`);
  }

  return summaries.join(" | ");
}

/**
 * Execute registration phase
 *
 * Registers all job handlers from the explicit registry, then activates
 * all subscriptions. Each entry is independent — failures are logged
 * but don't block other registrations or app startup.
 *
 * Returns a RegistrationResult tracking all registered, skipped, and failed items
 * with capability information for future retry logic.
 */
export async function registrationPhase(): Promise<RegistrationResult> {
  try {
    const { initializeConnectivityHandler, appDegrade } = await import("@/system/Degrade");
    const { registerAllSystemResponses } = await import("@/system/Degrade/responses/system-responses");
    const { registerAllLibResponses } = await import("@/lib/error/degrade/lib-responses");
    const { registerDisplayCallbacks } = await import("@/lib/error/degrade/degrade-manager");
    const { setSafeMode } = await import("@/lib/kernel");
    const { createSafeModeState, SafeModeReason } = await import("@/lib/error");
    const { showDegradeToast } = await import("@/lib/utils/toast-queue");
    const { reportBackgroundJobsFault } = await import("@/system/Degrade/handlers/fault-handlers");
    const { registerCrashCallback } = await import("@/system/Degrade/handlers/crash-handlers");
    const { CORE_JOBS } = await import("@/lib/jobs/registry");
    const { SUBSCRIPTIONS } = await import("@/lib/subscriptions/registry");
    const { getJobQueue } = await import("@/system/Jobs/background-job-queue");

    // Initialize connectivity handler (always-listening subscription)
    initializeConnectivityHandler();
    logger.category("bootstrap").debug("Connectivity handler initialized");

    // Register system-level degradation responses (infrastructure: stop processes, pause queues)
    registerAllSystemResponses(appDegrade);
    logger.category("bootstrap").debug("System degradation responses registered");

    // Register UI display callbacks for degradation events
    registerDisplayCallbacks({
      showSafeMode: (capability, reason) => {
        try {
          // Map capability to appropriate SafeModeReason
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
          // Fallback if safe mode creation fails
          logger
            .category("bootstrap")
            .error("Failed to enter safe mode", { error, capability, reason });
        }
      },
      showToast: (options) => {
        try {
          showDegradeToast(options);
        } catch (error) {
          logger
            .category("bootstrap")
            .error("Failed to show toast", { error, options });
        }
      },
    });
    logger.category("bootstrap").debug("Display callbacks registered");

    // Register crash callback — bridges crash-handlers (system/) → safe mode (lib/)
    // 'safe-mode': trigger SafeModeScreen
    // 'error-boundary': no-op here — the phase re-throws, AppErrorBoundary catches it
    // 'continue': no-op — flag is set on appDegrade, app proceeds with degradation
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
          logger.category("bootstrap").error("Crash callback failed to enter safe mode", {
            error,
            capability: notification.capability,
            reason: notification.reason,
          });
        }
      }
      // 'error-boundary' and 'continue' are intentionally no-ops here
    });
    logger.category("bootstrap").debug("Crash callback registered");

    // Register lib-level degradation responses (UI decisions: feature gating, banners)
    registerAllLibResponses();
    logger.category("bootstrap").debug("Lib degradation responses registered");

    const queue = getJobQueue();

    const result: RegistrationResult = {
      success: true,
      registered: [],
      skipped: [],
      failed: [],
    };

    // Register all job handlers (ALWAYS TRY, never skip)
    for (const job of CORE_JOBS) {
      try {
        await job.register(queue);
        result.registered.push(job.name);
        logger.category("bootstrap").debug(`Job registered: ${job.name}`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        const requiredCapability = getRequiredCapability(job.name);

        result.failed.push({
          item: job.name,
          error: errorMsg,
          requiredCapability,
          recoverable: isRecoverable(job.name),
        });

        logger.category("bootstrap").warn(`Job registration failed: ${job.name}`, {
          error: errorMsg,
          requiredCapability,
        });
        reportBackgroundJobsFault(`Job handler registration failed: ${job.name}`);
      }
    }

    logger.category("bootstrap").info(
      `✅ Job handlers registered (${result.registered.filter(n => CORE_JOBS.find(j => j.name === n)).length}/${CORE_JOBS.length})`,
    );

    // Activate all subscriptions (ALWAYS TRY, never skip)
    for (const sub of SUBSCRIPTIONS) {
      try {
        await sub.activate();
        result.registered.push(sub.name);
        logger.category("bootstrap").debug(`Subscription activated: ${sub.name}`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        const requiredCapability = getRequiredCapability(sub.name);

        // Special handling: recovery subscriptions are critical
        if (sub.name.includes("recovery")) {
          logger.category("bootstrap").error(
            `CRITICAL: Recovery subscription failed: ${sub.name}`,
            { error: errorMsg },
          );
          result.success = false;
        }

        result.failed.push({
          item: sub.name,
          error: errorMsg,
          requiredCapability,
          recoverable: isRecoverable(sub.name),
        });

        logger.category("bootstrap").warn(`Subscription activation failed: ${sub.name}`, {
          error: errorMsg,
          requiredCapability,
        });
        reportBackgroundJobsFault(`Subscription activation failed: ${sub.name}`);
      }
    }

    logger.category("bootstrap").info(
      `✅ Subscriptions activated (${result.registered.filter(n => SUBSCRIPTIONS.find(s => s.name === n)).length}/${SUBSCRIPTIONS.length})`,
    );

    // Build summary for safe mode screen display
    if (result.failed.length > 0) {
      result.failuresSummary = buildFailuresSummary(result.failed);
      logger.category("bootstrap").warn(`Registration failures: ${result.failuresSummary}`);
    }

    logger.category("bootstrap").info(
      `Registration complete: ${result.registered.length} registered, ${result.failed.length} failed`,
    );

    return result;
  } catch (error) {
    const { reportBackgroundJobsFault } = await import("@/system/Degrade/handlers/fault-handlers");
    const errorMsg = (error as Error).message;
    logger.category("bootstrap").error("Registration phase error", {
      error: errorMsg,
    });
    reportBackgroundJobsFault(`Registration phase failed: ${errorMsg}`);

    // Return failed result even on catastrophic error
    return {
      success: false,
      registered: [],
      skipped: [],
      failed: [
        {
          item: "registration-phase",
          error: errorMsg,
          requiredCapability: DegradeCapability.CONNECTIVITY,
          recoverable: false,
        },
      ],
      failuresSummary: "Registration phase failed catastrophically",
    };
  }
}

