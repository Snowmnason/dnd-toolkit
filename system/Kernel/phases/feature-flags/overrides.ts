/**
 * Feature Flags Sub-Phase: Overrides (Cache Loaders)
 *
 * Loads flag and entitlement overrides from persisted storage into state.
 * Used by bootstrap-helpers for cache-seeded startup.
 *
 * Server processing lives in lib/jobs/core/sync/feature-flags-sync-job.ts.
 */

import type { FeatureFlagOverrideRow } from "@/lib/database/feature-flag-overrides";
import {
    ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX,
    OVERRIDE_CACHE_KEY_PREFIX,
    type ServerSyncState,
} from "@/lib/feature-flags/server-sync/state";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import type { EdgeEntitlementOverrideRow } from "@/type-definitions/featureFlagTypes";

export async function loadCachedRemoteOverrides(state: ServerSyncState): Promise<void> {
  if (!state.userId) return;
  try {
    const cached = await StorageManager.get<Record<string, FeatureFlagOverrideRow>>(
      `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${state.userId}`,
    );
    if (cached) {
      state.remoteOverrides = new Map(Object.entries(cached));
      logger.category("feature_flags").debug("Loaded cached remote overrides", {
        count: state.remoteOverrides.size,
      });
    }
  } catch (error) {
    logger.category("feature_flags").warn("Failed to load cached remote overrides", error);
  }
}

export async function loadCachedRemoteEntitlementOverrides(state: ServerSyncState): Promise<void> {
  if (!state.userId) return;
  try {
    const cached = await StorageManager.get<Record<string, EdgeEntitlementOverrideRow>>(
      `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX}${state.userId}`,
    );
    if (cached) {
      state.remoteEntitlementOverrides = new Map(Object.entries(cached));
      logger.category("feature_flags").debug(
        "Loaded cached remote entitlement overrides",
        { count: state.remoteEntitlementOverrides.size },
      );
    }
  } catch (error) {
    logger.category("feature_flags").warn(
      "Failed to load cached remote entitlement overrides",
      error,
    );
  }
}


