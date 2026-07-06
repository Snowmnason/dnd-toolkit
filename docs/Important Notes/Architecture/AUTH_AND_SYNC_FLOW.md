# Auth, Login, ReAuth, and Sync Flow

Technical overview of how the current repo handles session restoration, locally stored identity, re-auth, and sync decisions.

## Purpose

Auth and sync are coordinated on purpose. The app does not treat them as unrelated concerns because a session can be locally recognizable while still being untrustworthy for backend work.

This page explains:

- how bootstrap classifies saved session age
- when local state is trusted, partially trusted, or cleared
- how backend session restoration works
- how user identity reaches the app shell
- when sync is deferred, required, or refreshed in the background

## Main Runtime Pieces

### `system/Kernel/phases/auth-phase.ts`

Owns startup-time session classification and restoration logic.

Responsibilities:

- read `LAST_LOGGED_IN`
- validate the timestamp
- classify the saved session as fresh, stale, dead, or none
- clear storage for dead sessions
- mark sync required for stale sessions
- restore backend session for fresh sessions
- schedule proactive background token refresh when needed

### `AuthStateManager`

Owns auth-facing local state.

Important concerns include:

- stored user identity
- session freshness markers
- sync-required markers
- bootstrap freshness signals used by route-entry coordination

### `providers/AppParamsProvider.tsx`

Owns app-shell parameter composition.

It combines:

- `AppParamsStableProvider` for stable user and world context loaded from storage
- `AppParamsVolatileProvider` for navigation-driven context such as active world and role

### `providers/AppParamsStableProvider.tsx`

Owns loading stable identity and world-access context into the shell.

Current behavior:

- waits for `servicesReady`
- loads `userId` through `AuthStateManager.getUserId()`
- loads connected worlds from storage
- loads connected-world metadata
- performs background verification when the cache is stale or suspicious

This provider is one of the main bridges between auth/storage state and the routed app shell.

## Startup Session Classification

The auth phase reads the saved login timestamp and classifies it by age.

```typescript
const STALE_THRESHOLD = 4 * 24 * 60 * 60 * 1000;
const DEAD_THRESHOLD = 30 * 24 * 60 * 60 * 1000;

if (ageMs > DEAD_THRESHOLD) {
  // dead
} else if (ageMs > STALE_THRESHOLD) {
  // stale
} else {
  // fresh
}
```

### Threshold meaning

- **Fresh**: less than 4 days old
- **Stale**: more than 4 days old and up to 30 days old
- **Dead**: older than 30 days

The 4-day threshold gives a safety buffer ahead of a 5-day token lifetime. The 30-day threshold marks local state as too old to trust.

## Timestamp Validation

Before classification, the auth phase guards against malformed or unreasonable timestamps.

Current checks include:

- value exists and is numeric
- timestamp is after a reasonable lower bound
- timestamp is not in the future

If validation fails, bootstrap treats the session as effectively cleared instead of trying to recover from bad local state.

## Dead Session Path

Dead sessions are cleared aggressively.

Current flow:

1. remove auth markers such as `HAS_ACCOUNT`, `SESSION_USER_EMAIL`, and `LAST_LOGGED_IN`
2. remove user-facing cached identity and world-access state such as `USER_DATA`, `CONNECTED_WORLDS`, and `CONNECTED_WORLDS_METADATA`
3. clear entitlements
4. clear offline mutation queue
5. clear query cache
6. set bootstrap freshness to `dead`
7. exit early without session restoration

This path exists so the app does not revive very old credentials or stale shell context after long inactivity.

## Stale Session Path

Stale sessions are not trusted enough to continue as if everything is current, but they are not immediately wiped.

Current flow:

1. mark sync required through `AuthStateManager.markSyncRequired()`
2. set bootstrap freshness to `stale`
3. defer the heavier recovery path to the later sync flow

Why it works this way:

- the app can still use local state to recover faster
- the shell does not have to block on a full server refresh before becoming usable
- the recovery path stays centralized instead of forcing re-auth logic into screens

## Fresh Session Path

Fresh sessions are the fast path.

Current flow:

1. treat the saved state as recent enough for local shell restoration
2. set bootstrap freshness to `fresh`
3. load local auth-facing identity such as `userId`
4. attempt backend session restoration from persisted session data
5. if restoration succeeds, continue normally
6. if restoration fails, mark sync required as a safety measure

This path is optimized for a recent returning user who should not be forced through a visible re-login on every restart.

## Session Restoration

Fresh local identity is not enough by itself. The backend session still has to be restored where required.

Current restoration flow:

1. read the saved session through `SessionAdapter.restoreSession()`
2. ensure an auth provider is available
3. pass the saved session into `authProvider.restoreSession(savedSession)`
4. if restoration succeeds, the runtime auth layer has a usable in-memory session again
5. if restoration fails, mark sync required so later recovery logic can take over

This is especially important on web, where a page reload destroys in-memory tokens even though local identity markers may still exist.

## Why Local Identity Is Not Enough

The app shell may know who the user is before the backend session is proven healthy.

That means:

- `userId` in storage is useful for shell context
- `userId` in storage is not proof that authenticated API calls will work
- route decisions and sync behavior still depend on session restoration and recovery state

This is the main reason auth, app params, and sync are treated as one coordinated system.

## Identity Storage And Routing

The current repo does not treat `userId` as a normal route parameter.

Instead:

- identity is stored locally
- stable app params load identity from storage after services are ready
- active world context still changes through navigation and route state

Benefits of the current approach:

- cleaner URLs
- less parameter plumbing through screens and navigators
- faster shell recovery using locally available identity

Tradeoff:

- local identity must remain downstream of the real auth-health decision

## Background Token Refresh

The auth phase also schedules proactive token refresh for fresh sessions older than one day.

Current flow:

1. check whether the session age exceeds one day
2. call `backgroundRefreshToken()` without blocking UI startup
3. attempt `authProvider.refreshSession()` in the background
4. log success or a non-fatal warning

Why it exists:

- active users should not collide with token expiry during normal use
- bootstrap should not become slower just to refresh a token that is still valid

This is intentionally fire-and-forget. If it fails, the app can still recover later through normal auth error handling.

## Full Sync Triggers

Sync is not only about downloading newer data. In this architecture, sync is part of trust recovery.

A full sync may be required when:

- startup marks the session as stale
- restoration succeeds but local data is still not trusted enough
- another startup or runtime rule decides the shell needs fresh server truth

The important rule is that sync intent is marked centrally instead of invented in individual feature screens.

## Runtime Re-Auth

Startup is only one part of the story. Runtime still needs to handle:

- expired backend sessions
- failed protected requests
- token refresh failures
- recovery paths that preserve safe local context without pretending the backend session is still valid

Re-auth therefore has to remain compatible with sync and degradation behavior.

## Shell-Level Identity Loading

`AppParamsStableProvider` is important because it shows how shell context is recovered without trusting everything blindly.

Current provider behavior includes:

- gate on `servicesReady`
- load `userId`
- load connected worlds
- distinguish between empty but recently verified cache and empty stale cache
- start background verification when data looks old or suspicious

This gives the UI useful stable context quickly while still allowing later verification and recovery.

## Design Rules

- Do not let screens invent their own session-age rules.
- Do not treat stored `userId` as equivalent to a healthy backend session.
- Do not separate re-auth behavior from sync consequences.
- Prefer one central recovery path over many feature-specific auth fallbacks.

## Related Guides

- `KERNEL_ARCHITECTURE_ANALYSIS.md`
- `PROVIDER_LAYERS.md`
- `Apps Response to Degraded Paths.md`