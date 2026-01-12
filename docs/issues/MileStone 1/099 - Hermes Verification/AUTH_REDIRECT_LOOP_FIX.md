# Auth Redirect Loop Fix

## Issue Summary

During testing of Issue #99 (Hermes Engine Verification), a critical auth redirect loop was discovered where the app would oscillate between `/login/welcome` and `/select/world-selection` screens after login.

## Root Cause

The issue was a **race condition** in the authentication guard system:

1. **Auth check ran before subscription established**: The `useAuthGuard` hook would check authentication status immediately on protected routes, but the Supabase auth subscription hadn't finished establishing yet.

2. **Session sync timing**: When a user logged in, Supabase had a valid session, but the local storage (`hasAccount` flag) wasn't immediately synced. The auth check would see `hasAccount=false` and redirect to login, creating an infinite loop.

3. **Subscription events not triggering re-checks**: The auth guard used `useRef` for subscription readiness, which doesn't trigger React re-renders, so the auth check effect never re-ran after the subscription established.

## Solution

### 1. Subscription Ready State Management

**File:** `lib/auth/useAuthGuard.ts`

- Added `subscriptionReady` state (useState) to track when Supabase subscription is established
- Subscription effect now calls `setSubscriptionReady(true)` when first auth event is received
- Auth check effect waits for `subscriptionReady=true` before running on protected routes

### 2. Immediate Session Sync

**File:** `lib/auth/useAuthGuard.ts`

- On `INITIAL_SESSION` and `SIGNED_IN` events, immediately sync Supabase session to local storage
- Calls `AuthStateManager.setHasAccount(true)` to ensure `isAuthenticated()` returns true

### 3. Prevent Redirect Loops

**File:** `app/login/welcome.tsx`

- Added `hasCheckedAuth` state to prevent repeated auth checks on component re-mounts
- Auth check runs only once per component lifecycle to avoid infinite redirects

### 4. Enhanced Logging

Added instance IDs to all auth-related logs for easier debugging:
- `[GUARD:xxx]` - Auth guard hook instances
- `[SESSION:xxx]` - Root layout renders
- `[CMP:xxx]` - Welcome screen component mounts

## Files Changed

### Core Fix
- `lib/auth/useAuthGuard.ts` - Subscription ready state + session sync
- `app/login/welcome.tsx` - Prevent redirect loops
- `lib/auth/auth-state.ts` - Simplified to plain JSON storage (removed feature flag hack)

### Cleanup (Removed)
- `config/appsettings.dev.json` - Removed `cacheVersioning` feature flag
- `config/appsettings.json` - Removed `cacheVersioning` feature flag
- `lib/storage/SecureStorage.ts` - Removed feature flag conditionals

## Testing Scenarios

### ✅ Should Work
1. **Fresh login**: User signs in → redirected to `/select/world-selection`
2. **Refresh on protected route**: Page refresh → stays on protected route (no redirect loop)
3. **Direct URL access**: Typing `/select/world-selection` → redirects to login if not authenticated
4. **Logout**: User logs out → redirected to `/login/welcome`

### ❌ Should Not Happen
- Infinite redirect loop between login and select screens
- Authenticated users getting stuck on welcome screen
- Unauthenticated users bypassing protected routes

## Why This Fix Works

1. **Eliminates race condition**: Auth checks wait for subscription to establish
2. **Immediate sync**: Session state is synced to local storage as soon as Supabase confirms it
3. **Proper re-rendering**: useState triggers effect re-runs when subscription becomes ready
4. **Loop prevention**: One-time auth checks prevent repeated redirects

## Production Safety

This fix is **production-safe** because:
- Uses existing storage patterns (plain JSON, no versioning)
- Maintains all existing auth flows
- Adds defensive checks without changing core logic
- Includes proper error handling and fallbacks

## Future Considerations

If this issue reoccurs:
1. Check subscription establishment timing
2. Verify session sync is working in `onAuthStateChange`
3. Look for multiple auth checks running simultaneously
4. Ensure `subscriptionReady` state changes are triggering re-renders

## Related Issues

- Issue #99: Hermes Engine Verification (original scope)
- Issue #23: Centralize Auth Guard (related auth system work)</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 1\099 - Hermes Verification\AUTH_REDIRECT_LOOP_FIX.md