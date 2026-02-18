# Feature

Hooks for feature flag evaluation and entitlement checks. Used to enable/disable features and check user access at runtime.

## When to Use This Module

**Use this module if you need to:**
- Check if a feature flag is enabled for the current user
- Evaluate entitlements for premium or cohort-based features

**Do NOT use this module for:**
- Defining new feature flags (use `lib/feature-flags`)
- Managing subscription state (see `lib/premium`)

## Architecture & Data Flow

```
Component
        ↓
useFeatureFlags / useEntitlements
        ↓
lib/feature-flags / lib/premium
        ↓
Return enabled/disabled or entitlement state
```

**Key Principles:**
- **Deterministic**: Feature flag checks are consistent for a given user/context.
- **Composable**: Entitlement and flag checks can be combined for complex gating.

## API Reference

### `useFeatureFlags(flagName)`
Return enabled/disabled state for a feature flag.

### `useEntitlements()`
Return entitlement state for the current user and feature.

## Dependencies

### External Packages
- None (relies on internal feature flag logic)

### Internal Dependencies
- **`lib/feature-flags`** – feature flag and cohort logic
- **`lib/premium`** – entitlement evaluation

## Error Handling & Edge Cases

### Stale Flags
Feature flag values may be cached; hooks should revalidate on context change.

## Performance Notes

Feature flag checks are fast and synchronous; entitlement checks may require async refresh.

## Related Modules
- **`lib/feature-flags`** – flag definitions and evaluation
- **`lib/premium`** – entitlement and subscription logic

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `use-feature-flags.ts` | Feature flag evaluation hook |
| `use-entitlements.ts` | Entitlement check hook |
