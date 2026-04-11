# Navigation System — Complete Flow Architecture

> **Purpose:** Map every navigation path from trigger → system → UI response.
> Identify what each layer does, what hooks are actually responsible for, and what's missing.

---

## Table of Contents

1. [Layer Summary](#1-layer-summary)
2. [Flow 1: User-Triggered Navigation (Happy Path)](#2-flow-1-user-triggered-navigation-happy-path)
3. [Flow 2: User-Triggered Navigation (Failure / Modal)](#3-flow-2-user-triggered-navigation-failure--modal)
4. [Flow 3: Internal Redirect (Happy Path)](#4-flow-3-internal-redirect-happy-path)
5. [Flow 4: Internal Redirect (Failure / Modal)](#5-flow-4-internal-redirect-failure--modal)
6. [Flow 5: Observer — Post-Hoc Route Correction](#6-flow-5-observer--post-hoc-route-correction)
7. [Hook Responsibilities (What Each Hook Actually Does)](#7-hook-responsibilities)
8. [Critical Issues & Missing Pieces](#8-critical-issues--missing-pieces)
9. [NavServiceResult Decision Table](#9-navserviceresult-decision-table)
10. [Design Decisions](#10-design-decisions)

---

## 1. Layer Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRESENTATION (app/, Screens/, components/)                         │
│  - Calls hook methods: nav.to(), nav.back(), nav.openWeb()          │
│  - Renders modals: <NavModal>, <TrustedUrlConsentModal>             │
│  - NEVER sees NavServiceResult — hooks consume it                   │
├─────────────────────────────────────────────────────────────────────┤
│  HOOKS (hooks/navigation/)                                          │
│  - use-navigation.ts        → User-triggered calls, thin caller     │
│  - use-navigation-ui-modals → Interprets NavServiceResult → modals  │
│  - use-route-change-observer → Post-hoc validation, observer-only   │
│  - use-navigation-failure    → State + helpers (showFailure, etc.)   │
├─────────────────────────────────────────────────────────────────────┤
│  LIB / MANAGER (lib/navigation/navManager.ts)                       │
│  - 5 family functions (route, internal, history, external, observer) │
│  - Validation, canonicalization, metadata, policy, param resolution  │
│  - Returns Promise<NavServiceResult> to hooks                       │
│  - For internal redirects: called directly by lib (auth, jobs)       │
├─────────────────────────────────────────────────────────────────────┤
│  MIDDLEWARE (middleware/navigation/nav-service.ts)                   │
│  - Transport readiness check                                        │
│  - Route normalization                                               │
│  - Builds NavigationRequest                                          │
│  - Fires analytics (fire-and-forget)                                │
│  - Strips transaction metadata → returns NavServiceResult            │
├─────────────────────────────────────────────────────────────────────┤
│  SYSTEM (system/Navigation/app_nav.ts)                              │
│  - Guard pipeline execution (with timeout)                           │
│  - Transaction tracking (timing, metadata)                           │
│  - Calls transport adapter                                           │
│  - Returns NavigationExecutionResult                                 │
├─────────────────────────────────────────────────────────────────────┤
│  TRANSPORT (system/Navigation/expo-router/transport_adapter.ts)     │
│  - Raw Expo Router calls: router.navigate(), router.back(), etc.    │
│  - Linking.openURL() for external                                    │
│  - State queries: canGoBack(), getCurrentRoute()                     │
│  - Returns TransportResult                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Flow 1: User-Triggered Navigation (Happy Path)

**Trigger:** User taps a button, screen calls `nav.to('/main/characters')`

```
Screen                                     Hook                                        Manager                                   Middleware                               System                                Transport
  │                                          │                                            │                                         │                                         │                                     │
  │  nav.to('/main/characters', {worldId})   │                                            │                                         │                                         │                                     │
  ├─────────────────────────────────────────►│                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                              (returns    │  executeRouteNavigation(                   │                                         │                                         │                                     │
  │                               void to    │    '/main/characters',                     │                                         │                                         │                                     │
  │                               screen)    │    {worldId}, options, 'push')             │                                         │                                         │                                     │
  │                                          ├───────────────────────────────────────────►│                                         │                                         │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │  1. canonicalizePath('/main/characters') │                                         │                                     │
  │                                          │                                            │  2. resolveContextParams() → userId,     │                                         │                                     │
  │                                          │                                            │     worldId                              │                                         │                                     │
  │                                          │                                            │  3. mergeParameters()                    │                                         │                                     │
  │                                          │                                            │  4. getRouteMetadata() → config          │                                         │                                     │
  │                                          │                                            │  5. isPlatformCompatible() → ✅          │                                         │                                     │
  │                                          │                                            │  6. PolicyEngine.getPolicyForRoute()     │                                         │                                     │
  │                                          │                                            │  7. PolicyEngine.buildGuardPipeline()    │                                         │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │  callRouteTransitionNav(                │                                         │                                     │
  │                                          │                                            │    'push', target, params, guards)       │                                         │                                     │
  │                                          │                                            ├────────────────────────────────────────►│                                         │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │  1. isTransportReady() → ✅              │                                     │
  │                                          │                                            │                                         │  2. normalizeRoute()                     │                                     │
  │                                          │                                            │                                         │  3. build NavigationRequest              │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │  executeRouteTransitionNav(              │                                     │
  │                                          │                                            │                                         │    request, guards)                      │                                     │
  │                                          │                                            │                                         ├────────────────────────────────────────►│                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │                                         │  1. executeGuardPipeline()            │
  │                                          │                                            │                                         │                                         │     → all guards pass ✅             │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │                                         │  executeRouterPush(target)           │
  │                                          │                                            │                                         │                                         ├────────────────────────────────────►│
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │                                         │  ◄── TransportResult { success }    │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │  ◄── NavigationExecutionResult           │                                     │
  │                                          │                                            │                                         │      { status: 'executed',               │                                     │
  │                                          │                                            │                                         │        toRoute: 'main/characters' }      │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │                                         │  4. fireAnalytics() (fire-and-forget)    │                                     │
  │                                          │                                            │                                         │  5. stripResult() → NavServiceResult     │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │                                            │  ◄── NavServiceResult                    │                                         │                                     │
  │                                          │                                            │      { status: 'executed' }              │                                         │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │  ◄── NavServiceResult { executed }          │                                         │                                         │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │                                          │  interpretResult():                        │                                         │                                         │                                     │
  │                                          │    status === 'executed' → no-op ✅        │                                         │                                         │                                     │
  │                                          │    (screen already navigated)               │                                         │                                         │                                     │
  │                                          │                                            │                                         │                                         │                                     │
  │  ◄── void (screen doesn't know result)   │                                            │                                         │                                         │                                     │
```

**Summary:** Screen fires → hook awaits manager → manager pipelines → middleware bridges → system executes → transport moves → result bubbles back → hook sees `executed` → done.

---

## 3. Flow 2: User-Triggered Navigation (Failure / Modal)

**Trigger:** User taps a button, but navigation is blocked (guard fails, transport down, or UI consent needed)

### 3a. Guard Blocks Navigation → NavModal (failure)

Guards execute at the **system layer**, not the manager. The manager only builds the pipeline.
On guard failure, the system short-circuits before the transport call, but the result still flows
back through middleware (analytics fires with guard metadata).

```
Screen                Hook                       Manager                    Middleware                  System                    Transport
  │                     │                          │                          │                           │                          │
  │  nav.to(            │                          │                          │                           │                          │
  │   '/settings/admin')│                          │                          │                           │                          │
  ├────────────────────►│                          │                          │                           │                          │
  │                     │  executeRouteNavigation  │                          │                           │                          │
  │                     ├─────────────────────────►│                          │                           │                          │
  │                     │                          │                          │                           │                          │
  │                     │                          │  1. canonicalize         │                           │                          │
  │                     │                          │  2. resolveParams        │                           │                          │
  │                     │                          │  3. getMetadata          │                           │                          │
  │                     │                          │  4. buildGuardPipeline   │                           │                          │
  │                     │                          │     (builds, NOT runs)   │                           │                          │
  │                     │                          │                          │                           │                          │
  │                     │                          │  callRouteTransitionNav( │                           │                          │
  │                     │                          │    target, params,       │                           │                          │
  │                     │                          │    guards[])             │                           │                          │
  │                     │                          ├─────────────────────────►│                           │                          │
  │                     │                          │                          │                           │                          │
  │                     │                          │                          │  1. isTransportReady → ✅ │                          │
  │                     │                          │                          │  2. normalizeRoute        │                          │
  │                     │                          │                          │                           │                          │
  │                     │                          │                          │  executeRouteTransitionNav│                          │
  │                     │                          │                          ├─────────────────────────►│                          │
  │                     │                          │                          │                           │                          │
  │                     │                          │                          │                           │  executeGuardPipeline()  │
  │                     │                          │                          │                           │  → ❌ permission-denied  │
  │                     │                          │                          │                           │                          │
  │                     │                          │                          │                           │  SHORT-CIRCUIT:          │
  │                     │                          │                          │                           │  skip transport call ─ ─ ┤
  │                     │                          │                          │                           │                          │
  │                     │                          │                          │  ◄── { status: 'aborted', │                          │
  │                     │                          │                          │       reason: 'guard:     │                          │
  │                     │                          │                          │         permission-check', │                          │
  │                     │                          │                          │       transaction: {       │                          │
  │                     │                          │                          │         guardsExecuted } } │                          │
  │                     │                          │                          │                           │                          │
  │                     │                          │                          │  3. fireAnalytics(result)  │                          │
  │                     │                          │                          │     (still fires! ✅       │                          │
  │                     │                          │                          │      includes guard        │                          │
  │                     │                          │                          │      metadata)             │                          │
  │                     │                          │                          │  4. stripResult()          │                          │
  │                     │                          │                          │     → NavServiceResult     │                          │
  │                     │                          │                          │                           │                          │
  │                     │                          │  ◄── NavServiceResult    │                           │                          │
  │                     │                          │      { status: 'aborted',│                           │                          │
  │                     │                          │        reason }          │                           │                          │
  │                     │                          │                          │                           │                          │
  │                     │  ◄── NavServiceResult    │                          │                           │                          │
  │                     │                          │                          │                           │                          │
  │                     │  interpretResult():      │                          │                           │                          │
  │                     │    status === 'aborted'  │                          │                           │                          │
  │                     │    → uiModals.showNavModal({                       │                           │                          │
  │                     │        modalResponseType: 'failure',               │                           │                          │
  │                     │        body: reason,     │                          │                           │                          │
  │                     │        canGoBack: canGoBack(),                     │                           │                          │
  │                     │        primaryAction: () => goHome(),              │                           │                          │
  │                     │        secondaryAction: () => back()               │                           │                          │
  │                     │      })                  │                          │                           │                          │
  │                     │                          │                          │                           │                          │
  │  ◄── void          │                          │                          │                           │                          │
  │                     │                          │                          │                           │                          │
  │  [NavModal renders] │                          │                          │                           │                          │
  │  User taps "Go Home"│                          │                          │                           │                          │
  │  ──────────────────►│  primaryAction() fires   │                          │                           │                          │
  │                     │  → router.replace(       │                          │                           │                          │
  │                     │    '/select/             │                          │                           │                          │
  │                     │    world-selection')     │                          │                           │                          │
```

### 3b. External Link → TrustedUrlConsentModal

```
Screen                          Hook                                     Manager
  │                               │                                        │
  │  nav.openWeb('https://       │                                        │
  │    evil.com/phishing')        │                                        │
  ├──────────────────────────────►│                                        │
  │                               │  executeExternalNavigation(url)        │
  │                               ├───────────────────────────────────────►│
  │                               │                                        │
  │                               │                                        │  checkTrustedUrl(url) → ❌ untrusted
  │                               │                                        │
  │                               │  ◄── { status: 'ui-required',          │
  │                               │       instruction: {                   │
  │                               │         type: 'trusted-url-consent',   │
  │                               │         url, hostname                  │
  │                               │       }}                               │
  │                               │                                        │
  │                               │  interpretResult():                    │
  │                               │    status === 'ui-required'            │
  │                               │    → uiModals.showTrustModal({         │
  │                               │        url, hostname,                  │
  │                               │        onOpenAnyway, onTrustAndOpen    │
  │                               │      })                                │
  │                               │                                        │
  │  [TrustedUrlConsentModal renders]                                      │
  │  User taps "Go to Site"       │                                        │
  │  ────────────────────────────►│  onOpenAnyway() fires                  │
  │                               │  → executeExternalNavigation(          │
  │                               │      url, { skipTrustCheck: true })    │
  │                               ├───────────────────────────────────────►│
  │                               │                                        │  → opens URL ✅
  │                               │  ◄── { status: 'executed' }            │
```

### 3c. Transport Down → NavModal (failure)

```
Hook                                     Middleware
  │                                        │
  │  callRouteTransitionNav(...)           │
  ├───────────────────────────────────────►│
  │                                        │
  │                                        │  isTransportReady() → ❌ false
  │                                        │
  │  ◄── { status: 'transport-unavailable',│
  │       reason: 'Router not initialized' }
  │                                        │
  │  interpretResult():                    │
  │    → uiModals.showNavModal({           │
  │        modalResponseType: 'failure',   │
  │        body: 'Navigation system is     │
  │          not ready. Try again.',        │
  │        canGoBack: false,               │
  │        primaryAction: () => goHome()   │
  │      })                                │
```

---

## 4. Flow 3: Internal Redirect (Happy Path)

**Trigger:** Auth system detects session expired, needs to redirect to login.
**Key difference:** No hook involved. lib→lib call. No modal.

```
lib/auth/auth-state.ts              lib/navigation/navManager.ts           Middleware → System → Transport
  │                                    │                                      │
  │  (auth check fails)                │                                      │
  │                                    │                                      │
  │  executeInternalRedirectNavigation(│                                      │
  │    'session-expired',              │                                      │
  │    '/',                            │                                      │
  │    undefined,                      │                                      │
  │    undefined,                      │                                      │
  │    'replace'                       │                                      │
  │  )                                 │                                      │
  ├───────────────────────────────────►│                                      │
  │                                    │                                      │
  │                                    │  1. canonicalizePath('/')            │
  │                                    │  2. skip param resolution (redirect) │
  │                                    │  3. skip policy (trusted source)     │
  │                                    │                                      │
  │                                    │  callRouteTransitionNav(             │
  │                                    │    'replace', '/', [], analytics)    │
  │                                    ├─────────────────────────────────────►│
  │                                    │                                      │  → router.replace('/') ✅
  │                                    │  ◄── { status: 'executed' }          │
  │                                    │                                      │
  │  ◄── NavServiceResult { executed } │                                      │
  │                                    │                                      │
  │  (log result, done)                │                                      │
  │  No modal. No hook. Automatic.     │                                      │
```

**Who calls internal redirects?**
- `lib/auth/auth-state.ts` — session expired, auth state change
- `lib/auth/useAuthGuard.ts` — route protection (account-only, world-required)
- `lib/jobs/` — job completion redirects
- `lib/navigation/account/enterNavigation.ts` — post-login redirect decisions
- `lib/navigation/account/exitNavigation.ts` — post-logout redirect decisions

---

## 5. Flow 4: Internal Redirect (Failure / Modal)

**Question: Does an internal redirect need a modal on failure?**

**Answer: Almost never.** Internal redirects are system-initiated. If the redirect itself fails (transport down), the system is in a broken state. Options:

```
lib/auth (or lib/jobs)              navManager                   Middleware
  │                                    │                            │
  │  executeInternalRedirectNavigation │                            │
  ├───────────────────────────────────►│                            │
  │                                    │  callRouteTransitionNav(…) │
  │                                    ├───────────────────────────►│
  │                                    │                            │  isTransportReady() → ❌
  │                                    │  ◄── { transport-unavailable }
  │                                    │                            │
  │  ◄── NavServiceResult              │                            │
  │      { transport-unavailable }     │                            │
  │                                    │                            │
  │  Options:                          │                            │
  │  A) Log error + retry later        │                            │
  │  B) Queue as job for retry         │                            │
  │  C) Safe mode / error boundary     │                            │
  │                                    │                            │
  │  ❌ Do NOT show modal              │                            │
  │  (no hook/UI context available)    │                            │
```

**Rule:** Internal redirect failures are **system errors**, not user-facing events. They get logged, potentially retried, or trigger safe mode. No NavModal.

**Exception:** If `useAuthGuard` (which IS a hook in a layout) detects failure, it could show a modal. But the auth guard itself handles this — it doesn't go through NavModal.

---

## 6. Flow 5: Observer — Post-Hoc Route Correction

**Trigger:** User types URL directly, deep links, or uses browser back button. Observer detects the route change after it already happened.

```
Browser / Deep Link                  Observer Hook                        Manager                          Middleware → System
  │                                    │                                    │                                │
  │  URL changes to                    │                                    │                                │
  │  /settings/admin                   │                                    │                                │
  │  (via address bar / deep link)     │                                    │                                │
  │                                    │                                    │                                │
  ├────────(Expo Router navigates)────►│                                    │                                │
  │                                    │                                    │                                │
  │                                    │  useSegments() fires               │                                │
  │                                    │  detects: previous ≠ current       │                                │
  │                                    │  triggeredBy: 'deep-link'          │                                │
  │                                    │                                    │                                │
  │                                    │  evaluateObservedRouteChange(      │                                │
  │                                    │    '/settings/admin',              │                                │
  │                                    │    '/main/characters')             │                                │
  │                                    ├───────────────────────────────────►│                                │
  │                                    │                                    │                                │
  │                                    │                                    │  1. canonicalizePath()         │
  │                                    │                                    │  2. getRouteMetadata()         │
  │                                    │                                    │  3. resolveContextParams()     │
  │                                    │                                    │  4. PolicyEngine.getPolicy()   │
  │                                    │                                    │  5. PolicyEngine.buildGuards() │
  │                                    │                                    │                                │
  │                                    │                                    │  Guards → ❌ requires admin     │
  │                                    │                                    │                                │
  │                                    │                                    │  Return:                       │
  │                                    │  ◄── { status: 'aborted',          │  { status: 'aborted',          │
  │                                    │       reason: 'guard:admin' }      │    reason: 'guard:admin' }     │
  │                                    │                                    │                                │
  │                                    │  interpretResult():                │                                │
  │                                    │    status === 'aborted'            │                                │
  │                                    │    → NEEDS: redirect back + modal  │                                │
  │                                    │                                    │                                │
  │                                    │  Option A: Observer calls           │                                │
  │                                    │  executeInternalRedirectNavigation │                                │
  │                                    │  to go back, THEN shows modal      │                                │
  │                                    │                                    │                                │
  │                                    │  Option B: Observer shows modal,    │                                │
  │                                    │  modal's button triggers redirect   │                                │
  │                                    │  (preferred — user sees feedback)   │                                │
  │                                    │                                    │                                │
  │  [NavModal renders on /settings/admin]                                  │                                │
  │  User taps "Go Home"              │                                    │                                │
  │  ────────────────────────────────►│                                    │                                │
  │                                    │  primaryAction() fires             │                                │
  │                                    │  → router.replace(computeFallback) │                                │
```

**Key insight:** Observer runs AFTER navigation already happened. It's corrective, not preventive. The user is already on the wrong page. We show the modal ON that page, then the modal's action moves them.

---

## 7. Hook Responsibilities

### `use-navigation` (user-triggered)

| Responsibility | Details |
|---|---|
| **Public API** | `to()`, `replace()`, `back()`, `dismiss()`, `dismissAll()`, `dismissTo()`, `openWeb()` |
| **Calls** | `executeRouteNavigation()`, `executeHistoryNavigation()`, `executeExternalNavigation()` from navManager |
| **Interprets result** | Reads `NavServiceResult.status` → delegates to `use-navigation-ui-modals` for modal display |
| **Does NOT** | Own modal state, compute canGoBack, resolve home route — delegates these |
| **Returns to screen** | `void` for all methods. Screen doesn't see NavServiceResult |

### `use-navigation-ui-modals` (modal state manager)

| Responsibility | Details |
|---|---|
| **Owns state** | `navModalVisible`, `navModalProps`, `trustModalVisible`, `trustModalProps` |
| **API** | `showNavModal(props)`, `dismissNavModal()`, `showTrustModal(props)`, `dismissTrustModal()` |
| **Called by** | `use-navigation` (on aborted/ui-required results), `use-route-change-observer` (on aborted results) |
| **Does NOT** | Call navManager. It's pure UI state. |
| **Computes** | `canGoBack` from `callStateQueriesNav('canGoBack')`, `homeRoute` from `computeFallbackRoute()` |

### `use-route-change-observer` (post-hoc corrective)

| Responsibility | Details |
|---|---|
| **Watches** | `useSegments()` for route changes |
| **Calls** | `evaluateObservedRouteChange()` from navManager |
| **Interprets result** | On `aborted` → calls `use-navigation-ui-modals.showNavModal()` with failure type |
| **Does NOT** | Provide a public API to screens. It's an effect-only hook mounted at root |
| **Root-only** | Mounted once in `app/_layout.tsx`, never in screens |

### `use-navigation-failure` (helper utilities)

| Responsibility | Details |
|---|---|
| **Provides** | `computeFallbackRoute(worldId)`, `interpretDecision()` |
| **Used by** | `use-navigation-ui-modals`, `use-route-change-observer` |
| **Status** | May merge into `use-navigation-ui-modals` — it's small enough |

---

## 8. Critical Issues & Missing Pieces

### Blockers

| # | Issue | Impact | Fix |
|---|-------|--------|-----|
| 1 | `use-navigation-ui-modals.ts` does not exist | `use-navigation.ts` imports it → compile error | Create the file (Phase 5c) |
| 2 | `NavManager.decidePolicyForRoute()` does not exist | Observer calls it → runtime crash | Replace with `evaluateObservedRouteChange()` |
| 3 | Observer redirect callback is a no-op | Route violations detected but never corrected | Wire to `executeInternalRedirectNavigation()` OR show modal with redirect action |

### Improvements Identified

| # | Area | Current | Proposed |
|---|------|---------|----------|
| 4 | `use-navigation` owns modal state | Bloated hook, mixes concerns | Extract to `use-navigation-ui-modals` |
| 5 | Two `NavigationContext` types with same name | Confusing, error-prone | Rename one: `RouteConfigContext` for the config one, `NavigationContext` for transport |
| 6 | `modal_then_redirect` decision is TODO | Falls through to `onFailure()` | Implement properly once NavModal supports all 4 types |
| 7 | Observer doesn't know canGoBack | Can't pass correct prop to NavModal | Observer calls `callStateQueriesNav('canGoBack')` before showing modal |
| 8 | History methods are fire-and-forget | `back()`, `dismiss()` don't show failure modals | Accept for now — history failures are rare and non-critical |

---

## 9. NavServiceResult Decision Table

**How hooks interpret each status:**

| Status | use-navigation action | use-route-change-observer action | Internal redirect action |
|--------|----------------------|----------------------------------|-------------------------|
| `executed` | No-op (happy path) | No-op (route is valid) | Log success |
| `redirected` | No-op (already moved) | No-op (manager corrected it) | Log success |
| `aborted` | Show NavModal (failure) | Show NavModal (failure) + user picks where to go | Log error, retry or safe mode |
| `ui-required` | Show appropriate modal (trust consent, warning, etc.) | Show appropriate modal | N/A (internal redirects don't produce ui-required) |
| `no-op` | No-op (nothing to do) | No-op | Log warning |
| `transport-unavailable` | Show NavModal (failure, "system not ready") | Log error (can't correct) | Log error, queue retry |

---

## 10. Design Decisions

### Q: Should navManager return void or NavServiceResult?

**A: Return NavServiceResult.** The hook needs the discriminated union to decide what UI to show. The screen never sees it — the hook consumes it. This keeps the manager testable (you can assert on results) and the hook thin (just a switch on `status`).

```typescript
// Hook pattern:
const result = await executeRouteNavigation(target, params);
switch (result.status) {
  case 'executed':
  case 'redirected':
  case 'no-op':
    break; // happy path, nothing to do
  case 'aborted':
  case 'transport-unavailable':
    uiModals.showNavModal({ modalResponseType: 'failure', body: result.reason, ... });
    break;
  case 'ui-required':
    if (result.instruction.type === 'trusted-url-consent') {
      uiModals.showTrustModal({ url: result.instruction.url, ... });
    }
    break;
}
```

### Q: How do modals get their navigation callbacks?

**A: `use-navigation-ui-modals` computes them at show-time.** When calling `showNavModal()`, the hook pre-computes:
- `canGoBack` from `callStateQueriesNav('canGoBack')`
- `primaryAction` = `() => router.replace(computeFallbackRoute(worldId))` (go home)
- `secondaryAction` = `() => router.back()` (go back, if canGoBack)

The modal receives these as props — it never calls navManager.

### Q: What about use-throttled-navigation?

**A: Separate concern, separate hook.** It wraps `use-navigation` with debounce/cooldown. Not part of the core flow. Can be built later without touching any of the above.

```typescript
// Future:
export function useThrottledNavigation(cooldownMs = 300) {
  const nav = useNavigation();
  const lastNav = useRef(0);
  
  return {
    ...nav,
    to: (route, params) => {
      if (Date.now() - lastNav.current < cooldownMs) return;
      lastNav.current = Date.now();
      return nav.to(route, params);
    }
  };
}
```

### Q: Where are modals mounted?

**A: In `app/_layout.tsx` at root level.** The hook `use-navigation-ui-modals` is called there, and the modal components are rendered there:

```tsx
// app/_layout.tsx (simplified)
function RootLayout() {
  const nav = useNavigation();
  const uiModals = useNavigationUiModals();
  useRouteChangeObserver(uiModals); // pass modal controls to observer
  
  return (
    <>
      <Stack ... />
      <NavModal {...uiModals.navModalProps} />
      <TrustedUrlConsentModal {...uiModals.trustModalProps} />
    </>
  );
}
```

### Q: How does the observer get access to modal controls?

**A: Shared via parameter or context.**

**Option A (preferred — explicit):** Observer accepts `uiModals` as parameter:
```typescript
export function useRouteChangeObserver(uiModals: NavigationUiModalControls) {
  // ... on aborted result:
  uiModals.showNavModal({ type: 'failure', body: result.reason, ... });
}
```

**Option B (context):** Create `NavigationUiContext` — observer reads from context. More indirection but avoids prop drilling. Not needed since observer is only mounted at root alongside the modal hook.

---

## Summary: What We Need to Build

| Priority | Task | File | Dependencies |
|----------|------|------|-------------|
| 1 | Create `use-navigation-ui-modals` | `hooks/navigation/use-navigation-ui-modals.ts` | NavModal, TrustedUrlConsentModal, computeFallbackRoute |
| 2 | Fix observer broken import | `hooks/navigation/use-route-change-observer.ts` | Replace `NavManager.decidePolicyForRoute` with `evaluateObservedRouteChange` |
| 3 | Wire observer redirect callback | `hooks/navigation/use-route-change-observer.ts` | Replace no-op with modal show |
| 4 | Refactor `use-navigation` to use `use-navigation-ui-modals` | `hooks/navigation/use-navigation.ts` | use-navigation-ui-modals exists |
| 5 | Mount modals in root layout | `app/_layout.tsx` | Hooks wired |
| 6 | Rename duplicate `NavigationContext` type | `lib/navigation/navigationConfig.ts` | Low risk, high clarity |
