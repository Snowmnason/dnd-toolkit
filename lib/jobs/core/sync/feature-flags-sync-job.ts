/**
 * Feature Flags Sync Job
 *
 * Runs after user successfully logs in (via sign-in-system or re-auth).
 * Comprehensive refresh of ALL user-specific feature flags data:
 * - Flags
 * - Entitlements
 * - Overrides (user-specific)
 * - Rollouts
 * - Cohorts
 * - Cohort assignments & memberships
 *
 * Bootstrap sets up the service with hardcoded/cached flags (no userId, no server fetch).
 * THIS JOB syncs all user-specific data with the authenticated userId.
 *
 * Freshness-aware:
 *   fresh  → skip (bootstrap already loaded good cache data)
 *   stale  → fetch from server (override hardcoded defaults)
 *   dead   → fetch from server (override hardcoded defaults)
 *   none   → fetch from server (first-time user)
 *
 * @module lib/jobs/core/sync/feature-flags-sync-job
 */

import { AuthStateManager } from '@/lib/auth/auth-state';
import type { FeatureFlagOverrideRow } from '@/lib/database/feature-flag-overrides';
import {
    ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX,
    OVERRIDE_CACHE_KEY_PREFIX,
    type ServerSyncState,
} from '@/lib/feature-flags/server-sync/state';
import { StorageManager } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import { STORAGE_KEYS } from '@/maps';
import { loadHardcodedFlags } from '@/system/Kernel/phases/bootstrap-helpers';
import {
    loadCachedCohortAssignments,
    loadCachedCohorts,
    loadCachedUserCohortMemberships,
} from '@/system/Kernel/phases/feature-flags/cohorts';
import { loadCachedEntitlements } from '@/system/Kernel/phases/feature-flags/entitlements';
import {
    loadCachedRemoteEntitlementOverrides,
    loadCachedRemoteOverrides,
} from '@/system/Kernel/phases/feature-flags/overrides';
import { loadCachedRollouts } from '@/system/Kernel/phases/feature-flags/rollouts';
import type {
    CachedCohort,
    CachedEntitlement,
    CachedRolloutConfig,
    CachedUserCohortMembership,
    EdgeEntitlementOverrideRow,
    FeatureFlagState,
    GetFeatureFlagsResponse,
} from '@/type-definitions/featureFlagTypes';

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureFlagsSyncResult {
  success: boolean;
  flagCount: number;
  source: 'server' | 'cache' | 'hardcoded' | 'skipped';
  errors: { phase: string; message: string; error?: Error }[];
}

// ============================================================================
// HELPERS
// ============================================================================

function logSettledErrors(
  results: PromiseSettledResult<void>[],
  labels: string[],
): void {
  results.forEach((result, idx) => {
    if (result.status === 'rejected') {
      // eslint-disable-next-line security/detect-object-injection -- safe: idx is from forEach callback
      const label = labels[idx] ?? `index-${idx}`;
      logger.category('feature_flags').warn(
        `Sync sub-phase "${label}" rejected unexpectedly`,
        result.reason,
      );
    }
  });
}

/**
 * Build reverse lookup map: cohort ID → slug
 * Enables O(1) slug resolution instead of O(n*m) scanning in memberships/assignments
 */
function buildCohortIdToSlugMap(state: ServerSyncState): Map<string, string> {
  const map = new Map<string, string>();
  for (const [slug, cohort] of state.cachedCohorts.entries()) {
    if (cohort.id) {
      map.set(cohort.id, slug);
    }
  }
  return map;
}

// ============================================================================
// SERVER DATA PROCESSORS
// ============================================================================

// --- Entitlements ---

async function processEntitlements(
  state: ServerSyncState,
  allEntitlements: CachedEntitlement[] | undefined | null,
): Promise<void> {
  if (state.userId && allEntitlements && allEntitlements.length > 0) {
    try {
      state.cachedEntitlements = new Map(allEntitlements.map((e) => [e.key, e]));
      await StorageManager.set(
        `${STORAGE_KEYS.ENTITLEMENTS}:${state.userId}`,
        Object.fromEntries(state.cachedEntitlements),
      );
      logger.category('feature_flags').debug('Synced entitlements', {
        count: state.cachedEntitlements.size,
      });
    } catch (error) {
      logger.category('feature_flags').warn('Failed to process entitlements', error);
      await loadCachedEntitlements(state);
    }
  } else if (allEntitlements && allEntitlements.length > 0) {
    state.cachedEntitlements = new Map(allEntitlements.map((e) => [e.key, e]));
    logger.category('feature_flags').warn(
      'Loaded entitlements (in-memory only, userId unavailable)',
      { count: state.cachedEntitlements.size },
    );
  }
}

// --- Overrides ---

async function processOverrides(
  state: ServerSyncState,
  allOverrides: FeatureFlagOverrideRow[] | undefined | null,
): Promise<void> {
  if (!state.userId || !allOverrides || allOverrides.length === 0) return;

  try {
    const flagOverrides = allOverrides.filter((o) => o.target_type === 'flag');
    state.remoteOverrides = new Map(flagOverrides.map((o) => [o.target_name, o]));

    const entitlementOverrides = allOverrides.filter(
      (o) => o.target_type === 'entitlement',
    ) as EdgeEntitlementOverrideRow[];
    state.remoteEntitlementOverrides = new Map(
      entitlementOverrides.map((o) => [o.target_name, o]),
    );

    await StorageManager.set(
      `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${state.userId}`,
      Object.fromEntries(state.remoteOverrides),
    );
    await StorageManager.set(
      `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX}${state.userId}`,
      Object.fromEntries(state.remoteEntitlementOverrides),
    );

    logger.category('feature_flags').debug('Synced remote flag overrides', {
      count: state.remoteOverrides.size,
    });
    logger.category('feature_flags').debug('Synced remote entitlement overrides', {
      count: state.remoteEntitlementOverrides.size,
    });
  } catch (error) {
    logger.category('feature_flags').warn('Failed to process flag overrides', error);
    await loadCachedRemoteOverrides(state);
    await loadCachedRemoteEntitlementOverrides(state);
  }
}

// --- Rollouts ---

async function processRollouts(
  state: ServerSyncState,
  allRollouts: Record<string, CachedRolloutConfig> | undefined | null,
): Promise<void> {
  if (allRollouts && Object.keys(allRollouts).length > 0) {
    try {
      state.cachedRollouts = new Map(Object.entries(allRollouts));
      await StorageManager.set(
        `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
        Object.fromEntries(state.cachedRollouts),
      );
      logger.category('feature_flags').debug('Synced rollout config', {
        count: state.cachedRollouts.size,
      });
    } catch (error) {
      logger.category('feature_flags').warn('Failed to process rollout config', error);
      await loadCachedRollouts(state);
    }
  } else if (allRollouts !== undefined && allRollouts !== null) {
    state.cachedRollouts = new Map();
    try {
      await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`);
      logger.category('feature_flags').debug('Cleared rollout config (server disabled)');
    } catch (error) {
      logger.category('feature_flags').warn('Failed to clear cached rollouts', error);
      state.cachedRollouts = new Map();
    }
  } else {
    await loadCachedRollouts(state);
  }
}

// --- Cohorts ---

async function processCohorts(
  state: ServerSyncState,
  allCohorts: CachedCohort[] | undefined | null,
): Promise<void> {
  if (allCohorts && allCohorts.length > 0) {
    try {
      state.cachedCohorts = new Map(allCohorts.map((c) => [c.slug, c]));
      await StorageManager.set(
        `${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`,
        Object.fromEntries(state.cachedCohorts),
      );
      logger.category('feature_flags').debug('Synced cohorts', {
        count: state.cachedCohorts.size,
      });
    } catch (error) {
      logger.category('feature_flags').warn('Failed to process cohorts', error);
      await loadCachedCohorts(state);
    }
  } else if (allCohorts !== undefined && allCohorts !== null) {
    state.cachedCohorts = new Map();
    try {
      await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`);
      logger.category('feature_flags').debug('Cleared cohorts (server disabled)');
    } catch (error) {
      logger.category('feature_flags').warn('Failed to clear cached cohorts', error);
      state.cachedCohorts = new Map();
    }
  } else {
    await loadCachedCohorts(state);
  }
}

// --- Cohort Memberships ---

async function processUserCohortMemberships(
  state: ServerSyncState,
  allUserCohortMemberships: CachedUserCohortMembership[] | undefined | null,
  cohortIdToSlug: Map<string, string>,
): Promise<void> {
  if (state.userId && allUserCohortMemberships && allUserCohortMemberships.length > 0) {
    try {
      state.cachedUserCohortMemberships = allUserCohortMemberships.map((m) => {
        if (m.cohort_slug) return m;
        if (m.cohort_id) {
          const slug = cohortIdToSlug.get(m.cohort_id);
          if (slug) {
            logger.category('feature_flags').debug(
              `Enriched membership with cohort_slug: ${m.cohort_id} → ${slug}`,
            );
            return { ...m, cohort_slug: slug };
          }
        }
        return m;
      });

      await StorageManager.set(
        `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${state.userId}`,
        state.cachedUserCohortMemberships,
      );
      logger.category('feature_flags').debug('Synced user cohort memberships', {
        count: state.cachedUserCohortMemberships.length,
      });
    } catch (error) {
      logger.category('feature_flags').warn(
        'Failed to process user cohort memberships',
        error,
      );
      await loadCachedUserCohortMemberships(state);
    }
  } else if (
    state.userId &&
    allUserCohortMemberships !== undefined &&
    allUserCohortMemberships !== null
  ) {
    state.cachedUserCohortMemberships = [];
    try {
      await StorageManager.remove(
        `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${state.userId}`,
      );
      logger.category('feature_flags').debug('Cleared user cohort memberships (user in no cohorts)');
    } catch (error) {
      logger.category('feature_flags').warn(
        'Failed to clear cached user cohort memberships',
        error,
      );
      state.cachedUserCohortMemberships = [];
    }
  } else {
    await loadCachedUserCohortMemberships(state);
  }
}

// --- Cohort Assignments ---

async function processCohortAssignments(
  state: ServerSyncState,
  allCohortAssignments: { flag_name: string; cohort_id?: string; cohort_slug?: string }[] | undefined | null,
  cohortIdToSlug: Map<string, string>,
): Promise<void> {
  if (allCohortAssignments && allCohortAssignments.length > 0) {
    try {
      const assignmentMap = new Map<string, Set<string>>();
      for (const assignment of allCohortAssignments) {
        let cohortSlug = assignment.cohort_slug;
        if (!cohortSlug && assignment.cohort_id) {
          cohortSlug = cohortIdToSlug.get(assignment.cohort_id);
        }
        if (!cohortSlug) {
          logger.category('feature_flags').warn(
            `Unable to resolve cohort slug for assignment ${assignment.flag_name} → ${assignment.cohort_id}`,
          );
          continue;
        }
        if (!assignmentMap.has(assignment.flag_name)) {
          assignmentMap.set(assignment.flag_name, new Set());
        }
        assignmentMap.get(assignment.flag_name)!.add(cohortSlug);
      }

      state.cachedCohortAssignments = assignmentMap;

      const persistedAssignments: Record<string, string[]> = {};
      for (const [flagName, cohortSlugs] of assignmentMap.entries()) {
        /* eslint-disable-next-line security/detect-object-injection -- safe: flagName is produced internally */
        persistedAssignments[flagName] = Array.from(cohortSlugs);
      }
      await StorageManager.set(
        `${STORAGE_KEYS.FEATURE_FLAGS}:cohort_assignments`,
        persistedAssignments,
      );
      logger.category('feature_flags').debug('Synced cohort flag assignments', {
        flagsWithAssignments: assignmentMap.size,
        totalAssignments: allCohortAssignments.length,
      });
    } catch (error) {
      logger.category('feature_flags').warn('Failed to process cohort assignments', error);
      await loadCachedCohortAssignments(state);
    }
  } else if (allCohortAssignments !== undefined && allCohortAssignments !== null) {
    state.cachedCohortAssignments = new Map();
    try {
      await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:cohort_assignments`);
      logger.category('feature_flags').debug('Cleared cohort assignments (disabled)');
    } catch (error) {
      logger.category('feature_flags').warn(
        'Failed to clear cached cohort assignments',
        error,
      );
      state.cachedCohortAssignments = new Map();
    }
  } else {
    await loadCachedCohortAssignments(state);
  }
}

// --- Flags ---

function processFlags(
  state: ServerSyncState,
  serverFlags: GetFeatureFlagsResponse['flags'] | undefined | null,
): void {
  const newFlags = new Map<string, FeatureFlagState>();

  if (serverFlags && serverFlags.length > 0) {
    for (const flag of serverFlags) {
      newFlags.set(flag.flag_name, {
        enabled: flag.enabled,
        kind: flag.kind,
        description: flag.description,
        depends_on: flag.depends_on || null,
        condition_logic: flag.condition_logic || null,
        metadata: flag.metadata || null,
        source: 'server',
      });
    }
  } else {
    loadHardcodedFlags(state);
    for (const [name, flagState] of state.currentFlags) {
      newFlags.set(name, flagState);
    }
  }

  state.currentFlags = newFlags;
}

// ============================================================================
// DATA FETCH + ORCHESTRATION
// ============================================================================

/**
 * Fetch all user-specific data from edge function, then process every sub-phase.
 * Throws on unrecoverable failure — caller decides fallback strategy.
 * Individual sub-phases handle their own partial failures (graceful degradation).
 */
async function fetchAndProcessAllUserData(state: ServerSyncState): Promise<void> {
  const { getDatabase, invokeEdgeFunction } = await import(
    '@/middleware/services/database-service'
  );
  if (!getDatabase().isConfigured()) throw new Error('Database not configured');

  logger.category('feature_flags').debug('Invoking get_feature_flags Edge Function');
  const data = await invokeEdgeFunction<GetFeatureFlagsResponse>('get_feature_flags');
  if (!data) throw new Error('Edge Function did not return data');

  logger.category('feature_flags').debug('Edge Function response received', {
    flagCount: data.flags?.length ?? 0,
    entitlementCount: data.entitlements?.length ?? 0,
    overrideCount: data.overrides?.length ?? 0,
  });

  const {
    flags: serverFlags,
    overrides: allOverrides,
    entitlements: allEntitlements,
    rollouts: allRollouts,
    cohorts: allCohorts,
    cohort_assignments: allCohortAssignments,
    user_cohort_memberships: allUserCohortMemberships,
  } = data;

  // ─── Batch 1 (parallel): Independent sub-phases ─────────────────
  const batch1 = await Promise.allSettled([
    processEntitlements(state, allEntitlements),
    processOverrides(state, allOverrides),
    processRollouts(state, allRollouts),
    processCohorts(state, allCohorts),
  ]);
  logSettledErrors(batch1, ['entitlements', 'overrides', 'rollouts', 'cohorts']);

  // ─── Build reverse lookup: cohort ID → slug (O(1) resolution for next batch) ──
  const cohortIdToSlug = buildCohortIdToSlugMap(state);

  // ─── Batch 2 (parallel): Cohort-dependent sub-phases ────────────
  const batch2 = await Promise.allSettled([
    processUserCohortMemberships(state, allUserCohortMemberships, cohortIdToSlug),
    processCohortAssignments(state, allCohortAssignments, cohortIdToSlug),
  ]);
  logSettledErrors(batch2, ['memberships', 'assignments']);

  // ─── Final: Process flags (synchronous) ─────────────────────────
  processFlags(state, serverFlags);

  // ─── Persist root snapshot ──────────────────────────────────────
  await StorageManager.set(STORAGE_KEYS.FEATURE_FLAGS, {
    flags: Object.fromEntries(state.currentFlags),
    fetchedAt: Date.now(),
  });
}

// ============================================================================
// SYNC JOB
// ============================================================================

/**
 * Comprehensive sync of user-specific feature flags data.
 * Called after successful login to sync ALL features, entitlements, overrides, etc.
 *
 * Freshness logic:
 *   fresh → skip (cache is good, don't override)
 *   stale/dead/none → fetch from server (override whatever bootstrap loaded)
 */
export async function performFeatureFlagSync(): Promise<FeatureFlagsSyncResult> {
  const errors: { phase: string; message: string; error?: Error }[] = [];

  try {
    // ─── Get current authenticated user ─────────────────────────────
    let userId: string | undefined;
    try {
      userId = (await AuthStateManager.getUserId()) ?? undefined;
    } catch (error) {
      logger.category('feature_flags').warn('Failed to get userId for feature flag sync', error);
      errors.push({
        phase: 'auth',
        message: 'Could not retrieve userId',
        error: error instanceof Error ? error : undefined,
      });
    }

    // ─── Set authenticated userId for flag evaluation ──────────────
    const { FeatureFlagsManager } = await import(
      '@/lib/feature-flags/server-sync/orchestrator'
    );
    FeatureFlagsManager.state.userId = userId || null;
    logger.category('feature_flags').debug('Feature flags userId set', { userId });

    // ─── Check freshness — skip if data is still fresh ──────────────
    const { evaluateSnapshotFreshness } = await import(
      '@/pure-algo-immutables'
    );
    const freshness = await evaluateSnapshotFreshness();

    if (freshness === 'fresh') {
      logger.category('feature_flags').info(
        'Feature flags sync skipped — cache is fresh',
        { flagCount: FeatureFlagsManager.state.currentFlags.size },
      );
      return {
        success: true,
        flagCount: FeatureFlagsManager.state.currentFlags.size,
        source: 'skipped',
        errors,
      };
    }

    // ─── Stale/dead/none: fetch from server ─────────────────────────
    logger.category('feature_flags').info(
      `Feature flags sync: freshness=${freshness}, fetching all user-specific data`,
    );

    const { notifySubscribers } = await import(
      '@/lib/feature-flags/server-sync/state'
    );

    try {
      await fetchAndProcessAllUserData(FeatureFlagsManager.state);
      logger.category('feature_flags').info('Feature flags synced at login', {
        flagCount: FeatureFlagsManager.state.currentFlags.size,
        overrideCount: FeatureFlagsManager.state.remoteOverrides.size,
      });
      notifySubscribers(FeatureFlagsManager.state);
      return {
        success: true,
        flagCount: FeatureFlagsManager.state.currentFlags.size,
        source: 'server',
        errors,
      };
    } catch (fetchError) {
      logger.category('feature_flags').warn('Feature flags sync failed, keeping cache', fetchError);
      return {
        success: false,
        flagCount: FeatureFlagsManager.state.currentFlags.size,
        source: 'cache',
        errors: [
          {
            phase: 'fetch',
            message: 'Failed to fetch user-specific feature flags from server',
            error: fetchError instanceof Error ? fetchError : undefined,
          },
          ...errors,
        ],
      };
    }
  } catch (error) {
    logger.category('feature_flags').error('Feature flags sync job failed', error);
    return {
      success: false,
      flagCount: 0,
      source: 'hardcoded',
      errors: [
        {
          phase: 'sync',
          message: 'Feature flags sync error',
          error: error instanceof Error ? error : undefined,
        },
        ...errors,
      ],
    };
  }
}
