# Route Guards - Authentication & Authorization

Route guards protect screens by verifying the user has proper authentication and permissions before rendering.

## Overview

The `useAuthGuard` hook is used in layout files (`_layout.tsx`) to control access to routes. It:

1. Waits for app bootstrap to complete
2. Checks user authentication status
3. For world-required routes, verifies world access via cache-first verification
4. Redirects unauthenticated/unauthorized users to safe routes
5. Subscribes to Supabase auth state changes

**Key Principle:** Each protected section has exactly ONE guard in its layout file. No nested duplicates.

## Guard Levels

Guards support two protection levels:

### Level: `'account-only'`

**What it checks:**
- User has an account and is authenticated

**Where to use:**
- `/select/*` - World selection (need to be logged in)
- `/settings/*` - User settings (need account access)

**Latency:** ~15ms (instant check from cache)

**Example:**
```tsx
// app/select/_layout.tsx
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useAuthGuard } from '@/lib/auth';
import { Stack } from 'expo-router';

export default function SelectLayout() {
  const bootstrap = useAppBootstrap();
  const authState = useAuthGuard(bootstrap.isReady, 'account-only');
  
  if (authState === 'loading') {
    return <LoadingOverlay />;
  }
  
  return <Stack />;
}
```

### Level: `'world-required'`

**What it checks:**
- User has an account and is authenticated
- User has access to the requested world
- World access is verified via cache-first approach with Supabase fallback

**Where to use:**
- `/main/*` - Main game screens (need account + world access)

**Latency:**
- Fresh cache (<2 hours): ~15ms
- Stale cache (2-4 hours): ~150ms (includes Supabase query)

**Example:**
```tsx
// app/main/_layout.tsx
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useAuthGuard } from '@/lib/auth';
import { Stack } from 'expo-router';

export default function MainLayout() {
  const bootstrap = useAppBootstrap();
  const authState = useAuthGuard(bootstrap.isReady, 'world-required');
  
  if (authState === 'loading') {
    return <LoadingOverlay />;
  }
  
  return <Stack />;
}
```

## Sensitive Pages - Force Verification

For security-critical operations (settings, admin, payments), you can force a fresh Supabase check regardless of cache age:

```tsx
// app/settings/_layout.tsx
export default function SettingsLayout() {
  const bootstrap = useAppBootstrap();
  const authState = useAuthGuard(
    bootstrap.isReady,
    'account-only',
    { forceVerification: true }  // Always check Supabase
  );
  
  if (authState === 'loading') {
    return <LoadingOverlay />;
  }
  
  return <Stack />;
}
```

**When to use `forceVerification`:**
- ✅ Settings pages (email, password changes)
- ✅ Admin panels (world management)
- ✅ Payment/subscription pages
- ❌ Character sheets (no sensitive data)
- ❌ NPC browsing (read-only)
- ❌ Journal reading (non-critical)

## How World Access Verification Works

When a user navigates to a world-required route, the guard must verify they have access to that world. It uses a cache-first strategy:

### Verification Flow

```
Guard gets worldId from URL params (?worldId=abc123)
    ↓
Check SecureStorage for "world_access_abc123"
    ↓
    ├─ Cache not found
    │  └─ Check Supabase
    │     ├─ Has access? → Cache as true, allow
    │     └─ No access? → Cache as false, redirect to /select
    │
    └─ Cache found, check age
       ├─ Fresh (<2 hours) ✓
       │  └─ Allow immediately (no Supabase call)
       │     └─ Latency: ~15ms
       │
       └─ Stale (2-4 hours) ⏳
          └─ Query Supabase in background
             ├─ Still has access? → Update cache, allow
             └─ Access revoked? → Update cache, redirect
             └─ Latency: ~150ms
```

### Cache Entry Structure

```typescript
// In SecureStorage (encrypted)
STORAGE_KEYS.world_access_abc123 = true

STORAGE_KEYS.world_access_meta_abc123 = {
  timestamp: 1705276800000,    // When this was cached
  source: 'supabase'           // Where data came from
}
```

### Cache Population

World access cache is populated automatically when:

1. **User loads worlds from server** - `useWorlds` hook loads worlds and caches each as `hasAccess=true`
2. **User selects a world** - `addConnectedWorld()` caches the world
3. **Guard verifies with Supabase** - Verification result is cached

Because the server only returns worlds the user can access, worlds loaded from server are safe to cache as `true` immediately.

### Network Error Handling

If Supabase query fails (network timeout, offline, etc.):
- User already in world: Continue with cached data
- User trying to enter: Use cached value or deny conservatively
- Never block user indefinitely on network errors

## How to Implement Protected Routes

### Step 1: Create Route Layout

Create `app/[section]/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useAuthGuard } from '@/lib/auth';
import { LoadingOverlay } from '@/components';

export default function MyProtectedLayout() {
  const bootstrap = useAppBootstrap();
  const authState = useAuthGuard(
    bootstrap.isReady,
    'account-only' // or 'world-required'
  );
  
  if (authState === 'loading') {
    return <LoadingOverlay />;
  }
  
  return <Stack />;
}
```

### Step 2: Add Screens Under That Section

Add screens like `app/[section]/screen1.tsx`, `app/[section]/screen2.tsx`, etc. They automatically use the guard from the layout.

### Step 3: No Duplicate Guards

Don't add additional auth checks in child layouts or screens. The top-level guard covers all nested routes.

## Authentication State Checks in Screens

Sometimes you need to check authentication state in a screen for conditional rendering:

```tsx
import { useAppParams } from '@/contexts/AppParamsContext';

export default function MyScreen() {
  const { worldId, userRole } = useAppParams();
  
  // worldId is guaranteed to exist (guard checked it)
  // userRole might be null (check before using)
  
  if (!userRole) {
    return <Text>Loading role...</Text>;
  }
  
  return <Text>You are a {userRole}</Text>;
}
```

For explicit auth state checks, use `AuthStateManager`:

```tsx
import { AuthStateManager } from '@/lib/auth';

export default function MyScreen() {
  const [hasAccount, setHasAccount] = useState(false);
  
  useEffect(() => {
    AuthStateManager.isAuthenticated().then(setHasAccount);
  }, []);
  
  return <Text>{hasAccount ? 'Logged in' : 'Not logged in'}</Text>;
}
```

## Common Issues & Solutions

### Issue: Redirect Loop

**Symptom:** User clicks → redirects → redirects again

**Cause:** Multiple guards checking same thing, or guard checking at wrong level

**Solution:** 
- Ensure only ONE guard per section
- Check logs for duplicate `[GUARD:START]` messages
- Verify guard level matches route requirements

### Issue: Stale Access Check

**Symptom:** User lost world access but can still navigate

**Cause:** Cache is too old (>4 hours) or was never verified

**Solution:**
- Cache auto-updates every 4 hours
- Force verification for sensitive operations: `{ forceVerification: true }`
- Implement real-time Supabase subscriptions (future enhancement)

### Issue: Deep Link Fails

**Symptom:** Direct URL to protected route doesn't work

**Cause:** Guard isn't in place, or worldId param missing

**Solution:**
- Add guard to layout file
- Test URL includes proper params: `/main/page?worldId=abc123`
- Check logs for `[GUARD:START]` messages

## Performance Optimization

### Reduce Database Calls

- Fresh cache (<2 hours): No Supabase call, instant access
- Only use Supabase when cache is stale (2-4 hours)
- Server's `getMyWorlds()` pre-populates cache

**Result:** 95%+ reduction in database queries

### Reduce Redirect Loops

- One guard per section (not multiple)
- Root layout doesn't check auth (delegates to sections)
- Each section has one clear responsibility

**Result:** Zero redirect loops

## Testing Guards

### Manual Test Checklist

```
Account-only routes:
- [ ] Unauthenticated → /index (welcome)
- [ ] Authenticated → Allowed to /select
- [ ] Refresh → Stay on /select (no loop)

World-required routes:
- [ ] No world access → Redirect to /select
- [ ] Has world access (fresh cache) → Allow instantly
- [ ] Has world access (stale cache) → Verify then allow
- [ ] Deep link with worldId → Works correctly

Sensitive pages:
- [ ] /settings with fresh cache → Force Supabase check
- [ ] /settings with network error → Still shows (grace period)
- [ ] Access revoked → Next navigation redirects
```

### Debugging with Logs

Guards log important events:

```
[GUARD:START] Starting auth check, level='world-required'
[VERIFY:START] Verifying world abc123
[VERIFY:FRESH] Cache is fresh, allowing immediately
[VERIFY:STALE] Cache is stale, checking Supabase...
[REDIRECT-TO-SELECT] User doesn't have world access
✅ Auth flow complete
```

Check console logs to verify guard behavior.
