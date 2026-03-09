/**
 * Server Sync: Shared State
 *
 * Defines the ServerSyncState interface, initial state factory, shared constants,
 * and the notifySubscribers utility used across all server-sync modules.
 */
import type { FeatureFlagOverrideRow } from "@/lib/database/feature-flag-overrides";
import { logger } from "@/lib/utils/logger";
import type {
    CachedCohort,
    CachedEntitlement,
    CachedRolloutConfig,
    CachedUserCohortMembership,
    EdgeEntitlementOverrideRow,
    FeatureFlagState,
    FlagsSubscriber,
} from "@/type-definitions/featureFlagTypes";
import { FlagEvaluationCache } from "../cache";

// ==========================================
// Constants
// ==========================================

export const OVERRIDE_CACHE_KEY_PREFIX = "feature_flag_override:";
export const ENTITLEMENT_OVERRIDE_CACHE_KEY_PREFIX = "entitlement_override:";

// ==========================================
// State Definition
// ==========================================

export interface ServerSyncState {
  currentFlags: Map<string, FeatureFlagState>;
  userOverrides: Map<string, boolean>;
  remoteOverrides: Map<string, FeatureFlagOverrideRow>;
  remoteEntitlementOverrides: Map<string, EdgeEntitlementOverrideRow>;
  cachedEntitlements: Map<string, CachedEntitlement>;
  cachedRollouts: Map<string, CachedRolloutConfig>;
  cachedCohorts: Map<string, CachedCohort>;
  cachedUserCohortMemberships: CachedUserCohortMembership[];
  cachedCohortAssignments: Map<string, Set<string>>;
  evaluationCache: FlagEvaluationCache;
  subscribers: Set<FlagsSubscriber>;
  bootstrapped: boolean;
  userId: string | null;
  realtimeSubscriptions: Map<string, any>;
}

export function createInitialState(): ServerSyncState {
  return {
    currentFlags: new Map(),
    userOverrides: new Map(),
    remoteOverrides: new Map(),
    remoteEntitlementOverrides: new Map(),
    cachedEntitlements: new Map(),
    cachedRollouts: new Map(),
    cachedCohorts: new Map(),
    cachedUserCohortMemberships: [],
    cachedCohortAssignments: new Map(),
    evaluationCache: new FlagEvaluationCache(),
    subscribers: new Set(),
    bootstrapped: false,
    userId: null,
    realtimeSubscriptions: new Map(),
  };
}

// ==========================================
// Shared Utilities
// ==========================================

export function notifySubscribers(state: ServerSyncState): void {
  const flagsObject = Object.fromEntries(state.currentFlags);
  for (const callback of state.subscribers) {
    try {
      callback(flagsObject);
    } catch (error) {
      logger.category("feature_flags").error("Subscriber notification failed", error);
    }
  }
}
