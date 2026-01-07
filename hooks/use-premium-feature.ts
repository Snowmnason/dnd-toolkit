import { SubscriptionManager } from '@/lib/premium/subscription-manager';
import { useEffect, useState } from 'react';

export interface UsePremiumFeatureState {
  isPremium: boolean;
  isAvailable: boolean;
  loading: boolean;
}

/**
 * Hook to check premium tier and per-feature entitlement.
 * Default: free users have no features; premium tier unlocks all features.
 */
export function usePremiumFeature(featureKey?: string): UsePremiumFeatureState {
  const [state, setState] = useState<UsePremiumFeatureState>({
    isPremium: false,
    isAvailable: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isPremium = await SubscriptionManager.isPremium();
      const isAvailable = featureKey
        ? await SubscriptionManager.hasFeature(featureKey)
        : isPremium; // if no featureKey, availability equals premium tier
      if (!cancelled) setState({ isPremium, isAvailable, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [featureKey]);

  return state;
}
