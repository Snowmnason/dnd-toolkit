/**
 * Premium Manager — Orchestrator for subscription/premium features
 *
 * Public API for hooks and managers to access premium subscription state.
 * Delegates to SubscriptionManager (internal implementation).
 *
 * When subscription data needs persistence (future), will call storage-service middleware.
 */

import { logger } from '@/lib/utils/logger';
import { SubscriptionManager, type Subscription } from './subscription-manager';

// ─── Async API (triggers refresh if cache expired) ────────────────────

/**
 * Get the current subscription state.
 * Returns cached value if within TTL, otherwise refreshes.
 * Always returns a valid Subscription object (defaults to free tier on error).
 */
export async function getSubscription(): Promise<Subscription> {
  try {
    return await SubscriptionManager.getSubscription();
  } catch (error) {
    logger.category('other').error('Failed to get subscription', error);
    return { tier: 'free', features: [], fetchedAt: Date.now() };
  }
}

/**
 * Check if user has premium subscription.
 * Returns false if subscription is free tier or on error.
 */
export async function isPremium(): Promise<boolean> {
  try {
    return await SubscriptionManager.isPremium();
  } catch (error) {
    logger.category('other').error('Failed to check premium status', error);
    return false;
  }
}

/**
 * Check if user has access to a specific premium feature.
 * Returns false if feature not found, tier is free, or on error.
 */
export async function hasFeature(featureKey: string): Promise<boolean> {
  if (!featureKey) return false;
  try {
    return await SubscriptionManager.hasFeature(featureKey);
  } catch (error) {
    logger.category('other').error(`Failed to check feature ${featureKey}`, error);
    return false;
  }
}

/**
 * Explicitly refresh the subscription cache.
 * Useful for manual refresh after user actions.
 * Always returns a valid Subscription object (defaults to free tier on error).
 */
export async function refreshSubscription(): Promise<Subscription> {
  try {
    return await SubscriptionManager.refresh();
  } catch (error) {
    logger.category('other').error('Failed to refresh subscription', error);
    return { tier: 'free', features: [], fetchedAt: Date.now() };
  }
}

// ─── Sync API (uses cache, no async) ─────────────────────────────────

/**
 * Check premium status using cached state only (synchronous).
 * Returns false if cache is empty or user is free tier.
 * Use this for quick checks where async is not an option.
 */
export function isPremiumCached(): boolean {
  return SubscriptionManager.isPremiumCached();
}

/**
 * Check feature access using cached state only (synchronous).
 * Returns false if cache is empty, feature not found, or tier is free.
 * Use this for quick checks where async is not an option.
 */
export function hasFeatureCached(featureKey: string): boolean {
  if (!featureKey) return false;
  return SubscriptionManager.hasFeatureCached(featureKey);
}

/**
 * Get the cached subscription without triggering refresh.
 * Returns null if cache is empty.
 * Use this when you need the full Subscription object but don't want async overhead.
 */
export function getCachedSubscription(): Subscription | null {
  return SubscriptionManager.getCachedSubscription();
}
