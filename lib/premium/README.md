# lib/premium

Stub subscription management for premium tier checking and feature entitlements. Currently all users are free tier. Prepares architecture for future Stripe/billing integration.

## When to Use This Module

- Check if user is premium for feature gating
- Check if user has access to a specific feature
- Get/cache current subscription state
- Combine with lib/feature-flags for subscription + flag gating
- Display tier in profile/settings

Do NOT use for: payment processing (use Stripe backend), server-side enforcement (use lib/database RLS), plan comparison UI, or feature flags alone (use lib/feature-flags).

## API Reference

`SubscriptionManager.getSubscription(): Promise<Subscription>` — Get subscription, cached <1min. Returns free tier stub currently.

`SubscriptionManager.isPremium(): Promise<boolean>` — Check if user is on premium tier.

`SubscriptionManager.hasFeature(featureKey: string): Promise<boolean>` — Check if user has access to feature.

`SubscriptionManager.isPremiumCached(): boolean` — Synchronous cached check (no fetch).

`SubscriptionManager.hasFeatureCached(featureKey: string): boolean` — Synchronous feature check (cached).

`SubscriptionManager.getCachedSubscription(): Subscription | null` — Get cached subscription, null if empty.

`SubscriptionManager.refresh(): Promise<Subscription>` — Manually refresh (currently no-op stub).

**Example:**
```ts
const isPremium = await SubscriptionManager.isPremium();
if (isPremium && await SubscriptionManager.hasFeature("unlimited_characters")) {
  showPremiumUI();
}
```

## Interfaces

**Subscription**: `{ tier: SubscriptionTier, features: string[], fetchedAt: number }`

**SubscriptionTier**: `'free' | 'premium'`

## Current Behavior

All users default to free tier with empty feature list (stub). No remote fetch yet; 1-minute TTL prepares for future Supabase integration.

## Dependencies

**External:** None currently

**Internal:** Future: lib/database, lib/feature-flags

## File Breakdown

| File                      | Purpose                                    | Lines |
| ------------------------- | ------------------------------------------ | ----- |
| subscription-manager.ts   | Subscription state, stub (free tier only) | ~80   |
| index.ts                  | Barrel export                              | ~20   |

## Related Modules

- [lib/feature-flags](../feature-flags/README.md) — Combine with subscription for feature gating
- [lib/database](../database/README.md) — Server-side RLS for entitlement enforcement
- [lib/storage](../storage/README.md) — Subscription cached in SecureStorage
