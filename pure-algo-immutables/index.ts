export {
    bucketPercent, clearBucketCache, getBucketMemoized, isInRollout, isInRolloutMemoized, type RolloutConfig
} from "./rollout";

export { RECOMMENDED_COHORTS, isUserInCohort, type CohortDef, type CohortFlagAssignmentRow, type CohortRow, type UserCohortMembershipRow } from "./cohort-bucketing";

export { AppError, isAppError, toAppError } from "./app-error";
export {
    calculateBackoffDelay,
    calculateNextRetryTime,
    formatDelay,
    isRetryable
} from "./backoff";

export * from "./entitlements";

export * from "./redaction-manager";

export {
    generateResponsiveSrcset,
    getOptimalImageWidth,
    getResponsiveImageSizes,
    isSupabaseUrl,
    optimizeSupabaseImage,
    optimizeWithWebP,
    supportsWebP,
    type ImageOptimizationOptions
} from "./image-optimization";

export {
    classifyCacheAge,
    evaluateSnapshotFreshness,
    getDeadThresholdMs,
    getFreshThresholdMs,
    type CacheFreshness,
    type FreshnessThresholds,
    type SnapshotFreshness
} from "./cache-freshness";

