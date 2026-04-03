/**
 * Phase: Feature Flags (NON-CRITICAL, SERVICE SETUP ONLY)
 *
 * Runs after AUTH, before READY. Sets up feature flags service infrastructure
 * so flags are available before the first app render.
 *
 * ─── Bootstrap vs Sign-In ────────────────────────────────────────────────────
 * This phase handles SERVICE SETUP only (no userId, no server fetch):
 *   fresh  → trust cache (seedManagerFromCache)
 *   stale  → load hardcoded defaults (safety net — sign-in will override)
 *   dead   → load hardcoded defaults (safety net — sign-in will override)
 *   none   → load hardcoded defaults (first launch)
 *
 * User-specific server fetch + all sync data (entitlements, overrides, rollouts,
 * cohorts, memberships) happens at sign-in via:
 *   lib/jobs/core/sync/feature-flags-sync-job.ts
 *
 * ─── Sub-phase files (cache loaders only) ────────────────────────────────────
 *   feature-flags/entitlements.ts  — entitlement cache load
 *   feature-flags/overrides.ts     — flag + entitlement override cache load
 *   feature-flags/rollouts.ts      — rollout config cache load
 *   feature-flags/cohorts.ts       — cohort, assignment, membership cache load
 *   bootstrap-helpers.ts           — loadHardcodedFlags, loadAllCompanionCaches, seedManagerFromCache
 *
 * Depends on: STORAGE (cache read/write), SERVICES (DB provider check)
 * Used by: system/Kernel/app-kernel.ts (wired into PHASE_SEQUENCE)
 */

import { isDevelopment } from "@/config";
import { validateFlagDependencies } from "@/lib/feature-flags/server-sync/evaluation";
import { subscribeToRealtimeUpdates } from "@/lib/feature-flags/server-sync/realtime";
import { notifySubscribers } from "@/lib/feature-flags/server-sync/state";
import { logger } from "@/lib/utils/logger";
import { loadHardcodedFlags, seedManagerFromCache } from "./bootstrap-helpers";

// ==========================================
// Exported: Bootstrap Phase Entry Point
// ==========================================

/**
 * Execute the FEATURE_FLAGS kernel phase.
 *
 * SERVICE SETUP ONLY — no userId, no server fetch.
 * Loads cached flags (if fresh) or hardcoded defaults (if stale/dead/none).
 *
 * User-specific server fetch + all sync data (entitlements, overrides, rollouts,
 * cohorts, memberships) happens at sign-in via lib/jobs/core/sync/feature-flags-sync-job.
 *
 * Non-critical: any unhandled failure falls back to hardcoded config defaults
 * and does not block appReady.
 */
export async function featureFlagsPhase(signal: AbortSignal): Promise<void> {
  try {
    if (signal.aborted) return;
    const [{ FeatureFlagsManager }, { getDatabaseProvider }] = await Promise.all([
      import("@/lib/feature-flags/server-sync/orchestrator"),
      import("@/system/Services"),
    ]);

    // ─── Set up state (no userId at bootstrap) ────────────────────
    // userId is set at sign-in by feature-flags-sync-job

    // ─── No-DB / dev path ───────────────────────────────────────────
    if (!getDatabaseProvider().isConfigured()) {
      logger.category("bootstrap").debug("Database not configured — using hardcoded feature flags");
      loadHardcodedFlags(FeatureFlagsManager.state);
      FeatureFlagsManager.state.bootstrapped = true;
      notifySubscribers(FeatureFlagsManager.state);
      return;
    }

    // ─── Evaluate snapshot freshness ────────────────────────────────
    const { evaluateSnapshotFreshness } = await import(
      "@/pure-algo-immutables"
    );
    const freshness = await evaluateSnapshotFreshness();
    const state = FeatureFlagsManager.state;

    logger.category("bootstrap").debug(`Feature flags: freshness=${freshness}`);

    // ─── Load flags based on freshness (no server fetch) ────────────
    //   fresh       → trust cache (don't override)
    //   stale/dead  → hardcoded safety net (sign-in will override with server data)
    //   none        → hardcoded defaults (first launch)
    if (freshness === "fresh") {
      const seeded = await seedManagerFromCache();
      if (!seeded) {
        logger.category("bootstrap").debug(
          "Fresh snapshot expected but cache read failed — using hardcoded fallback",
        );
        loadHardcodedFlags(state);
        state.bootstrapped = true;
        notifySubscribers(state);
      } else {
        logger.category("bootstrap").debug("Feature flags: using fresh cached snapshot");
        state.bootstrapped = true;
        notifySubscribers(state);
      }
    } else {
      loadHardcodedFlags(state);
      state.bootstrapped = true;
      notifySubscribers(state);
      logger.category("bootstrap").info(
        `Feature flags: loaded hardcoded defaults (freshness=${freshness}, sign-in will refresh)`,
        { flagCount: state.currentFlags.size },
      );
    }

    // ─── Clock integrity check ──────────────────────────────────────
    const { verifyDeviceClock: kernelClockCheck } = await import(
      "@/system/Kernel/clock-integrity"
    );
    const clockValid = await kernelClockCheck();
    if (!clockValid) {
      logger.category("bootstrap").warn(
        "Device clock validation failed — premium features may be restricted",
      );
    }

    // ─── Realtime subscriptions + validation ─────────────────────────
    if (!isDevelopment()) {
      await subscribeToRealtimeUpdates(state);
    }
    validateFlagDependencies(state);

    logger.category("bootstrap").info("Feature flags phase complete (service initialized)", {
      flagCount: state.currentFlags.size,
      freshness,
    });

  } catch (error) {
    const { reportPremiumFault } = await import(
      "@/system/Degrade/handlers/fault-handlers"
    );
    const errorMsg = (error as Error).message;
    logger.category("bootstrap").warn("Feature flags phase failed — using hardcoded fallback", {
      error: errorMsg,
    });
    // Mark premium features as degraded via centralized handler
    reportPremiumFault(`Feature flags initialization failed: ${errorMsg}`);
    try {
      const { FeatureFlagsManager } = await import(
        "@/lib/feature-flags/server-sync/orchestrator"
      );
      loadHardcodedFlags(FeatureFlagsManager.state);
      FeatureFlagsManager.state.bootstrapped = true;
    } catch { /* Nothing more we can do */ }
  }
}
