/**
 * Subscription context provider
 * 
 * SCAFFOLDING: This provider is a placeholder wrapper around SubscriptionManager.
 * Currently does no real work (stub implementation).
 * 
 * When you implement backend subscription fetching, this provider will:
 * - Warm the subscription cache on app bootstrap
 * - Share cached state across the entire tree (avoid redundant fetches)
 * - Provide subscription state to hooks throughout the app
 * 
 * See docs: Entitlements-and-subscription-provider.md
 */

import { Subscription, SubscriptionManager } from '@/lib/premium';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface SubscriptionContextValue {
  subscription: Subscription | null;
  isLoading: boolean;
  isPremium: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

/**
 * SCAFFOLDING: Currently a stub that:
 * - Initializes subscription cache
 * - Provides context wrapper (no real fetching)
 * 
 * TODO: When implementing real subscriptions:
 * - Call SubscriptionManager.getSubscription() to fetch from Supabase/Stripe
 * - Set up polling or event listeners for cache invalidation
 * - Handle error states gracefully
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // STUB: Warm cache on mount (currently does nothing since no backend)
  useEffect(() => {
    const initSubscription = async () => {
      try {
        // TODO: Replace with real backend fetch when implemented
        const sub = await SubscriptionManager.getSubscription();
        setSubscription(sub);
      } catch (error) {
        console.error('[SubscriptionProvider] Failed to load subscription:', error);
        // TODO: Set default/error state
      } finally {
        setIsLoading(false);
      }
    };

    initSubscription();
  }, []);

  // STUB: Placeholder refresh (currently does nothing)
  const refresh = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with real backend refresh when implemented
      const sub = await SubscriptionManager.refresh();
      setSubscription(sub);
    } catch (error) {
      console.error('[SubscriptionProvider] Failed to refresh subscription:', error);
      // TODO: Handle error state
    } finally {
      setIsLoading(false);
    }
  };

  const isPremium = subscription?.tier === 'premium';

  const value: SubscriptionContextValue = {
    subscription,
    isLoading,
    isPremium,
    refresh,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to access subscription state anywhere in the tree
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { isPremium, isLoading } = useSubscription();
 *   if (isLoading) return <Spinner />;
 *   return <Text>{isPremium ? 'Premium' : 'Free'}</Text>;
 * }
 * ```
 */
export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within <SubscriptionProvider>');
  }
  return context;
}

export default SubscriptionProvider;
