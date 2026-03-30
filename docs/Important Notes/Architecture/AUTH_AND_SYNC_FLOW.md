# Auth, Login, ReAuth, and Sync Flow

This document details the complete flow of authentication, session management, and data synchronization as implemented through the recent refactors (background token refresh, listener-based sync, post-bootstrap full sync, and consolidated sync executor).

## Table of Contents

1. [Bootstrap Phase (Phase 5)](#bootstrap-phase)
2. [Session Staleness Evaluation](#session-staleness-evaluation)
3. [Login Flow](#login-flow)
4. [Re-Auth Flow](#re-auth-flow)
5. [Sync Splash Orchestration](#sync-splash-orchestration)
6. [Full Sync Execution](#full-sync-execution)
7. [Listener System Integration](#listener-system-integration)
8. [Architecture Principles](#architecture-principles)

---

## Bootstrap Phase

**Location:** `system/Kernel/phases/auth-phase.ts`

The Auth Phase (Phase 5) is a **blocking phase** that runs during app startup after storage is initialized. It evaluates whether stored session data is still valid and determines whether to load it, refresh it, or clear it.

### Bootstrap Responsibilities

1. **Evaluate data staleness** — Check `LAST_LOGGED_IN` timestamp age
2. **Classify session state** — DEAD (>30 days), STALE (4-30 days), or FRESH (<4 days)
3. **Take appropriate action** — Clear storage, mark for re-auth, or load local state
4. **Background cleanup** — Optionally refresh tokens or trigger full sync (post-bootstrap)

### Why This Phase is Blocking

The UI cannot render without knowing the auth state. If we allowed the UI to mount while bootstrap is classifying the session, we'd risk:
- Showing login screen then logging user in (flicker)
- Allowing navigation before auth guards are ready
- Race conditions with token refresh and API calls

---

## Session Staleness Evaluation

**Location:** `system/Kernel/phases/auth-phase.ts` (lines 50-160)

### The Three States

```typescript
const STALE_THRESHOLD = 4 * 24 * 60 * 60 * 1000;   // 4 days (1-day safety buffer)
const DEAD_THRESHOLD = 30 * 24 * 60 * 60 * 1000;   // 30 days

const ageMs = Date.now() - lastLoggedInMs;

if (ageMs > DEAD_THRESHOLD)       // > 30 days
  // DEAD: Session is too old, clear all storage
else if (ageMs > STALE_THRESHOLD) // > 4 days, ≤ 30 days
  // STALE: Session exists but needs re-auth before use
else                              // ≤ 4 days
  // FRESH: Session is still valid, load immediately
```

### Why 4 Days for FRESH?

Supabase tokens expire after **5 days**. We use a 4-day threshold to give ourselves a **1-day safety buffer** for background token refresh. This means:
- Tokens are absolutely guaranteed valid for 24 hours
- We have time to refresh them proactively
- Even if refresh fails, the token still has ~24 hours left

### Why 30 Days for DEAD?

After 30 days of inactivity, we assume:
- The user's password may have been compromised
- The API schema may have changed
- The feature flags and entitlements are certainly stale
- A fresh login is safer than attempting to restore ancient credentials

### DEAD Path → Clear All Storage

When a session is **DEAD** (>30 days):

```typescript
// Clear auth keys
STORAGE_KEYS.HAS_ACCOUNT
STORAGE_KEYS.SESSION_USER_EMAIL
STORAGE_KEYS.LAST_LOGGED_IN

// Clear user data
STORAGE_KEYS.USER_DATA
STORAGE_KEYS.CONNECTED_WORLDS
STORAGE_KEYS.CONNECTED_WORLDS_METADATA
STORAGE_KEYS.ENTITLEMENTS

// Clear caches and queues
OfflineMutationQueue.clear()
QueryCache.clearAll()
```

The app then exits to an **unauthenticated state** → user is redirected to login screen.

### STALE Path → Mark Sync Required, Defer Re-Auth

When a session is **STALE** (4-30 days):

```typescript
AuthStateManager.markSyncRequired();
logger.category("bootstrap").info(
  `Data is STALE (${ageMs / 1000 / 60 / 60 / 24} days old) - marking sync required`
);
```

The app loads with **local state only** (userId, email, worlds). The sync-splash will be triggered by the listener system at the appropriate time (when `appReady` fires, or sooner if needed).

**Advantage:** The UI becomes interactive faster. The sync-splash runs as a foreground operation so the user can see progress.

### FRESH Path → Load Local State + Restore Session

When a session is **FRESH** (<4 days):

```typescript
// Step 1: Load local auth state (userId, email, worlds)
const userId = await AuthStateManager.getUserId();
logger.category("bootstrap").info("✅ Fresh session loaded from local state");

// Step 2 (Critical for Web): Restore Supabase session from refresh token
const authProvider = await getAuthProvider();
const restored = await authProvider.restoreSession();

if (restored) {
  logger.info("✅ Supabase session restored from refresh token");
  // Access token is now in memory, APIs will work
} else {
  logger.warn("Session restoration failed - will re-auth");
  AuthStateManager.markSyncRequired();
  // useSyncSplash will detect this and run full sync
}
```

**Why Session Restoration is Critical:**

On web, Supabase **stores tokens in memory only** (not persistent) for security. This means:
- User logs in → tokens in memory → works fine
- Page reloads → memory cleared → tokens gone
- Supabase SDK needs to restore tokens from the stored refresh token

Without this restoration:
- Bootstrap trusts the FRESH timestamp
- Loads local data (userId, email)
- But Supabase client has no tokens
- First API call → 401 error → user kicked out

With restoration:
- Tokens restored from refresh token → in memory
- APIs have fresh access tokens
- No surprise logout

**Cost:** One API call per page reload (industry standard for all web auth frameworks).

The app then proceeds directly to the **authenticated state** without any additional UI overlays. The user sees instant navigation to world selection.

---

## Background Token Refresh

**Location:** `system/Kernel/phases/auth-phase.ts` (lines 203-296)

### When It Runs

Only for **FRESH sessions that are >1 day old**. This is a **fire-and-forget** background operation that does not block UI startup.

```typescript
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ageMs = Date.now() - parseInt(lastLoggedInStr, 10);

if (ageMs > ONE_DAY_MS) {
  logger.category("bootstrap").debug(
    `Session is ${(ageMs / 1000 / 60 / 60).toFixed(1)} hours old - scheduling background token refresh`
  );
  
  // Fire and forget
  backgroundRefreshToken().catch((err) => {
    logger.category("bootstrap").warn("Background token refresh failed:", err);
  });
}
```

### How It Works

1. Calls `getAuthProviderSync()` from `system/Services`
2. Checks if auth provider is configured (skips if not ready)
3. Calls `authProvider.refreshSession()`
4. If successful: token is updated, app continues with fresh auth tokens
5. If failed: logged as debug-level; app continues (token still has days of validity)

### Why This Is Critical

Without background token refresh:
- A user on the app continuously for 5+ days would hit **token expiry mid-session**
- The expiry would trigger an error on the next API call
- All running operations would fail
- The sync-splash would have to re-auth the user at an awkward moment

With background refresh:
- Users never experience token expiry (it happens proactively in the background)
- API calls always have fresh tokens
- The app feels seamless and never requires unexpected re-auth

---

## Post-Bootstrap Full Sync Capability

**Location:** `system/Kernel/phases/auth-phase.ts` (lines 212-227)

This is an **optional hook** that allows any part of bootstrap to trigger a full sync right after the bootstrap phase completes.

```typescript
// ─── Optional: Post-Bootstrap Full Sync ───────────────────────────
// If you need to trigger a full sync right after bootstrap 
// (e.g., force refresh, cache validation failed, etc.), call:
//   AuthStateManager.markPostBootstrapFullSync();

if (requiresFreshDataSync) {
  AuthStateManager.markPostBootstrapFullSync();
}
// useSyncSplash will detect this and run performFullSync automatically.
```

### Current Status: **OFF**

The capability is implemented and integrated but **not actively triggered**. It's ready to be enabled when needed (e.g., if cache validation fails).

### When Would You Enable This?

- Cache validation fails during bootstrap (corrupted or incompatible version)
- A feature flag check requires fresh data
- A security event demands immediate data refresh
- A background job queue is full and needs draining

---

## Login Flow

**Location:** `lib/auth/account/sign-in-system.ts` → `hooks/auth/useSignIn.ts`

### High-Level Flow

```
User submits credentials
    ↓
AuthManager.signIn() validates input
    ↓
Sign-In System calls middleware:
    authSignIn() → calls auth provider
    ↓
Auth provider returns session + user
    ↓
Store session locally:
    - HAS_ACCOUNT = true
    - LAST_LOGGED_IN = Date.now()
    - USER_DATA = profile
    ↓
Call AuthStateManager.markSyncRequired()
    → listener fires immediately
    → useSyncSplash starts sync-splash
    ↓
User sees: sync-splash → world-selection appears → splash hides
```

### Key Actions

1. **Credentials validated** — Password strength, email format, no SQL injection
2. **Auth provider called** — `authSignIn()` from `system/Services`
3. **Session persisted** — Stored in `SecureStorage` with `LAST_LOGGED_IN` timestamp
4. **Listener triggered** — `markSyncRequired()` fires `onSyncRequired()` callbacks
5. **Sync splash started** — useSyncSplash detects listener and begins full sync
6. **User profile synced** — performReAuthJob, performProfileSync, performWorldsSync, performFeatureFlagSync
7. **Navigation unlocked** — User can access authenticated screens

---

## Re-Auth Flow

**Location:** `lib/auth/account/reauth-system.ts` → `hooks/auth/useReAuth.ts`

### When Re-Auth Triggers

1. **Bootstrap detects STALE session** — `markSyncRequired()` called
2. **Runtime token expiry** — API error returns 401, app calls `reAuthOnTokenExpiry()`
3. **Explicit user action** — User taps "Refresh Session" or similar

### High-Level Flow

```
Existing session found (STALE or expired)
    ↓
ReAuth System validates context:
    - Do we have a stored session?
    - Is the user already authenticated?
    ↓
Call middleware: authRefreshSession()
    → calls auth provider's refreshSession()
    → token is rotated or renewed
    ↓
Update LAST_LOGGED_IN = Date.now()
    → resets staleness timer
    ↓
Call AuthStateManager.markSyncRequired()
    → listener fires
    → useSyncSplash starts sync-splash
    ↓
User sees: sync-splash → data syncs → splash hides
```

### Difference from Login

- **Login:** Creates a new session from credentials (no prior session)
- **ReAuth:** Refreshes an existing session (session already exists, just expired or stale)

Both end the same way: `markSyncRequired()` → listener fires → sync-splash runs full sync.

---

## Sync Splash Orchestration

**Location:** `hooks/kernel/use-sync-splash.ts`

The Sync Splash is a **full-screen overlay** that prevents user interaction while a complete data sync runs. It's triggered by two independent paths that converge on the same executor.

### Two Trigger Paths

#### Path 1: Listener-Based (Runtime)

```typescript
// Anywhere in the app calls:
AuthStateManager.markSyncRequired();

// AuthStateManager fires the listener immediately:
AuthStateManager.onSyncRequired(() => {
  executeSyncJob(setLoading, 'listener');
});
```

**When this fires:**
- User just logged in
- Token just refreshed
- Re-auth just completed
- Listener fires **immediately** (does not wait for `appReady`)

**Result:** useSyncSplash effect subscribes to listener, starts sync

#### Path 2: Post-Bootstrap (Startup)

```typescript
// During bootstrap, if needed:
AuthStateManager.markPostBootstrapFullSync();

// When appReady fires, useSyncSplash checks the flag:
if (AuthStateManager.isPostBootstrapFullSyncRequested()) {
  executeSyncJob(setLoading, 'post-bootstrap');
}
```

**When this fires:**
- Bootstrap completes
- `appReady` phase fires
- useSyncSplash checks the post-bootstrap flag
- If set, starts sync

**Result:** Seamless transition from Bootstrap splash → Sync splash (no flicker)

### Consolidated Executor Function

Both paths converge on the same `executeSyncJob(setLoading, triggerSource)`:

```typescript
async function executeSyncJob(
  setLoading: (state) => void,
  triggerSource: 'listener' | 'post-bootstrap'
): Promise<void> {
  try {
    setLoading({ visible: true, step: 'Loading credentials...' });

    // Get fresh tokens
    const tokens = await getTokens();

    // Call unified orchestrator
    await performFullSync(tokens, (completedJobs) => {
      setLoading({ 
        visible: true, 
        step: `Syncing... (${completedJobs}/4)` 
      });
    });

    // Clear both flags (both are checked at start of effect)
    AuthStateManager.clearSyncRequired();
    AuthStateManager.clearPostBootstrapFullSync();

    // Hide splash
    setLoading({ visible: false });
  } catch (error) {
    logger.category('auth').error('Sync job failed:', error);
    setLoading({ visible: false });
  }
}
```

**Why consolidate?**

If we had separate implementations:
- 200+ lines of duplicated logic
- Fix a bug once, miss it in the other path
- Hard to maintain
- Harder to add new features (both paths need updates)

**Benefits of consolidation:**
- Single source of truth for sync logic
- Both triggers use identical behavior
- Bug fixes apply everywhere
- New features apply everywhere

### UIBlocker Context

**Location:** `providers/UIBlockerContext.tsx`

The `UIBlocker` is a **root-level context provider** that renders the sync splash. It prevents pointer events (clicks, scrolls, gestures) from reaching the UI underneath.

```typescript
export const UIBlockerContext = createContext<{
  setIsBlocked: (state: { visible: boolean; step?: string }) => void;
}>(null!);
```

**Key point:** The splash is rendered at the root layout, so it works regardless of which route is showing. The user cannot interact with the app while the splash is visible.

---

## Full Sync Execution

**Location:** `lib/sync/perform-full-sync.ts`

The full sync orchestrates **4 parallel jobs** that fetch and cache all critical data from the server.

### Job Structure

```
performFullSync(tokens, onJobComplete)
├─ Job 1: performReAuthJob
│  └─ Restores auth state + validates session
├─ Job 2: performProfileSync (parallel with 3 & 4)
│  └─ Fetches user profile, email, preferences
├─ Job 3: performWorldsSync (parallel with 2 & 4)
│  └─ Fetches connected worlds + memberships
└─ Job 4: performFeatureFlagSync (parallel with 2 & 3)
   └─ Fetches feature flags + entitlements
```

### Execution Order

1. **performReAuthJob** runs first (must complete before others, restores session)
2. **performProfileSync, performWorldsSync, performFeatureFlagSync** run in parallel (no dependencies)
3. Callback `onJobComplete(completedCount)` fires after each job completes
4. Returns when all 4 jobs complete

### Progress Reporting

```typescript
onJobComplete(1); // Job 1 done (reauth)
onJobComplete(2); // Job 2 done (profile)
onJobComplete(3); // Job 3 done (worlds)
onJobComplete(4); // Job 4 done (feature flags)
```

The sync splash uses this to show progress: "Syncing... (1/4)" → "Syncing... (2/4)" → etc.

### Error Handling

Each job has its own error handling:
- If a job fails, the error is collected but doesn't stop other jobs
- If Job 1 (reauth) fails, all jobs are considered failed (because we can't proceed without auth)
- If Jobs 2-4 fail, the app continues with whatever data was previously cached

---

## Listener System Integration

**Location:** `lib/auth/auth-state.ts`

The listener system allows **any part of the app** to subscribe to auth state changes without tight coupling.

### Key Methods

#### `markSyncRequired()`

```typescript
AuthStateManager.markSyncRequired();
```

Marks that a sync is needed. Immediately fires all registered listeners.

#### `onSyncRequired(callback)`

```typescript
const unsubscribe = AuthStateManager.onSyncRequired(() => {
  console.log('Sync required! Starting sync splash...');
});

// Later, clean up
unsubscribe();
```

Returns an unsubscribe function. Callback fires **immediately** when registered if sync is already marked as required.

### useSyncSplash Hook Integration

```typescript
useEffect(() => {
  // Check post-bootstrap flag first
  const shouldDoPostBootstrapSync = AuthStateManager.isPostBootstrapFullSyncRequested();
  if (shouldDoPostBootstrapSync && kernel.phases.appReady) {
    setIsRunning(true);
    executeSyncJob(setLoading, 'post-bootstrap').finally(() => setIsRunning(false));
  }

  // Also subscribe to runtime listener
  const unsubscribe = AuthStateManager.onSyncRequired(() => {
    setIsRunning(true);
    executeSyncJob(setLoading, 'listener').finally(() => setIsRunning(false));
  });

  return () => unsubscribe();
}, [kernel.phases.appReady]);
```

**Flow:**
1. Hook mounts
2. Checks if post-bootstrap flag is set (if `appReady` fired)
3. Subscribes to listener
4. Listener fires whenever `markSyncRequired()` is called
5. Both paths call the same `executeSyncJob()`
6. Cleanup unsubscribes from listener

---

## Architecture Principles

### 1. **Listener-Based, Not Event-Driven**

We use a **listener callback pattern** instead of event emitters:
- Simpler to reason about
- No event queuing or ordering issues
- Callbacks are synchronous and immediate
- No dependency on external event libraries

### 2. **Consolidated Sync Logic**

All sync paths converge on `executeSyncJob()`:
- **Single executor function** eliminates duplication
- **Parameter-based trigger source** distinguishes trigger path
- **Both paths use identical logic** — consistency guaranteed

### 3. **Architectural Layering**

```
app/ (components)
    ↓ uses
hooks/kernel/use-sync-splash.ts (React bridge)
    ↓ calls
lib/sync/perform-full-sync.ts (orchestration)
    ↓ calls
lib/middleware/services/* (middleware)
    ↓ calls
system/Services/* (auth provider, data fetching)
```

Each layer has one clear responsibility. No layer jumps across layers.

### 4. **Non-Blocking Bootstrap**

Bootstrap is **blocking**, but only until Phase 5 completes. Then:
- UI renders immediately
- Background token refresh runs in parallel
- Post-bootstrap sync (if needed) shows a splash, doesn't block

This ensures fast startup while maintaining data consistency.

### 5. **Provider-Agnostic Abstraction**

All auth provider calls go through `system/Services` **abstractions**, not direct Supabase imports:
- `getAuthProviderSync()` — Synchronous provider check (for bootstrap)
- `getAuthProvider()` — Async provider fetch
- `authSignIn()`, `authRefreshSession()` — Provider-specific operations

This allows swapping auth providers without changing lib/ code.

---

## Summary Table

| Scenario | Trigger | Path | Result |
|----------|---------|------|--------|
| **First Launch** | User logs in | `markSyncRequired()` → listener fires | Sync splash, full sync, home screen |
| **FRESH Session** | App starts | Bootstrap loads local state | No splash, instant navigation |
| **FRESH Session >1 day** | App starts | Background token refresh | Silent token update in background |
| **STALE Session** | App starts | `markSyncRequired()` + listener | Sync splash on route navigation |
| **Token Expiry** | API call fails (401) | `reAuthOnTokenExpiry()` → `markSyncRequired()` | Sync splash, re-auth, resume |
| **Post-Bootstrap Sync** | Conditional in bootstrap | Post-bootstrap flag + `appReady` | Seamless Bootstrap → Sync splash |

