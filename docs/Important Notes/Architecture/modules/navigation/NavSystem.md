# Navigation System Architecture: Switchable App Models

This document explains how the centralized navigation middleware system (Issue #204) is designed to support **two distinct app models**:

1. **Protected-by-Default App** (current D&D Toolkit) — Users must authenticate; most routes require an account
2. **Anonymous/Public-by-Default App** (future model) — Users browse without authentication; only certain components/pages require an account

The system is intentionally built so that **switching between models requires only configuration changes**, not architectural refactoring.

---

## App Model 1: Protected-by-Default (Current D&D Toolkit)

**Access Pattern:**
- Must have an account to access the app
- Most routes are protected by default
- Explicit whitelist of public routes (e.g., `/login`, `/web`)
- Unauthenticated users are redirected to login

**Navigation Flow:**
```
User attempts /main/worlds
  ↓
NavManager checks policy mode → "protected_by_default"
  ↓
Policy engine reads AUTH_CONFIG: { protectedRoutes: ['main', ...], publicRoutes: ['login', 'web'] }
  ↓
Route is in protectedRoutes → guard executes
  ↓
Auth guard checks: is user authenticated?
  → YES: allow → route loads
  → NO: redirect to /login (silent, no modal)
```

**Route Examples (Protected by Default):**
- `/main/*` — protected (requires auth)
- `/select/*` — protected (requires auth + world access)
- `/settings/*` — protected (requires auth)
- `/login` — public (explicit whitelist)
- `/web/*` — public (explicit whitelist)

---

## App Model 2: Anonymous/Public-by-Default (Future)

**Access Pattern:**
- Users can browse without authentication
- Only certain pages/components require an account
- Explicit blacklist of protected routes
- Unauthenticated users see public content; prompted to login on restricted pages

**Navigation Flow:**
```
User attempts /main/worlds
  ↓
NavManager checks policy mode → "public_by_default"
  ↓
Policy engine reads AUTH_CONFIG: { publicRoutes: ['main', 'discover', ...], alwaysProtected: ['settings', 'account'] }
  ↓
Route is NOT in alwaysProtected → no auth guard needed
  ↓
Allow → route loads (may show login prompt inline or on certain sections)

BUT if user attempts /settings:
  ↓
Route IS in alwaysProtected → guard executes
  ↓
Auth guard checks: is user authenticated?
  → YES: allow → settings loads
  → NO: show modal "Create an account to access settings"
```

**Route Examples (Public by Default):**
- `/main/*` — public (no auth required to browse)
- `/discover/*` — public (browse content, login to save)
- `/login` — public
- `/settings/*` — protected (explicit blacklist, requires auth)
- `/account/*` — protected (explicit blacklist, requires auth)

---

## Switchable Design: What's Editable

The system is designed so switching between models requires changes to **only these 3 places**:

### 1. **Policy Mode Configuration**
**File:** `config/appsettings.json` (or `appsettings.dev.json`)

```json
{
  "navigationPolicy": {
    "defaultAccessMode": "protected_by_default"
  }
}
```

**To switch to anonymous app:**
```json
{
  "navigationPolicy": {
    "defaultAccessMode": "public_by_default"
  }
}
```

**What to change:** One line in config, single enum flip.

---

### 2. **Auth Config Lists**
**File:** `config/routing-auth-config.ts`

**Current (Protected by Default):**
```typescript
export const AUTH_CONFIG = {
  protectedRoutes: ['select', 'main', 'settings'],
  publicRoutes: ['login', 'web'],
  redirectOnUnauthenticated: '/',
};
```

**For Anonymous App (Public by Default):**
```typescript
export const AUTH_CONFIG = {
  publicRoutes: ['main', 'discover', 'login', 'web'],
  alwaysProtected: ['settings', 'account'],
  redirectOnUnauthenticated: '/discover',  // instead of /
};
```

**What to change:** Swap `protectedRoutes`/`publicRoutes` lists to `publicRoutes`/`alwaysProtected`. Update redirect destination.

---

### 3. **Route Metadata (Optional)**
**File:** `lib/navigation/navigation-config.ts` and `lib/navigation/routes/*.ts`

For fine-grained control, add optional metadata per route:

```typescript
{
  path: '/main/world-details',
  title: 'World Details',
  
  // Optional: override policy for this specific route
  // (if you want to deviate from default mode)
  requiresAuth: true,        // force-protect even in public mode
  denyStrategy: 'modal_then_redirect'  // show NavFailureModal on denial
}
```

**What to change:** Only if specific routes need exceptions to the policy mode.

---

## System Components & Their Role

### **Policy Engine** (`lib/navigation/policy-engine.ts`)
**Purpose:** Reads `defaultAccessMode` from config and decides which guards to run
**Editable:** YES
- Reads `config/appsettings.json` for `defaultAccessMode`
- Checks `routing-auth-config.ts` for route lists
- Can add new guard types (e.g., consent checks, email verification)

### **Auth Config** (`config/routing-auth-config.ts`)
**Purpose:** Stores which routes are protected/public
**Editable:** YES — **Primary switch point** for changing app mode
- Edit `protectedRoutes` ↔ `publicRoutes` lists
- Edit `alwaysProtected` for explicit blacklist patterns

### **Navigation Config** (`lib/navigation/navigation-config.ts`)
**Purpose:** Route metadata (TopBar, back button, animations)
**Editable:** Partly
- Can add `requiresAuth`, `denyStrategy` per route (overrides policy mode)
- DO NOT change: TopBar config, route paths, or general structure

### **NavManager** (`lib/navigation/nav-manager.ts`)
**Purpose:** Orchestrates policy decisions → calls middleware → system
**Editable:** NO — This is the orchestration hub
- Should NOT be modified for app-model switching
- Remains agnostic to what the policy mode is

### **NavService Middleware** (`lib/middleware/navigation/nav-service.ts`)
**Purpose:** Bridges lib ↔ system, handles canonicalization
**Editable:** NO — This is a pure bridge layer
- Should NOT be modified for app-model switching
- Knows about neither protected nor public modes

### **AppNav System** (`system/navigation/app-nav.ts`)
**Purpose:** App-agnostic transaction runner
**Editable:** NO — This is portable infrastructure
- Should never know about auth, policies, or app models
- Purely executes a guard pipeline

---

## Migration Path: Protected → Anonymous (Checklist)

To convert D&D Toolkit from protected-by-default to anonymous/public-by-default:

- [ ] **1. Update `config/appsettings.json`**: Change `defaultAccessMode` to `"public_by_default"`
- [ ] **2. Update `config/routing-auth-config.ts`**: Swap lists
  - [ ] Move `main`, `select`, `home` → `publicRoutes`
  - [ ] Move `settings`, `account` → `alwaysProtected`
- [ ] **3. Review route metadata**: Any specific overrides needed in `navigation-config.ts`?
  - [ ] E.g., `/main/my-campaigns` might stay public even in anonymous mode
  - [ ] E.g., `/discover/premium-content` might require subscription (add check)
- [ ] **4. Test navigation**: Verify guards trigger correctly
  - [ ] Unauthenticated user can browse `/main`
  - [ ] Unauthenticated user is blocked from `/settings` → shows NavFailureModal
  - [ ] Authenticated user can access `/settings`
- [ ] **5. Update login flow**: Redirect unauthenticated users to `/discover` or splash instead of `/login`

---

## Why This Design?

**Separation of Concerns:**
- **Config** (`appsettings.json`, `routing-auth-config.ts`) — What the policy is
- **Policy Engine** — How to evaluate the policy
- **All other layers** — Agnostic to the policy (they just execute decisions)

**Benefits:**
1. **Easy mode switching** — One config change flips the entire model
2. **No code refactoring** — System layer doesn't need to change
3. **Backwards compatible** — Old protected-by-default logic stays intact
4. **Testable** — Can swap modes in tests without recompiling
5. **Extensible** — New guard types (consent, email verification) don't require policy layer changes

---

## Future Considerations

**What might need adjustment if requirements change:**

- **Hybrid mode** — Support routes that are public in some modes, protected in others
  - Add to route metadata: `publicInMode: ['public_by_default']`
  - Policy engine checks this before applying default mode
  
- **Gradual rollout** — Some features only available to authenticated users even in public mode
  - Add feature flag conditions to guards
  - NavManager already supports `consentGates`, can add `featureFlagGates`

- **Role-based routing** — Different routes for admin vs. user vs. guest
  - Extend `NavigationContext` with `userRole`
  - Add role checks as dedicated guards

- **Performance optimization** — Cache policy decisions per route
  - QueryCache guards results for frequent routes
  - Per-guard timeout tuning based on profiling

---

## Related Issues

- **#204** — Centralized Navigation Middleware & Pre-Navigation Hooks (this system)
- **#057** — Feature Flags: Overrides (per-user policy overrides)
- **#198** — Feature Flags: Conditions (runtime context-based decisions)
- **Future** — A/B test routing variants, gradual rollout models
