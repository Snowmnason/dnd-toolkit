/**
 * Feature Flags Sub-Phase: Cohorts (Cache Loaders)
 *
 * Loads cohort, cohort assignment, and user cohort membership data
 * from persisted storage into state.
 * Used by bootstrap-helpers for cache-seeded startup.
 *
 * Server processing lives in lib/jobs/core/sync/feature-flags-sync-job.ts.
 */

import type { ServerSyncState } from "@/lib/feature-flags/server-sync/state";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import type {
  CachedCohort,
  CachedUserCohortMembership,
} from "@/type-definitions/featureFlagTypes";

export async function loadCachedCohorts(state: ServerSyncState): Promise<void> {
  try {
    const cached = await StorageManager.get<Record<string, CachedCohort>>(
      `${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`,
    );
    if (cached) {
      state.cachedCohorts = new Map(Object.entries(cached));
      logger.category("feature_flags").debug("Loaded cached cohorts", {
        count: state.cachedCohorts.size,
      });
    }
  } catch (error) {
    logger.category("feature_flags").warn("Failed to load cached cohorts", error);
  }
}

export async function loadCachedCohortAssignments(state: ServerSyncState): Promise<void> {
  try {
    const cached = await StorageManager.get<Record<string, string[]>>(
      `${STORAGE_KEYS.FEATURE_FLAGS}:cohort_assignments`,
    );
    if (cached) {
      state.cachedCohortAssignments = new Map(
        Object.entries(cached).map(([flagName, slugs]) => [flagName, new Set(slugs)]),
      );
      logger.category("feature_flags").debug("Loaded cached cohort assignments", {
        flags: state.cachedCohortAssignments.size,
      });
    }
  } catch (error) {
    logger.category("feature_flags").warn("Failed to load cached cohort assignments", error);
  }
}

export async function loadCachedUserCohortMemberships(state: ServerSyncState): Promise<void> {
  if (!state.userId) return;
  try {
    const cached = await StorageManager.get<CachedUserCohortMembership[]>(
      `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${state.userId}`,
    );
    if (cached && Array.isArray(cached)) {
      state.cachedUserCohortMemberships = cached.map((m) => {
        if (m.cohort_slug) return m;
        if (m.cohort_id && state.cachedCohorts.size > 0) {
          for (const [slug, cohort] of state.cachedCohorts.entries()) {
            if (cohort.id === m.cohort_id) return { ...m, cohort_slug: slug };
          }
        }
        return m;
      });
      logger.category("feature_flags").debug("Loaded cached user cohort memberships", {
        count: state.cachedUserCohortMemberships.length,
      });
    }
  } catch (error) {
    logger.category("feature_flags").warn(
      "Failed to load cached user cohort memberships",
      error,
    );
  }
}


