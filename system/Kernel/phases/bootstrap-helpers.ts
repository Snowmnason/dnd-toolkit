/**
 * Kernel Phase Bootstrap Helpers
 *
 * Shared utilities used across kernel phase orchestration.
 * Currently serves the feature-flags phase, but kept at the phases/ level
 * so other phases can add helpers here in the future.
 *
 * Exports:
 *   loadHardcodedFlags       — populate state from local config (no network)
 *   loadAllCompanionCaches   — restore all companion snapshot caches from storage
 *   seedManagerFromCache     — seed FeatureFlagsManager from the persisted snapshot
 */

import { getAppConfig } from "@/config";
import type { ServerSyncState } from "@/lib/feature-flags/server-sync/state";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import type { FeatureFlagState } from "@/type-definitions/featureFlagTypes";
import {
    loadCachedCohortAssignments,
    loadCachedCohorts,
    loadCachedUserCohortMemberships,
} from "./feature-flags/cohorts";
import { loadCachedEntitlements } from "./feature-flags/entitlements";
import {
    loadCachedRemoteEntitlementOverrides,
    loadCachedRemoteOverrides,
} from "./feature-flags/overrides";
import { loadCachedRollouts } from "./feature-flags/rollouts";

// ==========================================
// Hardcoded Fallback
// ==========================================

/**
 * Populate state.currentFlags from local config (appsettings.json).
 * Used as the terminal fallback when no server data or snapshot is available.
 */
export function loadHardcodedFlags(state: ServerSyncState): void {
  const config = getAppConfig();
  const hardcodedFlags = config.featureFlags || {};

  const flags: Map<string, FeatureFlagState> = new Map();
  for (const [key, value] of Object.entries(hardcodedFlags)) {
    if (typeof value === "object" && value !== null && "enabled" in value) {
      const flagValue = value as Record<string, unknown>;
      flags.set(key, {
        enabled: !!flagValue.enabled,
        kind: flagValue.kind as string | undefined,
        description: flagValue.description as string | undefined,
        depends_on: (flagValue.dependsOn as string[] | null | undefined) || null,
        condition_logic:
          (flagValue.conditionLogic as Record<string, any> | null | undefined) || null,
        metadata: (flagValue.metadata as Record<string, any> | null | undefined) || null,
        source: "hardcoded",
      });
    }
  }

  state.currentFlags = flags;
}

// ==========================================
// Composite Cache Loader
// ==========================================

/**
 * Load all companion snapshot caches into state from persisted storage.
 *
 * Runs in two parallel batches:
 *   Batch 1: overrides, entitlements, rollouts, cohorts (independent)
 *   Batch 2: assignments, memberships (depend on cohorts from batch 1)
 *
 * Used during fallback scenarios (server unavailable, timeout) and by
 * seedManagerFromCache for fresh-snapshot startup.
 */
export async function loadAllCompanionCaches(state: ServerSyncState): Promise<void> {
  // Batch 1: Independent caches (including cohorts needed by batch 2)
  await Promise.allSettled([
    loadCachedRemoteOverrides(state),
    loadCachedRemoteEntitlementOverrides(state),
    loadCachedEntitlements(state),
    loadCachedRollouts(state),
    loadCachedCohorts(state),
  ]);

  // Batch 2: Cohort-dependent caches (need cohort slugs for enrichment)
  await Promise.allSettled([
    loadCachedCohortAssignments(state),
    loadCachedUserCohortMemberships(state),
  ]);
}

// ==========================================
// Cache Seed
// ==========================================

/**
 * Seed the FeatureFlagsManager from the persisted snapshot cache.
 * Used as startup fallback when remote bootstrap times out and the snapshot is stale.
 *
 * Loads flags plus all companion snapshot data (entitlements, overrides, rollouts,
 * cohorts, cohort assignments, memberships) so stale-cache startup behavior is
 * consistent with remote bootstrap semantics.
 *
 * Returns true if flags were successfully seeded, false on cache miss or error.
 */
export async function seedManagerFromCache(): Promise<boolean> {
  try {
    const { FeatureFlagsManager } = await import(
      "@/lib/feature-flags/server-sync/orchestrator"
    );

    const state = FeatureFlagsManager.state;
    const snapshot = await StorageManager.get<{
      flags: Record<string, FeatureFlagState>;
      fetchedAt: number;
    }>(STORAGE_KEYS.FEATURE_FLAGS);
    if (!snapshot?.flags) return false;

    state.currentFlags = new Map(Object.entries(snapshot.flags));
    state.bootstrapped = true;

    await loadAllCompanionCaches(state);

    return true;
  } catch {
    logger.category("bootstrap").debug("seedManagerFromCache: cache read failed");
    return false;
  }
}
