# Premium & Feature Flags Scaffolding

Scope: Provide typed scaffolding to gate UI with feature flags and premium checks, without implementing subscription/purchase logic.

## Concepts
- Subscription: `free` or `premium` tier; future-ready for remote refresh.
- Feature flags: JSON-driven toggles under `config/feature-flags.json`, optional `kind` classification.
- Gates: Invisible by default; gated components/pages render nothing.

## APIs
- `SubscriptionManager` (lib/premium/subscription-manager.ts)
  - `getSubscription(): Promise<Subscription>` – returns cached/default subscription
  - `isPremium(): Promise<boolean>` – true if tier !== `free`
  - `hasFeature(featureKey: string): Promise<boolean>` – premium unlocks all; otherwise explicit feature entitlement
- `usePremiumFeature(featureKey?: string)` (hooks/use-premium-feature.ts)
  - Returns `{ isPremium, isAvailable, loading }`
- `FeatureGate` (components/ui/FeatureGate.tsx)
  - Props: `flag?`, `requirePremium?`, `featureKey?`, `fallback?`
  - Hides children by default when gated.

## Usage Examples

```tsx
import { FeatureGate } from '@/components/ui';

// Gate a component by flag
<FeatureGate flag="themeSelector">
  <ThemeSelector />
</FeatureGate>

// Gate a component by premium tier (and specific feature key)
<FeatureGate requirePremium featureKey="advanced_theme">
  <ThemeSelector />
</FeatureGate>

// Gate a whole page
export default function CampaignsPage() {
  return (
    <FeatureGate flag="campaignsBeta" requirePremium featureKey="campaigns">
      <MainCampaigns />
    </FeatureGate>
  );
}
```

## Flags Configuration
Edit `config/feature-flags.json`:

```json
{
  "$schema": "./feature-flags.schema.json",
  "flags": {
    "themeSelector": { "enabled": true, "kind": "free" },
    "campaignsBeta": { "enabled": false, "kind": "beta" }
  }
}
```

## Notes
- No dev override/admin, payment, Stripe, or real entitlement fetching yet.
- Optional `fallback` can show a placeholder, otherwise nothing renders.
- When backend is implemented, wire `getSubscription()` to Supabase/Stripe and populate `features`.
