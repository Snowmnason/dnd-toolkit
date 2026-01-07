import { usePremiumFeature } from '@/hooks/use-premium-feature';
import { FeatureFlagName, FeatureFlags } from '@/lib/feature-flags';
import React from 'react';

export type FeatureGateProps = {
  children: React.ReactNode;
  /** Optional flag to check for availability */
  flag?: FeatureFlagName;
  /** Require premium tier; when true, featureKey optionally narrows entitlement */
  requirePremium?: boolean;
  /** Specific premium feature key to check when requirePremium is true */
  featureKey?: string;
  /** Optional fallback when gated; defaults to null (hide) */
  fallback?: React.ReactNode;
};

/**
 * FeatureGate hides children when not allowed by flags or premium entitlements.
 * Default behavior: render nothing if gated (no banners/overlays).
 */
export function FeatureGate({
  children,
  flag,
  requirePremium,
  featureKey,
  fallback = null,
}: FeatureGateProps) {
  const flagAllowed = flag ? FeatureFlags.isEnabled(flag) : true;
  const { isAvailable, loading } = usePremiumFeature(requirePremium ? featureKey : undefined);

  // While loading, avoid flicker by not rendering gated content
  if (loading) return fallback;

  const premiumAllowed = requirePremium ? isAvailable : true;
  const allowed = flagAllowed && premiumAllowed;

  if (!allowed) return fallback;
  return <>{children}</>;
}

export default FeatureGate;
