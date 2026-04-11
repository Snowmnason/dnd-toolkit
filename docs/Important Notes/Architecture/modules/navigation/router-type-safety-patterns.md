# Router Type Safety Patterns in dnd-toolkit

## Overview
This document catalogues how `router.push()` and `router.replace()` are used throughout the codebase, with focus on type safety, type casting patterns, and auth redirects.

---

## 1. Type Casting Patterns

### Pattern 1: Direct `as any` Casting (Most Common)

**Usage:** Simple string routes or computed routes that need type override

```typescript
// Example: app/_layout.tsx (lines 291, 355, 380, 393)
router.replace(target as any);
router.push(target as any);

// Used with:
const target = getNavigationTarget(kernel.safeMode?.reason);
const target = buildNavigationTarget('/main/characters', { worldId }, ['worldId']);
```

**Files using this pattern:**
- `app/_layout.tsx` - 4 instances
- `hooks/navigation/use-navigate.tsx` - 2 instances (push, replace)
- `hooks/navigation/use-app-navigation.tsx` - 3 instances
- `hooks/navigation/use-success-navigation.tsx` - 3 instances
- `hooks/auth/useAuthFlow.ts` - 2 instances
- `hooks/auth/useSignUpFlow.ts` - 2 instances
- `components/SplashScreen/NavigationErrorScreen.tsx` - 1 instance
- `lib/error/safemode/navigation-guards.ts` - 1 instance

**Trade-off:** Loses type checking but simplifies computed/dynamic routes

### Pattern 2: `as unknown as Href` Casting

**Usage:** More explicit cast chain for clarity about the type bridge

```typescript
// Example: lib/error/safemode/navigation-guards.ts (line 110)
router.push(fallbackRoute as unknown as Href);

// With computed string
const fallbackRoute = options.fallbackRoute || "/select/world-selection";
router.push(fallbackRoute as unknown as Href);
```

**Notable:** Shows explicit intent that we're converting from string → Href type

### Pattern 3: No Casting (String Literals)

**Usage:** Simple string routes where TypeScript infers correctly

```typescript
// Example: app/login/sign-in.tsx (line 40)
router.replace('/select/world-selection');

// Example: app/login/forgot-password.tsx (lines 70, 113, 144)
router.replace('/login/sign-in');
router.push('/login/sign-up');

// Example: app/index.tsx (line 23)
router.replace("/select/world-selection");

// From Screens/Welcome.tsx
router.push('/login/sign-in');
router.push('/login/sign-up');
```

**Pattern:** Works when:
- Route is a string literal
- Route is known at compile time
- No parameters needed

---

## 2. Route Handling: String vs Route Objects

### String Routes (Simple Cases)

```typescript
// Direct string - simplest approach
router.push('/login/sign-in');
router.replace('/select/world-selection');
```

### Route Objects with Pathname + Params

```typescript
// Example: hooks/navigation/use-guarded-navigation.ts (lines 164, 166, 192)
router.replace({ pathname: toRoute, params });
router.push({ pathname: toRoute, params });

// buildNavigationTarget creates a URL-encoded string
router.push({ pathname: route, params });
```

### Built Route Strings (Encoded)

```typescript
// buildRoute() encodes params into query string
// Example: lib/navigation/uri-helpers.ts
buildRoute('/main/characters', { worldId: '123', tab: 'npcs' })
// => '/main/characters?worldId=123&tab=npcs'

// Then cast to router
const target = buildRoute(targetPath, params);
router.push(target as any);
```

### Comparison Matrix

| Method | Type Safety | Params | Usage |
|--------|------------|--------|-------|
| String literal | ✅ High | ❌ None | Simple routes |
| `{ pathname, params }` | ✅ High | ✅ Yes | Auth flows with typed objects |
| Encoded string (`buildRoute`) | ⚠️ Medium | ✅ Yes | Dynamic routes with preserved params |
| Computed string + `as any` | ❌ Low | ✅ Yes | Complex logic, fallback routes |

---

## 3. Auth Redirects (Redirect Patterns)

### Primary Auth Entry Points

```typescript
// Sign-In Success → World Selection
// Example: app/login/sign-in.tsx (line 40)
router.replace('/select/world-selection');

// Sign-Up Success → Complete Profile OR World Selection
// Example: hooks/auth/useSignUpFlow.ts (line 154)
router.replace(result.redirectTo as any)  // redirectTo determined by auth manager

// Complete Profile Success → World Selection
// Example: hooks/auth/useSignUpFlow.ts (line 196)
router.replace(buildRoute('/select/world-selection') as any)
```

### Login → Sign-In/Sign-Up Links

```typescript
// From sign-up to sign-in
// app/login/sign-up.tsx (line 105)
router.push("/login/sign-in");

// From forgot password to sign-in
// app/login/forgot-password.tsx (line 70, 113)
router.replace('/login/sign-in');

// Back to main from login
// app/login/sign-up.tsx (line 37)
router.replace("/");
```

### Auth Redirect Logic (Complex Routing)

```typescript
// File: app/login/auth-redirect.tsx (lines 123-163)

// Logic: Check auth state → determine destination
if (hasWorldAccess) {
  router.replace("/select/world-selection");
} else if (needsProfileCompletion) {
  router.replace("/login/complete-profile");
} else if (needsPasswordReset) {
  router.replace("/login/reset-password");
} else if (isUnauthenticated) {
  router.replace("/login/sign-in");  // or sign-up
  router.replace("/");
}
```

### Post-Social Auth Navigation

```typescript
// Example: hooks/auth/useAuthFlow.ts (lines 164-172)
async function navigateAfterSocialAuth(router) {
  const userProfile = await usersDB.getCurrentUser();
  if (userProfile?.username) {
    router.replace('/select/world-selection');
  } else {
    router.replace('/login/sign-up');  // Need to complete profile first
  }
}
```

### Guarded Navigation with Policy Enforcement

```typescript
// File: hooks/navigation/use-guarded-navigation.ts (lines 99-111)

// Silent redirect for auth failures
if (decision.target === '/login' || decision.target === '/auth' || decision.target === '/') {
  router.replace(decision.target);  // No casting needed - string
} else {
  // Show modal for other failures (permissions, etc.)
  showNavFailureModal();
}
```

---

## 4. Helper Functions and Abstraction Layers

### buildNavigationTarget (URL with Preserved Params)

```typescript
// Signature from lib/navigation/uri-helpers.ts
export function buildNavigationTarget(
  targetPath: string,
  currentParams: RouteParams,      // Current URL params
  keysToPreserve: string[],         // Which params to keep
  additionalParams?: RouteParams    // Extra params to add
): string;

// Returns encoded string: '/path?key1=val1&key2=val2'

// Usage example: app/_layout.tsx (line 374)
const target = buildNavigationTarget(
  '/settings/username',
  { worldId, userRole },
  ['worldId', 'userRole']
);
router.push(target as any);
```

### buildRoute (Simple Route with Params)

```typescript
// Signature from lib/navigation/uri-helpers.ts
export function buildRoute(
  path: string,
  params?: RouteParams
): string;

// Returns encoded string: '/path?key1=val1&key2=val2'

// Usage example: hooks/auth/useSignUpFlow.ts (line 196)
router.replace(buildRoute('/select/world-selection') as any)
```

### useGuardedNavigation (Typed Navigation with Middleware)

```typescript
// Signature from hooks/navigation/use-guarded-navigation.ts
export interface GuardedNavigationAPI {
  push: (route: string, params?: Record<string, any>) => Promise<void>;
  replace: (route: string, params?: Record<string, any>) => Promise<void>;
  back: () => void;
  openModal: (route: string, params?: Record<string, any>) => void;
  navFailure: NavigationFailureState;
  dismissNavFailure: () => void;
}

// Usage: Routes through NavManager policy checks before navigating
const navigate = useGuardedNavigation();
await navigate.push('/main/characters', { worldId: '123' });

// Internally:
// 1. Validates context (auth, permissions, platform)
// 2. Gets decision from NavManager
// 3. On redirect: router.replace(decision.target)
// 4. On abort: shows NavFailureModal
```

### useNavigate (Simple Navigation Builder)

```typescript
// Signature from hooks/navigation/use-navigate.tsx
export function useNavigate() {
  const replace = (path, params?, preserve?) => {
    const target = buildNavigationTarget(path, params, preserve);
    router.replace(target as any);
  };
  
  const push = (path, params?, preserve?) => {
    const target = buildNavigationTarget(path, params, preserve);
    router.push(target as any);
  };
  
  const route = (path, params?) => buildRoute(path, params);
  
  return { replace, push, route };
}

// Usage: Screens/components that need to preserve common params
const navigate = useNavigate();
navigate.replace('/select/world-selection', { worldId, userRole }, ['worldId', 'userRole']);
```

---

## 5. Safe Mode / Error Recovery Navigation

### Recovery Action Navigation

```typescript
// File: lib/error/safemode/recovery-actions.ts (line 188, 258, 381)
router.push(targetRoute);  // Navigate to recovery screen

// Example context: When safe mode triggered, navigate to fallback
const targetRoute = '/select/world-selection';  // or based on error
router.push(targetRoute);
```

### Feature Gating Guards

```typescript
// File: lib/error/safemode/navigation-guards.ts (line 110)
if (!isValidRoute(fallbackRoute)) {
  logger.error(`Fallback route ${fallbackRoute} not found`);
  return false;  // Guard not applied
}

router.push(fallbackRoute as unknown as Href);
// Routes to safe destination if feature is gated
```

---

## 6. Key Findings

### ✅ What Works Well

1. **String literals for known routes** — No casting needed, fully typed
   ```typescript
   router.push('/login/sign-in');  // ✅ Clean, no casting
   ```

2. **buildNavigationTarget for complex routes** — Encodes params correctly
   ```typescript
   const target = buildNavigationTarget(path, params, preserve);
   router.push(target as any);  // ✅ One cast, well-encapsulated
   ```

3. **useGuardedNavigation for policy-checked routes** — Auth/permission validation built-in
   ```typescript
   await navigate.push(route, params);  // ✅ Middleware included
   ```

4. **Route objects with pathname + params** — Type-safe way to pass params
   ```typescript
   router.push({ pathname: route, params });  // ✅ No casting needed (when composed)
   ```

### ⚠️ Pain Points

1. **`as any` on computed routes** — Loses type safety entirely
   ```typescript
   router.push(target as any);  // ❌ Casting bypasses all checks
   ```

2. **Mixed casting patterns** — Inconsistent across codebase
   - Some use `as any`
   - Some use `as unknown as Href`
   - Some avoid casting entirely (literals)

3. **No dedicated auth redirect hook** — Auth flows scatter `router.replace()` calls
   - `useAuthFlow.ts`
   - `useSignUpFlow.ts`
   - `auth-redirect.tsx`
   - Manual redirects in screens

4. **No URL type validation** — buildNavigationTarget doesn't validate routes exist
   ```typescript
   // This compiles but might break runtime
   router.push(buildNavigationTarget('/invalid/route', {}, []) as any);
   ```

### 🎯 Type Safety Hierarchy

From most to least type-safe:

1. **String literals** — `router.push('/login/sign-in');`
2. **Route objects** — `router.push({ pathname, params });`
3. **Guarded navigation** — `navigate.push(route, params);`
4. **Built routes** — `router.push(buildRoute(path, params) as any);`
5. **Computed routes** — `router.push(dynamicTarget as any);`

---

## 7. Recommendations for Improvement

### Short Term
1. **Standardize casting** → Prefer `as any` for simplicity, or use `as unknown as Href`
2. **Create `useAuthRedirect()` hook** → Centralize auth navigation logic
3. **Document auth redirect destinations** → In navigation-config.ts

### Medium Term
1. **Add route validation** → Validate that routes exist via getAllRouteConfigs()
2. **Type-safe route builder** → Create BuilderPattern for routes with validation
3. **Deprecate direct router calls** → Phase toward semantic navigation (useGuardedNavigation)

### Long Term
1. **Route-aware TypeScript types** → Generate types from navigation-config.ts
2. **Full middleware coverage** — Apply policy checks to all navigation
3. **Route grouping** — Organize by auth level (public, protected, admin)
