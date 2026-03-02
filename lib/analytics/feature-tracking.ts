import { Analytics } from "./analytics-manager";

export type FeatureBlockedReason =
  | "flag_disabled"
  | "requires_premium"
  | "beta_only";

export function trackFeatureBlocked(params: {
  feature: string;
  reason: FeatureBlockedReason;
}) {
  const { feature, reason } = params;
  Analytics.track("feature_blocked", { feature, reason });
}
