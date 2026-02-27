import { trackFeatureBlocked } from '@/lib/analytics';
import { SubscriptionManager } from '@/lib/premium';
import { logger } from '@/lib/utils/logger';
import { useEffect, useRef, useState } from 'react';

export interface UsePremiumFeatureState {
  isPremium: boolean;
  isAvailable: boolean;
  loading: boolean;
}

/**
 * Hook to check premium tier and per-feature entitlement.
 * Default: free users have no features; premium tier unlocks all features.
 * 
 * When called with undefined featureKey, returns a check-free result (no async operation).
 * 
 * Note: Uses cached subscription data from SubscriptionManager.
 * Currently does not auto-refresh after TTL expires. When implementing the real
 * subscription backend, consider adding:
 * - A refresh mechanism (e.g., interval polling or manual refresh prop)
 * - Event-based invalidation when subscription changes
 * - Or accept cached behavior and refresh on app foreground/resume
 */
export function usePremiumFeature(featureKey?: string): UsePremiumFeatureState {
  // When no featureKey provided (i.e., premium check not needed), skip async check
  const shouldCheckPremium = featureKey !== undefined;
  
  const [state, setState] = useState<UsePremiumFeatureState>(() => ({
    isPremium: false,
    isAvailable: !shouldCheckPremium, // available if no check needed
    loading: shouldCheckPremium,
  }));
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!shouldCheckPremium) return; // no-op when premium not required
    
    let cancelled = false;
    (async () => {
      const isPremium = await SubscriptionManager.isPremium();
      const isAvailable = await SubscriptionManager.hasFeature(featureKey);
      if (!cancelled) setState({ isPremium, isAvailable, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [featureKey, shouldCheckPremium]);

  // Track when a premium gate blocks access
  useEffect(() => {
    if (!shouldCheckPremium) return;
    if (state.loading) return;
    // Reset tracking when available again so future blocks are recorded
    if (state.isAvailable) {
      trackedRef.current = false;
      return;
    }

    if (trackedRef.current) return;

    try {
      trackFeatureBlocked({ feature: featureKey!, reason: 'requires_premium' });
    } catch (error) {
      // Log tracking failures for debugging without blocking feature checks
      logger.category('other').debug('Failed to track feature blocked event:', error);
    }
    trackedRef.current = true;
  }, [shouldCheckPremium, state.loading, state.isAvailable, featureKey]);

  return state;
}
