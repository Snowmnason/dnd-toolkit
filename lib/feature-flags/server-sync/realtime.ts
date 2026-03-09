/**
 * Server Sync: Realtime Subscriptions
 *
 * Manages Supabase Realtime channel subscriptions for live flag updates.
 * Subscribes to: feature_flags, entitlements, overrides, entitlement overrides,
 * rollouts, cohorts, and user cohort memberships.
 *
 * Each handler applies the change to in-memory state, persists to storage,
 * and notifies subscribers.
 */
import { getRealtimeProvider } from "@/lib/middleware/feature-flag/feature-flag-service";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";
import { STORAGE_KEYS } from "@/maps";
import type { CachedCohort, CachedEntitlement, CachedUserCohortMembership, FeatureFlagState } from "@/type-definitions/featureFlagTypes";
import { resolveCohortSlug } from "./evaluation";
import {
    normalizeEntitlementOverrideRow,
    normalizeFlagOverrideRow,
} from "./overrides";
import {
    ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX,
    notifySubscribers,
    OVERRIDE_CACHE_KEY_PREFIX,
    type ServerSyncState,
} from "./state";

// ==========================================
// Subscription Setup
// ==========================================

export async function unsubscribeFromAllChannels(state: ServerSyncState): Promise<void> {
  try {
    const { available, client } = getRealtimeProvider();
    if (!available || !client) {
      state.realtimeSubscriptions.clear();
      return;
    }
    for (const channel of state.realtimeSubscriptions.values()) {
      await client.removeChannel(channel);
    }
    state.realtimeSubscriptions.clear();
    logger.category("feature_flags").debug("Unsubscribed from all Realtime channels");
  } catch (error) {
    logger.category("feature_flags").debug("Failed to unsubscribe from Realtime", error);
  }
}

export async function subscribeToRealtimeUpdates(state: ServerSyncState): Promise<void> {
  const { available, client: realtimeClient } = getRealtimeProvider();
  if (!available || !realtimeClient || !state.userId) {
    logger.category("feature_flags").debug("Realtime subscriptions not available");
    return;
  }

  try {
    logger.category("feature_flags").info("Setting up Realtime subscriptions", { userId: state.userId });

    // Feature flags table (all users, all changes)
    const flagsChannel = realtimeClient
      .channel("feature_flags:feature_flags")
      .on(
        "postgres_changes",
        { event: "*", schema: "feature_flags", table: "feature_flags" },
        (payload: any) => handleFlagChange(state, payload),
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          logger.category("feature_flags").debug("Subscribed to feature_flags table");
        }
      });
    state.realtimeSubscriptions.set("feature_flags", flagsChannel);

    // Entitlements for this user
    const entitlementsChannel = realtimeClient
      .channel(`feature_flags:entitlements:user.eq.${state.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "feature_flags",
          table: "entitlements",
          filter: `user_id=eq.${state.userId}`,
        },
        (payload: any) => handleEntitlementChange(state, payload),
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          logger.category("feature_flags").debug("Subscribed to entitlements for user");
        }
      });
    state.realtimeSubscriptions.set("entitlements", entitlementsChannel);

    // Feature flag overrides for this user
    const overridesChannel = realtimeClient
      .channel(`feature_flags:feature_flag_overrides:user.eq.${state.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "feature_flags",
          table: "feature_flag_overrides",
          filter: `user_id=eq.${state.userId}`,
        },
        (payload: any) => handleOverrideChange(state, payload),
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          logger.category("feature_flags").debug("Subscribed to feature_flag_overrides for user");
        }
      });
    state.realtimeSubscriptions.set("overrides", overridesChannel);

    // Entitlement overrides for this user
    const entitlementOverridesChannel = realtimeClient
      .channel(`feature_flags:entitlements_overrides:user.eq.${state.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "feature_flags",
          table: "entitlements_overrides",
          filter: `user_id=eq.${state.userId}`,
        },
        (payload: any) => handleEntitlementOverrideChange(state, payload),
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          logger.category("feature_flags").debug("Subscribed to entitlements_overrides for user");
        }
      });
    state.realtimeSubscriptions.set("entitlements_overrides", entitlementOverridesChannel);

    // Rollouts (global)
    const rolloutsChannel = realtimeClient
      .channel("feature_flags:feature_flag_rollouts")
      .on(
        "postgres_changes",
        { event: "*", schema: "feature_flags", table: "feature_flag_rollouts" },
        (payload: any) => handleRolloutChange(state, payload),
      )
      .subscribe();
    state.realtimeSubscriptions.set("rollouts", rolloutsChannel);

    // Cohorts (global)
    const cohortsChannel = realtimeClient
      .channel("feature_flags:cohorts")
      .on(
        "postgres_changes",
        { event: "*", schema: "feature_flags", table: "cohorts" },
        (payload: any) => handleCohortChange(state, payload),
      )
      .subscribe();
    state.realtimeSubscriptions.set("cohorts", cohortsChannel);

    // User cohort memberships (user-scoped)
    const membershipsChannel = realtimeClient
      .channel(`feature_flags:user_cohort_memberships:user.eq.${state.userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "feature_flags",
          table: "user_cohort_memberships",
          filter: `user_id=eq.${state.userId}`,
        },
        (payload: any) => handleUserCohortMembershipChange(state, payload),
      )
      .subscribe();
    state.realtimeSubscriptions.set("user_cohort_memberships", membershipsChannel);

    logger.category("feature_flags").info("Realtime subscriptions established");
  } catch (error) {
    logger.category("feature_flags").warn("Failed to setup Realtime subscriptions", error);
  }
}

// ==========================================
// Change Handlers
// ==========================================

async function handleFlagChange(state: ServerSyncState, payload: any): Promise<void> {
  try {
    const { new: flagData, old: oldFlagData, eventType } = payload;
    const flag = flagData || oldFlagData;

    if (eventType === "DELETE") {
      if (flag?.flag_name) {
        state.currentFlags.delete(flag.flag_name);
        logger.category("feature_flags").debug(`Flag deleted:`, flag.flag_name);
        state.evaluationCache.invalidateFlag(flag.flag_name);
      }
    } else if (eventType === "INSERT" || eventType === "UPDATE") {
      if (flag?.flag_name) {
        state.currentFlags.set(flag.flag_name, {
          enabled: flag.enabled,
          depends_on: flag.depends_on ?? null,
          condition_logic: flag.condition_logic ?? null,
          metadata: flag.metadata ?? null,
          kind: flag.kind,
          description: flag.description,
          source: "server",
        } as FeatureFlagState);
        logger.category("feature_flags").debug(`Flag ${eventType}:`, flag.flag_name);
        state.evaluationCache.invalidateFlag(flag.flag_name);
      }
    }

    await StorageManager.set(STORAGE_KEYS.FEATURE_FLAGS, {
      flags: Object.fromEntries(state.currentFlags),
      fetchedAt: Date.now(),
    });

    notifySubscribers(state);
  } catch (error) {
    logger.category("feature_flags").warn("Error handling flag change", error);
  }
}

async function handleEntitlementChange(state: ServerSyncState, payload: any): Promise<void> {
  try {
    const { new: entitlementData, old: oldEntitlementData, eventType } = payload;
    if (!state.userId) return;

    const entitlementKey = entitlementData?.key || oldEntitlementData?.key;

    if (eventType === "DELETE") {
      state.cachedEntitlements.delete(entitlementKey);
      logger.category("feature_flags").debug(`Entitlement revoked: ${entitlementKey}`);
      state.evaluationCache.clear();
    } else if (eventType === "INSERT" || eventType === "UPDATE") {
      if (entitlementData) {
        state.cachedEntitlements.set(entitlementKey, entitlementData as CachedEntitlement);
        logger.category("feature_flags").debug(`Entitlement ${eventType}:`, entitlementKey);
        state.evaluationCache.clear();
      }
    }

    await StorageManager.set(
      `${STORAGE_KEYS.ENTITLEMENTS}:${state.userId}`,
      Object.fromEntries(state.cachedEntitlements),
    );
  } catch (error) {
    logger.category("feature_flags").warn("Error handling entitlement change", error);
  }
}

async function handleOverrideChange(state: ServerSyncState, payload: any): Promise<void> {
  try {
    const { new: overrideData, old: oldOverrideData, eventType } = payload;
    if (!state.userId) return;

    const normalized = normalizeFlagOverrideRow(overrideData || oldOverrideData);
    const targetName = normalized?.target_name;
    if (!targetName) return;

    if (eventType === "DELETE") {
      state.remoteOverrides.delete(targetName);
      logger.category("feature_flags").debug(`Override revoked: ${targetName}`);
    } else {
      state.remoteOverrides.set(targetName, normalized);
      logger.category("feature_flags").debug(`Override ${eventType}: ${targetName}`);
    }

    state.evaluationCache.invalidateFlag(targetName);

    await StorageManager.set(
      `${STORAGE_KEYS.FEATURE_FLAGS}:${OVERRIDE_CACHE_KEY_PREFIX}${state.userId}`,
      Object.fromEntries(state.remoteOverrides),
    );

    notifySubscribers(state);
  } catch (error) {
    logger.category("feature_flags").warn("Error handling override change", error);
  }
}

async function handleEntitlementOverrideChange(
  state: ServerSyncState,
  payload: any,
): Promise<void> {
  try {
    const { new: overrideData, old: oldOverrideData, eventType } = payload;
    if (!state.userId) return;

    const normalized = normalizeEntitlementOverrideRow(overrideData || oldOverrideData);
    const entitlementKey = normalized?.target_name;
    if (!entitlementKey) return;

    if (eventType === "DELETE") {
      state.remoteEntitlementOverrides.delete(entitlementKey);
      logger.category("feature_flags").debug(
        `Entitlement override deleted: ${entitlementKey}`,
      );
    } else {
      state.remoteEntitlementOverrides.set(entitlementKey, normalized);
      logger.category("feature_flags").debug(
        `Entitlement override ${eventType}: ${entitlementKey}`,
      );
    }

    await StorageManager.set(
      `${STORAGE_KEYS.ENTITLEMENTS}:${ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX}${state.userId}`,
      Object.fromEntries(state.remoteEntitlementOverrides),
    );

    state.evaluationCache.clear();
    notifySubscribers(state);
  } catch (error) {
    logger.category("feature_flags").warn("Error handling entitlement override change", error);
  }
}

async function handleRolloutChange(state: ServerSyncState, payload: any): Promise<void> {
  try {
    const { new: rolloutData, old: oldRolloutData, eventType } = payload;
    const rollout = rolloutData || oldRolloutData;
    const flagName = rollout?.flag_name;
    if (!flagName) return;

    if (eventType === "DELETE") {
      state.cachedRollouts.delete(flagName);
      logger.category("feature_flags").debug(`Rollout deleted: ${flagName}`);
    } else {
      state.cachedRollouts.set(flagName, {
        percentage: Number(rollout.percentage),
        seed: rollout.seed ?? undefined,
      });
      logger.category("feature_flags").debug(`Rollout ${eventType}: ${flagName}`);
    }

    await StorageManager.set(
      `${STORAGE_KEYS.FEATURE_FLAGS}:rollouts`,
      Object.fromEntries(state.cachedRollouts),
    );
  } catch (error) {
    logger.category("feature_flags").warn("Error handling rollout change", error);
  }
}

async function handleCohortChange(state: ServerSyncState, payload: any): Promise<void> {
  try {
    const { new: cohortData, old: oldCohortData, eventType } = payload;
    const cohort = cohortData || oldCohortData;
    const slug = cohort?.slug;
    if (!slug) return;

    if (eventType === "DELETE") {
      state.cachedCohorts.delete(slug);
      logger.category("feature_flags").debug(`Cohort deleted: ${slug}`);
    } else {
      state.cachedCohorts.set(slug, cohort as CachedCohort);
      logger.category("feature_flags").debug(`Cohort ${eventType}: ${slug}`);
    }

    await StorageManager.set(
      `${STORAGE_KEYS.FEATURE_FLAGS}:cohorts`,
      Object.fromEntries(state.cachedCohorts),
    );

    state.evaluationCache.clear();
    notifySubscribers(state);
  } catch (error) {
    logger.category("feature_flags").warn("Error handling cohort change", error);
  }
}

async function handleUserCohortMembershipChange(
  state: ServerSyncState,
  payload: any,
): Promise<void> {
  try {
    const { new: membershipData, old: oldMembershipData, eventType } = payload;
    if (!state.userId) return;

    const membership = (membershipData || oldMembershipData) as
      | CachedUserCohortMembership
      | undefined;
    if (!membership?.id) return;

    if (eventType === "DELETE") {
      state.cachedUserCohortMemberships = state.cachedUserCohortMemberships.filter(
        (m) => m.id !== membership.id,
      );
      logger.category("feature_flags").debug(
        `User cohort membership deleted: ${membership.id}`,
      );
    } else {
      const enriched: CachedUserCohortMembership = {
        ...membership,
        cohort_slug:
          membership.cohort_slug || resolveCohortSlug(membership, state.cachedCohorts),
      };

      state.cachedUserCohortMemberships = [
        ...state.cachedUserCohortMemberships.filter((m) => m.id !== enriched.id),
        enriched,
      ];

      logger.category("feature_flags").debug(
        `User cohort membership ${eventType}: ${enriched.id}`,
      );
    }

    await StorageManager.set(
      `${STORAGE_KEYS.FEATURE_FLAGS}:user_cohort_memberships:${state.userId}`,
      state.cachedUserCohortMemberships,
    );

    state.evaluationCache.clear();
    notifySubscribers(state);
  } catch (error) {
    logger.category("feature_flags").warn("Error handling user cohort membership change", error);
  }
}
