# Auth Guard Usage

Purpose: Centralize authentication checks for protected routes, reduce duplication, and ensure consistent behavior across platforms.

## Overview
- Guard: `useAuthGuard` from `@/lib`.
- Config: `AUTH_CONFIG` in `@/lib/routing/route-config` defines protected/public route segments and redirect path.
- Behavior: Waits for app bootstrap, checks auth via `AuthStateManager.isAuthenticated()`, subscribes to Supabase `onAuthStateChange`, and redirects unauthenticated users away from protected routes.

## Import
```ts
import { useAuthGuard, AUTH_CONFIG } from '@/lib';
```

## Typical Layout Usage
Use the guard in route layouts instead of local `useEffect` checks.
```tsx
import { AppLoading, AppPage } from '@/components/ui';
import { useAuthGuard } from '@/lib';
import { Stack } from 'expo-router';

export default function ProtectedLayout() {
  const authState = useAuthGuard();

  if (authState === 'loading') {
    return <AppLoading />;
  }

  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}
```

## Root Layout Integration
`app/_layout.tsx` should:
- Determine if the current segment is protected via `AUTH_CONFIG.protectedRoutes`.
- Use `useAuthGuard()` and the existing `useAppBootstrap()` to gate rendering and show `LoadingOverlay` while checking.
- Avoid duplicate checks in child layouts.

Notes:
- Login flow (`login/*`) and web downloads (`web/*`) are public; guard does not block them.
- The guard redirects unauthenticated access to `AUTH_CONFIG.redirectOnUnauthenticated`.

## Sensitive Screens Double-Check
For highly sensitive views (e.g., `settings/[username].tsx`) keep a clean, explicit session check:
```tsx
import { supabase } from '@/lib';
import type { Session, User } from '@supabase/supabase-js';

// Inside an effect
const { data: { session } } = await supabase.auth.getSession();
const user: User | null = session?.user ?? null;
if (!user || !user.email_confirmed_at) {
  router.replace('/login/welcome');
  return;
}
```
This complements the guard and ensures the session is valid and email-confirmed before showing sensitive data.

## Route Configuration
Update `AUTH_CONFIG` to add or remove protected segments:
```ts
export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings'] as const,
  publicRoutes: ['login', 'web'] as const,
  redirectOnUnauthenticated: '/login/welcome' as const,
};
```
Use only top-level segments for protection decisions (e.g., `main`, not nested paths).

## Lifecycle & Subscriptions
- Guard waits for `bootstrap.isReady` (fonts/images/session preloaded) to avoid flicker.
- Subscribes to Supabase `onAuthStateChange` to catch sign-out and token invalidation; redirects away from protected routes on loss of session.

## Do/Don't
- Do: Use `useAuthGuard()` in protected layouts (`app/main/_layout.tsx`, `app/select/_layout.tsx`).
- Do: Keep minimal loading states in layouts; the guard handles redirect.
- Do: Keep explicit Supabase checks on sensitive screens when needed.
- Don't: Duplicate `AuthStateManager.isAuthenticated()` in multiple layouts.
- Don't: Block `login/*` or `web/*` routes.

## Looking Ahead
This guard and `AUTH_CONFIG` will be used by the upcoming Navigation/TopBar service extraction. Keeping protected/public segments centralized ensures header logic remains consistent across route changes.
