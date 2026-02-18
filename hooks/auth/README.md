# Auth

Auth-related hooks for checking session state and feature entitlements (premium access). Lightweight wrappers over the auth provider.

## When to Use This Module

**Use this module if you need to:**

- Check whether the current user is authenticated
- Read premium entitlement or feature access for UI gating
- Access simple auth context in components without consuming full providers

**Do NOT use this module for:**

- Directly managing Supabase clients or performing low-level auth flows
- Performing cross-world permission checks (use `lib/auth` instead)

## Architecture & Data Flow

```
Component
        ↓
useAuthStatus -> read AuthContext
        ↓
return auth state / fetch entitlement via lib/premium
```

**Key Principles:**

- **Guard-focused**: Keep checks fast and synchronous when possible.
- **Cache-friendly**: Entitlement checks may use cached subscription info to avoid flapping.
- **Separation**: Heavy auth flows live in `lib/auth` not in hooks.

## API Reference

### `useAuthStatus()`

Return lightweight session info and authenticated flag.

**Returns:**
- `{ isAuthenticated, user, loading }`

### `usePremiumFeature(featureKey)`

Check if the current user has access to the specified premium feature.

**Parameters:**
- `featureKey` (string) – feature identifier

**Returns:**
- `{ isPremium, isAvailable, loading }`

## Dependencies

### External Packages

- None specific to hooks (relies on project auth infra)

### Internal Dependencies

- **`lib/premium`** – subscription and entitlement logic
- **`providers`** – Auth provider that exposes context

## Error Handling & Edge Cases

### Transient Network Failures

Entitlement checks should surface `loading`/`error`; UI must avoid hard-blocking actions on transient failures.

## Performance Notes

Entitlement checks may return cached responses; force-refresh options should be available for sensitive pages.

## Related Modules

- **`lib/premium`** – authoritative subscription state and entitlement evaluation
- **`hooks`** – barrel export

## File Breakdown

| File | Purpose |
| ---- | ------- |
| `index.ts` | Barrel export for auth hooks |
| `use-auth-status.tsx` | Access lightweight auth/session status |
| `use-premium-feature.ts` | Check premium feature entitlement |
