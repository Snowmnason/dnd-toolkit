/**
 * Server Sync: Bootstrap & Persistence
 *
 * Manages the full startup lifecycle: fetching server flags via Edge Function,
 * processing all data categories (flags, entitlements, overrides, rollouts,
 * cohorts, assignments, memberships), and cascading fallback to cached/hardcoded values.
 * Also handles cache cleanup on logout via clearCache().
 */
import { getAppConfig, isDevelopment } from "@/config";
import type { FeatureFlagOverrideRow } from "@/lib/database/feature-flag-overrides";
import { getDatabase, invokeEdgeFunction } from "@/lib/middleware/services/database-service";
import { getAllSecureStorageKeys } from "@/lib/middleware/storage";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import type {
    CachedCohort,
    CachedEntitlement,
    CachedRolloutConfig,
    CachedUserCohortMembership,
    EdgeEntitlementOverrideRow,
    FeatureFlagState,
    GetFeatureFlagsResponse,
} from "@/type-definitions/featureFlagTypes";
import { validateFlagDependencies } from "./evaluation";
import { subscribeToRealtimeUpdates, unsubscribeFromAllChannels } from "./realtime";
import {
    ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX,
    notifySubscribers,
    OVERRIDE_CACHE_KEY_PREFIX,
    type ServerSyncState,
} from "./state";

// ==========================================
// Edge Function Wrapper
// ==========================================

async function invokeGetFeatureFlagsFunction(
  state: ServerSyncState,
): Promise<GetFeatureFlagsResponse | null> {
  try {
    logger.category("feature_flags").debug("Invoking get_feature_flags Edge Function");

    const response = await invokeEdgeFunction<GetFeatureFlagsResponse>("get_feature_flags");

    logger.category("feature_flags").debug("Edge Function response received", {
      flagCount: response?.flags?.length || 0,
      entitlementCount: response?.entitlements?.length || 0,
      overrideCount: response?.overrides?.length || 0,
    });

    return response;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.category("feature_flags").warn("Failed to invoke Edge Function", errorMsg);
    return null;
  }
}

// ==========================================
// Hardcoded Fallback
// ==========================================

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
// Cached Data Loaders
// ==========================================

async function loadCachedRemoteOverrides(state: ServerSyncState): Promise<void> {
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

async function loadCachedRemoteEntitlementOverrides(state: ServerSyncState): Promise<void> {
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

async function loadCachedEntitlements(state: ServerSyncState): Promise<void> {
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

async function loadCachedRollouts(state: ServerSyncState): Promise<void> {
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

async function loadCachedCohorts(state: ServerSyncState): Promise<void> {
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

async function loadCachedUserCohortMemberships(state: ServerSyncState): Promise<void> {
  if (!state.userId) return;
  try {
    const cached = await StorageManager.get<CachedUserCohortMembership[]>(
      `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${state.userId}`,
    );
    if (cached && Array.isArray(cached)) {
      // Enrich memberships with cohort_slug if missing (offline caching may omit it)
      state.cachedUserCohortMemberships = cached.map((m) => {
        if (m.cohort_slug) return m;
        if (m.cohort_id && state.cachedCohorts.size > 0) {
          for (const [slug, cohort] of state.cachedCohorts.entries()) {
            if (cohort.id === m.cohort_id) return { ...m, cohort_slug: slug };
          }
        }
        return m;
      });

      logger.category("feature_flags").warn("Loaded cached user cohort memberships", {
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

async function loadCachedCohortAssignments(state: ServerSyncState): Promise<void> {
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

// ==========================================
// Main Bootstrap
// ==========================================

export async function bootstrapFlags(state: ServerSyncState): Promise<void> {
  if (state.bootstrapped) {
    logger.category("feature_flags").debug("Already bootstrapped, skipping");
    return;
  }

  const isDev = isDevelopment();

  if (isDev) {
    logger.category("feature_flags").info("Development mode: using local config only");
    loadHardcodedFlags(state);
    state.bootstrapped = true;
    notifySubscribers(state);
    return;
  }

  logger.category("feature_flags").info("Bootstrapping feature flags from server");

  try {
    if (!getDatabase().isConfigured()) throw new Error("Database not configured");

    const data = await invokeGetFeatureFlagsFunction(state);
    if (!data) throw new Error("Edge Function did not return data");

    const {
      flags: serverFlags,
      overrides: allOverrides,
      entitlements: allEntitlements,
      rollouts: allRollouts,
      cohorts: allCohorts,
      cohort_assignments: allCohortAssignments,
      user_cohort_memberships: allUserCohortMemberships,
    } = data;

    // --- Entitlements ---
    if (state.userId && allEntitlements && allEntitlements.length > 0) {
      try {
        state.cachedEntitlements = new Map(allEntitlements.map((e) => [e.key, e]));
        await StorageManager.set(
          `${STORAGE_KEYS.ENTITLEMENTS}:${state.userId}`,
          Object.fromEntries(state.cachedEntitlements),
        );
        logger.category("feature_flags").debug("Cached entitlements", {
          count: state.cachedEntitlements.size,
        });
      } catch (error) {
        logger.category("feature_flags").warn("Failed to process entitlements", error);
        await loadCachedEntitlements(state);
      }
    } else if (allEntitlements && allEntitlements.length > 0) {
      state.cachedEntitlements = new Map(allEntitlements.map((e) => [e.key, e]));
      logger.category("feature_flags").warn(
        "Loaded entitlements (in-memory only, userId unavailable)",
        { count: state.cachedEntitlements.size },
      );
    }

    // --- Overrides ---
    if (state.userId && allOverrides && allOverrides.length > 0) {
      try {
        const flagOverrides = allOverrides.filter((o) => o.target_type === "flag");
        state.remoteOverrides = new Map(flagOverrides.map((o) => [o.target_name, o]));

        const entitlementOverrides = allOverrides.filter(
          (o) => o.target_type === "entitlement",
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

        logger.category("feature_flags").debug("Processed remote flag overrides", {
          count: state.remoteOverrides.size,
        });
        logger.category("feature_flags").warn("Processed remote entitlement overrides", {
          count: state.remoteEntitlementOverrides.size,
        });
      } catch (error) {
        logger.category("feature_flags").warn("Failed to process flag overrides", error);
        await loadCachedRemoteOverrides(state);
        await loadCachedRemoteEntitlementOverrides(state);
      }
    }

    // --- Rollouts ---
    if (allRollouts && Object.keys(allRollouts).length > 0) {
      try {
        state.cachedRollouts = new Map(Object.entries(allRollouts));
        await StorageManager.set(
          `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
          Object.fromEntries(state.cachedRollouts),
        );
        logger.category("feature_flags").debug("Cached rollout config", {
          count: state.cachedRollouts.size,
        });
      } catch (error) {
        logger.category("feature_flags").warn("Failed to process rollout config", error);
        await loadCachedRollouts(state);
      }
    } else if (allRollouts !== undefined && allRollouts !== null) {
      state.cachedRollouts = new Map();
      try {
        await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`);
        logger.category("feature_flags").debug("Cleared rollout config (server disabled)");
      } catch (error) {
        logger.category("feature_flags").warn("Failed to clear cached rollouts", error);
        state.cachedRollouts = new Map();
      }
    } else {
      await loadCachedRollouts(state);
    }

    // --- Cohorts ---
    if (allCohorts && allCohorts.length > 0) {
      try {
        state.cachedCohorts = new Map(allCohorts.map((c) => [c.slug, c]));
        await StorageManager.set(
          `${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`,
          Object.fromEntries(state.cachedCohorts),
        );
        logger.category("feature_flags").debug("Cached cohorts", {
          count: state.cachedCohorts.size,
        });
      } catch (error) {
        logger.category("feature_flags").warn("Failed to process cohorts", error);
        await loadCachedCohorts(state);
      }
    } else if (allCohorts !== undefined && allCohorts !== null) {
      state.cachedCohorts = new Map();
      try {
        await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`);
        logger.category("feature_flags").debug("Cleared cohorts (server disabled)");
      } catch (error) {
        logger.category("feature_flags").warn("Failed to clear cached cohorts", error);
        state.cachedCohorts = new Map();
      }
    } else {
      await loadCachedCohorts(state);
    }

    // --- User Cohort Memberships ---
    if (
      state.userId &&
      allUserCohortMemberships &&
      allUserCohortMemberships.length > 0
    ) {
      try {
        state.cachedUserCohortMemberships = allUserCohortMemberships.map((m) => {
          if (m.cohort_slug) return m;
          if (m.cohort_id) {
            for (const [slug, cohort] of state.cachedCohorts.entries()) {
              if (cohort.id === m.cohort_id) {
                logger.category("feature_flags").warn(
                  `Enriched membership with cohort_slug: ${m.cohort_id} → ${slug}`,
                );
                return { ...m, cohort_slug: slug };
              }
            }
          }
          return m;
        });

        await StorageManager.set(
          `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${state.userId}`,
          state.cachedUserCohortMemberships,
        );
        logger.category("feature_flags").warn("Cached user cohort memberships", {
          count: state.cachedUserCohortMemberships.length,
        });
      } catch (error) {
        logger.category("feature_flags").warn(
          "Failed to process user cohort memberships",
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
        logger.category("feature_flags").warn("Cleared user cohort memberships (user in no cohorts)");
      } catch (error) {
        logger.category("feature_flags").warn(
          "Failed to clear cached user cohort memberships",
          error,
        );
        state.cachedUserCohortMemberships = [];
      }
    } else {
      await loadCachedUserCohortMemberships(state);
    }

    // --- Cohort Assignments ---
    if (allCohortAssignments && allCohortAssignments.length > 0) {
      try {
        const assignmentMap = new Map<string, Set<string>>();
        for (const assignment of allCohortAssignments) {
          let cohortSlug = assignment.cohort_slug;
          if (!cohortSlug && assignment.cohort_id) {
            for (const [slug, cohort] of state.cachedCohorts.entries()) {
              if (cohort.id === assignment.cohort_id) {
                cohortSlug = slug;
                break;
              }
            }
          }
          if (!cohortSlug) {
            logger.category("feature_flags").warn(
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
        logger.category("feature_flags").debug("Cached cohort flag assignments", {
          flagsWithAssignments: assignmentMap.size,
          totalAssignments: allCohortAssignments.length,
        });
      } catch (error) {
        logger.category("feature_flags").warn("Failed to process cohort assignments", error);
        await loadCachedCohortAssignments(state);
      }
    } else if (allCohortAssignments !== undefined && allCohortAssignments !== null) {
      state.cachedCohortAssignments = new Map();
      try {
        await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:cohort_assignments`);
        logger.category("feature_flags").debug("Cleared cohort assignments (disabled)");
      } catch (error) {
        logger.category("feature_flags").warn(
          "Failed to clear cached cohort assignments",
          error,
        );
        state.cachedCohortAssignments = new Map();
      }
    } else {
      await loadCachedCohortAssignments(state);
    }

    // --- Flags ---
    const newFlags: Map<string, FeatureFlagState> = new Map();
    if (serverFlags && serverFlags.length > 0) {
      for (const flag of serverFlags) {
        newFlags.set(flag.flag_name, {
          enabled: flag.enabled,
          kind: flag.kind,
          description: flag.description,
          depends_on: flag.depends_on || null,
          condition_logic: flag.condition_logic || null,
          metadata: flag.metadata || null,
          source: "server",
        });
      }
    } else {
      loadHardcodedFlags(state);
      for (const [name, flagState] of state.currentFlags) {
        newFlags.set(name, flagState);
      }
    }

    state.currentFlags = newFlags;
    state.bootstrapped = true;

    await StorageManager.set(STORAGE_KEYS.FEATURE_FLAGS, {
      flags: Object.fromEntries(newFlags),
      fetchedAt: Date.now(),
    });

    logger.category("feature_flags").info("Bootstrapped successfully from server", {
      flagCount: newFlags.size,
      overrideCount: state.remoteOverrides.size,
    });

    notifySubscribers(state);
  } catch (error) {
    logger.category("feature_flags").warn("Server bootstrap failed, using fallback", error);

    try {
      const cached = await StorageManager.get<{
        flags: Record<string, FeatureFlagState>;
        fetchedAt: number;
      }>(STORAGE_KEYS.FEATURE_FLAGS);

      if (cached?.flags) {
        state.currentFlags = new Map(Object.entries(cached.flags));
        state.bootstrapped = true;
        await loadCachedRemoteOverrides(state);
        await loadCachedRemoteEntitlementOverrides(state);
        await loadCachedRollouts(state);
        logger.category("feature_flags").info("Loaded from last known state", {
          flagCount: state.currentFlags.size,
          overrideCount: state.remoteOverrides.size,
          age: Date.now() - cached.fetchedAt,
        });
        notifySubscribers(state);
        return;
      }
    } catch {
      logger.category("feature_flags").debug("No cached flags available");
    }

    loadHardcodedFlags(state);
    state.bootstrapped = true;
    logger.category("feature_flags").info("Using hardcoded fallback", {
      flagCount: state.currentFlags.size,
    });
    notifySubscribers(state);
  }

  // Setup Realtime subscriptions after bootstrap (production only)
  if (!isDev) {
    await subscribeToRealtimeUpdates(state);
  }

  validateFlagDependencies(state);
}

// ==========================================
// Cache Cleanup (Logout)
// ==========================================

export async function clearCache(state: ServerSyncState): Promise<void> {
  try {
    // Unsubscribe from all Realtime channels
    await unsubscribeFromAllChannels(state);

    await StorageManager.remove(STORAGE_KEYS.FEATURE_FLAGS);
    await StorageManager.remove(STORAGE_KEYS.CLOCK_INVALID);
    await StorageManager.remove("dnd:last_clock_check");
    await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`);

    try {
      await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`);
      await StorageManager.remove(`${STORAGE_KEYS.FEATURE_FLAGS}:cohort_assignments`);
    } catch (error) {
      logger.category("feature_flags").warn(
        "Failed to clear persisted cohorts or cohort assignments",
        error,
      );
    }

    if (state.userId) {
      await StorageManager.remove(`${STORAGE_KEYS.ENTITLEMENTS}:${state.userId}`);
      await StorageManager.remove(
        `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX}${state.userId}`,
      );
      await StorageManager.remove(
        `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${state.userId}`,
      );
      state.cachedUserCohortMemberships = [];
    }

    try {
      const allKeys = await getAllSecureStorageKeys();
      const overridePattern = `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}`;
      const keysToRemove = allKeys.filter((key: string) => key.startsWith(overridePattern));
      for (const key of keysToRemove) {
        await StorageManager.remove(key);
      }
      if (keysToRemove.length > 0) {
        logger.category("feature_flags").debug("Cleared override cache entries", {
          count: keysToRemove.length,
        });
      }
    } catch (error) {
      logger.category("feature_flags").warn("Failed to clear override cache", error);
    }

    logger.category("feature_flags").info(
      "Cleared all cached flags, entitlements, overrides, cohorts, and cohort assignments",
    );

    state.currentFlags = new Map();
    state.cachedCohorts = new Map();
    state.userOverrides.clear();
    state.remoteOverrides.clear();
    state.remoteEntitlementOverrides.clear();
    state.cachedEntitlements.clear();
    state.cachedRollouts.clear();
    state.bootstrapped = false;
  } catch (error) {
    logger.category("feature_flags").error("Failed to clear cache", error);
  }
}
