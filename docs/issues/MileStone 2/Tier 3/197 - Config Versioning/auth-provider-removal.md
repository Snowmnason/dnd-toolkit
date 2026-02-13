# Auth Provider Removal - Code Cleanup

**Issue Type:** 🧹 Refactor / Tech Debt

## Problem

The `AuthProvider` component and related code were legacy/dead code no longer used in the application:

1. **Not in Provider Tree:** `auth-provider.tsx` was not imported or used in `app/_layout.tsx`
2. **Unused Components:** `SplashScreenController` was never rendered anywhere
3. **Redundant Abstraction:** App uses `AuthStateManager` + `usersDB.getCurrentUser()` directly, making the React Context wrapper unnecessary
4. **Direct Supabase Calls:** Auth provider made raw Supabase queries instead of using the database layer (`lib/database/users.ts`)

## Solution

**Removed Files:**
- ✅ `providers/auth-provider.tsx` (160 lines)
- ✅ `components/built-in/splash-screen-controller.tsx` (18 lines)
- ✅ `hooks/auth/use-auth-context.tsx` (18 lines)

**Updated Files:**
- ✅ `hooks/auth/index.ts` - Removed exports
- ✅ `providers/README.md` - Removed AuthProvider documentation

**What Remains:**
- ✅ `useSplashScreen` hook (uses AppKernel directly)
- ✅ `AuthStateManager` (lib/auth/auth-state.ts)
- ✅ `usersDB.getCurrentUser()` (lib/database/users.ts)
- ✅ All auth functionality works identically

## Scope

**Removed:** ~200 lines of dead code  
**Risk Level:** 🟢 Zero - Code was not used anywhere  
**Breaking:** No - No consumers existed

## Acceptance Criteria

- [x] Auth provider files deleted
- [x] TypeScript compilation passes
- [x] No references to removed exports remain
- [x] App splash screen still works (uses `useSplashScreen`)
- [x] Auth flow unchanged (uses `AuthStateManager` + `usersDB`)

## Notes

**Why This Was Safe:**
- `grep` confirmed no `<AuthProvider>` usage in app
- `useAuthContext()` only used by never-rendered `SplashScreenController`
- App actually uses `useSplashScreen` (hooks/ui/use-splash-screen.tsx) which queries AppKernel directly
- All auth checks go through `AuthStateManager` or `usersDB.getCurrentUser()`

**Context:**
This cleanup was discovered during Phase D of migration 197 (database schema updates). When reviewing `providers/auth-provider.tsx` for a schema prefix update, realized it was making direct Supabase calls AND wasn't even used in the app.
