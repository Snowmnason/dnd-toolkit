# Feature & Premium Gating System

## Overview
A unified system to gate features behind feature flags, beta access, or premium subscriptions—without implementing payment logic yet. Gates are **invisible by default**: blocked features simply don't render or execute.

## Core Concepts

### Feature Flags
JSON-driven toggles in `config/appsettings.*.json` under `featureFlags` with optional `kind` classification:
- `free` – Available to all users
- `premium` – Requires paid tier
- `beta` – Unfinished/testing features

Flags can be toggled at runtime via `FeatureFlags.toggle(flagName, enabled)` in dev console.

### Subscription Tiers
- `free` – Default tier (no features unlocked)
- `premium` – Unlocks all premium features

Currently stubbed; returns `free` until backend is wired to Supabase/Stripe.

### Gating Modes

| Mode | Use Case | How It Works |
|------|----------|--------------|
| **Feature Flag** | Toggle any feature on/off | Checks `config/appsettings.*.json` |
| **Premium** | Require paid tier | Checks `SubscriptionManager.isPremium()` |
| **Premium + Feature Key** | Specific premium feature | Checks tier + explicit entitlement list |
| **Combined** | Beta + premium | Both flag and premium must pass |

## How It Works

### 1. Feature Flags
Stored in `config/appsettings.*.json`:
```json
{
  "flags": {
    "themeSelector": { "enabled": true, "kind": "free" },
    "campaignsBeta": { "enabled": false, "kind": "beta" },
    "advancedMaps": { "enabled": false, "kind": "premium" }
  }
}
```

Read via:
- `FeatureFlags.isEnabled(flagName)` – Direct check
- `useFeatureFlag(flagName)` – React hook (re-checks on render)

### 2. Subscription State
Managed by `SubscriptionManager` (lib/premium/subscription-manager.ts):
- In-memory cache with 1-minute TTL
- Defaults to `{ tier: 'free', features: [] }`
- Async methods: `isPremium()`, `hasFeature(key)`
- Sync methods: `isPremiumCached()`, `hasFeatureCached(key)` (for non-UI code)

### 3. Gating Logic
```
allowed = flagCheck AND premiumCheck

- flagCheck: flag?.enabled ?? true
- premiumCheck: requirePremium ? (tier === 'premium' OR featureKey in features) : true
```

If not allowed → render nothing (UI) or return false (service layer).

## APIs

### SubscriptionManager
Location: `lib/premium/subscription-manager.ts` (barrel: `lib/premium/index.ts`)

**Async (triggers cache refresh if expired):**
- `getSubscription(): Promise<Subscription>`
- `isPremium(): Promise<boolean>`
- `hasFeature(key: string): Promise<boolean>`
- `refresh(): Promise<Subscription>`

**Sync (uses cached state, returns false if empty):**
- `isPremiumCached(): boolean`
- `hasFeatureCached(key: string): boolean`
- `getCachedSubscription(): Subscription | null`

### Feature Flags
Location: `lib/feature-flags.ts`

- `FeatureFlags.isEnabled(flagName): boolean`
- `FeatureFlags.getKind(flagName): 'free' | 'premium' | 'beta' | undefined`
- `FeatureFlags.toggle(flagName, enabled): void` – Runtime toggle (dev only)

### React Hooks
- `useFeatureFlag(flagName)` – Returns boolean, recomputes each render
- `usePremiumFeature(featureKey?)` – Returns `{ isPremium, isAvailable, loading }`

### React Component
- `<FeatureGate>` – Wrapper that hides children when gated

## Configuration

### Adding a Feature Flag
1. Edit `config/appsettings.dev.json` (and mirror in `config/appsettings.json`):
```json
{
  "flags": {
    "myNewFeature": {
      "enabled": false,
      "kind": "beta",
      "description": "Optional description"
    }
  }
}
```

2. TypeScript types update automatically via `keyof typeof featureFlagsConfig.flags`

### Adding a Premium Feature Key
When wiring the backend, populate the `features` array in `Subscription`:
```ts
{
  tier: 'premium',
  features: ['extended_storage', 'advanced_theme', 'campaigns'],
  fetchedAt: Date.now()
}
```

Premium tier users get **all** features; free users need explicit entitlement.

## Usage
See [Frontend-gate.md](./Frontend-gate.md) for UI/component gating.
See [Backend-gate.md](./Backend-gate.md) for service/API/database gating.

## Future Work
- Wire `getSubscription()` to Supabase/Stripe
- Add event-based cache invalidation
- Consider refresh on app foreground/resume
- Add telemetry for blocked feature access
