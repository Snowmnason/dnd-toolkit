/**
 * Feature Flags Sub-Phase: Rollouts (Cache Loader)
 *
 * Loads rollout configuration from persisted storage into state.
 * Used by bootstrap-helpers for cache-seeded startup.
 *
 * Server processing lives in lib/jobs/core/sync/feature-flags-sync-job.ts.
 */

import type { ServerSyncState } from "@/lib/feature-flags/server-sync/state";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import type { CachedRolloutConfig } from "@/type-definitions/featureFlagTypes";

export async function loadCachedRollouts(state: ServerSyncState): Promise<void> {
  try {
    const cached = await StorageManager.get<Record<string, CachedRolloutConfig>>(
      `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
    );
    if (cached) {
      state.cachedRollouts = new Map(Object.entries(cached));
      logger.category("feature_flags").debug("Loaded cached rollout config", {
        count: state.cachedRollouts.size,
      });
    }
  } catch (error) {
    logger.category("feature_flags").warn("Failed to load cached rollouts", error);
  }
}
