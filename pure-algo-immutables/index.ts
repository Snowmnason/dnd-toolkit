// pure-algo-immutables barrel intentionally minimal.
// Import directly from source files instead of this barrel:
//   @/pure-algo-immutables/rollout
//   @/pure-algo-immutables/cohort-bucketing
//   @/pure-algo-immutables/app-error
//   @/pure-algo-immutables/backoff
//   @/pure-algo-immutables/entitlements
//   @/pure-algo-immutables/redaction-manager
//   @/pure-algo-immutables/image-optimization
//   @/pure-algo-immutables/cache-freshness

export {
    classifyCacheAge,
    evaluateSnapshotFreshness,
    getDeadThresholdMs,
    getFreshThresholdMs,
    type CacheFreshness,
    type FreshnessThresholds
} from "./cache-freshness";

