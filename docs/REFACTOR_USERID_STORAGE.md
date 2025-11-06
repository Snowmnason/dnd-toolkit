# User ID Storage Refactoring

## Summary
Refactored the application to save user information to local storage instead of passing `userId` through URL parameters. This reduces database calls and simplifies navigation logic.

## Changes Made

### 1. Auth State Manager (`lib/auth-state.ts`)
**Added:**
- `StoredUserData` interface for typed user data storage
- `saveUserData()` - Save complete user profile to local storage
- `getUserData()` - Retrieve user profile from local storage
- `getUserId()` - Convenience method to get just the userId

**Modified:**
- `clearAuthState()` - Now also clears stored user data on logout
- Storage key `USER_DATA` added for user information persistence

### 2. Users Database (`lib/database/users.ts`)
**Modified:**
- `getCurrentUser()` - Now saves user data to storage after fetching from database
- `create()` - Saves newly created user profile to storage
- `updateCurrentUser()` - Updates storage when profile is modified

### 3. App Params Context (`contexts/AppParamsContext.tsx`)
**Added:**
- `useEffect` hook to load userId from storage on app mount
- Auto-population of userId from local storage instead of URL params

### 4. Navigation Hooks

#### `hooks/use-app-navigation.tsx`
**Removed:**
- userId from URL route parameters
- Comments added explaining userId is now in storage

#### `hooks/use-success-navigation.tsx`
**Removed:**
- userId from all navigation calls
- Removed unused `useAppParams` import

### 5. Route Files - Removed userId from URLs

#### Login Routes
- `app/login/auth-redirect.tsx` - Removed userId from navigation, kept in context
- `app/login/complete-profile.tsx` - Removed userId from world-selection navigation
- `app/login/email-confirmation.tsx` - Removed userId from world-selection navigation

#### Select Routes
- `app/select/world-selection.tsx` - Removed userId from create-world navigation
- `app/select/world-detail/[worldName].tsx` - Removed userId from all route params

#### Main Routes
- `app/main/mobile.tsx` - Removed userId param, no longer passed to PanelView
- `app/main/desktop.tsx` - Removed userId param, no longer passed to PanelView
- `app/main/_layout.tsx` - Removed userId from tab navigation params

#### Root Routes
- `app/index.tsx` - Removed userId from initial routing navigation
- `app/_layout.tsx` - Removed userId URL param syncing, kept context syncing for worldId/userRole only

### 6. Component Updates

#### `components/TopBar.tsx`
**Removed:**
- userId from settings navigation
- userId from world-selection navigation

#### `components/main-panels/PanelView.tsx`
**Removed:**
- `userId` from interface props
- `userId` from route parameters when navigating to features

### 7. Library Exports (`lib/index.ts`)
**Fixed:**
- Corrected auth-state export path from `./auth/auth-state` to `./auth-state`

## How It Works

### On Login/Signup
1. User authenticates via Supabase
2. User profile is fetched from database
3. Profile is automatically saved to local storage
4. userId is loaded into AppParamsContext from storage

### On App Launch
1. AppParamsContext mounts and loads userId from storage
2. userId is available globally via `useAppParams()`
3. No need to pass userId through URLs

### Accessing User ID
```typescript
// In any component
const { params } = useAppParams();
const userId = params.userId; // Loaded from storage

// Or directly from storage
import { AuthStateManager } from '@/lib';
const userId = await AuthStateManager.getUserId();
```

### On Logout
```typescript
await AuthStateManager.clearAuthState();
// Clears both session and stored user data
```

## Benefits

1. **Reduced Database Calls**: User ID retrieved from storage instead of database
2. **Cleaner URLs**: No userId cluttering URL parameters
3. **Better UX**: Faster navigation without DB lookups
4. **Simpler Code**: Less parameter passing through navigation
5. **Persistent State**: User info persists across app refreshes

## Migration Notes

- All existing userId URL parameters have been removed
- userId is still available in `params.userId` via context (loaded from storage)
- `worldId` and `userRole` remain in URLs as they're session-specific
- No database schema changes required
- Works on both web (localStorage) and mobile (encrypted storage)

## Testing Checklist

- [ ] Login flow saves userId to storage
- [ ] Signup flow saves userId to storage  
- [ ] App launch loads userId from storage into context
- [ ] World selection works without userId in URL
- [ ] World creation works without userId in URL
- [ ] Main app navigation works without userId in URL
- [ ] Settings navigation works without userId in URL
- [ ] Logout clears stored user data
- [ ] Web and mobile platforms both work correctly
