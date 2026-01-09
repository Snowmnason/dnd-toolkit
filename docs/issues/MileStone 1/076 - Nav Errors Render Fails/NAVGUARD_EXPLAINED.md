# NavGuard & Route Protection System

## Purpose

The route protection system in `app/_layout.tsx` ensures:
1. **Auth Guard:** Users can't access protected routes without authentication
2. **World Guard (NavGuard):** Users can't access main app without selecting a valid world
3. **Admin Guard:** Admin-only routes verify admin status from Supabase
4. URL parameters stay in sync with app context
5. Users can't spoof URLs to access unauthorized content

## Architecture Overview

```
Root Layout (app/_layout.tsx)
├── Bootstrap (loads fonts, themes, auth session)
├── Auth Guard (validates authentication for protected routes)
└── World Guard (NavGuard) (validates world access on /main/* routes)

Individual Screens
└── Admin Guard (admin-panel validates isAdmin from Supabase)
```

## Protected Routes Configuration

**Defined in:** `lib/routing/route-config.ts`

```typescript
export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings'] as const,
  redirectOnUnauthenticated: '/login/welcome',
};
```

**Route Types:**
- **Public:** `/login/*`, `/web/*` - No authentication required
- **Protected:** `/select/*`, `/main/*`, `/settings/*` - Authentication required
- **Admin Only:** `/settings/admin-panel` - Authentication + admin status required

## How It Works - Step by Step

### 1. App Startup

```
User opens app
  ↓
app/_layout.tsx renders
  ↓
useAppBootstrap() loads:
  - Fonts & themes
  - User session from Supabase storage
  - Connected worlds cache from localStorage
  ↓
bootstrap.isReady = true
  ↓
Guards activate
```

### 2. Auth Guard (All Protected Routes)

```typescript
// In app/_layout.tsx
const authState = useAuthGuard(bootstrap.isReady)
```

**What it does:**
- Checks if user is authenticated via `AuthStateManager.isAuthenticated()`
- If on protected route (`/select`, `/main`, `/settings`) and NOT authenticated:
  - Redirects to `/login/welcome`
- Runs on every route change
- Blocks until `bootstrap.isReady = true`

**Protected routes:**
- `/select/*` - World selection (needs auth)
- `/main/*` - Main app (needs auth + world)
- `/settings/*` - User settings (needs auth)

**Public routes:**
- `/login/*` - Login flow (no auth needed)
- `/web/*` - Public web pages (no auth needed)

### 3. World Guard (NavGuard) - Main Route Protection

**Purpose:** Validates user has access to the worldId in the URL

```typescript
// In app/_layout.tsx, lines 177-240
useEffect(() => {
  // Only validate /main/* routes
  if (segments[0] !== 'main') return
  
  const validateWorldAccess = () => {
    // Parse worldId from URL
    const urlWorldId = new URLSearchParams(window.location.search).get('worldId')
    
    // Check if cache is loaded
    if (params.connectedWorldIds.length === 0) {
      // Wait for worlds to load
      return
    }
    
    // Validate access
    if (!urlWorldId || !hasAccessToWorld(urlWorldId)) {
      router.replace('/select/world-selection')
    }
  }
  
  // Validate on navigation
  validateWorldAccess()
  
  // Also validate on browser back/forward
  window.addEventListener('popstate', validateWorldAccess)
}, [segments, params.connectedWorldIds])
```

**Validation triggers:**
- ✅ Button clicks (programmatic navigation via `router.push`)
- ✅ Browser back/forward buttons (popstate event)
- ✅ Page refresh (cache loads from localStorage)
- ✅ Manual URL edits (setTimeout + window.location parsing)
- ✅ Cache population (effect re-runs when `connectedWorldIds` changes)

### 4. Admin Guard (Admin Panel Only)

**Location:** `app/settings/admin-panel.tsx`

```typescript
// Fetches fresh user data from Supabase
const user = await getCurrentUserProfile(true)

if (!user || !user.isAdmin) {
  setAuthorized(false)
  return
}

// Authorized - show admin panel
setAuthorized(true)
```

**How it works:**
- **Forces fresh Supabase fetch** (bypasses cache) to verify admin status
- Checks `user.isAdmin` boolean from database
- Shows unauthorized message if not admin
- Runs on component mount (every time admin-panel is accessed)

**Why separate from Auth Guard:**
- Admin status can change (promoted/demoted by another admin)
- Must verify with Supabase (can't trust localStorage)
- Only needed for one route (not worth global guard complexity)

## NavGuard Flow Diagram

```
User navigates to /main/main-landing?worldId=X
    ↓
NavGuard effect triggers
    ↓
┌─────────────────────────────────────────────┐
│ Step 1: Is this a /main/* route?           │
└─────────────────────────────────────────────┘
    ↓ YES
┌─────────────────────────────────────────────┐
│ Step 2: Wait for window.location sync      │
│ setTimeout(() => { ... }, 0)                │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Step 3: Parse worldId from URL             │
│ new URLSearchParams(window.location.search)│
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Step 4: Is cache populated?                │
│ params.connectedWorldIds.length > 0        │
└─────────────────────────────────────────────┘
    ↓ NO → Skip validation (wait for fetch)
    ↓ YES
┌─────────────────────────────────────────────┐
│ Step 5: Does URL have worldId?             │
│ if (!urlWorldId)                            │
└─────────────────────────────────────────────┘
    ↓ NO → Redirect to /select/world-selection
    ↓ YES
┌─────────────────────────────────────────────┐
│ Step 6: Is worldId in cache?               │
│ hasAccessToWorld(urlWorldId)               │
└─────────────────────────────────────────────┘
    ↓ NO → Redirect to /select/world-selection
    ↓ YES
    │ → Allow navigation ✅
```

## Context vs URL Parameters

### AppParamsContext (in-memory + localStorage)
```typescript
{
  userId: "144a1af7-...",
  worldId: "e525ed5b-...",
  userRole: "owner",
  connectedWorldIds: ["e525ed5b-...", "79eae182-...", "a1bf144c-..."]
}
```

**Stored in localStorage:**
- `dnd_user_data` - User profile (id, username, isAdmin)
- `dnd_connected_worlds` - Array of world IDs user has access to
- `sb-xxoibawslmysvfllozyb-auth-token` - Supabase auth session

**Updated by:**
- `updateParams({ worldId, userRole })` - called when selecting world
- NavGuard syncing from URL
- Bootstrap loading from localStorage on mount
- `setConnectedWorldIds()` - called after fetching worlds

### URL Parameters (Expo Router)
```
/main/main-landing?worldId=e525ed5b-...&userRole=owner
```

**Read via:**
```typescript
// Legacy approach (doesn't update on manual URL edits)
const urlParams = useLocalSearchParams()
const urlWorldId = urlParams.worldId

// NavGuard approach (catches manual edits)
const searchParams = new URLSearchParams(window.location.search)
const urlWorldId = searchParams.get('worldId')
```

**Set via:**
```typescript
router.push('/main/main-landing?worldId=X&userRole=Y')
```

## The Connected Worlds Cache

**Purpose:** Prevent race conditions and validate access instantly without Supabase calls

```typescript
// Populated when worlds are fetched (lib/worlds/useWorlds.ts)
const worldIds = userWorlds.map(w => w.world_id)
setConnectedWorldIds(worldIds)

// Stored in localStorage for instant access on refresh
localStorage.setItem('dnd_connected_worlds', JSON.stringify(worldIds))

// Checked by NavGuard
if (hasAccessToWorld(urlWorldId)) {
  // Allow navigation
} else {
  // Redirect to selection
}
```

**Benefits:**
- ✅ No Supabase call needed to validate access
- ✅ Instant validation when clicking "Open"
- ✅ Persists across page refreshes
- ✅ Prevents URL spoofing
- ✅ Allows bookmarking world URLs
- ✅ Lazy-loads actual world data after navigation allowed

**Cache invalidation:**
- Cleared on logout (`clearAllParams()`)
- Refreshed when visiting world selection screen
- Updates when worlds are fetched from Supabase

## Working Flow: Clicking "Open" on World

```
1. User on /select/world-selection
   - Worlds loaded from Supabase
   - connectedWorldIds cache populated: ['world1', 'world2', 'world3']
   - Cache saved to localStorage

2. User clicks "Open" button
   - WorldRightPanel calls:
     updateParams({ worldId: X, userRole: Y })
     router.push('/main/main-landing?worldId=X&userRole=Y')

3. Navigation starts
   - URL changes to /main/main-landing?worldId=X&userRole=Y
   - segments[0] = 'main'
   - Browser updates address bar

4. NavGuard effect fires
   - Sees segments[0] = 'main' ✅
   - Waits 1 microtask for window.location to sync
   - Parses worldId from window.location.search
   - urlWorldId = X ✅
   
5. NavGuard validation:
   - cacheIsPopulated = true (3 worlds in cache) ✅
   - hasAccessToWorld(X) = true (X is in cache) ✅
   - Logs: "✅ Valid world access, allowing navigation"
   - Returns (no redirect)

6. Main landing screen renders
   - First effect (lines 120-175) syncs URL → context
   - params.worldId = X, params.userRole = Y
   - Screen loads with world data ✅
```

## Working Flow: Page Refresh with World URL

```
1. User has URL: /main/main-landing?worldId=X&userRole=owner
   - Refreshes browser (F5)

2. App restarts
   - Bootstrap loads:
     - User session from Supabase storage ✅
     - connectedWorldIds from localStorage ✅
   - bootstrap.isReady = true

3. Expo Router mounts /main/main-landing

4. NavGuard effect fires
   - segments[0] = 'main' ✅
   - Cache already populated from localStorage ✅
   - Parses worldId from URL
   - urlWorldId = X ✅

5. NavGuard validation:
   - cacheIsPopulated = true ✅
   - hasAccessToWorld(X) = true ✅
   - Allows navigation instantly

6. Meanwhile, world selection screen loads in background
   - Fetches fresh worlds from Supabase
   - Updates cache (same 3 worlds)
   - No visible impact to user
```

## Working Flow: Manual URL Edit (Invalid World)

```
1. User manually edits URL:
   - Changes worldId=X to worldId=INVALID
   - Presses Enter

2. Browser navigates
   - window.location updates
   - segments stay 'main'

3. NavGuard effect may not trigger (segments unchanged)
   - But popstate event listener DOES trigger ✅

4. popstate calls validateWorldAccess():
   - Parses worldId from window.location
   - urlWorldId = INVALID
   - cacheIsPopulated = true
   - hasAccessToWorld(INVALID) = false ❌

5. NavGuard redirects:
   - Logs: "❌ REDIRECTING: worldId not in cache"
   - router.replace('/select/world-selection')
   - User sent back to world selection ✅
```

## Admin Panel Protection

**Route:** `/settings/admin-panel`

**Protection layers:**
1. **Auth Guard** - Requires authentication (like all /settings/* routes)
2. **Admin Guard** - Component-level admin verification

```typescript
// app/settings/admin-panel.tsx (lines 41-60)
useEffect(() => {
  async function init() {
    // Force fresh fetch from Supabase (bypass cache)
    const user = await getCurrentUserProfile(true)
    
    if (!user || !user.isAdmin) {
      setAuthorized(false)
      return
    }
    
    setAuthorized(true)
    // Load admin panel data...
  }
  init()
}, [])

// Render
if (!authorized) {
  return <Body>You do not have permission to access this page.</Body>
}
```

**Why not use NavGuard-style localStorage check?**
- Admin status can change dynamically (promoted/demoted by another admin)
- Must verify with Supabase on every access
- Security-critical - can't trust cached data
- Single route - doesn't need global guard complexity

**Why `isAdmin` in localStorage is safe for UX:**
- Used for showing/hiding admin links in UI
- Not used for authorization decisions
- Actual access controlled by Supabase RLS + component guard
- Worst case: user sees admin link but gets "unauthorized" message

## Debugging Tips

**NavGuard not triggering?**
- Check `bootstrap.isReady` - guards wait for this
- Check `segments[0]` - must be 'main' for NavGuard
- Check effect dependencies - triggers on segments, cache changes
- Try browser back button - popstate should still validate

**Cache not loading?**
- Check localStorage for `dnd_connected_worlds`
- Check AppParamsContext mount - loads on `useEffect`
- Check worlds fetch - calls `setConnectedWorldIds()`
- Clear localStorage and refetch worlds to rebuild cache

**Validation failing incorrectly?**
- Log `params.connectedWorldIds` and `urlWorldId`
- Check `hasAccessToWorld()` logic
- Verify worldId format matches (UUID string)
- Check if cache was cleared by `clearAllParams()`

## Files Involved

- **`app/_layout.tsx`** (lines 177-240) - NavGuard logic, Auth Guard
- **`contexts/AppParamsContext.tsx`** - In-memory state + localStorage persistence
- **`lib/auth/useAuthGuard.ts`** - Auth guard hook
- **`lib/routing/route-config.ts`** - AUTH_CONFIG (protected routes list)
- **`app/settings/admin-panel.tsx`** - Admin-only route with component-level guard
- **`Screens/select/world-selection/WorldRightPanel.tsx`** - "Open" button navigation
- **`lib/navigation/uri-helpers.ts`** - buildNavigationTarget helper
- **`lib/worlds/useWorlds.ts`** - Populates connectedWorldIds cache
- **`lib/database/common.ts`** - getCurrentUserProfile (admin verification)

## Summary

**Three-tier protection:**
1. **Auth Guard** - Global authentication check for all protected routes
2. **World Guard (NavGuard)** - Validates world access for /main/* routes using cache
3. **Admin Guard** - Component-level Supabase verification for admin panel

**Cache-first design:**
- Fast validation without network calls
- Persists across refreshes
- Catches URL spoofing attempts
- Validates on all navigation types (buttons, browser nav, manual edits)

**Security model:**
- localStorage for UX (quick checks, instant feedback)
- Supabase for authorization (final authority, RLS policies)
- Component guards for sensitive routes (admin panel)
- NavGuard prevents accessing invalid worlds before API calls
