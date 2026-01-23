# Feature Flags & Premium — Test Guide

## Overview

- Purpose: Test feature-flag gating and premium entitlement behavior.
- Scope: `lib/feature-flags.ts`, `hooks/use-premium-feature.ts`, `lib/premium/subscription-manager.ts`, `providers/SubscriptionProvider.tsx`.

## Environments

- Web (desktop) — can use browser console to toggle dev flags
- Desktop app / Mobile app — premium checks rely on `SubscriptionManager` (stubbed in staging)

## Prerequisites

- Test user accounts representing free and premium tiers (if available)

## Test Data

- Feature keys used by UI (see `appsettings.*.json` > `featureFlags`)

## Test Cases

### Test Case — Feature flag toggle (Web)

- Goal: Verify UI reacts to runtime feature flag changes.
- Steps:
  1.  Open the app in web staging.
  2.  In browser console run: `FeatureFlags.toggle('someFlag', true)`.
  3.  Observe the UI element that depends on `someFlag` appears/activates.
- Expected result:
  - UI updates without reload.
- Evidence: Screenshot before/after and console command.

### Test Case — Premium gating (UI)

- Goal: Verify premium-protected features show locked state for free users and available state for premium users.
- Steps:
  1.  With a free-user account, open a feature gated by premium (see component using `usePremiumFeature`).
  2.  Confirm UI shows upgrade prompt or locked state.
  3.  If you have a premium test account, sign in and confirm the feature is available.
- Expected result:
  - Free user sees lock/upgrade UI; premium user can access feature.
- Evidence: Screenshots, notes of which feature was tested.

## Notes / Implementation gaps

- `SubscriptionManager` is currently a stub returning `free` by default. For reliable premium tests, engineering can:
  - Provide a staging subscription fixture (returning `premium`) or
  - Expose a short test helper to set `SubscriptionManager.cache` in staging/dev builds.

## Test Helpers

- Web console to toggle flags: `FeatureFlags.toggle('flagName', true)`.
- For premium tests: engineering can add a temporary route to set cached subscription for the logged-in user in staging only.

## Related Files

- `lib/feature-flags.ts`
- `hooks/use-premium-feature.ts`
- `lib/premium/subscription-manager.ts`
- `providers/SubscriptionProvider.tsx`
