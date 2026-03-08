// Barrel export for feature flags & entitlements hooks
export { useEntitlement } from "./use-entitlements";
export { useFeatureFlag, useFeatureFlags } from "./use-feature-flags";
export type { FeatureFlagName } from "@/lib/feature-flags";
export {
  useFeatureGatingStatus,
  useGatedFeatures,
  useIsFeatureGated
} from "./use-feature-gating";
export { usePremiumFeature } from "./use-premium-feature";
export type { UsePremiumFeatureState } from "./use-premium-feature";

