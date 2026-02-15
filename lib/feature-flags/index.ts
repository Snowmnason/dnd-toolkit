export {
    FeatureFlags,
    type FeatureFlag,
    type FeatureFlagKind,
    type FeatureFlagName
} from "./feature-flags";

export {
    FeatureFlagsManager,
    type EntitlementState,
    type FeatureFlagState,
    type FlagsSubscriber
} from "./server-sync";

export {
    bucketPercent, clearBucketCache, getBucketMemoized, isInRollout, isInRolloutMemoized, type RolloutConfig
} from "./rollout";

export {
    RECOMMENDED_COHORTS, isUserInCohort, type CohortDef,
    type CohortFlagAssignmentRow,
    type CohortRow,
    type UserCohortMembershipRow
} from "./cohorts";

// NOTE: useFeatureFlags is NOT exported here to avoid circular dependency
// Import directly from hooks/feature/use-feature-flags instead
// NOTE: useEntitlement is NOT exported here to avoid circular dependency
// Import directly from hooks/feature/use-entitlements instead

