/**
 * Navigation Intent Log
 *
 * Single-slot write-once, read-once log that bridges navManager's execute functions
 * to the route change observer.
 *
 * **The problem it solves:**
 * When `useSegments()` changes, `useRouteChangeObserver` has no idea why the segments
 * changed. It used to stamp every observed change as `'deep-link'` — even `navigate.back()`
 * and bootstrap redirects. This is wrong: guards should know if a change was initiated by
 * the app itself vs. an external OS deep link.
 *
 * **How it works:**
 * 1. Any navManager execute function calls `recordIntent(...)` BEFORE delegating to
 *    middleware. The intent is stored in a module-level slot.
 * 2. When `evaluateObservedRouteChange` fires (triggered by the segments change that
 *    resulted from that navigation), it calls `consumeIntent()` to read and clear the
 *    slot in one operation.
 * 3. If the slot is null (nothing was recorded), the change came from outside the app
 *    (OS deep link, native intent, Expo Router dev tools) → correctly falls back to
 *    `'deep-link'`.
 *
 * **Why this is safe:**
 * - Navigation is synchronous in terms of JS execution order: `recordIntent` is called
 *   before `router.push/replace/back` which triggers the segments change on the NEXT
 *   React render cycle. The slot is always set before the observer can read it.
 * - `consumeIntent` is destructive (clears after read), so stale intents cannot bleed
 *   across multiple segment changes.
 * - This module has no React, no async, no side effects — pure module-level state.
 *
 * **Layer:** lib/navigation — intentionally NOT in system/. This is orchestration
 * knowledge about who initiated the navigation, not transport infrastructure.
 */

/**
 * The intent types that navManager can record.
 *
 * - 'user'     → `executeRouteNavigation` — user gesture (tap, click)
 * - 'redirect' → `executeInternalRedirectNavigation` — app-driven force-navigate
 * - 'back'     → `executeHistoryNavigation('back')` — explicit back button / programmatic
 * - 'dismiss'  → `executeHistoryNavigation('dismiss'/'dismissAll'/'dismissTo')` — modal close
 */
export type NavigationIntent = 'user' | 'redirect' | 'back' | 'dismiss';

let pendingIntent: NavigationIntent | null = null;

/**
 * Record the intent of an imminent navigation.
 *
 * Call this in navManager BEFORE delegating to middleware/transport.
 * The intent will be consumed by the next `evaluateObservedRouteChange` call.
 *
 * @param intent - What kind of navigation is about to happen.
 */
export function recordIntent(intent: NavigationIntent): void {
  pendingIntent = intent;
}

/**
 * Read and clear the pending intent.
 *
 * Returns the recorded intent and resets the slot to null in one atomic operation.
 * If nothing was recorded (OS deep link, external navigation), returns null.
 *
 * @returns The pending intent, or null if no app-initiated navigation was recorded.
 */
export function consumeIntent(): NavigationIntent | null {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
