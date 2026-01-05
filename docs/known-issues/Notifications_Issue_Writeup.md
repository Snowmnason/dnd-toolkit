# RN Web notification flicker on first render (Expo Router + Reanimated)

This document summarizes the notification rendering issue observed in this repo, the symptoms, hypotheses, experiments, and the current workaround. It is intended for public posting or sharing with an AI assistant to help pin down the root cause.

## TL;DR
- On web (Expo + React Native Web), in-app notifications flicker on their very first render.
- The flick happens a split second before the show animation would start.
- Removing all animations, portals, and most container logic did not eliminate the flick.
- Removing the Notification provider/container from the app entirely eliminates both the flick and prior interaction blocking.
- Temporary workaround: notifications are disabled at runtime; use AppToast/Snackbar instead.

## Environment (at time of issue)
- Expo SDK: 54.x
- React Native: 0.81.5
- React Native Web: ~0.21.0
- React: ^19.1.0
- Reanimated: ~4.1.1
- Gesture Handler: ~2.28.0
- Safe Area Context: ~5.6.0
- Platforms: Web (primary), iOS/Android (secondary)

## Architecture context
- Router/layout: app/_layout.tsx
  - Root providers: ThemeProvider -> ScaleProvider -> PlatformProvider -> AppParamsProvider
  - Bootstrap gate: UI waits on useAppBootstrap().isReady
  - Top bar behavior depends on useSegments() and params in AppParamsContext
- UI system: components/ui/* (barrel export in components/ui/index.ts)
- Notification stack (now disabled at runtime):
  - Provider/hook: hooks/use-notifications.tsx
  - Container: components/ui/NotificationContainer.tsx
  - Item: components/ui/Notification.tsx

## Symptoms
- A visual flash or flicker occurs the first time a notification should appear.
- The flick occurs immediately before any animation callback; persists even with all animations removed.
- Earlier iterations also caused click/scroll to be blocked by an overlay (RN Web pointer events) — that was fixed but the flick remained.
- Only reproducible on first post-load render; subsequent notifications are visually stable.

## What we tried (chronological highlights)
1. Positioning/overlay fixes
   - Avoided full-screen wrappers; moved pointerEvents into style; rendered only notification children (no absolute fullscreen View).
   - Result: interaction blocking resolved; flick still present.

2. Animation removal and gating
   - Removed Reanimated logic entirely; rendered a plain notification View.
   - Gated with requestAnimationFrame and setTimeout(0/16) before first paint.
   - Result: flick still present and occurs before any explicit animation.

3. Container/provider reshuffles
   - Mounted container always vs. null when empty.
   - Memoized container; moved it around the provider tree; tried portal/modal approaches.
   - Result: no change; flick persisted independent of placement and memoization.

4. General warnings/noise cleanup
   - Fixed RN Web pointerEvents deprecation (moved to style prop).
   - Removed eager loading of heavy web fonts in bootstrap.
   - Fixed React hook order violations in unrelated inputs.
   - Result: cleaner console; no impact on flick.

5. Final experiment
   - Removed the NotificationProvider/Container from the app layout; disabled demo triggers.
   - Result: flick and blocking issues vanished. We now rely on AppToast/Snackbar.

## Hypotheses (why the flick might happen)
- Initial layout reflow in RN Web for absolute overlays
  - First mount of an absolutely positioned element (container or item) may force a reflow/paint that briefly shows incorrect state.
- Safe area or top-level provider recompute on first frame
  - react-native-safe-area-context or our provider stack might change layout metrics during the first RN Web frame, causing a transient style snap.
- Theme token/variable resolution on web
  - $() resolves to CSS variables on web. Initial null/undefined -> resolved token may cause a one-frame color/background jump.
- Expo Router contentStyle vs. theme timing
  - The Stack contentStyle: { backgroundColor: '$background' } may update as theme initializes, briefly revealing default RN Web background.
- Reanimated/JS event sync (even when removed)
  - Reanimated v4 can still patch certain styles/props. First runOnJS/UI pass might induce a micro-layout update that manifests visually.
- Z-index stacking/context
  - Overlay stacking contexts (especially after eliminating fullscreen wrappers) might reorder paints on first mount.

## Why common fixes did not help
- Removing animations: Indicates the flick is not caused by our show/hide animation code.
- Always-mounted container: If the flick were from mount/unmount, pre-mounting should have helped; it did not.
- Memoization: Suggests the flick is not from React diff churn in the container; likely from RN Web layout/style resolution.
- Pointer events and overlay fixes: Resolved interaction blocking but did not touch the underlying first-frame visual jump.

## Current status and workaround
- The Notification system (provider/container) is disabled in app/_layout.tsx.
- Notification remains as a presentational component, but not wired to a queue.
- Use AppToast and Snackbar for transient feedback (they do not flicker).

## Minimal repro guidance (for helpers)
- Platform: Web, dev mode and production builds; repro is easiest right after a hard refresh.
- Mount a notification container that renders a child on demand (absolute top/bottom positioning). Avoid portals.
- Ensure theme tokens ($background, etc.) and providers are active; use a Stack with contentStyle referencing $background.
- Trigger first notification after bootstrap completes — observe a swift flash before the item appears.

## Pointers to code
- Layout/providers: app/_layout.tsx
- Bootstrap gate: hooks/use-app-bootstrap.tsx
- Auth/routing guard: lib/auth-state.ts
- UI barrel: components/ui/index.ts
- Notifications (now idle): hooks/use-notifications.tsx, components/ui/NotificationContainer.tsx, components/ui/Notification.tsx

## What we would like help validating
1. Do CSS variable-backed tokens on RN Web cause a one-frame flash on first resolution under Expo Router Stack?
2. Does mounting the first absolutely positioned overlay trigger a forced reflow/paint order issue in RN Web 0.21?
3. Could react-native-safe-area-context or initial viewport measurement shift layout on the first frame on web?
4. Any known Reanimated v4 + RN Web first-frame paint artifacts even when components are non-animated at the JS level?
5. Recommended pattern for non-blocking, non-flickering global toasts/notifications on RN Web (Expo Router) that play nicely with CSS var theming.

## Temporary constraints
- We prefer not to reintroduce fullscreen overlays that can block web interactions.
- We need cross-platform parity (web first), so a solution should not rely solely on native-only APIs.

---

If additional artifacts (screen recordings, trace logs) would help, we can attach them. We can also produce a reduced reproducible example if needed.