/**
 * Premium subscription scaffolding (no real subscription logic yet)
 * - Safe defaults: tier = 'free', features = []
 * - In-memory cache with simple TTL to prepare for future fetches
 */

export type SubscriptionTier = 'free' | 'premium';

export interface Subscription {
  tier: SubscriptionTier;
  features: string[]; // feature keys the user is entitled to
  fetchedAt: number; // epoch ms
}

const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: 'free',
  features: [],
  fetchedAt: Date.now(),
};

class SubscriptionManagerImpl {
  private cache: Subscription | null = null;
  private ttlMs = 60_000; // 1 minute TTL to prepare for future remote refreshes

  /**
   * Returns the current subscription from cache or default.
   * Future: replace stub with Supabase/Stripe-backed fetch + persistence.
   */
  async getSubscription(): Promise<Subscription> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < this.ttlMs) {
      return this.cache;
    }

    // Stubbed: always free until backend is implemented
    this.cache = { ...DEFAULT_SUBSCRIPTION, fetchedAt: now };
    return this.cache;
  }

  /** True if tier is not 'free'. */
  async isPremium(): Promise<boolean> {
    const sub = await this.getSubscription();
    return sub.tier !== 'free';
  }

  /**
   * Checks whether a feature is accessible.
   * Policy: premium tier unlocks all; otherwise require explicit feature entitlement.
   */
  async hasFeature(featureKey: string): Promise<boolean> {
    const sub = await this.getSubscription();
    if (sub.tier !== 'free') return true;
    return sub.features.includes(featureKey);
  }

  /** Placeholder for explicit cache refresh. */
  async refresh(): Promise<Subscription> {
    // In a real implementation, fetch remote state and update cache
    this.cache = { ...DEFAULT_SUBSCRIPTION, fetchedAt: Date.now() };
    return this.cache;
  }

  /**
   * Synchronous check using cached state (no async fetch).
   * Returns false if cache is empty. Use for quick non-UI checks.
   */
  isPremiumCached(): boolean {
    return this.cache?.tier !== 'free' && this.cache !== null;
  }

  /**
   * Synchronous feature check using cached state.
   * Returns false if cache is empty or feature not found.
   */
  hasFeatureCached(featureKey: string): boolean {
    if (!this.cache) return false;
    if (this.cache.tier !== 'free') return true;
    return this.cache.features.includes(featureKey);
  }

  /**
   * Get cached subscription without triggering refresh.
   * Returns null if cache is empty.
   */
  getCachedSubscription(): Subscription | null {
    return this.cache;
  }
}

export const SubscriptionManager = new SubscriptionManagerImpl();

/**
 * Return type for premium feature access checks.
 * Reserved for future utility functions that need to return both premium status and feature availability.
 */
export type PremiumFeatureCheck = {
  isPremium: boolean;
  isAvailable: boolean;
};
