/**
 * Feature Flags Sub-Phase: Entitlements (Cache Loader)
 *
 * Loads entitlements from persisted storage into state.
 * Used by bootstrap-helpers for cache-seeded startup.
 *
 * Server processing lives in lib/jobs/core/sync/feature-flags-sync-job.ts.
 */

import type { ServerSyncState } from "@/lib/feature-flags/server-sync/state";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import type { CachedEntitlement } from "@/type-definitions/featureFlagTypes";

export async function loadCachedEntitlements(state: ServerSyncState): Promise<void> {
  if (!state.userId) return;
  try {
    const cached = await StorageManager.get<Record<string, CachedEntitlement>>(
      `${STORAGE_KEYS.ENTITLEMENTS}:${state.userId}`,
    );
    if (cached) {
      state.cachedEntitlements = new Map(Object.entries(cached));
      logger.category("feature_flags").debug("Loaded cached entitlements", {
        count: state.cachedEntitlements.size,
      });
    }
  } catch (error) {
    logger.category("feature_flags").warn("Failed to load cached entitlements", error);
  }
}
