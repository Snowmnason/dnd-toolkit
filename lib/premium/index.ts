/**
 * Premium subscription barrel export
 *
 * Public API: Use manager functions (getSubscription, isPremium, hasFeature, etc.)
 * Internal: SubscriptionManager is not exported; use the manager instead
 */

// Manager API (primary entry point for hooks/managers)
export {
    getCachedSubscription, getSubscription, hasFeature, hasFeatureCached, isPremium, isPremiumCached, refreshSubscription
} from './premium-manager';

// Types (needed for type annotations)
export type { PremiumFeatureCheck, Subscription, SubscriptionTier } from './subscription-manager';

