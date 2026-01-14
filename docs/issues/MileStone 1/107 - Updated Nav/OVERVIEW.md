# Issue #107 - Navigation & Auth System Documentation

This folder contains documentation for the updated navigation and authentication system implemented in Issue #107.

## What This Issue Fixed

Issue #107 consolidated and improved the navigation and authentication system to eliminate redirect loops, improve performance, and provide proper authentication guards for different route types.

## Documentation Files

### NAVIGATION_CONFIG.md
**Read this first.** Complete architecture overview of how the navigation system works.

Covers:
- Route structure and organization
- Authentication guards (account-only, world-required)
- World access verification (cache-first strategy)
- Parameter passing and context
- Common flows (auth, world selection, deep linking)
- Best practices and testing

**Best for:** Understanding the overall system, debugging navigation issues, implementing new protected routes

### Related Documentation

The following docs in other milestone folders describe specific parts of the system:

- **[023 - Centralize Auth Guard](../023%20-%20Centralize%20Auth%20Gaurd/AUTH_GUARD.md)** - How route guards work
- **[098 - Cache Versioning](../098%20-%20Cache%20Versioning/WORLD_ACCESS_CACHE.md)** - How world access cache works
- **Implementation Guide** (`docs/implem guide.md`) - Complete Phase 1-6 implementation details

## Quick Reference

### How to Add a Protected Route

1. Create `app/[section]/_layout.tsx` with a guard
2. Choose guard level: `'account-only'` or `'world-required'`
3. Add screens under that section
4. Done! Guard protects all nested routes

Example:
```tsx
export default function MyProtectedLayout() {
  const bootstrap = useAppBootstrap();
  const authState = useAuthGuard(bootstrap.isReady, 'account-only');
  
  if (authState === 'loading') return <LoadingOverlay />;
  return <Stack />;
}
```

### World Access Verification

- **Fresh cache (<2 hours):** Instant access (~15ms)
- **Stale cache (2-4 hours):** Verify with Supabase (~150ms)
- **Force verification:** Always check Supabase, ignore cache age

```tsx
// For sensitive pages
const authState = useAuthGuard(ready, 'account-only', { forceVerification: true });
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Redirect loop | Check you have only ONE guard per section |
| Slow navigation | Cache is stale, Supabase verification happening (normal, ~150ms) |
| Deep link fails | Ensure URL has `?worldId=abc123` parameter |
| Access denied wrongly | Check cache age, might be >4 hours old |

## Architecture Decisions

### Why Cache-First?

- **Speed:** Instant access to most-used worlds (fresh cache <15ms)
- **Scale:** Reduce database load by 95%
- **Offline:** Continue with stale cache if network fails
- **Security:** Periodic verification (every 2-4 hours) catches access changes

### Why Tiered Guards?

- `'account-only'` for routes that just need authentication
- `'world-required'` for routes that also need world access
- `forceVerification` for sensitive operations that need fresh data
- Each section has exactly ONE guard (no duplicates)

### Why SecureStorage Only?

- All data encrypted (web, iOS, Android)
- No unencrypted cache or localStorage
- Single encryption layer, easier to audit
- Consistent across platforms

## Future Enhancements

- **Role-based guards:** Check DM/player role (Issue #109)
- **Real-time updates:** Supabase Realtime for instant access changes
- **Offline mode:** Pre-download all worlds for offline play
- **Permission controls:** Fine-grained read/write permissions

## Key Files in Codebase

- `lib/auth/auth-state.ts` - AuthStateManager
- `lib/auth/useAuthGuard.ts` - Guard hook
- `lib/auth/index.ts` - Auth exports
- `lib/storage/SecureStorage.ts` - Encrypted storage
- `contexts/AppParamsContext.tsx` - Route parameters
- `app/_layout.tsx` - Root layout
- `app/index.tsx` - Welcome screen
- `app/select/_layout.tsx` - Account-only guard
- `app/main/_layout.tsx` - World-required guard
- `app/settings/_layout.tsx` - Forced verification guard

## Testing

Manual testing checklist:

- [ ] Unauthenticated user sees welcome screen
- [ ] Authenticated user can select world
- [ ] User can navigate within main app
- [ ] Deep link to `/main/...?worldId=X` works
- [ ] Settings page always checks Supabase
- [ ] No redirect loops
- [ ] World selection loads in <1 second
- [ ] Main app loads in <1 second (with world cached)

## Questions?

- Check NAVIGATION_CONFIG.md for system overview
- Check AUTH_GUARD.md for guard implementation details
- Check WORLD_ACCESS_CACHE.md for cache and verification details
- Check docs/implem guide.md for complete implementation history
