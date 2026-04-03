/**
 * Phase 8: Registration Phase (NON-CRITICAL)
 *
 * Responsibility: Register all job handlers and subscriptions quickly (LEAN VERSION)
 * Called by: system/Kernel/app-kernel.ts
 *
 * Timing: ~500ms (minimal - only critical imports, degrade system deferred)
 * Critical: NO — app can run without handlers/subscriptions, but background jobs won't execute
 * Failure mode: Individual failures logged as warnings; does not block app startup
 *
 * Iterates two explicit registries:
 * 1. CORE_JOBS (lib/jobs/registry.ts) — registers job handlers with the queue
 * 2. SUBSCRIPTIONS (lib/subscriptions/registry.ts) — registers long-lived listeners
 *
 * Must run:
 * - AFTER featureFlags-phase (jobs/subscriptions may depend on feature flags)
 * - AFTER jobSetup-phase (queue infrastructure must be initialized)
 * - BEFORE appReady (all handlers must be registered before UI triggers jobs)
 *
 * NOTE: Degrade system setup is DEFERRED to background job for performance
 *       This avoids importing 12+ modules during registration (~4.2s saved)
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
    case "feature-flags-refresh":
      return DegradeCapability.CONNECTIVITY;
    case "storage-health-check":
      return DegradeCapability.STORAGE;
    case "internal_deferred_init":
      // Meta-job for deferred initialization; depends on what it defers
      // Default to CONNECTIVITY as most deferred tasks are network/state-related
      return DegradeCapability.CONNECTIVITY;
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
    case "feature-flags-refresh":
      return "Feature Updates";
    case "storage-health-check":
      return "Storage Check";
    case "internal_deferred_init":
      return "Deferred Initialization";
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
 * Execute registration phase (LEAN VERSION - degrade system deferred)
 *
 * Registers all job handlers and subscriptions quickly without loading the entire
 * degrade system. Degrade system setup is queued as a background job for performance.
 *
 * Returns a RegistrationResult tracking all registered and failed items.
 */
export async function registrationPhase(signal: AbortSignal): Promise<RegistrationResult> {
  const result: RegistrationResult = {
    success: true,
    registered: [],
    skipped: [],
    failed: [],
  };

  if (signal.aborted) return { ...result, success: false, failuresSummary: 'Phase cancelled' };

  try {
    // CRITICAL IMPORTS ONLY
    // Degrade system (~4.2s import overhead) is deferred to background job
    const { CORE_JOBS } = await import("@/lib/jobs/registry");
    const { SUBSCRIPTIONS } = await import("@/lib/subscriptions/registry");
    const { getJobQueue } = await import("@/system/Jobs/background-job-queue");

    const queue = getJobQueue();

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
        });
      }
    }

    logger.category("bootstrap").info(
      `✅ Job handlers registered (${result.registered.filter(n => CORE_JOBS.find(j => j.name === n)).length}/${CORE_JOBS.length})`,
    );

    // Register all subscriptions (ALWAYS TRY, never skip)
    for (const sub of SUBSCRIPTIONS) {
      try {
        await sub.activate();
        result.registered.push(sub.name);
        logger.category("bootstrap").debug(`Subscription registered: ${sub.name}`);
      } catch (error) {
        const errorMsg = (error as Error).message;
        const requiredCapability = getRequiredCapability(sub.name);

        result.failed.push({
          item: sub.name,
          error: errorMsg,
          requiredCapability,
          recoverable: isRecoverable(sub.name),
        });

        logger.category("bootstrap").warn(`Subscription registration failed: ${sub.name}`, {
          error: errorMsg,
        });
      }
    }

    logger.category("bootstrap").info(
      `✅ Subscriptions registered (${result.registered.filter(n => SUBSCRIPTIONS.find(s => s.name === n)).length}/${SUBSCRIPTIONS.length})`,
    );

    // DEFERRED: Set up degrade system in background job
    // This avoids importing and initializing 12 degrade modules during registration
    await queue.enqueue({
      type: "internal_deferred_init",
      payload: { target: "degrade-system-setup" },
      runAt: Date.now() + 150, // Run after network-recovery init
      maxRetries: 1,
      idempotencyKey: "degrade-system-setup-once",
    });

    // Build summary for safe mode screen display
    if (result.failed.length > 0) {
      result.failuresSummary = buildFailuresSummary(result.failed);
      logger.category("bootstrap").warn(`Registration failures: ${result.failuresSummary}`);
      result.success = false;
    }

    logger.category("bootstrap").info(
      `Registration complete: ${result.registered.length} registered, ${result.failed.length} failed`,
    );

    return result;
  } catch (error) {
    const errorMsg = (error as Error).message;
    logger.category("bootstrap").error("Registration phase error", { error: errorMsg });

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

