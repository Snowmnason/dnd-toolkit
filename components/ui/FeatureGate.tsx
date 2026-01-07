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
  // Dev validation: featureKey should only be used with requirePremium
  const isDev = (process.env.EXPO_PUBLIC_ENVIRONMENT || 'production') === 'development';
  if (isDev && featureKey && !requirePremium) {
    console.warn('[FeatureGate] featureKey provided without requirePremium=true; key will be ignored.');
  }

  const flagAllowed = flag ? FeatureFlags.isEnabled(flag) : true;
  
  // Only check premium if explicitly required
  const premiumCheck = usePremiumFeature(requirePremium ? featureKey : undefined);
  
  // While loading premium state, avoid flicker
  if (requirePremium && premiumCheck.loading) return fallback;

  const premiumAllowed = requirePremium ? premiumCheck.isAvailable : true;
  const allowed = flagAllowed && premiumAllowed;

  if (!allowed) return fallback;
  return <>{children}</>;
}

export default FeatureGate;
