# lib/premium

Scaffolding for premium subscription management. Currently a stub with safe defaults (all users are free tier). Prepares architecture for future integration with Stripe/billing backend and feature entitlements.

## When to Use This Module

**Use this module to:**

- Check if user is on premium tier for feature gating
- Check if user has access to a specific feature/capability
- Get current subscription state (cached in [lib/storage's SecureStorage](../storage/README.md))
- Combine with [lib/feature-flags](../feature-flags/README.md) for feature flag + subscription gating
- Display subscription tier in profile/settings via [lib/settings](../settings/README.md)
- Manually refresh subscription data when needed (future: automatic refresh)

**Do NOT use this module for:**

- Payment processing (use Stripe directly via backend service)
- Server-side entitlement enforcement (use Supabase RLS policies in [lib/database](../database/README.md) instead)
- Plan comparison UI (design separately; this is just tier checking)
- Trial management and trial expiration (future enhancement)
- Feature flags alone (use [lib/feature-flags](../feature-flags/README.md) for development toggles)

## API Reference

### `SubscriptionManager.getSubscription(): Promise<Subscription>`

Get current subscription. Returns cached value if fresh (<1 min TTL), otherwise updates cache.

```ts
import { SubscriptionManager } from "@/lib/premium";

const subscription = await SubscriptionManager.getSubscription();
console.log(`Tier: ${subscription.tier}, Features: ${subscription.features}`);
// Tier: free, Features: []
```

### `SubscriptionManager.isPremium(): Promise<boolean>`

Check if user is on premium tier.

```ts
const isPremium = await SubscriptionManager.isPremium();
if (isPremium) {
  showPremiumFeatures();
}
```

### `SubscriptionManager.hasFeature(featureKey: string): Promise<boolean>`

Check if user has access to a specific feature.

```ts
if (await SubscriptionManager.hasFeature("unlimited_characters")) {
  allowUnlimitedCharacters();
}
```

### `SubscriptionManager.isPremiumCached(): boolean`

Synchronous check using cached subscription (no async fetch). Returns false if cache empty.

```ts
// Quick non-UI check
if (SubscriptionManager.isPremiumCached()) {
  // Don't block on async, just use cache
}
```

### `SubscriptionManager.hasFeatureCached(featureKey: string): boolean`

Synchronous feature check using cached subscription.

```ts
if (!SubscriptionManager.hasFeatureCached("custom_themes")) {
  showUpgradePrompt();
}
```

### `SubscriptionManager.getCachedSubscription(): Subscription | null`

Get cached subscription without triggering any refresh. Returns null if cache empty.

```ts
const cached = SubscriptionManager.getCachedSubscription();
if (cached) {
  console.log(`Last fetched: ${new Date(cached.fetchedAt)}`);
}
```

### `SubscriptionManager.refresh(): Promise<Subscription>`

Manually refresh subscription data. Currently returns default (free tier).

```ts
// Force refresh (will trigger server fetch when implemented)
const updated = await SubscriptionManager.refresh();
```

## Interfaces

### `Subscription`

User subscription state.

```ts
interface Subscription {
  /** Tier: 'free' or 'premium' */
  tier: SubscriptionTier;

  /** Feature keys user is entitled to */
  features: string[];

  /** When subscription was fetched (epoch ms) */
  fetchedAt: number;
}
```

### `SubscriptionTier`

```ts
type SubscriptionTier = "free" | "premium";
```

## Current Behavior

**Today (Stub):**

- All users are `tier: 'free'`
- Feature list is always `[]`
- No remote fetch (always uses cache)
- 1-minute TTL prepares for future server calls

**Future (Placeholder):**

- Query Supabase for user subscription
- Return cached result within 1-min TTL
- Trigger remote fetch on explicit `refresh()` call
- Integrate with feature flags (lib/feature-flags)

## Dependencies

### External Packages

- None currently

### Internal Dependencies

- None currently (future: `lib/database`, `lib/feature-flags`)

## File Breakdown

| File                      | Purpose                                                       | Exports                                                   |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| `subscription-manager.ts` | Subscription state management. Stub with default (free tier). | `SubscriptionManager`, `Subscription`, `SubscriptionTier` |
| `index.ts`                | Barrel export for public API.                                 | All public exports                                        |

## Design Notes

**Safe Defaults:**

- All users default to free tier
- Empty feature list by default
- No crashes if subscription fetch fails

**Caching:**

- 1-minute TTL prepares for remote fetches
- Both async and sync access patterns supported
- Cached checks don't block on network

**Policy:**

- Premium tier unlocks all features (simple)
- Free tier checks feature list explicitly
- Future: more granular tier definitions (starter, pro, etc.)

## Future Enhancements

Planned additions (not scheduled):

1. **Server integration** – Query Supabase for subscription status
2. **Entitlement sync** – Integration with feature flags (Issue #59)
3. **Trial management** – Trial duration, expiry tracking
4. **Usage tracking** – Track usage against tier limits
5. **Upgrade flow** – Link to Stripe/payment page
6. **Plan comparison UI** – Show features per tier
7. **Grace period** – Handle payment failures gracefully

## Notes

- This is a scaffold; no billing logic yet
- All users are effectively "free" at this time
- Real premium features will be gated server-side (Supabase RLS)
- Client-side checks are for UX only (show/hide features)
