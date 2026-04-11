# Navigation System Architecture

This document explains how the D&D Toolkit navigation system works, from routing to authentication guards to parameter passing.

## System Overview

The navigation system is built on **Expo Router** (file-based routing) with three layers:

1. **Route Structure** (`app/` folder)
   - Expo Router creates routes from file structure
   - Each directory can have a `_layout.tsx` for nested layout
   
2. **Route Guards** (`lib/auth/useAuthGuard.ts`)
   - Protect routes based on authentication level
   - Two levels: `'account-only'` (needs auth), `'world-required'` (needs auth + world access)
   - Each protected section has exactly ONE guard in its layout file

3. **Parameter Context** (`contexts/AppParamsContext.tsx`)
   - Current `worldId` and `userRole` available to all screens
   - Merges URL params from Expo Router with app state
   - Updates when user navigates between worlds

## Route Structure

```
app/
├── _layout.tsx                    ← Root layout (provides all providers)
├── index.tsx                      ← Welcome screen (public)
├── login/
│   ├── _layout.tsx               ← Public, no guard
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── select/
│   ├── _layout.tsx               ← Guard: 'account-only'
│   └── world-selection/
│       └── ...
├── main/
│   ├── _layout.tsx               ← Guard: 'world-required'
│   ├── main-landing.tsx
│   ├── characters/
│   │   ├── _layout.tsx
│   │   └── ...
│   ├── npcs/
│   │   └── ...
│   └── journal/
│       └── ...
├── settings/
│   ├── _layout.tsx               ← Guard: 'account-only' + forceVerification
│   └── [username].tsx
└── web/
    └── _layout.tsx               ← Public, no guard
```

## Authentication Guards

Guards protect routes by checking:
1. Is the user authenticated? (has an account)
2. If world-required: Does the user have access to the requested world?

### Guard Levels

**`'account-only'`**
- Requires: Authenticated user
- Routes: `/select/*`, `/settings/*`
- Verification: Instant (just checks `hasAccount`)
- Example:
  ```tsx
  // app/select/_layout.tsx
  export default function SelectLayout() {
    const bootstrap = useAppBootstrap();
    const authState = useAuthGuard(bootstrap.isReady, 'account-only');
    
    if (authState === 'loading') return <LoadingOverlay />;
    return <Stack />;
  }
  ```

**`'world-required'`**
- Requires: Authenticated user + world access verification
- Routes: `/main/*`
- Verification: Cache-first (see "World Access Verification" section)
- Example:
  ```tsx
  // app/main/_layout.tsx
  export default function MainLayout() {
    const bootstrap = useAppBootstrap();
    const authState = useAuthGuard(bootstrap.isReady, 'world-required');
    
    if (authState === 'loading') return <LoadingOverlay />;
    return <Stack />;
  }
  ```

**`'account-only'` with Force Verification**
- Requires: Authenticated user + fresh Supabase check
- Routes: `/settings/*` (sensitive data)
- Verification: Always checks Supabase, ignores cache age
- Example:
  ```tsx
  // app/settings/_layout.tsx
  export default function SettingsLayout() {
    const bootstrap = useAppBootstrap();
    const authState = useAuthGuard(
      bootstrap.isReady,
      'account-only',
      { forceVerification: true }  // Always check Supabase
    );
    
    if (authState === 'loading') return <LoadingOverlay />;
    return <Stack />;
  }
  ```

## World Access Verification

When a user tries to navigate to `/main/*`, the guard must verify they have access to that world.

### Cache-First Strategy

World access is cached locally and verified against Supabase with a staleness threshold:

```
User navigates to /main/main-landing?worldId=abc123
                    ↓
[GUARD] Check if authenticated
                    ↓
[GUARD] worldId = 'abc123'
                    ↓
[VERIFY] Load cache for world abc123
                    ↓
        Cache hit? ─→ Check cache age
        │
        └─→ Yes, check age
            │
            ├─→ Fresh (<2 hours) ✓
            │   └─→ Allow immediately (~15ms)
            │       No Supabase call
            │
            └─→ Stale (2-4 hours) ⏳
                └─→ Query Supabase for verification (~150ms)
                    ├─→ Supabase says YES ✓
                    │   └─→ Update cache, allow
                    │
                    └─→ Supabase says NO ✗
                        └─→ Update cache, redirect to /select
```

### Verification Details

**Fresh Cache (<2 hours):**
- No Supabase query needed
- User enters world instantly
- Database load minimized
- Use for: Character sheets, NPCs, journal (read-only data)

**Stale Cache (2-4 hours):**
- Query Supabase before allowing access
- Slower but still acceptable (~150ms)
- Catches access changes (e.g., DM removed you from world)
- Use for: Regular navigation after long session

**Force Verification (Sensitive Pages):**
- Always query Supabase, ignore cache age
- Ensures latest permissions
- Use for: Settings, admin pages, destructive actions

### Cache Structure

All world access data is encrypted via `SecureStorage`:

```typescript
// Cache entry for world "abc123"
STORAGE_KEYS.world_access_abc123 = true  // boolean: do I have access?

// Metadata entry
STORAGE_KEYS.world_access_meta_abc123 = {
  timestamp: 1705276800000,  // When cache was last updated
  source: 'supabase'         // Where data came from
}
```

When a user loads worlds from the server (via `useWorlds` hook), all loaded worlds are immediately cached as `hasAccess=true` because the server only returns worlds the user can access.

## Parameter Passing

### URL Parameters

Expo Router extracts URL parameters via `useLocalSearchParams()`. Common parameters:

```typescript
// Route: /main/main-landing?worldId=abc123
const params = useLocalSearchParams();
const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;

// Can also be used in deep links
// Direct URL: myapp.com/main/main-landing?worldId=abc123
```

### Context Parameters

`AppParamsContext` makes parameters available app-wide:

```typescript
// In any screen
import { useAppParams } from '@/contexts/AppParamsContext';

export default function MyScreen() {
  const { worldId, userRole } = useAppParams();
  
  // worldId and userRole are now available
  // No need to pass as props through entire tree
}
```

Context is updated when:
- User navigates to a new world (URL changes)
- User selects a world from the selection screen
- App restores session on startup

## Common Flows

### Authentication Flow

```
User opens app
    ↓
Bootstrap loads (fonts, themes, images)
    ↓
Splash screen covers wait
    ↓
Bootstrap complete
    ↓
Root layout renders
    ↓
Check auth state (from SecureStorage)
    ↓
[Has account?]
├─ NO → Show /index (welcome screen)
│        └─ Can sign in from here
│
└─ YES → Check routing decision
         ├─ Go to /select/world-selection (choose world)
         └─ Guard at /select checks account-only level
            └─ Allows (you have account)
```

### World Selection Flow

```
User on /select/world-selection
    ↓
Server loads user's accessible worlds
    ↓
[For each world]
└─ Cache as hasAccess=true (server only returns accessible worlds)
    ↓
User clicks "Open" on a world
    ↓
addConnectedWorld(worldId)  ← Updates context
    ↓
router.push(/main/main-landing?worldId=X)
    ↓
Guard at /main checks 'world-required'
    ├─ Authenticated? YES ✓
    ├─ Has world access?
    │  └─ Check cache (fresh/stale)
    │     └─ Cached as true from server load ✓
    │
    └─ Allow, render main layout
```

### Deep Linking Flow

```
User clicks link: myapp.com/main/main-landing?worldId=abc123
    ↓
App loads
    ↓
Splash screen waits for bootstrap
    ↓
Expo Router navigates directly to target route
    ↓
/main/_layout guard runs (before screen renders)
    ├─ Authenticated? (check SecureStorage)
    │  └─ YES ✓
    ├─ World access? (check cache/Supabase)
    │  └─ Query Supabase (cache likely missing)
    │     └─ YES ✓ (or NO → redirect to /select)
    │
    └─ Render /main/main-landing
```

## Root Layout Responsibilities

`app/_layout.tsx` is the root of all navigation. It:

1. **Provides contexts**: ThemeProvider → ScaleProvider → PlatformProvider → AppParamsProvider
2. **Waits for bootstrap**: Splash screen covers app until fonts/images loaded
3. **Determines current route**: Reads URL segments
4. **Delegates guards to child layouts**: Does NOT do auth checks itself

Root layout does NOT:
- ❌ Check authentication
- ❌ Redirect based on auth state
- ❌ Run auth subscription

These are handled by individual protected layouts.

## Error Handling

### Authentication Errors

If authentication check fails (network, Supabase down, etc.):
- For fresh cache: Continue with cached data
- For stale cache needing verification: Allow with cached data while retrying
- Don't block user on network errors

### World Access Errors

If world access verification fails:
- User already in world: Stay in world, retry in background
- User trying to enter: Fall back to fresh cache or deny access
- Network error: Allow if cache permits, retry later

### Route Not Found

Expo Router handles 404s via `expo-router/not-found`. Unmatched routes show error boundary.

## Best Practices

✅ **DO:**
- Use guards in `_layout.tsx` files
- Use `AppParamsContext` for world/user info (not prop drilling)
- Cache world access when loaded from server
- Keep route configs centralized
- Use `useAuthGuard` with appropriate levels

❌ **DON'T:**
- Add auth checks in individual screens
- Duplicate guard checks in nested layouts
- Pass worldId as props through entire tree
- Hardcode redirect logic in components
- Trust URL params for sensitive operations (verify with Supabase)

## Testing Navigation

### Manual Testing Checklist

- [ ] **Unauthenticated**: Open app with no session → See /index
- [ ] **Sign in**: /login/sign-in → /select/world-selection
- [ ] **Select world**: Click "Open" → /main/main-landing?worldId=X
- [ ] **Refresh**: Stay on /main (no redirect loop)
- [ ] **Deep link**: Direct URL to /main → Works correctly
- [ ] **No access**: Try accessing world you don't have → /select
- [ ] **Settings**: Click settings → /settings (force verification runs)
- [ ] **Sign out**: /select → /index

### Performance Checklist

- [ ] **Latency**: Auth check <15ms (fresh), <150ms (stale)
- [ ] **DB calls**: Only when cache is stale (2+ hours)
- [ ] **No loops**: Unauthenticated user never redirects twice
- [ ] **Deep links**: Work without full bootstrap

## Future Enhancements

- **Role-based guards**: Check DM/player role before rendering screens
- **Permission controls**: Show/hide features based on permissions
- **Real-time updates**: Supabase Realtime for instant access changes
- **Offline mode**: Work with worlds without network connection
